# Running NewsBug

**Stack answer: no Supabase, no Appwrite, no Convex.** Everything runs as one Next.js app on Vercel + MongoDB Atlas. The old Appwrite Python functions are now TypeScript API routes driven by Vercel Cron. `appwrite/`, `fastapi-server/`, `react-client/` are dead legacy — ignore them.

```
Vercel (one deploy)
└── next-client/
    ├── UI: 3D globe, Mapbox map, sources/categories
    ├── /api/cron/poll     every 10 min → schedule + crawl
    └── /api/cron/analyse  every 5 min  → Gemini + geocode
                    ↓
            MongoDB Atlas (disease-data)
```

---

## 1. Run locally (5 commands)

```bash
cd next-client
cp .env.example .env.local     # then fill it in — see below
npm install
npm run dev                    # http://localhost:3000
```

`.env.local` — **already created on this machine** with your Mongo URI + Mapbox token pulled from `next-client/.env` and `react-client/.env`. Only one value is missing:

```env
MONGODB_URI=mongodb+srv://...          # ✅ found locally, works (1328 articles)
MONGODB_DB=disease-data                # ✅
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...     # ✅ found locally
CRON_SECRET=<64-hex>                   # ✅ generated
GEMINI_API_KEY=                        # ❌ YOU MUST ADD THIS
```

**Get the Gemini key:** https://aistudio.google.com/apikey → paste into `GEMINI_API_KEY`. Nothing else is needed.

## 2. Test without any API keys

```bash
npm test              # smoke + 28 regression checks, in-memory Mongo, no network
```

## 3. Drive the pipeline by hand

```bash
# local dev needs the secret now (endpoints fail closed by default)
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/poll
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/analyse
```

Repeat `poll` until crawls report `"completed": true`, then `analyse`. Results land on `/sources`.

## 4. Deploy to Vercel

1. Import repo → **Root Directory = `next-client`**.
2. Add all 5 env vars from `.env.local` (Settings → Environment Variables). `CRON_SECRET` is **required** in production.
3. Deploy. `next-client/vercel.json` registers both crons.
4. Atlas → Network Access → allow `0.0.0.0/0`.

> Vercel **Hobby** caps cron at once/day. Either upgrade to Pro, or use the included GitHub Actions scheduler (`.github/workflows/pipeline-cron.yml`) — add repo secrets `PIPELINE_BASE_URL` + `CRON_SECRET` and it pings both endpoints every 10 min free.

## 5. Optional env

| Var | Default | Purpose |
|---|---|---|
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | any Gemini id (e.g. `gemini-3.7-flash`) |
| `PIPELINE_MAX_DEPTH` | `2` | link-follow depth |
| `PIPELINE_MAX_PAGES` | `200` | pages per source per cycle |
| `PIPELINE_TIME_BUDGET_MS` | `240000` | soft per-invocation budget |
| `PIPELINE_ALLOW_PRIVATE_HOSTS` | unset | allow crawling intranet/localhost (SSRF guard off) |
| `ALLOW_UNAUTH_CRON` | unset | dev-only: open `/api/cron/*` without a secret |

## 6. Troubleshooting

- **Map blank** → `NEXT_PUBLIC_MAPBOX_TOKEN` missing; it's baked at build time, so redeploy after setting it.
- **`/api/cron/*` 401** → send the `Authorization: Bearer $CRON_SECRET` header.
- **Nothing crawls** → source needs `isActive: true` and `nextRunAt` in the past. The poller now auto-heals sources wedged in `running` (all 5 of yours were, since March 2025).
- **Articles stuck `data_extracted`** → run `/api/cron/analyse`; check `GEMINI_API_KEY`. Rate limits no longer park articles permanently.

---

## ⚠️ Rotate these before deploying

Committed in git history, so treat as compromised: the **Atlas password** (`harshbanka`), the **Mapbox token**, and an old **Gemini key**. Code no longer contains them, but history does.

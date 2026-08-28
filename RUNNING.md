# Running NewsBug

NewsBug is now a **single deployable app**: the Next.js dashboard in [`next-client/`](next-client/) contains the UI *and* the crawling/analysis pipeline (as API route handlers triggered by cron). The old Appwrite functions, FastAPI server, and Vite client are legacy and no longer needed to run the project.

```
Vercel (or any Node host)
└── next-client/            Next.js 15 app
    ├── UI: 3D globe, Mapbox map, source/category management
    ├── /api/cron/poll      every 10 min → finds due sources, crawls them
    └── /api/cron/analyse   every 5 min  → Gemini analysis + Mapbox geocoding
                 │
                 ▼
        MongoDB Atlas (disease-data)
```

---

## 1. Prerequisites

| What | Where to get it | Free tier |
|------|-----------------|-----------|
| Node.js ≥ 20 | https://nodejs.org | — |
| MongoDB Atlas cluster | https://www.mongodb.com/cloud/atlas | M0 free cluster is enough |
| Mapbox access token | https://console.mapbox.com/account/access-tokens/ | 50k map loads + 100k geocodes/mo |
| Gemini API key | https://aistudio.google.com/apikey | free tier available |

## 2. Configure environment

```bash
cd next-client
cp .env.example .env.local
```

Fill in `.env.local`:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=disease-data
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...        # map rendering + geocoding
GEMINI_API_KEY=AIza...                    # article analysis
CRON_SECRET=<openssl rand -hex 32>        # protects /api/cron/* (optional in dev)
# GEMINI_MODEL=gemini-2.5-flash           # optional; default gemini-2.5-flash-lite
```

## 3. Run locally

```bash
cd next-client
npm install
npm run dev        # http://localhost:3000
```

- **Home** (`/`) — 3D globe landing page.
- **Sources** (`/sources`) — create a **category** (with disease/symptom keywords), then a **source** (news site URL + cron schedule). New sources are due immediately (`nextRunAt = now`).

Drive the pipeline by hand while developing (in dev, auth is skipped when `CRON_SECRET` is unset):

```bash
# crawl due sources (job-pooler + process-source in one call)
curl http://localhost:3000/api/cron/poll
# analyse crawled articles with Gemini + geocode with Mapbox
curl http://localhost:3000/api/cron/analyse
```

Re-run `poll` until crawls report `"completed": true`, then `analyse`; results appear on the `/sources` map and table.

### Pipeline smoke test (no keys needed)

Verifies poll → crawl → analyse end-to-end using an in-memory MongoDB, a local fake news site, and a stubbed LLM/geocoder:

```bash
cd next-client
npm run smoke
```

## 4. Deploy to Vercel

1. Import the GitHub repo in Vercel and set **Root Directory = `next-client`** (framework auto-detects Next.js).
2. Add the environment variables from step 2 in *Project → Settings → Environment Variables* (`CRON_SECRET` is **required** in production; Vercel Cron automatically sends it as `Authorization: Bearer <CRON_SECRET>`).
3. Deploy. `next-client/vercel.json` registers the cron jobs:
   - `/api/cron/poll` — every 10 minutes
   - `/api/cron/analyse` — every 5 minutes

> **Vercel Hobby plan:** cron jobs are limited to once per day. Either upgrade to Pro, or enable the included GitHub Actions scheduler: add the repository secrets `PIPELINE_BASE_URL` (your deployment URL) and `CRON_SECRET` — [.github/workflows/pipeline-cron.yml](.github/workflows/pipeline-cron.yml) then pings both endpoints every 10 minutes for free.

Manual production trigger:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>.vercel.app/api/cron/poll
```

## 5. Pipeline tuning (optional env vars)

| Variable | Default | Meaning |
|----------|---------|---------|
| `PIPELINE_MAX_DEPTH` | `2` | link-follow depth from the source URL |
| `PIPELINE_MAX_PAGES` | `200` | max pages crawled per source per cycle |
| `PIPELINE_TIME_BUDGET_MS` | `240000` | soft per-invocation budget; long crawls resume next tick |
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` | any Gemini model id |
| `MAPBOX_TOKEN` | falls back to `NEXT_PUBLIC_MAPBOX_TOKEN` | separate server-side geocoding token |

## 6. Data model (MongoDB `disease-data`)

| Collection | Written by | Contents |
|------------|-----------|----------|
| `categories` | dashboard | `{ name, keywords[] }` |
| `sources` | dashboard + pipeline | `{ url, categoryId, cronSchedule, status: idle\|running\|error, nextRunAt, ... }` |
| `job-executions` | pipeline | one crawl run; resumable progress in `metadata.crawl_progress` |
| `articles` | pipeline | `status: data_extracted → completed` (or `analysis_failed` after 3 attempts); `keywords[] = { keyword, location, caseCount, latitude, longitude }` |

No migrations needed — an empty database bootstraps itself on first use.

## 7. Troubleshooting

- **Map is blank** → `NEXT_PUBLIC_MAPBOX_TOKEN` missing (it is read at build time; redeploy after setting it).
- **`/api/cron/*` returns 401** → send `Authorization: Bearer <CRON_SECRET>`; in production the var must be set.
- **Nothing gets crawled** → source must have `isActive` and `nextRunAt` in the past; check the `job-executions` collection and the function logs in Vercel.
- **Articles stuck in `data_extracted`** → run `/api/cron/analyse`; check `GEMINI_API_KEY`. After 3 failed attempts articles are parked as `analysis_failed`.
- **Atlas connection errors on Vercel** → allow `0.0.0.0/0` (or Vercel IPs) in Atlas *Network Access*.

## Legacy components (not needed)

- `appwrite/` — old serverless pipeline (superseded by `/api/cron/*`)
- `fastapi-server/`, `main.py`, `scripts/`, `notebooks/` — old OCR/spaCy experiments
- `react-client/` — old Vite frontend

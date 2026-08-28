# NewsBug

Real-time disease outbreak monitoring platform that crawls news sources, analyzes articles for health keywords using NLP and AI, geocodes mentioned locations, and visualizes results on an interactive 3D globe and Mapbox map.

---

## Features

- **Category Management** - Create monitoring categories with disease/health keywords (Measles, COVID-19, Flu, etc.)
- **Source Management** - Add news source URLs with configurable cron-based crawl schedules
- **Automated Web Crawling** - Depth-limited (max 2 levels, 1000 pages) domain-scoped crawler with duplicate detection
- **AI-Powered Analysis** - Gemini 3.5 Flash analyzes articles for disease mentions, extracts keywords + locations + case counts
- **NER Pipeline** - spaCy transformer model (`en_core_web_trf`) for named entity recognition on OCR'd text
- **PDF Newspaper Processing** - OCR pipeline: PDF → images → Tesseract → spaCy NER → geocoded locations
- **Geocoding** - Mapbox API converts location names to coordinates for map display
- **3D Globe Visualization** - Three.js globe with animated arcs showing global disease spread
- **Interactive Map** - Mapbox GL with clustering, color-coded severity, click-to-zoom, detail popups
- **Geospatial Filtering** - Filter by keywords, date range, and geographic radius (MongoDB `$geoWithin`)
- **Data Table View** - Sortable table with TanStack Table for keyword analysis results

---

## Architecture

```
                 ┌───────────────────────────────────────────┐
                 │       Next.js 15 app (Vercel)             │
                 │                                           │
                 │  Dashboard (3D Globe + Mapbox Map)        │
                 │        │ Server Actions                   │
                 │        ▼                                  │
                 │  ┌─────────────────────────────────────┐  │
                 │  │ Vercel Cron → API route handlers    │  │
                 │  │  /api/cron/poll     (every 10 min)  │  │
                 │  │    source poller + web crawler      │  │
                 │  │  /api/cron/analyse  (every 5 min)   │  │
                 │  │    Gemini analysis + geocoding      │  │
                 │  └─────────────────────────────────────┘  │
                 └────────────────────┬──────────────────────┘
                                      ▼
                 ┌───────────────────────────────────────────┐
                 │   MongoDB Atlas (disease-data)            │
                 └───────────────────────────────────────────┘
```

The entire pipeline runs as serverless functions inside the Next.js app — one deploy, one host. (It previously ran as Appwrite Cloud Functions; that code remains in `appwrite/` as legacy.)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, TailwindCSS |
| Visualization | Three.js + React Three Fiber (globe), Mapbox GL (map) |
| State | Zustand |
| UI | Radix UI, Framer Motion, TanStack Table |
| Backend | Next.js route handlers + Vercel Cron (TypeScript) |
| AI | Gemini 3.5 Flash Lite (`@google/genai`, structured output) |
| Crawling | fetch + cheerio + `@extractus/article-extractor` |
| Geocoding | Mapbox Geocoding API (v6) |
| Database | MongoDB Atlas (GeoJSON, 2dsphere indexing) |
| Legacy | Appwrite functions (Python), FastAPI + spaCy/Tesseract OCR, Vite client |

---

## NLP Pipeline

### Current (Gemini AI)
1. Articles crawled with a depth-limited domain crawler; readable content extracted via `@extractus/article-extractor`
2. Batches of 10 sent to Gemini 3.5 Flash Lite with a structured-output schema (model configurable via `GEMINI_MODEL`)
3. Extracts: disease keyword, location, case count (one mention per location)
4. Batch geocodes locations via the Mapbox Geocoding API
5. Stores geocoded keyword entries on the article documents in MongoDB

### Legacy (spaCy + OCR)
1. PDF → images via `pdf2image`
2. OCR each page with Tesseract
3. spaCy transformer NER identifies `GPE` entities
4. Nearest GPE to keyword mention selected as location
5. Geocoded via Nominatim → stored as GeoJSON

---

## Project Structure

```
news-bug/
├── next-client/                 # THE app (dashboard + pipeline)
│   ├── src/app/
│   │   ├── page.tsx            # Home with 3D globe
│   │   ├── sources/            # Source management + map view
│   │   ├── actions/            # Server actions (CRUD)
│   │   └── api/cron/           # Pipeline route handlers
│   │       ├── poll/           #   source poller + crawler tick
│   │       └── analyse/        #   Gemini + geocoding tick
│   ├── src/lib/pipeline/       # Poller, crawler, analyser, gemini, geocode
│   ├── src/lib/mongodb.ts      # Lazy shared DB connection
│   ├── scripts/smoke-pipeline.ts  # Keyless end-to-end pipeline test
│   └── vercel.json             # Cron schedules
├── .github/workflows/pipeline-cron.yml  # Free scheduler alternative
├── appwrite/                   # LEGACY: old Appwrite functions (Python)
├── main.py, scripts/, fastapi-server/   # LEGACY: OCR/spaCy experiments
└── react-client/               # LEGACY: old Vite frontend
```

---

## Getting Started

**Full setup, deployment, and troubleshooting guide: [RUNNING.md](RUNNING.md)**

```bash
cd next-client
cp .env.example .env.local   # fill in MONGODB_URI, NEXT_PUBLIC_MAPBOX_TOKEN, GEMINI_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

Trigger the pipeline manually while developing:

```bash
curl http://localhost:3000/api/cron/poll     # crawl due sources
curl http://localhost:3000/api/cron/analyse  # Gemini analysis + geocoding
```

Verify the whole pipeline end-to-end without any API keys:

```bash
npm run smoke
```

In production the same two endpoints run on Vercel Cron (`next-client/vercel.json`): poll every 10 minutes, analyse every 5 minutes. On the Vercel Hobby plan use the bundled [GitHub Actions scheduler](.github/workflows/pipeline-cron.yml) instead.

---

## Visualization

**3D Globe** — Three.js globe on landing page with animated arcs representing disease spread across regions.

**Mapbox Map** — Functional data layer with:
- Clustered GeoJSON points (color-coded: blue < 100, yellow < 500, red >= 500 cases)
- Click clusters to zoom; click points for popups (keyword, case count, location, article sources)
- Real-time data from MongoDB geospatial queries

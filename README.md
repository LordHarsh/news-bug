# NewsBug

Real-time disease outbreak monitoring platform that crawls news sources, analyzes articles for health keywords using NLP and AI, geocodes mentioned locations, and visualizes results on an interactive 3D globe and Mapbox map.

---

## Features

- **Category Management** - Create monitoring categories with disease/health keywords (Measles, COVID-19, Flu, etc.)
- **Source Management** - Add news source URLs with configurable cron-based crawl schedules
- **Automated Web Crawling** - Depth-limited (max 2 levels, 1000 pages) domain-scoped crawler with duplicate detection
- **AI-Powered Analysis** - Gemini 2.0 Flash analyzes articles for disease mentions, extracts keywords + locations + case counts
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
                    ┌─────────────────────────────┐
                    │   Next.js 15 Dashboard      │
                    │   (3D Globe + Mapbox Map)    │
                    └──────────────┬──────────────┘
                                   │ Server Actions
                                   ▼
                    ┌─────────────────────────────┐
                    │   MongoDB Atlas             │
                    │   (GeoJSON + 2dsphere idx)  │
                    └──────────────┬──────────────┘
                                   ▲
              ┌────────────────────┼────────────────────┐
              │                    │                    │
    ┌─────────┴─────────┐ ┌──────┴───────┐ ┌─────────┴─────────┐
    │  job-pooler        │ │ process-source│ │ analyse-article    │
    │  (cron: 10min)     │ │ (web crawler) │ │ (Gemini + geocode) │
    └────────────────────┘ └──────────────┘ └───────────────────┘
              Appwrite Serverless Functions
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, TailwindCSS |
| Visualization | Three.js + React Three Fiber (globe), Mapbox GL (map) |
| State | Zustand |
| UI | Radix UI, Framer Motion, TanStack Table |
| Backend | Appwrite Cloud Functions (Python 3.12) |
| AI/NLP | Gemini 2.0 Flash Lite, spaCy `en_core_web_trf` |
| OCR | Tesseract (pytesseract) |
| Geocoding | Mapbox Geocoding API |
| Database | MongoDB Atlas (GeoJSON, 2dsphere indexing) |
| Legacy Server | FastAPI, PyTorch, OpenCV |

---

## NLP Pipeline

### Current (Gemini AI)
1. Articles crawled via `newspaper3k` extraction
2. Content sent to Gemini 2.0 Flash Lite with structured prompt
3. Extracts: disease keyword, location, case count
4. Batch geocodes locations via Mapbox API
5. Stores as GeoJSON Points in MongoDB

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
├── next-client/                 # Primary dashboard (Next.js 15)
│   ├── src/app/
│   │   ├── page.tsx            # Home with 3D globe
│   │   ├── sources/            # Source management + map view
│   │   └── actions/            # Server actions (CRUD)
│   ├── src/components/ui/
│   │   └── globe.tsx           # Three.js globe component
│   └── src/lib/mongodb.ts      # DB connection
├── appwrite/functions/          # Serverless pipeline
│   ├── job-pooler/             # Cron poller (every 10 min)
│   ├── process-source/         # Web crawler
│   └── analyse-article/        # Gemini analysis + geocoding
├── main.py                     # Legacy FastAPI server
├── scripts/
│   ├── find_location.py        # spaCy NER + geocoding
│   └── database.py             # MongoDB helpers
└── react-client/               # Legacy Vite frontend (Leaflet)
```

---

## Getting Started

### Next.js Client

```bash
cd next-client
npm install
cp .env.example .env.local
npm run dev
```

### Environment Variables

```env
MONGODB_URI=mongodb+srv://...
MONGODB_DB=disease-data
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...
```

### Appwrite Functions

```bash
appwrite deploy function
```

Functions auto-trigger on cron schedules:
- `job-pooler`: every 10 minutes
- `analyse-article`: every 5 minutes

### Legacy Server (Optional)

```bash
pip install -r requirements.txt
# Requires: Tesseract OCR, poppler (for pdf2image)
python main.py
```

---

## Visualization

**3D Globe** — Three.js globe on landing page with animated arcs representing disease spread across regions.

**Mapbox Map** — Functional data layer with:
- Clustered GeoJSON points (color-coded: blue < 100, yellow < 500, red >= 500 cases)
- Click clusters to zoom; click points for popups (keyword, case count, location, article sources)
- Real-time data from MongoDB geospatial queries

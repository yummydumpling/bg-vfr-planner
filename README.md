# BG VFR Planner

An original VFR flight-planning Progressive Web App for pilots flying in Bulgaria.
Bulgarian / English UI, mobile-first, dark mode, works offline after first load.

> ⚠️ **Supplementary tool only — not for primary navigation.** Always verify against the
> official AIP Bulgaria, NOTAMs and a proper pre-flight briefing.

## Status

| Step | Feature | State |
|---|---|---|
| 1 | Navigation maths module (`src/nav`) + unit tests | ✅ done |
| 2 | Map, airspace, airports, reporting points, info cards, BG/EN, dark mode, offline PWA | ✅ done |
| 3 | Route planning: tap to add (snaps to aerodromes/points/navaids), drag to move, + to insert, reorder, delete, reverse, undo | ✅ done |
| 4 | Nav log (TT, VAR, MT, WCA, MH, GS, ETE, fuel per leg + totals with reserve), aircraft profiles, wind & cruise altitude | ✅ done |
| 5 | Airspace crossing list (entry/exit NM, limits vs cruise altitude, tap to show on map) | ✅ done |
| 6 | ICAO flight plan (items 7–19, per-field copy for B-FLIP, full FPL message), share, print/PDF, pilot details | ✅ done |
| 7 | METAR / TAF (Weather tab + aerodrome cards, report age, offline cache) via Cloudflare Worker proxy | ✅ done |
| 8 | Route library (IndexedDB: save, open, rename, copy, delete), GPX export/import with aerodrome/point/navaid recognition | ✅ done |

## Setup

Requires Node 22+.

```bash
npm install
npm test          # unit tests (Vitest)
npm run dev       # dev server
npm run build     # production build
```

### Weather (METAR/TAF)

The browser can't call aviationweather.gov directly (no CORS), so the app uses a
small Cloudflare Worker — see [`proxy/README.md`](proxy/README.md). Build with its URL:

```bash
VITE_WX_PROXY_URL=https://<worker>.workers.dev npm run build   # or set it in .env.production
```

In development (`npm run dev`) the Vite dev server proxies `/wx` to aviationweather.gov instead.

### Refreshing the aeronautical data

The openAIP snapshot in `public/data/bg/` is committed, so building does **not** need a key.
To refresh it (e.g. each AIRAC cycle), get a free API key at openaip.net → profile → *API Clients*,
then put it in a git-ignored `.env.local` file:

```bash
echo "OPENAIP_API_KEY=your-key" > .env.local
npm run data:fetch
```

If you are behind an HTTP proxy, run it with `NODE_USE_ENV_PROXY=1` (Node ≥ 22.21).
The script downloads Bulgaria plus neighbouring airspace/aerodromes near the border
(RO, RS, MK, GR, TR) and writes normalised JSON.

## Navigation maths (`src/nav`)

| File | Purpose |
|---|---|
| `geo.ts` | Great-circle distance/bearing, intermediate & destination points, densify. Spherical earth, R = 3440.065 NM. |
| `wind.ts` | Wind triangle (WCA, true heading, ground speed), true↔magnetic. |
| `magvar/wmm.ts` | World Magnetic Model evaluator (own implementation), WMM2025 coefficients. |
| `coords.ts` | ICAO Item 15 coordinates (`4241N02323E`), DM/DMS display, coordinate parser. |
| `navlog.ts` | Per-leg nav log and fuel totals (taxi + trip + reserve, endurance). |

Conventions: the leg's true track is the great-circle course at the leg midpoint, which is
within a few tenths of a degree of the constant-heading course for VFR-length legs. Magnetic
variation is evaluated at the leg midpoint; East is positive, so MT = TT − VAR. Fuel is
unit-agnostic (litres or US gal, whichever the aircraft profile uses).

## Data sources, licences and attribution

| Data | Source | Licence / terms | How it's used |
|---|---|---|---|
| Airspace, airports, navaids, reporting points | [openAIP](https://www.openaip.net) Core API | **CC BY-NC 4.0**. openAIP: data "must remain free for everyone to use"; may ship in paid apps as long as openAIP data itself isn't sold. API key must be kept confidential; caching is encouraged; attribution link required. | Snapshot downloaded at **build time** (key never shipped to the browser), bundled as static JSON. Attribution shown in the app. |
| Official reference | BULATSA — [AIP Bulgaria](https://aip.bulatsa.com), [B-FLIP portal](https://b-flip.bulatsa.com) | Not redistributed | Link out only, e.g. `https://b-flip.bulatsa.com/airports/{ICAO}/general` |
| METAR / TAF | [aviationweather.gov Data API](https://aviationweather.gov/data/api/) (NOAA) | US Government data. 100 requests/min, custom User-Agent requested. **No CORS headers**, so the browser cannot call it directly. | Through a small CORS proxy (`proxy/`, Cloudflare Worker) with caching |
| Base map | [OpenFreeMap](https://openfreemap.org) vector tiles, data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, schema © OpenMapTiles | Free, no key, commercial use OK, attribution required. Offline downloads ≤ 3 000 tiles / 50 MB, ≤ 4 parallel requests. | MapLibre GL JS; tiles cached as you browse |
| Magnetic variation | NOAA NCEI / BGS [World Magnetic Model 2025](https://www.ncei.noaa.gov/products/world-magnetic-model) | Public domain | Coefficients in `src/nav/magvar/wmm2025.coef.ts`; NOAA test values used in unit tests |

## Licence

All code in this repository is original. (Project licence: TBD by the owner.)

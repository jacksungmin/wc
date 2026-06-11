# GeoScenario — NYC Climate Resilience Dashboard

A geospatial scenario-planning dashboard for exploring NYC climate resilience scenarios from 2024 to 2040.

## Stack

- **React 18** + **TypeScript**
- **Vite 6** (bundler + dev server)
- **Tailwind CSS v4** (via `@tailwindcss/vite` plugin)
- **Leaflet.js** — interactive dark-themed map
- **Recharts** — radar and bar charts
- **Lucide React** — icons

## Features

- **Scenario Planner** — switch between 4 pre-loaded climate scenarios (Baseline, High Growth, Climate Stress, Resilient Future)
- **Interactive Map** — CartoDB dark tiles with scenario-specific zone overlays (circles, polygons)
- **Scenario Comparison** — compare any two scenarios side-by-side on the map and in charts
- **Analytics Panel** — risk gauges, radar chart across 6 dimensions, key indicator cards
- **Timeline Playback** — scrub or animate through 2024–2040 with scenario year pins
- **Add Scenario Modal** — create custom scenarios from templates

## Setup

### Prerequisites

- Node.js 18+ (check with `node -v`)
- npm, pnpm, or yarn

### Install

```bash
cd C:\App\Worldcup_dashboard
npm install
```

Or with pnpm:

```bash
pnpm install
```

### Run (development)

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build (production)

```bash
npm run build
```

Output goes to `dist/`. Preview the production build with:

```bash
npm run preview
```

## Project Structure

```
src/
├── App.tsx                  # Root component, global state
├── main.tsx                 # Entry point
├── index.css                # Global styles + Tailwind + theme vars
├── types/
│   └── index.ts             # Shared TypeScript interfaces
├── data/
│   └── scenarios.ts         # All scenario data + constants
└── components/
    ├── ScenarioPanel.tsx    # Left sidebar
    ├── MapView.tsx          # Leaflet map
    ├── MetricsPanel.tsx     # Analytics drawer (charts + cards)
    ├── TimelineBar.tsx      # Timeline scrubber
    ├── AddScenarioModal.tsx # New scenario modal
    └── RiskBadge.tsx        # Reusable risk level badge
```

## Customization

- **Add scenarios**: Edit `src/data/scenarios.ts` — add an entry to `SCENARIOS` array.
- **Extend templates**: Add entries to `SCENARIO_TEMPLATES` in the same file.
- **Map center/zoom**: Change `MAP_CENTER` and `MAP_ZOOM` in `src/data/scenarios.ts`.
- **Radar scores**: Update `RADAR_SCORES` keyed by scenario ID.
- **Colors/theme**: Edit CSS variables in `src/index.css`.

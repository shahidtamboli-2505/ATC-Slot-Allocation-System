# SkySlot AI — Intelligent ATC Decision Support System

An AI-powered Air Traffic Control runway slot allocation and decision-support prototype for high-density airports.

## Quick Start

```bash
# No dependencies required — pure HTML/CSS/JS
python -m http.server 3000
# Open http://localhost:3000
```

## Features

- **Dashboard** — Real-time operational overview with summary cards, flight queue, runway timeline, conflict alerts, metrics, and weather
- **Flight Queue** — Filterable/searchable table with fuel indicators, priority badges, status tracking
- **New Slot Request** — Guided 3-step wizard: Flight ID → Details → AI Analysis
- **AI Recommendation** — Runway, slot time, priority score, conflict risk, safety checks, and "Why This Slot?" explainer
- **Accept / Modify / Reject** — Controller reviews AI recommendation with safety validation on modifications
- **Runway Status** — Per-runway cards with queue depth, next flight, direction, status
- **Conflict Monitor** — Wake turbulence, separation, and weather conflicts with AI resolution recommendations
- **Weather / METAR** — Wind, visibility, QNH, temperature, raw METAR, impact warnings
- **Analytics** — Runway utilization, flight operations, conflict tracking (clearly labeled as simulation data)
- **System Logs** — Timestamped event journal of all actions
- **Demo Scenarios** — Normal, High Traffic, Emergency, Wake Conflict, Weather Disruption
- **Settings** — Demo mode toggle, configuration display

## Architecture

Pure frontend SPA — no backend server required. Hash-based routing (`#dashboard`, `#flights`, etc.) with integrated simulation engine.

| File | Purpose |
|------|---------|
| `index.html` | SPA structure, all page containers, wizard modal |
| `style.css` | Professional aviation control-room design system |
| `data.js` | Aircraft DB, wake separation rules, demo scenarios, simulation engine |
| `app.js` | Router, state management, UI renderers, wizard logic |

## Disclaimer

**Research Prototype • Decision Support Only • Not for Live ATC Operations**

Designed & Engineered by Shahid Tamboli

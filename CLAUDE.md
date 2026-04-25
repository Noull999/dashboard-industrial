# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Real-time industrial sensor dashboard for fishing plants in Puerto Madryn. 11 simulated sensors push readings via WebSocket every 5 seconds; React displays live cards, alerts, historical charts, and production tracking per species.

Full spec: `docs/superpowers/specs/2026-04-24-dashboard-industrial-design.md`  
Implementation plan: `docs/superpowers/plans/2026-04-24-dashboard-industrial.md`

## Backend (FastAPI + SQLite)

**Activate venv first** (bash on Windows):
```bash
source backend/venv/Scripts/activate
# or run Python directly: backend/venv/Scripts/python.exe
```

```bash
# Install / update dependencies
cd backend && pip install -r requirements.txt

# Run dev server
cd backend && uvicorn main:app --reload --port 8000

# Run all tests (must be from backend/ so local modules resolve)
cd backend && pytest tests/ -v

# Run single test
cd backend && pytest tests/test_api.py::test_get_sensors_returns_11 -v
```

The database file `backend/readings.db` is created automatically on first run via `init_db()`.

## Frontend (React + Vite + TypeScript)

```bash
cd frontend && npm run dev      # dev server (http://localhost:5173)
cd frontend && npm run build    # production build + TypeScript check
```

## Architecture

```
React (Vite + TypeScript)
  ├── WebSocket  →  FastAPI /ws                    (live readings every 5s)
  └── REST       →  GET  /sensors                  (sensor catalog)
                    GET  /sensors/{id}/history      (time-range history: 30m/1h/6h/24h)
                    POST /sensors/{id}/product      (change active species)
                    GET  /sensors/{id}/product      (current species)
                    GET  /sensors/{id}/events       (alert log)
                    GET  /sensors/{id}/production-today
                    GET  /production-today          (all lines + grand total)
                    GET  /alerts                    (active alerts)

FastAPI (backend/)
  ├── sensor_config.py   single source of truth: sensor IDs, names, units, limits
  ├── models.py          SQLAlchemy ORM: sensors, readings, alerts, product_changes
  ├── database.py        engine + SessionLocal; init_db() creates tables and seeds sensors
  ├── simulator.py       generates realistic random-walk readings; triggers alert records
  └── main.py            FastAPI app, HTTP routes, WebSocket broker, lifespan
```

**Key design decisions:**
- `sensor_config.SENSORS` (list of `SensorConfig` dataclasses) is the single source of truth — the DB seed, simulator, and alert thresholds all derive from it. Never hardcode sensor IDs elsewhere.
- `database.py:init_db()` auto-seeds the `sensors` table on startup; never manually insert sensor rows.
- `is_production_line` is stored as the string `"true"` / `"false"` in SQLite (`String` column). Read it with `== "true"`.
- The WebSocket endpoint `/ws` broadcasts every new reading to all connected clients. Clients filter by `sensor_id`.
- `TESTING=1` env var disables the simulator in `lifespan` — set automatically by `tests/conftest.py`.
- Alert state: open alert has `resolved_at = NULL`; resolving sets it to UTC timestamp.
- Production total resets at UTC midnight. `total_kg = sum(readings) * 5 / 60` (each reading is kg/min, sampled every 5s).

## Frontend components

```
src/
├── types.ts                SensorMeta, SensorReading, HistoryPoint, ActiveAlert, getSensorStatus()
├── hooks/
│   ├── useWebSocket.ts     WS connection with exponential backoff (1s → 2s → ... → 30s)
│   └── useSensorHistory.ts REST fetch for historical data by time range
├── components/
│   ├── SensorCard.tsx      live value + top color bar + OFFLINE after 15s no data
│   ├── AlertBar.tsx        top-bar red banner when alerts are active
│   ├── SensorChart.tsx     Recharts line chart with range selector (30m/1h/6h/24h)
│   ├── SensorDrawer.tsx    480px slide-in panel: stats, chart, events, metadata, ProductSelector
│   ├── ProductSelector.tsx species picker (Merluza/Langostino/Calamar/Salmón/custom)
│   └── ProductionTotal.tsx daily total widget (refreshes every 10s)
└── pages/
    └── Dashboard.tsx       sidebar + topbar + sensor grid
```

## Visual design

Dark industrial theme — use CSS variables from `index.css`, never raw hex values:
- `--bg: #050505`, `--surface: #0d0d0d`
- `--red: #e63946` (alert/accent), `--green: #22c55e` (normal), `--yellow: #f59e0b` (warning)
- Text: `--text`, `--text-2` (#888), `--text-3` (#444)

## Sensors

11 sensors in `backend/sensor_config.py`. Two are production lines (`is_production_line=True`): `SEN-PD-001` and `SEN-PD-002` (kg/min). Only these show ProductSelector and t/h derivation in the drawer.

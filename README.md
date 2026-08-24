# 🏭 Dashboard Industrial

Panel de monitoreo en tiempo real para plantas pesqueras: sigue 11 sensores IoT (temperatura, humedad, presión, RPM, peso, nivel, caudal y producción) vía WebSocket, dispara alertas cuando una variable sale de rango y calcula producción diaria por línea — sin depender de un CRUD genérico, resuelve un problema real de planta.

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-live%20data-informational)
![SQLite](https://img.shields.io/badge/SQLite-SQLAlchemy%202.0-003B57?logo=sqlite&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Pytest](https://img.shields.io/badge/tests-pytest-0A9EDC?logo=pytest&logoColor=white)

---

## Qué resuelve

Una planta pesquera necesita saber, en todo momento, si una cámara frigorífica se está calentando, si el compresor de NH₃ pierde presión, o cuánto llevan producidas las líneas hoy — antes de que sea un problema de calidad o seguridad. Este dashboard simula esa telemetría (11 sensores reales de planta: cámaras frías, humedad de sala, presión de compresor, bandas transportadoras, tolvas, tanque de salmuera, caudal de agua y dos líneas de producción) y la transmite en vivo por WebSocket a un frontend React, con alertas automáticas y trazabilidad histórica.

## Funcionalidades (verificadas en el código)

- **Streaming en tiempo real por WebSocket** (`backend/main.py`) — el simulador empuja lecturas nuevas a todos los clientes conectados sin polling.
- **11 sensores industriales configurados** (`backend/sensor_config.py`) con rangos min/max reales por tipo: temperatura, humedad, presión, RPM, peso, nivel, caudal y producción.
- **Alertas automáticas** cuando una lectura sale de rango, con historial de alertas activas/resueltas (`GET /alerts`, `GET /alerts/history`).
- **Historial de lecturas por sensor** con ventanas configurables (30m / 1h / 6h / 24h) y gráficos con Recharts.
- **Seguimiento de producción diaria por línea** — acumula kg/t producidos por línea a partir de las lecturas (`GET /production-today`), con registro de cambios de producto por línea (`ProductChange`).
- **Edición de configuración de sensores** (nombre, rangos, ubicación) vía `PATCH /sensors/{id}`.
- **Vistas dedicadas en el frontend**: Dashboard, Sensores, Historial, Alertas y Configuración (`frontend/src/pages/`).
- **Simulador de datos sintéticos** (`backend/simulator.py`) para desarrollo y demo sin hardware real.
- **Tests con Pytest** para la API y el simulador (`backend/tests/`).

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Backend | FastAPI, WebSockets, SQLAlchemy 2.0, Pydantic |
| Frontend | React 19, TypeScript, Vite 8 |
| Visualización | Recharts |
| Base de datos | SQLite |
| Tests | Pytest, httpx |

## Arquitectura

```
dashboard-industrial/
├── backend/
│   ├── main.py           # API REST + endpoint WebSocket (/ws)
│   ├── database.py       # Sesión y modelos SQLAlchemy
│   ├── models.py         # Sensor, Reading, Alert, ProductChange
│   ├── simulator.py       # Generador de lecturas sintéticas + alertas
│   ├── sensor_config.py  # Catálogo de sensores de planta
│   └── tests/            # Pytest (API + simulador)
├── frontend/
│   └── src/
│       ├── pages/         # Dashboard, Sensores, Historial, Alertas, Config
│       ├── components/    # SensorCard, SensorChart, AlertBar, etc.
│       └── hooks/         # useWebSocket, useSensorHistory
└── docs/
```

## Cómo correrlo localmente

```bash
git clone https://github.com/Noull999/dashboard-industrial.git
cd dashboard-industrial

# Backend (FastAPI)
cd backend
pip install -r requirements.txt
python main.py

# Frontend (otra terminal)
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173` — el dashboard se conecta al WebSocket del backend y empieza a recibir datos simulados al instante.

### Tests

```bash
cd backend
pytest
```

---

**Autor:** Jose Esteban Asencio — desarrollador full-stack.

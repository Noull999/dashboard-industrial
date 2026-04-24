# Dashboard Industrial Pesquero — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time industrial sensor dashboard for fishing plants with FastAPI + SQLite backend and React frontend, using simulated sensor data.

**Architecture:** FastAPI broadcasts simulated sensor readings via WebSocket every 5 seconds and persists them to SQLite. React consumes the WebSocket for live card updates and calls REST endpoints for historical charts. A slide-out drawer shows detail per sensor; production lines include a species selector.

**Tech Stack:** Python 3.11+, FastAPI 0.111, SQLAlchemy 2.x, SQLite, React 18, Vite, TypeScript, Recharts.

**Spec:** `docs/superpowers/specs/2026-04-24-dashboard-industrial-design.md`

---

## File Map

```
backend/
├── requirements.txt          ← add sqlalchemy==2.0.30
├── sensor_config.py          ← sensor definitions + limits (new)
├── models.py                 ← SQLAlchemy ORM models (new)
├── database.py               ← engine, SessionLocal, init_db (new)
├── simulator.py              ← SensorSimulator + value generation (new)
├── main.py                   ← FastAPI app, all endpoints, WebSocket (new)
└── tests/
    ├── __init__.py           ← empty (new)
    ├── conftest.py           ← pytest fixtures (new)
    ├── test_simulator.py     ← unit tests for simulator logic (new)
    └── test_api.py           ← HTTP + WebSocket integration tests (new)

frontend/                     ← scaffolded with Vite (new)
└── src/
    ├── types.ts              ← shared TS interfaces (new)
    ├── index.css             ← dark industrial CSS (new)
    ├── App.tsx               ← root component (modify)
    ├── hooks/
    │   ├── useWebSocket.ts   ← WS + backoff reconnect (new)
    │   └── useSensorHistory.ts ← REST history fetch (new)
    ├── components/
    │   ├── SensorCard.tsx    ← value card + sparkline (new)
    │   ├── AlertBar.tsx      ← active alert banner (new)
    │   ├── SensorChart.tsx   ← Recharts line chart (new)
    │   ├── SensorDrawer.tsx  ← slide-in detail panel (new)
    │   ├── ProductSelector.tsx ← species picker per line (new)
    │   └── ProductionTotal.tsx ← global production widget (new)
    └── pages/
        └── Dashboard.tsx     ← main dashboard page (new)
```

---

## Task 1: Backend foundation

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/sensor_config.py`
- Create: `backend/models.py`
- Create: `backend/database.py`

- [ ] **Step 1: Update requirements.txt**

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
websockets==12.0
pytest==8.2.0
httpx==0.27.0
sqlalchemy==2.0.30
```

- [ ] **Step 2: Install dependencies**

Run from `backend/` (with venv activated):
```bash
pip install -r requirements.txt
```
Expected: no errors, `sqlalchemy` installs.

- [ ] **Step 3: Create sensor_config.py**

```python
from dataclasses import dataclass, field
from typing import Literal

SensorType = Literal["temperature", "humidity", "pressure", "rpm", "weight", "level", "flow", "production"]

@dataclass
class SensorConfig:
    id: str
    name: str
    unit: str
    min_val: float
    max_val: float
    location: str
    sensor_type: SensorType
    is_production_line: bool = False

SENSORS: list[SensorConfig] = [
    SensorConfig("SEN-CF-001", "Cámara Frigorífica 1",   "°C",    -10.0,  -4.0,  "Sector A",      "temperature"),
    SensorConfig("SEN-CF-002", "Cámara Frigorífica 2",   "°C",    -10.0,  -4.0,  "Sector A",      "temperature"),
    SensorConfig("SEN-HU-001", "Humedad Sala Proceso",   "%",      40.0,  85.0,  "Sala Proceso",  "humidity"),
    SensorConfig("SEN-PR-001", "Presión Compresor NH₃",  "bar",     1.5,   4.5,  "Sala Máquinas", "pressure"),
    SensorConfig("SEN-RP-001", "Banda Transportadora 1", "RPM",    80.0, 180.0,  "Línea 1",       "rpm"),
    SensorConfig("SEN-RP-002", "Banda Transportadora 2", "RPM",    80.0, 180.0,  "Línea 2",       "rpm"),
    SensorConfig("SEN-PZ-001", "Peso Tolva A",           "t",       0.0,   2.0,  "Sector B",      "weight"),
    SensorConfig("SEN-NV-001", "Nivel Tanque Salmuera",  "%",      20.0,  95.0,  "Sector C",      "level"),
    SensorConfig("SEN-FL-001", "Caudal Agua Proceso",    "L/h",   200.0, 600.0,  "Sala Proceso",  "flow"),
    SensorConfig("SEN-PD-001", "Línea Producción 1",     "kg/min",  0.0,  50.0,  "Línea 1",       "production", is_production_line=True),
    SensorConfig("SEN-PD-002", "Línea Producción 2",     "kg/min",  0.0,  50.0,  "Línea 2",       "production", is_production_line=True),
]

SENSOR_MAP: dict[str, SensorConfig] = {s.id: s for s in SENSORS}
```

- [ ] **Step 4: Create models.py**

```python
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, Integer, ForeignKey
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class Sensor(Base):
    __tablename__ = "sensors"
    id                = Column(String,  primary_key=True)
    name              = Column(String,  nullable=False)
    unit              = Column(String,  nullable=False)
    min_val           = Column(Float,   nullable=False)
    max_val           = Column(Float,   nullable=False)
    location          = Column(String,  nullable=False)
    sensor_type       = Column(String,  nullable=False)
    is_production_line = Column(String, nullable=False, default="false")

class Reading(Base):
    __tablename__ = "readings"
    id        = Column(Integer, primary_key=True, autoincrement=True)
    sensor_id = Column(String,  ForeignKey("sensors.id"), nullable=False)
    value     = Column(Float,   nullable=False)
    timestamp = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

class Alert(Base):
    __tablename__ = "alerts"
    id           = Column(Integer,  primary_key=True, autoincrement=True)
    sensor_id    = Column(String,   ForeignKey("sensors.id"), nullable=False)
    value        = Column(Float,    nullable=False)
    message      = Column(String,   nullable=False)
    triggered_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    resolved_at  = Column(DateTime, nullable=True)

class ProductChange(Base):
    __tablename__ = "product_changes"
    id           = Column(Integer,  primary_key=True, autoincrement=True)
    sensor_id    = Column(String,   ForeignKey("sensors.id"), nullable=False)
    product_name = Column(String,   nullable=False)
    changed_at   = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
```

- [ ] **Step 5: Create database.py**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from models import Base, Sensor
from sensor_config import SENSORS

DATABASE_URL = "sqlite:///./readings.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _seed_sensors(SessionLocal())

def _seed_sensors(db: Session) -> None:
    for s in SENSORS:
        if not db.get(Sensor, s.id):
            db.add(Sensor(
                id=s.id, name=s.name, unit=s.unit,
                min_val=s.min_val, max_val=s.max_val,
                location=s.location, sensor_type=s.sensor_type,
                is_production_line=str(s.is_production_line).lower(),
            ))
    db.commit()
    db.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 6: Commit**

```bash
git add backend/requirements.txt backend/sensor_config.py backend/models.py backend/database.py
git commit -m "feat: add backend foundation — sensor config, models, database"
```

---

## Task 2: Simulator (TDD)

**Files:**
- Create: `backend/simulator.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_simulator.py`

- [ ] **Step 1: Create tests/__init__.py** (empty file)

```bash
touch backend/tests/__init__.py
```

- [ ] **Step 2: Create tests/conftest.py**

```python
import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, Sensor
from sensor_config import SENSORS

os.environ["TESTING"] = "1"

@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    for s in SENSORS:
        session.add(Sensor(
            id=s.id, name=s.name, unit=s.unit,
            min_val=s.min_val, max_val=s.max_val,
            location=s.location, sensor_type=s.sensor_type,
            is_production_line=str(s.is_production_line).lower(),
        ))
    session.commit()
    yield session
    session.close()
```

- [ ] **Step 3: Write failing tests in test_simulator.py**

```python
import pytest
from sensor_config import SENSORS
from simulator import generate_value, check_and_save_alert

TEMP_SENSOR = SENSORS[0]  # SEN-CF-001, min=-10, max=-4


def test_generate_value_within_hard_bounds():
    hard_min = TEMP_SENSOR.min_val - (TEMP_SENSOR.max_val - TEMP_SENSOR.min_val) * 0.2
    hard_max = TEMP_SENSOR.max_val + (TEMP_SENSOR.max_val - TEMP_SENSOR.min_val) * 0.2
    for _ in range(200):
        v = generate_value(TEMP_SENSOR)
        assert hard_min <= v <= hard_max, f"Value {v} outside hard bounds [{hard_min}, {hard_max}]"


def test_generate_value_walks_from_previous():
    spread = (TEMP_SENSOR.max_val - TEMP_SENSOR.min_val) * 0.1  # 0.6
    prev = -7.0
    for _ in range(200):
        v = generate_value(TEMP_SENSOR, prev)
        # step is at most spread before clamping
        assert abs(v - prev) <= spread * 2 + 0.01, f"Step too large: {abs(v - prev)}"
        prev = v


def test_check_and_save_alert_above_max(db):
    alert = check_and_save_alert(db, TEMP_SENSOR.id, -1.0, TEMP_SENSOR.min_val, TEMP_SENSOR.max_val, TEMP_SENSOR.name)
    assert alert is not None
    assert alert.sensor_id == TEMP_SENSOR.id
    assert "máximo" in alert.message


def test_check_and_save_alert_below_min(db):
    alert = check_and_save_alert(db, TEMP_SENSOR.id, -15.0, TEMP_SENSOR.min_val, TEMP_SENSOR.max_val, TEMP_SENSOR.name)
    assert alert is not None
    assert "mínimo" in alert.message


def test_check_and_save_alert_in_range_returns_none(db):
    alert = check_and_save_alert(db, TEMP_SENSOR.id, -7.0, TEMP_SENSOR.min_val, TEMP_SENSOR.max_val, TEMP_SENSOR.name)
    assert alert is None
```

- [ ] **Step 4: Run tests — verify they fail**

```bash
cd backend && pytest tests/test_simulator.py -v
```
Expected: `ModuleNotFoundError: No module named 'simulator'`

- [ ] **Step 5: Create simulator.py**

```python
import asyncio
import random
from datetime import datetime, timezone
from typing import Callable, Awaitable, Any
from sqlalchemy.orm import Session
from models import Reading, Alert
from sensor_config import SensorConfig, SENSORS


def generate_value(config: SensorConfig, previous: float | None = None) -> float:
    spread = (config.max_val - config.min_val) * 0.1
    base = previous if previous is not None else (config.min_val + config.max_val) / 2
    new_val = base + random.uniform(-spread, spread)
    hard_min = config.min_val - (config.max_val - config.min_val) * 0.2
    hard_max = config.max_val + (config.max_val - config.min_val) * 0.2
    return round(max(hard_min, min(hard_max, new_val)), 2)


def check_and_save_alert(
    db: Session, sensor_id: str, value: float,
    min_val: float, max_val: float, sensor_name: str,
) -> Alert | None:
    if value < min_val:
        msg = f"{sensor_name}: {value} por debajo del mínimo ({min_val})"
    elif value > max_val:
        msg = f"{sensor_name}: {value} por encima del máximo ({max_val})"
    else:
        return None
    alert = Alert(sensor_id=sensor_id, value=value, message=msg, triggered_at=datetime.now(timezone.utc))
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


Callback = Callable[[dict[str, Any]], Awaitable[None]]


class SensorSimulator:
    def __init__(self) -> None:
        self._values: dict[str, float] = {}
        self._callbacks: list[Callback] = []
        self._running = False

    def add_callback(self, cb: Callback) -> None:
        self._callbacks.append(cb)

    async def run(self, session_factory) -> None:
        self._running = True
        while self._running:
            for config in SENSORS:
                prev = self._values.get(config.id)
                value = generate_value(config, prev)
                self._values[config.id] = value

                db = session_factory()
                try:
                    reading = Reading(
                        sensor_id=config.id,
                        value=value,
                        timestamp=datetime.now(timezone.utc),
                    )
                    db.add(reading)
                    db.commit()
                    alert = check_and_save_alert(db, config.id, value, config.min_val, config.max_val, config.name)
                finally:
                    db.close()

                payload: dict[str, Any] = {
                    "sensor_id": config.id,
                    "value": value,
                    "timestamp": reading.timestamp.isoformat(),
                    "alert": alert is not None,
                }
                for cb in self._callbacks:
                    await cb(payload)

            await asyncio.sleep(5)

    def stop(self) -> None:
        self._running = False
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
cd backend && pytest tests/test_simulator.py -v
```
Expected:
```
tests/test_simulator.py::test_generate_value_within_hard_bounds PASSED
tests/test_simulator.py::test_generate_value_walks_from_previous PASSED
tests/test_simulator.py::test_check_and_save_alert_above_max PASSED
tests/test_simulator.py::test_check_and_save_alert_below_min PASSED
tests/test_simulator.py::test_check_and_save_alert_in_range_returns_none PASSED
5 passed
```

- [ ] **Step 7: Commit**

```bash
git add backend/simulator.py backend/tests/
git commit -m "feat: add sensor simulator with TDD"
```

---

## Task 3: FastAPI app + all endpoints

**Files:**
- Create: `backend/main.py`

- [ ] **Step 1: Create main.py**

```python
import asyncio
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import init_db, get_db, SessionLocal
from simulator import SensorSimulator
from models import Sensor, Reading, Alert, ProductChange

simulator = SensorSimulator()
connected_clients: list[WebSocket] = []


async def broadcast(payload: dict[str, Any]) -> None:
    dead = []
    for ws in connected_clients:
        try:
            await ws.send_text(json.dumps(payload))
        except Exception:
            dead.append(ws)
    for ws in dead:
        connected_clients.remove(ws)


simulator.add_callback(broadcast)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    task = None
    if os.getenv("TESTING") != "1":
        task = asyncio.create_task(simulator.run(SessionLocal))
    yield
    if task:
        simulator.stop()
        task.cancel()


app = FastAPI(title="Dashboard Industrial Pesquero", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in connected_clients:
            connected_clients.remove(websocket)


@app.get("/sensors")
def get_sensors(db: Session = Depends(get_db)):
    return [
        {
            "id": s.id, "name": s.name, "unit": s.unit,
            "min_val": s.min_val, "max_val": s.max_val,
            "location": s.location, "sensor_type": s.sensor_type,
            "is_production_line": s.is_production_line == "true",
        }
        for s in db.query(Sensor).all()
    ]


_RANGE_MINUTES: dict[str, int] = {"30m": 30, "1h": 60, "6h": 360, "24h": 1440}


@app.get("/sensors/{sensor_id}/history")
def get_history(sensor_id: str, range: str = "1h", db: Session = Depends(get_db)):
    minutes = _RANGE_MINUTES.get(range, 60)
    since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    rows = (
        db.query(Reading)
        .filter(Reading.sensor_id == sensor_id, Reading.timestamp >= since)
        .order_by(Reading.timestamp.asc())
        .all()
    )
    return [{"value": r.value, "timestamp": r.timestamp.isoformat()} for r in rows]


@app.get("/alerts")
def get_alerts(db: Session = Depends(get_db)):
    rows = (
        db.query(Alert)
        .filter(Alert.resolved_at.is_(None))
        .order_by(Alert.triggered_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": a.id, "sensor_id": a.sensor_id, "value": a.value,
            "message": a.message, "triggered_at": a.triggered_at.isoformat(),
        }
        for a in rows
    ]


class ProductBody(BaseModel):
    product_name: str


@app.post("/sensors/{sensor_id}/product")
def set_product(sensor_id: str, body: ProductBody, db: Session = Depends(get_db)):
    if not db.get(Sensor, sensor_id):
        raise HTTPException(status_code=404, detail="Sensor not found")
    db.add(ProductChange(sensor_id=sensor_id, product_name=body.product_name,
                         changed_at=datetime.now(timezone.utc)))
    db.commit()
    return {"ok": True}


@app.get("/sensors/{sensor_id}/product")
def get_current_product(sensor_id: str, db: Session = Depends(get_db)):
    row = (
        db.query(ProductChange)
        .filter(ProductChange.sensor_id == sensor_id)
        .order_by(ProductChange.changed_at.desc())
        .first()
    )
    return {"product_name": row.product_name if row else None}


@app.get("/sensors/{sensor_id}/production-today")
def get_production_today(sensor_id: str, db: Session = Depends(get_db)):
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    total = db.query(func.sum(Reading.value)).filter(
        Reading.sensor_id == sensor_id,
        Reading.timestamp >= today_start,
    ).scalar() or 0.0
    # Each reading is kg/min, sampled every 5s → kg per reading = value * 5/60
    total_kg = round(total * 5 / 60, 2)
    return {"sensor_id": sensor_id, "total_kg": total_kg, "total_t": round(total_kg / 1000, 4)}


@app.get("/production-today")
def get_all_production_today(db: Session = Depends(get_db)):
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    lines = db.query(Sensor).filter(Sensor.is_production_line == "true").all()
    result = []
    for line in lines:
        total = db.query(func.sum(Reading.value)).filter(
            Reading.sensor_id == line.id,
            Reading.timestamp >= today_start,
        ).scalar() or 0.0
        total_kg = round(total * 5 / 60, 2)
        current_product = (
            db.query(ProductChange)
            .filter(ProductChange.sensor_id == line.id)
            .order_by(ProductChange.changed_at.desc())
            .first()
        )
        result.append({
            "sensor_id": line.id,
            "sensor_name": line.name,
            "total_kg": total_kg,
            "product_name": current_product.product_name if current_product else None,
        })
    grand_total_kg = sum(r["total_kg"] for r in result)
    return {"lines": result, "grand_total_kg": round(grand_total_kg, 2)}
```

- [ ] **Step 2: Add events endpoint to main.py** (append after `get_production_today`)

```python
@app.get("/sensors/{sensor_id}/events")
def get_sensor_events(sensor_id: str, db: Session = Depends(get_db)):
    rows = (
        db.query(Alert)
        .filter(Alert.sensor_id == sensor_id)
        .order_by(Alert.triggered_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": a.id, "value": a.value, "message": a.message,
            "triggered_at": a.triggered_at.isoformat(),
            "resolved": a.resolved_at is not None,
        }
        for a in rows
    ]
```

- [ ] **Step 3: Verify the server starts**

```bash
cd backend && uvicorn main:app --reload --port 8000
```
Expected: `Application startup complete.` — then Ctrl+C to stop.

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: add FastAPI app with WebSocket and REST endpoints"
```

---

## Task 4: Backend integration tests

**Files:**
- Create: `backend/tests/test_api.py`

- [ ] **Step 1: Write tests**

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app, get_db
from models import Base, Sensor, Reading, Alert
from sensor_config import SENSORS
from datetime import datetime, timezone


@pytest.fixture
def client(tmp_path):
    db_url = f"sqlite:///{tmp_path}/test.db"
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    for s in SENSORS:
        session.add(Sensor(
            id=s.id, name=s.name, unit=s.unit,
            min_val=s.min_val, max_val=s.max_val,
            location=s.location, sensor_type=s.sensor_type,
            is_production_line=str(s.is_production_line).lower(),
        ))
    session.commit()

    def override():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c, session
    app.dependency_overrides.clear()
    session.close()


def test_get_sensors_returns_11(client):
    c, _ = client
    r = c.get("/sensors")
    assert r.status_code == 200
    assert len(r.json()) == 11


def test_get_history_empty_initially(client):
    c, _ = client
    r = c.get("/sensors/SEN-CF-001/history?range=1h")
    assert r.status_code == 200
    assert r.json() == []


def test_get_history_invalid_range_defaults_1h(client):
    c, _ = client
    r = c.get("/sensors/SEN-CF-001/history?range=bogus")
    assert r.status_code == 200  # defaults to 1h, returns empty list


def test_get_history_with_data(client):
    c, session = client
    session.add(Reading(sensor_id="SEN-CF-001", value=-5.5, timestamp=datetime.now(timezone.utc)))
    session.commit()
    r = c.get("/sensors/SEN-CF-001/history?range=1h")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["value"] == -5.5


def test_get_alerts_empty_initially(client):
    c, _ = client
    r = c.get("/alerts")
    assert r.status_code == 200
    assert r.json() == []


def test_get_alerts_returns_active_only(client):
    c, session = client
    session.add(Alert(sensor_id="SEN-CF-001", value=-1.0, message="test", triggered_at=datetime.now(timezone.utc)))
    resolved = Alert(sensor_id="SEN-CF-002", value=-1.0, message="resolved", triggered_at=datetime.now(timezone.utc))
    resolved.resolved_at = datetime.now(timezone.utc)
    session.add(resolved)
    session.commit()
    r = c.get("/alerts")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_set_product_success(client):
    c, _ = client
    r = c.post("/sensors/SEN-PD-001/product", json={"product_name": "Merluza"})
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_set_product_not_found(client):
    c, _ = client
    r = c.post("/sensors/INVALID/product", json={"product_name": "Merluza"})
    assert r.status_code == 404


def test_get_current_product(client):
    c, _ = client
    c.post("/sensors/SEN-PD-001/product", json={"product_name": "Langostino"})
    r = c.get("/sensors/SEN-PD-001/product")
    assert r.status_code == 200
    assert r.json()["product_name"] == "Langostino"


def test_production_today_empty(client):
    c, _ = client
    r = c.get("/sensors/SEN-PD-001/production-today")
    assert r.status_code == 200
    assert r.json()["total_kg"] == 0.0


def test_websocket_connects(client):
    c, _ = client
    with c.websocket_connect("/ws") as ws:
        pass  # connection accepted without exception
```

- [ ] **Step 2: Run all backend tests**

```bash
cd backend && pytest tests/ -v
```
Expected:
```
tests/test_simulator.py::... PASSED  (5 tests)
tests/test_api.py::...      PASSED  (11 tests)
16 passed
```

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_api.py
git commit -m "test: add API integration tests"
```

---

## Task 5: Frontend scaffold + types + CSS

**Files:**
- Create: `frontend/` (Vite scaffold)
- Create: `frontend/src/types.ts`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Scaffold Vite React TS project**

Run from the repo root:
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
npm install recharts
npm install --save-dev @types/recharts
```
Expected: `frontend/` folder created, `node_modules` installed.

- [ ] **Step 2: Create src/types.ts**

```typescript
export interface SensorMeta {
  id: string;
  name: string;
  unit: string;
  min_val: number;
  max_val: number;
  location: string;
  sensor_type: string;
  is_production_line: boolean;
}

export interface SensorReading {
  sensor_id: string;
  value: number;
  timestamp: string;
  alert: boolean;
}

export interface HistoryPoint {
  value: number;
  timestamp: string;
}

export interface ActiveAlert {
  id: number;
  sensor_id: string;
  value: number;
  message: string;
  triggered_at: string;
}

export type SensorStatus = "normal" | "alert" | "warning" | "offline";

export function getSensorStatus(value: number, min_val: number, max_val: number): SensorStatus {
  if (value < min_val || value > max_val) return "alert";
  const range = max_val - min_val;
  if (value < min_val + range * 0.1 || value > max_val - range * 0.1) return "warning";
  return "normal";
}
```

- [ ] **Step 3: Replace src/index.css with dark industrial styles**

```css
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg:        #050505;
  --surface:   #0d0d0d;
  --surface-2: #111111;
  --border:    #1a1a1a;
  --border-2:  #222222;
  --red:       #e63946;
  --red-dim:   #7f1d1d;
  --red-bg:    #120606;
  --green:     #22c55e;
  --green-bg:  #0a1a0a;
  --green-dim: #166534;
  --yellow:    #f59e0b;
  --yellow-bg: #1a1200;
  --text:      #ffffff;
  --text-2:    #888888;
  --text-3:    #444444;
  --text-4:    #333333;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  font-size: 13px;
  line-height: 1.4;
  height: 100vh;
  overflow: hidden;
}

#root { height: 100vh; }

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: var(--surface); }
::-webkit-scrollbar-thumb { background: var(--border-2); border-radius: 2px; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.55; }
}
```

- [ ] **Step 4: Delete boilerplate**

Remove `src/App.css` and clear `src/assets/` folder contents. Replace `src/App.tsx` with:

```tsx
import Dashboard from './pages/Dashboard';

export default function App() {
  return <Dashboard />;
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold React Vite frontend with types and CSS tokens"
```

---

## Task 6: Hooks

**Files:**
- Create: `frontend/src/hooks/useWebSocket.ts`
- Create: `frontend/src/hooks/useSensorHistory.ts`

- [ ] **Step 1: Create useWebSocket.ts**

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';
import type { SensorReading } from '../types';

const WS_URL = 'ws://localhost:8000/ws';

export function useWebSocket(onMessage: (reading: SensorReading) => void) {
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const retryDelay = useRef(1000);
  const unmounted = useRef(false);

  const connect = useCallback(() => {
    if (unmounted.current) return;
    const socket = new WebSocket(WS_URL);
    ws.current = socket;

    socket.onopen = () => {
      setConnected(true);
      retryDelay.current = 1000;
    };

    socket.onmessage = (event) => {
      try {
        const data: SensorReading = JSON.parse(event.data);
        onMessage(data);
      } catch {
        // ignore malformed messages
      }
    };

    socket.onclose = () => {
      setConnected(false);
      if (!unmounted.current) {
        setTimeout(connect, retryDelay.current);
        retryDelay.current = Math.min(retryDelay.current * 2, 30000);
      }
    };
  }, [onMessage]);

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      ws.current?.close();
    };
  }, [connect]);

  return { connected };
}
```

- [ ] **Step 2: Create useSensorHistory.ts**

```typescript
import { useState, useEffect } from 'react';
import type { HistoryPoint } from '../types';

const API = 'http://localhost:8000';

export type HistoryRange = '30m' | '1h' | '6h' | '24h';

export function useSensorHistory(sensorId: string | null, range: HistoryRange) {
  const [data, setData] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sensorId) return;
    setLoading(true);
    setError(null);
    fetch(`${API}/sensors/${sensorId}/history?range=${range}`)
      .then((r) => r.json())
      .then((d: HistoryPoint[]) => { setData(d); setLoading(false); })
      .catch(() => { setError('Error al cargar historial'); setLoading(false); });
  }, [sensorId, range]);

  return { data, loading, error };
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/
git commit -m "feat: add useWebSocket and useSensorHistory hooks"
```

---

## Task 7: SensorCard + AlertBar components

**Files:**
- Create: `frontend/src/components/SensorCard.tsx`
- Create: `frontend/src/components/AlertBar.tsx`

- [ ] **Step 1: Create SensorCard.tsx**

```tsx
import type { SensorMeta, SensorReading, SensorStatus } from '../types';
import { getSensorStatus } from '../types';

interface Props {
  meta: SensorMeta;
  reading: SensorReading | null;
  lastSeen: number | null;
  onClick: () => void;
}

const STATUS_COLORS: Record<SensorStatus | 'offline', string> = {
  normal:  'var(--green)',
  warning: 'var(--yellow)',
  alert:   'var(--red)',
  offline: '#555',
};

const STATUS_LABELS: Record<SensorStatus | 'offline', string> = {
  normal:  '● NORMAL',
  warning: '⚡ ATENCIÓN',
  alert:   '⚠ ALERTA',
  offline: '○ OFFLINE',
};

export default function SensorCard({ meta, reading, lastSeen, onClick }: Props) {
  const now = Date.now();
  const isOffline = !reading || (lastSeen !== null && now - lastSeen > 15000);
  const status: SensorStatus | 'offline' = isOffline
    ? 'offline'
    : getSensorStatus(reading!.value, meta.min_val, meta.max_val);
  const color = STATUS_COLORS[status];

  return (
    <div onClick={onClick} style={{
      background: status === 'alert' ? '#0d0808' : 'var(--surface)',
      border: `1px solid ${status === 'alert' ? 'var(--red-dim)' : 'var(--border)'}`,
      borderRadius: 8,
      padding: '14px 16px',
      cursor: 'pointer',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Top accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color }} />

      <div style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
        {meta.name}
      </div>

      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, letterSpacing: -1, color: isOffline ? '#555' : undefined }}>
        {reading ? reading.value.toFixed(1) : '—'}
        <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 400, marginLeft: 4 }}>{meta.unit}</span>
      </div>

      <div style={{ marginTop: 8, fontSize: 9, fontWeight: 700, color, letterSpacing: 0.5 }}>
        {STATUS_LABELS[status]}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create AlertBar.tsx**

```tsx
import type { ActiveAlert, SensorMeta } from '../types';

interface Props {
  alerts: ActiveAlert[];
  sensors: SensorMeta[];
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  return `hace ${Math.floor(diff / 3600)}h`;
}

export default function AlertBar({ alerts, sensors: _ }: Props) {
  if (alerts.length === 0) return null;
  const latest = alerts[0];

  return (
    <div style={{
      background: 'var(--red-bg)',
      border: '1px solid var(--red-dim)',
      borderLeft: '3px solid var(--red)',
      borderRadius: 6,
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      margin: '0 0 4px',
    }}>
      <span style={{ color: 'var(--red)', fontSize: 16 }}>⚠</span>
      <span style={{ color: '#fca5a5', fontSize: 12, flex: 1 }}>
        <strong style={{ color: 'var(--red)' }}>{latest.message}</strong>
      </span>
      <span style={{ color: 'var(--text-3)', fontSize: 10 }}>{timeAgo(latest.triggered_at)}</span>
      {alerts.length > 1 && (
        <span style={{
          background: 'var(--red)', color: '#fff',
          padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 700,
        }}>
          +{alerts.length - 1}
        </span>
      )}
      <span style={{
        background: 'var(--red)', color: '#fff',
        padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 700,
        animation: 'pulse 1.5s infinite',
      }}>
        ACTIVA
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SensorCard.tsx frontend/src/components/AlertBar.tsx
git commit -m "feat: add SensorCard and AlertBar components"
```

---

## Task 8: Dashboard page layout

**Files:**
- Create: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Create stub files so TypeScript can compile**

Create `frontend/src/components/SensorDrawer.tsx`:
```tsx
import type { SensorMeta, SensorReading } from '../types';
interface Props { sensor: SensorMeta | null; reading: SensorReading | null; onClose: () => void; }
export default function SensorDrawer({ onClose }: Props) {
  return <div onClick={onClose} />;
}
```

Create `frontend/src/components/ProductionTotal.tsx`:
```tsx
export default function ProductionTotal() { return null; }
```

- [ ] **Step 2: Create Dashboard.tsx**

```tsx
import { useState, useCallback, useEffect, useRef } from 'react';
import type { SensorMeta, SensorReading, ActiveAlert } from '../types';
import { useWebSocket } from '../hooks/useWebSocket';
import SensorCard from '../components/SensorCard';
import AlertBar from '../components/AlertBar';
import SensorDrawer from '../components/SensorDrawer';
import ProductionTotal from '../components/ProductionTotal';

const API = 'http://localhost:8000';

export default function Dashboard() {
  const [sensors, setSensors] = useState<SensorMeta[]>([]);
  const [readings, setReadings] = useState<Record<string, SensorReading>>({});
  const [lastSeen, setLastSeen] = useState<Record<string, number>>({});
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const alertTimer = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    fetch(`${API}/sensors`).then(r => r.json()).then(setSensors);
    fetch(`${API}/alerts`).then(r => r.json()).then(setAlerts);
    alertTimer.current = setInterval(() => {
      fetch(`${API}/alerts`).then(r => r.json()).then(setAlerts);
    }, 10000);
    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(alertTimer.current);
      clearInterval(clockTimer);
    };
  }, []);

  const handleMessage = useCallback((reading: SensorReading) => {
    setReadings(prev => ({ ...prev, [reading.sensor_id]: reading }));
    setLastSeen(prev => ({ ...prev, [reading.sensor_id]: Date.now() }));
    if (reading.alert) {
      fetch(`${API}/alerts`).then(r => r.json()).then(setAlerts);
    }
  }, []);

  const { connected } = useWebSocket(handleMessage);
  const selectedSensor = sensors.find(s => s.id === selectedId) ?? null;

  const formatDate = (d: Date) =>
    d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const formatTime = (d: Date) => d.toLocaleTimeString('es-AR');

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <nav style={{
        width: 56, background: '#0a0a0a', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '16px 0', gap: 8, flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, background: 'var(--red)', borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 14, marginBottom: 16,
        }}>IP</div>

        {[
          { icon: '⊞', label: 'Dashboard', active: true },
          { icon: '〜', label: 'Sensores' },
          { icon: '🔔', label: 'Alertas' },
          { icon: '📈', label: 'Historial' },
        ].map(({ icon, label, active }) => (
          <div key={label} title={label} style={{
            width: 36, height: 36, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: active ? 'var(--red-bg)' : 'transparent',
            color: active ? 'var(--red)' : 'var(--text-3)',
            cursor: 'pointer', fontSize: 14,
          }}>{icon}</div>
        ))}

        <div style={{ flex: 1 }} />
        <div title="Config" style={{
          width: 36, height: 36, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-3)', cursor: 'pointer',
        }}>⚙</div>
      </nav>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <header style={{
          height: 52, background: '#0a0a0a', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16, flexShrink: 0,
        }}>
          <div>
            <span style={{ fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Planta Pesquera
            </span>
            <span style={{ color: 'var(--text-3)', fontSize: 11, marginLeft: 4 }}>
              — Puerto Madryn, Sector A
            </span>
          </div>
          <div style={{ flex: 1 }} />
          {alerts.length > 0 && (
            <span style={{
              background: 'var(--red-bg)', color: 'var(--red)',
              border: '1px solid var(--red-dim)',
              padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 700,
              animation: 'pulse 1.5s infinite',
            }}>⚠ {alerts.length} ALERTA{alerts.length > 1 ? 'S' : ''}</span>
          )}
          <span style={{
            background: connected ? 'var(--green-bg)' : '#1a1a1a',
            color: connected ? 'var(--green)' : 'var(--text-3)',
            border: `1px solid ${connected ? 'var(--green-dim)' : 'var(--border)'}`,
            padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 700,
          }}>
            {connected ? `● ${sensors.length} ONLINE` : '○ RECONECTANDO'}
          </span>
          <span style={{ color: 'var(--text-3)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(now)} — {formatDate(now)}
          </span>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {alerts.length > 0 && <AlertBar alerts={alerts} sensors={sensors} />}

          <div style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>
            Sensores en tiempo real
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {sensors.filter(s => !s.is_production_line).map(sensor => (
              <SensorCard
                key={sensor.id}
                meta={sensor}
                reading={readings[sensor.id] ?? null}
                lastSeen={lastSeen[sensor.id] ?? null}
                onClick={() => setSelectedId(sensor.id)}
              />
            ))}
          </div>

          <div style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>
            Líneas de producción
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {sensors.filter(s => s.is_production_line).map(sensor => (
              <SensorCard
                key={sensor.id}
                meta={sensor}
                reading={readings[sensor.id] ?? null}
                lastSeen={lastSeen[sensor.id] ?? null}
                onClick={() => setSelectedId(sensor.id)}
              />
            ))}
            <ProductionTotal />
          </div>
        </div>
      </div>

      {/* Drawer overlay */}
      {selectedId && (
        <>
          <div
            onClick={() => setSelectedId(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10 }}
          />
          <SensorDrawer
            sensor={selectedSensor}
            reading={readings[selectedId] ?? null}
            onClose={() => setSelectedId(null)}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Start dev server to verify it renders**

```bash
cd frontend && npm run dev
```
Open `http://localhost:5173`. Expected: dark sidebar + topbar visible. Cards show "—" until backend runs. No console errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx frontend/src/App.tsx
git commit -m "feat: add Dashboard page with layout, topbar, sidebar"
```

---

## Task 9: SensorChart + SensorDrawer

**Files:**
- Create: `frontend/src/components/SensorChart.tsx`
- Create: `frontend/src/components/SensorDrawer.tsx`

- [ ] **Step 1: Create SensorChart.tsx**

```tsx
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { useSensorHistory } from '../hooks/useSensorHistory';
import type { SensorMeta } from '../types';
import type { HistoryRange } from '../hooks/useSensorHistory';

interface Props { sensor: SensorMeta; }

const RANGES: HistoryRange[] = ['30m', '1h', '6h', '24h'];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function SensorChart({ sensor }: Props) {
  const [range, setRange] = useState<HistoryRange>('1h');
  const { data, loading, error } = useSensorHistory(sensor.id, range);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>
          Historial — {sensor.unit}
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: '2px 8px', borderRadius: 3, fontSize: 9, cursor: 'pointer', border: 'none',
              background: range === r ? 'var(--red-bg)' : 'transparent',
              color: range === r ? 'var(--red)' : 'var(--text-3)',
            }}>{r}</button>
          ))}
        </div>
      </div>

      <div style={{ background: '#080808', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 8px' }}>
        {loading && <div style={{ color: 'var(--text-3)', fontSize: 11, textAlign: 'center', padding: 20 }}>Cargando...</div>}
        {error && <div style={{ color: 'var(--red)', fontSize: 11, textAlign: 'center', padding: 20 }}>{error}</div>}
        {!loading && !error && data.length === 0 && (
          <div style={{ color: 'var(--text-3)', fontSize: 11, textAlign: 'center', padding: 20 }}>Sin datos aún</div>
        )}
        {!loading && data.length > 0 && (
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={data.map(d => ({ ...d, time: formatTime(d.timestamp) }))}>
              <XAxis dataKey="time" tick={{ fill: '#444', fontSize: 8 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#444', fontSize: 8 }} width={35} />
              <Tooltip
                contentStyle={{ background: '#0d0d0d', border: '1px solid #333', borderRadius: 4, fontSize: 11 }}
                labelStyle={{ color: '#888' }}
                itemStyle={{ color: '#fff' }}
              />
              <ReferenceLine y={sensor.min_val} stroke="#7f1d1d" strokeDasharray="4 4" />
              <ReferenceLine y={sensor.max_val} stroke="#7f1d1d" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="value" stroke="var(--red)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create SensorDrawer.tsx** (replaces the stub from Task 8)

```tsx
import { useState, useEffect } from 'react';
import type { SensorMeta, SensorReading } from '../types';
import { getSensorStatus } from '../types';
import SensorChart from './SensorChart';
import ProductSelector from './ProductSelector';

interface Props {
  sensor: SensorMeta | null;
  reading: SensorReading | null;
  onClose: () => void;
}

interface SensorEvent {
  id: number;
  value: number;
  message: string;
  triggered_at: string;
  resolved: boolean;
}

const API = 'http://localhost:8000';
const STATUS_COLOR = { normal: 'var(--green)', warning: 'var(--yellow)', alert: 'var(--red)', offline: '#555' };
const STATUS_LABEL = { normal: 'NORMAL', warning: 'ATENCIÓN', alert: 'ALERTA', offline: 'OFFLINE' };

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

export default function SensorDrawer({ sensor, reading, onClose }: Props) {
  const [stats, setStats] = useState<{ min: number; avg: number; max: number } | null>(null);
  const [events, setEvents] = useState<SensorEvent[]>([]);

  useEffect(() => {
    if (!sensor) return;
    setStats(null);
    setEvents([]);
    fetch(`${API}/sensors/${sensor.id}/history?range=1h`)
      .then(r => r.json())
      .then((data: { value: number }[]) => {
        if (data.length === 0) return;
        const vals = data.map(d => d.value);
        setStats({
          min: Math.min(...vals),
          avg: vals.reduce((a, b) => a + b, 0) / vals.length,
          max: Math.max(...vals),
        });
      });
    fetch(`${API}/sensors/${sensor.id}/events`)
      .then(r => r.json())
      .then(setEvents);
  }, [sensor?.id]);

  if (!sensor) return null;

  const status = reading ? getSensorStatus(reading.value, sensor.min_val, sensor.max_val) : 'offline';
  const color = STATUS_COLOR[status];

  // Derived t/h for production lines (kg/min × 60 / 1000)
  const tph = sensor.unit === 'kg/min' && reading
    ? (reading.value * 60 / 1000).toFixed(3)
    : null;

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
      background: 'var(--surface)', borderLeft: '1px solid var(--border-2)',
      zIndex: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 10,
          letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer', marginBottom: 12,
        }}>← Volver</button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{sensor.name}</div>
            <div style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 3 }}>
              {sensor.id} · {sensor.location}
            </div>
          </div>
          <span style={{
            padding: '4px 12px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
            background: status === 'alert' ? 'var(--red-bg)' : status === 'warning' ? 'var(--yellow-bg)' : 'var(--green-bg)',
            color,
            border: `1px solid ${status === 'alert' ? 'var(--red-dim)' : status === 'warning' ? '#713f12' : 'var(--green-dim)'}`,
            animation: status === 'alert' ? 'pulse 1.5s infinite' : undefined,
          }}>{STATUS_LABEL[status]}</span>
        </div>

        {/* Main value */}
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 52, fontWeight: 800, color, letterSpacing: -2, lineHeight: 1 }}>
            {reading ? reading.value.toFixed(1) : '—'}
          </span>
          <span style={{ fontSize: 22, color: 'var(--text-3)' }}>{sensor.unit}</span>
          {/* Derived t/h for production lines */}
          {tph && (
            <span style={{ fontSize: 13, color: 'var(--text-2)', marginLeft: 8 }}>
              = <strong style={{ color: 'var(--green)' }}>{tph}</strong> t/h
            </span>
          )}
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)' }}>
          Límites: <span style={{ color }}>{sensor.min_val} — {sensor.max_val} {sensor.unit}</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Stats strip */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {[
              { label: 'Mínimo (1h)', value: stats.min.toFixed(1), color: '#5dade2' },
              { label: 'Promedio (1h)', value: stats.avg.toFixed(1), color: 'var(--text)' },
              { label: 'Máximo (1h)', value: stats.max.toFixed(1), color },
            ].map(({ label, value, color: c }) => (
              <div key={label} style={{ background: 'var(--surface)', padding: '12px', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        <SensorChart sensor={sensor} />

        {/* Production selector */}
        {sensor.is_production_line && <ProductSelector sensorId={sensor.id} sensorName={sensor.name} />}

        {/* Event log */}
        {events.length > 0 && (
          <div>
            <div style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>
              Registro de eventos
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {events.map(ev => (
                <div key={ev.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '8px 10px', background: '#080808',
                  border: '1px solid #141414', borderRadius: 6,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 3,
                    background: ev.resolved ? 'var(--green)' : 'var(--red)',
                  }} />
                  <div style={{ flex: 1, color: '#aaa', fontSize: 11, lineHeight: 1.4 }}>
                    {ev.message}
                  </div>
                  <div style={{ color: 'var(--text-3)', fontSize: 10, whiteSpace: 'nowrap' }}>
                    hace {timeAgo(ev.triggered_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div>
          <div style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>
            Información del sensor
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Tipo', value: sensor.sensor_type },
              { label: 'Protocolo', value: 'WebSocket / JSON' },
              { label: 'Frecuencia', value: 'Cada 5 segundos' },
              { label: 'Ubicación', value: sensor.location },
              { label: 'Rango normal', value: `${sensor.min_val} — ${sensor.max_val} ${sensor.unit}` },
              { label: 'Estado WS', value: reading ? 'Conectado' : 'Sin datos' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#080808', border: '1px solid #141414', borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SensorChart.tsx frontend/src/components/SensorDrawer.tsx
git commit -m "feat: add SensorChart and SensorDrawer components"
```

---

## Task 10: Production components

**Files:**
- Create: `frontend/src/components/ProductSelector.tsx`
- Create: `frontend/src/components/ProductionTotal.tsx`

- [ ] **Step 1: Create ProductSelector.tsx**

```tsx
import { useState, useEffect } from 'react';

const API = 'http://localhost:8000';
const SPECIES = ['Merluza', 'Langostino', 'Calamar', 'Salmón', 'Otro'];

interface Props { sensorId: string; sensorName: string; }

export default function ProductSelector({ sensorId, sensorName: _ }: Props) {
  const [current, setCurrent] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}/sensors/${sensorId}/product`)
      .then(r => r.json())
      .then(d => setCurrent(d.product_name));
  }, [sensorId]);

  const save = async (name: string) => {
    if (!name.trim()) return;
    setSaving(true);
    await fetch(`${API}/sensors/${sensorId}/product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_name: name.trim() }),
    });
    setCurrent(name.trim());
    setSaving(false);
  };

  return (
    <div>
      <div style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>
        Producto activo
      </div>
      {current && (
        <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-dim)', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: 'var(--green)' }}>
          ● {current}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {SPECIES.filter(s => s !== 'Otro').map(s => (
          <button key={s} onClick={() => save(s)} disabled={saving} style={{
            padding: '4px 12px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
            background: current === s ? 'var(--red-bg)' : '#0d0d0d',
            color: current === s ? 'var(--red)' : 'var(--text-2)',
            border: `1px solid ${current === s ? 'var(--red-dim)' : 'var(--border)'}`,
          }}>{s}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          placeholder="Otro producto..."
          style={{
            flex: 1, background: '#080808', border: '1px solid var(--border)', borderRadius: 4,
            color: 'var(--text)', fontSize: 11, padding: '5px 10px', outline: 'none',
          }}
        />
        <button onClick={() => { save(custom); setCustom(''); }} disabled={saving || !custom.trim()} style={{
          padding: '5px 12px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
          background: 'var(--red)', color: '#fff', border: 'none',
          opacity: !custom.trim() ? 0.4 : 1,
        }}>Guardar</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ProductionTotal.tsx**

```tsx
import { useState, useEffect } from 'react';

const API = 'http://localhost:8000';

interface LineData {
  sensor_id: string;
  sensor_name: string;
  total_kg: number;
  product_name: string | null;
}

interface TotalData {
  lines: LineData[];
  grand_total_kg: number;
}

export default function ProductionTotal() {
  const [data, setData] = useState<TotalData | null>(null);

  useEffect(() => {
    const load = () => fetch(`${API}/production-today`).then(r => r.json()).then(setData);
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  if (!data) return null;

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '14px 16px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--green)' }} />
      <div style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
        Total producido hoy
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, letterSpacing: -1 }}>
        {(data.grand_total_kg / 1000).toFixed(2)}
        <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 400, marginLeft: 4 }}>t</span>
      </div>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data.lines.map(line => (
          <div key={line.sensor_id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
            <span style={{ color: 'var(--text-3)' }}>{line.sensor_name.replace('Línea Producción ', 'L')}</span>
            <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{line.total_kg.toFixed(1)} kg</span>
            {line.product_name && (
              <span style={{ color: 'var(--green)', marginLeft: 'auto' }}>{line.product_name}</span>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 9, fontWeight: 700, color: 'var(--green)', letterSpacing: 0.5 }}>
        ● ACUMULADO
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ProductSelector.tsx frontend/src/components/ProductionTotal.tsx
git commit -m "feat: add ProductSelector and ProductionTotal components"
```

---

## Task 11: Full integration smoke test

- [ ] **Step 1: Start backend**

```bash
cd backend && uvicorn main:app --reload --port 8000
```
Expected: `Application startup complete.` — simulator starts ticking.

- [ ] **Step 2: Start frontend**

In a second terminal:
```bash
cd frontend && npm run dev
```
Expected: `http://localhost:5173` — dev server ready.

- [ ] **Step 3: Smoke test checklist**

Open `http://localhost:5173` and verify:
- [ ] Dark background, sidebar, topbar visible
- [ ] After ≤5 seconds, sensor cards update with live values
- [ ] Some cards show red (alert) or yellow (warning) — random walk will trigger some
- [ ] Alert bar appears when an alert is active
- [ ] Click any sensor card → drawer slides in with value, chart, metadata
- [ ] Chart shows historical data after a few readings accumulate
- [ ] Click production line card → drawer shows ProductSelector with species buttons
- [ ] Select a species → green badge appears showing active product
- [ ] ProductionTotal widget updates every 10 seconds
- [ ] Open browser DevTools → no console errors

- [ ] **Step 4: Run full backend test suite one final time**

```bash
cd backend && pytest tests/ -v
```
Expected: `16 passed`

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete industrial dashboard — backend + frontend integrated"
```

---

## Quick Start (after implementation)

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

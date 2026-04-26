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
    for ws in list(connected_clients):
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
    except Exception:
        pass
    finally:
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


class SensorUpdateBody(BaseModel):
    name: str | None = None
    min_val: float | None = None
    max_val: float | None = None
    location: str | None = None


@app.patch("/sensors/{sensor_id}")
def update_sensor(sensor_id: str, body: SensorUpdateBody, db: Session = Depends(get_db)):
    sensor = db.get(Sensor, sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")
    if body.name is not None:
        sensor.name = body.name
    if body.min_val is not None:
        sensor.min_val = body.min_val
    if body.max_val is not None:
        sensor.max_val = body.max_val
    if body.location is not None:
        sensor.location = body.location
    db.commit()
    return {
        "id": sensor.id, "name": sensor.name, "unit": sensor.unit,
        "min_val": sensor.min_val, "max_val": sensor.max_val,
        "location": sensor.location, "sensor_type": sensor.sensor_type,
        "is_production_line": sensor.is_production_line == "true",
    }


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


@app.get("/alerts/history")
def get_alerts_history(limit: int = 50, db: Session = Depends(get_db)):
    rows = (
        db.query(Alert)
        .order_by(Alert.triggered_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": a.id, "sensor_id": a.sensor_id, "value": a.value,
            "message": a.message,
            "triggered_at": a.triggered_at.isoformat(),
            "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
        }
        for a in rows
    ]


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

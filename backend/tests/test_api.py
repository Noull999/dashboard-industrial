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

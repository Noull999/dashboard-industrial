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
        assert abs(v - prev) <= spread + 0.01, f"Step too large: {abs(v - prev)}"
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


def test_check_and_save_alert_deduplication(db):
    check_and_save_alert(db, TEMP_SENSOR.id, -1.0, TEMP_SENSOR.min_val, TEMP_SENSOR.max_val, TEMP_SENSOR.name)
    result = check_and_save_alert(db, TEMP_SENSOR.id, -1.0, TEMP_SENSOR.min_val, TEMP_SENSOR.max_val, TEMP_SENSOR.name)
    assert result is None
    from models import Alert
    count = db.query(Alert).filter_by(sensor_id=TEMP_SENSOR.id).count()
    assert count == 1


def test_check_and_save_alert_auto_resolves(db):
    from models import Alert
    check_and_save_alert(db, TEMP_SENSOR.id, -1.0, TEMP_SENSOR.min_val, TEMP_SENSOR.max_val, TEMP_SENSOR.name)
    check_and_save_alert(db, TEMP_SENSOR.id, -7.0, TEMP_SENSOR.min_val, TEMP_SENSOR.max_val, TEMP_SENSOR.name)
    alert = db.query(Alert).filter_by(sensor_id=TEMP_SENSOR.id).first()
    assert alert.resolved_at is not None


def test_check_and_save_alert_new_after_resolution(db):
    first = check_and_save_alert(db, TEMP_SENSOR.id, -1.0, TEMP_SENSOR.min_val, TEMP_SENSOR.max_val, TEMP_SENSOR.name)
    check_and_save_alert(db, TEMP_SENSOR.id, -7.0, TEMP_SENSOR.min_val, TEMP_SENSOR.max_val, TEMP_SENSOR.name)
    second = check_and_save_alert(db, TEMP_SENSOR.id, -1.0, TEMP_SENSOR.min_val, TEMP_SENSOR.max_val, TEMP_SENSOR.name)
    assert second is not None
    assert second.id != first.id

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

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

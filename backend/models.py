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

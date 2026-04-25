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

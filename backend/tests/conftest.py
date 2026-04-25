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

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

Base = declarative_base()

# Default engine (dev fallback)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./pharmaicy.db")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Per-user engine cache
_engine_cache: dict = {}

def get_db_for_user(user_id: str):
    safe_id = user_id.replace("/", "_").replace("\\", "_")
    if safe_id not in _engine_cache:
        os.makedirs("data", exist_ok=True)
        db_path = f"data/pharmacy_{safe_id}.db"
        user_engine = create_engine(
            f"sqlite:///{db_path}",
            connect_args={"check_same_thread": False}
        )
        # Create all tables for this user's DB
        from backend.database import Base as _Base
        _Base.metadata.create_all(bind=user_engine)
        _engine_cache[safe_id] = sessionmaker(autocommit=False, autoflush=False, bind=user_engine)
    return _engine_cache[safe_id]()

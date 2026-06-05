import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base
from backend.models import Product, Inventory, Sale
from agents.data_agent import analyze_sales, get_low_stock
from agents.expiry_agent import get_expiring
from datetime import date, timedelta

@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

def test_analyze_sales_empty(db):
    result = analyze_sales(db)
    assert result["total_revenue"] == 0
    assert result["top_products"] == []

def test_get_low_stock_empty(db):
    result = get_low_stock(db)
    assert result == []

def test_expiry_agent_empty(db):
    result = get_expiring(db)
    assert result == []

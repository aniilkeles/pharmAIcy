import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_agent_status():
    response = client.get("/agent-status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "agents" in data

def test_dashboard_empty():
    response = client.get("/dashboard-summary")
    assert response.status_code == 200

def test_notifications_empty():
    response = client.get("/notifications")
    assert response.status_code == 200

def test_unread_count():
    response = client.get("/notifications/unread-count")
    assert response.status_code == 200
    assert "count" in response.json()

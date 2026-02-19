"""Integration: full ingest request -> storage, calculations, lineage."""
import os
import sys
import json
import pytest

try:
    import flask
except ImportError:
    flask = None

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
if flask is not None:
    from services.telemetry.src.app import app
from services.telemetry.src import storage, audit

pytestmark = pytest.mark.skipif(flask is None, reason="flask not installed; pip install -r services/telemetry/requirements.txt")

@pytest.fixture
def client_and_isolated(tmp_path, monkeypatch):
    monkeypatch.setenv("TELEMETRY_DATA_DIR", str(tmp_path))
    (tmp_path / "data").mkdir(parents=True)
    (tmp_path / "logs").mkdir(parents=True)
    ef_dir = tmp_path / "data" / "emission_factors"
    ef_dir.mkdir(parents=True)
    (ef_dir / "v1.json").write_text('''{"version_id":"v1","valid_from":"2020-01-01T00:00:00Z","valid_to":"2030-12-31T23:59:59Z",
"location_based_kg_co2e_per_kwh":0.5,"regions":{"us-west":{"location_based_kg_co2e_per_kwh":0.35}}}''')
    storage.set_db_path(str(tmp_path / "data" / "ingest.db"))
    audit.set_audit_path(str(tmp_path / "logs" / "audit.log"))
    with app.test_client() as c:
        yield c


def test_ingest_returns_200(client_and_isolated):
    payload = {
        "timestamp": "2024-06-15T12:00:00Z",
        "asset_id": "DC1",
        "region": "us-west",
        "source_id": "gw1",
        "external_event_id": "int-001",
        "energy": {"facility_kwh": 1200.0, "it_kwh": 1000.0},
        "compute": {"gpu_hours": 200.0, "training_runs": 4},
    }
    r = client_and_isolated.post("/ingest", json=payload, content_type="application/json")
    assert r.status_code in (200, 201)
    data = r.get_json()
    assert data["status"] == "accepted"
    assert "raw_id" in data
    assert "summary" in data


def test_ingest_duplicate_returns_409(client_and_isolated):
    payload = {
        "timestamp": "2024-06-15T12:00:00Z",
        "source_id": "gw1",
        "external_event_id": "dup-001",
        "energy": {"it_kwh": 100.0},
    }
    r1 = client_and_isolated.post("/ingest", json=payload, content_type="application/json")
    assert r1.status_code in (200, 201)
    r2 = client_and_isolated.post("/ingest", json=payload, content_type="application/json")
    assert r2.status_code == 409
    assert r2.get_json().get("error", {}).get("code") == "DUPLICATE"


def test_ingest_invalid_payload_returns_400(client_and_isolated):
    r = client_and_isolated.post("/ingest", json={"timestamp": "2024-06-15T12:00:00Z"}, content_type="application/json")
    assert r.status_code == 400


def test_metrics_report_returns_200(client_and_isolated):
    r = client_and_isolated.get("/metrics/report")
    assert r.status_code == 200
    data = r.get_json()
    assert "carbon" in data and "water" in data


def test_health_returns_200(client_and_isolated):
    r = client_and_isolated.get("/health")
    assert r.status_code == 200

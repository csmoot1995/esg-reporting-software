"""Load/burst telemetry: multiple ingest requests; idempotency and no double-count."""
import os
import sys
import pytest

try:
    import flask
except ImportError:
    flask = None

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
if flask is not None:
    from services.telemetry.src.app import app
from services.telemetry.src import storage

pytestmark = pytest.mark.skipif(flask is None, reason="flask not installed")


@pytest.fixture
def client_burst(tmp_path, monkeypatch):
    monkeypatch.setenv("TELEMETRY_DATA_DIR", str(tmp_path))
    (tmp_path / "data").mkdir(parents=True)
    (tmp_path / "logs").mkdir(parents=True)
    ef_dir = tmp_path / "data" / "emission_factors"
    ef_dir.mkdir(parents=True)
    (ef_dir / "v1.json").write_text('{"version_id":"v1","valid_from":"2020-01-01T00:00:00Z","valid_to":"2030-12-31T23:59:59Z","location_based_kg_co2e_per_kwh":0.5}')
    storage.set_db_path(str(tmp_path / "data" / "burst.db"))
    from services.telemetry.src import audit
    audit.set_audit_path(str(tmp_path / "logs" / "audit.log"))
    with app.test_client() as c:
        yield c


def test_burst_ingest_accepted(client_burst):
    """Send 10 distinct payloads; all accepted, no duplicate."""
    for i in range(10):
        payload = {
            "timestamp": "2024-06-15T12:00:00Z",
            "source_id": "gw1",
            "external_event_id": f"burst-{i}",
            "energy": {"it_kwh": 100.0 + i},
        }
        r = client_burst.post("/ingest", json=payload, content_type="application/json")
        assert r.status_code in (200, 201), r.get_data(as_text=True)
        data = r.get_json()
        assert data.get("status") == "accepted"
        assert data.get("raw_id") is not None


def test_burst_duplicate_each_rejected(client_burst):
    """Send same (source_id, external_event_id) twice; second returns 409."""
    payload = {
        "timestamp": "2024-06-15T12:00:00Z",
        "source_id": "gw2",
        "external_event_id": "dup-burst",
        "energy": {"it_kwh": 200.0},
    }
    r1 = client_burst.post("/ingest", json=payload, content_type="application/json")
    assert r1.status_code in (200, 201)
    r2 = client_burst.post("/ingest", json=payload, content_type="application/json")
    assert r2.status_code == 409
    assert r2.get_json().get("error", {}).get("code") == "DUPLICATE"

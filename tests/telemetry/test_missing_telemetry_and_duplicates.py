"""Missing telemetry handling and duplicate payload rejection."""
import os
import sys
import pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from services.telemetry.src import storage, schema

@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    monkeypatch.setenv("TELEMETRY_DATA_DIR", str(tmp_path))
    db = tmp_path / "data" / "telemetry.db"
    (tmp_path / "data").mkdir(parents=True)
    storage.set_db_path(str(db))
    storage.init_schema(storage._conn())
    storage._conn().close()
    return db


def test_missing_telemetry_optional_blocks():
    """Payload with only energy (no water/compute) is valid."""
    from services.telemetry.src.schema import validate_ingest_payload
    p = validate_ingest_payload({
        "timestamp": "2024-06-15T12:00:00Z",
        "energy": {"facility_kwh": 100.0, "it_kwh": 80.0},
    })
    assert p.water is None
    assert p.compute is None


def test_duplicate_rejected(temp_db):
    """Same source_id + external_event_id must be rejected (or idempotent); we reject with 409."""
    raw = {"timestamp": "2024-06-15T12:00:00Z", "source_id": "s1", "external_event_id": "e1", "energy": {"it_kwh": 100.0}}
    raw_id1, dup1 = storage.insert_raw(raw, "s1", "e1", "req1", "2024-06-15T12:00:00Z")
    assert dup1 is None
    assert raw_id1 is not None
    raw_id2, dup2 = storage.insert_raw(raw, "s1", "e1", "req2", "2024-06-15T12:00:00Z")
    assert dup2 == "DUPLICATE"
    assert raw_id2 is None


def test_different_event_id_accepted(temp_db):
    """Different external_event_id with same source_id is accepted."""
    raw1 = {"timestamp": "2024-06-15T12:00:00Z", "source_id": "s1", "external_event_id": "e1", "energy": {"it_kwh": 100.0}}
    raw2 = {"timestamp": "2024-06-15T12:00:00Z", "source_id": "s1", "external_event_id": "e2", "energy": {"it_kwh": 101.0}}
    id1, d1 = storage.insert_raw(raw1, "s1", "e1", None, "2024-06-15T12:00:00Z")
    id2, d2 = storage.insert_raw(raw2, "s1", "e2", None, "2024-06-15T12:00:00Z")
    assert d1 is None and d2 is None
    assert id1 != id2


def test_missing_timestamp_normalized():
    """Storage normalizes missing/invalid timestamp to UTC now."""
    ts = storage.normalize_timestamp("")
    assert "T" in ts and "Z" in ts or "+" in ts

"""Data lineage and ingestion flow: lineage stored, emission factor version present."""
import os
import sys
import json
import pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from services.telemetry.src import storage, lineage, audit

@pytest.fixture
def temp_storage(tmp_path, monkeypatch):
    monkeypatch.setenv("TELEMETRY_DATA_DIR", str(tmp_path))
    (tmp_path / "data").mkdir(parents=True)
    (tmp_path / "logs").mkdir(parents=True)
    storage.set_db_path(str(tmp_path / "data" / "t.db"))
    audit.set_audit_path(str(tmp_path / "logs" / "audit.log"))
    storage.init_schema(storage._conn())
    storage._conn().close()
    return tmp_path


def test_lineage_has_version(temp_storage):
    """Stored metrics must have lineage with emission_factor_version (CI requirement)."""
    ref = lineage.build_lineage("raw-1", "src1", "req1", "v1", calculation_step="carbon_per_gpu_hour = total_kg / gpu_hours")
    d = lineage.lineage_to_dict(ref)
    assert lineage.ensure_lineage_has_version(d) is True
    assert d["emission_factor_version"] == "v1"


def test_lineage_from_dict_roundtrip():
    d = {"raw_payload_id": "1", "source_id": "s", "ingestion_request_id": "r", "emission_factor_version": "v1", "derived_from": [], "calculation_step": ""}
    ref = lineage.lineage_from_dict(d)
    assert ref.emission_factor_version == "v1"
    d2 = lineage.lineage_to_dict(ref)
    assert d2["emission_factor_version"] == "v1"


def test_lineage_fails_without_version():
    assert lineage.ensure_lineage_has_version({}) is False
    assert lineage.ensure_lineage_has_version({"emission_factor_version": ""}) is False

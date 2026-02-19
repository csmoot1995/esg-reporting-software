"""Pytest fixtures: isolated DB and audit path for telemetry tests."""
import os
import pytest


@pytest.fixture
def telemetry_data_dir(tmp_path, monkeypatch):
    """Use a temporary directory for TELEMETRY_DATA_DIR so tests don't touch real data."""
    d = tmp_path / "telemetry_data"
    d.mkdir()
    (d / "emission_factors").mkdir(parents=True)
    (d / "data").mkdir(parents=True)
    (d / "logs").mkdir(parents=True)
    import shutil
    src = os.path.join(os.path.dirname(__file__), "..", "..", "services", "telemetry", "data", "emission_factors", "v1.json")
    if os.path.isfile(src):
        shutil.copy(src, d / "emission_factors" / "v1.json")
    monkeypatch.setenv("TELEMETRY_DATA_DIR", str(d))
    return str(d)


@pytest.fixture
def isolated_storage(telemetry_data_dir):
    """Ensure storage and audit use temp paths."""
    import sys
    root = os.path.join(os.path.dirname(__file__), "..", "..")
    if root not in sys.path:
        sys.path.insert(0, root)
    from services.telemetry.src import storage, audit
    db_path = os.path.join(telemetry_data_dir, "data", "telemetry_test.db")
    audit_path = os.path.join(telemetry_data_dir, "logs", "audit.log")
    storage.set_db_path(db_path)
    audit.set_audit_path(audit_path)
    yield storage
    try:
        if os.path.isfile(db_path):
            os.remove(db_path)
    except Exception:
        pass

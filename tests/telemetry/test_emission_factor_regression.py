"""Emission factor change regression: same input + same version -> same output."""
import os
import sys
import pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from services.telemetry.src import emission_factors
from services.telemetry.src.calculations import carbon

@pytest.fixture
def ef_dir(tmp_path, monkeypatch):
    d = tmp_path / "data" / "emission_factors"
    d.mkdir(parents=True)
    (d / "v1.json").write_text('''{"version_id":"v1","valid_from":"2020-01-01T00:00:00Z","valid_to":"2030-12-31T23:59:59Z",
"location_based_kg_co2e_per_kwh":0.5,"market_based_kg_co2e_per_kwh":0.45,
"diesel_kg_co2e_per_liter":2.68}''')
    monkeypatch.setenv("TELEMETRY_DATA_DIR", str(tmp_path))
    emission_factors._loaded = False
    emission_factors._factor_store.clear()
    emission_factors._load_factors()
    return d


def test_same_version_same_output(ef_dir):
    """Same version and input -> identical factor and carbon result."""
    kg1, v1 = carbon.scope2_from_it_energy(1000.0, None, "v1")
    kg2, v2 = carbon.scope2_from_it_energy(1000.0, None, "v1")
    assert v1 == v2 == "v1"
    assert kg1 == kg2


def test_version_metadata_has_version_reference(ef_dir):
    meta = emission_factors.get_version_metadata("v1")
    assert meta.get("version_id") == "v1"
    assert "valid_from" in meta

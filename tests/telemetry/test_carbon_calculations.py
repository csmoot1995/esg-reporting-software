"""Carbon calculations and benchmark variance tests. Emissions must be within ±0.5% of expected."""
import os
import sys
import pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from services.telemetry.src.calculations import carbon as calc_carbon
from services.telemetry.src import emission_factors

# Benchmark: with v1 factors, 1000 kWh IT in us-west -> 0.35 kg/kWh -> 350 kg CO2e
EXPECTED_SCOPE2_US_WEST_1000_KWH = 350.0
REL_TOLERANCE = 0.005  # ±0.5%


@pytest.fixture(autouse=True)
def set_data_dir(tmp_path, monkeypatch):
    ef_dir = tmp_path / "data" / "emission_factors"
    ef_dir.mkdir(parents=True)
    (ef_dir / "v1.json").write_text('''{"version_id":"v1","valid_from":"2020-01-01T00:00:00Z","valid_to":"2030-12-31T23:59:59Z",
"location_based_kg_co2e_per_kwh":0.5,"market_based_kg_co2e_per_kwh":0.45,
"diesel_kg_co2e_per_liter":2.68,"natural_gas_kg_co2e_per_m3":2.0,
"regions":{"us-west":{"location_based_kg_co2e_per_kwh":0.35}}}''')
    monkeypatch.setenv("TELEMETRY_DATA_DIR", str(tmp_path))
    import importlib
    import services.telemetry.src.emission_factors as ef
    ef._loaded = False
    ef._factor_store.clear()
    importlib.reload(ef)


def test_scope2_from_it_energy_benchmark():
    """Known benchmark: 1000 kWh, us-west, location-based -> 350 kg CO2e."""
    kg, version = calc_carbon.scope2_from_it_energy(1000.0, "us-west", "v1", market_based=False)
    assert version == "v1"
    assert kg == pytest.approx(EXPECTED_SCOPE2_US_WEST_1000_KWH, rel=REL_TOLERANCE)


def test_scope1_diesel_benchmark():
    """Diesel: 100 L * 2.68 kg/L = 268 kg CO2e."""
    kg, version = calc_carbon.scope1_from_generator_fuel(100.0, "diesel", None, "v1")
    assert kg == pytest.approx(268.0, rel=REL_TOLERANCE)


def test_carbon_per_gpu_hour():
    assert calc_carbon.carbon_per_gpu_hour(350.0, 200.0) == pytest.approx(1.75, rel=REL_TOLERANCE)


def test_carbon_per_training_run():
    assert calc_carbon.carbon_per_training_run(350.0, 4) == pytest.approx(87.5, rel=REL_TOLERANCE)


def test_carbon_per_inference_request():
    assert calc_carbon.carbon_per_inference_request(10.0, 1000) == pytest.approx(0.01, rel=REL_TOLERANCE)


def test_total_carbon_from_payload():
    s1, s2, total, ver = calc_carbon.total_carbon_from_payload(
        1000.0, 1000.0, None, None, "us-west", "v1", "2024-06-15T12:00:00Z"
    )
    assert s1 == 0.0
    assert s2 == pytest.approx(EXPECTED_SCOPE2_US_WEST_1000_KWH, rel=REL_TOLERANCE)
    assert total == pytest.approx(EXPECTED_SCOPE2_US_WEST_1000_KWH, rel=REL_TOLERANCE)
    assert ver == "v1"


def test_emission_factor_version_reference():
    """Emission factors must have version reference (no empty version)."""
    factor, version = emission_factors.get_factor("v1", "us-west", "scope2_location", None)
    assert version == "v1"
    assert factor > 0

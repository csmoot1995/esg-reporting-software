"""Unit conversion correctness tests."""
import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from services.telemetry.src.units import (
    normalize_energy,
    normalize_water,
    normalize_time_to_seconds,
    seconds_to_gpu_hours,
    gpu_hours_to_seconds,
)


def test_energy_kwh_unchanged():
    assert normalize_energy(100.0, "kWh") == 100.0


def test_energy_mwh_to_kwh():
    assert normalize_energy(1.0, "MWh") == 1000.0


def test_energy_wh_to_kwh():
    assert normalize_energy(1000.0, "Wh") == 1.0


def test_energy_unknown_unit_raises():
    with pytest.raises(ValueError, match="Unknown energy unit"):
        normalize_energy(1.0, "joules")


def test_water_liters_unchanged():
    assert normalize_water(500.0, "liters") == 500.0


def test_water_m3_to_liters():
    assert normalize_water(1.0, "m3") == 1000.0


def test_water_gallons_to_liters():
    assert normalize_water(1.0, "gallons") == pytest.approx(3.78541, rel=1e-4)


def test_time_hours_to_seconds():
    assert normalize_time_to_seconds(1.0, "hours") == 3600.0


def test_time_gpu_hours_to_seconds():
    assert normalize_time_to_seconds(1.0, "gpu_hours") == 3600.0


def test_seconds_to_gpu_hours():
    # 1 GPU for 3600 s = 1 GPU-hour
    assert seconds_to_gpu_hours(3600.0, 1.0) == 1.0
    # 2 GPUs for 3600 s = 2 GPU-hours
    assert seconds_to_gpu_hours(3600.0, 2.0) == 2.0


def test_gpu_hours_to_seconds():
    assert gpu_hours_to_seconds(1.0, 1.0) == 3600.0
    assert gpu_hours_to_seconds(2.0, 2.0) == 3600.0


def test_zero_gpu_count_returns_zero():
    assert seconds_to_gpu_hours(3600.0, 0) == 0.0

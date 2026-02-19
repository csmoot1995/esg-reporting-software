"""Water and WUE calculation tests."""
import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from services.telemetry.src.calculations import water as calc_water


def test_total_water_withdrawal():
    assert calc_water.total_water_withdrawal(8000.0) == 8000.0


def test_water_consumed_vs_returned():
    consumed, returned = calc_water.water_consumed_vs_returned(1000.0, 400.0, None)
    assert consumed == 600.0
    assert returned == 400.0


def test_reclaimed_water_pct():
    assert calc_water.reclaimed_water_pct(1600.0, 8000.0) == 20.0


def test_reclaimed_water_pct_zero_withdrawal():
    assert calc_water.reclaimed_water_pct(100.0, 0) == 0.0


def test_wue():
    # 8000 L / 1000 kWh = 8 L/kWh
    assert calc_water.wue(8000.0, 1000.0) == 8.0


def test_wue_zero_it_energy():
    assert calc_water.wue(100.0, 0) == 0.0


def test_water_per_gpu_hour():
    assert calc_water.water_per_gpu_hour(8000.0, 200.0) == 40.0


def test_water_per_training_run():
    assert calc_water.water_per_training_run(8000.0, 4) == 2000.0


def test_cooling_tower_metrics():
    evap, blow = calc_water.cooling_tower_metrics(1200.0, 400.0)
    assert evap == 1200.0
    assert blow == 400.0


def test_regional_water_stress_weight():
    assert calc_water.regional_water_stress_weight("default") == 1.0
    assert calc_water.regional_water_stress_weight("high") == 1.3

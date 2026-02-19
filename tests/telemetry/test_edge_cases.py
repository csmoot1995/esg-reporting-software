"""Edge cases: zero load, extreme load."""
import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from services.telemetry.src.calculations import carbon, water, efficiency


def test_carbon_per_gpu_hour_zero_gpu_hours():
    assert carbon.carbon_per_gpu_hour(100.0, 0) == 0.0


def test_carbon_per_training_run_zero_runs():
    assert carbon.carbon_per_training_run(100.0, 0) == 0.0


def test_wue_zero_it_energy():
    assert water.wue(1000.0, 0) == 0.0


def test_pue_zero_it_energy():
    assert efficiency.pue(100.0, 0) == 0.0


def test_water_per_gpu_hour_zero_gpu_hours():
    assert water.water_per_gpu_hour(1000.0, 0) == 0.0


def test_extreme_load_high_pue():
    # Very inefficient: 10000 facility, 1000 IT -> PUE 10
    assert efficiency.pue(10000.0, 1000.0) == 10.0


def test_extreme_carbon_per_gpu_hour():
    assert carbon.carbon_per_gpu_hour(10000.0, 1.0) == 10000.0

"""PUE, DCiE, and efficiency calculation tests."""
import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from services.telemetry.src.calculations import efficiency as calc_eff


def test_pue():
    # 1200 total / 1000 IT = 1.2
    assert calc_eff.pue(1200.0, 1000.0) == 1.2


def test_pue_zero_it_returns_zero():
    assert calc_eff.pue(1200.0, 0) == 0.0


def test_dcie():
    # 1/1.2
    assert calc_eff.dcie(1200.0, 1000.0) == pytest.approx(0.8333, rel=1e-3)


def test_energy_per_gpu_hour():
    assert calc_eff.energy_per_gpu_hour(1000.0, 200.0) == 5.0


def test_energy_per_training_run():
    assert calc_eff.energy_per_training_run(1000.0, 4) == 250.0


def test_cooling_energy_pct():
    assert calc_eff.cooling_energy_pct(1200.0, 180.0) == 15.0


def test_chiller_cop():
    assert calc_eff.chiller_cop(180.0, 60.0) == 3.0


def test_chiller_cop_zero_energy_returns_zero():
    assert calc_eff.chiller_cop(180.0, 0) == 0.0

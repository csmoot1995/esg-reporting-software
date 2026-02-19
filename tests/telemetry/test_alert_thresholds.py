"""Alert threshold validation."""
import os
import sys
import pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from services.telemetry.src import alerts


def test_carbon_intensity_alert_above_threshold():
    out = alerts.evaluate_carbon_intensity(0.7, None)  # above default 0.6
    assert len(out) >= 1
    assert any(a["metric"] == "grid_carbon_intensity" for a in out)


def test_carbon_per_gpu_hour_alert_above_threshold():
    out = alerts.evaluate_carbon_intensity(None, 6.0)  # above default 5.0
    assert len(out) >= 1
    assert any(a["metric"] == "carbon_per_gpu_hour" for a in out)


def test_wue_alert_above_threshold():
    out = alerts.evaluate_water(2.5, None, None)  # above default 2.0
    assert len(out) >= 1
    assert any(a["metric"] == "wue" for a in out)


def test_pue_alert_above_threshold():
    out = alerts.evaluate_cooling(2.5, None, None)  # above default 2.0
    assert len(out) >= 1
    assert any(a["metric"] == "pue" for a in out)


def test_no_alert_when_below_threshold():
    out = alerts.evaluate_carbon_intensity(0.3, 1.0)
    assert len(out) == 0


def test_run_alert_engine_aggregates():
    out = alerts.run_alert_engine(carbon_per_gpu_hour=10.0, pue=2.5)
    assert len(out) >= 2

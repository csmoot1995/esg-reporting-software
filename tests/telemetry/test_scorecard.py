"""Sustainability scorecard tests."""
import os
import sys
import pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from services.telemetry.src import scorecard


def test_sustainability_score_components():
    out = scorecard.sustainability_score(
        carbon_per_gpu_hour=1.75,
        water_per_gpu_hour=40.0,
        pue=1.2,
        utilization_pct=75.0,
    )
    assert 0 <= out["sustainability_score"] <= 1
    assert 0 <= out["sustainability_score_100"] <= 100
    assert "components" in out
    assert "weights" in out
    assert "assumptions" in out


def test_normalize_carbon_intensity():
    assert scorecard.normalize_carbon_intensity(0) == 0.0
    assert scorecard.normalize_carbon_intensity(3.0) == 1.0  # at baseline
    assert scorecard.normalize_carbon_intensity(1.5) == 0.5


def test_normalize_pue():
    assert scorecard.normalize_pue(1.2) == 0.0  # target
    assert scorecard.normalize_pue(1.8) == 1.0  # baseline


def test_normalize_utilization():
    assert scorecard.normalize_utilization(80.0) == 1.0
    assert scorecard.normalize_utilization(40.0) == 0.5

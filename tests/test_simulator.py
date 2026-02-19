"""Tests for the ESG what-if simulator projection algorithm."""
import pytest

# Use projection module so tests run without Flask
from services.simulator.src.projection import calculate_projection


def test_projection_efficiency_and_mix():
    """Projected = current × (1 - efficiency/100) × (1 - mix_shift/100)."""
    # 100 tCO2e, 20% efficiency gain, 10% renewables shift → 100 * 0.8 * 0.9 = 72
    assert calculate_projection(100, 10, 20) == 72.0


def test_projection_efficiency_only():
    """Efficiency only: mix_shift=0 → projected = current × (1 - e)."""
    assert calculate_projection(1000, 0, 25) == 750.0


def test_projection_mix_only():
    """Mix only: efficiency=0 → projected = current × (1 - m)."""
    assert calculate_projection(1000, 30, 0) == 700.0


def test_projection_zero_footprint():
    assert calculate_projection(0, 50, 50) == 0.0


def test_projection_float_inputs():
    assert calculate_projection(100.5, 20.0, 10.0) == pytest.approx(72.36, rel=1e-2)


def test_projection_bounds_clamped():
    """Negative and out-of-range inputs are clamped to valid range."""
    assert calculate_projection(-100, 0, 0) == 0.0
    assert calculate_projection(100, 150, 0) == 0.0
    assert calculate_projection(100, 0, 100) == 0.0


def test_projection_invalid_inputs():
    """Invalid types raise TypeError or ValueError."""
    with pytest.raises((TypeError, ValueError)):
        calculate_projection(None, 10, 20)

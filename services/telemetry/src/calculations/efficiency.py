"""
Efficiency metrics: PUE, DCiE, energy per compute workload, cooling energy %, chiller COP.
"""
from __future__ import annotations

from ..units import normalize_energy, seconds_to_gpu_hours


def pue(total_facility_kwh: float, it_kwh: float) -> float:
    """
    PUE = Total facility energy (kWh) / IT equipment energy (kWh).
    If it_kwh <= 0, return 0 to avoid division by zero.
    """
    if it_kwh is None or it_kwh <= 0:
        return 0.0
    return round(float(total_facility_kwh) / float(it_kwh), 4)


def dcie(total_facility_kwh: float, it_kwh: float) -> float:
    """DCiE = 1 / PUE = IT energy / Total facility energy. Percentage-style 0-100 if desired; we return ratio."""
    if total_facility_kwh is None or total_facility_kwh <= 0:
        return 0.0
    return round(float(it_kwh) / float(total_facility_kwh), 4)


def energy_per_gpu_hour(total_it_kwh: float, gpu_hours: float) -> float:
    """kWh per GPU-hour. If gpu_hours <= 0, return 0."""
    if gpu_hours is None or gpu_hours <= 0:
        return 0.0
    return round(float(total_it_kwh) / float(gpu_hours), 6)


def energy_per_training_run(total_it_kwh: float, training_runs: int) -> float:
    """kWh per training run."""
    if not training_runs or training_runs <= 0:
        return 0.0
    return round(float(total_it_kwh) / training_runs, 6)


def cooling_energy_pct(total_facility_kwh: float, cooling_kwh: float) -> float:
    """Cooling energy as percentage of total facility energy."""
    if total_facility_kwh is None or total_facility_kwh <= 0:
        return 0.0
    return round(100.0 * float(cooling_kwh or 0) / float(total_facility_kwh), 2)


def chiller_cop(cooling_kwh: float, chiller_energy_kwh: float) -> float:
    """Chiller COP = cooling effect (kWh) / chiller energy input (kWh)."""
    if chiller_energy_kwh is None or chiller_energy_kwh <= 0:
        return 0.0
    return round(float(cooling_kwh or 0) / float(chiller_energy_kwh), 4)

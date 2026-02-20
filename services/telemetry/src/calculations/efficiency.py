"""
Efficiency metrics: PUE, DCiE, energy per workload unit, cooling energy %, COP.
"""
from __future__ import annotations

from ..units import normalize_energy


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


def energy_per_workload_unit(total_it_kwh: float, workload_hours: float) -> float:
    """kWh per workload-hour (e.g., GPU-hour, machine-hour, vehicle-hour). If workload_hours <= 0, return 0."""
    if workload_hours is None or workload_hours <= 0:
        return 0.0
    return round(float(total_it_kwh) / float(workload_hours), 6)


def energy_per_production_batch(total_it_kwh: float, production_units: int) -> float:
    """kWh per production unit (e.g., per mile, per item manufactured, per package delivered)."""
    if not production_units or production_units <= 0:
        return 0.0
    return round(float(total_it_kwh) / production_units, 6)


def cooling_energy_pct(total_facility_kwh: float, cooling_kwh: float) -> float:
    """Cooling energy as percentage of total facility energy."""
    if total_facility_kwh is None or total_facility_kwh <= 0:
        return 0.0
    return round(100.0 * float(cooling_kwh or 0) / float(total_facility_kwh), 2)


def cop(cooling_kwh: float, cooling_input_kwh: float) -> float:
    """Coefficient of Performance = cooling effect (kWh) / cooling energy input (kWh)."""
    if cooling_input_kwh is None or cooling_input_kwh <= 0:
        return 0.0
    return round(float(cooling_kwh or 0) / float(cooling_input_kwh), 4)


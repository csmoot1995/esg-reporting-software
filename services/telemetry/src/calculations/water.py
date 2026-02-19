"""
Water calculations: withdrawal, consumed, reclaimed %, WUE, water per GPU-hour, per training run,
cooling tower (evaporation, blowdown), regional water stress weighting.
"""
from __future__ import annotations

from ..units import normalize_water, seconds_to_gpu_hours

# Regional water stress multipliers (higher = more stressed; multiply water intensity for reporting)
WATER_STRESS_WEIGHTS: dict[str, float] = {
    "default": 1.0,
    "low": 0.8,
    "medium": 1.0,
    "high": 1.3,
    "critical": 1.5,
}


def total_water_withdrawal(withdrawal_liters: float | None, unit: str = "liters") -> float:
    """Total water withdrawal in liters."""
    if withdrawal_liters is None:
        return 0.0
    return round(normalize_water(float(withdrawal_liters), unit), 4)


def water_consumed_vs_returned(
    withdrawal_liters: float | None,
    returned_liters: float | None,
    consumed_liters: float | None,
    unit: str = "liters",
) -> tuple[float, float]:
    """Return (consumed_liters, returned_liters). If consumed not provided, consumed = withdrawal - returned."""
    w = normalize_water(float(withdrawal_liters or 0), unit)
    r = normalize_water(float(returned_liters or 0), unit)
    if consumed_liters is not None:
        c = normalize_water(float(consumed_liters), unit)
    else:
        c = max(0.0, w - r)
    return (round(c, 4), round(r, 4))


def reclaimed_water_pct(reclaimed_liters: float | None, withdrawal_liters: float | None, unit: str = "liters") -> float:
    """Reclaimed water as percentage of withdrawal. 0 if withdrawal is 0."""
    if withdrawal_liters is None or float(withdrawal_liters) <= 0:
        return 0.0
    w = normalize_water(float(withdrawal_liters), unit)
    rec = normalize_water(float(reclaimed_liters or 0), unit)
    return round(100.0 * rec / w, 2)


def wue(total_cooling_water_liters: float, it_energy_kwh: float) -> float:
    """
    Water Usage Effectiveness = Total water used for cooling (L) / IT energy (kWh).
    L/kWh. If it_energy_kwh <= 0, return 0.
    """
    if it_energy_kwh is None or it_energy_kwh <= 0:
        return 0.0
    return round(float(total_cooling_water_liters) / float(it_energy_kwh), 6)


def water_per_gpu_hour(total_water_liters: float, gpu_hours: float) -> float:
    """Liters per GPU-hour. If gpu_hours <= 0, return 0."""
    if gpu_hours is None or gpu_hours <= 0:
        return 0.0
    return round(float(total_water_liters) / float(gpu_hours), 6)


def water_per_training_run(total_water_liters: float, training_runs: int) -> float:
    """Liters per training run. If runs <= 0, return 0."""
    if not training_runs or training_runs <= 0:
        return 0.0
    return round(float(total_water_liters) / training_runs, 6)


def cooling_tower_metrics(
    evaporation_liters: float | None,
    blowdown_liters: float | None,
    unit: str = "liters",
) -> tuple[float, float]:
    """Cooling tower: evaporation and blowdown in liters."""
    evap = round(normalize_water(float(evaporation_liters or 0), unit), 4)
    blow = round(normalize_water(float(blowdown_liters or 0), unit), 4)
    return (evap, blow)


def regional_water_stress_weight(region: str | None) -> float:
    """Return multiplier for regional water stress (for weighted intensity)."""
    key = (region or "default").strip().lower() or "default"
    return WATER_STRESS_WEIGHTS.get(key, WATER_STRESS_WEIGHTS["default"])

"""
Hardware & Scope 3: asset registry, embodied carbon amortization, utilization %, idle rate %.
"""
from __future__ import annotations
from .. import emission_factors
from ..calculations.carbon import embodied_carbon_per_workload_hour


def utilization_pct(value: float | None) -> float:
    """Clamp utilization to 0-100."""
    if value is None:
        return 0.0
    return round(max(0.0, min(100.0, float(value))), 2)


def idle_rate_pct(value: float | None) -> float:
    """Clamp idle rate to 0-100."""
    if value is None:
        return 0.0
    return round(max(0.0, min(100.0, float(value))), 2)


def embodied_carbon_amortized_per_workload_hour(
    embodied_kg_co2e: float,
    expected_lifetime_hours: float,
    asset_count: float = 1.0,
) -> float:
    """
    Amortized embodied carbon per workload-hour.
    expected_lifetime_hours = total facility operating hours over asset life;
    total workload-hours = expected_lifetime_hours * asset_count.
    """
    if expected_lifetime_hours <= 0 or asset_count <= 0:
        return 0.0
    total_workload_hours = expected_lifetime_hours * asset_count
    return embodied_carbon_per_workload_hour(embodied_kg_co2e, total_workload_hours)

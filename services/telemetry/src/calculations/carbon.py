"""
Carbon calculations: Scope 1/2, carbon per workload unit, per production unit, embodied carbon.
All use versioned emission factors; formulas reproducible with historical factors.
"""
from __future__ import annotations

from .. import emission_factors
from ..units import normalize_energy, normalize_water


def scope1_from_generator_fuel(
    fuel_liters: float,
    fuel_type: str,
    region: str | None,
    emission_factor_version: str,
    timestamp_utc: str | None = None,
) -> tuple[float, str]:
    """Scope 1 emissions from generator fuel. Returns (kg_co2e, version_used)."""
    scope = "scope1_diesel" if (fuel_type or "").lower() in ("diesel",) else "scope1_natural_gas"
    if (fuel_type or "").lower() == "natural_gas":
        # Factor is per m3; 1 m3 = 1000 liters, so convert liters to m3
        factor, version = emission_factors.get_factor(emission_factor_version, region, "scope1_natural_gas", timestamp_utc)
        # Convert liters to cubic meters (1 m3 = 1000 L)
        fuel_m3 = fuel_liters / 1000.0
        kg = fuel_m3 * factor
        return (round(kg, 6), version)
    # Diesel or default: factor is per liter
    factor, version = emission_factors.get_factor(emission_factor_version, region, "scope1_diesel", timestamp_utc)
    kg = fuel_liters * factor
    return (round(kg, 6), version)


def scope2_from_it_energy(
    it_kwh: float,
    region: str | None,
    emission_factor_version: str,
    market_based: bool = False,
    timestamp_utc: str | None = None,
) -> tuple[float, str]:
    """Scope 2 from IT energy (location-based or market-based). Returns (kg_co2e, version_used)."""
    scope = "scope2_market" if market_based else "scope2_location"
    factor, version = emission_factors.get_factor(emission_factor_version, region, scope, timestamp_utc)
    kg = it_kwh * factor
    return (round(kg, 6), version)


def carbon_per_workload_unit(
    total_kg_co2e: float,
    workload_hours: float,
) -> float:
    """Carbon per workload-hour (kg CO2e / workload-hour). If workload_hours <= 0, return 0."""
    if workload_hours <= 0:
        return 0.0
    return round(total_kg_co2e / workload_hours, 6)


def carbon_per_production_unit(
    total_kg_co2e: float,
    production_units: int,
) -> float:
    """Carbon per production unit (kg CO2e per unit). If units <= 0, return 0."""
    if production_units is None or production_units <= 0:
        return 0.0
    return round(total_kg_co2e / production_units, 6)


def embodied_carbon_per_workload_hour(
    embodied_kg_co2e: float,
    expected_lifetime_workload_hours: float,
) -> float:
    """Amortized embodied carbon per workload-hour for an asset (kg CO2e / workload-hour)."""
    if expected_lifetime_workload_hours <= 0:
        return 0.0
    return round(embodied_kg_co2e / expected_lifetime_workload_hours, 6)


def total_carbon_from_payload(
    facility_kwh: float | None,
    it_kwh: float | None,
    generator_fuel_liters: float | None,
    generator_fuel_type: str | None,
    region: str | None,
    emission_factor_version: str,
    timestamp_utc: str | None,
) -> tuple[float, float, float, str]:
    """
    Compute scope1, scope2 (location), and total kg CO2e from energy inputs.
    Returns (scope1_kg, scope2_kg, total_kg, version_used).
    """
    version = emission_factor_version or emission_factors.DEFAULT_VERSION
    scope1 = 0.0
    if generator_fuel_liters and generator_fuel_liters > 0:
        s1, version = scope1_from_generator_fuel(
            generator_fuel_liters, generator_fuel_type or "diesel", region, version, timestamp_utc
        )
        scope1 = s1
    scope2 = 0.0
    # Only use IT energy for scope2, never facility energy (which includes cooling)
    if it_kwh is not None and it_kwh > 0:
        s2, version = scope2_from_it_energy(it_kwh, region, version, market_based=False, timestamp_utc=timestamp_utc)
        scope2 = s2
    total = scope1 + scope2
    return (scope1, scope2, round(total, 6), version)

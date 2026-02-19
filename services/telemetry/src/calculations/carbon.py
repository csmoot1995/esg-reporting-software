"""
Carbon calculations: Scope 1/2, carbon per GPU-hour, per training run, per inference, embodied.
All use versioned emission factors; formulas reproducible with historical factors.
"""
from __future__ import annotations

from .. import emission_factors
from ..units import seconds_to_gpu_hours, normalize_energy, normalize_water


def scope1_from_generator_fuel(
    fuel_liters: float,
    fuel_type: str,
    region: str | None,
    emission_factor_version: str,
    timestamp_utc: str | None = None,
) -> tuple[float, str]:
    """Scope 1 emissions from generator fuel. Returns (kg_co2e, version_used)."""
    scope = "scope1_diesel" if (fuel_type or "").lower() in ("diesel",) else "scope1_natural_gas"
    factor, version = emission_factors.get_factor(emission_factor_version, region, scope, timestamp_utc)
    if (fuel_type or "").lower() == "natural_gas":
        # Factor is per m3; assume 1 m3 ≈ 1 liter for simplicity (in reality convert)
        factor, version = emission_factors.get_factor(emission_factor_version, region, "scope1_natural_gas", timestamp_utc)
        # Typical NG: ~2 kg CO2e/m3; 1 m3 = 1000 L so per liter = 0.002 (simplified)
        factor = factor / 1000.0
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


def carbon_per_gpu_hour(
    total_kg_co2e: float,
    gpu_hours: float,
) -> float:
    """Carbon per GPU-hour (kg CO2e / GPU-hour). If gpu_hours <= 0, return 0."""
    if gpu_hours <= 0:
        return 0.0
    return round(total_kg_co2e / gpu_hours, 6)


def carbon_per_training_run(
    total_kg_co2e: float,
    training_runs: int,
) -> float:
    """Carbon per training run (kg CO2e per run). If runs <= 0, return 0."""
    if not training_runs or training_runs <= 0:
        return 0.0
    return round(total_kg_co2e / training_runs, 6)


def carbon_per_inference_request(
    total_kg_co2e: float,
    inference_requests: int,
) -> float:
    """Carbon per inference request (kg CO2e per request). If requests <= 0, return 0."""
    if not inference_requests or inference_requests <= 0:
        return 0.0
    return round(total_kg_co2e / inference_requests, 6)


def embodied_carbon_per_hardware_asset(
    embodied_kg_co2e: float,
    expected_lifetime_gpu_hours: float,
) -> float:
    """Amortized embodied carbon per GPU-hour for an asset (kg CO2e / GPU-hour)."""
    if expected_lifetime_gpu_hours <= 0:
        return 0.0
    return round(embodied_kg_co2e / expected_lifetime_gpu_hours, 6)


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
    it = it_kwh if it_kwh is not None else facility_kwh
    if it and it > 0:
        s2, version = scope2_from_it_energy(it, region, version, market_based=False, timestamp_utc=timestamp_utc)
        scope2 = s2
    total = scope1 + scope2
    return (scope1, scope2, round(total, 6), version)

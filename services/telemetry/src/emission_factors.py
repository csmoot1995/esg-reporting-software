"""
Versioned emission factor store. All carbon calculations use explicitly versioned factors
for reproducibility. Factors loaded from data/emission_factors/ (JSON).
"""
from __future__ import annotations
import json
import os
from datetime import datetime, timezone
from typing import Any

# Default factors (used when no file or fallback)
DEFAULT_VERSION = "v1"
DEFAULT_LOCATION_BASED_KG_CO2E_PER_KWH = 0.5
DEFAULT_MARKET_BASED_KG_CO2E_PER_KWH = 0.45
DEFAULT_DIESEL_KG_CO2E_PER_LITER = 2.68
DEFAULT_NATURAL_GAS_KG_CO2E_PER_M3 = 2.0  # approx; m3 not liters

_factor_store: dict[str, dict[str, Any]] = {}
_loaded = False


def _data_dir() -> str:
    base = os.environ.get("TELEMETRY_DATA_DIR", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base, "data", "emission_factors")


def _load_factors() -> None:
    global _loaded, _factor_store
    if _loaded:
        return
    _loaded = True
    dd = _data_dir()
    if not os.path.isdir(dd):
        _factor_store[DEFAULT_VERSION] = _default_factors()
        return
    for name in os.listdir(dd):
        if name.endswith(".json"):
            path = os.path.join(dd, name)
            try:
                with open(path, "r") as f:
                    data = json.load(f)
                version = data.get("version_id", name.replace(".json", ""))
                _factor_store[version] = data
            except Exception:
                continue
    if DEFAULT_VERSION not in _factor_store:
        _factor_store[DEFAULT_VERSION] = _default_factors()


def _default_factors() -> dict[str, Any]:
    return {
        "version_id": DEFAULT_VERSION,
        "valid_from": "2020-01-01T00:00:00Z",
        "valid_to": "2030-12-31T23:59:59Z",
        "location_based_kg_co2e_per_kwh": DEFAULT_LOCATION_BASED_KG_CO2E_PER_KWH,
        "market_based_kg_co2e_per_kwh": DEFAULT_MARKET_BASED_KG_CO2E_PER_KWH,
        "diesel_kg_co2e_per_liter": DEFAULT_DIESEL_KG_CO2E_PER_LITER,
        "natural_gas_kg_co2e_per_m3": DEFAULT_NATURAL_GAS_KG_CO2E_PER_M3,
        "regions": {},
    }


def get_factor(
    version_id: str,
    region: str | None,
    scope: str,
    timestamp_utc: datetime | str | None = None,
) -> tuple[float, str]:
    """
    Return (factor_value, version_id) for the given scope.
    scope: "scope1_diesel", "scope1_natural_gas", "scope2_location", "scope2_market",
           "grid_intensity" (kg CO2e per kWh).
    """
    _load_factors()
    version_id = version_id or DEFAULT_VERSION
    if version_id not in _factor_store:
        version_id = DEFAULT_VERSION
    factors = _factor_store[version_id]
    ts = timestamp_utc
    if isinstance(ts, str):
        try:
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            ts = datetime.now(timezone.utc)
    if ts is None:
        ts = datetime.now(timezone.utc)

    if scope == "scope2_location" or scope == "grid_intensity":
        region_key = (region or "default").strip() or "default"
        regions = factors.get("regions") or {}
        if region_key in regions and "location_based_kg_co2e_per_kwh" in regions[region_key]:
            return float(regions[region_key]["location_based_kg_co2e_per_kwh"]), version_id
        return float(factors.get("location_based_kg_co2e_per_kwh", DEFAULT_LOCATION_BASED_KG_CO2E_PER_KWH)), version_id
    if scope == "scope2_market":
        region_key = (region or "default").strip() or "default"
        regions = factors.get("regions") or {}
        if region_key in regions and "market_based_kg_co2e_per_kwh" in regions[region_key]:
            return float(regions[region_key]["market_based_kg_co2e_per_kwh"]), version_id
        return float(factors.get("market_based_kg_co2e_per_kwh", DEFAULT_MARKET_BASED_KG_CO2E_PER_KWH)), version_id
    if scope == "scope1_diesel":
        return float(factors.get("diesel_kg_co2e_per_liter", DEFAULT_DIESEL_KG_CO2E_PER_LITER)), version_id
    if scope == "scope1_natural_gas":
        return float(factors.get("natural_gas_kg_co2e_per_m3", DEFAULT_NATURAL_GAS_KG_CO2E_PER_M3)), version_id
    if scope == "scope1":
        return float(factors.get("diesel_kg_co2e_per_liter", DEFAULT_DIESEL_KG_CO2E_PER_LITER)), version_id
    return float(factors.get("location_based_kg_co2e_per_kwh", DEFAULT_LOCATION_BASED_KG_CO2E_PER_KWH)), version_id


def get_version_metadata(version_id: str) -> dict[str, Any]:
    """Return full metadata for a factor version (valid_from, valid_to, etc.)."""
    _load_factors()
    vid = version_id or DEFAULT_VERSION
    if vid not in _factor_store:
        vid = DEFAULT_VERSION
    return dict(_factor_store.get(vid, _default_factors()))

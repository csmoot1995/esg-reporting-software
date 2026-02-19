"""
Alert engine: carbon intensity spikes, water inefficiency, cooling anomalies, sensor drift.
Thresholds configurable via env or defaults.
"""
from __future__ import annotations
import os
from datetime import datetime, timezone
from typing import Any

# Default thresholds (override with TELEMETRY_ALERT_* env vars)
def _float_env(name: str, default: float) -> float:
    v = os.environ.get(name)
    if v is None:
        return default
    try:
        return float(v)
    except ValueError:
        return default


CARBON_INTENSITY_MAX_KG_PER_KWH = _float_env("TELEMETRY_ALERT_CARBON_INTENSITY_MAX", 0.6)
CARBON_PER_GPU_HOUR_MAX = _float_env("TELEMETRY_ALERT_CARBON_PER_GPU_HOUR_MAX", 5.0)
WUE_MAX_L_PER_KWH = _float_env("TELEMETRY_ALERT_WUE_MAX", 2.0)
WATER_PER_GPU_HOUR_MAX = _float_env("TELEMETRY_ALERT_WATER_PER_GPU_HOUR_MAX", 50.0)
RECLAIMED_WATER_MIN_PCT = _float_env("TELEMETRY_ALERT_RECLAIMED_WATER_MIN_PCT", 20.0)
PUE_MAX = _float_env("TELEMETRY_ALERT_PUE_MAX", 2.0)
COOLING_ENERGY_PCT_MAX = _float_env("TELEMETRY_ALERT_COOLING_ENERGY_PCT_MAX", 50.0)
CHILLER_COP_MIN = _float_env("TELEMETRY_ALERT_CHILLER_COP_MIN", 2.0)
DRIFT_TOLERANCE_PCT = _float_env("TELEMETRY_ALERT_DRIFT_TOLERANCE_PCT", 15.0)


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def evaluate_carbon_intensity(grid_kg_per_kwh: float | None, carbon_per_gpu_hour: float | None) -> list[dict[str, Any]]:
    alerts = []
    if grid_kg_per_kwh is not None and grid_kg_per_kwh > CARBON_INTENSITY_MAX_KG_PER_KWH:
        alerts.append({
            "metric": "grid_carbon_intensity",
            "value": grid_kg_per_kwh,
            "threshold": CARBON_INTENSITY_MAX_KG_PER_KWH,
            "severity": "CRITICAL",
            "timestamp": _ts(),
        })
    if carbon_per_gpu_hour is not None and carbon_per_gpu_hour > CARBON_PER_GPU_HOUR_MAX:
        alerts.append({
            "metric": "carbon_per_gpu_hour",
            "value": carbon_per_gpu_hour,
            "threshold": CARBON_PER_GPU_HOUR_MAX,
            "severity": "CRITICAL",
            "timestamp": _ts(),
        })
    return alerts


def evaluate_water(wue_l_per_kwh: float | None, water_per_gpu_hour: float | None, reclaimed_pct: float | None) -> list[dict[str, Any]]:
    alerts = []
    if wue_l_per_kwh is not None and wue_l_per_kwh > WUE_MAX_L_PER_KWH:
        alerts.append({
            "metric": "wue",
            "value": wue_l_per_kwh,
            "threshold": WUE_MAX_L_PER_KWH,
            "severity": "WARNING",
            "timestamp": _ts(),
        })
    if water_per_gpu_hour is not None and water_per_gpu_hour > WATER_PER_GPU_HOUR_MAX:
        alerts.append({
            "metric": "water_per_gpu_hour",
            "value": water_per_gpu_hour,
            "threshold": WATER_PER_GPU_HOUR_MAX,
            "severity": "WARNING",
            "timestamp": _ts(),
        })
    if reclaimed_pct is not None and reclaimed_pct < RECLAIMED_WATER_MIN_PCT and reclaimed_pct >= 0:
        alerts.append({
            "metric": "reclaimed_water_pct",
            "value": reclaimed_pct,
            "threshold_min": RECLAIMED_WATER_MIN_PCT,
            "severity": "WARNING",
            "timestamp": _ts(),
        })
    return alerts


def evaluate_cooling(pue: float | None, cooling_energy_pct: float | None, chiller_cop: float | None) -> list[dict[str, Any]]:
    alerts = []
    if pue is not None and pue > PUE_MAX:
        alerts.append({
            "metric": "pue",
            "value": pue,
            "threshold": PUE_MAX,
            "severity": "WARNING",
            "timestamp": _ts(),
        })
    if cooling_energy_pct is not None and cooling_energy_pct > COOLING_ENERGY_PCT_MAX:
        alerts.append({
            "metric": "cooling_energy_pct",
            "value": cooling_energy_pct,
            "threshold": COOLING_ENERGY_PCT_MAX,
            "severity": "WARNING",
            "timestamp": _ts(),
        })
    if chiller_cop is not None and chiller_cop < CHILLER_COP_MIN and chiller_cop > 0:
        alerts.append({
            "metric": "chiller_cop",
            "value": chiller_cop,
            "threshold_min": CHILLER_COP_MIN,
            "severity": "WARNING",
            "timestamp": _ts(),
        })
    return alerts


def evaluate_sensor_drift(drift_flag: bool) -> list[dict[str, Any]]:
    alerts = []
    if drift_flag:
        alerts.append({
            "metric": "sensor_drift",
            "value": True,
            "severity": "WARNING",
            "timestamp": _ts(),
        })
    return alerts


def run_alert_engine(
    grid_carbon_intensity: float | None = None,
    carbon_per_gpu_hour: float | None = None,
    wue: float | None = None,
    water_per_gpu_hour: float | None = None,
    reclaimed_water_pct: float | None = None,
    pue: float | None = None,
    cooling_energy_pct: float | None = None,
    chiller_cop: float | None = None,
    drift_detected: bool = False,
) -> list[dict[str, Any]]:
    """Run all alert checks; return combined list of alert details."""
    out = []
    out.extend(evaluate_carbon_intensity(grid_carbon_intensity, carbon_per_gpu_hour))
    out.extend(evaluate_water(wue, water_per_gpu_hour, reclaimed_water_pct))
    out.extend(evaluate_cooling(pue, cooling_energy_pct, chiller_cop))
    out.extend(evaluate_sensor_drift(drift_detected))
    return out

"""
Sustainability Scorecard: composite index from carbon, water, efficiency, and hardware utilization.
Score = w_c * C_norm + w_w * W_norm + w_e * PUE_norm + w_h * U_norm.
Normalization assumptions documented; weights configurable.
"""
from __future__ import annotations
import os
from typing import Any

# Normalization baselines (worse than baseline = higher normalized value; we invert so lower is better for score)
# Score formula: we use (1 - normalized) so that better performance -> higher score component.
CARBON_PER_GPU_HOUR_BASELINE = 3.0   # kg CO2e/GPU-h above this -> worse
WATER_PER_GPU_HOUR_BASELINE = 40.0   # L/GPU-h above this -> worse
PUE_BASELINE = 1.8                   # PUE above this -> worse
PUE_TARGET = 1.2                     # Best; linear scale between target and baseline
UTILIZATION_TARGET = 80.0            # Higher utilization -> better (we use utilization as positive)


def _float_env(name: str, default: float) -> float:
    v = os.environ.get(name)
    if v is None:
        return default
    try:
        return float(v)
    except ValueError:
        return default


def get_weights() -> tuple[float, float, float, float]:
    """Return (w_carbon, w_water, w_efficiency, w_hardware). Sum should be 1.0."""
    wc = _float_env("TELEMETRY_SCORECARD_WEIGHT_CARBON", 0.35)
    ww = _float_env("TELEMETRY_SCORECARD_WEIGHT_WATER", 0.25)
    we = _float_env("TELEMETRY_SCORECARD_WEIGHT_EFFICIENCY", 0.25)
    wh = _float_env("TELEMETRY_SCORECARD_WEIGHT_HARDWARE", 0.15)
    total = wc + ww + we + wh
    if total <= 0:
        return (0.35, 0.25, 0.25, 0.15)
    return (wc / total, ww / total, we / total, wh / total)


def normalize_carbon_intensity(carbon_per_gpu_hour: float | None) -> float:
    """
    Normalized carbon intensity 0-1. 0 = best (low carbon), 1 = worst.
    Linear: 0 kg -> 0, at BASELINE -> 1, above capped at 1.
    """
    if carbon_per_gpu_hour is None or carbon_per_gpu_hour <= 0:
        return 0.0
    if carbon_per_gpu_hour >= CARBON_PER_GPU_HOUR_BASELINE:
        return 1.0
    return round(carbon_per_gpu_hour / CARBON_PER_GPU_HOUR_BASELINE, 4)


def normalize_water_intensity(water_per_gpu_hour: float | None) -> float:
    """Normalized water intensity 0-1. 0 = best, at/above BASELINE = 1."""
    if water_per_gpu_hour is None or water_per_gpu_hour <= 0:
        return 0.0
    if water_per_gpu_hour >= WATER_PER_GPU_HOUR_BASELINE:
        return 1.0
    return round(water_per_gpu_hour / WATER_PER_GPU_HOUR_BASELINE, 4)


def normalize_pue(pue: float | None) -> float:
    """
    Normalized PUE 0-1. 0 = best (PUE at target 1.2), 1 = worst (at or above baseline 1.8).
    Linear between PUE_TARGET and PUE_BASELINE.
    """
    if pue is None or pue <= 0:
        return 1.0  # missing data treated as worst
    if pue <= PUE_TARGET:
        return 0.0
    if pue >= PUE_BASELINE:
        return 1.0
    return round((pue - PUE_TARGET) / (PUE_BASELINE - PUE_TARGET), 4)


def normalize_utilization(utilization_pct: float | None) -> float:
    """
    Utilization factor for score: higher utilization = better.
    Return 0-1 where 1 = at or above TARGET (80%), 0 = 0% utilization.
    """
    if utilization_pct is None or utilization_pct <= 0:
        return 0.0
    if utilization_pct >= UTILIZATION_TARGET:
        return 1.0
    return round(utilization_pct / UTILIZATION_TARGET, 4)


def sustainability_score(
    carbon_per_gpu_hour: float | None = None,
    water_per_gpu_hour: float | None = None,
    pue: float | None = None,
    utilization_pct: float | None = None,
    weight_carbon: float | None = None,
    weight_water: float | None = None,
    weight_efficiency: float | None = None,
    weight_hardware: float | None = None,
) -> dict[str, Any]:
    """
    Compute Sustainability Score = (w_c * (1 - C_norm) + w_w * (1 - W_norm) + w_e * (1 - PUE_norm) + w_h * U_norm).
    So higher score = more sustainable. Each component 0-1; total score 0-1 (then we can scale 0-100).
    We use (1 - C_norm) so lower carbon -> higher contribution.
    """
    wc, ww, we, wh = get_weights()
    if weight_carbon is not None:
        wc = weight_carbon
    if weight_water is not None:
        ww = weight_water
    if weight_efficiency is not None:
        we = weight_efficiency
    if weight_hardware is not None:
        wh = weight_hardware
    total_w = wc + ww + we + wh
    if total_w <= 0:
        total_w = 1.0
    wc, ww, we, wh = wc / total_w, ww / total_w, we / total_w, wh / total_w

    c_norm = normalize_carbon_intensity(carbon_per_gpu_hour)
    w_norm = normalize_water_intensity(water_per_gpu_hour)
    pue_norm = normalize_pue(pue)
    u_norm = normalize_utilization(utilization_pct)

    # Score: (1 - c_norm) so lower carbon is better; same for water and PUE. Utilization already higher=better.
    score = wc * (1.0 - c_norm) + ww * (1.0 - w_norm) + we * (1.0 - pue_norm) + wh * u_norm
    score = round(min(1.0, max(0.0, score)), 4)
    score_100 = round(score * 100.0, 2)

    return {
        "sustainability_score": score,
        "sustainability_score_100": score_100,
        "components": {
            "carbon_normalized": c_norm,
            "water_normalized": w_norm,
            "pue_normalized": pue_norm,
            "utilization_normalized": u_norm,
        },
        "weights": {"carbon": wc, "water": ww, "efficiency": we, "hardware": wh},
        "assumptions": {
            "carbon_baseline_kg_per_gpu_hour": CARBON_PER_GPU_HOUR_BASELINE,
            "water_baseline_l_per_gpu_hour": WATER_PER_GPU_HOUR_BASELINE,
            "pue_target": PUE_TARGET,
            "pue_baseline": PUE_BASELINE,
            "utilization_target_pct": UTILIZATION_TARGET,
        },
    }

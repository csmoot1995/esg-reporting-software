"""
Data quality meta-telemetry: completeness %, latency, outlier flag, drift flag, confidence score.
"""
from __future__ import annotations


def data_completeness_pct(expected_samples: int, actual_samples: int) -> float:
    """Completeness = actual / expected * 100. Clamped 0-100."""
    if expected_samples <= 0:
        return 100.0
    return round(min(100.0, max(0.0, 100.0 * float(actual_samples) / float(expected_samples))), 2)


def data_latency_seconds(ingestion_time_utc: str, observation_time_utc: str) -> float:
    """Latency in seconds between observation and ingestion. Approximate from ISO strings."""
    try:
        from datetime import datetime, timezone
        ing = datetime.fromisoformat(ingestion_time_utc.replace("Z", "+00:00"))
        obs = datetime.fromisoformat(observation_time_utc.replace("Z", "+00:00"))
        if ing.tzinfo is None:
            ing = ing.replace(tzinfo=timezone.utc)
        if obs.tzinfo is None:
            obs = obs.replace(tzinfo=timezone.utc)
        delta = (ing - obs).total_seconds()
        return round(max(0.0, delta), 2)
    except Exception:
        return 0.0


def confidence_score(
    completeness_pct: float | None,
    latency_seconds: float | None,
    outlier_flag: bool | None,
    drift_flag: bool | None,
) -> float:
    """
    Composite confidence score 0-1.
    Higher completeness and lower latency increase score; outlier and drift decrease it.
    """
    c = (completeness_pct if completeness_pct is not None else 100.0) / 100.0
    # Latency: assume 300s = 0.5, 0s = 1.0
    lat = latency_seconds if latency_seconds is not None else 0.0
    lat_score = max(0.0, 1.0 - lat / 600.0)  # 10 min = 0
    out = 0.0 if (outlier_flag is True) else 1.0
    drift = 0.0 if (drift_flag is True) else 1.0
    score = (c * 0.4 + lat_score * 0.3 + out * 0.15 + drift * 0.15)
    return round(min(1.0, max(0.0, score)), 4)


def outlier_detection_flag(value: float, mean: float, std: float, z_threshold: float = 3.0) -> bool:
    """Simple z-score outlier: True if |z| > threshold (when std > 0)."""
    if std is None or std <= 0:
        return False
    z = abs((value - mean) / std)
    return z > z_threshold


def drift_detection_flag(
    recent_mean: float,
    baseline_mean: float,
    tolerance_pct: float = 15.0,
) -> bool:
    """True if recent mean has shifted from baseline by more than tolerance_pct."""
    if baseline_mean is None or baseline_mean == 0:
        return False
    change_pct = 100.0 * abs(recent_mean - baseline_mean) / float(baseline_mean)
    return change_pct > tolerance_pct

"""
Core internal entities for telemetry: metric types and lineage/audit metadata.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any

from .units import ENERGY_CANONICAL, WATER_CANONICAL, CARBON_CANONICAL


@dataclass
class LineageRef:
    """Reference for data lineage: metric -> source traceability."""
    raw_payload_id: str
    source_id: str
    ingestion_request_id: str | None
    emission_factor_version: str
    derived_from: list[str] = field(default_factory=list)
    calculation_step: str = ""


@dataclass
class TelemetryPoint:
    """Base for a single telemetry observation."""
    metric_type: str
    value: float
    unit: str
    asset_id: str | None
    region: str | None
    timestamp_utc: str
    lineage: LineageRef | None = None


@dataclass
class CarbonMetric(TelemetryPoint):
    """Carbon-related metric (scope 1/2, per GPU-hour, per run, etc.)."""
    scope: str | None = None  # "scope1", "scope2_location", "scope2_market", etc.
    emission_factor_version: str = ""


@dataclass
class WaterMetric(TelemetryPoint):
    """Water metric (withdrawal, consumed, WUE, per GPU-hour, etc.)."""
    pass


@dataclass
class EfficiencyMetric(TelemetryPoint):
    """Efficiency metric (PUE, DCiE, cooling %, etc.)."""
    pass


@dataclass
class HardwareMetric(TelemetryPoint):
    """Hardware utilization, idle rate, embodied carbon amortized."""
    pass


@dataclass
class DataQualityMetric(TelemetryPoint):
    """Data quality meta-telemetry: completeness, latency, outlier, drift, confidence."""
    pass

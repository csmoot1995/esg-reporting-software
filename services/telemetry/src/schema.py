"""
Strict schema validation for telemetry ingestion. All payloads validated before processing.
"""
from __future__ import annotations
from typing import Any, Optional

from pydantic import BaseModel, Field, model_validator


class EnergyBlock(BaseModel):
    """Energy measurements (canonical: kWh)."""
    facility_kwh: Optional[float] = Field(None, ge=0)
    it_kwh: Optional[float] = Field(None, ge=0)
    cooling_kwh: Optional[float] = Field(None, ge=0)
    generator_fuel_liters: Optional[float] = Field(None, ge=0)
    generator_fuel_type: Optional[str] = None
    energy_unit: str = "kWh"


class CarbonBlock(BaseModel):
    """Carbon inputs (optional if derived from energy + factors)."""
    scope1_kg_co2e: Optional[float] = Field(None, ge=0)
    scope2_location_kg_co2e: Optional[float] = Field(None, ge=0)
    scope2_market_kg_co2e: Optional[float] = Field(None, ge=0)
    grid_carbon_intensity_kg_per_kwh: Optional[float] = Field(None, ge=0)
    carbon_unit: str = "kg_co2e"


class WaterBlock(BaseModel):
    """Water measurements (canonical: liters)."""
    withdrawal_liters: Optional[float] = Field(None, ge=0)
    returned_liters: Optional[float] = Field(None, ge=0)
    consumed_liters: Optional[float] = Field(None, ge=0)
    reclaimed_liters: Optional[float] = Field(None, ge=0)
    evaporation_liters: Optional[float] = Field(None, ge=0)
    blowdown_liters: Optional[float] = Field(None, ge=0)
    water_unit: str = "liters"


class ComputeBlock(BaseModel):
    """Compute workload for normalization (GPU-hours, runs, inference)."""
    gpu_hours: Optional[float] = Field(None, ge=0)
    gpu_count: Optional[float] = Field(None, ge=0)
    run_duration_seconds: Optional[float] = Field(None, ge=0)
    run_type: Optional[str] = None
    training_runs: Optional[int] = Field(None, ge=0)
    inference_requests: Optional[int] = Field(None, ge=0)


class HardwareBlock(BaseModel):
    """Hardware utilization and state."""
    utilization_pct: Optional[float] = Field(None, ge=0, le=100)
    idle_rate_pct: Optional[float] = Field(None, ge=0, le=100)
    asset_state: Optional[str] = None


class DataQualityBlock(BaseModel):
    """Optional data quality meta from edge."""
    completeness_pct: Optional[float] = Field(None, ge=0, le=100)
    latency_seconds: Optional[float] = Field(None, ge=0)
    outlier_flag: Optional[bool] = None
    drift_flag: Optional[bool] = None
    confidence_score: Optional[float] = Field(None, ge=0, le=1)


class TelemetryIngestPayload(BaseModel):
    """Root schema for POST /ingest. Strict typing; unknown fields ignored by default."""
    timestamp: str
    asset_id: Optional[str] = None
    region: Optional[str] = None
    industry_vertical: Optional[str] = None
    workload_id: Optional[str] = None
    workload_value: Optional[float] = Field(None, ge=0)
    workload_unit: Optional[str] = None
    external_event_id: Optional[str] = None
    source_id: Optional[str] = None
    energy: Optional[EnergyBlock] = None
    carbon: Optional[CarbonBlock] = None
    water: Optional[WaterBlock] = None
    compute: Optional[ComputeBlock] = None
    hardware: Optional[HardwareBlock] = None
    data_quality: Optional[DataQualityBlock] = None
    emission_factor_version: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None

    @model_validator(mode="after")
    def at_least_one_block(self) -> "TelemetryIngestPayload":
        if not any([
            self.energy,
            self.carbon,
            self.water,
            self.compute,
            self.hardware,
            self.data_quality,
        ]):
            raise ValueError("At least one of energy, carbon, water, compute, hardware, or data_quality must be present")
        return self


def validate_ingest_payload(data: dict[str, Any]) -> TelemetryIngestPayload:
    """Validate raw dict against TelemetryIngestPayload. Raises pydantic.ValidationError on failure."""
    return TelemetryIngestPayload.model_validate(data)

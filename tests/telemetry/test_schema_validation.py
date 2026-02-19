"""Schema validation tests for telemetry ingestion."""
import pytest
from pydantic import ValidationError

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from services.telemetry.src.schema import validate_ingest_payload, TelemetryIngestPayload, EnergyBlock


def test_valid_minimal_payload():
    """At least one block required; energy-only is valid."""
    payload = validate_ingest_payload({
        "timestamp": "2024-06-15T12:00:00Z",
        "energy": {"facility_kwh": 100.0, "it_kwh": 80.0, "energy_unit": "kWh"},
    })
    assert payload.timestamp == "2024-06-15T12:00:00Z"
    assert payload.energy is not None
    assert payload.energy.facility_kwh == 100.0
    assert payload.energy.it_kwh == 80.0


def test_valid_full_blocks():
    """All blocks present and valid."""
    payload = validate_ingest_payload({
        "timestamp": "2024-06-15T12:00:00Z",
        "asset_id": "DC1",
        "region": "us-west",
        "source_id": "gw1",
        "external_event_id": "ev1",
        "energy": {"facility_kwh": 100.0, "it_kwh": 80.0},
        "water": {"withdrawal_liters": 500.0, "water_unit": "liters"},
        "compute": {"gpu_hours": 10.0, "gpu_count": 5},
        "hardware": {"utilization_pct": 70.0},
        "data_quality": {"confidence_score": 0.9},
    })
    assert payload.asset_id == "DC1"
    assert payload.water.withdrawal_liters == 500.0
    assert payload.compute.gpu_hours == 10.0
    assert payload.hardware.utilization_pct == 70.0


def test_reject_empty_body():
    with pytest.raises(ValidationError):
        validate_ingest_payload({})


def test_reject_missing_timestamp():
    with pytest.raises(ValidationError):
        validate_ingest_payload({
            "energy": {"facility_kwh": 100},
        })


def test_reject_no_blocks():
    with pytest.raises(ValidationError):
        validate_ingest_payload({"timestamp": "2024-06-15T12:00:00Z"})


def test_reject_negative_energy():
    with pytest.raises(ValidationError):
        validate_ingest_payload({
            "timestamp": "2024-06-15T12:00:00Z",
            "energy": {"facility_kwh": -1.0, "it_kwh": 80.0},
        })


def test_reject_utilization_over_100():
    with pytest.raises(ValidationError):
        validate_ingest_payload({
            "timestamp": "2024-06-15T12:00:00Z",
            "hardware": {"utilization_pct": 101.0},
        })


def test_accept_confidence_score_bounds():
    payload = validate_ingest_payload({
        "timestamp": "2024-06-15T12:00:00Z",
        "data_quality": {"confidence_score": 0.5},
    })
    assert payload.data_quality.confidence_score == 0.5


def test_reject_confidence_score_over_one():
    with pytest.raises(ValidationError):
        validate_ingest_payload({
            "timestamp": "2024-06-15T12:00:00Z",
            "data_quality": {"confidence_score": 1.5},
        })

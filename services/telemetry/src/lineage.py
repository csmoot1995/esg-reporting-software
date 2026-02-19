"""
Data lineage: metric -> source traceability. Every derived metric stores lineage refs.
"""
from __future__ import annotations
import json
from .models import LineageRef


def build_lineage(
    raw_payload_id: str,
    source_id: str,
    ingestion_request_id: str | None,
    emission_factor_version: str,
    derived_from: list[str] | None = None,
    calculation_step: str = "",
) -> LineageRef:
    return LineageRef(
        raw_payload_id=raw_payload_id,
        source_id=source_id,
        ingestion_request_id=ingestion_request_id,
        emission_factor_version=emission_factor_version,
        derived_from=derived_from or [],
        calculation_step=calculation_step,
    )


def lineage_to_dict(ref: LineageRef) -> dict:
    return {
        "raw_payload_id": ref.raw_payload_id,
        "source_id": ref.source_id,
        "ingestion_request_id": ref.ingestion_request_id,
        "emission_factor_version": ref.emission_factor_version,
        "derived_from": ref.derived_from,
        "calculation_step": ref.calculation_step,
    }


def lineage_from_dict(d: dict) -> LineageRef:
    return LineageRef(
        raw_payload_id=str(d.get("raw_payload_id", "")),
        source_id=str(d.get("source_id", "")),
        ingestion_request_id=d.get("ingestion_request_id"),
        emission_factor_version=str(d.get("emission_factor_version", "")),
        derived_from=list(d.get("derived_from") or []),
        calculation_step=str(d.get("calculation_step", "")),
    )


def ensure_lineage_has_version(lineage_dict: dict) -> bool:
    """Return True if lineage has non-empty emission_factor_version (for CI checks)."""
    return bool((lineage_dict or {}).get("emission_factor_version"))

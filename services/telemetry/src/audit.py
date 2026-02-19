"""
Immutable audit logs. Append-only JSONL; no in-place mutation.
"""
from __future__ import annotations
import json
import os
from datetime import datetime, timezone
from typing import Any

_AUDIT_PATH: str | None = None


def set_audit_path(path: str) -> None:
    global _AUDIT_PATH
    _AUDIT_PATH = path


def get_audit_path() -> str:
    global _AUDIT_PATH
    if _AUDIT_PATH is not None:
        return _AUDIT_PATH
    base = os.environ.get("TELEMETRY_DATA_DIR", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    log_dir = os.path.join(base, "logs")
    os.makedirs(log_dir, exist_ok=True)
    return os.path.join(log_dir, "telemetry_audit.log")


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def write_audit(action: str, **kwargs: Any) -> None:
    """Append one audit entry. Never modify existing lines."""
    entry = {
        "timestamp_utc": _utc_now_iso(),
        "action": action,
        **kwargs,
    }
    path = get_audit_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a") as f:
        f.write(json.dumps(entry) + "\n")


def audit_ingest_accepted(request_id: str | None, source_id: str | None, payload_hash: str, schema_version: str, emission_factor_version: str) -> None:
    write_audit(
        action="ingest.accepted",
        request_id=request_id,
        source_id=source_id,
        payload_hash=payload_hash,
        schema_version=schema_version,
        emission_factor_version=emission_factor_version,
    )


def audit_ingest_rejected(request_id: str | None, reason: str, payload_preview: str = "") -> None:
    write_audit(action="ingest.rejected", request_id=request_id, reason=reason, payload_preview=payload_preview[:500])


def audit_calculation(metric_type: str, request_id: str | None, lineage_ids: list[str], emission_factor_version: str) -> None:
    write_audit(
        action="calculation.performed",
        metric_type=metric_type,
        request_id=request_id,
        lineage_ids=lineage_ids,
        emission_factor_version=emission_factor_version,
    )


def audit_alert_triggered(alert_type: str, severity: str, request_id: str | None, details: dict) -> None:
    write_audit(action="alert.triggered", alert_type=alert_type, severity=severity, request_id=request_id, details=details)


def audit_duplicate_rejected(request_id: str | None, source_id: str | None, external_event_id: str | None) -> None:
    write_audit(action="ingest.duplicate_rejected", request_id=request_id, source_id=source_id, external_event_id=external_event_id)

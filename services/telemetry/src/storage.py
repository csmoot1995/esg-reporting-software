"""
Time-series storage for telemetry. SQLite-backed; idempotent ingestion via unique constraints.
All timestamps stored in UTC.
"""
from __future__ import annotations
import hashlib
import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any

from .lineage import lineage_to_dict, lineage_from_dict

_DB_PATH: str | None = None


def set_db_path(path: str) -> None:
    global _DB_PATH
    _DB_PATH = path


def get_db_path() -> str:
    global _DB_PATH
    if _DB_PATH is not None:
        return _DB_PATH
    base = os.environ.get("TELEMETRY_DATA_DIR", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    data_dir = os.path.join(base, "data")
    os.makedirs(data_dir, exist_ok=True)
    return os.path.join(data_dir, "telemetry.db")


def _conn() -> sqlite3.Connection:
    path = get_db_path()
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS telemetry_raw (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            payload_hash TEXT NOT NULL,
            source_id TEXT,
            external_event_id TEXT,
            ingestion_request_id TEXT,
            observation_time_utc TEXT NOT NULL,
            ingestion_time_utc TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            UNIQUE(source_id, external_event_id)
        );
        CREATE INDEX IF NOT EXISTS idx_raw_time ON telemetry_raw(observation_time_utc);
        CREATE INDEX IF NOT EXISTS idx_raw_source ON telemetry_raw(source_id);

        CREATE TABLE IF NOT EXISTS metrics_carbon (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            metric_type TEXT NOT NULL,
            value REAL NOT NULL,
            unit TEXT NOT NULL,
            asset_id TEXT,
            region TEXT,
            scope TEXT,
            emission_factor_version TEXT NOT NULL,
            timestamp_utc TEXT NOT NULL,
            raw_payload_id INTEGER,
            lineage_json TEXT,
            FOREIGN KEY (raw_payload_id) REFERENCES telemetry_raw(id)
        );
        CREATE INDEX IF NOT EXISTS idx_carbon_ts ON metrics_carbon(timestamp_utc);
        CREATE INDEX IF NOT EXISTS idx_carbon_asset ON metrics_carbon(asset_id);

        CREATE TABLE IF NOT EXISTS metrics_water (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            metric_type TEXT NOT NULL,
            value REAL NOT NULL,
            unit TEXT NOT NULL,
            asset_id TEXT,
            region TEXT,
            timestamp_utc TEXT NOT NULL,
            raw_payload_id INTEGER,
            lineage_json TEXT,
            FOREIGN KEY (raw_payload_id) REFERENCES telemetry_raw(id)
        );
        CREATE INDEX IF NOT EXISTS idx_water_ts ON metrics_water(timestamp_utc);

        CREATE TABLE IF NOT EXISTS metrics_efficiency (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            metric_type TEXT NOT NULL,
            value REAL NOT NULL,
            unit TEXT NOT NULL,
            asset_id TEXT,
            region TEXT,
            timestamp_utc TEXT NOT NULL,
            raw_payload_id INTEGER,
            lineage_json TEXT,
            FOREIGN KEY (raw_payload_id) REFERENCES telemetry_raw(id)
        );
        CREATE INDEX IF NOT EXISTS idx_eff_ts ON metrics_efficiency(timestamp_utc);

        CREATE TABLE IF NOT EXISTS metrics_hardware (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            metric_type TEXT NOT NULL,
            value REAL NOT NULL,
            unit TEXT NOT NULL,
            asset_id TEXT,
            region TEXT,
            timestamp_utc TEXT NOT NULL,
            raw_payload_id INTEGER,
            lineage_json TEXT,
            FOREIGN KEY (raw_payload_id) REFERENCES telemetry_raw(id)
        );
        CREATE INDEX IF NOT EXISTS idx_hw_ts ON metrics_hardware(timestamp_utc);

        CREATE TABLE IF NOT EXISTS metrics_data_quality (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            metric_type TEXT NOT NULL,
            value REAL NOT NULL,
            unit TEXT NOT NULL,
            asset_id TEXT,
            region TEXT,
            timestamp_utc TEXT NOT NULL,
            raw_payload_id INTEGER,
            lineage_json TEXT,
            FOREIGN KEY (raw_payload_id) REFERENCES telemetry_raw(id)
        );
        CREATE INDEX IF NOT EXISTS idx_dq_ts ON metrics_data_quality(timestamp_utc);

        CREATE TABLE IF NOT EXISTS assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            asset_id TEXT UNIQUE NOT NULL,
            asset_type TEXT,
            embodied_carbon_kg_co2e REAL,
            commissioned_at TEXT,
            expected_lifetime_hours REAL
        );
    """)
    conn.commit()


def payload_hash(payload: dict) -> str:
    """Stable hash for idempotency (can use for duplicate detection if no external_event_id)."""
    canonical = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()[:32]


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def normalize_timestamp(ts: str) -> str:
    """Normalize to UTC ISO string."""
    if not ts:
        return _utc_now()
    try:
        if ts.replace(".", "").replace("-", "").replace(":", "").isdigit() and len(ts) <= 15:
            # Unix seconds or milliseconds
            num = float(ts)
            if num > 1e12:
                num /= 1000.0
            dt = datetime.fromtimestamp(num, tz=timezone.utc)
            return dt.isoformat().replace("+00:00", "Z")
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    except Exception:
        return _utc_now()


def insert_raw(
    payload: dict,
    source_id: str | None,
    external_event_id: str | None,
    request_id: str | None,
    observation_time_utc: str,
) -> tuple[int | None, str | None]:
    """
    Insert raw telemetry. Returns (raw_id, None) on success.
    On duplicate (same source_id + external_event_id), returns (None, "DUPLICATE").
    """
    conn = _conn()
    try:
        init_schema(conn)
        ph = payload_hash(payload)
        ingestion_time = _utc_now()
        sid = source_id or ""
        eid = external_event_id or ""
        # Unique constraint: (source_id, external_event_id). If both empty, we use payload_hash as eid to avoid multiple empty inserts.
        if not eid and not sid:
            eid = ph
        cur = conn.execute(
            """INSERT INTO telemetry_raw (payload_hash, source_id, external_event_id, ingestion_request_id, observation_time_utc, ingestion_time_utc, payload_json)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (ph, sid, eid, request_id or "", observation_time_utc, ingestion_time, json.dumps(payload)),
        )
        conn.commit()
        return (cur.lastrowid, None)
    except sqlite3.IntegrityError as e:
        if "UNIQUE" in str(e):
            conn.rollback()
            return (None, "DUPLICATE")
        raise
    finally:
        conn.close()


def insert_carbon(metric_type: str, value: float, unit: str, asset_id: str | None, region: str | None, scope: str | None, emission_factor_version: str, timestamp_utc: str, raw_payload_id: int | None, lineage: dict | None) -> int:
    conn = _conn()
    try:
        init_schema(conn)
        cur = conn.execute(
            """INSERT INTO metrics_carbon (metric_type, value, unit, asset_id, region, scope, emission_factor_version, timestamp_utc, raw_payload_id, lineage_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (metric_type, value, unit, asset_id, region, scope, emission_factor_version, timestamp_utc, raw_payload_id, json.dumps(lineage) if lineage else None),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def insert_water(metric_type: str, value: float, unit: str, asset_id: str | None, region: str | None, timestamp_utc: str, raw_payload_id: int | None, lineage: dict | None) -> int:
    conn = _conn()
    try:
        init_schema(conn)
        cur = conn.execute(
            """INSERT INTO metrics_water (metric_type, value, unit, asset_id, region, timestamp_utc, raw_payload_id, lineage_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (metric_type, value, unit, asset_id, region, timestamp_utc, raw_payload_id, json.dumps(lineage) if lineage else None),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def insert_efficiency(metric_type: str, value: float, unit: str, asset_id: str | None, region: str | None, timestamp_utc: str, raw_payload_id: int | None, lineage: dict | None) -> int:
    conn = _conn()
    try:
        init_schema(conn)
        cur = conn.execute(
            """INSERT INTO metrics_efficiency (metric_type, value, unit, asset_id, region, timestamp_utc, raw_payload_id, lineage_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (metric_type, value, unit, asset_id, region, timestamp_utc, raw_payload_id, json.dumps(lineage) if lineage else None),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def insert_hardware(metric_type: str, value: float, unit: str, asset_id: str | None, region: str | None, timestamp_utc: str, raw_payload_id: int | None, lineage: dict | None) -> int:
    conn = _conn()
    try:
        init_schema(conn)
        cur = conn.execute(
            """INSERT INTO metrics_hardware (metric_type, value, unit, asset_id, region, timestamp_utc, raw_payload_id, lineage_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (metric_type, value, unit, asset_id, region, timestamp_utc, raw_payload_id, json.dumps(lineage) if lineage else None),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def insert_data_quality(metric_type: str, value: float, unit: str, asset_id: str | None, region: str | None, timestamp_utc: str, raw_payload_id: int | None, lineage: dict | None) -> int:
    conn = _conn()
    try:
        init_schema(conn)
        cur = conn.execute(
            """INSERT INTO metrics_data_quality (metric_type, value, unit, asset_id, region, timestamp_utc, raw_payload_id, lineage_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (metric_type, value, unit, asset_id, region, timestamp_utc, raw_payload_id, json.dumps(lineage) if lineage else None),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


_ALLOWED_METRIC_TABLES = ("metrics_carbon", "metrics_water", "metrics_efficiency", "metrics_hardware", "metrics_data_quality")


def get_lineage_for_metric(table: str, metric_id: int) -> dict | None:
    """Fetch lineage JSON for a stored metric. Used for lineage regression tests."""
    if table not in _ALLOWED_METRIC_TABLES:
        return None
    conn = _conn()
    try:
        cur = conn.execute(f"SELECT lineage_json FROM {table} WHERE id = ?", (metric_id,))
        row = cur.fetchone()
        if not row or not row[0]:
            return None
        return json.loads(row[0])
    finally:
        conn.close()


def get_raw_payload(raw_id: int) -> dict | None:
    conn = _conn()
    try:
        cur = conn.execute("SELECT payload_json FROM telemetry_raw WHERE id = ?", (raw_id,))
        row = cur.fetchone()
        if not row:
            return None
        return json.loads(row[0])
    finally:
        conn.close()

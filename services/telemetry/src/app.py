"""
Telemetry service: ESG telemetry ingestion, calculation engine, lineage, audit, alerts.
POST /ingest, POST /replay, GET /metrics/report, GET /health.
"""
from __future__ import annotations
import json
import os
from typing import Any

from flask import Flask, request, jsonify
from pydantic import ValidationError

from . import audit
from . import storage
from . import lineage
from . import alerts
from . import scorecard
from .schema import validate_ingest_payload, TelemetryIngestPayload
from .storage import payload_hash, normalize_timestamp, insert_raw, insert_carbon, insert_water, insert_efficiency, insert_hardware, insert_data_quality, begin_batch, commit_batch, end_batch, batch_insert_carbon, batch_insert_water, batch_insert_efficiency, batch_insert_hardware, batch_insert_data_quality, batch_insert_mediation
from .lineage import build_lineage, lineage_to_dict
from .calculations import carbon as calc_carbon
from .calculations import water as calc_water
from .calculations import efficiency as calc_efficiency
from .calculations import hardware as calc_hardware
from .calculations import data_quality as calc_dq
from .units import normalize_energy, normalize_water, seconds_to_workload_hours

app = Flask(__name__)

# Optional: override paths for tests
def _data_dir() -> str:
    base = os.environ.get("TELEMETRY_DATA_DIR", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(os.path.dirname(base), "data")


def error_response(code: str, message: str, status: int):
    body = {"error": {"code": code, "message": message}}
    resp = jsonify(body)
    resp.status_code = status
    req_id = request.headers.get("X-Request-ID") if request else None
    if req_id:
        resp.headers["X-Request-ID"] = req_id
    return resp


def _ensure_json():
    if request.content_type and "application/json" not in (request.content_type or ""):
        return None, error_response("UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json", 415)
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return None, error_response("VALIDATION_ERROR", "JSON body required", 400)
    return data, None


def _run_calculations_and_store(
    payload: TelemetryIngestPayload,
    raw_id: int,
    request_id: str | None,
    observation_utc: str,
) -> tuple[dict[str, Any], list[dict]]:
    """Run calculation engine, store metrics with lineage, return (metrics_summary, alert_list)."""
    begin_batch()
    try:
        p = payload
        ef_version = p.emission_factor_version or "v1"
        source_id = p.source_id or ""
        lineage_ref = build_lineage(
            str(raw_id), source_id, request_id, ef_version,
            calculation_step="ingest",
        )
        lineage_dict = lineage_to_dict(lineage_ref)
        alert_list = []

        # Energy / carbon
        facility_kwh = None
        it_kwh = None
        cooling_kwh = None
        gen_liters = None
        gen_type = None
        if p.energy:
            facility_kwh = p.energy.facility_kwh
            it_kwh = p.energy.it_kwh
            cooling_kwh = p.energy.cooling_kwh
            gen_liters = p.energy.generator_fuel_liters
            gen_type = p.energy.generator_fuel_type
            # Do NOT fallback facility_kwh to it_kwh - they are distinct measurements
            # facility_kwh includes cooling, it_kwh is just IT equipment

        total_kg = 0.0
        scope1, scope2, total_kg, ef_ver = calc_carbon.total_carbon_from_payload(
            facility_kwh, it_kwh, gen_liters, gen_type, p.region, ef_version, observation_utc,
        )
        if total_kg > 0:
            batch_insert_carbon("total_kg_co2e", total_kg, "kg_co2e", p.asset_id, p.region, "total", ef_ver, observation_utc, raw_id, lineage_dict)
        if scope1 > 0:
            batch_insert_carbon("scope1_kg_co2e", scope1, "kg_co2e", p.asset_id, p.region, "scope1", ef_ver, observation_utc, raw_id, lineage_dict)
        if scope2 > 0:
            batch_insert_carbon("scope2_kg_co2e", scope2, "kg_co2e", p.asset_id, p.region, "scope2_location", ef_ver, observation_utc, raw_id, lineage_dict)

        workload_hours = None
        training_runs = None
        inference_requests = None
        if p.compute:
            if p.compute.gpu_hours is not None:
                workload_hours = p.compute.gpu_hours
            elif p.compute.run_duration_seconds is not None and p.compute.gpu_count is not None:
                workload_hours = seconds_to_workload_hours(p.compute.run_duration_seconds, p.compute.gpu_count or 1.0)
            training_runs = p.compute.training_runs if p.compute.training_runs is not None else 0
            inference_requests = p.compute.inference_requests if p.compute.inference_requests is not None else 0

        workload_value = p.workload_value
        workload_unit = p.workload_unit
        if (workload_value is None or workload_unit is None) and workload_hours is not None:
            workload_value = workload_hours
            workload_unit = "workload_hour"

        intensity_ratio = None
        intensity_unit = None
        if workload_value is not None and workload_value > 0 and total_kg and total_kg > 0 and workload_unit:
            intensity_ratio = round(total_kg / workload_value, 6)
            intensity_unit = f"kg_co2e_per_{workload_unit}"
            batch_insert_carbon("carbon_intensity", intensity_ratio, intensity_unit, p.asset_id, p.region, None, ef_ver, observation_utc, raw_id, lineage_dict)

        if workload_hours is not None and workload_hours > 0 and total_kg and total_kg > 0:
            cpwh = calc_carbon.carbon_per_workload_unit(total_kg, workload_hours)
            batch_insert_carbon("carbon_per_workload_hour", cpwh, "kg_co2e_per_workload_hour", p.asset_id, p.region, None, ef_ver, observation_utc, raw_id, lineage_dict)
            alert_list.extend(alerts.evaluate_carbon_intensity(None, cpwh))
        if training_runs is not None and training_runs > 0 and total_kg and total_kg > 0:
            cptr = calc_carbon.carbon_per_production_unit(total_kg, training_runs)
            batch_insert_carbon("carbon_per_training_run", cptr, "kg_co2e_per_run", p.asset_id, p.region, None, ef_ver, observation_utc, raw_id, lineage_dict)
        if inference_requests is not None and inference_requests > 0 and total_kg and total_kg > 0:
            cpir = calc_carbon.carbon_per_production_unit(total_kg, inference_requests)
            batch_insert_carbon("carbon_per_inference_request", cpir, "kg_co2e_per_request", p.asset_id, p.region, None, ef_ver, observation_utc, raw_id, lineage_dict)

        # Grid intensity from payload or factors
        if p.carbon and p.carbon.grid_carbon_intensity_kg_per_kwh is not None:
            batch_insert_carbon("grid_carbon_intensity", p.carbon.grid_carbon_intensity_kg_per_kwh, "kg_co2e_per_kwh", p.asset_id, p.region, "grid", ef_version, observation_utc, raw_id, lineage_dict)
            alert_list.extend(alerts.evaluate_carbon_intensity(p.carbon.grid_carbon_intensity_kg_per_kwh, None))

        # Water
        withdrawal = p.water.withdrawal_liters if (p.water and hasattr(p.water, "withdrawal_liters")) else None
        returned = p.water.returned_liters if p.water else None
        reclaimed = getattr(p.water, "reclaimed_liters", None) if p.water else None
        evap = p.water.evaporation_liters if p.water else None
        blowdown = p.water.blowdown_liters if p.water else None
        if p.water:
            wu = getattr(p.water, "water_unit", None) or "liters"
            tw = calc_water.total_water_withdrawal(withdrawal, wu)
            if tw > 0:
                batch_insert_water("total_withdrawal_liters", tw, "liters", p.asset_id, p.region, observation_utc, raw_id, lineage_dict)
            consumed, ret = calc_water.water_consumed_vs_returned(withdrawal, returned, (p.water.consumed_liters if p.water else None), wu)
            rec_pct = calc_water.reclaimed_water_pct(reclaimed, withdrawal, wu)
            if withdrawal and it_kwh and it_kwh > 0:
                total_cooling = (evap or 0) + (blowdown or 0) + (consumed or 0)
                if total_cooling <= 0:
                    total_cooling = tw
                wue_val = calc_water.wue(total_cooling, it_kwh)
                batch_insert_water("wue", wue_val, "L_per_kWh", p.asset_id, p.region, observation_utc, raw_id, lineage_dict)
                alert_list.extend(alerts.evaluate_water(wue_val, None, rec_pct))
            if workload_hours and workload_hours > 0 and tw > 0:
                wpwh = calc_water.water_per_workload_unit(tw, workload_hours)
                batch_insert_water("water_per_workload_hour", wpwh, "liters_per_workload_hour", p.asset_id, p.region, observation_utc, raw_id, lineage_dict)
                alert_list.extend(alerts.evaluate_water(None, wpwh, rec_pct))
            if training_runs and training_runs > 0 and tw > 0:
                wptr = calc_water.water_per_production_unit(tw, training_runs)
                batch_insert_water("water_per_training_run", wptr, "liters_per_run", p.asset_id, p.region, observation_utc, raw_id, lineage_dict)
            if rec_pct >= 0:
                batch_insert_water("reclaimed_water_pct", rec_pct, "pct", p.asset_id, p.region, observation_utc, raw_id, lineage_dict)

        # Efficiency
        if facility_kwh is not None and it_kwh is not None and it_kwh > 0:
            pue_val = calc_efficiency.pue(facility_kwh, it_kwh)
            dcie_val = calc_efficiency.dcie(facility_kwh, it_kwh)
            batch_insert_efficiency("pue", pue_val, "ratio", p.asset_id, p.region, observation_utc, raw_id, lineage_dict)
            batch_insert_efficiency("dcie", dcie_val, "ratio", p.asset_id, p.region, observation_utc, raw_id, lineage_dict)
            alert_list.extend(alerts.evaluate_cooling(pue_val, None, None))
            if cooling_kwh is not None:
                cool_pct = calc_efficiency.cooling_energy_pct(facility_kwh, cooling_kwh)
                batch_insert_efficiency("cooling_energy_pct", cool_pct, "pct", p.asset_id, p.region, observation_utc, raw_id, lineage_dict)
                alert_list.extend(alerts.evaluate_cooling(None, cool_pct, None))
            if workload_hours and workload_hours > 0:
                epu = calc_efficiency.energy_per_workload_unit(it_kwh, workload_hours)
                batch_insert_efficiency("energy_per_workload_hour", epu, "kWh_per_workload_hour", p.asset_id, p.region, observation_utc, raw_id, lineage_dict)
            if training_runs and training_runs > 0:
                eptr = calc_efficiency.energy_per_production_batch(it_kwh, training_runs)
                batch_insert_efficiency("energy_per_training_run", eptr, "kWh_per_run", p.asset_id, p.region, observation_utc, raw_id, lineage_dict)

        # Hardware
        if p.hardware:
            util = calc_hardware.utilization_pct(p.hardware.utilization_pct)
            idle = calc_hardware.idle_rate_pct(p.hardware.idle_rate_pct)
            if util >= 0:
                batch_insert_hardware("utilization_pct", util, "pct", p.asset_id, p.region, observation_utc, raw_id, lineage_dict)
            if idle >= 0:
                batch_insert_hardware("idle_rate_pct", idle, "pct", p.asset_id, p.region, observation_utc, raw_id, lineage_dict)

        # Data quality
        if p.data_quality:
            dq = p.data_quality
            conf = calc_dq.confidence_score(dq.completeness_pct, dq.latency_seconds, dq.outlier_flag, dq.drift_flag)
            batch_insert_data_quality("confidence_score", conf, "0-1", p.asset_id, p.region, observation_utc, raw_id, lineage_dict)
            if dq.drift_flag:
                alert_list.extend(alerts.evaluate_sensor_drift(True))

        audit.audit_calculation("carbon,water,efficiency,hardware,dq", request_id, [str(raw_id)], ef_ver)
        for a in alert_list:
            audit.audit_alert_triggered(a.get("metric", ""), a.get("severity", "WARNING"), request_id, a)

        # Derived mediation practices health statuses from existing metrics/alerts
        # These are governance/operations "mediation" checks surfaced as findings.
        mediation_findings: list[dict[str, Any]] = []
        for a in alert_list:
            metric = a.get("metric")
            if metric == "carbon_per_workload_hour" or metric == "grid_carbon_intensity":
                mediation_findings.append({
                    "practice": "emissions_mitigation",
                    "status": "FAIL" if a.get("severity") == "CRITICAL" else "WARN",
                    "metric": metric,
                    "value": a.get("value"),
                    "timestamp": a.get("timestamp"),
                })
            elif metric in ("wue", "water_per_workload_hour", "reclaimed_water_pct"):
                mediation_findings.append({
                    "practice": "water_stewardship",
                    "status": "WARN",
                    "metric": metric,
                    "value": a.get("value"),
                    "timestamp": a.get("timestamp"),
                })
            elif metric in ("energy_efficiency_ratio", "cooling_energy_pct", "cop"):
                mediation_findings.append({
                    "practice": "energy_efficiency",
                    "status": "WARN",
                    "metric": metric,
                    "value": a.get("value"),
                    "timestamp": a.get("timestamp"),
                })
            elif metric == "sensor_drift":
                mediation_findings.append({
                    "practice": "data_quality_controls",
                    "status": "WARN",
                    "metric": metric,
                    "value": a.get("value"),
                    "timestamp": a.get("timestamp"),
                })

        # Also create a data-quality finding if confidence is low
        if p.data_quality:
            conf_val = calc_dq.confidence_score(p.data_quality.completeness_pct, p.data_quality.latency_seconds, p.data_quality.outlier_flag, p.data_quality.drift_flag)
            if conf_val < 0.6:
                mediation_findings.append({
                    "practice": "data_quality_controls",
                    "status": "WARN",
                    "metric": "confidence_score",
                    "value": conf_val,
                    "timestamp": observation_utc,
                })

        def _overall_status(findings: list[dict[str, Any]]) -> str:
            if any(f.get("status") == "FAIL" for f in findings):
                return "FAIL"
            if any(f.get("status") == "WARN" for f in findings):
                return "WARN"
            return "OK"

        overall = _overall_status(mediation_findings)
        batch_insert_mediation(
            "mediation_overall_health",
            None,
            None,
            p.asset_id,
            p.region,
            observation_utc,
            raw_id,
            lineage_dict,
            {"status": overall, "findings": mediation_findings},
        )

        summary = {
            "carbon_kg_co2e": total_kg,
            "carbon_per_workload_hour": calc_carbon.carbon_per_workload_unit(total_kg, workload_hours) if workload_hours and workload_hours > 0 else None,
            "carbon_intensity": intensity_ratio,
            "carbon_intensity_unit": intensity_unit,
            "pue": calc_efficiency.pue(facility_kwh or 0, it_kwh or 0) if it_kwh and it_kwh > 0 else None,
            "wue": calc_water.wue((p.water and (p.water.withdrawal_liters or 0)) or 0, it_kwh or 0) if it_kwh and it_kwh > 0 else None,
            "utilization_pct": p.hardware.utilization_pct if p.hardware else None,
            "mediation_health": overall,
        }
        commit_batch()
        return summary, alert_list
    finally:
        end_batch()


@app.route("/ingest", methods=["POST"])
def ingest():
    data, err = _ensure_json()
    if err:
        return err
    request_id = request.headers.get("X-Request-ID")
    source_id = request.headers.get("X-Ingestion-Source") or request.headers.get("X-Source-ID") or (data.get("source_id") if isinstance(data, dict) else None)

    try:
        payload = validate_ingest_payload(data)
    except ValidationError as e:
        audit.audit_ingest_rejected(request_id, str(e), json.dumps(data)[:500])
        return error_response("VALIDATION_ERROR", str(e), 400)

    observation_utc = storage.normalize_timestamp(payload.timestamp)
    ph = payload_hash(data)
    source_id = source_id or payload.source_id or ""
    external_event_id = payload.external_event_id or ""

    raw_id, duplicate = insert_raw(
        data, source_id, external_event_id, request_id, observation_utc,
    )
    if duplicate == "DUPLICATE":
        audit.audit_duplicate_rejected(request_id, source_id, external_event_id or None)
        return error_response("DUPLICATE", "Duplicate payload: same source_id and external_event_id already ingested", 409)

    audit.audit_ingest_accepted(request_id, source_id, ph, "TelemetryIngestPayload", payload.emission_factor_version or "v1")

    summary, alert_list = _run_calculations_and_store(payload, raw_id, request_id, observation_utc)

    include_scorecard = request.args.get("scorecard", "").lower() in ("1", "true", "yes")
    out = {"status": "accepted", "raw_id": raw_id, "observation_time_utc": observation_utc, "summary": summary}
    if include_scorecard:
        out["scorecard"] = scorecard.sustainability_score(
            carbon_per_workload_hour=summary.get("carbon_per_workload_hour"),
            water_per_workload_hour=None,
            energy_efficiency_ratio=summary.get("pue"),
            utilization_pct=summary.get("utilization_pct"),
        )
    if alert_list:
        out["alerts"] = alert_list
        out["severity"] = "CRITICAL" if any(a.get("severity") == "CRITICAL" for a in alert_list) else "WARNING"
        status_code = 201
    else:
        status_code = 200
    resp = jsonify(out)
    resp.status_code = status_code
    if request_id:
        resp.headers["X-Request-ID"] = request_id
    return resp


@app.route("/replay", methods=["POST"])
def replay():
    """Historical replay: re-run calculations for stored raw payloads with a given emission factor version."""
    data, err = _ensure_json()
    if err:
        return err
    version = (data.get("emission_factor_version") or "v1").strip()
    time_from = data.get("time_from")
    time_to = data.get("time_to")
    if not time_from or not time_to:
        return error_response("VALIDATION_ERROR", "time_from and time_to required for replay", 400)
    # Minimal replay: we just confirm version is used; full replay would re-query raw and re-calc
    return jsonify({
        "status": "replay_scheduled",
        "emission_factor_version": version,
        "time_from": time_from,
        "time_to": time_to,
        "message": "Replay uses versioned emission factors for reproducibility.",
    }), 200


@app.route("/metrics/report", methods=["GET"])
def metrics_report():
    """Sample output report: latest metrics for first asset (or all) as JSON."""
    conn = storage._conn()
    try:
        storage.init_schema(conn)
        report = {"carbon": [], "water": [], "efficiency": [], "hardware": [], "data_quality": [], "mediation": []}
        for table, key in [
            ("metrics_carbon", "carbon"),
            ("metrics_water", "water"),
            ("metrics_efficiency", "efficiency"),
            ("metrics_hardware", "hardware"),
            ("metrics_data_quality", "data_quality"),
            ("metrics_mediation", "mediation"),
        ]:
            if table not in storage._ALLOWED_METRIC_TABLES:
                continue
            # Only mediation table has details_json column
            if table == "metrics_mediation":
                cur = conn.execute(
                    "SELECT metric_type, value, unit, asset_id, region, timestamp_utc, lineage_json, details_json FROM " + table + " ORDER BY id DESC LIMIT 20"
                )
            else:
                cur = conn.execute(
                    "SELECT metric_type, value, unit, asset_id, region, timestamp_utc, lineage_json FROM " + table + " ORDER BY id DESC LIMIT 20"
                )
            for row in cur.fetchall():
                entry = {
                    "metric_type": row[0],
                    "value": row[1],
                    "unit": row[2],
                    "asset_id": row[3],
                    "region": row[4],
                    "timestamp_utc": row[5],
                    "lineage": json.loads(row[6]) if row[6] else None,
                }
                # Only mediation has details_json (column 7)
                if table == "metrics_mediation" and len(row) > 7:
                    entry["details"] = json.loads(row[7]) if row[7] else None
                report[key].append(entry)
        return jsonify(report)
    finally:
        conn.close()


@app.route("/health", methods=["GET"])
def health():
    return "OK", 200


@app.route("/reset", methods=["POST"])
def reset():
    """Reset/clear telemetry ingestion state.

    Body (optional): {"clear_tables": true}
    - clear_tables=false: closes cached batch connection + clears in-memory buffers only
    - clear_tables=true: additionally deletes all telemetry raw + metric rows
    """
    data, err = _ensure_json()
    if err:
        # allow empty body by treating it as default reset
        data = {}

    clear_tables = bool((data or {}).get("clear_tables", False))
    result = storage.reset_storage(clear_tables=clear_tables)
    return jsonify({"status": "ok", **result}), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8083"))
    host = "0.0.0.0" if os.environ.get("CONTAINER") else "127.0.0.1"
    app.run(host=host, port=port)

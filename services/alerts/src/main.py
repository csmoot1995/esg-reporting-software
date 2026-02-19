"""
Alerts service: environmental telemetry evaluation for ESG monitoring.

Ingestion: POST /process-telemetry (application/json). See docs/INGESTION_PROTOCOL.md.

Methodology:
- CO2_ppm: Indoor/workspace CO₂. Thresholds aligned with IAQ guidance (e.g. ASHRAE,
  WHO). 450 ppm used as actionable limit above typical well-ventilated 400 ppm target.
- Temperature_C: Workspace temperature. 35 °C used as upper limit for occupant safety
  and productivity (ISO/ASHRAE comfort and occupational health context).
In production, thresholds should be configurable (e.g. ConfigMap/DB) and aligned with
your jurisdiction and chosen ESG/disclosure framework (e.g. GRI, SASB, TCFD).
"""
import os
from datetime import datetime
from flask import Flask, request, jsonify

app = Flask(__name__)

# --- Ingestion protocol: standard error shape (see docs/INGESTION_PROTOCOL.md) ---
def error_response(code: str, message: str, status: int):
    """Return JSON error per ingestion protocol."""
    body = {"error": {"code": code, "message": message}}
    resp = jsonify(body)
    resp.status_code = status
    req_id = request.headers.get("X-Request-ID")
    if req_id:
        resp.headers["X-Request-ID"] = req_id
    return resp

# ESG-aligned environmental thresholds (reference values; override via config in prod)
# CO2_ppm: parts per million, indoor/ambient. >450 ppm → CRITICAL (IAQ/wellbeing)
# Temperature_C: Celsius. >35 °C → CRITICAL (occupational/comfort)
THRESHOLDS = {
    "CO2_ppm": 450,
    "Temperature_C": 35.0,
}

# Optional warning tier: alert before critical (e.g. 80% of critical threshold)
WARNING_FACTOR = 0.85  # WARNING when value >= threshold * WARNING_FACTOR


def _evaluate_metric(metric: str, value: float) -> dict | None:
    """Evaluate a single metric against ESG thresholds. Returns alert detail or None."""
    if metric not in THRESHOLDS:
        return None
    threshold = THRESHOLDS[metric]
    if value > threshold:
        return {
            "metric": metric,
            "value": value,
            "threshold": threshold,
            "severity": "CRITICAL",
            "timestamp": datetime.now().isoformat(),
        }
    if value >= threshold * WARNING_FACTOR:
        return {
            "metric": metric,
            "value": value,
            "threshold": threshold,
            "severity": "WARNING",
            "timestamp": datetime.now().isoformat(),
        }
    return None


def _ensure_json():
    """Enforce Content-Type and parse JSON; return (None, error_response) on failure."""
    if request.content_type and "application/json" not in request.content_type:
        return None, error_response("UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json", 415)
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return None, error_response("VALIDATION_ERROR", "JSON body with CO2_ppm and/or Temperature_C required", 400)
    return data, None


@app.route("/process-telemetry", methods=["POST"])
def process_data():
    """Process telemetry payload. Expects JSON with CO2_ppm and/or Temperature_C (numeric)."""
    data, err = _ensure_json()
    if err:
        return err

    alerts = []
    for metric, raw in data.items():
        if metric not in THRESHOLDS:
            continue
        try:
            value = float(raw)
        except (TypeError, ValueError):
            continue
        if value < 0:
            continue
        detail = _evaluate_metric(metric, value)
        if detail:
            alerts.append(detail)

    critical = [a for a in alerts if a["severity"] == "CRITICAL"]
    if critical:
        payload = {"status": "ALERT_TRIGGERED", "details": alerts, "severity": "CRITICAL"}
        status_code = 201
    elif alerts:
        payload = {"status": "WARNING", "details": alerts, "severity": "WARNING"}
        status_code = 200
    else:
        payload = {"status": "NORMAL"}
        status_code = 200
    resp = jsonify(payload)
    resp.status_code = status_code
    req_id = request.headers.get("X-Request-ID")
    if req_id:
        resp.headers["X-Request-ID"] = req_id
    return resp


@app.route("/health", methods=["GET"])
def health():
    return "OK", 200


if __name__ == "__main__":
    host = "0.0.0.0" if os.environ.get("CONTAINER") else "127.0.0.1"
    app.run(host=host, port=8081)

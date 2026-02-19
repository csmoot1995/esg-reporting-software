"""
What-if simulator: carbon footprint projection for ESG scenario analysis.

Ingestion: POST /simulate (application/json). See docs/INGESTION_PROTOCOL.md.

Methodology (science-based simplification for scenario comparison):
  C_projected = C_current × (1 - E) × (1 - M)
  - E = efficiency_gain / 100  (operational efficiency reducing consumption)
  - M = energy_mix_shift / 100   (shift to lower-carbon supply; reduces residual emissions)

Interpretation: first apply efficiency savings, then apply decarbonization of the
remaining demand. Aligns with common GHG projection approaches (e.g. GHG Protocol,
SBTi-style reduction pathways). Units: metric tons CO₂e (carbon dioxide equivalent).
"""
import os
import sys

from flask import Flask, request, jsonify

# Allow running as script (e.g. python src/main.py) or as package
_here = os.path.dirname(os.path.abspath(__file__))
if _here not in sys.path:
    sys.path.insert(0, _here)
from projection import calculate_projection

app = Flask(__name__)


def error_response(code: str, message: str, status: int):
    """Return JSON error per ingestion protocol."""
    body = {"error": {"code": code, "message": message}}
    resp = jsonify(body)
    resp.status_code = status
    req_id = request.headers.get("X-Request-ID")
    if req_id:
        resp.headers["X-Request-ID"] = req_id
    return resp


@app.route("/simulate", methods=["POST"])
def simulate():
    if request.content_type and "application/json" not in request.content_type:
        return error_response("UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json", 415)
    params = request.get_json(silent=True)
    if not params or not isinstance(params, dict):
        return error_response("VALIDATION_ERROR", "JSON body required", 400)

    required = ["current_footprint", "energy_mix_shift", "efficiency_gain"]
    missing = [k for k in required if k not in params]
    if missing:
        return error_response("VALIDATION_ERROR", f"Missing parameter(s): {', '.join(missing)}", 400)

    try:
        res = calculate_projection(
            params["current_footprint"],
            params["energy_mix_shift"],
            params["efficiency_gain"],
        )
        resp = jsonify({"projected_footprint": res, "unit": "metric_tons_CO2e"})
        req_id = request.headers.get("X-Request-ID")
        if req_id:
            resp.headers["X-Request-ID"] = req_id
        return resp
    except (TypeError, ValueError) as e:
        return error_response("VALIDATION_ERROR", f"Invalid parameter: {e!s}", 400)


@app.route("/health", methods=["GET"])
def health():
    return "OK", 200


if __name__ == "__main__":
    host = "0.0.0.0" if os.environ.get("CONTAINER") else "127.0.0.1"
    app.run(host=host, port=8082)

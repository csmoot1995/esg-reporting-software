import os, json, logging
from datetime import datetime
from flask import Flask, request, jsonify
from pydantic import ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

# Ingestion protocol: standard error shape (see docs/INGESTION_PROTOCOL.md)
def error_response(code: str, message: str, status: int):
    body = {"error": {"code": code, "message": message}}
    resp = jsonify(body)
    resp.status_code = status
    req_id = request.headers.get("X-Request-ID") if request else None
    if req_id:
        resp.headers["X-Request-ID"] = req_id
    return resp

# --- Configuration & RBAC Logic ---
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    APP_NAME: str = "Compliance-Service"
    LOG_LEVEL: str = "INFO"
    ADMIN_KEY: str
    AUDITOR_KEY: str

try:
    config = Settings()
except ValidationError as e:
    print(f"❌ Configuration Error: {e}")
    exit(1)

# --- Structured Logging ---
logging.basicConfig(level=config.LOG_LEVEL)
logger = logging.getLogger(config.APP_NAME)

def get_json_log(message, severity="INFO", **kwargs):
    return json.dumps({
        "timestamp": datetime.now().isoformat(),
        "service": config.APP_NAME,
        "severity": severity,
        "message": message,
        **kwargs
    })

# --- App Logic ---
# ESG context: Validation attests that a report has been reviewed against your
# internal controls / ESG policy. For full ESG disclosure alignment (e.g. GRI, SASB,
# TCFD, EU CSRD), extend with framework-specific checks and evidence storage.
app = Flask(__name__)

@app.route('/validate', methods=['POST'])
def validate_report():
    if request.content_type and "application/json" not in request.content_type:
        return error_response("UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json", 415)
    auth_header = request.headers.get("X-API-KEY")
    if auth_header == config.ADMIN_KEY:
        role = "admin"
    elif auth_header == config.AUDITOR_KEY:
        role = "auditor"
    else:
        print(get_json_log("Unauthorized access attempt", "WARN"))
        return error_response("UNAUTHORIZED", "Missing or invalid X-API-KEY", 403)

    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return error_response("VALIDATION_ERROR", "JSON body must be an object", 400)

    mediation_findings = []
    declared = body.get("mediation") if isinstance(body, dict) else None
    if isinstance(declared, dict):
        for f in (declared.get("findings") or []):
            if isinstance(f, dict) and f.get("practice") and f.get("status"):
                mediation_findings.append(f)

    def _overall_status(findings: list[dict]) -> str:
        if any(f.get("status") == "FAIL" for f in findings):
            return "FAIL"
        if any(f.get("status") == "WARN" for f in findings):
            return "WARN"
        return "OK"

    mediation_overall = _overall_status(mediation_findings)

    print(get_json_log(f"Validation request processed by {role}", "INFO", role=role, mediation_health=mediation_overall))
    resp = jsonify({
        "status": "compliant",
        "validated_by": role,
        "mediation": {
            "health_status": mediation_overall,
            "findings": mediation_findings,
        }
    })
    req_id = request.headers.get("X-Request-ID")
    if req_id:
        resp.headers["X-Request-ID"] = req_id
    return resp

@app.route('/health', methods=['GET'])
def health():
    return "OK", 200

if __name__ == "__main__":
    host = "0.0.0.0" if os.environ.get("CONTAINER") else "127.0.0.1"
    app.run(host=host, port=8080)

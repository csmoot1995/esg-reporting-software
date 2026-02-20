"""Tests for the Compliance Service API."""
import os
import sys
import pytest

try:
    import flask
except ImportError:
    flask = None

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
if flask is not None:
    from services.compliance.src.main import app, config

pytestmark = pytest.mark.skipif(flask is None, reason="flask not installed")


@pytest.fixture
def client(monkeypatch):
    """Create a test client with mocked config."""
    monkeypatch.setattr(config, "ADMIN_KEY", "admin-test-key")
    monkeypatch.setattr(config, "AUDITOR_KEY", "auditor-test-key")
    with app.test_client() as c:
        yield c


def test_validate_with_admin_key_returns_compliant(client):
    """Admin key should successfully validate report."""
    r = client.post(
        "/validate",
        json={"mediation": {"findings": [{"practice": "test", "status": "OK"}]}},
        headers={"X-API-KEY": "admin-test-key"},
    )
    assert r.status_code == 200
    data = r.get_json()
    assert data["status"] == "compliant"
    assert data["validated_by"] == "admin"
    assert data["mediation"]["health_status"] == "OK"


def test_validate_with_auditor_key_returns_compliant(client):
    """Auditor key should successfully validate report."""
    r = client.post(
        "/validate",
        json={"mediation": {"findings": [{"practice": "test", "status": "OK"}]}},
        headers={"X-API-KEY": "auditor-test-key"},
    )
    assert r.status_code == 200
    data = r.get_json()
    assert data["status"] == "compliant"
    assert data["validated_by"] == "auditor"


def test_validate_without_auth_returns_403(client):
    """Missing or invalid API key should return 403."""
    r = client.post("/validate", json={})
    assert r.status_code == 403
    assert r.get_json()["error"]["code"] == "UNAUTHORIZED"


def test_validate_mediation_fail_status_detected(client):
    """Any FAIL finding should set overall status to FAIL."""
    r = client.post(
        "/validate",
        json={
            "mediation": {
                "findings": [
                    {"practice": "emissions_mitigation", "status": "FAIL"},
                    {"practice": "water_stewardship", "status": "OK"},
                ]
            }
        },
        headers={"X-API-KEY": "admin-test-key"},
    )
    data = r.get_json()
    assert data["mediation"]["health_status"] == "FAIL"


def test_validate_mediation_warn_status_detected(client):
    """WARN findings without FAIL should set overall status to WARN."""
    r = client.post(
        "/validate",
        json={
            "mediation": {
                "findings": [
                    {"practice": "water_stewardship", "status": "WARN"},
                    {"practice": "energy_efficiency", "status": "OK"},
                ]
            }
        },
        headers={"X-API-KEY": "admin-test-key"},
    )
    data = r.get_json()
    assert data["mediation"]["health_status"] == "WARN"


def test_validate_empty_findings_returns_ok(client):
    """No findings should result in OK status."""
    r = client.post(
        "/validate",
        json={"mediation": {"findings": []}},
        headers={"X-API-KEY": "admin-test-key"},
    )
    data = r.get_json()
    assert data["mediation"]["health_status"] == "OK"


def test_validate_no_mediation_returns_ok(client):
    """Missing mediation field should default to OK."""
    r = client.post(
        "/validate",
        json={},
        headers={"X-API-KEY": "admin-test-key"},
    )
    data = r.get_json()
    assert data["mediation"]["health_status"] == "OK"


def test_health_returns_200(client):
    """Health endpoint should return OK."""
    r = client.get("/health")
    assert r.status_code == 200


def test_validate_invalid_content_type_returns_415(client):
    """Non-JSON content type should return 415."""
    r = client.post(
        "/validate",
        data="not json",
        headers={"X-API-KEY": "admin-test-key", "Content-Type": "text/plain"},
    )
    assert r.status_code == 415

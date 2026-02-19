import pytest
from unittest.mock import MagicMock
from services.compliance.src.main import validate_report

def test_validate_report_pass(mocker):
    mock_db = mocker.patch('services.compliance.src.main.db')
    mock_db.session.query.return_value.filter.return_value.first.return_value = True
    assert validate_report("report_id") == "Pass"

def test_validate_report_fail(mocker):
    mock_db = mocker.patch('services.compliance.src.main.db')
    mock_db.session.query.return_value.filter.return_value.first.return_value = None
    assert validate_report("report_id") == "Fail"

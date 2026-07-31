"""
Unit tests for mappings/iso27001.py — pure logic, no external tools/services.
"""

import pytest
from mappings.iso27001 import get_iso_control


def test_known_cwe_resolves_specific_control():
    result = get_iso_control(cwe="CWE-284")
    assert result["id"] == "8.3"
    assert "name" in result
    assert "description" in result


def test_unknown_cwe_falls_back_to_scanner_default():
    result = get_iso_control(cwe="CWE-99999", scanner="trivy")
    assert result["id"] == "8.8"


def test_no_cwe_uses_scanner_default():
    assert get_iso_control(scanner="semgrep")["id"] == "8.28"
    assert get_iso_control(scanner="checkov")["id"] == "8.9"
    assert get_iso_control(scanner="secrets")["id"] == "5.17"
    assert get_iso_control(scanner="container")["id"] == "8.8"


def test_cwe_takes_priority_over_scanner():
    # CWE-284 maps to 8.3 specifically; even if scanner is trivy (8.8
    # default), the more specific CWE mapping should win.
    result = get_iso_control(cwe="CWE-284", scanner="trivy")
    assert result["id"] == "8.3"


def test_nothing_known_falls_back_to_absolute_default():
    result = get_iso_control(cwe=None, scanner=None)
    assert result["id"] == "8.28"


def test_unrecognized_scanner_falls_back_to_absolute_default():
    result = get_iso_control(cwe=None, scanner="some-future-scanner")
    assert result["id"] == "8.28"


@pytest.mark.parametrize("scanner", ["semgrep", "trivy", "checkov", "secrets", "container"])
def test_every_known_scanner_resolves_without_error(scanner):
    result = get_iso_control(scanner=scanner)
    assert result["id"]
    assert result["name"]
    assert result["description"]

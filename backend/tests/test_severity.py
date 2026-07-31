"""
Unit tests for utils/severity.py — pure logic, no external tools/services,
so these run in CI on every push with no setup.
"""

from utils.severity import normalize_severity


def test_already_canonical_passes_through():
    assert normalize_severity("CRITICAL") == "CRITICAL"
    assert normalize_severity("HIGH") == "HIGH"
    assert normalize_severity("MEDIUM") == "MEDIUM"
    assert normalize_severity("LOW") == "LOW"


def test_canonical_is_case_insensitive():
    # Secrets scanner emits lowercase ("critical", "high", ...)
    assert normalize_severity("critical") == "CRITICAL"
    assert normalize_severity("low") == "LOW"


def test_semgrep_vocabulary_is_mapped():
    assert normalize_severity("ERROR", scanner="semgrep") == "HIGH"
    assert normalize_severity("WARNING", scanner="semgrep") == "MEDIUM"
    assert normalize_severity("INFO", scanner="semgrep") == "LOW"


def test_semgrep_unrecognized_value_defaults_medium():
    assert normalize_severity("SOMETHING_NEW", scanner="semgrep") == "MEDIUM"


def test_checkov_info_and_trivy_unknown_map_to_low():
    assert normalize_severity("INFO") == "LOW"
    assert normalize_severity("UNKNOWN") == "LOW"
    assert normalize_severity("NONE") == "LOW"


def test_empty_or_missing_value_defaults_medium():
    assert normalize_severity(None) == "MEDIUM"
    assert normalize_severity("") == "MEDIUM"


def test_completely_unrecognized_value_defaults_medium():
    assert normalize_severity("WHATEVER") == "MEDIUM"


def test_whitespace_is_trimmed():
    assert normalize_severity("  high  ") == "HIGH"

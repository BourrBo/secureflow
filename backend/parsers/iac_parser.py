def normalize_iac_findings(data: dict) -> list:
    """
    Checkov output can be:
    - a single dict  (one resource type scanned)
    - a list of dicts (multiple resource types scanned — terraform + dockerfile etc.)
    
    TerraGoat triggers both, so we handle both cases.
    """
    findings = []

    # Normalize to always be a list
    results_list = data if isinstance(data, list) else [data]

    for results in results_list:
        if not isinstance(results, dict):
            continue

        failed_checks = results.get("results", {}).get("failed_checks", [])

        for check in failed_checks:
            file_path = check.get("repo_file_path") or check.get("file_path", "unknown")
            line_range = check.get("file_line_range", [0, 0])
            line = line_range[0] if line_range else 0

            findings.append({
                "title":       check.get("check_id", "UNKNOWN"),
                "severity":    _map_severity(check.get("severity")),
                "file":        file_path,
                "line":        line,
                "description": check.get("check_result", {}).get("result", "FAILED")
                               + " — " + check.get("check_id", ""),
                "rule":        check.get("check_id", ""),
                "cwe":         "CWE-732",   # misconfiguration default
                "owasp":       "A05:2021",  # Security Misconfiguration
                "scanner":     "checkov",
            })

    return findings


def _map_severity(severity: str) -> str:
    """Checkov severities: CRITICAL, HIGH, MEDIUM, LOW, INFO — normalize to uppercase."""
    if not severity:
        return "MEDIUM"
    return severity.upper()
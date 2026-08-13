"""
services/sarif_service.py

Converts SecureFlow's unified Finding schema into SARIF 2.1.0
(Static Analysis Results Interchange Format) -- the JSON schema GitHub
Code Scanning, GitLab, and most CI systems natively understand for
inline PR/MR annotations. This is what makes "findings show up as
comments on the diff" possible without any GitHub/GitLab-specific code
here -- SARIF is the common interchange format both platforms already
consume.

Severity mapping to SARIF's `level` follows the spec's intent:
  critical/high -> "error"   (build-breaking by convention)
  medium        -> "warning"
  low/info      -> "note"

Every finding also carries its ISO 27001 control and priority score as
SARIF `properties` -- these aren't part of core SARIF but are read by
tools that support the `properties` bag (and preserved for anyone
parsing the JSON directly), so nothing SecureFlow-specific is lost in
the conversion.
"""

SARIF_VERSION = "2.1.0"
SARIF_SCHEMA = "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json"

_LEVEL_BY_SEVERITY = {
    "CRITICAL": "error",
    "HIGH": "error",
    "MEDIUM": "warning",
    "LOW": "note",
    "INFO": "note",
}


def _rule_id(finding: dict) -> str:
    """A stable, engine-namespaced rule id -- SARIF de-dupes/groups by this,
    so two different vulnerability classes must never collide here."""
    scanner = (finding.get("scanner") or "secureflow").lower()
    rule = finding.get("rule") or finding.get("cwe") or "finding"
    return f"{scanner}/{rule}"


def _sarif_level(severity: str | None) -> str:
    return _LEVEL_BY_SEVERITY.get((severity or "").upper(), "warning")


def findings_to_sarif(findings: list[dict], tool_name: str = "SecureFlow") -> dict:
    """Builds one SARIF log with one "run", grouping findings under
    per-rule metadata (SARIF wants each distinct rule described once in
    `tool.driver.rules`, then referenced by id from each result)."""
    rules: dict[str, dict] = {}
    results = []

    for f in findings:
        rid = _rule_id(f)
        if rid not in rules:
            rules[rid] = {
                "id": rid,
                "name": f.get("rule") or f.get("title") or rid,
                "shortDescription": {"text": f.get("title") or rid},
                "fullDescription": {"text": f.get("description") or f.get("title") or rid},
                "helpUri": f.get("references", [None])[0] if f.get("references") else None,
                "properties": {
                    "cwe": f.get("cwe"),
                    "owasp": f.get("owasp"),
                    "iso27001_control": f.get("iso27001_control"),
                },
            }

        file_path = f.get("file") or f.get("file_path") or "unknown"
        line = f.get("line") or 1

        results.append(
            {
                "ruleId": rid,
                "level": _sarif_level(f.get("severity")),
                "message": {"text": f.get("description") or f.get("title") or "Finding"},
                "locations": [
                    {
                        "physicalLocation": {
                            "artifactLocation": {"uri": file_path},
                            "region": {"startLine": max(1, int(line) if line else 1)},
                        }
                    }
                ],
                "properties": {
                    "severity": f.get("severity"),
                    "scanner": f.get("scanner"),
                    "priority_score": f.get("priority_score"),
                    "priority_basis": f.get("priority_basis"),
                    "cve": f.get("cve"),
                    "iso27001_control": f.get("iso27001_control"),
                    "finding_id": f.get("id"),
                },
            }
        )

    return {
        "$schema": SARIF_SCHEMA,
        "version": SARIF_VERSION,
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": tool_name,
                        "informationUri": "https://secureflow.dev",
                        "rules": list(rules.values()),
                    }
                },
                "results": results,
            }
        ],
    }

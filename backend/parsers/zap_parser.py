"""
parsers/zap_parser.py

Normalizes raw OWASP ZAP alert dicts (from scanners/zap_runner.run_zap_scan)
into the same finding shape every other SecureFlow scanner produces
(matches models.finding.Finding), so the frontend/db/report layers treat
DAST findings identically to SAST/SCA/IaC/Secrets/Container ones.

ZAP-specific details that don't have a dedicated Finding field (evidence,
attack parameter, confidence, solution, reference links) are folded into
`description` instead of adding new columns — per the "only add new DB
fields if absolutely necessary" constraint, and because these are
supplementary context rather than data other modules need to query on.
"""

from typing import List

from mappings.iso27001 import get_iso_control

# ZAP's native risk vocabulary -> SecureFlow's canonical severity scale.
# (utils/severity.py's normalize_severity() doesn't have a ZAP branch, and
# its generic fallback would incorrectly bucket "Informational" as MEDIUM —
# so DAST findings arrive already-normalized and skip that ambiguity.)
_ZAP_RISK_MAP = {
    "HIGH": "HIGH",
    "MEDIUM": "MEDIUM",
    "LOW": "LOW",
    "INFORMATIONAL": "LOW",
}

# Best-effort CWE -> OWASP Top 10 (2021) mapping for the CWEs ZAP most
# commonly reports. Falls back to A05:2021 (Security Misconfiguration) —
# a reasonable generic default for web runtime findings — when a CWE isn't
# in this table, the same way other parsers fall back to a fixed default.
_CWE_TO_OWASP = {
    "89":  "A03:2021",   # SQL Injection -> Injection
    "79":  "A03:2021",   # XSS -> Injection
    "78":  "A03:2021",   # OS Command Injection -> Injection
    "90":  "A03:2021",   # LDAP Injection -> Injection
    "611": "A05:2021",   # XXE -> Security Misconfiguration
    "918": "A10:2021",   # SSRF
    "352": "A01:2021",   # CSRF -> Broken Access Control
    "22":  "A01:2021",   # Path Traversal -> Broken Access Control
    "287": "A07:2021",   # Improper Authentication -> Auth Failures
    "384": "A07:2021",   # Session Fixation -> Auth Failures
    "327": "A02:2021",   # Weak Crypto -> Cryptographic Failures
    "319": "A02:2021",   # Cleartext transmission -> Cryptographic Failures
    "798": "A07:2021",   # Hard-coded credentials -> Auth Failures
    "732": "A05:2021",   # Incorrect permissions -> Security Misconfiguration
    "16":  "A05:2021",   # Configuration -> Security Misconfiguration
    "200": "A01:2021",   # Information Exposure -> Broken Access Control
}
_DEFAULT_OWASP = "A05:2021"


def _normalize_zap_severity(risk: str) -> str:
    return _ZAP_RISK_MAP.get((risk or "").strip().upper(), "MEDIUM")


def _format_cwe(cweid) -> str:
    cweid_str = str(cweid).strip() if cweid is not None else ""
    if not cweid_str or cweid_str in ("-1", "0"):
        return "CWE-000"
    return f"CWE-{cweid_str}"


def _build_description(alert: dict) -> str:
    """Folds ZAP-only context (evidence/param/solution/reference) into the
    description text, since Finding has no dedicated columns for them."""
    parts = []

    desc = (alert.get("description") or "").strip()
    if desc:
        parts.append(desc)

    param = (alert.get("param") or "").strip()
    if param:
        parts.append(f"Affected parameter: {param}")

    evidence = (alert.get("evidence") or "").strip()
    if evidence:
        parts.append(f"Evidence: {evidence}")

    confidence = (alert.get("confidence") or "").strip()
    if confidence:
        parts.append(f"Confidence: {confidence}")

    solution = (alert.get("solution") or "").strip()
    if solution:
        parts.append(f"Recommended fix: {solution}")

    reference = (alert.get("reference") or "").strip()
    if reference:
        parts.append(f"Reference: {reference}")

    return "\n\n".join(parts) if parts else "No description available."


def normalize_zap_findings(alerts: List[dict]) -> List[dict]:
    """
    Normalize a list of raw ZAP alert dicts into SecureFlow's shared finding
    shape (matches models.finding.Finding and the other scanner parsers).
    """
    findings = []

    for alert in alerts or []:
        cwe = _format_cwe(alert.get("cweid"))
        iso = get_iso_control(cwe=cwe, scanner="dast")

        findings.append({
            "title": alert.get("alert") or alert.get("name") or "Unknown DAST Finding",
            "severity": _normalize_zap_severity(alert.get("risk")),
            # No source file for a runtime finding — the affected URL is the
            # closest equivalent, so it goes in the `file` field the same
            # way container findings put the image name there.
            "file": alert.get("url", "Unknown URL"),
            "line": 0,
            "description": _build_description(alert),
            "rule": alert.get("pluginId") or alert.get("alertRef") or "N/A",
            "cwe": cwe,
            "owasp": _CWE_TO_OWASP.get(str(alert.get("cweid") or ""), _DEFAULT_OWASP),
            "scanner": "dast",
            "iso27001_control": iso["id"],
            "iso27001_control_name": iso["name"],
            "iso27001_description": iso["description"],
            # SCA-only fields — not applicable to DAST, left as None like
            # SAST/IaC/Secrets findings already do.
            "installed_version": None,
            "fixed_version": None,
            "cvss": None,
            "ecosystem": None,
        })

    return findings

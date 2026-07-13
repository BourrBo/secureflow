from mappings.iso27001 import get_iso_control
from utils.severity import normalize_severity


def _extract_cvss_score(vuln: dict):
    """Trivy nests CVSS scores per vendor source (ghsa, redhat, nvd, etc).
    Just take the first V3Score we find — good enough for display purposes."""
    cvss_data = vuln.get("CVSS", {})
    for source in cvss_data.values():
        score = source.get("V3Score")
        if score is not None:
            return float(score)
    return None


def normalize_trivy_findings(data):
    findings = []

    for result in data.get("Results", []):

        target = result.get("Target", "")
        ecosystem = result.get("Type", "")  # e.g. "npm", "pip", "maven"

        for vuln in result.get("Vulnerabilities", []):

            cwe_ids = vuln.get("CweIDs", [])
            cwe = cwe_ids[0] if cwe_ids else "CWE-000"

            iso = get_iso_control(cwe=cwe, scanner="trivy")

            findings.append({
                "title": vuln.get("PkgName", "Unknown Package"),
                "severity": normalize_severity(vuln.get("Severity", "UNKNOWN"), scanner="trivy"),
                "file": target,
                "line": 0,
                "description": vuln.get("Title", ""),
                "rule": vuln.get("VulnerabilityID", ""),
                "cwe": cwe,
                "owasp": "A06:2021",
                "scanner": "trivy",
                "iso27001_control": iso["id"],
                "iso27001_control_name": iso["name"],
                "iso27001_description": iso["description"],
                "installed_version": vuln.get("InstalledVersion"),
                "fixed_version": vuln.get("FixedVersion"),
                "cvss": _extract_cvss_score(vuln),
                "ecosystem": ecosystem,
            })

    return findings
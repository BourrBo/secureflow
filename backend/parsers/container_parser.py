from typing import List

from mappings.iso27001 import get_iso_control
from utils.severity import normalize_severity
from services.epss_service import get_epss_scores


def _extract_cvss_score(vuln: dict):
    """Trivy nests CVSS scores per vendor source (ghsa, redhat, nvd, etc).
    Just take the first V3Score we find — good enough for display purposes.
    Mirrors parsers/trivy_parser.py's _extract_cvss_score so container and
    SCA findings behave the same way."""
    cvss_data = vuln.get("CVSS", {})
    for source in cvss_data.values():
        score = source.get("V3Score")
        if score is not None:
            return float(score)
    return None


def normalize_container_findings(data: dict) -> List[dict]:
    """
    Normalize Trivy container image scan results into the same
    finding structure used by the SecureFlow frontend / database
    (matches models.finding.Finding and the other scanner parsers).
    """

    findings = []
    cves = set()

    image_name = data.get("ArtifactName", "Unknown Image")

    results = data.get("Results", [])

    for result in results:

        ecosystem = result.get("Type", "Container")  # e.g. "debian", "alpine", "npm"

        vulnerabilities = result.get("Vulnerabilities", [])

        for vulnerability in vulnerabilities:

            cwe_ids = vulnerability.get("CweIDs", [])
            cwe = cwe_ids[0] if cwe_ids else "CWE-000"

            iso = get_iso_control(cwe=cwe, scanner="container")

            # Trivy's VulnerabilityID is the CVE (or GHSA/DSA id) for image
            # vulns — same field trivy_parser.py uses for SCA findings.
            cve = vulnerability.get("VulnerabilityID") or "N/A"
            if cve != "N/A" and cve.startswith("CVE-"):
                cves.add(cve)

            findings.append({

                "title": vulnerability.get("PkgName", "Unknown Package"),

                "severity": normalize_severity(
                    vulnerability.get("Severity", "UNKNOWN"),
                    scanner="container",
                ),

                "file": image_name,

                "line": 0,

                "description": (
                    vulnerability.get("Title")
                    or vulnerability.get("Description")
                    or "No description available."
                ),

                "rule": vulnerability.get("VulnerabilityID", "N/A"),

                "cwe": cwe,

                "owasp": "A06:2021",

                "scanner": "container",

                "installed_version": vulnerability.get(
                    "InstalledVersion", "Unknown"
                ),

                "fixed_version": vulnerability.get(
                    "FixedVersion", "No fix available"
                ),

                "cvss": _extract_cvss_score(vulnerability),

                "ecosystem": ecosystem,

                "cve": cve,

                "epss_score": "N/A",
                "epss_percentile": "N/A",
                "epss_risk_level": "LOW",

                "iso27001_control": iso["id"],

                "iso27001_control_name": iso["name"],

                "iso27001_description": iso["description"],
            })

    if cves:

        epss = get_epss_scores(list(cves))

        for finding in findings:

            cve = finding["cve"]

            if cve in epss:

                finding["epss_score"] = epss[cve]["score"]
                finding["epss_percentile"] = epss[cve]["percentile"]
                finding["epss_risk_level"] = epss[cve]["risk_level"]

    return findings

from typing import List


def normalize_container_findings(data: dict) -> List[dict]:
    """
    Normalize Trivy container image scan results into the same
    finding structure used by the SecureFlow frontend.
    """

    findings = []

    image_name = data.get("ArtifactName", "Unknown Image")

    results = data.get("Results", [])

    for result in results:

        vulnerabilities = result.get("Vulnerabilities", [])

        for vulnerability in vulnerabilities:

            findings.append({

                "title": vulnerability.get("PkgName", "Unknown Package"),

                "severity": vulnerability.get("Severity", "UNKNOWN"),

                "file": image_name,

                "line": 0,

                "description": (
                    vulnerability.get("Title")
                    or vulnerability.get("Description")
                    or "No description available."
                ),

                "rule": vulnerability.get("VulnerabilityID", "N/A"),

                "cwe": "N/A",

                "owasp": "A06:2021",

                "scanner": "container",

                "installed_version": vulnerability.get(
                    "InstalledVersion", "Unknown"
                ),

                "fixed_version": vulnerability.get(
                    "FixedVersion", "No fix available"
                ),

                "cvss": (
                    vulnerability.get("CVSS", {})
                    .get("nvd", {})
                    .get("V3Score")
                ),

                "ecosystem": result.get("Type", "Container"),

                "iso27001_control": "8.8",

                "iso27001_control_name": "Management of technical vulnerabilities",

                "iso27001_description": (
                    "Information about technical vulnerabilities "
                    "shall be obtained, evaluated and remediated."
                ),
            })

    return findings
"""
parsers/secrets_parser.py
Converts the secret-detection scanner's internal SecretFinding objects into
the shared `Finding` shape used across SAST/SCA/IaC, so the frontend can
treat all four scanners uniformly via the `scanner` field.
"""

from secret_detection.scanner import ScanResult


# Secret detection findings don't map to a single CWE — leave the mapping
# loose but still meaningful where it clearly applies.
_CWE_BY_RULE = {
    "aws-access-key": "CWE-798",
    "aws-secret-key": "CWE-798",
    "github-token": "CWE-798",
    "gitlab-token": "CWE-798",
    "slack-token": "CWE-798",
    "slack-webhook": "CWE-798",
    "google-api-key": "CWE-798",
    "stripe-key": "CWE-798",
    "openai-key": "CWE-798",
    "private-key-block": "CWE-798",
    "jwt": "CWE-798",
    "generic-api-key-assignment": "CWE-798",
    "db-connection-string": "CWE-798",
    "npm-token": "CWE-798",
}


def normalize_secret_findings(result: ScanResult):
    findings = []

    for f in result.findings:
        findings.append({
            "title": f.rule_id,
            "severity": f.severity.value,  # already lowercase: critical/high/medium/low
            "file": f.file_path,
            "line": f.line,
            "description": f.description + f" (matched: {f.match})",
            "rule": f.rule_id,
            "cwe": _CWE_BY_RULE.get(f.rule_id, "CWE-798"),  # CWE-798: Use of Hard-coded Credentials
            "owasp": "A02:2021",  # Cryptographic Failures — closest OWASP Top 10 bucket for exposed secrets
            "scanner": "secrets",
        })

    return findings

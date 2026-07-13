"""
utils/severity.py

Every scanner speaks a slightly different severity vocabulary natively:

  - Semgrep:  ERROR / WARNING / INFO
  - Trivy:    CRITICAL / HIGH / MEDIUM / LOW / UNKNOWN   (already uppercase)
  - Checkov:  CRITICAL / HIGH / MEDIUM / LOW / INFO
  - Secrets:  critical / high / medium / low             (lowercase enum)

Left unnormalized, this breaks any filter or aggregation that assumes one
consistent scale (e.g. GET /api/findings?severity=CRITICAL silently missing
rows stored as "critical"). This module is the single place all findings
get mapped onto one canonical scale: CRITICAL / HIGH / MEDIUM / LOW.
"""

_SEMGREP_MAP = {
    "ERROR": "HIGH",
    "WARNING": "MEDIUM",
    "INFO": "LOW",
}

_CANONICAL = {"CRITICAL", "HIGH", "MEDIUM", "LOW"}


def normalize_severity(raw, scanner: str = None) -> str:
    """Returns one of CRITICAL / HIGH / MEDIUM / LOW, regardless of the
    scanner's native vocabulary or casing."""
    if not raw:
        return "MEDIUM"

    value = str(raw).strip().upper()

    if scanner == "semgrep":
        return _SEMGREP_MAP.get(value, "MEDIUM")

    if value in _CANONICAL:
        return value

    # Checkov's "INFO", Trivy's "UNKNOWN", or anything else unrecognized —
    # treat as the lowest real tier rather than silently dropping the finding
    # or crashing on an unexpected string.
    if value in {"INFO", "UNKNOWN", "NONE"}:
        return "LOW"

    return "MEDIUM"

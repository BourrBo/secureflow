"""
services/priority_service.py

Gives every finding type a comparable 0-100 priority score, regardless of
whether it has a CVE:

- CVE-bearing findings (SCA, Container): the score IS EPSS (probability of
  real-world exploitation in the next 30 days, published by FIRST.org),
  scaled to 0-100. This is a genuine exploit-prediction number.
- Everything else (SAST, IaC, Secrets, DAST): there is no CVE to look an
  EPSS score up for, so this uses severity x CWE-danger-weight x
  confidence instead. This is NOT exploit prediction — it's a defensible
  weakness-class severity ranking based on MITRE's real published CWE
  Top 25 data. The `priority_basis` field on every finding tells you
  which kind of number you're looking at; don't treat them as
  interchangeable in isolation, only as a same-UI-column priority order.
"""

from mappings.cwe_top25 import get_cwe_danger_weight

_SEVERITY_WEIGHT = {
    "CRITICAL": 1.00,
    "HIGH": 0.75,
    "MEDIUM": 0.50,
    "LOW": 0.25,
}

_CONFIDENCE_WEIGHT = {
    "HIGH": 1.00,
    "MEDIUM": 0.85,
    "LOW": 0.65,
}


def _risk_level(score: float) -> str:
    """Same bucket thresholds for every basis (EPSS or CWE-weighted) so the
    frontend badge logic doesn't need a per-scanner special case."""
    if score >= 70:
        return "CRITICAL"
    if score >= 40:
        return "HIGH"
    if score >= 10:
        return "MEDIUM"
    return "LOW"


def compute_cwe_priority(severity: str, cwe: str | None, confidence: str | None = None) -> dict:
    """For findings with no CVE (SAST/IaC/Secrets/DAST)."""
    sev_w = _SEVERITY_WEIGHT.get((severity or "").upper(), 0.5)
    cwe_w = get_cwe_danger_weight(cwe)
    conf_w = _CONFIDENCE_WEIGHT.get((confidence or "").upper(), 1.0)

    score = round(100 * sev_w * cwe_w * conf_w, 1)

    return {
        "priority_score": score,
        "priority_basis": "CWE-Weighted",
        "priority_risk_level": _risk_level(score),
    }


def compute_epss_priority(epss_score) -> dict:
    """For findings with a real CVE (SCA/Container) — reuses the EPSS
    score the parser already fetched from epss_service, just rescaled
    and bucketed to match the CWE-weighted path's 0-100 range so both
    show up sensibly in the same UI column."""
    try:
        score = round(float(epss_score) * 100, 1)
    except (TypeError, ValueError):
        # "N/A" (no EPSS data for this CVE) or missing entirely.
        return {
            "priority_score": None,
            "priority_basis": "EPSS",
            "priority_risk_level": None,
        }

    return {
        "priority_score": score,
        "priority_basis": "EPSS",
        "priority_risk_level": _risk_level(score),
    }

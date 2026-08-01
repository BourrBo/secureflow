"""
mappings/cwe_top25.py

Danger weights derived from the real, published 2024 CWE Top 25 Most
Dangerous Software Weaknesses list (MITRE/CISA, released June 25 2024,
based on 31,770 CVE records from June 2023-June 2024).

Source: https://cwe.mitre.org/top25/archive/2024/2024_top25_list.html
(raw "Score" column per CWE, combining CVE prevalence and average CVSS
severity — see MITRE's scoring methodology at
https://cwe.mitre.org/scoring/index.html)

This exists to give SAST/IaC/Secrets/DAST findings a comparable priority
signal to EPSS, without pretending EPSS applies where it can't: EPSS is
keyed to a specific published CVE, and these finding types generally
don't have one. The CWE Top 25's "danger score" is the closest legitimate
published equivalent — it's a weakness-class severity ranking rather
than a live-exploit-probability prediction, but it's real, sourced data
rather than an invented number.

Weights are the raw MITRE score normalized against the #1-ranked
weakness's score (45.54), so CWE-79 (rank 1) = 1.0 and everything else
scales down from there. This list should be re-pulled and updated when
MITRE publishes the next year's Top 25 (typically each June) — don't
let it silently go stale.
"""

_RAW_SCORE_2024 = {
    "CWE-79":  45.54,  # Cross-site Scripting
    "CWE-787": 43.67,  # Out-of-bounds Write
    "CWE-89":  34.27,  # SQL Injection
    "CWE-22":  24.66,  # Path Traversal
    "CWE-352": 23.08,  # Cross-Site Request Forgery (CSRF)
    "CWE-434": 20.26,  # Unrestricted Upload of File with Dangerous Type
    "CWE-125": 18.64,  # Out-of-bounds Read
    "CWE-78":  16.44,  # OS Command Injection
    "CWE-20":  15.98,  # Improper Input Validation
    "CWE-862": 15.60,  # Missing Authorization
    "CWE-476": 15.34,  # NULL Pointer Dereference
    "CWE-287": 15.15,  # Improper Authentication
    "CWE-798": 13.84,  # Use of Hard-coded Credentials
    "CWE-918": 13.74,  # Server-Side Request Forgery (SSRF)
    "CWE-119": 13.60,  # Improper Restriction of Operations within Memory Buffer Bounds
    "CWE-416": 12.89,  # Use After Free
    "CWE-863": 11.97,  # Incorrect Authorization
    "CWE-94":  11.72,  # Improper Control of Generation of Code (Code Injection)
    "CWE-502": 10.29,  # Deserialization of Untrusted Data
    "CWE-77":   9.45,  # Command Injection
    "CWE-306":  9.38,  # Missing Authentication for Critical Function
    "CWE-269":  8.92,  # Improper Privilege Management
    "CWE-401":  8.70,  # Missing Release of Memory after Effective Lifetime
    "CWE-190":  8.60,  # Integer Overflow or Wraparound
    "CWE-522":  8.54,  # Insufficiently Protected Credentials
}

_MAX_SCORE = max(_RAW_SCORE_2024.values())

# CWEs not on the current Top 25 get this instead of 0 — being off the
# list means "not among the ~25 statistically dominant weakness classes
# this year", not "harmless". Set deliberately below the lowest ranked
# entry (CWE-522, normalized ~0.188) rather than matching it, so being
# unranked never outscores something MITRE's real data did rank.
DEFAULT_WEIGHT = 0.15

CWE_DANGER_WEIGHT = {cwe: round(score / _MAX_SCORE, 3) for cwe, score in _RAW_SCORE_2024.items()}


def get_cwe_danger_weight(cwe: str | None) -> float:
    """Returns a 0-1 danger weight for a CWE ID, or DEFAULT_WEIGHT if it's
    not on the current Top 25 (including unrecognized/placeholder CWEs
    like the "CWE-000" default some parsers use when nothing better is
    known)."""
    if not cwe:
        return DEFAULT_WEIGHT
    return CWE_DANGER_WEIGHT.get(cwe.strip().upper(), DEFAULT_WEIGHT)

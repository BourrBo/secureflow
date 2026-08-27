from pydantic import BaseModel


class CodeLine(BaseModel):
    ln: int
    code: str
    highlight: bool = False

class Finding(BaseModel):
    title: str
    severity: str
    file: str
    line: int
    description: str
    rule: str
    cwe: str = "CWE-000"
    owasp: str = "A05:2021"
    scanner: str = "semgrep"
    # ISO/IEC 27001:2022 Annex A control mapping (Table A.1)
    iso27001_control: str = "8.28"
    iso27001_control_name: str = "Secure coding"
    iso27001_description: str = "Secure coding principles shall be applied to software development."
    code_context: list[CodeLine] = []
    # SCA-only fields — left as None for SAST (Semgrep) findings
    installed_version: str | None = None
    fixed_version: str | None = None
    cvss: float | None = None
    ecosystem: str | None = None

    # VAPT-report fields (Laati/Roamassist-style "Detailed Observations")
    cve: str | None = None
    cvss_vector: str | None = None

    # EPSS
    epss_score: str | None = None
    epss_percentile: str | None = None
    epss_risk_level: str | None = None            # left as string ("N/A" is a valid value)
    affected_location: str | None = None          # base host/target, e.g. "https://roamassist.in"
    affected_path: str | None = None              # full vulnerable path/URL/port
    affected_parameter: str | None = None         # vulnerable parameter/field name
    recommendation: str | None = None             # Workaround / Solutions / Recommendations
    references: list[str] = []                    # OWASP/CWE reference links. NOTE: stored in
                                                    # Postgres as `reference_links` -- REFERENCES is
                                                    # a reserved keyword, see db_service.py.
    additional_observations: str | None = None
    revalidation_status: str = "Open"                # "Open" | "Closed" | "Accepted Risk"
    new_or_repeat: str = "New"                        # "New" | "Repeat"

    # Unified priority (see services/priority_service.py) -- EPSS-based for
    # CVE-bearing findings (SCA/Container), CWE-Top-25-weighted otherwise
    # (SAST/IaC/Secrets/DAST), always on the same 0-100 scale. Not yet wired
    # into any scanner/route (priority_service.py exists but nothing calls
    # it) -- these are always None today. That's a separate follow-up, not
    # part of this dedup/lifecycle change.
    priority_score: float | None = None
    priority_basis: str | None = None              # "EPSS" | "CWE-Weighted"
    priority_risk_level: str | None = None          # CRITICAL | HIGH | MEDIUM | LOW

    # Cross-engine dedup (see services/dedup_service.py) -- computed at
    # insert time, not set by parsers. fingerprint is always present;
    # unique_id_from_tool only for scanners with a trustworthy native id
    # (currently Trivy/Container CVEs).
    fingerprint: str | None = None
    unique_id_from_tool: str | None = None
    duplicate_of: int | None = None                 # id of the canonical finding, if this is a
                                                      # duplicate detection (see db_service.insert_findings)

    # Finding lifecycle -- Open is the only state a finding starts in;
    # everything else is a reviewer action via PATCH /api/findings/{id}.
    # Lifecycle fields (status/owner/notes) only ever live on the CANONICAL
    # row (duplicate_of IS NULL) -- duplicate detections inherit the
    # canonical's status for display and cannot be edited directly.
    status: str = "Open"                            # "Open" | "Triaged" | "Fixed" | "Accepted"
    owner: str | None = None
    notes: str | None = None

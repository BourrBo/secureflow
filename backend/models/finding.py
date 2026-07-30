
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
    references: list[str] = []                       # OWASP/CWE reference links
    additional_observations: str | None = None
    revalidation_status: str = "Open"                # "Open" | "Closed" | "Accepted Risk"
    new_or_repeat: str = "New"                        # "New" | "Repeat"
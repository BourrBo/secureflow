from pydantic import BaseModel
from typing import List, Optional

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
    code_context: List[CodeLine] = []
    # SCA-only fields — left as None for SAST (Semgrep) findings
    installed_version: Optional[str] = None
    fixed_version: Optional[str] = None
    cvss: Optional[float] = None
    ecosystem: Optional[str] = None

    # VAPT-report fields (Laati/Roamassist-style "Detailed Observations")
    cve: Optional[str] = None
    cvss_vector: Optional[str] = None

    # EPSS
    epss_score: Optional[str] = None
    epss_percentile: Optional[str] = None
    epss_risk_level: Optional[str] = None            # left as string ("N/A" is a valid value)
    affected_location: Optional[str] = None          # base host/target, e.g. "https://roamassist.in"
    affected_path: Optional[str] = None              # full vulnerable path/URL/port
    affected_parameter: Optional[str] = None         # vulnerable parameter/field name
    recommendation: Optional[str] = None             # Workaround / Solutions / Recommendations
    references: List[str] = []                       # OWASP/CWE reference links
    additional_observations: Optional[str] = None
    revalidation_status: str = "Open"                # "Open" | "Closed" | "Accepted Risk"
    new_or_repeat: str = "New"                        # "New" | "Repeat"
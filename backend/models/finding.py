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
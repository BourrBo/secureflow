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
    code_context: List[CodeLine] = []
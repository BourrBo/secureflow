from pydantic import BaseModel

class Finding(BaseModel):
    title: str
    severity: str
    file: str
    line: int
    description: str
    rule: str
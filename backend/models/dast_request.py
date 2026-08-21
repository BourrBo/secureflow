from typing import Literal

from pydantic import BaseModel, Field


class DastScanRequest(BaseModel):
    target_url: str = Field(
        ...,
        description="Full URL of the running target application.",
    )

    scan_mode: Literal["quick", "standard", "full"] = Field(
        default="standard",
        description="DAST scan profile.",
    )

    attack_strength: Literal["LOW", "MEDIUM", "HIGH", "INSANE"] = Field(
        default="MEDIUM",
        description=(
            "How aggressively the active scanner attacks each rule. "
            "If omitted, MEDIUM is used; INSANE must be explicitly selected."
        ),
    )

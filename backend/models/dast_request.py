from typing import Literal

from pydantic import BaseModel, Field


class DastScanRequest(BaseModel):
    """
    Request body for POST /api/dast/scan.

    Example:
    {
        "target_url": "http://localhost:3000",
        "scan_mode": "standard",
        "attack_strength": "MEDIUM"
    }

    Scan Modes

    quick
        Fast spider + passive scan only.

    standard
        Spider + passive + active scan.

    full
        Spider + AJAX spider + passive + active scan with
        extended limits for maximum coverage.

    Scan mode controls SCOPE only (which phases run). It no longer
    determines aggressiveness — that's `attack_strength` below, a fully
    independent axis the caller must choose explicitly.
    """

    target_url: str = Field(
        ...,
        description=(
            "Full URL of the running target application. "
            "Example: http://localhost:3000"
        ),
    )

    scan_mode: Literal["quick", "standard", "full"] = Field(
        default="standard",
        description=(
            "DAST scan profile."
        ),
    )

    attack_strength: Literal["LOW", "MEDIUM", "HIGH", "INSANE"] = Field(
        default="MEDIUM",
        description=(
            "How aggressively the active scanner attacks each rule (ZAP's "
            "own values). This is a deliberate, explicit choice by the "
            "caller — it is NEVER inferred from scan_mode. If the field is "
            "omitted entirely, it defaults to MEDIUM. INSANE can send tens "
            "of thousands of requests and run for hours; it must be chosen "
            "on purpose, never silently defaulted to."
        ),
    )
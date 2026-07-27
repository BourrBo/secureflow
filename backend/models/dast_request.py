from typing import Literal

from pydantic import BaseModel, Field


class DastScanRequest(BaseModel):
    """
    Request body for POST /api/dast/scan.

    Example:
    {
        "target_url": "http://localhost:3000",
        "scan_mode": "standard"
    }

    Scan Modes

    quick
        Fast spider + passive scan only.

    standard
        Spider + passive + active scan.

    full
        Spider + AJAX spider + passive + active scan with
        extended limits for maximum coverage.
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
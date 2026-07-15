from typing import Optional

from pydantic import BaseModel, Field


class DastScanRequest(BaseModel):
    """
    Request body for POST /api/dast/scan.

    Unlike SAST/SCA (which take a repo_url) or Container (which takes an
    image_name), DAST needs a *live, already-running* target — SecureFlow
    doesn't start your application for you, it only points OWASP ZAP at it.

    Example:
        {
            "target_url": "http://localhost:3000",
            "max_spider_duration_mins": 5,
            "max_scan_duration_mins": 15
        }
    """

    target_url: str = Field(
        ...,
        description=(
            "Full URL of the running target application, e.g. "
            "http://localhost:3000 or http://127.0.0.1:8080. Must be "
            "reachable from the machine running the backend/ZAP."
        ),
    )

    # Safety caps — an active scan against a real app can run indefinitely
    # if left unbounded. These give a hard ceiling so a DAST run can't hang
    # the backend or lock up a shared dev machine.
    max_spider_duration_mins: Optional[int] = Field(
        default=5,
        ge=1,
        le=60,
        description="Hard cap on the spider crawl phase, in minutes.",
    )
    max_scan_duration_mins: Optional[int] = Field(
        default=15,
        ge=1,
        le=120,
        description="Hard cap on the active scan phase, in minutes.",
    )

"""
routes/dast.py

POST /api/dast/scan
    Runs a full OWASP ZAP dynamic scan (spider -> passive -> active) against
    a live target URL and persists the results, following the exact same
    project/scan/findings pattern as routes/container.py and the other
    scan routes.

NOT YET mounted in main.py — that's a Phase 4 step, done only after this
route has been exercised standalone (see scripts/test_zap_scan.py) so a
routing/wiring mistake never gets confused with a ZAP integration mistake.
"""

import logging

from fastapi import APIRouter, HTTPException
from typing import List

from models.finding import Finding
from models.dast_request import DastScanRequest

from scanners.zap_runner import run_zap_scan, ZapScanError
from parsers.zap_parser import normalize_zap_findings

from services.db_service import (
    get_or_create_project,
    create_scan,
    finish_scan,
    insert_findings,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/api/dast/scan",
    response_model=List[Finding],
)
def scan_dast(request: DastScanRequest):
    """
    Scan a running target application with OWASP ZAP and persist the
    results.

    Example Request:
    {
        "target_url": "http://localhost:3000",
        "max_spider_duration_mins": 5,
        "max_scan_duration_mins": 15
    }

    Unlike SAST/SCA/IaC/Secrets (which clone/extract source first) or
    Container (which just needs an image name), DAST needs the target
    already running and reachable — SecureFlow does not start it for you.
    """

    # DAST has no git repo / uploaded zip — the "project" identity is the
    # target URL itself. source_type="upload" is reused rather than adding
    # a new source_type to the projects table's CHECK constraint, the same
    # way routes/container.py reuses it for image names.
    project_id = get_or_create_project(
        name=request.target_url,
        source_type="upload",
    )
    scan_id = create_scan(project_id, "dast")
    logger.info("DAST scan #%s created for project #%s (target=%s)", scan_id, project_id, request.target_url)

    try:
        raw_alerts = run_zap_scan(
            target_url=request.target_url,
            max_spider_duration_mins=request.max_spider_duration_mins,
            max_scan_duration_mins=request.max_scan_duration_mins,
        )

        findings = normalize_zap_findings(raw_alerts)

        insert_findings(scan_id, findings)
        finish_scan(scan_id, "completed")
        logger.info("DAST scan #%s completed — %d findings persisted", scan_id, len(findings))

        return findings

    except ZapScanError as e:
        logger.error("DAST scan #%s failed (ZAP error): %s", scan_id, e)
        finish_scan(scan_id, "failed")
        raise HTTPException(status_code=502, detail=str(e))

    except Exception as e:
        logger.exception("DAST scan #%s failed (unexpected error)", scan_id)
        finish_scan(scan_id, "failed")
        raise HTTPException(status_code=500, detail=str(e))

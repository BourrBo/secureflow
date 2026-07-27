import logging
from typing import List

from fastapi import APIRouter, HTTPException

from config.dast_profiles import SCAN_PROFILES

from models.dast_request import DastScanRequest
from models.finding import Finding

from parsers.zap_parser import normalize_zap_findings
from scanners.zap_runner import (
    ZapScanError,
    run_zap_scan,
)

from services.db_service import (
    create_scan,
    finish_scan,
    get_or_create_project,
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
    Execute a DAST scan against a running web application.
    """

    print("ROUTE STEP 1 - Route entered", flush=True)

    profile = SCAN_PROFILES[request.scan_mode]

    print("ROUTE STEP 2 - Profile loaded", flush=True)

    project_id = get_or_create_project(
        name=request.target_url,
        source_type="upload",
    )

    print(f"ROUTE STEP 3 - Project created/found: {project_id}", flush=True)

    scan_id = create_scan(
        project_id,
        "dast",
    )

    print(f"ROUTE STEP 4 - Scan created: {scan_id}", flush=True)

    logger.info(
        "Starting %s DAST scan #%s against %s",
        request.scan_mode.upper(),
        scan_id,
        request.target_url,
    )

    try:

        print("ROUTE STEP 5 - Calling run_zap_scan()", flush=True)

        raw_alerts = run_zap_scan(
            target_url=request.target_url,
            scan_mode=request.scan_mode,
        )

        print("ROUTE STEP 6 - run_zap_scan() returned", flush=True)

        findings = normalize_zap_findings(raw_alerts)

        print(f"ROUTE STEP 7 - Findings normalized: {len(findings)}", flush=True)

        insert_findings(
            scan_id,
            findings,
        )

        print("ROUTE STEP 8 - Findings inserted", flush=True)

        finish_scan(
            scan_id,
            "completed",
        )

        print("ROUTE STEP 9 - Scan marked completed", flush=True)

        logger.info(
            "DAST scan #%s completed successfully with %d findings",
            scan_id,
            len(findings),
        )

        return findings

    except ZapScanError as exc:

        print(f"ROUTE ERROR (ZapScanError): {exc}", flush=True)

        logger.error(
            "DAST scan #%s failed: %s",
            scan_id,
            exc,
        )

        finish_scan(
            scan_id,
            "failed",
        )

        raise HTTPException(
            status_code=502,
            detail=str(exc),
        )

    except Exception as exc:

        print(f"ROUTE ERROR (Exception): {exc}", flush=True)

        logger.exception("Unexpected DAST error")

        try:
            finish_scan(
                scan_id,
                "failed",
            )
        except Exception:
            pass

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )
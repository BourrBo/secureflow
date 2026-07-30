import logging

from fastapi import APIRouter, HTTPException

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
    response_model=list[Finding],
)
def scan_dast(request: DastScanRequest):
    """
    Execute a DAST scan against a running web application.
    """

    project_id = get_or_create_project(
        name=request.target_url,
        source_type="upload",
    )

    scan_id = create_scan(
        project_id,
        "dast",
    )

    logger.info(
        "Starting %s DAST scan #%s against %s",
        request.scan_mode.upper(),
        scan_id,
        request.target_url,
    )

    try:

        raw_alerts = run_zap_scan(
            target_url=request.target_url,
            scan_mode=request.scan_mode,
        )

        findings = normalize_zap_findings(raw_alerts)

        insert_findings(
            scan_id,
            findings,
        )

        finish_scan(
            scan_id,
            "completed",
        )

        logger.info(
            "DAST scan #%s completed successfully with %d findings",
            scan_id,
            len(findings),
        )

        return findings

    except ZapScanError as exc:

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
        ) from exc

    except Exception as exc:
        # unexpected (not just ZapScanError) so we still return a clean 500
        # instead of an unhandled crash.

        logger.exception("Unexpected DAST error")

        try:
            finish_scan(
                scan_id,
                "failed",
            )
        except Exception as cleanup_exc:  # noqa: BLE001 — this is already
            # inside error handling for the original exception; a failure
            # here must not mask `exc`, just get logged.
            logger.error(
                "Also failed to mark scan #%s as failed: %s",
                scan_id,
                cleanup_exc,
            )

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        ) from exc
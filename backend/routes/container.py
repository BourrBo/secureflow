import logging

from fastapi import APIRouter, Depends, HTTPException

from models.container_request import ContainerScanRequest
from models.finding import Finding
from parsers.container_parser import normalize_container_findings
from scanners.container_runner import run_container_scan
from services.auth_service import get_current_user_id
from services.db_service import (
    create_scan,
    finish_scan,
    get_or_create_project,
    insert_findings,
)

router = APIRouter()

logger = logging.getLogger(__name__)


@router.post(
    "/api/container/scan",
    response_model=list[Finding],
)
def scan_container(request: ContainerScanRequest, user_id: str = Depends(get_current_user_id)):
    """
    Scan a container image with Trivy and persist the results, following
    the same project/scan/findings pattern used by the SAST/SCA/IaC routes.

    Example Request:
    {
        "image_name": "nginx:latest"
    }
    """

    project_id = get_or_create_project(
        user_id,
        name=request.image_name,
        source_type="upload",
    )
    scan_id = create_scan(user_id, project_id, "container")

    try:
        raw_results = run_container_scan(request.image_name)

        findings = normalize_container_findings(raw_results)

        insert_findings(user_id, scan_id, project_id, findings)
        finish_scan(user_id, scan_id, "completed")

        return findings

    except Exception as e:
        # must still mark the scan failed and return a clean 500 instead of
        # a raw traceback.
        logger.exception("Container scan failed for %s", request.image_name)

        finish_scan(user_id, scan_id, "failed")

        raise HTTPException(
            status_code=500,
            detail=str(e)
        ) from e

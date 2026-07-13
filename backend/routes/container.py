from fastapi import APIRouter, HTTPException
from typing import List

from models.container_request import ContainerScanRequest
from models.finding import Finding
from scanners.container_runner import run_container_scan
from parsers.container_parser import normalize_container_findings

from services.db_service import (
    get_or_create_project,
    create_scan,
    finish_scan,
    insert_findings,
)

router = APIRouter()


@router.post(
    "/api/container/scan",
    response_model=List[Finding],
)
def scan_container(request: ContainerScanRequest):
    """
    Scan a container image with Trivy and persist the results, following
    the same project/scan/findings pattern used by the SAST/SCA/IaC routes.

    Example Request:
    {
        "image_name": "nginx:latest"
    }
    """

    project_id = get_or_create_project(
        name=request.image_name,
        source_type="upload",
    )
    scan_id = create_scan(project_id, "container")

    try:
        raw_results = run_container_scan(request.image_name)

        findings = normalize_container_findings(raw_results)

        insert_findings(scan_id, findings)
        finish_scan(scan_id, "completed")

        return findings

    except Exception as e:

        finish_scan(scan_id, "failed")

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

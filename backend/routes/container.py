from fastapi import APIRouter, HTTPException

from models.container_request import ContainerScanRequest
from scanners.container_runner import run_container_scan
from parsers.container_parser import normalize_container_findings

router = APIRouter()


@router.post("/api/container/scan")
def scan_container(request: ContainerScanRequest):
    """
    Scan a container image.

    Example Request:
    {
        "image_name": "nginx:latest"
    }
    """

    try:

        raw_results = run_container_scan(request.image_name)

        findings = normalize_container_findings(raw_results)

        return findings

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
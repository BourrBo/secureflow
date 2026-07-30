"""
routes/secrets.py
FastAPI router for the secret-detection module.

Exposes:
    POST /api/secrets/scan         — scan a public GitHub repo (clones it first)
    POST /api/secrets/scan-local   — scan an uploaded .zip (extracts it first)

Both return List[Finding] — the same shared shape used by SAST/SCA/IaC —
with scanner="secrets", so the frontend can filter/merge findings from all
four scanners identically.
"""

import logging

from fastapi import APIRouter, File, HTTPException, UploadFile

from models.finding import Finding
from models.scan_request import ScanRequest
from parsers.secrets_parser import normalize_secret_findings
from secret_detection.scanner import scan_directory_for_secrets
from services.db_service import (
    create_scan,
    derive_project_name_from_repo_url,
    finish_scan,
    get_or_create_project,
    insert_findings,
)
from services.git_service import cleanup_repo, clone_repo
from services.upload_service import cleanup_upload, save_and_extract_zip

router = APIRouter()

logger = logging.getLogger(__name__)


@router.post(
    "/api/secrets/scan",
    response_model=list[Finding]
)
def scan_secrets(request: ScanRequest):
    repo_path = None

    project_id = get_or_create_project(
        name=derive_project_name_from_repo_url(request.repo_url),
        source_type="git",
        repo_url=request.repo_url,
    )
    scan_id = create_scan(project_id, "secrets")

    try:
        repo_path = clone_repo(request.repo_url)
        result = scan_directory_for_secrets(repo_path)
        findings = normalize_secret_findings(result)
        insert_findings(scan_id, findings)
        finish_scan(scan_id, "completed")
        return findings
    except Exception as e:
        # must still mark the scan failed and return a clean 500.
        logger.exception("Secrets scan failed for %s", request.repo_url)
        finish_scan(scan_id, "failed")
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        if repo_path:
            cleanup_repo(repo_path)


@router.post(
    "/api/secrets/scan-local",
    response_model=list[Finding]
)
def scan_secrets_local(file: UploadFile = File(...)):
    extract_path = None

    project_id = get_or_create_project(
        name=file.filename or "local-upload",
        source_type="upload",
    )
    scan_id = create_scan(project_id, "secrets")

    try:
        extract_path = save_and_extract_zip(file)
        result = scan_directory_for_secrets(extract_path)
        findings = normalize_secret_findings(result)
        insert_findings(scan_id, findings)
        finish_scan(scan_id, "completed")
        return findings
    except Exception as e:
        # must still mark the scan failed and return a clean 500.
        logger.exception("Secrets local scan failed for %s", file.filename)
        finish_scan(scan_id, "failed")
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        if extract_path:
            cleanup_upload(extract_path)

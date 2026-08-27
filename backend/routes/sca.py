import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from models.finding import Finding
from models.scan_request import ScanRequest
from parsers.trivy_parser import normalize_trivy_findings
from scanners.trivy_runner import run_trivy
from services.auth_service import require_scope
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


# ─────────────────────────────────────────────────────────────────────
# SCA — GitHub URL
# ─────────────────────────────────────────────────────────────────────

@router.post(
    "/api/sca/scan",
    response_model=list[Finding],
)
def scan_sca(
    request: ScanRequest,
    user_id: str = Depends(require_scope("scans:run")),
):
    repo_path = None

    project_id = get_or_create_project(
        user_id,
        name=derive_project_name_from_repo_url(request.repo_url),
        source_type="git",
        repo_url=request.repo_url,
    )

    scan_id = create_scan(
        user_id,
        project_id,
        "sca",
    )

    try:
        repo_path = clone_repo(request.repo_url)

        # SCA = Trivy dependency/filesystem vulnerability scan.
        trivy_results = run_trivy(repo_path)
        findings = normalize_trivy_findings(trivy_results)

        insert_findings(
            user_id,
            scan_id,
            project_id,
            findings,
        )

        finish_scan(
            user_id,
            scan_id,
            "completed",
        )

        return findings

    except Exception as e:
        logger.exception(
            "SCA scan failed for %s",
            request.repo_url,
        )

        finish_scan(
            user_id,
            scan_id,
            "failed",
        )

        raise HTTPException(
            status_code=500,
            detail=str(e),
        ) from e

    finally:
        if repo_path:
            cleanup_repo(repo_path)


# ─────────────────────────────────────────────────────────────────────
# SCA — local ZIP
# ─────────────────────────────────────────────────────────────────────

@router.post(
    "/api/sca/scan-local",
    response_model=list[Finding],
)
def scan_sca_local(
    file: UploadFile = File(...),
    user_id: str = Depends(require_scope("scans:run")),
):
    extract_path = None

    project_id = get_or_create_project(
        user_id,
        name=file.filename or "local-upload",
        source_type="upload",
    )

    scan_id = create_scan(
        user_id,
        project_id,
        "sca",
    )

    try:
        extract_path = save_and_extract_zip(file)

        # SCA = Trivy dependency/filesystem vulnerability scan.
        trivy_results = run_trivy(extract_path)
        findings = normalize_trivy_findings(trivy_results)

        insert_findings(
            user_id,
            scan_id,
            project_id,
            findings,
        )

        finish_scan(
            user_id,
            scan_id,
            "completed",
        )

        return findings

    except Exception as e:
        logger.exception(
            "Local SCA scan failed for %s",
            file.filename,
        )

        finish_scan(
            user_id,
            scan_id,
            "failed",
        )

        raise HTTPException(
            status_code=500,
            detail=str(e),
        ) from e

    finally:
        if extract_path:
            cleanup_upload(extract_path)
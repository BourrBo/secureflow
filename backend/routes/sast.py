import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from models.finding import Finding
from models.scan_request import ScanRequest
from parsers.iac_parser import normalize_iac_findings
from parsers.semgrep_parser import normalize_findings
from scanners.iac_scanner import run_iac_scan
from scanners.semgrep_runner import run_semgrep
from services.auth_service import get_current_user_id
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
# SAST — GitHub URL
# ─────────────────────────────────────────────────────────────────────

@router.post(
    "/api/sast/scan",
    response_model=list[Finding],
)
def scan_sast(
    request: ScanRequest,
    user_id: str = Depends(get_current_user_id),
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
        "sast",
    )

    try:
        repo_path = clone_repo(request.repo_url)

        # SAST = source-code security analysis only.
        semgrep_results = run_semgrep(repo_path)
        findings = normalize_findings(semgrep_results)

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
            "SAST scan failed for %s",
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
# SAST — local ZIP
# ─────────────────────────────────────────────────────────────────────

@router.post(
    "/api/sast/scan-local",
    response_model=list[Finding],
)
def scan_sast_local(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
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
        "sast",
    )

    try:
        extract_path = save_and_extract_zip(file)

        # SAST = Semgrep only.
        semgrep_results = run_semgrep(extract_path)
        findings = normalize_findings(semgrep_results)

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
            "Local SAST scan failed for %s",
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


# ─────────────────────────────────────────────────────────────────────
# IaC — GitHub URL
# ─────────────────────────────────────────────────────────────────────

@router.post(
    "/api/iac/scan",
    response_model=list[Finding],
)
def scan_iac(
    request: ScanRequest,
    user_id: str = Depends(get_current_user_id),
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
        "iac",
    )

    try:
        repo_path = clone_repo(request.repo_url)

        raw_results = run_iac_scan(repo_path)
        findings = normalize_iac_findings(raw_results)

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
            "IaC scan failed for %s",
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
# IaC — local ZIP
# ─────────────────────────────────────────────────────────────────────

@router.post(
    "/api/iac/scan-local",
    response_model=list[Finding],
)
def scan_iac_local(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
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
        "iac",
    )

    try:
        extract_path = save_and_extract_zip(file)

        raw_results = run_iac_scan(extract_path)
        findings = normalize_iac_findings(raw_results)

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
            "Local IaC scan failed for %s",
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
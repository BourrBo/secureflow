from fastapi import UploadFile, File
from services.upload_service import save_and_extract_zip, cleanup_upload

from fastapi import APIRouter, HTTPException
from typing import List

from models.finding import Finding
from models.scan_request import ScanRequest

from scanners.semgrep_runner import run_semgrep
from scanners.trivy_runner import run_trivy
from scanners.iac_scanner import run_iac_scan

from parsers.semgrep_parser import normalize_findings
from parsers.trivy_parser import normalize_trivy_findings
from parsers.iac_parser import normalize_iac_findings

from services.git_service import (
    clone_repo,
    cleanup_repo
)
from services.db_service import (
    get_or_create_project,
    derive_project_name_from_repo_url,
    create_scan,
    finish_scan,
    insert_findings,
)

router = APIRouter()


@router.post(
    "/api/sast/scan",
    response_model=List[Finding]
)
def scan(request: ScanRequest):

    repo_path = None

    project_id = get_or_create_project(
        name=derive_project_name_from_repo_url(request.repo_url),
        source_type="git",
        repo_url=request.repo_url,
    )
    sast_scan_id = create_scan(project_id, "sast")
    sca_scan_id = create_scan(project_id, "sca")

    try:

        repo_path = clone_repo(request.repo_url)

        # SAST — scans your own source code for vulnerability patterns
        semgrep_results = run_semgrep(repo_path)
        semgrep_findings = normalize_findings(semgrep_results)

        # SCA — scans dependency manifests/lockfiles for known CVEs
        trivy_results = run_trivy(repo_path)
        trivy_findings = normalize_trivy_findings(trivy_results)

        insert_findings(sast_scan_id, semgrep_findings)
        insert_findings(sca_scan_id, trivy_findings)
        finish_scan(sast_scan_id, "completed")
        finish_scan(sca_scan_id, "completed")
        return semgrep_findings + trivy_findings

    except Exception as e:

        finish_scan(sast_scan_id, "failed")
        finish_scan(sca_scan_id, "failed")

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:

        if repo_path:
            cleanup_repo(repo_path)


@router.post(
    "/api/sast/scan-local",
    response_model=List[Finding]
)
def scan_local(file: UploadFile = File(...)):
    extract_path = None

    project_id = get_or_create_project(
        name=file.filename or "local-upload",
        source_type="upload",
    )
    sast_scan_id = create_scan(project_id, "sast")
    sca_scan_id = create_scan(project_id, "sca")

    try:
        extract_path = save_and_extract_zip(file)

        semgrep_results = run_semgrep(extract_path)
        semgrep_findings = normalize_findings(semgrep_results)

        trivy_results = run_trivy(extract_path)
        trivy_findings = normalize_trivy_findings(trivy_results)

        # EPSS enrichment already happens inside normalize_trivy_findings()

        insert_findings(sast_scan_id, semgrep_findings)
        insert_findings(sca_scan_id, trivy_findings)
        finish_scan(sast_scan_id, "completed")
        finish_scan(sca_scan_id, "completed")

        return semgrep_findings + trivy_findings
    except Exception as e:
        finish_scan(sast_scan_id, "failed")
        finish_scan(sca_scan_id, "failed")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
    finally:
        if extract_path:
            cleanup_upload(extract_path)


# ── IaC: scan from GitHub URL ──────────────────────────────────────
@router.post(
    "/api/iac/scan",
    response_model=List[Finding]
)
def scan_iac(request: ScanRequest):
    repo_path = None

    project_id = get_or_create_project(
        name=derive_project_name_from_repo_url(request.repo_url),
        source_type="git",
        repo_url=request.repo_url,
    )
    scan_id = create_scan(project_id, "iac")

    try:
        repo_path = clone_repo(request.repo_url)
        raw_results = run_iac_scan(repo_path)
        findings = normalize_iac_findings(raw_results)
        insert_findings(scan_id, findings)
        finish_scan(scan_id, "completed")
        return findings
    except Exception as e:
        finish_scan(scan_id, "failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if repo_path:
            cleanup_repo(repo_path)


# ── IaC: scan from uploaded zip ────────────────────────────────────
@router.post(
    "/api/iac/scan-local",
    response_model=List[Finding]
)
def scan_iac_local(file: UploadFile = File(...)):
    extract_path = None

    project_id = get_or_create_project(
        name=file.filename or "local-upload",
        source_type="upload",
    )
    scan_id = create_scan(project_id, "iac")

    try:
        extract_path = save_and_extract_zip(file)
        raw_results = run_iac_scan(extract_path)
        findings = normalize_iac_findings(raw_results)
        insert_findings(scan_id, findings)
        finish_scan(scan_id, "completed")
        return findings
    except Exception as e:
        finish_scan(scan_id, "failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if extract_path:
            cleanup_upload(extract_path)
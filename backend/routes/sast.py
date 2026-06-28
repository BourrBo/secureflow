from fastapi import UploadFile, File
from services.upload_service import save_and_extract_zip, cleanup_upload

from fastapi import APIRouter, HTTPException
from typing import List

from models.finding import Finding
from models.scan_request import ScanRequest

from scanners.semgrep_runner import run_semgrep
from scanners.trivy_runner import run_trivy

from parsers.semgrep_parser import normalize_findings
from parsers.trivy_parser import normalize_trivy_findings

from services.git_service import (
    clone_repo,
    cleanup_repo
)

router = APIRouter()


@router.post(
    "/api/sast/scan",
    response_model=List[Finding]
)
def scan(request: ScanRequest):

    repo_path = None

    try:

        repo_path = clone_repo(request.repo_url)

        # SAST — scans your own source code for vulnerability patterns
        semgrep_results = run_semgrep(repo_path)
        semgrep_findings = normalize_findings(semgrep_results)

        # SCA — scans dependency manifests/lockfiles for known CVEs
        trivy_results = run_trivy(repo_path)
        trivy_findings = normalize_trivy_findings(trivy_results)

        return semgrep_findings + trivy_findings

    except Exception as e:

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
    try:
        extract_path = save_and_extract_zip(file)

        semgrep_results = run_semgrep(extract_path)
        semgrep_findings = normalize_findings(semgrep_results)

        trivy_results = run_trivy(extract_path)
        trivy_findings = normalize_trivy_findings(trivy_results)

        return semgrep_findings + trivy_findings
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
    finally:
        if extract_path:
            cleanup_upload(extract_path)

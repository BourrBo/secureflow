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

from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List

from models.finding import Finding
from models.scan_request import ScanRequest

from secret_detection.scanner import scan_directory_for_secrets
from parsers.secrets_parser import normalize_secret_findings

from services.git_service import clone_repo, cleanup_repo
from services.upload_service import save_and_extract_zip, cleanup_upload

router = APIRouter()


@router.post(
    "/api/secrets/scan",
    response_model=List[Finding]
)
def scan_secrets(request: ScanRequest):
    repo_path = None
    try:
        repo_path = clone_repo(request.repo_url)
        result = scan_directory_for_secrets(repo_path)
        return normalize_secret_findings(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if repo_path:
            cleanup_repo(repo_path)


@router.post(
    "/api/secrets/scan-local",
    response_model=List[Finding]
)
def scan_secrets_local(file: UploadFile = File(...)):
    extract_path = None
    try:
        extract_path = save_and_extract_zip(file)
        result = scan_directory_for_secrets(extract_path)
        return normalize_secret_findings(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if extract_path:
            cleanup_upload(extract_path)

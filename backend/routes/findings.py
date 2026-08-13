"""
routes/findings.py

Read-only view over the findings persisted by the scan endpoints, plus a
DELETE action to clear accumulated findings once they're no longer needed
(without deleting scan/project history). Every route requires a signed-in
user and only ever sees/touches that user's own findings.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from services.auth_service import get_current_user_id
from services.db_service import (
    delete_all_findings,
    delete_all_workspace_data,
    list_findings,
)

router = APIRouter(prefix="/api/findings", tags=["findings"])

logger = logging.getLogger(__name__)


@router.get("")
def get_findings(
    project_id: int | None = Query(default=None),
    scan_id: int | None = Query(default=None),
    severity: str | None = Query(default=None, description="CRITICAL/HIGH/MEDIUM/LOW"),
    scanner: str | None = Query(default=None, description="semgrep/trivy/checkov/secrets"),
    q: str | None = Query(default=None, description="Free-text search across id, title, project name, and scanner -- matched server-side across ALL findings, not just the current page."),
    limit: int | None = Query(default=None, description="Cap the number of rows returned, most recent first. Omit for no limit."),
    offset: int = Query(default=0, ge=0, description="Rows to skip, for paging through results beyond `limit`."),
    user_id: str = Depends(get_current_user_id),
):
    findings, total = list_findings(
        user_id,
        project_id=project_id,
        scan_id=scan_id,
        severity=severity,
        scanner=scanner,
        q=q,
        limit=limit,
        offset=offset,
    )
    return {"count": len(findings), "total": total, "findings": findings}


@router.delete("")
def clear_findings(
    project_id: int | None = Query(default=None, description="Only clear findings for this project"),
    scanner: str | None = Query(default=None, description="Only clear findings from this scanner"),
    user_id: str = Depends(get_current_user_id),
):
    """Deletes findings rows so the dashboard doesn't keep growing unbounded
    across repeated test scans. Scan/project history is left intact —
    only the individual finding rows are removed."""
    try:
        deleted = delete_all_findings(user_id, project_id=project_id, scanner=scanner)
    except Exception as exc:
        # Route boundary: surface as a clean 500 rather than a raw
        # traceback for a destructive action.
        logger.exception("Failed to clear findings")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    logger.info("Cleared %d findings (project_id=%s, scanner=%s)", deleted, project_id, scanner)
    return {"deleted": deleted}

@router.delete("/all")
def clear_all_workspace_data(
    user_id: str = Depends(get_current_user_id),
):
    """Completely reset the authenticated user's SecureFlow workspace.

    Deletes findings first, then their scans, then projects. The operation is
    scoped to the authenticated user and runs inside the database transaction.
    """
    try:
        deleted = delete_all_workspace_data(user_id)
    except Exception as exc:
        logger.exception("Failed to clear all workspace data")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    logger.info(
        "Workspace reset for user %s: findings=%d scans=%d projects=%d",
        user_id,
        deleted["findings"],
        deleted["scans"],
        deleted["projects"],
    )
    return {"status": "cleared", **deleted}

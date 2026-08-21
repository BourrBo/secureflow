"""Read-only view over findings plus workspace-reset actions."""

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
    scanner: str | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
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
    project_id: int | None = Query(default=None),
    scanner: str | None = Query(default=None),
    user_id: str = Depends(get_current_user_id),
):
    try:
        deleted = delete_all_findings(user_id, project_id=project_id, scanner=scanner)
    except Exception as exc:
        logger.exception("Failed to clear findings")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {"deleted": deleted}


@router.delete("/all")
def clear_all_workspace_data(
    user_id: str = Depends(get_current_user_id),
):
    """Completely reset the authenticated user's SecureFlow workspace."""
    try:
        deleted = delete_all_workspace_data(user_id)
    except Exception as exc:
        logger.exception("Failed to clear all workspace data")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {"status": "cleared", **deleted}

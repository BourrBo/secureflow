"""Read-only view over findings, lifecycle triage actions, and workspace-
reset actions."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from services.auth_service import get_current_user_id
from services.db_service import (
    VALID_FINDING_STATUS,
    delete_all_findings,
    delete_all_workspace_data,
    get_finding,
    list_duplicate_findings,
    list_findings,
    update_finding,
)

router = APIRouter(prefix="/api/findings", tags=["findings"])
logger = logging.getLogger(__name__)


@router.get("")
def get_findings(
    project_id: int | None = Query(default=None),
    scan_id: int | None = Query(default=None),
    severity: str | None = Query(default=None, description="CRITICAL/HIGH/MEDIUM/LOW"),
    scanner: str | None = Query(default=None),
    status: str | None = Query(default=None, description="Open/Triaged/Fixed/Accepted"),
    include_duplicates: bool = Query(
        default=False,
        description="Include duplicate detections, not just canonical findings.",
    ),
    q: str | None = Query(default=None),
    limit: int | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
    user_id: str = Depends(get_current_user_id),
):
    if status is not None and status not in VALID_FINDING_STATUS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status: {status!r}. Must be one of {sorted(VALID_FINDING_STATUS)}.",
        )

    findings, total = list_findings(
        user_id,
        project_id=project_id,
        scan_id=scan_id,
        severity=severity,
        scanner=scanner,
        status=status,
        q=q,
        limit=limit,
        offset=offset,
        include_duplicates=include_duplicates,
    )
    return {"count": len(findings), "total": total, "findings": findings}


@router.get("/{finding_id}")
def get_finding_detail(finding_id: int, user_id: str = Depends(get_current_user_id)):
    finding = get_finding(user_id, finding_id)
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    return finding


@router.get("/{finding_id}/duplicates")
def get_finding_duplicates(finding_id: int, user_id: str = Depends(get_current_user_id)):
    """Every other detection of the same underlying finding -- what
    answers "is this a duplicate?" / "what else detected it?" from the
    Definition of Done. Empty for a finding nothing else has matched, and
    for a duplicate row itself (duplicates don't have their own
    duplicates -- see its `duplicate_of` field instead)."""
    finding = get_finding(user_id, finding_id)
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    return {"duplicates": list_duplicate_findings(user_id, finding_id)}


class UpdateFindingRequest(BaseModel):
    status: str | None = None
    owner: str | None = None
    notes: str | None = None


@router.patch("/{finding_id}")
def patch_finding(
    finding_id: int,
    body: UpdateFindingRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Reviewer triage action: set status (Open/Triaged/Fixed/Accepted),
    owner, and/or notes on a finding. Only the fields actually included in
    the request body are changed. Rejected with 400 if aimed at a
    duplicate row -- lifecycle state only lives on the canonical
    finding (see `duplicate_of` on the error, and GET .../duplicates)."""
    try:
        updated = update_finding(
            user_id,
            finding_id,
            status=body.status,
            owner=body.owner,
            notes=body.notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not updated:
        raise HTTPException(status_code=404, detail="Finding not found")
    return updated


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

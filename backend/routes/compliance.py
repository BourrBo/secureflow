"""
routes/compliance.py

Phase 2 — groups already-stored findings by ISO/IEC 27001:2022 Annex A
control. Every finding already carries iso27001_control fields (assigned
at scan time via mappings/iso27001.py), so this is pure aggregation —
scoped to the signed-in user's own findings.
"""

from fastapi import APIRouter, Depends, Query

from services.auth_service import get_current_user_id
from services.db_service import get_compliance_summary

router = APIRouter(prefix="/api/compliance", tags=["compliance"])


@router.get("")
def get_compliance(
    project_id: int | None = Query(default=None),
    user_id: str = Depends(get_current_user_id),
):
    controls = get_compliance_summary(user_id, project_id=project_id)
    total_findings = sum(c["total_findings"] for c in controls)
    return {
        "total_controls_triggered": len(controls),
        "total_findings": total_findings,
        "controls": controls,
    }

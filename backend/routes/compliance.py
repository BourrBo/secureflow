"""
routes/compliance.py

GET /api/compliance returns the shape the frontend actually reads:
{"frameworks": [{name, score, controls_passed, controls_total}, ...]} —
this used to return {"controls": [...]} (a different key, a different
shape) which meant the compliance page's own `r?.frameworks ?? []`
fallback always silently landed on an empty array, regardless of how much
correctly ISO-mapped data existed in the database. Confirmed independently
against the live data before this fix: findings were 100% ISO-mapped,
which is why this was a response-shape bug, not a data or mapping bug.

The richer per-control violation breakdown (get_compliance_summary) is
included too, in case future UI wants to show which specific controls are
triggered and by how much — today's frontend doesn't read it, so it's
harmless to include and saves a second round trip if that UI gets built.
"""

from fastapi import APIRouter, Depends, Query

from services.auth_service import get_current_user_id
from services.db_service import get_compliance_frameworks, get_compliance_summary

router = APIRouter(prefix="/api/compliance", tags=["compliance"])


@router.get("")
def get_compliance(
    project_id: int | None = Query(default=None),
    user_id: str = Depends(get_current_user_id),
):
    frameworks = get_compliance_frameworks(user_id, project_id=project_id)
    controls = get_compliance_summary(user_id, project_id=project_id)
    total_findings = sum(c["total_findings"] for c in controls)
    return {
        "frameworks": frameworks,
        "controls": controls,
        "total_controls_triggered": len(controls),
        "total_findings": total_findings,
    }
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

import csv
import io

from fastapi import APIRouter, Depends, Query, Response

from services.auth_service import get_current_user_id
from services.db_service import get_compliance_frameworks, get_compliance_summary

router = APIRouter(prefix="/api/compliance", tags=["compliance"])

# Same ordering as report_service.py's _SEVERITY_ORDER — kept in sync
# manually rather than imported, since report_service pulls in reportlab
# and other PDF-only dependencies this route has no reason to load.
_SEVERITY_ORDER = ["critical", "high", "medium", "low", "unknown"]


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


@router.get("/export")
def export_compliance_csv(
    project_id: int | None = Query(default=None),
    user_id: str = Depends(get_current_user_id),
):
    """CSV export of the per-control breakdown — closes the product doc's
    "exportable, audit-ready control matrix" claim, which the compliance
    drill-down dialog only ever rendered on-screen (view-only, per the
    session that added it). Reuses get_compliance_summary's existing
    query/grouping rather than adding a new one — same data the drill-down
    dialog already shows, just serialized as CSV instead of JSON."""
    controls = get_compliance_summary(user_id, project_id=project_id)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        ["Control ID", "Control Name", "Description", "Total Findings"]
        + [s.capitalize() for s in _SEVERITY_ORDER]
    )
    for c in controls:
        by_sev = c.get("by_severity", {})
        writer.writerow(
            [
                c["control_id"],
                c.get("control_name") or "",
                c.get("control_description") or "",
                c["total_findings"],
            ]
            + [by_sev.get(s, 0) for s in _SEVERITY_ORDER]
        )

    filename = "secureflow_compliance_control_matrix.csv"
    if project_id is not None:
        filename = f"secureflow_compliance_control_matrix_project{project_id}.csv"

    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
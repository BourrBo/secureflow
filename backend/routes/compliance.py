"""
routes/compliance.py

Phase 2 — groups already-stored findings by ISO/IEC 27001:2022 Annex A
control. Every finding already carries iso27001_control fields (assigned
at scan time via mappings/iso27001.py), so this is pure aggregation —
no new mapping logic here.
"""

from typing import Optional
from fastapi import APIRouter, Query

from services.db_service import get_compliance_summary

router = APIRouter(prefix="/api/compliance", tags=["compliance"])


@router.get("")
def get_compliance(project_id: Optional[int] = Query(default=None)):
    controls = get_compliance_summary(project_id=project_id)
    total_findings = sum(c["total_findings"] for c in controls)
    return {
        "total_controls_triggered": len(controls),
        "total_findings": total_findings,
        "controls": controls,
    }

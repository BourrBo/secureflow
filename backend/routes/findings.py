"""
routes/findings.py

Phase 2 — read-only view over the findings already persisted by Phase 1.
No new scanning logic; this is a query endpoint over the `findings` table.
"""

from typing import Optional
from fastapi import APIRouter, Query

from services.db_service import list_findings

router = APIRouter(prefix="/api/findings", tags=["findings"])


@router.get("")
def get_findings(
    project_id: Optional[int] = Query(default=None),
    scan_id: Optional[int] = Query(default=None),
    severity: Optional[str] = Query(default=None, description="CRITICAL/HIGH/MEDIUM/LOW"),
    scanner: Optional[str] = Query(default=None, description="semgrep/trivy/checkov/secrets"),
):
    findings = list_findings(
        project_id=project_id,
        scan_id=scan_id,
        severity=severity,
        scanner=scanner,
    )
    return {"count": len(findings), "findings": findings}

"""
routes/gate.py

The actual "CI/CD Decision Gate" the product doc promised and nothing in
the codebase implemented until now. SecureFlow itself never performs a
deployment (that's the pipeline's job) -- what it CAN do, and does here,
is give a pipeline step a clear pass/fail verdict plus SARIF output, so
the pipeline's own `fail-on: critical,high` step (Jenkins/GitLab CI/
GitHub Actions -- any of them) can block a merge or a deploy on it.

POST /api/gate/evaluate
  Body: { project_id, fail_on: "critical,high", commit_sha?, scan_id? }
  Evaluates that project's OPEN findings against the threshold. If
  `scan_id` is given, only that scan's findings are evaluated (typical
  CI use: "gate on the scan that just ran"); otherwise all of the
  project's currently-open findings are evaluated.
  Returns pass/fail + the blocking findings, and persists a gate_runs
  row so the dashboard's Pipeline page has real history to show.

GET /api/gate/runs?project_id=...
  Powers the Pipeline page -- recent gate evaluations, newest first.

GET /api/gate/sarif?project_id=...&scan_id=...
  SARIF 2.1.0 export of the same finding set a gate/evaluate call would
  check -- this is what a GitHub Actions / GitLab CI step uploads so
  findings show up as inline PR annotations.
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel

from services.auth_service import require_scope
from services.db_service import list_findings, list_gate_runs, record_gate_run
from services.sarif_service import findings_to_sarif

router = APIRouter(prefix="/api/gate", tags=["gate"])

logger = logging.getLogger(__name__)

VALID_SEVERITIES = {"CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"}


def _parse_fail_on(fail_on: str) -> set[str]:
    severities = {s.strip().upper() for s in fail_on.split(",") if s.strip()}
    invalid = severities - VALID_SEVERITIES
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid severity in fail_on: {', '.join(sorted(invalid))}. "
            f"Valid values: {', '.join(sorted(VALID_SEVERITIES))}.",
        )
    if not severities:
        raise HTTPException(status_code=400, detail="fail_on must list at least one severity")
    return severities


class GateEvaluateRequest(BaseModel):
    project_id: int
    fail_on: str = "critical,high"
    scan_id: int | None = None
    commit_sha: str | None = None
    triggered_by: str | None = None


@router.post("/evaluate")
def evaluate_gate(
    request: GateEvaluateRequest,
    user_id: str = Depends(require_scope("scans:run")),
):
    fail_on_severities = _parse_fail_on(request.fail_on)

    findings, total = list_findings(
        user_id,
        project_id=request.project_id,
        scan_id=request.scan_id,
        limit=None,
    )

    blocking = [f for f in findings if (f.get("severity") or "").upper() in fail_on_severities]
    passed = len(blocking) == 0

    run = record_gate_run(
        user_id,
        project_id=request.project_id,
        fail_on=request.fail_on,
        passed=passed,
        blocking_count=len(blocking),
        total_findings=total,
        scan_id=request.scan_id,
        commit_sha=request.commit_sha,
        triggered_by=request.triggered_by or "api",
    )

    return {
        **run,
        "blocking_findings": [
            {
                "id": f.get("id"),
                "title": f.get("title"),
                "severity": f.get("severity"),
                "scanner": f.get("scanner"),
                "file": f.get("file") or f.get("file_path"),
            }
            for f in blocking[:50]  # cap the inline list; full detail is in the dashboard
        ],
    }


@router.get("/runs")
def get_gate_runs(
    project_id: int | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    user_id: str = Depends(require_scope("scans:read")),
):
    return {"runs": list_gate_runs(user_id, project_id=project_id, limit=limit)}


@router.get("/sarif")
def get_gate_sarif(
    project_id: int = Query(...),
    scan_id: int | None = Query(default=None),
    user_id: str = Depends(require_scope("scans:read")),
):
    findings, _total = list_findings(user_id, project_id=project_id, scan_id=scan_id, limit=None)
    sarif = findings_to_sarif(findings)
    return Response(content=json.dumps(sarif), media_type="application/sarif+json")

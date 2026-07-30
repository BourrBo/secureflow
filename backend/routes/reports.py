"""
routes/reports.py

POST /api/reports/pdf
    Accepts the findings array the frontend already has in memory (from a
    completed scan) plus a scan_type label, and returns a downloadable PDF
    report formatted in the ISO/IEC 27001:2022 style (cover page + findings
    table + Annex A control reference appendix).
"""

import logging

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from models.finding import Finding
from services.db_service import get_project, get_scan, list_findings, list_scans
from services.report_service import generate_pdf_report

router = APIRouter()

logger = logging.getLogger(__name__)


class ReportRequest(BaseModel):
    findings: list[Finding]
    scan_type: str = "all"          # "sast" | "sca" | "iac" | "secrets" | "all"
    repo_label: str | None = ""  # e.g. repo URL or uploaded file name, shown on the cover page

    # VAPT "Closing Report" metadata — all optional, sensible defaults applied
    client_name: str | None = "Client"
    client_contact: str | None = ""
    client_email: str | None = ""
    prepared_by: str | None = "SecureFlow Automated Platform"
    reviewed_by: str | None = "SecureFlow Automated Platform"
    released_by: str | None = "SecureFlow Automated Platform"
    doc_version: str | None = "1.0"


@router.post("/api/reports/pdf")
def generate_report(request: ReportRequest):
    try:
        findings_dicts = [f.model_dump() for f in request.findings]
        pdf_bytes = generate_pdf_report(
            findings=findings_dicts,
            scan_type=request.scan_type,
            repo_label=request.repo_label or "",
            client_name=request.client_name or "Client",
            client_contact=request.client_contact or "",
            client_email=request.client_email or "",
            prepared_by=request.prepared_by or "SecureFlow Automated Platform",
            reviewed_by=request.reviewed_by or "SecureFlow Automated Platform",
            released_by=request.released_by or "SecureFlow Automated Platform",
            doc_version=request.doc_version or "1.0",
        )
    except Exception as e:
        # can fail in many reportlab-internal ways; surface as a clean 500.
        logger.exception("PDF report generation failed for scan_type=%s", request.scan_type)
        raise HTTPException(status_code=500, detail=str(e)) from e

    filename = f"secureflow_{request.scan_type}_vapt_report.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Phase 2 — list past scans, regenerate a PDF from stored findings ──

@router.get("/api/reports")
def get_reports(project_id: int | None = None):
    """Lists every completed (report-able) scan, instead of only being able
    to generate a PDF on-the-fly right after a scan finishes."""
    scans = list_scans(project_id=project_id)
    return {"count": len(scans), "reports": scans}


@router.get("/api/reports/{scan_id}/pdf")
def regenerate_report(scan_id: int):
    """Rebuilds the same ISO 27001-style PDF for a past scan, using the
    findings already stored in the DB — no re-scanning required."""
    scan = get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    project = get_project(scan["project_id"])
    findings = list_findings(scan_id=scan_id)

    try:
        pdf_bytes = generate_pdf_report(
            findings=findings,
            scan_type=scan["scan_type"],
            repo_label=(project or {}).get("repo_url") or (project or {}).get("name", ""),
        )
    except Exception as e:
        # can fail in many reportlab-internal ways; surface as a clean 500.
        logger.exception("PDF report regeneration failed for scan_id=%s", scan_id)
        raise HTTPException(status_code=500, detail=str(e)) from e

    filename = f"secureflow_{scan['scan_type']}_scan{scan_id}_vapt_report.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

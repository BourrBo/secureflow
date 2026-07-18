"""
routes/reports.py

POST /api/reports/pdf
    Accepts the findings array the frontend already has in memory (from a
    completed scan) plus a scan_type label, and returns a downloadable PDF
    report formatted in the ISO/IEC 27001:2022 style (cover page + findings
    table + Annex A control reference appendix).
"""

from fastapi import APIRouter, HTTPException, Response
from typing import List, Optional
from pydantic import BaseModel

from models.finding import Finding
from services.report_service import generate_pdf_report
from services.db_service import list_scans, get_scan, list_findings, get_project

router = APIRouter()


class ReportRequest(BaseModel):
    findings: List[Finding]
    scan_type: str = "all"          # "sast" | "sca" | "iac" | "secrets" | "all"
    repo_label: Optional[str] = ""  # e.g. repo URL or uploaded file name, shown on the cover page

    # VAPT "Closing Report" metadata — all optional, sensible defaults applied
    client_name: Optional[str] = "Client"
    client_contact: Optional[str] = ""
    client_email: Optional[str] = ""
    prepared_by: Optional[str] = "SecureFlow Automated Platform"
    reviewed_by: Optional[str] = "SecureFlow Automated Platform"
    released_by: Optional[str] = "SecureFlow Automated Platform"
    doc_version: Optional[str] = "1.0"


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
        raise HTTPException(status_code=500, detail=str(e))

    filename = f"secureflow_{request.scan_type}_vapt_report.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Phase 2 — list past scans, regenerate a PDF from stored findings ──

@router.get("/api/reports")
def get_reports(project_id: Optional[int] = None):
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
        raise HTTPException(status_code=500, detail=str(e))

    filename = f"secureflow_{scan['scan_type']}_scan{scan_id}_vapt_report.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

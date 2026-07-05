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

router = APIRouter()


class ReportRequest(BaseModel):
    findings: List[Finding]
    scan_type: str = "all"          # "sast" | "sca" | "iac" | "secrets" | "all"
    repo_label: Optional[str] = ""  # e.g. repo URL or uploaded file name, shown on the cover page


@router.post("/api/reports/pdf")
def generate_report(request: ReportRequest):
    try:
        findings_dicts = [f.model_dump() for f in request.findings]
        pdf_bytes = generate_pdf_report(
            findings=findings_dicts,
            scan_type=request.scan_type,
            repo_label=request.repo_label or "",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    filename = f"secureflow_{request.scan_type}_iso27001_report.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

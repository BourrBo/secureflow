"""
services/report_service.py

Generates a downloadable PDF report of scan findings (SAST / SCA / IaC /
Secret Detection), formatted the way the ISO/IEC 27001:2022 standard itself
is formatted:

  - A cover page in the "INTERNATIONAL STANDARD" style of the printed
    standard (title block, edition/date, reference number).
  - An executive summary (severity + control breakdown).
  - A findings table.
  - An "Annex A — Control Reference" appendix that reproduces, for every
    ISO/IEC 27001:2022 Annex A control actually triggered by the findings,
    the same Control-ref / Control-name / Control-text layout used in
    Table A.1 of the standard.
"""

from io import BytesIO
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    HRFlowable, KeepTogether,
)

from mappings.iso27001 import ANNEX_A_CONTROLS

SCAN_TYPE_LABELS = {
    "sast":    "SAST — Static Application Security Testing",
    "sca":     "SCA — Software Composition Analysis",
    "iac":     "IaC — Infrastructure as Code Security",
    "secrets": "Secret Detection",
    "container": "Container Image Scanning",
    "all":     "Combined Security Findings",
}

# Severity ordering + colors reused throughout the report
_SEVERITY_ORDER = ["critical", "high", "medium", "low", "unknown"]
_SEVERITY_HEX = {
    "critical": "#C0372A",
    "high":     "#B86A00",
    "medium":   "#1B7FFF",
    "low":      "#8A8A8A",
    "unknown":  "#8A8A8A",
}


def _norm_severity(raw: str) -> str:
    s = (raw or "").strip().lower()
    if s in ("error", "critical"):
        return "critical"
    if s in ("warning", "high"):
        return "high"
    if s in ("info", "medium"):
        return "medium"
    if s in ("low",):
        return "low"
    return s if s in _SEVERITY_ORDER else "unknown"


def _styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle(
        name="CoverKicker", parent=ss["Normal"], fontSize=11,
        textColor=colors.HexColor("#00E576"), spaceAfter=6,
        fontName="Helvetica-Bold",
    ))
    ss.add(ParagraphStyle(
        name="CoverTitle", parent=ss["Title"], fontSize=30, leading=36,
        textColor=colors.HexColor("#0D1B2E"), spaceAfter=10,
    ))
    ss.add(ParagraphStyle(
        name="CoverSub", parent=ss["Normal"], fontSize=13, leading=18,
        textColor=colors.HexColor("#333333"),
    ))
    ss.add(ParagraphStyle(
        name="SectionHeading", parent=ss["Heading1"], fontSize=15,
        textColor=colors.HexColor("#0D1B2E"), spaceBefore=18, spaceAfter=10,
    ))
    ss.add(ParagraphStyle(
        name="ControlName", parent=ss["Normal"], fontSize=10.5,
        fontName="Helvetica-Bold", textColor=colors.HexColor("#0D1B2E"),
    ))
    ss.add(ParagraphStyle(
        name="ControlLabel", parent=ss["Normal"], fontSize=9,
        fontName="Helvetica-Bold", textColor=colors.HexColor("#444444"),
        spaceBefore=4,
    ))
    ss.add(ParagraphStyle(
        name="ControlBody", parent=ss["Normal"], fontSize=9.5, leading=13,
        textColor=colors.HexColor("#222222"),
    ))
    ss.add(ParagraphStyle(
        name="CellSmall", parent=ss["Normal"], fontSize=8, leading=10.5,
        textColor=colors.HexColor("#222222"),
    ))
    ss.add(ParagraphStyle(
        name="CellRef", parent=ss["Normal"], fontSize=9, leading=11,
        fontName="Helvetica-Bold", textColor=colors.HexColor("#0D1B2E"),
    ))
    return ss


def _cover_page(story, styles, scan_type: str, repo_label: str, total: int, counts: dict):
    story.append(Spacer(1, 2.2 * cm))
    story.append(Paragraph("SECUREFLOW &nbsp;·&nbsp; ENTERPRISE APPSEC PLATFORM", styles["CoverKicker"]))
    story.append(HRFlowable(width="100%", thickness=1.4, color=colors.HexColor("#00E576"), spaceAfter=18))

    story.append(Paragraph("Security Findings Report", styles["CoverTitle"]))
    story.append(Paragraph(SCAN_TYPE_LABELS.get(scan_type, scan_type.upper()), styles["CoverSub"]))
    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph(
        "Mapped to ISO/IEC 27001:2022 &mdash; Information security, cybersecurity and "
        "privacy protection &mdash; Information security management systems &mdash; "
        "Requirements, Annex A: Information security controls reference.",
        styles["CoverSub"],
    ))

    story.append(Spacer(1, 1.5 * cm))

    meta_rows = [
        ["Target", repo_label or "—"],
        ["Report generated", datetime.now().strftime("%Y-%m-%d %H:%M")],
        ["Total findings", str(total)],
        ["Critical", str(counts.get("critical", 0))],
        ["High", str(counts.get("high", 0))],
        ["Medium", str(counts.get("medium", 0))],
        ["Low", str(counts.get("low", 0))],
        ["Standard reference", "ISO/IEC 27001:2022(E), Third edition, 2022-10"],
    ]
    t = Table(meta_rows, colWidths=[4.5 * cm, 9.5 * cm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#555555")),
        ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor("#111111")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#DDDDDD")),
    ]))
    story.append(t)

    story.append(Spacer(1, 3 * cm))
    story.append(HRFlowable(width="100%", thickness=0.75, color=colors.HexColor("#CCCCCC")))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(
        "This report reproduces, for each finding, the ISO/IEC 27001:2022 Annex A "
        "control it maps to. See the Annex A Control Reference section at the end "
        "of this report for the exact control wording as published in Table A.1 "
        "of the standard.",
        styles["ControlBody"],
    ))
    story.append(PageBreak())


def _summary_page(story, styles, counts: dict, control_counts: dict):
    story.append(Paragraph("Executive Summary", styles["SectionHeading"]))

    sev_rows = [["Severity", "Count"]]
    for sev in _SEVERITY_ORDER:
        if counts.get(sev):
            sev_rows.append([sev.capitalize(), str(counts[sev])])
    t = Table(sev_rows, colWidths=[6 * cm, 4 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0D1B2E")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.8 * cm))

    story.append(Paragraph("Findings by ISO/IEC 27001:2022 Annex A Control", styles["SectionHeading"]))
    ctrl_rows = [["Control", "Name", "Findings"]]
    for control_id, count in sorted(control_counts.items(), key=lambda kv: -kv[1]):
        name = ANNEX_A_CONTROLS.get(control_id, {}).get("name", "")
        ctrl_rows.append([f"A.{control_id}", name, str(count)])
    t2 = Table(ctrl_rows, colWidths=[2.2 * cm, 9.3 * cm, 2.5 * cm])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0D1B2E")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F9FC")]),
    ]))
    story.append(t2)
    story.append(PageBreak())


def _findings_table(story, styles, findings: list):
    story.append(Paragraph("Findings", styles["SectionHeading"]))

    header = ["#", "Severity", "Finding / Rule", "File · Line", "CWE", "ISO 27001"]
    rows = [header]

    for i, f in enumerate(findings, start=1):
        sev = _norm_severity(f.get("severity"))
        sev_para = Paragraph(f'<font color="{_SEVERITY_HEX[sev]}"><b>{sev.upper()}</b></font>', styles["CellSmall"])
        title = f.get("title") or f.get("rule") or "Untitled finding"
        rule = f.get("rule") or ""
        finding_para = Paragraph(f"<b>{_escape(title)}</b><br/><font size=7 color='#666666'>{_escape(rule)}</font>", styles["CellSmall"])
        loc = f"{f.get('file', 'unknown')}" + (f":{f['line']}" if f.get("line") else "")
        loc_para = Paragraph(_escape(loc), styles["CellSmall"])
        cwe_para = Paragraph(_escape(f.get("cwe", "—")), styles["CellSmall"])
        iso_id = f.get("iso27001_control", "—")
        iso_para = Paragraph(f"A.{iso_id}" if iso_id != "—" else "—", styles["CellRef"])

        rows.append([str(i), sev_para, finding_para, loc_para, cwe_para, iso_para])

    col_widths = [1.0 * cm, 1.9 * cm, 6.2 * cm, 4.3 * cm, 1.8 * cm, 2.0 * cm]
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0D1B2E")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8.5),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#DDDDDD")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F9FC")]),
    ]))
    story.append(t)
    story.append(PageBreak())


def _annex_a_appendix(story, styles, control_ids: set):
    story.append(Paragraph("Annex A — Control Reference", styles["SectionHeading"]))
    story.append(Paragraph(
        "The controls below are reproduced from Table A.1 of ISO/IEC 27001:2022 "
        "and correspond to every Annex A control referenced by the findings in "
        "this report.",
        styles["ControlBody"],
    ))
    story.append(Spacer(1, 0.4 * cm))

    for control_id in sorted(control_ids, key=lambda c: [int(p) for p in c.split(".")]):
        control = ANNEX_A_CONTROLS.get(control_id)
        if not control:
            continue
        block = [
            Paragraph(f"A.{control_id} &nbsp; {_escape(control['name'])}", styles["ControlName"]),
            Paragraph("Control", styles["ControlLabel"]),
            Paragraph(_escape(control["description"]), styles["ControlBody"]),
            Spacer(1, 0.35 * cm),
            HRFlowable(width="100%", thickness=0.4, color=colors.HexColor("#DDDDDD")),
            Spacer(1, 0.35 * cm),
        ]
        story.append(KeepTogether(block))


def _escape(text: str) -> str:
    return (text or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def generate_pdf_report(findings: list, scan_type: str = "all", repo_label: str = "") -> bytes:
    """
    Build the full ISO/IEC 27001:2022-styled PDF report and return it as bytes.
    """
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=2.2 * cm, bottomMargin=2 * cm,
        leftMargin=2 * cm, rightMargin=2 * cm,
        title="SecureFlow Security Findings Report",
    )
    styles = _styles()
    story = []

    # ── Aggregate stats ──
    counts = {}
    control_counts = {}
    control_ids = set()
    for f in findings:
        sev = _norm_severity(f.get("severity"))
        counts[sev] = counts.get(sev, 0) + 1
        iso_id = f.get("iso27001_control")
        if iso_id:
            control_counts[iso_id] = control_counts.get(iso_id, 0) + 1
            control_ids.add(iso_id)

    _cover_page(story, styles, scan_type, repo_label, len(findings), counts)
    _summary_page(story, styles, counts, control_counts)
    _findings_table(story, styles, findings)
    _annex_a_appendix(story, styles, control_ids)

    doc.build(story)
    return buf.getvalue()

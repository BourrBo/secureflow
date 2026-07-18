"""
services/report_service.py

Generates a downloadable PDF report of scan findings (SAST / SCA / IaC /
Secret Detection / Container), formatted to match SecureFlow's VAPT report
standard (the "Closing Report" layout used for Roamassist-style
deliverables):

  1. Cover page
  2. Document Control (version history + distribution list)
  3. Introduction (scope, methodology, tools used, risk rating definitions,
     weight-score table, limitations)
  4. Executive Summary (overall vulnerability rating + Key Issues table)
  5. Severity-wise vulnerability distribution
  6. Detailed Observations — one full record per finding (Vulnerable
     Location / Path / Parameter, CVE, CWE, CVSS, EPSS, Description,
     Recommendation, References, Additional Observations, Revalidation
     Status)
  7. Conclusion
  8. Annex A — ISO/IEC 27001:2022 Control Reference (SecureFlow-specific
     bonus section, kept from the previous report version)
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
    HRFlowable, KeepTogether, ListFlowable, ListItem,
)

from mappings.iso27001 import ANNEX_A_CONTROLS

SCAN_TYPE_LABELS = {
    "sast":      "SAST — Static Application Security Testing",
    "sca":       "SCA — Software Composition Analysis",
    "iac":       "IaC — Infrastructure as Code Security",
    "secrets":   "Secret Detection",
    "container": "Container Image Security",
    "all":       "Combined Security Findings",
}

TOOL_BY_SCANNER = {
    "semgrep": "Semgrep (SAST)",
    "trivy":   "Trivy (SCA / Container)",
    "checkov": "Checkov (IaC)",
    "secrets": "SecureFlow Secret Scanner",
}

# Severity ordering + colors reused throughout the report
_SEVERITY_ORDER = ["critical", "high", "medium", "low", "unknown"]
_SEVERITY_HEX = {
    "critical": "#C0372A",
    "high":     "#B86A00",
    "medium":   "#D9A400",
    "low":      "#2E8B57",
    "unknown":  "#8A8A8A",
}
_SEVERITY_BG_HEX = {
    "critical": "#F4C7C2",
    "high":     "#F7DDA8",
    "medium":   "#FBEBAE",
    "low":      "#C9EBD7",
    "unknown":  "#E5E5E5",
}

# Laati/Roamassist-style weight-score matrix: (severity -> [(min_count, score), ...] highest bucket first)
_WEIGHT_BUCKETS = {
    "critical": [(6, 10), (3, 9), (1, 8)],
    "high":     [(6, 8), (3, 7), (1, 6)],
    "medium":   [(6, 6), (3, 5), (1, 4)],
    "low":      [(6, 3), (3, 2), (1, 1)],
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


def _severity_score(sev: str, count: int) -> int:
    if count <= 0:
        return 0
    for min_count, score in _WEIGHT_BUCKETS.get(sev, []):
        if count >= min_count:
            return score
    return 0


def _vulnerability_rating(score: int) -> str:
    if score == 10:
        return "Critical"
    if score >= 6:
        return "High"
    if score >= 4:
        return "Medium"
    if score >= 1:
        return "Low"
    return "Not Vulnerable"


def _overall_status(score: float) -> str:
    if score >= 8:
        return "Vulnerable"
    if score >= 4:
        return "Concerning"
    if score >= 2:
        return "Satisfactory"
    if score >= 1:
        return "Good"
    return "Excellent"


def _styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle(
        name="CoverKicker", parent=ss["Normal"], fontSize=11,
        textColor=colors.HexColor("#00E576"), spaceAfter=6,
        fontName="Helvetica-Bold",
    ))
    ss.add(ParagraphStyle(
        name="CoverTitle", parent=ss["Title"], fontSize=28, leading=34,
        textColor=colors.HexColor("#0D1B2E"), spaceAfter=10,
    ))
    ss.add(ParagraphStyle(
        name="CoverSub", parent=ss["Normal"], fontSize=13, leading=18,
        textColor=colors.HexColor("#333333"),
    ))
    ss.add(ParagraphStyle(
        name="CoverConfidential", parent=ss["Normal"], fontSize=9,
        leading=13, textColor=colors.HexColor("#B86A00"),
        fontName="Helvetica-Oblique",
    ))
    ss.add(ParagraphStyle(
        name="SectionHeading", parent=ss["Heading1"], fontSize=15,
        textColor=colors.HexColor("#0D1B2E"), spaceBefore=18, spaceAfter=10,
    ))
    ss.add(ParagraphStyle(
        name="SubHeading", parent=ss["Heading2"], fontSize=11.5,
        textColor=colors.HexColor("#0D1B2E"), spaceBefore=12, spaceAfter=6,
    ))
    ss.add(ParagraphStyle(
        name="Body", parent=ss["Normal"], fontSize=9.5, leading=13.5,
        textColor=colors.HexColor("#222222"),
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
    ss.add(ParagraphStyle(
        name="ObsFieldLabel", parent=ss["Normal"], fontSize=8.5,
        fontName="Helvetica-Bold", textColor=colors.white, leading=11,
    ))
    ss.add(ParagraphStyle(
        name="ObsFieldValue", parent=ss["Normal"], fontSize=8.5, leading=11.5,
        textColor=colors.HexColor("#222222"),
    ))
    return ss


def _escape(text: str) -> str:
    return (text or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ──────────────────────────────────────────────────────────────────────
# 1. Cover page
# ──────────────────────────────────────────────────────────────────────

def _cover_page(story, styles, scan_type: str, repo_label: str, client_name: str,
                 report_date: str, doc_version: str):
    story.append(Spacer(1, 2 * cm))
    story.append(Paragraph("SECUREFLOW &nbsp;·&nbsp; ENTERPRISE APPSEC PLATFORM", styles["CoverKicker"]))
    story.append(HRFlowable(width="100%", thickness=1.4, color=colors.HexColor("#00E576"), spaceAfter=18))

    story.append(Paragraph("SecureFlow presents", styles["CoverSub"]))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(
        f"{SCAN_TYPE_LABELS.get(scan_type, scan_type.upper())}<br/>Closing Report v{doc_version}",
        styles["CoverTitle"],
    ))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(f"TO<br/><b>{_escape(client_name)}</b>", styles["CoverSub"]))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(f"Target: {_escape(repo_label or '—')}", styles["CoverSub"]))
    story.append(Paragraph(f"Date — {report_date}", styles["CoverSub"]))

    story.append(Spacer(1, 3 * cm))
    story.append(HRFlowable(width="100%", thickness=0.75, color=colors.HexColor("#CCCCCC")))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(
        "Confidentiality Clause: This report is intended for the information and use of the "
        "aforementioned client and should not be used by any other party. All rights to "
        "distribution of this report are with the aforementioned client.",
        styles["CoverConfidential"],
    ))
    story.append(PageBreak())


# ──────────────────────────────────────────────────────────────────────
# 2. Document Control
# ──────────────────────────────────────────────────────────────────────

def _document_control(story, styles, doc_version: str, report_date: str,
                       prepared_by: str, reviewed_by: str, released_by: str,
                       client_name: str, client_contact: str, client_email: str):
    story.append(Paragraph("Document Control", styles["SectionHeading"]))

    prep_rows = [
        ["Document Title", "SecureFlow Security Findings Report"],
        ["Document Version", doc_version],
        ["Prepared by", prepared_by],
        ["Reviewed by", reviewed_by],
        ["Released by", released_by],
        ["Release Date", report_date],
    ]
    t = Table(prep_rows, colWidths=[4.5 * cm, 9.5 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#0D1B2E")),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.white),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.6 * cm))

    story.append(Paragraph("Document Distribution List", styles["SubHeading"]))
    dist_rows = [
        ["Name", "Organization", "Email"],
        [client_contact or "—", client_name or "—", client_email or "—"],
    ]
    t2 = Table(dist_rows, colWidths=[4 * cm, 5 * cm, 5 * cm])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0D1B2E")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t2)
    story.append(PageBreak())


# ──────────────────────────────────────────────────────────────────────
# 3. Introduction — scope, methodology, tools, risk rating, weight scores
# ──────────────────────────────────────────────────────────────────────

def _introduction(story, styles, scan_type: str, repo_label: str, report_date: str,
                   scanners_used: set):
    story.append(Paragraph("1. Introduction", styles["SectionHeading"]))

    story.append(Paragraph("1.1 How to Read This Report", styles["SubHeading"]))
    story.append(Paragraph(
        "For every vulnerability identified during the scan, this report provides an "
        "<b>Observation</b> (a detailed description of the finding), the <b>Impact</b> it poses, "
        "and a <b>Recommendation</b> to remediate it.",
        styles["Body"],
    ))

    story.append(Paragraph("1.2 Scope of the Assessment", styles["SubHeading"]))
    story.append(Paragraph(
        f"SecureFlow performed an automated {SCAN_TYPE_LABELS.get(scan_type, scan_type.upper())} "
        f"assessment against the following target, consolidating results from its integrated "
        f"scanning engines into a unified findings model.",
        styles["Body"],
    ))
    scope_rows = [["Target", "Scan Type", "Date"],
                  [repo_label or "—", SCAN_TYPE_LABELS.get(scan_type, scan_type.upper()), report_date]]
    t = Table(scope_rows, colWidths=[6 * cm, 5.5 * cm, 2.5 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0D1B2E")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.4 * cm))

    story.append(Paragraph("1.3 Approach and Methodology", styles["SubHeading"]))
    story.append(ListFlowable([
        ListItem(Paragraph("<b>Reconnaissance:</b> Repository/artifact ingestion and identification of scannable components.", styles["Body"])),
        ListItem(Paragraph("<b>Automated Assessment:</b> Static, composition, IaC, secret, and/or container analysis using integrated scanning engines.", styles["Body"])),
        ListItem(Paragraph("<b>Reporting:</b> Normalization of raw scanner output into a single findings model, severity scoring, and control mapping.", styles["Body"])),
    ], bulletType="bullet"))

    story.append(Paragraph("1.4 Tools / Engines Used", styles["SubHeading"]))
    tool_rows = [["Engine", "Category"]]
    if scanners_used:
        for s in sorted(scanners_used):
            tool_rows.append([TOOL_BY_SCANNER.get(s, s.title()), SCAN_TYPE_LABELS.get(scan_type, scan_type.upper())])
    else:
        tool_rows.append(["—", "—"])
    t3 = Table(tool_rows, colWidths=[7 * cm, 7 * cm])
    t3.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0D1B2E")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t3)
    story.append(PageBreak())

    story.append(Paragraph("1.5 Risk Categorization &amp; Rating", styles["SectionHeading"]))
    story.append(Paragraph(
        "Severity is calculated based on the impact of vulnerabilities identified. "
        "<b>Critical &amp; High</b> findings pose a significant risk requiring immediate attention. "
        "<b>Medium</b> findings could have a moderate impact if left unaddressed. "
        "<b>Low</b> findings have minimal immediate impact but should be remediated to maintain "
        "a robust security posture.",
        styles["Body"],
    ))
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("1.6 Weight Scores", styles["SubHeading"]))
    wt_rows = [["Category", "No. of Vulnerabilities Detected", "Score"]]
    for sev in ["critical", "high", "medium", "low"]:
        for min_count, score in _WEIGHT_BUCKETS[sev]:
            label = f">{min_count - 1}" if min_count == 6 else (f"{min_count}–5" if min_count == 3 else "1–2")
            wt_rows.append([sev.capitalize(), label, str(score)])
    t4 = Table(wt_rows, colWidths=[4 * cm, 6 * cm, 4 * cm])
    t4.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0D1B2E")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F9FC")]),
    ]))
    story.append(t4)
    story.append(Spacer(1, 0.4 * cm))

    story.append(Paragraph("1.7 Limitation", styles["SubHeading"]))
    story.append(Paragraph(
        "This assessment reflects the state of the codebase/artifact at the time of scanning. "
        "It is based on automated tooling and current signature/rule databases, and is not "
        "designed to detect all possible vulnerabilities. Subsequent changes to the code, "
        "configuration, or dependencies may invalidate these findings.",
        styles["Body"],
    ))
    story.append(PageBreak())


# ──────────────────────────────────────────────────────────────────────
# 4. Executive Summary — overall rating + Key Issues table
# ──────────────────────────────────────────────────────────────────────

def _executive_summary(story, styles, counts: dict, findings: list):
    story.append(Paragraph("1.8 Executive Summary", styles["SectionHeading"]))

    scores = {sev: _severity_score(sev, counts.get(sev, 0)) for sev in _WEIGHT_BUCKETS}
    max_score = max(scores.values()) if scores else 0
    rating = _vulnerability_rating(max_score)
    status = _overall_status(max_score)

    rating_hex = _SEVERITY_HEX.get(rating.lower(), "#0D1B2E")
    story.append(Paragraph(
        f"SecureFlow has completed the security assessment. The target's vulnerability level is "
        f"rated at <b>{max_score}</b>, categorizing it as <b>{rating}</b> — Status: "
        f"<font color='{rating_hex}'><b>{status}</b></font>.",
        styles["Body"],
    ))
    story.append(Paragraph(
        "To enhance security, please incorporate the recommendations outlined in this report.",
        styles["Body"],
    ))
    story.append(Spacer(1, 0.5 * cm))

    story.append(Paragraph("Key Issues Summary", styles["SubHeading"]))
    header = ["Sr.", "Key Issue", "Severity", "Affected Location", "CVE / CWE", "New/Repeat"]
    rows = [header]
    for i, f in enumerate(findings, start=1):
        sev = _norm_severity(f.get("severity"))
        sev_para = Paragraph(f'<font color="{_SEVERITY_HEX[sev]}"><b>{sev.upper()}</b></font>', styles["CellSmall"])
        title = f.get("title") or f.get("rule") or "Untitled finding"
        loc = f.get("affected_path") or f.get("file") or "—"
        cve_cwe = ", ".join(filter(None, [f.get("cve"), f.get("cwe")])) or "—"
        rows.append([
            str(i),
            Paragraph(_escape(title), styles["CellSmall"]),
            sev_para,
            Paragraph(_escape(loc), styles["CellSmall"]),
            Paragraph(_escape(cve_cwe), styles["CellSmall"]),
            Paragraph(f.get("new_or_repeat", "New"), styles["CellSmall"]),
        ])

    col_widths = [1 * cm, 4.5 * cm, 1.8 * cm, 4 * cm, 2.7 * cm, 2 * cm]
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


# ──────────────────────────────────────────────────────────────────────
# 5. Severity-wise vulnerability distribution
# ──────────────────────────────────────────────────────────────────────

def _severity_distribution(story, styles, counts: dict, repo_label: str):
    story.append(Paragraph("1.9 Severity-wise Vulnerability Distribution", styles["SectionHeading"]))

    total = sum(counts.get(sev, 0) for sev in _SEVERITY_ORDER)
    rows = [["Target", "Critical", "High", "Medium", "Low", "Total"],
            [repo_label or "—",
             str(counts.get("critical", 0)), str(counts.get("high", 0)),
             str(counts.get("medium", 0)), str(counts.get("low", 0)), str(total)]]
    t = Table(rows, colWidths=[5.5 * cm, 2 * cm, 2 * cm, 2 * cm, 2 * cm, 1.5 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0D1B2E")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.6 * cm))

    # Simple horizontal bar visualization built from Table cells (no chart lib needed)
    bar_rows = []
    max_count = max([counts.get(sev, 0) for sev in _SEVERITY_ORDER] + [1])
    for sev in ["critical", "high", "medium", "low"]:
        n = counts.get(sev, 0)
        bar_width = (n / max_count) * 10 if max_count else 0
        bar = Table([[""]], colWidths=[max(bar_width, 0.15) * cm], rowHeights=[0.5 * cm])
        bar.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(_SEVERITY_HEX[sev]))]))
        bar_rows.append([sev.capitalize(), bar, str(n)])
    t2 = Table(bar_rows, colWidths=[2.5 * cm, 10.5 * cm, 1.5 * cm])
    t2.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(t2)
    story.append(PageBreak())


# ──────────────────────────────────────────────────────────────────────
# 6. Detailed Observations — one full record per finding
# ──────────────────────────────────────────────────────────────────────

def _obs_field_row(label, value, styles, label_bg="#0D1B2E"):
    return [
        Paragraph(label, styles["ObsFieldLabel"]),
        Paragraph(value, styles["ObsFieldValue"]),
    ]


def _detailed_observations(story, styles, findings: list, repo_label: str):
    story.append(Paragraph("2. Detailed Observations", styles["SectionHeading"]))

    for i, f in enumerate(findings, start=1):
        sev = _norm_severity(f.get("severity"))
        title = f.get("title") or f.get("rule") or "Untitled finding"
        location = f.get("affected_location") or repo_label or "—"
        path = f.get("affected_path") or f.get("file") or "—"
        parameter = f.get("affected_parameter") or "N/A"
        cve = f.get("cve") or "N/A"
        cwe = f.get("cwe") or "N/A"
        cvss = f.get("cvss")
        cvss_vector = f.get("cvss_vector")
        cvss_display = f"{cvss}" + (f" ({sev.capitalize()}), {cvss_vector}" if cvss_vector else (f" ({sev.capitalize()})" if cvss is not None else ""))
        if cvss is None:
            cvss_display = f"{sev.capitalize()}"
        epss = f.get("epss_score") or "N/A"
        description = f.get("description") or "—"
        recommendation = f.get("recommendation") or "Remediate per the referenced standard's guidance for this finding class."
        references = f.get("references") or []
        refs_text = ", ".join(references) if references else "OWASP Top 10, relevant CWE reference"
        additional = f.get("additional_observations") or "—"
        revalidation = f.get("revalidation_status", "Open")

        rows = [
            [Paragraph("Sr. No.", styles["ObsFieldLabel"]), Paragraph(str(i), styles["ObsFieldValue"])],
            [Paragraph("Name of Vulnerability", styles["ObsFieldLabel"]), Paragraph(f"<b>{_escape(title)}</b>", styles["ObsFieldValue"])],
            [Paragraph("Vulnerable Location", styles["ObsFieldLabel"]), Paragraph(_escape(location), styles["ObsFieldValue"])],
            [Paragraph("Vulnerable Path / Line", styles["ObsFieldLabel"]), Paragraph(_escape(path), styles["ObsFieldValue"])],
            [Paragraph("Vulnerable Parameter", styles["ObsFieldLabel"]), Paragraph(_escape(parameter), styles["ObsFieldValue"])],
            [Paragraph("CVE", styles["ObsFieldLabel"]), Paragraph(_escape(cve), styles["ObsFieldValue"])],
            [Paragraph("CWE", styles["ObsFieldLabel"]), Paragraph(_escape(cwe), styles["ObsFieldValue"])],
            [Paragraph("CVSS", styles["ObsFieldLabel"]), Paragraph(
                f'<font color="{_SEVERITY_HEX[sev]}"><b>{_escape(cvss_display)}</b></font>', styles["ObsFieldValue"])],
            [Paragraph("EPSS Score", styles["ObsFieldLabel"]), Paragraph(_escape(str(epss)), styles["ObsFieldValue"])],
            [Paragraph("Description", styles["ObsFieldLabel"]), Paragraph(_escape(description), styles["ObsFieldValue"])],
            [Paragraph("Workaround / Solutions / Recommendations", styles["ObsFieldLabel"]), Paragraph(_escape(recommendation), styles["ObsFieldValue"])],
            [Paragraph("References", styles["ObsFieldLabel"]), Paragraph(_escape(refs_text), styles["ObsFieldValue"])],
            [Paragraph("Additional Observations", styles["ObsFieldLabel"]), Paragraph(_escape(additional), styles["ObsFieldValue"])],
            [Paragraph("Revalidation Status", styles["ObsFieldLabel"]), Paragraph(f"<b>{_escape(revalidation)}</b>", styles["ObsFieldValue"])],
        ]

        t = Table(rows, colWidths=[4.5 * cm, 9.5 * cm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor(_SEVERITY_HEX[sev])),
            ("BACKGROUND", (1, 0), (1, -1), colors.HexColor(_SEVERITY_BG_HEX[sev])),
            ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#FFFFFF")),
            ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#DDDDDD")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(KeepTogether([t, Spacer(1, 0.5 * cm)]))
        if i < len(findings):
            story.append(PageBreak())

    story.append(PageBreak())


# ──────────────────────────────────────────────────────────────────────
# 7. Conclusion
# ──────────────────────────────────────────────────────────────────────

def _conclusion(story, styles, counts: dict, repo_label: str):
    story.append(Paragraph("3. Conclusion", styles["SectionHeading"]))

    total = sum(counts.get(sev, 0) for sev in _SEVERITY_ORDER)
    scores = {sev: _severity_score(sev, counts.get(sev, 0)) for sev in _WEIGHT_BUCKETS}
    max_score = max(scores.values()) if scores else 0
    status = _overall_status(max_score)

    story.append(Paragraph(
        f"SecureFlow performed an automated security assessment of "
        f"<b>{_escape(repo_label or 'the target')}</b> against current standard security controls "
        f"(OWASP Top 10, relevant CWE classes, and ISO/IEC 27001:2022 Annex A). "
        f"A total of {total} findings were observed, including "
        f"{counts.get('critical', 0)} Critical, {counts.get('high', 0)} High, "
        f"{counts.get('medium', 0)} Medium, and {counts.get('low', 0)} Low severity observations. "
        f"Based on these results, the target's current security status is categorized as "
        f"<b>{status}</b>.",
        styles["Body"],
    ))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(
        "Appropriate remediation efforts should be undertaken per the recommendations in "
        "Section 2 to reduce the risk of exploitation and cascading security failures.",
        styles["Body"],
    ))
    story.append(PageBreak())


# ──────────────────────────────────────────────────────────────────────
# 8. Annex A — ISO/IEC 27001:2022 Control Reference (SecureFlow bonus section)
# ──────────────────────────────────────────────────────────────────────

def _annex_a_appendix(story, styles, control_ids: set):
    story.append(Paragraph("Annex A — ISO/IEC 27001:2022 Control Reference", styles["SectionHeading"]))
    story.append(Paragraph(
        "The controls below are reproduced from Table A.1 of ISO/IEC 27001:2022 "
        "and correspond to every Annex A control referenced by the findings in "
        "this report. This mapping is a SecureFlow-specific addition on top of "
        "the standard VAPT report layout.",
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


# ──────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────

def generate_pdf_report(
    findings: list,
    scan_type: str = "all",
    repo_label: str = "",
    client_name: str = "Client",
    client_contact: str = "",
    client_email: str = "",
    prepared_by: str = "SecureFlow Automated Platform",
    reviewed_by: str = "SecureFlow Automated Platform",
    released_by: str = "SecureFlow Automated Platform",
    doc_version: str = "1.0",
) -> bytes:
    """
    Build the VAPT-style ("Closing Report") PDF report — matching the
    Roamassist/Laati detailed-observation layout — and return it as bytes.
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
    report_date = datetime.now().strftime("%d-%m-%Y")

    # ── Aggregate stats ──
    counts = {}
    control_ids = set()
    scanners_used = set()
    for f in findings:
        sev = _norm_severity(f.get("severity"))
        counts[sev] = counts.get(sev, 0) + 1
        iso_id = f.get("iso27001_control")
        if iso_id:
            control_ids.add(iso_id)
        scanner = f.get("scanner")
        if scanner:
            scanners_used.add(scanner)

    _cover_page(story, styles, scan_type, repo_label, client_name, report_date, doc_version)
    _document_control(story, styles, doc_version, report_date, prepared_by, reviewed_by,
                       released_by, client_name, client_contact, client_email)
    _introduction(story, styles, scan_type, repo_label, report_date, scanners_used)
    _executive_summary(story, styles, counts, findings)
    _severity_distribution(story, styles, counts, repo_label)
    _detailed_observations(story, styles, findings, repo_label)
    _conclusion(story, styles, counts, repo_label)
    _annex_a_appendix(story, styles, control_ids)

    doc.build(story)
    return buf.getvalue()

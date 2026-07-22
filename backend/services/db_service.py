"""
services/db_service.py

Phase 1 — Persistence Layer.

SQLite storage for projects / scans / findings. Every scan route creates a
`scans` row, runs the scanner exactly as it already does, and writes the
resulting findings into the `findings` table linked to that scan. The API
responses returned to the frontend are unchanged — this module is purely
additive.

Schema:
    projects(id, name, source_type, repo_url, created_at)
    scans(id, project_id, scan_type, status, started_at, finished_at)
    findings(id, scan_id, <same fields as models.finding.Finding>)
"""

import os
import sqlite3
import json
import re
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import List, Optional

from utils.severity import normalize_severity

# Same drive-safety pattern used in git_service.py / upload_service.py —
# keep the DB file anchored next to the backend itself.
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_DB_PATH = os.path.join(_BASE_DIR, "..", "secureflow.db")

VALID_SCAN_TYPES = {"sast", "sca", "iac", "secrets", "container", "dast"}
VALID_SCAN_STATUS = {"running", "completed", "failed"}


@contextmanager
def get_db():
    """Yields a sqlite3 connection with row access by column name and
    foreign keys enforced. Opens/closes per call — simple and safe at
    this app's scale, matches the short-lived-connection style already
    used for git clones and zip extraction in this codebase."""
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Creates tables if they don't exist yet. Safe to call on every startup."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT NOT NULL,
                source_type TEXT NOT NULL CHECK(source_type IN ('git', 'upload')),
                repo_url    TEXT,
                created_at  TEXT NOT NULL
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS scans (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id  INTEGER NOT NULL REFERENCES projects(id),
                scan_type   TEXT NOT NULL CHECK(
                                scan_type IN ('sast','sca','iac','secrets','container','dast')
                            ),
                status      TEXT NOT NULL DEFAULT 'running' CHECK(
                                status IN ('running','completed','failed')
                            ),
                started_at  TEXT NOT NULL,
                finished_at TEXT
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS findings (
                id                     INTEGER PRIMARY KEY AUTOINCREMENT,
                scan_id                INTEGER NOT NULL REFERENCES scans(id),
                title                  TEXT NOT NULL,
                severity               TEXT NOT NULL,
                file                   TEXT,
                line                   INTEGER,
                description            TEXT,
                rule                   TEXT,
                cwe                    TEXT,
                owasp                  TEXT,
                scanner                TEXT,
                iso27001_control       TEXT,
                iso27001_control_name  TEXT,
                iso27001_description   TEXT,
                code_context           TEXT,
                installed_version      TEXT,
                fixed_version          TEXT,
                cvss                   REAL,
                ecosystem              TEXT,
                cve                    TEXT,
                epss_score             TEXT
            )
        """)

        # Migration for DBs created before EPSS enrichment existed —
        # CREATE TABLE IF NOT EXISTS above only helps fresh DBs, so
        # existing findings tables need the columns added explicitly.
        existing_cols = {row["name"] for row in conn.execute("PRAGMA table_info(findings)")}
        if "cve" not in existing_cols:
            conn.execute("ALTER TABLE findings ADD COLUMN cve TEXT")
        if "epss_score" not in existing_cols:
            conn.execute("ALTER TABLE findings ADD COLUMN epss_score TEXT")

        conn.execute("CREATE INDEX IF NOT EXISTS idx_scans_project ON scans(project_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_findings_scan ON findings(scan_id)")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def derive_project_name_from_repo_url(repo_url: str) -> str:
    """'https://github.com/org/repo.git' -> 'repo'"""
    name = repo_url.rstrip("/").split("/")[-1]
    return re.sub(r"\.git$", "", name) or repo_url


# ── Projects ────────────────────────────────────────────────────────

def get_or_create_project(
    name: str,
    source_type: str,
    repo_url: Optional[str] = None,
) -> int:
    """Reuses an existing project when the same repo_url (git) or the same
    name (upload) has been scanned before, otherwise creates a new one."""
    with get_db() as conn:
        if source_type == "git" and repo_url:
            row = conn.execute(
                "SELECT id FROM projects WHERE repo_url = ?", (repo_url,)
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT id FROM projects WHERE name = ? AND source_type = ?",
                (name, source_type),
            ).fetchone()

        if row:
            return row["id"]

        cursor = conn.execute(
            "INSERT INTO projects (name, source_type, repo_url, created_at) "
            "VALUES (?, ?, ?, ?)",
            (name, source_type, repo_url, _now()),
        )
        return cursor.lastrowid


# ── Scans ───────────────────────────────────────────────────────────

def create_scan(project_id: int, scan_type: str) -> int:
    if scan_type not in VALID_SCAN_TYPES:
        raise ValueError(f"Invalid scan_type: {scan_type}")

    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO scans (project_id, scan_type, status, started_at) "
            "VALUES (?, ?, 'running', ?)",
            (project_id, scan_type, _now()),
        )
        return cursor.lastrowid


def finish_scan(scan_id: int, status: str):
    if status not in VALID_SCAN_STATUS:
        raise ValueError(f"Invalid status: {status}")

    with get_db() as conn:
        conn.execute(
            "UPDATE scans SET status = ?, finished_at = ? WHERE id = ?",
            (status, _now(), scan_id),
        )


# ── Findings ────────────────────────────────────────────────────────

def insert_findings(scan_id: int, findings: List) -> None:
    """`findings` is a list of models.finding.Finding instances (or objects
    with the same attributes/model_dump())."""
    if not findings:
        return

    rows = []
    for f in findings:
        data = f.model_dump() if hasattr(f, "model_dump") else dict(f)
        rows.append((
            scan_id,
            data["title"],
            normalize_severity(data.get("severity"), scanner=data.get("scanner")),
            data.get("file"),
            data.get("line"),
            data.get("description"),
            data.get("rule"),
            data.get("cwe"),
            data.get("owasp"),
            data.get("scanner"),
            data.get("iso27001_control"),
            data.get("iso27001_control_name"),
            data.get("iso27001_description"),
            json.dumps(data.get("code_context") or []),
            data.get("installed_version"),
            data.get("fixed_version"),
            data.get("cvss"),
            data.get("ecosystem"),
            data.get("cve"),
            data.get("epss_score"),
        ))

    with get_db() as conn:
        conn.executemany(
            """
            INSERT INTO findings (
                scan_id, title, severity, file, line, description, rule,
                cwe, owasp, scanner, iso27001_control, iso27001_control_name,
                iso27001_description, code_context, installed_version,
                fixed_version, cvss, ecosystem, cve, epss_score
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )


# ── Phase 2 — Read helpers (Findings / Projects / Reports / Compliance) ──
# Everything below is read-only querying on top of the Phase 1 tables above.
# No new tables, no changes to the write path.

def _row_to_finding_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    raw_ctx = d.get("code_context")
    try:
        d["code_context"] = json.loads(raw_ctx) if raw_ctx else []
    except (TypeError, json.JSONDecodeError):
        d["code_context"] = []
    return d


# ── Projects ────────────────────────────────────────────────────────

def list_projects() -> List[dict]:
    """All projects, each annotated with scan_count, last_scan_at, and
    open_findings_count (total findings across all its scans)."""
    with get_db() as conn:
        rows = conn.execute("""
            SELECT
                p.*,
                COUNT(DISTINCT s.id)  AS scan_count,
                MAX(s.started_at)     AS last_scan_at,
                COUNT(f.id)           AS open_findings_count
            FROM projects p
            LEFT JOIN scans s    ON s.project_id = p.id
            LEFT JOIN findings f ON f.scan_id    = s.id
            GROUP BY p.id
            ORDER BY last_scan_at DESC
        """).fetchall()
        return [dict(r) for r in rows]


def get_project(project_id: int) -> Optional[dict]:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
        return dict(row) if row else None


def get_scans_for_project(project_id: int) -> List[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT s.*, COUNT(f.id) AS findings_count
            FROM scans s
            LEFT JOIN findings f ON f.scan_id = s.id
            WHERE s.project_id = ?
            GROUP BY s.id
            ORDER BY s.started_at DESC
            """,
            (project_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def delete_project(project_id: int) -> bool:
    """Cascades manually since SQLite FKs don't auto-cascade unless
    ON DELETE CASCADE is declared, which the Phase 1 schema doesn't use."""
    with get_db() as conn:
        scan_ids = [
            r["id"] for r in conn.execute(
                "SELECT id FROM scans WHERE project_id = ?", (project_id,)
            ).fetchall()
        ]
        if scan_ids:
            placeholders = ",".join("?" * len(scan_ids))
            conn.execute(
                f"DELETE FROM findings WHERE scan_id IN ({placeholders})",
                scan_ids,
            )
            conn.execute(
                f"DELETE FROM scans WHERE id IN ({placeholders})",
                scan_ids,
            )
        cursor = conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        return cursor.rowcount > 0


# ── Scans ───────────────────────────────────────────────────────────

def get_scan(scan_id: int) -> Optional[dict]:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM scans WHERE id = ?", (scan_id,)).fetchone()
        return dict(row) if row else None


def list_scans(project_id: Optional[int] = None) -> List[dict]:
    """All completed scans (report-able), with project name attached and a
    findings_count. Powers GET /api/reports."""
    query = """
        SELECT
            s.*,
            p.name AS project_name,
            p.repo_url AS repo_url,
            COUNT(f.id) AS findings_count
        FROM scans s
        JOIN projects p ON p.id = s.project_id
        LEFT JOIN findings f ON f.scan_id = s.id
        WHERE 1=1
    """
    params: list = []
    if project_id is not None:
        query += " AND s.project_id = ?"
        params.append(project_id)
    query += " GROUP BY s.id ORDER BY s.started_at DESC"

    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]


# ── Findings ────────────────────────────────────────────────────────

def list_findings(
    project_id: Optional[int] = None,
    scan_id: Optional[int] = None,
    severity: Optional[str] = None,
    scanner: Optional[str] = None,
) -> List[dict]:
    """Findings joined back to their scan/project, with optional filters.
    Powers GET /api/findings."""
    query = """
        SELECT
            f.*,
            s.scan_type   AS scan_type,
            s.project_id  AS project_id,
            p.name        AS project_name
        FROM findings f
        JOIN scans s    ON s.id = f.scan_id
        JOIN projects p ON p.id = s.project_id
        WHERE 1=1
    """
    params: list = []

    if project_id is not None:
        query += " AND s.project_id = ?"
        params.append(project_id)
    if scan_id is not None:
        query += " AND f.scan_id = ?"
        params.append(scan_id)
    if severity is not None:
        query += " AND f.severity = ?"
        params.append(severity.upper())
    if scanner is not None:
        query += " AND f.scanner = ?"
        params.append(scanner)

    query += " ORDER BY f.id DESC"

    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()
        return [_row_to_finding_dict(r) for r in rows]


# ── Compliance ──────────────────────────────────────────────────────

def get_compliance_summary(project_id: Optional[int] = None) -> List[dict]:
    """Groups findings by ISO/IEC 27001:2022 Annex A control, with a
    severity breakdown per control. Powers GET /api/compliance."""
    query = """
        SELECT
            f.iso27001_control      AS control_id,
            f.iso27001_control_name AS control_name,
            f.iso27001_description  AS control_description,
            f.severity,
            COUNT(*) AS count
        FROM findings f
        JOIN scans s ON s.id = f.scan_id
        WHERE 1=1
    """
    params: list = []
    if project_id is not None:
        query += " AND s.project_id = ?"
        params.append(project_id)
    query += " GROUP BY f.iso27001_control, f.severity"

    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()

    controls: dict = {}
    for r in rows:
        cid = r["control_id"] or "unmapped"
        if cid not in controls:
            controls[cid] = {
                "control_id": cid,
                "control_name": r["control_name"],
                "control_description": r["control_description"],
                "total_findings": 0,
                "by_severity": {},
            }
        controls[cid]["by_severity"][r["severity"]] = r["count"]
        controls[cid]["total_findings"] += r["count"]

    return sorted(controls.values(), key=lambda c: c["total_findings"], reverse=True)


# ── Dashboard trend (bonus — same "views on stored data" bucket) ────

def get_findings_trend(days: int = 7) -> List[dict]:
    """Findings count per day for the last N days, based on when their
    parent scan started. Powers the dashboard 'Findings trend' chart."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT
                substr(s.started_at, 1, 10) AS day,
                COUNT(f.id) AS findings_count
            FROM scans s
            LEFT JOIN findings f ON f.scan_id = s.id
            WHERE s.started_at >= datetime('now', ?)
            GROUP BY day
            ORDER BY day ASC
            """,
            (f"-{days} days",),
        ).fetchall()
        return [dict(r) for r in rows]

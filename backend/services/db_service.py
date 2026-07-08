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
                ecosystem              TEXT
            )
        """)

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
            data["severity"],
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
        ))

    with get_db() as conn:
        conn.executemany(
            """
            INSERT INTO findings (
                scan_id, title, severity, file, line, description, rule,
                cwe, owasp, scanner, iso27001_control, iso27001_control_name,
                iso27001_description, code_context, installed_version,
                fixed_version, cvss, ecosystem
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )

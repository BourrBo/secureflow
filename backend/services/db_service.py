"""
services/db_service.py

Phase 3 — Postgres (Supabase) persistence layer with per-user isolation.

Every function below takes `user_id` (the caller's Supabase auth UUID,
resolved by `services.auth_service.get_current_user_id`) and every query
filters on it explicitly. RLS is also enabled on all three tables in
Supabase as defense in depth, but this module connects with a direct
psycopg2 connection (not the Supabase client), so RLS is NOT what enforces
isolation here — the explicit `WHERE user_id = %s` on every query is the
actual isolation boundary. Do not add a query to this file that skips it.

Schema (already created in Supabase — see project's Supabase migrations):
    projects(id, user_id, name, source_type, repo_url, created_at)
    scans(id, user_id, project_id, scan_type, status, started_at,
          finished_at, error_message)
    findings(id, user_id, scan_id, project_id, <same fields as
             models.finding.Finding>, code_context jsonb)
"""

import json
import logging
import os
import re
import time
from contextlib import contextmanager
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
import psycopg2.pool

from utils.severity import normalize_severity

logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL")

VALID_SCAN_TYPES = {"sast", "sca", "iac", "secrets", "container", "dast"}
VALID_SCAN_STATUS = {"running", "completed", "failed"}

# --- Connection pool + retry ------------------------------------------------
#
# A DAST scan can run for many minutes to hours, and during that window
# on_progress() writes to the DB every few seconds (see routes/dast.py).
# The old code called psycopg2.connect() fresh on every single one of those
# calls, which means every one of those calls also did a fresh DNS lookup
# for the Supabase pooler hostname. That's what actually happened on scan
# #15 (see server.log): a single transient DNS/network hiccup partway
# through an 8-minute scan hit insert_findings() at the very end, threw
# psycopg2.OperationalError, and then hit AGAIN inside the except-block's
# own call to finish_scan() — so the scan's results were lost AND the scan
# was left stuck on "running" forever instead of being marked "failed".
#
# Two changes fix this:
#   1. A small persistent connection pool, so most calls reuse an already-
#      established connection instead of re-resolving DNS and re-connecting
#      every time.
#   2. Retry-with-backoff around acquiring a connection, so a single
#      transient blip (the DNS lookup momentarily failing, a dropped idle
#      TCP connection, etc.) doesn't take down an entire scan's worth of
#      results.
_POOL: psycopg2.pool.ThreadedConnectionPool | None = None

_CONNECT_MAX_ATTEMPTS = 4
_CONNECT_BACKOFF_SECS = (1, 2, 5)  # delay before attempts 2, 3, 4

# TCP keepalives so a connection that's gone idle for a while (e.g. between
# progress writes during a long-running active scan) has dead/dropped
# sockets detected and recycled instead of silently hanging or erroring out
# the next time it's used.
_CONNECT_KWARGS = dict(
    cursor_factory=psycopg2.extras.RealDictCursor,
    connect_timeout=10,
    keepalives=1,
    keepalives_idle=30,
    keepalives_interval=10,
    keepalives_count=5,
)


def _get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _POOL
    if _POOL is None:
        if not DATABASE_URL:
            raise RuntimeError(
                "DATABASE_URL is not set. Copy the Postgres connection string "
                "from Supabase (Project Settings -> Database -> Connection "
                "string -> URI, use the 'Session pooler' one for a long-running "
                "backend like this) into your .env as DATABASE_URL."
            )
        _POOL = psycopg2.pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=8,
            dsn=DATABASE_URL,
            **_CONNECT_KWARGS,
        )
    return _POOL


def _get_conn_with_retry():
    """Borrows a connection from the pool, retrying transient failures
    (DNS hiccups, connection resets, etc.) with backoff before giving up."""
    pool = _get_pool()
    last_exc: Exception | None = None
    for attempt in range(1, _CONNECT_MAX_ATTEMPTS + 1):
        try:
            conn = pool.getconn()
            # A pooled connection can go stale while sitting idle (the
            # remote end closed it, a NAT/firewall dropped it, etc.) —
            # a cheap SELECT 1 here confirms it's actually usable before
            # handing it back, and discards+retries if not.
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
            return conn
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            try:
                pool.putconn(conn, close=True)  # type: ignore[possibly-undefined]
            except Exception:
                logger.debug("Failed to discard a broken pooled DB connection", exc_info=True)
            if attempt < _CONNECT_MAX_ATTEMPTS:
                delay = _CONNECT_BACKOFF_SECS[min(attempt - 1, len(_CONNECT_BACKOFF_SECS) - 1)]
                logger.warning(
                    "DB connection attempt %d/%d failed (%s) — retrying in %ds",
                    attempt,
                    _CONNECT_MAX_ATTEMPTS,
                    exc,
                    delay,
                )
                time.sleep(delay)
    logger.error(
        "DB connection failed after %d attempts: %s", _CONNECT_MAX_ATTEMPTS, last_exc
    )
    raise last_exc


@contextmanager
def get_db():
    """Yields a psycopg2 connection with dict-like row access (RealDictCursor).
    Backed by a small persistent pool with connect-retry (see above) instead
    of opening a brand-new connection — and re-resolving DNS — on every call."""
    conn = _get_conn_with_retry()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _get_pool().putconn(conn)


def init_db():
    """Verifies the DB is reachable, then sweeps any scan left in
    'running' status from a previous process — that status can only mean
    "the backend that started this scan died or restarted before it
    finished" (a clean finish always transitions to 'completed'/'failed'
    itself). Without this, a scan orphaned by a server restart mid-run
    (uvicorn --reload picking up a file change, a manual Ctrl+C, a crash)
    sits on 'running' forever, and the frontend polls it forever without
    ever getting a terminal status."""
    if not DATABASE_URL:
        return
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            cur.execute(
                """
                UPDATE scans
                SET status = 'failed',
                    finished_at = now(),
                    error_message = 'Backend restarted while this scan was in progress.'
                WHERE status = 'running'
                RETURNING id
                """
            )
            orphaned = cur.fetchall()
    if orphaned:
        logger.warning(
            "Marked %d scan(s) left running from a previous process as failed: %s",
            len(orphaned),
            [r["id"] for r in orphaned],
        )
    logger.info("Connected to Postgres successfully.")


def _now():
    return datetime.now(timezone.utc)


def derive_project_name_from_repo_url(repo_url: str) -> str:
    """'https://github.com/org/repo.git' -> 'repo'"""
    name = repo_url.rstrip("/").split("/")[-1]
    return re.sub(r"\.git$", "", name) or repo_url


def _row_to_finding_dict(row: dict) -> dict:
    d = dict(row)
    raw_ctx = d.get("code_context")
    if isinstance(raw_ctx, str):
        try:
            d["code_context"] = json.loads(raw_ctx) if raw_ctx else []
        except (TypeError, json.JSONDecodeError):
            d["code_context"] = []
    elif raw_ctx is None:
        d["code_context"] = []
    # if it's already a list/dict, psycopg2 decoded jsonb natively — leave it
    return d


# ── Projects ────────────────────────────────────────────────────────

def get_or_create_project(
    user_id: str,
    name: str,
    source_type: str,
    repo_url: str | None = None,
) -> int:
    """Reuses an existing project *belonging to this user* when the same
    repo_url (git) or the same name (upload) has been scanned before,
    otherwise creates a new one owned by this user."""
    with get_db() as conn, conn.cursor() as cur:
        if source_type == "git" and repo_url:
            cur.execute(
                "SELECT id FROM projects WHERE user_id = %s AND repo_url = %s",
                (user_id, repo_url),
            )
        else:
            cur.execute(
                "SELECT id FROM projects WHERE user_id = %s AND name = %s AND source_type = %s",
                (user_id, name, source_type),
            )
        row = cur.fetchone()
        if row:
            return row["id"]

        cur.execute(
            "INSERT INTO projects (user_id, name, source_type, repo_url, created_at) "
            "VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (user_id, name, source_type, repo_url, _now()),
        )
        return cur.fetchone()["id"]


def list_projects(user_id: str) -> list[dict]:
    """This user's projects, each annotated with scan_count, last_scan_at,
    and open_findings_count."""
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                p.*,
                COUNT(DISTINCT s.id)  AS scan_count,
                MAX(s.started_at)     AS last_scan_at,
                COUNT(f.id)           AS open_findings_count
            FROM projects p
            LEFT JOIN scans s    ON s.project_id = p.id AND s.user_id = %(uid)s
            LEFT JOIN findings f ON f.scan_id    = s.id AND f.user_id = %(uid)s
            WHERE p.user_id = %(uid)s
            GROUP BY p.id
            ORDER BY last_scan_at DESC NULLS LAST
            """,
            {"uid": user_id},
        )
        return [dict(r) for r in cur.fetchall()]


def get_project(user_id: str, project_id: int) -> dict | None:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT * FROM projects WHERE id = %s AND user_id = %s",
            (project_id, user_id),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def get_scans_for_project(user_id: str, project_id: int) -> list[dict]:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT s.*, COUNT(f.id) AS findings_count
            FROM scans s
            LEFT JOIN findings f ON f.scan_id = s.id AND f.user_id = %(uid)s
            WHERE s.project_id = %(pid)s AND s.user_id = %(uid)s
            GROUP BY s.id
            ORDER BY s.started_at DESC
            """,
            {"uid": user_id, "pid": project_id},
        )
        return [dict(r) for r in cur.fetchall()]


def delete_project(user_id: str, project_id: int) -> bool:
    """Cascades manually. Scoped to this user, so you cannot delete
    someone else's project by guessing an id."""
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM scans WHERE project_id = %s AND user_id = %s",
            (project_id, user_id),
        )
        scan_ids = [r["id"] for r in cur.fetchall()]
        if scan_ids:
            cur.execute(
                "DELETE FROM findings WHERE scan_id = ANY(%s) AND user_id = %s",
                (scan_ids, user_id),
            )
            cur.execute(
                "DELETE FROM scans WHERE id = ANY(%s) AND user_id = %s",
                (scan_ids, user_id),
            )
        cur.execute(
            "DELETE FROM projects WHERE id = %s AND user_id = %s",
            (project_id, user_id),
        )
        return cur.rowcount > 0


# ── Scans ───────────────────────────────────────────────────────────

def create_scan(user_id: str, project_id: int, scan_type: str) -> int:
    if scan_type not in VALID_SCAN_TYPES:
        raise ValueError(f"Invalid scan_type: {scan_type}")

    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO scans (user_id, project_id, scan_type, status, started_at) "
            "VALUES (%s, %s, %s, 'running', %s) RETURNING id",
            (user_id, project_id, scan_type, _now()),
        )
        return cur.fetchone()["id"]


def finish_scan(user_id: str, scan_id: int, status: str, error_message: str | None = None):
    if status not in VALID_SCAN_STATUS:
        raise ValueError(f"Invalid status: {status}")

    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE scans SET status = %s, finished_at = %s, error_message = %s "
            "WHERE id = %s AND user_id = %s",
            (status, _now(), error_message, scan_id, user_id),
        )


def update_scan_progress(user_id: str, scan_id: int, phase: str, pct: int | None) -> None:
    """
    Called from the background DAST scan thread as it moves through
    spider/AJAX-spider/active-scan phases, so GET /api/dast/scan/{id} can
    report real progress instead of a spinner with no information behind
    it. Written to the scans row itself (not just an in-memory dict) so it
    survives being read from a different request than the one that's
    updating it, and stays inspectable in the DB if needed.
    """
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE scans SET progress_phase = %s, progress_pct = %s "
            "WHERE id = %s AND user_id = %s",
            (phase, pct, scan_id, user_id),
        )


def get_scan(user_id: str, scan_id: int) -> dict | None:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT * FROM scans WHERE id = %s AND user_id = %s",
            (scan_id, user_id),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def list_scans(user_id: str, project_id: int | None = None) -> list[dict]:
    """This user's scans, with project name attached and a findings_count.
    Powers GET /api/reports."""
    query = """
        SELECT
            s.*,
            p.name AS project_name,
            p.repo_url AS repo_url,
            COUNT(f.id) AS findings_count
        FROM scans s
        JOIN projects p ON p.id = s.project_id
        LEFT JOIN findings f ON f.scan_id = s.id AND f.user_id = %(uid)s
        WHERE s.user_id = %(uid)s
    """
    params: dict = {"uid": user_id}
    if project_id is not None:
        query += " AND s.project_id = %(pid)s"
        params["pid"] = project_id
    query += " GROUP BY s.id, p.name, p.repo_url ORDER BY s.started_at DESC"

    with get_db() as conn, conn.cursor() as cur:
        cur.execute(query, params)
        return [dict(r) for r in cur.fetchall()]


# ── Findings ────────────────────────────────────────────────────────

def insert_findings(user_id: str, scan_id: int, project_id: int, findings: list) -> None:
    """`findings` is a list of models.finding.Finding instances (or objects
    with the same attributes/model_dump())."""
    if not findings:
        return

    rows = []
    for f in findings:
        data = f.model_dump() if hasattr(f, "model_dump") else dict(f)
        rows.append((
            user_id,
            scan_id,
            project_id,
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

    with get_db() as conn, conn.cursor() as cur:
        psycopg2.extras.execute_batch(
            cur,
            """
            INSERT INTO findings (
                user_id, scan_id, project_id, title, severity, file, line,
                description, rule, cwe, owasp, scanner, iso27001_control,
                iso27001_control_name, iso27001_description, code_context,
                installed_version, fixed_version, cvss, ecosystem, cve,
                epss_score
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s
            )
            """,
            rows,
        )


def list_findings(
    user_id: str,
    project_id: int | None = None,
    scan_id: int | None = None,
    severity: str | None = None,
    scanner: str | None = None,
    q: str | None = None,
    limit: int | None = None,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """This user's findings joined back to their scan/project, with optional
    filters and real pagination (limit + offset). Powers GET /api/findings.
    Returns (findings, total_count) -- total_count ignores `limit`/`offset`
    so the caller can show "showing X-Y of TOTAL" and page through the rest
    instead of only ever seeing the first `limit` rows.

    `q` is a free-text search matched server-side against the finding's id,
    title, project name, and scanner/module -- across the WHOLE result set,
    not just whatever page happens to be loaded. Previously the frontend
    only filtered the 25 rows already on the current page, so searching for
    a term that existed on a later page silently returned nothing."""
    base_query = """
        FROM findings f
        JOIN scans s    ON s.id = f.scan_id
        JOIN projects p ON p.id = s.project_id
        WHERE f.user_id = %(uid)s
    """
    params: dict = {"uid": user_id}

    if project_id is not None:
        base_query += " AND s.project_id = %(project_id)s"
        params["project_id"] = project_id
    if scan_id is not None:
        base_query += " AND f.scan_id = %(scan_id)s"
        params["scan_id"] = scan_id
    if severity is not None:
        base_query += " AND f.severity = %(severity)s"
        params["severity"] = severity.upper()
    if scanner is not None:
        base_query += " AND f.scanner = %(scanner)s"
        params["scanner"] = scanner
    if q:
        base_query += """ AND (
            f.title ILIKE %(q)s
            OR p.name ILIKE %(q)s
            OR f.scanner ILIKE %(q)s
            OR s.scan_type ILIKE %(q)s
            OR CAST(f.id AS TEXT) ILIKE %(q)s
        )"""
        params["q"] = f"%{q.strip()}%"

    with get_db() as conn, conn.cursor() as cur:
        cur.execute(f"SELECT COUNT(*) AS total {base_query}", params)
        total = cur.fetchone()["total"]

        select_query = (
            f"SELECT f.*, s.scan_type AS scan_type, s.project_id AS project_id, "
            f"p.name AS project_name {base_query} ORDER BY f.id DESC"
        )
        if limit is not None:
            select_query += " LIMIT %(limit)s OFFSET %(offset)s"
            params["limit"] = limit
            params["offset"] = offset

        cur.execute(select_query, params)
        return [_row_to_finding_dict(r) for r in cur.fetchall()], total


def delete_all_findings(user_id: str, project_id: int | None = None, scanner: str | None = None) -> int:
    """Deletes this user's findings rows (optionally scoped to a
    project/scanner), leaving scans/projects records intact."""
    query = "DELETE FROM findings WHERE user_id = %(uid)s"
    params: dict = {"uid": user_id}

    if project_id is not None:
        query += " AND scan_id IN (SELECT id FROM scans WHERE project_id = %(pid)s AND user_id = %(uid)s)"
        params["pid"] = project_id
    if scanner is not None:
        query += " AND scanner = %(scanner)s"
        params["scanner"] = scanner

    with get_db() as conn, conn.cursor() as cur:
        cur.execute(query, params)
        return cur.rowcount


def delete_all_workspace_data(user_id: str) -> dict:
    """Destructive workspace reset for the authenticated user.

    Deletes all findings, scans, and projects owned by this user. Deletion is
    performed in dependency order so scan/project references are removed only
    after their child findings are gone. The function runs inside the normal
    ``get_db()`` transaction, so any database error rolls the whole reset back.

    Returns counts of deleted rows.
    """
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "DELETE FROM findings WHERE user_id = %s",
            (user_id,),
        )
        findings_deleted = cur.rowcount

        cur.execute(
            "DELETE FROM scans WHERE user_id = %s",
            (user_id,),
        )
        scans_deleted = cur.rowcount

        cur.execute(
            "DELETE FROM projects WHERE user_id = %s",
            (user_id,),
        )
        projects_deleted = cur.rowcount

    return {
        "findings": findings_deleted,
        "scans": scans_deleted,
        "projects": projects_deleted,
    }


# ── Compliance ──────────────────────────────────────────────────────

def get_compliance_frameworks(user_id: str, project_id: int | None = None) -> list[dict]:
    """
    Powers GET /api/compliance's top-level score card(s). The frontend
    expects an array of {name, score, controls_passed, controls_total} —
    this used to just not exist (the route returned {"controls": [...]}, a
    per-violated-control breakdown, under a completely different shape than
    what the frontend's normalizeFramework()/complianceQuery() read, which
    look for a "frameworks" key). That mismatch — not any actual scoring
    logic — is why the compliance page always rendered its empty state
    regardless of how much real, correctly-mapped data existed underneath.

    "Compliant" here means: of the Annex A controls scanners can plausibly
    map a finding to (see mappings/iso27001.py — 25 of them, not the full
    93-control Annex A), how many currently have zero open findings against
    them. This only covers what static/dependency/secret/IaC/DAST scanning
    can actually observe — it is not a substitute for a real ISO 27001
    audit, and should be labeled as such wherever it's displayed.
    """
    from mappings.iso27001 import ANNEX_A_CONTROLS

    total_controls = len(ANNEX_A_CONTROLS)

    query = """
        SELECT DISTINCT f.iso27001_control
        FROM findings f
        JOIN scans s ON s.id = f.scan_id
        WHERE f.user_id = %(uid)s AND f.iso27001_control IS NOT NULL
    """
    params: dict = {"uid": user_id}
    if project_id is not None:
        query += " AND s.project_id = %(project_id)s"
        params["project_id"] = project_id

    with get_db() as conn, conn.cursor() as cur:
        cur.execute(query, params)
        triggered = {r["iso27001_control"] for r in cur.fetchall()}

    passed = max(0, total_controls - len(triggered))
    score = round(passed / total_controls * 100) if total_controls else 100

    return [
        {
            "name": "ISO/IEC 27001:2022",
            "controls_passed": passed,
            "controls_total": total_controls,
            "score": score,
        }
    ]


def get_compliance_summary(user_id: str, project_id: int | None = None) -> list[dict]:
    """Groups this user's findings by ISO/IEC 27001:2022 Annex A control,
    with a severity breakdown per control. Powers GET /api/compliance."""
    query = """
        SELECT
            f.iso27001_control      AS control_id,
            f.iso27001_control_name AS control_name,
            f.iso27001_description  AS control_description,
            f.severity,
            COUNT(*) AS count
        FROM findings f
        JOIN scans s ON s.id = f.scan_id
        WHERE f.user_id = %(uid)s
    """
    params: dict = {"uid": user_id}
    if project_id is not None:
        query += " AND s.project_id = %(pid)s"
        params["pid"] = project_id
    query += " GROUP BY f.iso27001_control, f.iso27001_control_name, f.iso27001_description, f.severity"

    with get_db() as conn, conn.cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()

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


# ── Dashboard trend ───────────────────────────────────────────────

def get_findings_trend(user_id: str, days: int = 7) -> list[dict]:
    """This user's findings count per day for the last N days, based on
    when their parent scan started. Powers the dashboard trend chart."""
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                to_char(s.started_at, 'YYYY-MM-DD') AS day,
                COUNT(f.id) AS findings_count
            FROM scans s
            LEFT JOIN findings f ON f.scan_id = s.id AND f.user_id = %(uid)s
            WHERE s.user_id = %(uid)s
              AND s.started_at >= now() - (%(days)s || ' days')::interval
            GROUP BY day
            ORDER BY day ASC
            """,
            {"uid": user_id, "days": days},
        )
        return [dict(r) for r in cur.fetchall()]

# ── API keys (CI/CD machine-to-machine auth) ────────────────────────
#
# A key is shown to the user exactly once, at creation time. Only its
# SHA-256 hash is ever persisted -- same principle as a password. The
# stored `key_prefix` (first 8 chars) lets the Settings UI show "which
# key is which" without ever displaying the full secret again.

def create_api_key(
    user_id: str,
    name: str,
    key_prefix: str,
    key_hash: str,
    project_id: int | None = None,
) -> dict:
    """Persists a newly generated key's hash (never the raw key itself --
    that's returned to the caller once by the route and discarded here)."""
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO api_keys (user_id, name, key_prefix, key_hash, project_id)
            VALUES (%(uid)s, %(name)s, %(prefix)s, %(hash)s, %(pid)s)
            RETURNING id, name, key_prefix, project_id, created_at, last_used_at, revoked_at
            """,
            {"uid": user_id, "name": name, "prefix": key_prefix, "hash": key_hash, "pid": project_id},
        )
        return dict(cur.fetchone())


def list_api_keys(user_id: str) -> list[dict]:
    """Never returns key_hash -- only the prefix, enough to identify a key
    without ever re-exposing the secret."""
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, key_prefix, project_id, created_at, last_used_at, revoked_at
            FROM api_keys
            WHERE user_id = %(uid)s
            ORDER BY created_at DESC
            """,
            {"uid": user_id},
        )
        return [dict(r) for r in cur.fetchall()]


def revoke_api_key(user_id: str, key_id: int) -> bool:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE api_keys SET revoked_at = now()
            WHERE id = %(kid)s AND user_id = %(uid)s AND revoked_at IS NULL
            """,
            {"kid": key_id, "uid": user_id},
        )
        return cur.rowcount > 0


def get_user_id_for_api_key(key_hash: str) -> str | None:
    """Looks up an active (non-revoked) key by its hash and returns the
    owning user_id, or None if the key doesn't exist / was revoked. Also
    stamps last_used_at so the Settings UI can show real usage, not just
    creation date."""
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE api_keys SET last_used_at = now()
            WHERE key_hash = %(hash)s AND revoked_at IS NULL
            RETURNING user_id
            """,
            {"hash": key_hash},
        )
        row = cur.fetchone()
        return str(row["user_id"]) if row else None


# ── CI/CD gate ───────────────────────────────────────────────────────

def record_gate_run(
    user_id: str,
    project_id: int,
    fail_on: str,
    passed: bool,
    blocking_count: int,
    total_findings: int,
    scan_id: int | None = None,
    commit_sha: str | None = None,
    triggered_by: str | None = None,
) -> dict:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO gate_runs
                (user_id, project_id, scan_id, fail_on, passed, blocking_count,
                 total_findings, commit_sha, triggered_by)
            VALUES
                (%(uid)s, %(pid)s, %(sid)s, %(fail_on)s, %(passed)s, %(blocking)s,
                 %(total)s, %(sha)s, %(by)s)
            RETURNING id, project_id, scan_id, fail_on, passed, blocking_count,
                      total_findings, commit_sha, triggered_by, created_at
            """,
            {
                "uid": user_id,
                "pid": project_id,
                "sid": scan_id,
                "fail_on": fail_on,
                "passed": passed,
                "blocking": blocking_count,
                "total": total_findings,
                "sha": commit_sha,
                "by": triggered_by,
            },
        )
        return dict(cur.fetchone())


def list_gate_runs(user_id: str, project_id: int | None = None, limit: int = 50) -> list[dict]:
    query = """
        SELECT g.*, p.name AS project_name
        FROM gate_runs g
        JOIN projects p ON p.id = g.project_id
        WHERE g.user_id = %(uid)s
    """
    params: dict = {"uid": user_id, "limit": limit}
    if project_id is not None:
        query += " AND g.project_id = %(pid)s"
        params["pid"] = project_id
    query += " ORDER BY g.created_at DESC LIMIT %(limit)s"

    with get_db() as conn, conn.cursor() as cur:
        cur.execute(query, params)
        return [dict(r) for r in cur.fetchall()]

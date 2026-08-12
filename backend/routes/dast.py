import logging
import threading

from fastapi import APIRouter, Depends, HTTPException

from models.dast_request import DastScanRequest
from parsers.zap_parser import normalize_zap_findings
from scanners.zap_runner import (
    ZapScanError,
    run_zap_scan,
)
from services.auth_service import get_current_user_id
from services.db_service import (
    create_scan,
    finish_scan,
    get_or_create_project,
    get_scan,
    insert_findings,
    list_findings,
    update_scan_progress,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# DAST scans run against a single shared ZAP instance/session (see
# zap_runner.py's per-scan zap.core.new_session() call). Running two scans
# at once would have them race to reset/use that same session, so scans are
# serialized here rather than trying to make ZAP itself handle concurrency.
_zap_scan_lock = threading.Lock()


def _run_dast_scan_background(user_id: str, project_id: int, scan_id: int, target_url: str, scan_mode: str) -> None:
    """
    Runs the actual ZAP scan on a worker thread so the HTTP request that
    triggered it can return immediately. user_id/project_id are captured
    from the original request here — there's no FastAPI request context
    (and therefore no Depends()) left once this is running on its own
    thread, so they're passed in explicitly instead.
    """
    def on_progress(phase: str, pct: int | None) -> None:
        # Best-effort — a progress update failing (e.g. a transient DB
        # hiccup) must never take down the scan itself.
        try:
            update_scan_progress(user_id, scan_id, phase, pct)
        except Exception:
            logger.debug("Failed to write progress for scan #%s", scan_id, exc_info=True)

    def _safe_finish_scan(status: str, error_message: str | None = None) -> None:
        # finish_scan() itself can fail (e.g. the same transient DB issue
        # that caused the scan to fail in the first place — see scan #15 in
        # server.log, where finish_scan("failed", ...) threw a SECOND
        # unhandled OperationalError and killed this background thread
        # before the scan could even be marked "failed"). That left the
        # scan permanently stuck on "running" with no findings and no error
        # message — the frontend would poll it forever. db_service.get_db()
        # now retries transient failures on its own (see services/db_service
        # .py), so this should rarely be needed, but this call must never be
        # allowed to raise: it is the last thing standing between a failed
        # scan and one that just silently disappears.
        try:
            finish_scan(user_id, scan_id, status, error_message=error_message)
        except Exception:
            logger.critical(
                "Could not mark DAST scan #%s as '%s' in the DB — it will "
                "stay stuck on 'running' until manually corrected. "
                "Underlying scan error (if any): %s",
                scan_id,
                status,
                error_message,
                exc_info=True,
            )

    try:
        with _zap_scan_lock:
            logger.info(
                "Starting %s DAST scan #%s against %s",
                scan_mode.upper(),
                scan_id,
                target_url,
            )
            raw_alerts = run_zap_scan(
                target_url=target_url,
                scan_mode=scan_mode,
                on_progress=on_progress,
            )

        findings = normalize_zap_findings(raw_alerts)
        insert_findings(user_id, scan_id, project_id, findings)
        _safe_finish_scan("completed")

        logger.info(
            "DAST scan #%s completed successfully with %d findings",
            scan_id,
            len(findings),
        )

    except ZapScanError as exc:
        logger.error("DAST scan #%s failed: %s", scan_id, exc)
        _safe_finish_scan("failed", error_message=str(exc))

    except Exception as exc:
        # background thread with no request/response cycle left to catch
        # it; anything unexpected must still mark the scan failed with a
        # reason, or it would sit as "running" forever.
        logger.exception("Unexpected DAST error on scan #%s", scan_id)
        _safe_finish_scan("failed", error_message=str(exc))


@router.post("/api/dast/scan")
def scan_dast(request: DastScanRequest, user_id: str = Depends(get_current_user_id)):
    """
    Kicks off a DAST scan against a running web application and returns
    immediately with a scan_id — it does NOT wait for the scan to finish.
    Poll GET /api/dast/scan/{scan_id} for status and, once completed, the
    findings.
    """
    project_id = get_or_create_project(
        user_id,
        name=request.target_url,
        source_type="upload",
    )

    scan_id = create_scan(user_id, project_id, "dast")

    thread = threading.Thread(
        target=_run_dast_scan_background,
        args=(user_id, project_id, scan_id, request.target_url, request.scan_mode),
        daemon=True,
    )
    thread.start()

    logger.info(
        "Queued %s DAST scan #%s against %s (running in background)",
        request.scan_mode.upper(),
        scan_id,
        request.target_url,
    )

    return {
        "scan_id": scan_id,
        "status": "running",
        "target_url": request.target_url,
        "scan_mode": request.scan_mode,
    }


@router.get("/api/dast/scan/{scan_id}")
def get_dast_scan_status(scan_id: int, user_id: str = Depends(get_current_user_id)):
    """
    Poll this while a scan is running. Short-lived request by design — safe
    to call every few seconds even over a flaky tunnel, unlike waiting on
    the original POST for the scan's entire duration. progress_phase /
    progress_pct reflect real backend state (written by zap_runner.py as it
    moves through spider/AJAX-spider/active-scan) — not a synthetic
    frontend animation.
    """
    scan = get_scan(user_id, scan_id)
    if not scan or scan["scan_type"] != "dast":
        raise HTTPException(status_code=404, detail="DAST scan not found")

    status = scan["status"]
    response = {
        "scan_id": scan_id,
        "status": status,
        "started_at": scan["started_at"],
        "finished_at": scan["finished_at"],
        "progress_phase": scan.get("progress_phase"),
        "progress_pct": scan.get("progress_pct"),
    }

    if status == "completed":
        findings, _total = list_findings(user_id, scan_id=scan_id)
        response["findings"] = findings
    elif status == "failed":
        response["error"] = scan.get("error_message") or "DAST scan failed."

    return response
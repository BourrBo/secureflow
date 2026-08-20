import logging
import threading

from fastapi import APIRouter, Depends, HTTPException

from models.dast_request import DastScanRequest
from parsers.zap_parser import normalize_zap_findings
from scanners.zap_runner import (
    ZapScanCancelled,
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
    is_cancel_requested,
    list_findings,
    mark_scan_running,
    request_scan_cancel,
    update_scan_progress,
    update_scan_telemetry,
)
from utils.ssrf_guard import SSRFValidationError, validate_dast_target

logger = logging.getLogger(__name__)

router = APIRouter()

# DAST scans run against a single shared ZAP instance/session, so only one
# can actually execute at a time. `_zap_scan_lock` still serializes that.
# What changed (Priority 8): the caller is now told explicitly when a scan
# is queued behind another one, instead of the scan silently sitting in
# 'running' status in the DB the whole time it's actually just waiting for
# the lock.
_zap_scan_lock = threading.Lock()


def _get_live_active_scan() -> dict | None:
    """Best-effort live telemetry from the currently running ZAP active scan."""
    try:
        from zapv2 import ZAPv2

        from utils.zap_utils import get_zap_config

        config = get_zap_config()
        zap = ZAPv2(
            apikey=config["api_key"] or None,
            proxies=config["proxies"],
        )

        # zap.ascan.scans is a @property in python-owasp-zap-v2.4, NOT a
        # method — calling it as zap.ascan.scans() raises TypeError and
        # was being silently swallowed by the except below, which is what
        # made "Requests processed" show "—" for all of scan #76. See the
        # postmortem in zap_runner.py's _active_scan_telemetry docstring.
        scans = zap.ascan.scans or []
        running = [
            scan for scan in scans
            if str(scan.get("state", "")).upper() == "RUNNING"
        ]

        # Some ZAP versions don't expose state consistently. If there is only
        # one active-scan entry, use it as a fallback while SecureFlow's own
        # scan row says the DAST scan is running.
        scan = running[-1] if running else (scans[-1] if len(scans) == 1 else None)
        if not scan:
            return None

        def _as_int(value):
            try:
                return int(value)
            except (TypeError, ValueError):
                return None

        requests = _as_int(
            scan.get("reqCount")
            or scan.get("requestCount")
            or scan.get("requests")
        )
        alerts = _as_int(
            scan.get("alertCount")
            or scan.get("alerts")
        )
        progress = _as_int(scan.get("progress"))

        return {
            "requests": requests,
            "progress": progress,
            "state": str(scan.get("state") or "RUNNING").upper(),
            "alerts": alerts,
        }
    except Exception:
        # Telemetry must never break the scan/status endpoint. The frontend
        # falls back to an indeterminate Active Scan display when unavailable.
        logger.debug("Could not read live ZAP active-scan telemetry", exc_info=True)
        return None


def _run_dast_scan_background(
    user_id: str,
    project_id: int,
    scan_id: int,
    target_url: str,
    scan_mode: str,
) -> None:
    """Run ZAP on a worker thread so the POST request returns immediately."""

    def on_progress(phase: str, pct: int | None) -> None:
        try:
            update_scan_progress(user_id, scan_id, phase, pct)
        except Exception:
            logger.debug("Failed to write progress for scan #%s", scan_id, exc_info=True)

    def cancel_fn() -> bool:
        try:
            return is_cancel_requested(user_id, scan_id)
        except Exception:
            # If we can't even check, don't cancel on a false positive —
            # let the safety ceiling be the fallback instead.
            logger.debug("Failed to check cancel flag for scan #%s", scan_id, exc_info=True)
            return False

    def _safe_finish_scan(status: str, error_message: str | None = None) -> None:
        try:
            finish_scan(user_id, scan_id, status, error_message=error_message)
        except Exception:
            logger.critical(
                "Could not mark DAST scan #%s as '%s' in the DB. "
                "Underlying scan error (if any): %s",
                scan_id,
                status,
                error_message,
                exc_info=True,
            )

    # Queued behind another scan? Say so explicitly rather than leaving the
    # scan row silently sitting there with no indication anything is
    # different from a scan that's actually running.
    if _zap_scan_lock.locked():
        logger.info("DAST scan #%s is queued — ZAP is busy with another scan", scan_id)
        try:
            update_scan_progress(user_id, scan_id, "queued: waiting for scanner", None)
        except Exception:
            logger.debug("Failed to write queued state for scan #%s", scan_id, exc_info=True)

    try:
        with _zap_scan_lock:
            if cancel_fn():
                _safe_finish_scan("cancelled", error_message="Cancelled while queued.")
                logger.info("DAST scan #%s was cancelled before it started running", scan_id)
                return

            mark_scan_running(user_id, scan_id)
            logger.info(
                "Starting %s DAST scan #%s against %s",
                scan_mode.upper(),
                scan_id,
                target_url,
            )
            result = run_zap_scan(
                target_url=target_url,
                scan_mode=scan_mode,
                on_progress=on_progress,
                cancel_fn=cancel_fn,
            )

        update_scan_telemetry(
            user_id,
            scan_id,
            ajax_spider_status=result.get("ajax_spider_status"),
            scanner_coverage=result.get("scanner_coverage"),
        )

        findings = normalize_zap_findings(result["alerts"])
        insert_findings(user_id, scan_id, project_id, findings)

        if result["outcome"] == "timed_out":
            # The 4-hour safety ceiling was hit somewhere in the run. This
            # must NOT look like a normal completion (Priority 4) — the
            # results collected so far are real but partial.
            _safe_finish_scan(
                "timed_out",
                error_message=(
                    "Scan hit the 4-hour safety ceiling before ZAP reported "
                    "completion. Results below are partial."
                ),
            )
            logger.warning(
                "DAST scan #%s TIMED OUT with %d partial findings",
                scan_id, len(findings),
            )
        else:
            _safe_finish_scan("completed")
            logger.info(
                "DAST scan #%s completed successfully with %d findings",
                scan_id,
                len(findings),
            )

    except ZapScanCancelled:
        logger.info("DAST scan #%s was cancelled by user request", scan_id)
        _safe_finish_scan("cancelled", error_message="Cancelled by user request.")

    except ZapScanError as exc:
        logger.error("DAST scan #%s failed: %s", scan_id, exc)
        _safe_finish_scan("failed", error_message=str(exc))

    except Exception as exc:
        logger.exception("Unexpected DAST error on scan #%s", scan_id)
        _safe_finish_scan("failed", error_message=str(exc))


@router.post("/api/dast/scan")
def scan_dast(request: DastScanRequest, user_id: str = Depends(get_current_user_id)):
    """Queue a background DAST scan and immediately return its scan_id."""
    try:
        target_url = validate_dast_target(request.target_url)
    except SSRFValidationError as exc:
        # SecureFlow is itself a security product — its own DAST endpoint
        # must not become an SSRF primitive against internal/cloud-metadata
        # targets (Priority 9). Rejected before any DB row or ZAP call.
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    project_id = get_or_create_project(
        user_id,
        name=target_url,
        source_type="upload",
    )

    scanner_busy = _zap_scan_lock.locked()
    initial_status = "queued" if scanner_busy else "running"
    scan_id = create_scan(user_id, project_id, "dast", initial_status=initial_status)

    thread = threading.Thread(
        target=_run_dast_scan_background,
        args=(user_id, project_id, scan_id, target_url, request.scan_mode),
        daemon=True,
    )
    thread.start()

    logger.info(
        "%s %s DAST scan #%s against %s (running in background)",
        "Queued" if scanner_busy else "Started",
        request.scan_mode.upper(),
        scan_id,
        target_url,
    )

    return {
        "scan_id": scan_id,
        "status": initial_status,
        "scanner_busy": scanner_busy,
        "target_url": target_url,
        "scan_mode": request.scan_mode,
    }


@router.post("/api/dast/scan/{scan_id}/cancel")
def cancel_dast_scan(scan_id: int, user_id: str = Depends(get_current_user_id)):
    """Requests cancellation of a queued or running DAST scan (Priority 5).
    Cooperative: the background thread notices the flag at its next poll
    checkpoint and stops ZAP, restores Windows sleep state, and marks the
    scan CANCELLED. This endpoint returns immediately — it does not itself
    wait for the scan to actually stop."""
    scan = get_scan(user_id, scan_id)
    if not scan or scan["scan_type"] != "dast":
        raise HTTPException(status_code=404, detail="DAST scan not found")

    if scan["status"] not in ("queued", "running"):
        raise HTTPException(
            status_code=409,
            detail=f"Scan is already in a terminal state ({scan['status']}) and cannot be cancelled.",
        )

    request_scan_cancel(user_id, scan_id)
    logger.info("Cancellation requested for DAST scan #%s", scan_id)
    return {"scan_id": scan_id, "cancel_requested": True}


@router.get("/api/dast/scan/{scan_id}")
def get_dast_scan_status(scan_id: int, user_id: str = Depends(get_current_user_id)):
    """Return persisted DAST status plus best-effort live Active Scan telemetry."""
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
        "ajax_spider_status": scan.get("ajax_spider_status"),
        "scanner_coverage": scan.get("scanner_coverage"),
        "cancel_requested": scan.get("cancel_requested", False),
        "active_scan_requests": None,
        "active_scan_progress": None,
        "active_scan_state": None,
        "active_scan_alerts": None,
    }

    if status == "running" and "active" in str(scan.get("progress_phase") or "").lower():
        live = _get_live_active_scan()
        if live:
            response["active_scan_requests"] = live["requests"]
            response["active_scan_progress"] = live["progress"]
            response["active_scan_state"] = live["state"]
            response["active_scan_alerts"] = live["alerts"]

    if status in ("completed", "timed_out"):
        findings, _total = list_findings(user_id, scan_id=scan_id)
        response["findings"] = findings
        if status == "timed_out":
            response["partial_results"] = True
            response["error"] = scan.get("error_message")
    elif status == "failed":
        response["error"] = scan.get("error_message") or "DAST scan failed."
    elif status == "cancelled":
        response["error"] = scan.get("error_message") or "DAST scan was cancelled."

    return response

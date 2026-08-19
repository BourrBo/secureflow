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

# DAST scans run against a single shared ZAP instance/session.
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

        scans = zap.ascan.scans() or []
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
        logger.exception("Unexpected DAST error on scan #%s", scan_id)
        _safe_finish_scan("failed", error_message=str(exc))


@router.post("/api/dast/scan")
def scan_dast(request: DastScanRequest, user_id: str = Depends(get_current_user_id)):
    """Queue a background DAST scan and immediately return its scan_id."""
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

    if status == "completed":
        findings, _total = list_findings(user_id, scan_id=scan_id)
        response["findings"] = findings
    elif status == "failed":
        response["error"] = scan.get("error_message") or "DAST scan failed."

    return response

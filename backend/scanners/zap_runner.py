"""
scanners/zap_runner.py

Drives OWASP ZAP 2.17.0 through a full dynamic scan of a target URL:

    ensure ZAP is up -> open target -> spider -> passive scan (wait) ->
    active scan -> pull alerts as JSON

Like trivy_runner.py / semgrep_runner.py, this module knows nothing about
SecureFlow's Finding schema, database, or HTTP layer — it takes a target
and safety limits in, and returns raw ZAP alert dicts out. Normalizing that
raw output into a Finding happens in parsers/zap_parser.py.
"""

import logging
import time
from typing import List

from utils.zap_utils import get_zap_config, ensure_zap_reachable

logger = logging.getLogger(__name__)


class ZapScanError(RuntimeError):
    """Raised for any failure during the ZAP scan lifecycle."""


def _import_zap_client():
    try:
        from zapv2 import ZAPv2
        return ZAPv2
    except ImportError:
        raise ZapScanError(
            "The 'python-owasp-zap-v2.4' package is not installed. Install "
            "it with:\n"
            "    pip install python-owasp-zap-v2.4\n"
            "(see backend/requirements.txt)."
        )


def _poll_until(
    condition_fn,
    timeout_secs: int,
    interval_secs: float,
    phase: str,
    progress_fn=None,
    log_every_secs: float = 10.0,
):
    """Polls condition_fn() (expected to return True when done) until it's
    True or timeout_secs elapses. Logs a progress line every log_every_secs
    (using progress_fn() if given, e.g. "35%") so a multi-minute phase
    doesn't sit silent in the console — this is the lightweight version of
    proper progress reporting; a real progress API/websocket can replace it
    later without changing this function's contract.

    Callers decide whether a timeout should abort the whole scan or just
    proceed with partial results (we choose "proceed" for spider/active scan
    so a slow target doesn't lose everything found so far)."""
    start = time.time()
    deadline = start + timeout_secs
    last_log = 0.0

    while time.time() < deadline:
        if condition_fn():
            logger.info("DAST %s phase complete (%.0fs elapsed)", phase, time.time() - start)
            return True

        elapsed = time.time() - start
        if elapsed - last_log >= log_every_secs:
            if progress_fn:
                logger.info("DAST %s phase in progress — %s (%.0fs elapsed)", phase, progress_fn(), elapsed)
            else:
                logger.info("DAST %s phase in progress (%.0fs elapsed)", phase, elapsed)
            last_log = elapsed

        time.sleep(interval_secs)

    logger.warning("DAST %s phase timed out after %ss — proceeding with partial results", phase, timeout_secs)
    return False


def run_zap_scan(
    target_url: str,
    max_spider_duration_mins: int = 5,
    max_scan_duration_mins: int = 15,
) -> List[dict]:
    """
    Runs the full ZAP workflow against target_url and returns the list of
    raw alert dicts (as returned by ZAP's core.alerts API — each one has
    keys like 'alert', 'risk', 'confidence', 'cweid', 'url', 'param',
    'description', 'solution', 'reference', 'evidence', etc.).

    Raises ZapScanError on anything that prevents a scan from happening at
    all (ZAP unreachable, target unreachable, package missing). Timeouts on
    individual phases (spider/active scan taking too long) are treated as
    soft limits — we move on and report whatever ZAP found up to that point,
    the same way a real pentest engagement has a time-boxed window.
    """
    if not target_url or not target_url.strip():
        raise ZapScanError("target_url must not be empty.")

    ZAPv2 = _import_zap_client()
    config = get_zap_config()

    logger.info("DAST scan starting for target=%s", target_url)

    # Confirms ZAP is reachable at the configured host/port. Connect-only by
    # default (expects ZAP Desktop already open) — see utils/zap_utils.py.
    ensure_zap_reachable(config)
    logger.info("Connected to ZAP at %s:%s", config["host"], config["port"])

    zap = ZAPv2(apikey=config["api_key"] or None, proxies=config["proxies"])

    # ── Sanity check: can ZAP actually reach the target? ──
    # zap.urlopen() also seeds ZAP's site tree, which spider/ascan need.
    try:
        zap.urlopen(target_url)
        time.sleep(2)  # give the passive scanner a moment to see the first request
    except Exception as exc:
        raise ZapScanError(
            f"ZAP could not reach '{target_url}'. Make sure the target "
            f"application is actually running and accessible from this "
            f"machine before starting a DAST scan. Underlying error: {exc}"
        )

    # ── Spider: discover URLs/endpoints ──
    logger.info("DAST spider phase starting (max %s min)", max_spider_duration_mins)
    try:
        spider_scan_id = zap.spider.scan(target_url)
    except Exception as exc:
        raise ZapScanError(f"Failed to start ZAP spider on '{target_url}': {exc}")

    spider_finished = _poll_until(
        lambda: int(zap.spider.status(spider_scan_id)) >= 100,
        timeout_secs=max_spider_duration_mins * 60,
        interval_secs=2,
        phase="spider",
        progress_fn=lambda: f"{zap.spider.status(spider_scan_id)}%",
    )
    if not spider_finished:
        try:
            zap.spider.stop(spider_scan_id)
        except Exception:
            pass  # best-effort — we're proceeding with partial results regardless

    # ── Passive scan: let ZAP finish analyzing everything the spider found ──
    logger.info("DAST passive scan phase starting")
    _poll_until(
        lambda: int(zap.pscan.records_to_scan) == 0,
        timeout_secs=120,
        interval_secs=2,
        phase="passive scan",
        progress_fn=lambda: f"{zap.pscan.records_to_scan} records left",
    )

    # ── Active scan: actually attack the discovered endpoints ──
    logger.info("DAST active scan phase starting (max %s min)", max_scan_duration_mins)
    try:
        active_scan_id = zap.ascan.scan(target_url)
    except Exception as exc:
        raise ZapScanError(f"Failed to start ZAP active scan on '{target_url}': {exc}")

    active_finished = _poll_until(
        lambda: int(zap.ascan.status(active_scan_id)) >= 100,
        timeout_secs=max_scan_duration_mins * 60,
        interval_secs=3,
        phase="active scan",
        progress_fn=lambda: f"{zap.ascan.status(active_scan_id)}%",
    )
    if not active_finished:
        try:
            zap.ascan.stop(active_scan_id)
        except Exception:
            pass

    # ── Export findings ──
    # core.alerts() gives structured per-alert dicts, which is what
    # parsers/zap_parser.py normalizes. (zap.core.jsonreport() is also
    # available if a raw full-report JSON export is ever needed for audit
    # purposes — deliberately not used here since alerts() is already JSON
    # and easier to map field-by-field.)
    try:
        alerts = zap.core.alerts(baseurl=target_url)
    except Exception as exc:
        raise ZapScanError(f"Failed to retrieve alerts from ZAP: {exc}")

    logger.info("DAST scan complete for target=%s — %d alerts found", target_url, len(alerts))
    return alerts

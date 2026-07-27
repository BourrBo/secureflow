
import logging
import time
from typing import List

from utils.zap_utils import get_zap_config, ensure_zap_reachable
from config.dast_profiles import SCAN_PROFILES

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
    start = time.time()
    deadline = start + timeout_secs
    last_log = 0.0

    while time.time() < deadline:
        if condition_fn():
            logger.info(
                "DAST %s phase complete (%.0fs elapsed)",
                phase,
                time.time() - start,
            )
            return True

        elapsed = time.time() - start

        if elapsed - last_log >= log_every_secs:
            if progress_fn:
                logger.info(
                    "DAST %s phase in progress — %s (%.0fs elapsed)",
                    phase,
                    progress_fn(),
                    elapsed,
                )
            else:
                logger.info(
                    "DAST %s phase in progress (%.0fs elapsed)",
                    phase,
                    elapsed,
                )

            last_log = elapsed

        time.sleep(interval_secs)

    logger.warning(
        "DAST %s phase timed out after %ss — proceeding with partial results",
        phase,
        timeout_secs,
    )

    return False


def _wait_for_passive_scan(zap, timeout=120):
    logger.info("Waiting for passive scan to finish...")

    _poll_until(
        lambda: int(zap.pscan.records_to_scan) == 0,
        timeout_secs=timeout,
        interval_secs=2,
        phase="passive scan",
        progress_fn=lambda: f"{zap.pscan.records_to_scan} records left",
    )


def _run_spider(
    zap,
    target_url,
    timeout_minutes,
):
    logger.info(
        "Spider Scan starting (max %s min)",
        timeout_minutes,
    )

    try:
        spider_scan_id = zap.spider.scan(target_url)
    except Exception as exc:
        raise ZapScanError(
            f"Failed to start spider scan: {exc}"
        )

    finished = _poll_until(
        lambda: int(zap.spider.status(spider_scan_id)) >= 100,
        timeout_secs=timeout_minutes * 60,
        interval_secs=2,
        phase="spider",
        progress_fn=lambda: f"{zap.spider.status(spider_scan_id)}%",
    )

    if not finished:
        try:
            zap.spider.stop(spider_scan_id)
        except Exception:
            pass

    return finished


def _run_ajax_spider(
    zap,
    target_url,
    timeout_minutes,
):
    logger.info(
        "AJAX Spider starting (max %s min)",
        timeout_minutes,
    )

    try:
        zap.ajaxSpider.scan(target_url)
    except Exception as exc:
        logger.warning(
            "Unable to start AJAX spider: %s",
            exc,
        )
        return False

    finished = _poll_until(
        lambda: zap.ajaxSpider.status.lower() == "stopped",
        timeout_secs=timeout_minutes * 60,
        interval_secs=3,
        phase="ajax spider",
        progress_fn=lambda: zap.ajaxSpider.status,
    )

    if not finished:
        try:
            zap.ajaxSpider.stop()
        except Exception:
            pass

    return finished


def _run_active_scan(
    zap,
    target_url,
    timeout_minutes,
):
    logger.info(
        "Active Scan starting (max %s min)",
        timeout_minutes,
    )

    try:
        active_scan_id = zap.ascan.scan(target_url)
    except Exception as exc:
        raise ZapScanError(
            f"Failed to start active scan: {exc}"
        )

    finished = _poll_until(
        lambda: int(zap.ascan.status(active_scan_id)) >= 100,
        timeout_secs=timeout_minutes * 60,
        interval_secs=3,
        phase="active scan",
        progress_fn=lambda: f"{zap.ascan.status(active_scan_id)}%",
    )

    if not finished:
        try:
            zap.ascan.stop(active_scan_id)
        except Exception:
            pass

    return finished


def _load_profile(scan_mode):
    if not scan_mode:
        scan_mode = "standard"

    scan_mode = scan_mode.lower()

    if scan_mode not in SCAN_PROFILES:
        raise ZapScanError(
            f"Unsupported scan mode '{scan_mode}'. "
            f"Supported modes: {', '.join(SCAN_PROFILES.keys())}"
        )

    return SCAN_PROFILES[scan_mode]


def run_zap_scan(
    target_url: str,
    scan_mode: str = "standard",
) -> List[dict]:

    if not target_url or not target_url.strip():
        raise ZapScanError("target_url must not be empty.")

    profile = _load_profile(scan_mode)

    spider_timeout = profile["max_spider_duration_mins"]
    active_timeout = profile["max_scan_duration_mins"]

    enable_active_scan = profile["enable_active_scan"]
    enable_ajax_spider = profile["enable_ajax_spider"]

    logger.info(
        "Starting %s DAST scan",
        profile["name"],
    )

    logger.info("STEP 1",  )

    ZAPv2 = _import_zap_client()

    logger.info("STEP 2",  )

    config = get_zap_config()

    logger.info("STEP 3",  )

    ensure_zap_reachable(config)

    logger.info("STEP 4",  )

    logger.info(
        "Connected to ZAP at %s:%s",
        config["host"],
        config["port"],
    )

    zap = ZAPv2(
        apikey=config["api_key"] or None,
        proxies=config["proxies"],
    )

    logger.info("STEP 5",  )

    try:
        logger.info("STEP 6",  )
        zap.urlopen(target_url)
        logger.info("STEP 7",  )
        time.sleep(2)
    except Exception as exc:
        raise ZapScanError(
            f"Unable to reach target '{target_url}'. "
            f"Underlying error: {exc}"
        )

    logger.info("STEP 8",  )

    _run_spider(
        zap,
        target_url,
        spider_timeout,
    )

    logger.info("STEP 9")

    _wait_for_passive_scan(zap)

    logger.info("STEP 10")

    
    if enable_ajax_spider:
        logger.info("AJAX Spider enabled for this profile")

        _run_ajax_spider(
            zap,
            target_url,
            spider_timeout,
        )

        _wait_for_passive_scan(zap)

    if enable_active_scan:
        logger.info("Active Scan enabled for this profile")

        _run_active_scan(
            zap,
            target_url,
            active_timeout,
        )

        _wait_for_passive_scan(zap)
    else:
        logger.info(
            "Skipping Active Scan because it is disabled for '%s' profile",
            scan_mode,
        )

    logger.info("Collecting alerts from ZAP")

    try:
        alerts = zap.core.alerts(baseurl=target_url)
    except Exception as exc:
        raise ZapScanError(
            f"Failed to retrieve alerts from ZAP: {exc}"
        )

    logger.info(
        "Retrieved %d alerts",
        len(alerts),
    )

    try:
        hosts = zap.core.hosts
        logger.info(
            "Hosts discovered: %s",
            ", ".join(hosts) if hosts else "None",
        )
    except Exception:
        pass

    try:
        sites = zap.core.sites
        logger.info(
            "Sites in session: %s",
            ", ".join(sites) if sites else "None",
        )
    except Exception:
        pass

    severity_summary = {
        "High": 0,
        "Medium": 0,
        "Low": 0,
        "Informational": 0,
        "Unknown": 0,
    }

    confidence_summary = {
        "High": 0,
        "Medium": 0,
        "Low": 0,
        "User Confirmed": 0,
        "Unknown": 0,
    }

    for alert in alerts:
        risk = (
            alert.get("risk")
            or alert.get("riskdesc", "")
        ).split(" ")[0]

        confidence = (
            alert.get("confidence")
            or "Unknown"
        )

        if risk in severity_summary:
            severity_summary[risk] += 1
        else:
            severity_summary["Unknown"] += 1

        if confidence in confidence_summary:
            confidence_summary[confidence] += 1
        else:
            confidence_summary["Unknown"] += 1

    logger.info("---------- Scan Summary ----------")

    logger.info("Target           : %s", target_url)
    logger.info("Profile          : %s", profile["name"])
    logger.info("Spider           : Completed")
    logger.info(
        "AJAX Spider      : %s",
        "Enabled" if enable_ajax_spider else "Skipped",
    )
    logger.info(
        "Active Scan      : %s",
        "Enabled" if enable_active_scan else "Skipped",
    )

    logger.info("Total Alerts     : %d", len(alerts))

    logger.info(
        "High             : %d",
        severity_summary["High"],
    )
    logger.info(
        "Medium           : %d",
        severity_summary["Medium"],
    )
    logger.info(
        "Low              : %d",
        severity_summary["Low"],
    )
    logger.info(
        "Informational    : %d",
        severity_summary["Informational"],
    )
    logger.info(
        "Unknown          : %d",
        severity_summary["Unknown"],
    )

    logger.info("Confidence Summary")

    for level, count in confidence_summary.items():
        logger.info(
            "%-16s : %d",
            level,
            count,
        )

    logger.info("----------------------------------")

    return alerts
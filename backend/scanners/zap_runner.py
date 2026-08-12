import contextlib
import ctypes
import logging
import platform
import time

from config.dast_profiles import SCAN_PROFILES
from utils.zap_utils import ensure_zap_reachable, get_zap_config

logger = logging.getLogger(__name__)

# Windows sleep/standby was observed killing ZAP mid-scan (the machine
# suspends, ZAP's process and/or its network connections don't survive
# that, and the scan just hangs or dies with no clean error). This asks
# Windows to keep the system (and, since a DAST scan is all about network
# I/O to the target, the display doesn't matter but the system+network
# path does) awake for the duration of a scan, then explicitly releases
# that request afterwards. No-op on any non-Windows OS.
_ES_CONTINUOUS = 0x80000000
_ES_SYSTEM_REQUIRED = 0x00000001


@contextlib.contextmanager
def _prevent_windows_sleep():
    if platform.system() != "Windows":
        yield
        return
    try:
        ctypes.windll.kernel32.SetThreadExecutionState(  # type: ignore[attr-defined]
            _ES_CONTINUOUS | _ES_SYSTEM_REQUIRED
        )
        logger.info("Windows sleep suspended for the duration of this DAST scan")
    except Exception:
        # never worth failing the scan over.
        logger.debug("Could not suspend Windows sleep for this scan", exc_info=True)
    try:
        yield
    finally:
        try:
            ctypes.windll.kernel32.SetThreadExecutionState(_ES_CONTINUOUS)  # type: ignore[attr-defined]
            logger.info("Windows sleep restored to normal after this DAST scan")
        except Exception:
            logger.debug("Could not restore normal Windows sleep behavior", exc_info=True)

# A genuine "let it fully finish" scan has no natural time limit — a large
# real-world site can legitimately take hours of active scanning. This is
# NOT the timeout that used to cut scans off early (that one is gone: see
# _poll_until below, which waits on ZAP's own completion signal, not a
# clock). This is only a last-resort safety valve so a single stuck ZAP
# rule/host can't hold the global scan lock (see routes/dast.py) hostage
# forever if something on the ZAP side genuinely wedges. In the normal
# case this is never hit.
_SAFETY_CEILING_SECS = 4 * 60 * 60  # 4 hours


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
    phase: str,
    progress_fn=None,
    pct_fn=None,
    on_progress=None,
    interval_secs: float = 2.0,
    log_every_secs: float = 10.0,
):
    """
    Waits for `condition_fn()` to become true — i.e. for ZAP itself to
    report a phase complete — with no external deadline. The previous
    version of this function gave up after a fixed timeout and moved on
    with whatever partial results existed at that point, which is why
    "active scan" never looked like it was doing much: it was being
    interrupted mid-run on anything but a tiny site. The only thing that
    stops this loop now is ZAP finishing the phase, or the outer safety
    ceiling in run_zap_scan() as an absolute last resort.

    `pct_fn`, if given, returns this phase's own 0-100 progress (or None
    for phases ZAP doesn't report a percentage for, like the passive scan
    queue or the AJAX spider). `on_progress(phase, pct)` — typically a
    closure that writes to the scans row — is called at the same throttled
    cadence as the log line, so a caller polling the API sees real,
    backend-verified progress rather than a bare spinner.
    """
    start = time.time()
    last_log = 0.0

    if on_progress:
        on_progress(phase, pct_fn() if pct_fn else None)

    while True:
        if condition_fn():
            logger.info(
                "DAST %s phase complete (%.0fs elapsed)",
                phase,
                time.time() - start,
            )
            if on_progress:
                on_progress(phase, 100)
            return True

        elapsed = time.time() - start

        if elapsed >= _SAFETY_CEILING_SECS:
            logger.warning(
                "DAST %s phase hit the %.0fs safety ceiling — proceeding "
                "with partial results. This should be rare; if it happens "
                "often, something on the ZAP side is likely stuck rather "
                "than the target genuinely needing longer.",
                phase,
                _SAFETY_CEILING_SECS,
            )
            return False

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
            if on_progress:
                on_progress(phase, pct_fn() if pct_fn else None)
            last_log = elapsed

        time.sleep(interval_secs)


def _wait_for_passive_scan(zap, on_progress=None, timeout=120):
    logger.info("Waiting for passive scan to finish...")

    _poll_until(
        lambda: int(zap.pscan.records_to_scan) == 0,
        phase="passive scan",
        progress_fn=lambda: f"{zap.pscan.records_to_scan} records left",
        on_progress=on_progress,
    )


def _run_spider(zap, target_url, on_progress=None):
    logger.info("Spider Scan starting (unlimited duration)")

    try:
        # Tell ZAP itself not to self-limit either — otherwise a leftover
        # setting from a previous GUI session (or ZAP's own default) could
        # still cut the spider short independently of our own polling.
        zap.spider.set_option_max_duration(0)
        zap.spider.set_option_max_depth(0)     # 0 = unlimited crawl depth
        zap.spider.set_option_max_children(0)  # 0 = unlimited links per node

        # This is the actual reason a scan against a site like
        # testphp.vulnweb.com came back with ~1 finding despite the active
        # scanner grinding for 20+ minutes: ZAP's spider honors robots.txt
        # by default, and that site's robots.txt disallows crawling —
        # confirmed independently (fetching it returns "robots disallowed").
        # The spider dutifully found almost nothing, so the active scanner
        # had almost nothing to attack. robots.txt is a courtesy for
        # search-engine indexing, not a security boundary; an authorized
        # security scan has no reason to respect it, and every site whose
        # interesting attack surface lives under a Disallow: / would
        # otherwise scan as if it were empty.
        zap.spider.set_option_parse_robots_txt(False)

        spider_scan_id = zap.spider.scan(target_url)
    except Exception as exc:
        logger.exception("Failed to start spider scan")
        raise ZapScanError(f"Failed to start spider scan: {exc}") from exc

    finished = _poll_until(
        lambda: int(zap.spider.status(spider_scan_id)) >= 100,
        phase="spider",
        progress_fn=lambda: f"{zap.spider.status(spider_scan_id)}%",
        pct_fn=lambda: int(zap.spider.status(spider_scan_id)),
        on_progress=on_progress,
    )

    if not finished:
        try:
            zap.spider.stop(spider_scan_id)
        except Exception as exc:  # noqa: BLE001 — best-effort cleanup;
            # any failure to stop is non-fatal, but shouldn't be silent.
            logger.debug("Failed to stop spider scan %s: %s", spider_scan_id, exc)

    return finished


def _run_ajax_spider(zap, target_url, on_progress=None):
    logger.info("AJAX Spider starting (unlimited duration)")

    try:
        zap.ajaxSpider.set_option_max_duration(0)
        zap.ajaxSpider.set_option_max_crawl_depth(0)   # 0 = unlimited
        zap.ajaxSpider.set_option_max_crawl_states(0)  # 0 = unlimited
        zap.ajaxSpider.scan(target_url)
    except Exception as exc:  # noqa: BLE001 — zapv2 has no documented
        # exception hierarchy; treat any failure to start as non-fatal.
        logger.warning("Unable to start AJAX spider: %s", exc)
        return False

    finished = _poll_until(
        lambda: zap.ajaxSpider.status.lower() == "stopped",
        phase="ajax spider",
        interval_secs=3,
        progress_fn=lambda: zap.ajaxSpider.status,
        on_progress=on_progress,
    )

    if not finished:
        try:
            zap.ajaxSpider.stop()
        except Exception as exc:  # noqa: BLE001 — best-effort cleanup;
            # any failure to stop is non-fatal, but shouldn't be silent.
            logger.debug("Failed to stop AJAX spider: %s", exc)

    return finished


def _maximize_scan_thoroughness(zap):
    """
    Pushes every ZAP setting that trades speed/noise for coverage as far as
    it goes: every active-scan rule enabled (not just the default subset),
    maximum attack strength (most payload variations tried per parameter),
    and lowest alert threshold (most sensitive — reports weaker-confidence
    findings too, rather than only the certain ones). Also enables every
    passive-scan rule, since those run for free on every response ZAP sees
    regardless of active scanning.

    Attack strength/threshold are set per individual scan rule (each rule
    returned by ascan.scanners() has its own id) rather than via
    set_policy_attack_strength()/set_policy_alert_threshold() — those two
    take an `id` that refers to a scan-policy *category* node, not "the
    whole policy", and passing a strength string in that slot the first
    time this was written just raised a missing-argument TypeError. Setting
    it per-rule is slower (one call per rule) but unambiguous and matches
    exactly what enable_all_scanners() just enabled.

    This trades some false-positive rate and scan time for the "don't miss
    anything" goal — the right tradeoff for a tool whose job is finding
    vulnerabilities, not for a CI gate that needs to stay quiet on noise.
    """
    try:
        zap.pscan.enable_all_scanners()
        zap.ascan.enable_all_scanners()

        scanners = zap.ascan.scanners()
        applied = 0
        for scanner in scanners:
            scanner_id = scanner.get("id")
            if scanner_id is None:
                continue
            zap.ascan.set_scanner_attack_strength(scanner_id, "INSANE")
            zap.ascan.set_scanner_alert_threshold(scanner_id, "LOW")
            applied += 1

        logger.info(
            "Maximized scan thoroughness: all scanners enabled, attack "
            "strength INSANE and alert threshold LOW applied to %d/%d rules",
            applied,
            len(scanners),
        )
    except Exception as exc:  # noqa: BLE001 — if this fails, the scan can
        # still proceed with ZAP's default policy rather than aborting
        # entirely over a settings call.
        logger.warning("Could not fully maximize scan thoroughness: %s", exc)


def _run_active_scan(zap, target_url, on_progress=None):
    logger.info("Active Scan starting (unlimited duration)")

    try:
        # These two are the crux of "active scan doesn't do much" — without
        # them, ZAP applies its own (possibly short, possibly GUI-leftover)
        # per-scan and per-rule duration caps regardless of anything set
        # here in Python.
        zap.ascan.set_option_max_scan_duration_in_mins(0)
        zap.ascan.set_option_max_rule_duration_in_mins(0)
        active_scan_id = zap.ascan.scan(target_url)
    except Exception as exc:
        logger.exception("Failed to start active scan")
        raise ZapScanError(f"Failed to start active scan: {exc}") from exc

    finished = _poll_until(
        lambda: int(zap.ascan.status(active_scan_id)) >= 100,
        phase="active scan",
        interval_secs=3,
        progress_fn=lambda: f"{zap.ascan.status(active_scan_id)}%",
        pct_fn=lambda: int(zap.ascan.status(active_scan_id)),
        on_progress=on_progress,
    )

    if not finished:
        try:
            zap.ascan.stop(active_scan_id)
        except Exception as exc:  # noqa: BLE001 — best-effort cleanup;
            # any failure to stop is non-fatal, but shouldn't be silent.
            logger.debug("Failed to stop active scan %s: %s", active_scan_id, exc)

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
    on_progress=None,
) -> list[dict]:

    if not target_url or not target_url.strip():
        raise ZapScanError("target_url must not be empty.")

    profile = _load_profile(scan_mode)

    enable_active_scan = profile["enable_active_scan"]
    enable_ajax_spider = profile["enable_ajax_spider"]

    logger.info("Starting %s DAST scan", profile["name"])

    logger.info("STEP 1")
    ZAPv2 = _import_zap_client()

    logger.info("STEP 2")
    config = get_zap_config()

    logger.info("STEP 3")
    ensure_zap_reachable(config)

    logger.info("STEP 4")
    logger.info("Connected to ZAP at %s:%s", config["host"], config["port"])

    zap = ZAPv2(
        apikey=config["api_key"] or None,
        proxies=config["proxies"],
    )

    logger.info("STEP 5")

    # ZAP runs as a long-lived daemon (autostart only launches it once; it
    # keeps running across every scan you trigger afterwards). Without an
    # explicit new session here, every scan's spider/active-scan results and
    # the site tree accumulate forever in the SAME ZAP session — so scan #2
    # inherits everything ZAP already learned in scan #1, the spider finds
    # "nothing new" and finishes in seconds, the active scan has almost
    # nothing queued, and zap.core.alerts(baseurl=...) below only returns the
    # slice of that shared, cross-contaminated session matching the exact
    # target_url string. Clearing findings in the SecureFlow dashboard does
    # NOT touch this — that only clears our own DB, not ZAP's internal state.
    # Starting a fresh, named session per scan makes every run independent
    # and reproducible, the way scan_id-scoped results should be.
    try:
        session_name = f"secureflow-scan-{int(time.time())}"
        zap.core.new_session(name=session_name, overwrite=True)
        logger.info("Started fresh ZAP session '%s' for this scan", session_name)
    except Exception as exc:  # noqa: BLE001 — if the running ZAP instance
        # can't create a new session (e.g. an older API), don't hard-fail the
        # whole scan over it — but make the risk visible in the logs instead
        # of silently scanning against whatever session already exists.
        logger.warning(
            "Could not start a fresh ZAP session (%s) — this scan may reuse "
            "state from a previous scan in the same ZAP instance.",
            exc,
        )

    try:
        logger.info("STEP 6")
        zap.urlopen(target_url)
        logger.info("STEP 7")
        time.sleep(2)
    except Exception as exc:
        logger.exception("Unable to reach target '%s'", target_url)
        raise ZapScanError(
            f"Unable to reach target '{target_url}'. "
            f"Underlying error: {exc}"
        ) from exc

    _maximize_scan_thoroughness(zap)

    with _prevent_windows_sleep():
        logger.info("STEP 8")
        _run_spider(zap, target_url, on_progress=on_progress)

        logger.info("STEP 9")
        _wait_for_passive_scan(zap, on_progress=on_progress)

        logger.info("STEP 10")

        if enable_ajax_spider:
            logger.info("AJAX Spider enabled for this profile")
            _run_ajax_spider(zap, target_url, on_progress=on_progress)
            _wait_for_passive_scan(zap, on_progress=on_progress)

        if enable_active_scan:
            logger.info("Active Scan enabled for this profile")
            _run_active_scan(zap, target_url, on_progress=on_progress)
            _wait_for_passive_scan(zap, on_progress=on_progress)
        else:
            logger.info(
                "Skipping Active Scan because it is disabled for '%s' profile",
                scan_mode,
            )

    logger.info("Collecting alerts from ZAP")

    try:
        # No baseurl filter here anymore. This used to be
        # zap.core.alerts(baseurl=target_url) — an exact string match
        # against whatever URL you typed in. Since every scan now starts
        # from a fresh, isolated session (see the new_session() call
        # above), there's nothing left in this session that isn't from
        # *this* scan, so filtering by the literal input string only
        # causes harm: a target that redirects http->https (or bare
        # domain -> www, or vice versa — exactly what happened scanning
        # testphp.vulnweb.com) records real findings under a host/scheme
        # variant that doesn't textually match target_url, and they'd be
        # silently dropped right here even though ZAP found them.
        alerts = zap.core.alerts()
    except Exception as exc:
        logger.exception("Failed to retrieve alerts from ZAP")
        raise ZapScanError(f"Failed to retrieve alerts from ZAP: {exc}") from exc

    logger.info("Retrieved %d alerts", len(alerts))

    try:
        hosts = zap.core.hosts
        logger.info("Hosts discovered: %s", ", ".join(hosts) if hosts else "None")
    except Exception as exc:  # noqa: BLE001 — purely informational logging.
        logger.debug("Unable to retrieve hosts from ZAP: %s", exc)

    try:
        sites = zap.core.sites
        logger.info("Sites in session: %s", ", ".join(sites) if sites else "None")
    except Exception as exc:  # noqa: BLE001 — purely informational logging.
        logger.debug("Unable to retrieve sites from ZAP: %s", exc)

    severity_summary = {"High": 0, "Medium": 0, "Low": 0, "Informational": 0, "Unknown": 0}
    confidence_summary = {"High": 0, "Medium": 0, "Low": 0, "User Confirmed": 0, "Unknown": 0}

    for alert in alerts:
        risk = (alert.get("risk") or alert.get("riskdesc", "")).split(" ")[0]
        confidence = alert.get("confidence") or "Unknown"

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
    logger.info("AJAX Spider      : %s", "Enabled" if enable_ajax_spider else "Skipped")
    logger.info("Active Scan      : %s", "Enabled" if enable_active_scan else "Skipped")
    logger.info("Total Alerts     : %d", len(alerts))
    logger.info("High             : %d", severity_summary["High"])
    logger.info("Medium           : %d", severity_summary["Medium"])
    logger.info("Low              : %d", severity_summary["Low"])
    logger.info("Informational    : %d", severity_summary["Informational"])
    logger.info("Unknown          : %d", severity_summary["Unknown"])
    logger.info("Confidence Summary")
    for level, count in confidence_summary.items():
        logger.info("%-16s : %d", level, count)
    logger.info("----------------------------------")

    return alerts
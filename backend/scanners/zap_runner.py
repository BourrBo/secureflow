import contextlib
import ctypes
import logging
import os
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
# only a last-resort safety valve so a single stuck ZAP rule/host can't
# hold the global scan lock (see routes/dast.py) hostage forever if
# something on the ZAP side genuinely wedges. In the normal case this is
# never hit — and when it IS hit, the scan now ends as TIMED_OUT rather
# than silently looking like a normal COMPLETED run with partial results.
_SAFETY_CEILING_SECS = 4 * 60 * 60  # 4 hours

# Active-scan stall recovery (Priority 2). A scan is only considered
# stalled if progress, request count, AND alert count are ALL unchanged
# for this long — percentage alone is not trustworthy (ZAP can sit at 0%
# for a long time while genuinely sending thousands of requests). This is
# a recovery mechanism for a wedged rule, not the normal path, so the
# window is deliberately generous, and configurable rather than
# hard-coded — see backend handover notes, item 5.
_STALL_WINDOW_SECS = int(os.environ.get("DAST_ACTIVE_SCAN_STALL_TIMEOUT_SECONDS", 5 * 60))

# Cadence for the "is the active scan actually doing anything" telemetry
# log line — item 8 in the handover notes. Independent of _poll_until's
# own (throttled, generic) logging cadence.
_ACTIVE_SCAN_TELEMETRY_LOG_SECS = 5

# Valid ZAP attack-strength values. Pydantic (models/dast_request.py)
# already restricts the API request to these, but run_zap_scan() is also
# callable directly (tests, scripts), so it re-validates defensively here
# rather than trusting an arbitrary string all the way down into ZAP.
_VALID_ATTACK_STRENGTHS = {"LOW", "MEDIUM", "HIGH", "INSANE"}
_DEFAULT_ATTACK_STRENGTH = "MEDIUM"

# Terminal/([intermediate]) phase outcomes returned by _poll_until().
OUTCOME_COMPLETED = "completed"
OUTCOME_TIMED_OUT = "timed_out"
OUTCOME_CANCELLED = "cancelled"


class ZapScanError(RuntimeError):
    """Raised for any failure during the ZAP scan lifecycle."""


class ZapScanCancelled(RuntimeError):
    """Raised internally when a cooperative cancellation request is observed."""


class ZapScanTimedOut(RuntimeError):
    """Raised when the outer safety ceiling is hit for a phase that has no
    well-defined 'proceed with partial results' behavior (e.g. spider)."""


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
    cancel_fn=None,
    interval_secs: float = 2.0,
    log_every_secs: float = 10.0,
):
    """
    Waits for `condition_fn()` to become true — i.e. for ZAP itself to
    report a phase complete — with no external deadline. The only things
    that stop this loop are: ZAP finishing the phase (-> "completed"), a
    cooperative cancellation request becoming true (-> "cancelled"), or
    the outer safety ceiling as an absolute last resort (-> "timed_out").

    `pct_fn`, if given, returns this phase's own 0-100 progress (or None
    for phases ZAP doesn't report a percentage for, like the passive scan
    queue or the AJAX spider). `on_progress(phase, pct)` — typically a
    closure that writes to the scans row — is called at the same throttled
    cadence as the log line, so a caller polling the API sees real,
    backend-verified progress rather than a bare spinner.

    `cancel_fn`, if given, is polled at the same cadence as the safety
    ceiling check (every loop iteration — cancellation should feel
    responsive, not throttled) and should return True once the user has
    asked to cancel the scan.
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
            return OUTCOME_COMPLETED

        if cancel_fn and cancel_fn():
            logger.info("DAST %s phase cancelled by user request (%.0fs elapsed)", phase, time.time() - start)
            return OUTCOME_CANCELLED

        elapsed = time.time() - start

        if elapsed >= _SAFETY_CEILING_SECS:
            logger.warning(
                "DAST %s phase hit the %.0fs safety ceiling. This should be "
                "rare; if it happens often, something on the ZAP side is "
                "likely stuck rather than the target genuinely needing "
                "longer.",
                phase,
                _SAFETY_CEILING_SECS,
            )
            return OUTCOME_TIMED_OUT

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


def _wait_for_passive_scan(zap, on_progress=None, cancel_fn=None):
    logger.info("Waiting for passive scan to finish...")

    outcome = _poll_until(
        lambda: int(zap.pscan.records_to_scan) == 0,
        phase="passive scan",
        progress_fn=lambda: f"{zap.pscan.records_to_scan} records left",
        on_progress=on_progress,
        cancel_fn=cancel_fn,
    )
    if outcome == OUTCOME_CANCELLED:
        raise ZapScanCancelled("Cancelled while waiting for passive scan")
    # A passive-scan phase hitting the safety ceiling isn't fatal — the
    # queue just keeps draining in the background — so we proceed either way.
    return outcome


def _run_spider(zap, target_url, on_progress=None, cancel_fn=None):
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

    outcome = _poll_until(
        lambda: int(zap.spider.status(spider_scan_id)) >= 100,
        phase="spider",
        progress_fn=lambda: f"{zap.spider.status(spider_scan_id)}%",
        pct_fn=lambda: int(zap.spider.status(spider_scan_id)),
        on_progress=on_progress,
        cancel_fn=cancel_fn,
    )

    if outcome != OUTCOME_COMPLETED:
        try:
            zap.spider.stop(spider_scan_id)
        except Exception as exc:  # noqa: BLE001 — best-effort cleanup;
            # any failure to stop is non-fatal, but shouldn't be silent.
            logger.debug("Failed to stop spider scan %s: %s", spider_scan_id, exc)

    if outcome == OUTCOME_CANCELLED:
        raise ZapScanCancelled("Cancelled during spider phase")

    return outcome


def _run_ajax_spider(zap, target_url, on_progress=None, cancel_fn=None) -> str:
    """Returns one of: 'completed', 'timed_out', 'failed_to_start'.
    Never raises for a plain start failure — that used to be silently
    swallowed (Priority 6); it's now reported back to the caller instead,
    which persists it to scans.ajax_spider_status so the UI/report can say
    'AJAX Spider: Failed' instead of implying the Full scan was clean.
    """
    logger.info("AJAX Spider starting (unlimited duration)")

    try:
        zap.ajaxSpider.set_option_max_duration(0)
        zap.ajaxSpider.set_option_max_crawl_depth(0)   # 0 = unlimited
        zap.ajaxSpider.set_option_max_crawl_states(0)  # 0 = unlimited
        zap.ajaxSpider.scan(target_url)
    except Exception as exc:  # noqa: BLE001 — zapv2 has no documented
        # exception hierarchy; treat any failure to start as non-fatal to
        # the overall scan, but make it visible rather than silent.
        logger.warning("Unable to start AJAX spider: %s", exc)
        return "failed_to_start"

    outcome = _poll_until(
        lambda: zap.ajaxSpider.status.lower() == "stopped",
        phase="ajax spider",
        interval_secs=3,
        progress_fn=lambda: zap.ajaxSpider.status,
        on_progress=on_progress,
        cancel_fn=cancel_fn,
    )

    if outcome != OUTCOME_COMPLETED:
        try:
            zap.ajaxSpider.stop()
        except Exception as exc:  # noqa: BLE001 — best-effort cleanup;
            # any failure to stop is non-fatal, but shouldn't be silent.
            logger.debug("Failed to stop AJAX spider: %s", exc)

    if outcome == OUTCOME_CANCELLED:
        raise ZapScanCancelled("Cancelled during AJAX spider phase")

    return outcome  # "completed" or "timed_out"


def _apply_attack_strength(zap, attack_strength: str, alert_threshold: str) -> tuple[int, int]:
    """
    Applies `attack_strength`/`alert_threshold` to every active-scan rule.
    Returns (applied, total) so the caller can report real coverage
    (Priority 7) instead of silently continuing on partial failure.

    Set per-rule (each rule returned by ascan.scanners() has its own id)
    rather than via set_policy_attack_strength()/set_policy_alert_threshold()
    — those two take an `id` that refers to a scan-policy *category* node,
    not "the whole policy". Slower (one call per rule) but unambiguous.
    """
    scanners = zap.ascan.scanners()
    applied = 0
    for scanner in scanners:
        scanner_id = scanner.get("id")
        if scanner_id is None:
            continue
        try:
            zap.ascan.set_scanner_attack_strength(scanner_id, attack_strength)
            zap.ascan.set_scanner_alert_threshold(scanner_id, alert_threshold)
            applied += 1
        except Exception as exc:  # noqa: BLE001 — keep going; report the
            # shortfall at the end rather than aborting the whole scan
            # over one rule ZAP wouldn't configure.
            logger.debug("Could not configure rule %s: %s", scanner_id, exc)
    return applied, len(scanners)


def _maximize_scan_thoroughness(zap, attack_strength: str, alert_threshold: str) -> str:
    """
    Enables every passive/active scan rule, then applies `attack_strength`
    / `alert_threshold` (profile-specific — see config/dast_profiles.py) to
    every active rule.

    Returns a short human-readable coverage string, e.g. "53/53 rules
    configured" or "47/53 rules configured (degraded)", which the caller
    persists to scans.scanner_coverage. A Full scan should either report
    full coverage or clearly say it didn't — this used to catch every
    exception and quietly fall back to ZAP's default policy with only a
    warning-level log line the user would never see (Priority 7/8 in the
    handover).
    """
    try:
        zap.pscan.enable_all_scanners()
        zap.ascan.enable_all_scanners()

        applied, total = _apply_attack_strength(zap, attack_strength, alert_threshold)

        coverage = f"{applied}/{total} rules configured"
        if applied < total:
            coverage += " (degraded)"
            logger.warning(
                "Scanner configuration degraded: %s (attack_strength=%s, "
                "alert_threshold=%s)",
                coverage, attack_strength, alert_threshold,
            )
        else:
            logger.info(
                "Maximized scan thoroughness: all scanners enabled, attack "
                "strength %s and alert threshold %s applied to %s",
                attack_strength, alert_threshold, coverage,
            )
        return coverage
    except Exception as exc:  # noqa: BLE001 — the scan can still proceed
        # with ZAP's default policy rather than aborting entirely over a
        # settings call, but this is now reported, not swallowed.
        logger.warning("Could not fully maximize scan thoroughness: %s", exc)
        return "configuration failed — ZAP default policy in use (degraded)"


def _active_scan_telemetry(zap, active_scan_id) -> tuple[int | None, int | None, int | None, str | None]:
    """Best-effort (pct, request_count, alert_count, state) for one active
    scan id.

    IMPORTANT: `zap.ascan.scans` is a @property in python-owasp-zap-v2.4,
    NOT a method — `zap.ascan.scans()` raises TypeError('list' object is
    not callable), which the broad except below used to swallow silently.
    That bug is what caused scan #76's "Requests processed: —" and, far
    more seriously, made the stall detector below blind to request count
    entirely — see the postmortem in the DAST hardening notes for how that
    produced a false-positive restart and ~7,900 duplicate finding rows.
    Property access (no parens) is correct and is what's used here.
    """
    pct = None
    try:
        pct = int(zap.ascan.status(active_scan_id))
    except Exception as exc:  # noqa: BLE001 — telemetry is best-effort;
        # never worth breaking the poll loop over.
        logger.debug("Could not read active scan status for %s: %s", active_scan_id, exc)

    req_count = None
    alert_count = None
    state = None
    try:
        for scan in zap.ascan.scans or []:  # property, not a method call
            if str(scan.get("id")) == str(active_scan_id):
                raw = scan.get("reqCount") or scan.get("requestCount")
                if raw is not None:
                    req_count = int(raw)
                raw_alerts = scan.get("alertCount")
                if raw_alerts is not None:
                    alert_count = int(raw_alerts)
                state = scan.get("state")
                break
    except Exception as exc:  # noqa: BLE001 — same as above, best-effort.
        logger.debug("Could not read active scan request/alert count for %s: %s", active_scan_id, exc)

    return pct, req_count, alert_count, state


def _run_active_scan(
    zap,
    target_url,
    attack_strength: str,
    alert_threshold: str,
    on_progress=None,
    cancel_fn=None,
) -> str:
    """
    Runs the active scan with stall detection + one automatic recovery
    step (Priority 2): only if percentage, request count, AND alert count
    are ALL unchanged for _STALL_WINDOW_SECS (default 5 minutes,
    configurable via DAST_ACTIVE_SCAN_STALL_TIMEOUT_SECONDS), and we're
    running at INSANE, the scan is stopped and restarted once at HIGH
    strength. This is deliberately NOT triggered by percentage alone (ZAP
    legitimately reports 0% for long stretches while genuinely sending
    thousands of requests) and is a fallback recovery path, not normal
    behavior — it only ever fires once per scan.

    Also logs real ZAP telemetry (id/state/progress/requests/alerts/
    elapsed/strength) roughly every 5 seconds regardless of the stall
    state, so a scan's actual behavior is auditable from the logs alone —
    this is what would have caught scan #76's false-positive restart
    immediately instead of only being diagnosable after the fact from the
    findings table.

    Returns one of: 'completed', 'timed_out', 'cancelled'.
    """
    current_strength = attack_strength
    start_ts = time.time()

    def _start():
        zap.ascan.set_option_max_scan_duration_in_mins(0)
        zap.ascan.set_option_max_rule_duration_in_mins(0)
        return zap.ascan.scan(target_url)

    logger.info("Active Scan starting (unlimited duration, strength=%s)", current_strength)

    try:
        active_scan_id = _start()
    except Exception as exc:
        logger.exception("Failed to start active scan")
        raise ZapScanError(f"Failed to start active scan: {exc}") from exc

    downgraded_already = False
    last_pct, last_req, last_alerts, _ = _active_scan_telemetry(zap, active_scan_id)
    last_change_ts = time.time()
    last_telemetry_log_ts = 0.0

    def condition_fn():
        pct, _, _, _ = _active_scan_telemetry(zap, active_scan_id)
        return pct is not None and pct >= 100

    def pct_fn():
        pct, _, _, _ = _active_scan_telemetry(zap, active_scan_id)
        return pct if pct is not None else 0

    def progress_fn():
        pct, req, alerts, state = _active_scan_telemetry(zap, active_scan_id)
        return (
            f"{pct if pct is not None else '?'}% "
            f"({req if req is not None else '?'} requests, "
            f"{alerts if alerts is not None else '?'} alerts, state={state or '?'})"
        )

    def stall_and_cancel_check():
        nonlocal last_pct, last_req, last_alerts, last_change_ts, last_telemetry_log_ts
        nonlocal downgraded_already, active_scan_id, current_strength

        if cancel_fn and cancel_fn():
            return True  # let _poll_until's own cancel_fn handle the actual cancel

        pct, req, alerts, state = _active_scan_telemetry(zap, active_scan_id)

        now = time.time()
        if now - last_telemetry_log_ts >= _ACTIVE_SCAN_TELEMETRY_LOG_SECS:
            logger.info(
                "[DAST][ACTIVE] id=%s state=%s progress=%s requests=%s alerts=%s elapsed=%.0fs strength=%s",
                active_scan_id, state or "?", pct if pct is not None else "?",
                req if req is not None else "?", alerts if alerts is not None else "?",
                now - start_ts, current_strength,
            )
            last_telemetry_log_ts = now

        # Stalled requires progress AND requests AND alerts to ALL be
        # unchanged — any one of them moving is real work happening, even
        # if ZAP's own percentage sits at 0% the whole time (this is the
        # exact distinction scan #76 got wrong: request count was always
        # None due to the zap.ascan.scans property/method bug, so a
        # legitimately-slow-to-report-percentage scan looked stalled and
        # got restarted from scratch).
        changed = (
            (pct != last_pct)
            or (req is not None and req != last_req)
            or (alerts is not None and alerts != last_alerts)
        )
        if changed:
            last_pct, last_req, last_alerts = pct, req, alerts
            last_change_ts = now
            return False

        stalled_for = now - last_change_ts
        if (
            not downgraded_already
            and current_strength == "INSANE"
            and state == "RUNNING"
            and stalled_for >= _STALL_WINDOW_SECS
        ):
            logger.warning(
                "Active scan appears genuinely stalled (pct=%s, requests=%s, "
                "alerts=%s all unchanged for %.0fs, state=%s) — recovering "
                "by restarting at HIGH strength instead of INSANE. This "
                "fires at most once per scan.",
                pct, req, alerts, stalled_for, state,
            )
            try:
                zap.ascan.stop(active_scan_id)
            except Exception as exc:  # noqa: BLE001
                logger.debug("Failed to stop stalled active scan %s: %s", active_scan_id, exc)

            current_strength = "HIGH"
            _apply_attack_strength(zap, current_strength, alert_threshold)
            try:
                active_scan_id = _start()
                downgraded_already = True
                last_pct, last_req, last_alerts = None, None, None
                last_change_ts = time.time()
                logger.info("Active scan restarted at HIGH strength as id=%s", active_scan_id)
            except Exception as exc:  # noqa: BLE001 — if the restart itself
                # fails, fall through to the normal safety ceiling instead
                # of crashing the whole DAST scan over a recovery attempt.
                logger.warning("Failed to restart active scan after stall: %s", exc)
        return False

    # This wraps the generic poll loop with our own stall-check tick,
    # since _poll_until's cadence is throttled for logging but the stall
    # check needs its own state tracked every interval regardless.
    def cancel_fn_wrapper():
        stall_and_cancel_check()
        return bool(cancel_fn and cancel_fn())

    outcome = _poll_until(
        condition_fn,
        phase="active scan",
        interval_secs=3,
        progress_fn=progress_fn,
        pct_fn=pct_fn,
        on_progress=on_progress,
        cancel_fn=cancel_fn_wrapper,
    )

    if outcome != OUTCOME_COMPLETED:
        try:
            zap.ascan.stop(active_scan_id)
        except Exception as exc:  # noqa: BLE001 — best-effort cleanup;
            # any failure to stop is non-fatal, but shouldn't be silent.
            logger.debug("Failed to stop active scan %s: %s", active_scan_id, exc)

    if outcome == OUTCOME_CANCELLED:
        raise ZapScanCancelled("Cancelled during active scan phase")

    return outcome


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
    attack_strength: str | None = None,
    on_progress=None,
    cancel_fn=None,
) -> dict:
    """
    Returns a dict:
        {
            "alerts": list[dict],
            "outcome": "completed" | "timed_out",   # (cancelled raises instead)
            "ajax_spider_status": "completed" | "timed_out" | "failed_to_start" | None,
            "scanner_coverage": str | None,
        }
    Raises ZapScanCancelled if `cancel_fn` reports a cancellation request
    at any point — routes/dast.py is expected to catch this and mark the
    scan CANCELLED rather than FAILED.

    `attack_strength` is honored exactly as given — it is NEVER silently
    overridden by the scan_mode/profile. This used to be a profile-derived
    value (Full scan meant INSANE, always, with no way to pick anything
    else from the UI), which is what caused DAST scans to run for hours at
    the most aggressive setting with no explicit choice ever having been
    made. If omitted or invalid, it defaults to MEDIUM — never INSANE.
    """
    if not target_url or not target_url.strip():
        raise ZapScanError("target_url must not be empty.")

    profile = _load_profile(scan_mode)

    enable_active_scan = profile["enable_active_scan"]
    enable_ajax_spider = profile["enable_ajax_spider"]
    alert_threshold = profile.get("alert_threshold") or "MEDIUM"

    normalized_strength = (attack_strength or "").strip().upper()
    if normalized_strength not in _VALID_ATTACK_STRENGTHS:
        if attack_strength:
            logger.warning(
                "Ignoring invalid attack_strength '%s' — defaulting to %s.",
                attack_strength, _DEFAULT_ATTACK_STRENGTH,
            )
        attack_strength = _DEFAULT_ATTACK_STRENGTH
    else:
        attack_strength = normalized_strength

    if attack_strength == "INSANE":
        logger.warning(
            "DAST scan requested at INSANE attack strength — this can send "
            "tens of thousands of requests and run for hours. Proceeding "
            "because it was explicitly selected."
        )

    logger.info(
        "Starting %s DAST scan (attack_strength=%s)", profile["name"], attack_strength
    )

    ZAPv2 = _import_zap_client()
    config = get_zap_config()
    ensure_zap_reachable(config)

    logger.info("Connected to ZAP at %s:%s", config["host"], config["port"])

    zap = ZAPv2(
        apikey=config["api_key"] or None,
        proxies=config["proxies"],
    )

    # ZAP runs as a long-lived daemon (autostart only launches it once; it
    # keeps running across every scan you trigger afterwards). Without an
    # explicit new session here, every scan's spider/active-scan results and
    # the site tree accumulate forever in the SAME ZAP session — so scan #2
    # inherits everything ZAP already learned in scan #1. Starting a fresh,
    # named session per scan makes every run independent and reproducible.
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
        zap.urlopen(target_url)
        time.sleep(2)
    except Exception as exc:
        logger.exception("Unable to reach target '%s'", target_url)
        raise ZapScanError(
            f"Unable to reach target '{target_url}'. "
            f"Underlying error: {exc}"
        ) from exc

    scanner_coverage = None
    if enable_active_scan:
        scanner_coverage = _maximize_scan_thoroughness(zap, attack_strength, alert_threshold)
    else:
        try:
            zap.pscan.enable_all_scanners()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not enable passive scanners: %s", exc)

    ajax_spider_status = None
    overall_outcome = OUTCOME_COMPLETED

    try:
        with _prevent_windows_sleep():
            outcome = _run_spider(zap, target_url, on_progress=on_progress, cancel_fn=cancel_fn)
            if outcome == OUTCOME_TIMED_OUT:
                overall_outcome = OUTCOME_TIMED_OUT

            _wait_for_passive_scan(zap, on_progress=on_progress, cancel_fn=cancel_fn)

            if enable_ajax_spider:
                logger.info("AJAX Spider enabled for this profile")
                ajax_spider_status = _run_ajax_spider(
                    zap, target_url, on_progress=on_progress, cancel_fn=cancel_fn
                )
                if ajax_spider_status == "failed_to_start":
                    logger.warning(
                        "AJAX Spider failed to start — Full scan will "
                        "continue without it (graceful degradation, "
                        "recorded on the scan row)."
                    )
                elif ajax_spider_status == OUTCOME_TIMED_OUT:
                    overall_outcome = OUTCOME_TIMED_OUT
                _wait_for_passive_scan(zap, on_progress=on_progress, cancel_fn=cancel_fn)

            if enable_active_scan:
                logger.info("Active Scan enabled for this profile")
                outcome = _run_active_scan(
                    zap, target_url, attack_strength, alert_threshold,
                    on_progress=on_progress, cancel_fn=cancel_fn,
                )
                if outcome == OUTCOME_TIMED_OUT:
                    overall_outcome = OUTCOME_TIMED_OUT
                _wait_for_passive_scan(zap, on_progress=on_progress, cancel_fn=cancel_fn)
            else:
                logger.info(
                    "Skipping Active Scan because it is disabled for '%s' profile",
                    scan_mode,
                )
    except ZapScanCancelled:
        # Best-effort: stop anything ZAP might still have running before
        # propagating the cancellation up to routes/dast.py.
        for stopper in (zap.spider.stop, zap.ajaxSpider.stop, zap.ascan.stop):
            try:
                stopper()
            except Exception as exc:  # noqa: BLE001 — best-effort cleanup
                # on the way out; a failure to stop one phase shouldn't
                # stop us from trying the others or from propagating the
                # cancellation itself.
                logger.debug("Best-effort stop failed during cancellation cleanup: %s", exc)
        raise

    logger.info("Collecting alerts from ZAP")

    try:
        # No baseurl filter here. Every scan starts from a fresh, isolated
        # session, so there's nothing left in this session that isn't from
        # *this* scan — filtering by the literal input string only causes
        # harm when a target redirects (http->https, bare domain -> www).
        alerts = zap.core.alerts()
    except Exception as exc:
        logger.exception("Failed to retrieve alerts from ZAP")
        raise ZapScanError(f"Failed to retrieve alerts from ZAP: {exc}") from exc

    logger.info("Retrieved %d alerts", len(alerts))

    severity_summary = {"High": 0, "Medium": 0, "Low": 0, "Informational": 0, "Unknown": 0}
    for alert in alerts:
        risk = (alert.get("risk") or alert.get("riskdesc", "")).split(" ")[0]
        severity_summary[risk if risk in severity_summary else "Unknown"] += 1

    logger.info("---------- Scan Summary ----------")
    logger.info("Target           : %s", target_url)
    logger.info("Profile          : %s", profile["name"])
    logger.info("Outcome          : %s", overall_outcome)
    logger.info("AJAX Spider      : %s", ajax_spider_status or ("Enabled" if enable_ajax_spider else "Skipped"))
    logger.info("Scanner coverage : %s", scanner_coverage or "n/a")
    logger.info("Total Alerts     : %d", len(alerts))
    for level in ("High", "Medium", "Low", "Informational", "Unknown"):
        logger.info("%-16s : %d", level, severity_summary[level])
    logger.info("----------------------------------")

    return {
        "alerts": alerts,
        "outcome": overall_outcome,
        "ajax_spider_status": ajax_spider_status,
        "scanner_coverage": scanner_coverage,
    }

# Every phase now runs until ZAP itself reports it complete — see
# zap_runner.py's _poll_until(), which has no external deadline anymore
# (only a generous multi-hour safety ceiling shared across all profiles).
# That used to be the bug: a fixed "max_*_duration_mins" here got enforced
# as a hard cutoff, so any real site that took longer than that got its
# scan cut off mid-way and returned as "complete" with partial results.
#
# NOTE (attack-strength decoupling): profiles here control SCOPE ONLY —
# which phases run (AJAX spider, active scan). They used to also bake in
# an `attack_strength` (Full silently meant INSANE, with no UI control and
# no way to pick anything else), which caused scans launched from the
# frontend to always run at INSANE and take hours while looking "stuck" at
# ~24% the whole time. Attack strength is now an explicit, independent
# field on the request itself (see models/dast_request.py,
# DastScanRequest.attack_strength) that the frontend surfaces as its own
# selector — it is NEVER derived from scan_mode/profile, and defaults to
# MEDIUM, never INSANE, if the caller omits it. `alert_threshold` (how
# sensitive ZAP is when deciding something IS an alert) is unrelated to
# attack strength and stays profile-driven below.
#
# alert_threshold accepts ZAP's own values: OFF | LOW | MEDIUM | HIGH
SCAN_PROFILES: dict[str, dict] = {
    "quick": {
        "name": "Quick Scan",
        "description": (
            "Fast reconnaissance scan. Runs the traditional spider and "
            "passive analysis only — no active scanning."
        ),
        "enable_active_scan": False,
        "enable_ajax_spider": False,
        "alert_threshold": None,
    },

    "standard": {
        "name": "Standard Scan",
        "description": (
            "Recommended profile for most applications. Performs spider, "
            "passive analysis and active scanning at the caller-selected "
            "attack strength (defaults to MEDIUM)."
        ),
        "enable_active_scan": True,
        "enable_ajax_spider": False,
        "alert_threshold": "MEDIUM",
    },

    "full": {
        "name": "Full Scan",
        "description": (
            "Maximum coverage profile. Performs traditional spider, AJAX "
            "spider, passive analysis and active scanning at the "
            "caller-selected attack strength (defaults to MEDIUM) with the "
            "LOW (most sensitive) alert threshold."
        ),
        "enable_active_scan": True,
        "enable_ajax_spider": True,
        "alert_threshold": "LOW",
    },
}

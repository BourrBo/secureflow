# Every phase now runs until ZAP itself reports it complete — see
# zap_runner.py's _poll_until(), which has no external deadline anymore
# (only a generous multi-hour safety ceiling shared across all profiles).
# That used to be the bug: a fixed "max_*_duration_mins" here got enforced
# as a hard cutoff, so any real site that took longer than that got its
# scan cut off mid-way and returned as "complete" with partial results.
#
# What still varies by profile is *scope*, not duration: whether the AJAX
# spider and active scanner run at all.
SCAN_PROFILES: dict[str, dict] = {
    "quick": {
        "name": "Quick Scan",
        "description": (
            "Fast reconnaissance scan. Runs the traditional spider and "
            "passive analysis only — no active scanning."
        ),
        "enable_active_scan": False,
        "enable_ajax_spider": False,
    },

    "standard": {
        "name": "Standard Scan",
        "description": (
            "Recommended profile for most applications. Performs spider, "
            "passive analysis and active scanning."
        ),
        "enable_active_scan": True,
        "enable_ajax_spider": False,
    },

    "full": {
        "name": "Full Scan",
        "description": (
            "Maximum coverage profile. Performs traditional spider, "
            "AJAX spider, passive analysis and active scanning."
        ),
        "enable_active_scan": True,
        "enable_ajax_spider": True,
    },
}
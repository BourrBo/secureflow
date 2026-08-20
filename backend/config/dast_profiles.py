# Every phase now runs until ZAP itself reports it complete — see
# zap_runner.py's _poll_until(), which has no external deadline anymore
# (only a generous multi-hour safety ceiling shared across all profiles).
# That used to be the bug: a fixed "max_*_duration_mins" here got enforced
# as a hard cutoff, so any real site that took longer than that got its
# scan cut off mid-way and returned as "complete" with partial results.
#
# What varies by profile is scope (AJAX spider, active scan) AND, as of
# this revision, aggressiveness (attack_strength / alert_threshold).
# Previously every profile that ran an active scan got the exact same
# INSANE + LOW settings applied in _maximize_scan_thoroughness() — the
# profile only controlled whether the active scanner ran at all, not how
# aggressively. That made "Standard" and "Full" behave almost identically
# in practice (same payload volume, same noise, same runtime) except for
# AJAX crawling, which defeats the point of having three profiles.
#
# attack_strength / alert_threshold accept ZAP's own values:
#   attack_strength : LOW | MEDIUM | HIGH | INSANE
#   alert_threshold : OFF | LOW | MEDIUM | HIGH
SCAN_PROFILES: dict[str, dict] = {
    "quick": {
        "name": "Quick Scan",
        "description": (
            "Fast reconnaissance scan. Runs the traditional spider and "
            "passive analysis only — no active scanning."
        ),
        "enable_active_scan": False,
        "enable_ajax_spider": False,
        "attack_strength": None,
        "alert_threshold": None,
    },

    "standard": {
        "name": "Standard Scan",
        "description": (
            "Recommended profile for most applications. Performs spider, "
            "passive analysis and active scanning at HIGH strength — "
            "thorough without the runtime/noise cost of INSANE."
        ),
        "enable_active_scan": True,
        "enable_ajax_spider": False,
        "attack_strength": "HIGH",
        "alert_threshold": "MEDIUM",
    },

    "full": {
        "name": "Full Scan",
        "description": (
            "Maximum coverage profile. Performs traditional spider, "
            "AJAX spider, passive analysis and active scanning at INSANE "
            "strength with the LOW (most sensitive) alert threshold."
        ),
        "enable_active_scan": True,
        "enable_ajax_spider": True,
        "attack_strength": "INSANE",
        "alert_threshold": "LOW",
    },
}

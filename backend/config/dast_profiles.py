SCAN_PROFILES: dict[str, dict] = {
    "quick": {
        "name": "Quick Scan",
        "description": "Fast reconnaissance scan. Runs the traditional spider and passive analysis only — no active scanning.",
        "enable_active_scan": False,
        "enable_ajax_spider": False,
        "alert_threshold": None,
    },
    "standard": {
        "name": "Standard Scan",
        "description": "Recommended profile for most applications. Performs spider, passive analysis and active scanning at the caller-selected attack strength.",
        "enable_active_scan": True,
        "enable_ajax_spider": False,
        "alert_threshold": "MEDIUM",
    },
    "full": {
        "name": "Full Scan",
        "description": "Maximum coverage profile with traditional spider, AJAX spider, passive analysis and active scanning at the caller-selected attack strength.",
        "enable_active_scan": True,
        "enable_ajax_spider": True,
        "alert_threshold": "LOW",
    },
}

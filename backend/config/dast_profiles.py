from typing import Dict
SCAN_PROFILES: Dict[str, dict] = {
    "quick": {
        "name": "Quick Scan",
        "description": (
            "Fast reconnaissance scan. Runs the traditional spider and "
            "passive analysis only."
        ),
        "max_spider_duration_mins": 2,
        "max_scan_duration_mins": 0,
        "enable_active_scan": False,
        "enable_ajax_spider": False,
    },

    "standard": {
        "name": "Standard Scan",
        "description": (
            "Recommended profile for most applications. Performs spider, "
            "passive analysis and active scanning."
        ),
        "max_spider_duration_mins": 5,
        "max_scan_duration_mins": 15,
        "enable_active_scan": True,
        "enable_ajax_spider": False,
    },

    "full": {
        "name": "Full Scan",
        "description": (
            "Maximum coverage profile. Performs traditional spider, "
            "AJAX spider, passive analysis and active scanning."
        ),
        "max_spider_duration_mins": 15,
        "max_scan_duration_mins": 45,
        "enable_active_scan": True,
        "enable_ajax_spider": True,
    },
}
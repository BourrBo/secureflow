"""
Verifies the attack-strength fix end to end at the Python layer:

1. DastScanRequest defaults attack_strength to MEDIUM (never INSANE) when
   the caller omits it, and rejects values outside LOW/MEDIUM/HIGH/INSANE.
2. run_zap_scan() honors whatever attack_strength it's given exactly, and
   independently defaults to MEDIUM (never INSANE) if given None/invalid —
   using a fake ZAP client so no real ZAP instance or network is needed.
"""
import os
import sys
import types

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from pydantic import ValidationError

from models.dast_request import DastScanRequest


def test_default_attack_strength_is_medium():
    req = DastScanRequest(target_url="http://localhost:3000")
    assert req.attack_strength == "MEDIUM"
    assert req.scan_mode == "standard"


def test_explicit_attack_strength_roundtrips():
    for value in ("LOW", "MEDIUM", "HIGH", "INSANE"):
        req = DastScanRequest(target_url="http://x", attack_strength=value)
        assert req.attack_strength == value


def test_invalid_attack_strength_rejected():
    with pytest.raises(ValidationError):
        DastScanRequest(target_url="http://x", attack_strength="ULTRA")


# ---------------------------------------------------------------------------
# run_zap_scan() — fake ZAP client, no real network/ZAP instance required.
# ---------------------------------------------------------------------------

class _FakeAscan:
    def __init__(self):
        self.applied_strengths = []
        self.applied_thresholds = []

    def scanners(self):
        return [{"id": "1"}, {"id": "2"}]

    def enable_all_scanners(self):
        return "OK"

    def set_scanner_attack_strength(self, scanner_id, strength):
        self.applied_strengths.append(strength)

    def set_scanner_alert_threshold(self, scanner_id, threshold):
        self.applied_thresholds.append(threshold)

    def set_option_max_scan_duration_in_mins(self, v):
        pass

    def set_option_max_rule_duration_in_mins(self, v):
        pass

    def scan(self, target_url):
        return "0"

    @property
    def scans(self):
        return [{"id": "0", "state": "RUNNING", "progress": "100", "reqCount": "42", "alertCount": "1"}]

    def status(self, scan_id):
        return "100"

    def stop(self, *a, **k):
        pass


class _FakePscan:
    def enable_all_scanners(self):
        return "OK"

    @property
    def records_to_scan(self):
        return 0


class _FakeSpider:
    def scan(self, target_url):
        return "0"

    def status(self, scan_id):
        return "100"

    def stop(self, *a, **k):
        pass

    def set_option_max_duration(self, v):
        pass

    def set_option_max_depth(self, v):
        pass

    def set_option_max_children(self, v):
        pass

    def set_option_parse_robots_txt(self, v):
        pass


class _FakeCore:
    def new_session(self, name=None, overwrite=None):
        pass

    def alerts(self):
        return []


class _FakeZap:
    def __init__(self, apikey=None, proxies=None):
        self.ascan = _FakeAscan()
        self.pscan = _FakePscan()
        self.spider = _FakeSpider()
        self.core = _FakeCore()
        self.ajaxSpider = types.SimpleNamespace(stop=lambda *a, **k: None)

    def urlopen(self, url):
        return "OK"


@pytest.fixture(autouse=True)
def _patch_zap(monkeypatch):
    import scanners.zap_runner as zr

    monkeypatch.setattr(zr, "_import_zap_client", lambda: _FakeZap)
    monkeypatch.setattr(zr, "ensure_zap_reachable", lambda config: None)
    monkeypatch.setattr(
        zr, "get_zap_config", lambda: {"host": "127.0.0.1", "port": "8080", "api_key": None, "proxies": {}}
    )
    monkeypatch.setattr(zr.time, "sleep", lambda s: None)
    yield


def _run(scan_mode="standard", attack_strength=None):
    import scanners.zap_runner as zr
    captured = {}

    orig_apply = zr._apply_attack_strength

    def spy_apply(zap, strength, threshold):
        captured["strength"] = strength
        captured["threshold"] = threshold
        return orig_apply(zap, strength, threshold)

    import unittest.mock as mock
    with mock.patch.object(zr, "_apply_attack_strength", side_effect=spy_apply):
        result = zr.run_zap_scan(
            target_url="http://localhost:3000",
            scan_mode=scan_mode,
            attack_strength=attack_strength,
        )
    return result, captured


def test_low_strength_honored():
    result, captured = _run(scan_mode="standard", attack_strength="LOW")
    assert captured["strength"] == "LOW"
    assert result["outcome"] == "completed"


def test_medium_strength_honored():
    result, captured = _run(scan_mode="standard", attack_strength="MEDIUM")
    assert captured["strength"] == "MEDIUM"
    assert result["outcome"] == "completed"


def test_omitted_strength_defaults_to_medium_never_insane():
    result, captured = _run(scan_mode="full", attack_strength=None)
    assert captured["strength"] == "MEDIUM"
    assert captured["strength"] != "INSANE"


def test_invalid_strength_falls_back_to_medium():
    result, captured = _run(scan_mode="full", attack_strength="ULTRA")
    assert captured["strength"] == "MEDIUM"


def test_insane_still_available_when_explicitly_chosen():
    result, captured = _run(scan_mode="full", attack_strength="INSANE")
    assert captured["strength"] == "INSANE"


def test_high_strength_honored_on_standard_profile():
    result, captured = _run(scan_mode="standard", attack_strength="HIGH")
    assert captured["strength"] == "HIGH"


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))

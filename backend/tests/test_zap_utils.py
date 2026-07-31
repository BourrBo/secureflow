"""
Unit tests for utils/zap_utils.is_zap_reachable — uses a fake client object
instead of a live ZAP instance, so this runs in CI with nothing installed.
"""

from utils.zap_utils import is_zap_reachable


class _FakeCore:
    def __init__(self, version=None, raises=None):
        self._version = version
        self._raises = raises

    @property
    def version(self):
        if self._raises:
            raise self._raises
        return self._version


class _FakeZapClient:
    def __init__(self, version=None, raises=None):
        self.core = _FakeCore(version=version, raises=raises)


def test_reachable_client_returns_none():
    client = _FakeZapClient(version="2.17.0")
    assert is_zap_reachable(client) is None


def test_unreachable_client_returns_error_message():
    client = _FakeZapClient(raises=ConnectionRefusedError("connection refused"))
    result = is_zap_reachable(client)
    assert result is not None
    assert "connection refused" in result


def test_unexpected_error_type_is_still_reported_not_raised():
    # is_zap_reachable's whole job is to never let a caller-side crash
    # happen — any failure mode should come back as a string, not propagate.
    client = _FakeZapClient(raises=RuntimeError("something ZAP-specific broke"))
    result = is_zap_reachable(client)
    assert isinstance(result, str)
    assert "something ZAP-specific broke" in result

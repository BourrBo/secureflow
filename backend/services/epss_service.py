import logging
import threading

try:
    from epss_api import EPSS
except ImportError:
    EPSS = None


import requests

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------

_http_endpoint = "https://api.first.org/data/v1/epss"

# Shared EPSS client — lazily constructed, not built at import time.
#
# EPSS()'s constructor (from the epss_api package) synchronously downloads
# the *entire* EPSS dataset (a gzipped CSV of every scored CVE) from
# epss.cyentia.com, with no timeout. That used to run unconditionally at
# module import time (`_client = EPSS() if EPSS is not None else None`),
# which meant: every backend startup blocked on a multi-second-or-worse
# bulk download before the app could serve even /health, AND any network
# hiccup at that exact moment (DNS not ready yet during a container cold
# start, a firewall, the host being briefly down) crashed the entire
# backend at import time — not just disabled EPSS scoring, which is what
# the rest of this file's design clearly intends (get_epss_scores() already
# treats the library and the HTTP fallback as best-effort, catching
# exceptions and falling through). This eager, unguarded construction was
# the one place that didn't follow that pattern.
#
# Fix: defer construction to first actual use, inside a try/except, so an
# import-time failure can never happen — worst case, EPSS scoring falls
# back to the per-request HTTP API path that already exists below.
_client = None
_client_init_attempted = False
_client_lock = threading.Lock()


def _get_client():
    global _client, _client_init_attempted
    if _client_init_attempted:
        return _client
    with _client_lock:
        if _client_init_attempted:  # re-check inside the lock
            return _client
        _client_init_attempted = True
        if EPSS is None:
            return None
        try:
            _client = EPSS()
        except Exception as exc:  # noqa: BLE001 — same reasoning as the
            # runtime fallback below: any failure here (network, DNS,
            # timeout — urlopen has none — a malformed response) must
            # degrade to the HTTP API path, never take the process down.
            logger.warning(
                "EPSS library failed to initialize (%s) — falling back to "
                "the per-request HTTP API for EPSS scoring.", exc,
            )
            _client = None
        return _client


# Simple in-memory cache
_cache: dict[str, dict] = {}


def get_epss_scores(cve_ids: list[str]) -> dict[str, dict]:
    """
    Fetch EPSS scores for multiple CVEs.

    Returns:
    {
        "CVE-2024-12345": {
            "score": "0.98721",
            "percentile": "0.99901",
            "risk_level": "CRITICAL"
        }
    }

    Features:
    - Batch API requests
    - Memory cache
    - Skips duplicates
    - No API key required
    """

    result: dict[str, dict] = {}

    # ------------------------------------------------------------
    # Clean input
    # ------------------------------------------------------------

    unique_cves = []

    for cve in set(cve_ids):

        if not cve:
            continue

        if cve == "N/A":
            continue

        if cve in _cache:
            result[cve] = _cache[cve]
        else:
            unique_cves.append(cve)

    if not unique_cves:
        return result

    # ------------------------------------------------------------
    # Method 1: Python EPSS library
    # ------------------------------------------------------------

    if (client := _get_client()) is not None:

        try:

            for cve in unique_cves:

                data = client.score(cve)

                if data is None:
                    continue

                # epss_api's Score.score() returns a Score OBJECT
                # (attributes: .cve, .epss, .percentile) — not a dict. The
                # old code called data.get("epss", 0), which is dict syntax
                # and raised AttributeError on every CVE actually found in
                # the dataset (a miss correctly returns None and skips via
                # the check above; a hit is where this broke). That
                # exception was swallowed by the except block below and
                # silently discarded whatever had already been collected
                # this call, which is the real reason EPSS scores were
                # coming back empty — not a network or container issue.
                score = float(data.epss)

                info = {
                    "score": str(data.epss),
                    "percentile": str(data.percentile),
                    "risk_level": _risk_level(score),
                }

                result[cve] = info
                _cache[cve] = info

            return result

        except Exception as exc:  # noqa: BLE001 — epss_api has no documented
            # exception hierarchy; any failure here should fall back to the
            # HTTP API rather than break the caller. Was logger.debug before —
            # invisible under this app's INFO-level logging.basicConfig, which
            # is exactly why a full report of EPSS: N/A produced zero visible
            # error: the failure was real, just silent. warning ensures the
            # next occurrence actually shows up in the logs.
            logger.warning("EPSS library lookup failed, falling back to HTTP API: %s", exc)

    # ------------------------------------------------------------
    # Method 2: FIRST.org Batch HTTP API
    # ------------------------------------------------------------

    try:

        joined = ",".join(unique_cves)

        response = requests.get(
            _http_endpoint,
            params={
                "cve": joined,
                # FIRST.org's API defaults to 100 results per page with no
                # error if the batch is larger — a scan with more unique
                # CVEs than that (this codebase has seen scans with 300+)
                # would silently get back only the first 100, no different
                # in effect from Method 1's silent-failure bug above.
                "limit": max(len(unique_cves), 100),
            },
            timeout=20,
        )

        response.raise_for_status()

        payload = response.json()

        for item in payload.get("data", []):

            cve = item.get("cve")

            if not cve:
                continue

            try:
                score = float(item.get("epss", 0))
            except (TypeError, ValueError):
                score = 0.0

            info = {
                "score": str(item.get("epss", "N/A")),
                "percentile": str(item.get("percentile", "N/A")),
                "risk_level": _risk_level(score),
            }

            result[cve] = info
            _cache[cve] = info

    except (requests.RequestException, ValueError) as exc:
        # requests.RequestException: network/HTTP failure.
        # ValueError: response.json() failed to parse.
        # EPSS is a best-effort enrichment — don't fail the scan over it,
        # but this is the last fallback: if this also fails, EPSS scoring
        # is completely dead for this request, which is worth knowing about
        # (was logger.debug before — invisible under INFO-level logging).
        logger.warning("EPSS HTTP API unavailable: %s", exc)

    return result


def _risk_level(score: float) -> str:
    """
    Convert EPSS score into a readable risk level.
    """

    if score >= 0.70:
        return "CRITICAL"

    elif score >= 0.40:
        return "HIGH"

    elif score >= 0.10:
        return "MEDIUM"

    return "LOW"
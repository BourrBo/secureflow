try:
    from epss_api import EPSS
except Exception:
    EPSS = None

import requests
from typing import Dict, List

# --------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------

_http_endpoint = "https://api.first.org/data/v1/epss"

# Shared EPSS client
_client = EPSS() if EPSS is not None else None

# Simple in-memory cache
_cache: Dict[str, dict] = {}


def get_epss_scores(cve_ids: List[str]) -> Dict[str, dict]:
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

    result: Dict[str, dict] = {}

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

    if _client is not None:

        try:

            for cve in unique_cves:

                data = _client.score(cve)

                if not data:
                    continue

                score = float(data.get("epss", 0))

                info = {
                    "score": str(data.get("epss", "N/A")),
                    "percentile": str(data.get("percentile", "N/A")),
                    "risk_level": _risk_level(score),
                }

                result[cve] = info
                _cache[cve] = info

            return result

        except Exception:
            # Fallback to HTTP API
            pass

    # ------------------------------------------------------------
    # Method 2: FIRST.org Batch HTTP API
    # ------------------------------------------------------------

    try:

        joined = ",".join(unique_cves)

        response = requests.get(
            _http_endpoint,
            params={"cve": joined},
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
            except Exception:
                score = 0.0

            info = {
                "score": str(item.get("epss", "N/A")),
                "percentile": str(item.get("percentile", "N/A")),
                "risk_level": _risk_level(score),
            }

            result[cve] = info
            _cache[cve] = info

    except Exception:
        # EPSS unavailable
        pass

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
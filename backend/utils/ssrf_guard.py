"""
Target validation for the DAST endpoint (Priority 9 of the DAST hardening
pass — see backend handover notes).

SecureFlow is a security product whose DAST feature takes a user-supplied
URL and makes real HTTP requests to it. Without any validation, that is a
textbook SSRF primitive: a caller could point target_url at
http://127.0.0.1:<internal-port>, http://169.254.169.254/latest/meta-data
(cloud metadata endpoints), an internal hostname, or an RFC1918 address,
and use SecureFlow's own backend as the request origin.

This module is deliberately conservative: it blocks loopback, link-local
(including the AWS/GCP/Azure metadata address), and private RFC1918
ranges by default, and resolves hostnames before deciding — a DNS name
that *resolves* to a private address is blocked too ("DNS rebinding"),
not just literal IPs. It does NOT try to be a general allowlist; it's a
denylist of "this is almost never a legitimate external app target".

If SecureFlow is later deployed where scanning internal/staging targets
on a private network is an intentional, authorized use case, set
ALLOW_PRIVATE_DAST_TARGETS=true in the environment to skip this check
entirely for that deployment — the check stays fail-closed by default.
"""

from __future__ import annotations

import ipaddress
import logging
import os
import socket
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

_ALLOWED_SCHEMES = {"http", "https"}


class SSRFValidationError(ValueError):
    """Raised when a DAST target URL fails safety validation."""


def _env_allows_private_targets() -> bool:
    return os.getenv("ALLOW_PRIVATE_DAST_TARGETS", "false").strip().lower() in (
        "1", "true", "yes",
    )


def _is_blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return (
        ip.is_loopback
        or ip.is_link_local        # covers 169.254.169.254 cloud metadata
        or ip.is_private           # RFC1918 (10/8, 172.16/12, 192.168/16) + ULA
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def validate_dast_target(target_url: str) -> str:
    """
    Raises SSRFValidationError if target_url is not a safe external DAST
    target. Returns the normalized target_url unchanged on success so this
    can be used inline: target_url = validate_dast_target(target_url).
    """
    if not target_url or not target_url.strip():
        raise SSRFValidationError("target_url must not be empty.")

    target_url = target_url.strip()
    parsed = urlparse(target_url)

    if parsed.scheme.lower() not in _ALLOWED_SCHEMES:
        raise SSRFValidationError(
            f"Unsupported scheme '{parsed.scheme}'. Only http/https targets "
            "are allowed."
        )

    hostname = parsed.hostname
    if not hostname:
        raise SSRFValidationError("target_url has no resolvable host.")

    if _env_allows_private_targets():
        logger.warning(
            "ALLOW_PRIVATE_DAST_TARGETS is set — skipping SSRF target "
            "validation for '%s'. Only use this on deployments where "
            "scanning internal targets is an intentional, authorized use.",
            hostname,
        )
        return target_url

    lowered = hostname.lower()
    if lowered in ("localhost", "localhost.localdomain") or lowered.endswith(".local"):
        raise SSRFValidationError(
            f"Target host '{hostname}' resolves to a local/internal address "
            "and is not allowed as a DAST target."
        )

    # Literal IP in the URL — check directly, no DNS involved. Note:
    # SSRFValidationError is itself a ValueError subclass, so it must be
    # raised OUTSIDE the try/except below — otherwise `except ValueError`
    # would silently swallow it and this would fall through to the
    # hostname-resolution branch instead of failing closed here.
    literal_ip = None
    try:
        literal_ip = ipaddress.ip_address(hostname)
    except ValueError:
        pass  # not a literal IP — it's a hostname, resolve it below.

    if literal_ip is not None:
        if _is_blocked_ip(literal_ip):
            raise SSRFValidationError(
                f"Target IP '{hostname}' is a loopback/link-local/private/"
                "reserved address and is not allowed as a DAST target."
            )
        return target_url

    # Hostname: resolve and check every address it maps to. This is the
    # DNS-rebinding case — "scan-me.example.com" that currently resolves
    # to 1.2.3.4 but could be repointed at 127.0.0.1 by whoever controls
    # that DNS record before/during the scan.
    try:
        addr_infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        raise SSRFValidationError(
            f"Could not resolve target host '{hostname}': {exc}"
        ) from exc

    resolved_ips = {info[4][0] for info in addr_infos}
    if not resolved_ips:
        raise SSRFValidationError(f"Target host '{hostname}' did not resolve to any address.")

    for ip_str in resolved_ips:
        ip_str = ip_str.split("%")[0]  # strip IPv6 zone id if present
        try:
            ip_obj = ipaddress.ip_address(ip_str)
        except ValueError:
            continue
        if _is_blocked_ip(ip_obj):
            raise SSRFValidationError(
                f"Target host '{hostname}' resolves to '{ip_str}', which is "
                "a loopback/link-local/private/reserved address and is not "
                "allowed as a DAST target."
            )

    return target_url

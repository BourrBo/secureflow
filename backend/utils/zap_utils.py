"""
utils/zap_utils.py

Shared helpers for talking to a local OWASP ZAP 2.17.0 instance on Windows.
This module owns exactly two concerns:

  1. Where ZAP lives and how to reach its API (host/port/api key), all
     overridable via environment variables so nothing is hardcoded to one
     developer's machine.
  2. Confirming ZAP is actually reachable before scanners/zap_runner.py
     tries to talk to it.

Nothing here is DAST-specific business logic (that's zap_runner.py) — this
is purely "how do I get a live ZAP API connection", mirroring the way
git_service.py / upload_service.py only handle "how do I get source code
onto disk" for the other scanners.

Default mode of operation: CONNECT-ONLY. Most people run ZAP Desktop as a
GUI app they open themselves (with the API enabled and, usually, the API
key disabled for local dev) — that's exactly what this defaults to
expecting. Auto-launching a second, hidden daemon copy of ZAP is opt-in
only (ZAP_AUTOSTART=true), because on Windows a second process fighting an
already-open GUI session for the same port is a common source of exactly
the kind of silent failure this was originally causing.
"""

import logging
import os
import shutil
import subprocess
import time
from typing import Optional

logger = logging.getLogger(__name__)

# ZAP's own actual default proxy/API port is 8080 — NOT 8090. (An earlier
# version of this file used 8090 as a "safe-sounding" default and that was
# simply wrong; it's what caused ensure_zap_reachable() to conclude ZAP
# wasn't running when it actually was, already open on 8080.)
DEFAULT_ZAP_HOST = "127.0.0.1"
DEFAULT_ZAP_PORT = "8080"

# Common install locations for ZAP Desktop 2.17.0 on Windows. ZAP_PATH env
# var always wins if set; this list is just a convenience fallback, and is
# only ever used when ZAP_AUTOSTART=true.
_COMMON_WINDOWS_ZAP_PATHS = [
    r"C:\Program Files\ZAP\Zed Attack Proxy\zap.bat",
    r"C:\Program Files (x86)\ZAP\Zed Attack Proxy\zap.bat",
    os.path.expanduser(r"~\AppData\Local\Programs\ZAP\Zed Attack Proxy\zap.bat"),
]


def get_zap_config() -> dict:
    """
    Resolve ZAP connection settings from environment variables, with sane
    local-dev defaults. Set these in your shell (PowerShell example) if your
    setup differs from the defaults:

        $env:ZAP_HOST = "127.0.0.1"
        $env:ZAP_PORT = "8080"
        $env:ZAP_API_KEY = ""                 # blank if you disabled the API key in ZAP
        $env:ZAP_AUTOSTART = "false"           # "true" to let this code launch ZAP itself
        $env:ZAP_PATH = "C:\\Program Files\\ZAP\\Zed Attack Proxy\\zap.bat"   # only used if ZAP_AUTOSTART=true
    """
    host = os.environ.get("ZAP_HOST", DEFAULT_ZAP_HOST)
    port = os.environ.get("ZAP_PORT", DEFAULT_ZAP_PORT)
    api_key = os.environ.get("ZAP_API_KEY", "")
    autostart = os.environ.get("ZAP_AUTOSTART", "false").strip().lower() == "true"
    zap_path = os.environ.get("ZAP_PATH") or _find_zap_executable()

    return {
        "host": host,
        "port": port,
        "api_key": api_key,
        "autostart": autostart,
        "zap_path": zap_path,
        "proxies": {
            "http": f"http://{host}:{port}",
            "https": f"http://{host}:{port}",
        },
    }


def _find_zap_executable() -> Optional[str]:
    """Best-effort discovery of zap.bat. Returns None if not found — callers
    must handle that (it just means auto-start, if enabled, has nothing to
    launch; connect-only mode doesn't need this at all)."""
    on_path = shutil.which("zap.bat") or shutil.which("zap.sh")
    if on_path:
        return on_path

    for candidate in _COMMON_WINDOWS_ZAP_PATHS:
        if os.path.isfile(candidate):
            return candidate

    return None


def is_zap_reachable(zap_client) -> Optional[str]:
    """Checks whether we can get ZAP's version over the API right now.
    Returns None if reachable, or the underlying exception message as a
    string if not — callers get an actual reason to log/surface instead of
    a bare True/False, which is what made the original failure hard to
    diagnose."""
    try:
        zap_client.core.version
        return None
    except Exception as exc:
        return str(exc)


def ensure_zap_reachable(config: dict, timeout_secs: int = 90) -> None:
    """
    Confirms a ZAP instance is reachable at config['host']:config['port'].

    Default behavior (ZAP_AUTOSTART not set, or "false"): connect-only.
    If ZAP isn't reachable, raises RuntimeError immediately with the host/
    port we tried and the actual connection error — it does NOT try to
    launch anything, since you're expected to already have ZAP Desktop
    open yourself.

    Opt-in behavior (ZAP_AUTOSTART=true): if ZAP isn't reachable and a
    zap.bat/zap.sh can be found, launches it in daemon mode and polls until
    the API responds or timeout_secs elapses.
    """
    from zapv2 import ZAPv2  # local import — keeps this module importable
                              # even before the zapv2 package is installed,
                              # so config-only usage never fails at import time

    probe = ZAPv2(apikey=config["api_key"] or None, proxies=config["proxies"])
    error = is_zap_reachable(probe)
    if error is None:
        logger.info("ZAP reachable at %s:%s", config["host"], config["port"])
        return

    if not config["autostart"]:
        raise RuntimeError(
            f"Could not reach ZAP at {config['host']}:{config['port']} "
            f"(underlying error: {error}). Make sure ZAP Desktop is open, "
            "its API is enabled (Tools > Options > API), and the host/port "
            "match — set ZAP_HOST/ZAP_PORT if your ZAP is running somewhere "
            "other than 127.0.0.1:8080. If you'd rather this code launch "
            "ZAP for you instead, set ZAP_AUTOSTART=true and ZAP_PATH."
        )

    logger.warning(
        "ZAP not reachable at %s:%s (%s) — ZAP_AUTOSTART is enabled, attempting to launch it",
        config["host"], config["port"], error,
    )

    zap_path = config["zap_path"]
    if not zap_path:
        raise RuntimeError(
            "ZAP_AUTOSTART is true but no zap.bat/zap.sh could be found. "
            "Set the ZAP_PATH environment variable, e.g.:\n"
            r'  $env:ZAP_PATH = "C:\Program Files\ZAP\Zed Attack Proxy\zap.bat"'
        )

    command = [
        zap_path,
        "-daemon",
        "-host", config["host"],
        "-port", config["port"],
        "-config", "api.disablekey=" + ("true" if not config["api_key"] else "false"),
    ]
    if config["api_key"]:
        command += ["-config", f"api.key={config['api_key']}"]

    logger.info("Launching ZAP daemon from '%s' on %s:%s", zap_path, config["host"], config["port"])

    try:
        # ZAP prints a lot of startup noise to stdout/stderr; we don't need
        # it in the backend's own logs, so redirect to DEVNULL. It keeps
        # running in the background — we don't own its lifecycle beyond
        # starting it.
        subprocess.Popen(
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
        )
    except OSError as exc:
        raise RuntimeError(f"Failed to launch ZAP from '{zap_path}': {exc}")

    deadline = time.time() + timeout_secs
    while time.time() < deadline:
        if is_zap_reachable(probe) is None:
            logger.info("ZAP daemon is up and reachable at %s:%s", config["host"], config["port"])
            return
        time.sleep(2)

    logger.error("ZAP did not become reachable within %ss", timeout_secs)
    raise RuntimeError(
        f"ZAP did not become reachable at {config['host']}:{config['port']} "
        f"within {timeout_secs}s of launching '{zap_path}'. Check that the "
        "port isn't already in use by something else, or start ZAP manually "
        "and re-run the scan."
    )


# Backwards-compatible alias — earlier version of this module named the
# function start_zap_daemon(). Kept so nothing importing the old name breaks.
start_zap_daemon = ensure_zap_reachable

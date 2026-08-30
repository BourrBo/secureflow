import logging
import os
import shutil
import stat
import subprocess
import tempfile
import time

logger = logging.getLogger(__name__)

# Anchor temp clones to a folder inside the backend itself, on the same drive
# the backend is running from. Windows' default system temp folder (usually C:)
# can differ from the drive the project lives on (e.g. D:), and several tools
# (Checkov's progress bar, among others) call os.path.relpath() internally,
# which fails with "path is on mount 'C:', start on mount 'D:'" when the two
# differ. Keeping everything on one drive avoids that entire class of bug.
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_TMP_ROOT = os.path.join(_BASE_DIR, "..", "tmp_scans")
os.makedirs(_TMP_ROOT, exist_ok=True)

# A stuck `git clone` (huge repo, network stall, or — for a private repo
# someone pointed us at without credentials — git silently hanging on an
# interactive auth prompt that will never be answered) used to block the
# request forever. Bounded the same way the scanner subprocesses are.
_CLONE_TIMEOUT_SECS = 300

# cleanup_repo's shutil.rmtree used to pass ignore_errors=True with no
# logging at all, so a failed cleanup (most commonly a Windows file lock —
# antivirus or the search indexer briefly holding a handle open right after
# a large clone) was completely invisible: tmp_scans/ would just quietly
# accumulate orphaned directories over time. This keeps the same
# best-effort, never-raise behavior (a cleanup failure should never fail
# the scan that triggered it) but now retries once after a short delay —
# long enough for a transient lock to clear — and logs a warning if it
# still can't be removed, so the growth is at least visible in the logs
# instead of silent.
_CLEANUP_RETRY_DELAY_SECS = 2


def build_authenticated_url(clone_url: str, token: str, provider: str) -> str:
    """Embed an OAuth token into an HTTPS clone URL for a private repo.

    Only ever used in-process to build the argument passed to `git clone`
    for this one subprocess call — never logged, never persisted, never
    returned to a caller. GitHub accepts any non-empty username with the
    token as the password; GitLab's convention is the `oauth2` username;
    Bitbucket's OAuth access tokens use the `x-token-auth` username.
    """
    if not clone_url.startswith("https://"):
        raise ValueError("Authenticated clone requires an https:// URL")
    username = {"gitlab": "oauth2", "bitbucket": "x-token-auth"}.get(provider, "x-access-token")
    return clone_url.replace("https://", f"https://{username}:{token}@", 1)


def clone_repo(repo_url: str, *, log_url: str | None = None):
    """Clone `repo_url` (which may contain embedded credentials).

    `log_url` — a credential-free URL — is used in log/error messages
    instead of `repo_url` so an authenticated clone never leaks a token
    into logs or exception text.
    """
    safe_url = log_url or repo_url
    temp_dir = tempfile.mkdtemp(dir=_TMP_ROOT)

    try:
        subprocess.run(
            [
                "git",
                "clone",
                "--depth",
                "1",
                repo_url,
                temp_dir
            ],
            check=True,
            text=True,
            timeout=_CLONE_TIMEOUT_SECS,
            capture_output=True,
        )
    except subprocess.TimeoutExpired:
        cleanup_repo(temp_dir)
        raise RuntimeError(
            f"git clone of {safe_url} did not finish within {_CLONE_TIMEOUT_SECS}s "
            "and was killed. This usually means a very large repo, a network "
            "stall, or a private repo that needs credentials this backend doesn't have."
        ) from None
    except subprocess.CalledProcessError as exc:
        cleanup_repo(temp_dir)
        # Re-raised as a plain RuntimeError with a credential-free message —
        # subprocess.CalledProcessError.__str__ would otherwise include the
        # full argv, which contains the embedded token for private clones.
        stderr = (exc.stderr or b"").decode(errors="replace") if isinstance(exc.stderr, bytes) else (exc.stderr or "")
        raise RuntimeError(f"git clone of {safe_url} failed: {stderr.strip()[-500:]}") from None

    return temp_dir


def _clear_readonly_and_retry(func, path, exc_info):
    """`onerror` handler for shutil.rmtree.

    This is the actual, deterministic reason temp clone directories piled
    up on Windows (not an antivirus/indexer lock, despite what the retry
    logic below originally assumed): git marks files under `.git/objects/`
    and `.git/refs/` read-only on Windows as part of its normal object-
    database behavior. `shutil.rmtree` then fails with `PermissionError:
    [WinError 5] Access is denied` on every single clone, deterministically
    — sleeping and retrying does nothing for a permissions error, only for
    a transient lock, which is why the retry below alone wasn't preventing
    the buildup. This clears the read-only bit and retries the specific
    failed operation.
    """
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except OSError:
        # Best-effort — outer cleanup_repo() still retries/logs on failure.
        # Narrowed from a blanket `except Exception` (ruff BLE001) since
        # every real failure mode here (chmod/unlink/rmdir on a locked or
        # already-gone file) is an OSError subclass; anything else is a
        # genuine bug that should surface, not be swallowed.
        logger.debug("Could not clear read-only bit / remove %s", path, exc_info=True)


def cleanup_repo(repo_path: str):
    """Best-effort cleanup — every existing call site (sast.py, sca.py,
    secrets.py) calls this fire-and-forget after a scan and never checks
    a return value, so this must never raise. Clears git's read-only file
    attributes (see _clear_readonly_and_retry) on every attempt, since that
    was the actual, deterministic cause of temp directories accumulating —
    then retries once after a short delay for the much rarer case of a
    genuine transient lock (antivirus/indexer), and logs a warning if it
    still can't be removed, so any remaining growth is at least visible
    instead of silent."""
    try:
        shutil.rmtree(repo_path, onerror=_clear_readonly_and_retry)
        if not os.path.exists(repo_path):
            return
    except FileNotFoundError:
        return
    except OSError:
        pass

    logger.debug("First cleanup attempt left %s behind — retrying once", repo_path)
    time.sleep(_CLEANUP_RETRY_DELAY_SECS)
    try:
        shutil.rmtree(repo_path, onerror=_clear_readonly_and_retry)
        if os.path.exists(repo_path):
            logger.warning(
                "Could not fully remove temp scan directory %s after retry. "
                "It will be left behind — safe to delete manually.",
                repo_path,
            )
    except FileNotFoundError:
        return
    except OSError as exc2:
        logger.warning(
            "Could not remove temp scan directory %s after retry (%s). "
            "It will be left behind — safe to delete manually.",
            repo_path, exc2,
        )


def sweep_orphaned_scans(max_age_hours: float = 24) -> int:
    """Delete leftover tmp_scans/tmp* directories older than max_age_hours.

    Call once at backend startup. This is a safety net, not the primary
    fix — cleanup_repo()/cleanup_upload() clearing git's read-only bit
    should mean scans stop leaving anything behind at all — but it also
    clears out whatever's already accumulated from before this fix, and
    covers any future cleanup failure (crash mid-scan, disk issue, etc.)
    that fire-and-forget cleanup can't catch. Returns the number of
    directories removed.
    """
    if not os.path.isdir(_TMP_ROOT):
        return 0
    cutoff = time.time() - (max_age_hours * 3600)
    removed = 0
    for entry in os.scandir(_TMP_ROOT):
        if not entry.is_dir() or not entry.name.startswith("tmp"):
            continue
        try:
            if entry.stat().st_mtime > cutoff:
                continue
            shutil.rmtree(entry.path, onerror=_clear_readonly_and_retry)
            if not os.path.exists(entry.path):
                removed += 1
        except OSError as exc:
            logger.warning("Could not sweep orphaned scan directory %s (%s)", entry.path, exc)
    if removed:
        logger.info("Swept %d orphaned scan director%s from tmp_scans on startup", removed, "y" if removed == 1 else "ies")
    return removed
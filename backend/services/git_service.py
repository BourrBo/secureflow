import logging
import os
import shutil
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
    token as the password; GitLab's convention is the `oauth2` username.
    """
    if not clone_url.startswith("https://"):
        raise ValueError("Authenticated clone requires an https:// URL")
    username = "oauth2" if provider == "gitlab" else "x-access-token"
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


def cleanup_repo(repo_path: str):
    """Best-effort cleanup — every existing call site (sast.py, sca.py,
    secrets.py) calls this fire-and-forget after a scan and never checks
    a return value, so this must never raise. Previously this was a bare
    shutil.rmtree(ignore_errors=True): a failed delete (most commonly a
    Windows file lock — antivirus or the search indexer briefly holding a
    handle open right after a large clone) was completely invisible, and
    tmp_scans/ would quietly accumulate orphaned directories over time.
    Now it retries once after a short delay — long enough for a transient
    lock to clear — and logs a warning if it still can't be removed, so
    the growth is at least visible instead of silent."""
    try:
        shutil.rmtree(repo_path)
        return
    except FileNotFoundError:
        return
    except OSError as exc:
        logger.debug("First cleanup attempt failed for %s (%s) — retrying once", repo_path, exc)
        time.sleep(_CLEANUP_RETRY_DELAY_SECS)
        try:
            shutil.rmtree(repo_path)
        except FileNotFoundError:
            return
        except OSError as exc2:
            logger.warning(
                "Could not remove temp scan directory %s after retry (%s). "
                "It will be left behind — safe to delete manually.",
                repo_path, exc2,
            )
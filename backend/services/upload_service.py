import logging
import os
import shutil
import tempfile
import zipfile

from services.git_service import _clear_readonly_and_retry

logger = logging.getLogger(__name__)

# Same fix as git_service.py — keep temp folders on the backend's own drive.
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_TMP_ROOT = os.path.join(_BASE_DIR, "..", "tmp_scans")
os.makedirs(_TMP_ROOT, exist_ok=True)


def _win_long_path(path: str) -> str:
    """Windows silently truncates or refuses to write any path over
    MAX_PATH (260 characters) unless it's prefixed with \\\\?\\ to opt into
    the OS's extended-length path support — zipfile.extractall() never did
    this. A repo with deeply nested paths (DVWA's vulnerabilities/ tree is
    a good real example) extracted under our already-long
    tmp_scans/<tmpname>/extracted/ prefix could silently end up with most
    files missing on Windows: no exception raised, just an incomplete
    tree — which is exactly why scanning the SAME code succeeds via
    `git clone` (a shorter path, no /extracted/ segment) but returned 0
    findings via ZIP upload. No-op on any other OS, or a path that's
    already prefixed."""
    if os.name != "nt" or path.startswith("\\\\?\\"):
        return path
    return "\\\\?\\" + os.path.abspath(path)


def save_and_extract_zip(uploaded_file) -> str:
    temp_dir = tempfile.mkdtemp(dir=_TMP_ROOT)
    zip_path = os.path.join(temp_dir, "upload.zip")

    with open(zip_path, "wb") as f:
        shutil.copyfileobj(uploaded_file.file, f)

    extract_path = os.path.join(temp_dir, "extracted")
    extract_path_abs = os.path.abspath(extract_path)
    os.makedirs(_win_long_path(extract_path), exist_ok=True)

    # Extracted by hand (not zip_ref.extractall()) so every path can go
    # through _win_long_path above. That means this loop also has to
    # rebuild extractall()'s own path-traversal ("zip slip") protection
    # itself — a malicious archive entry named e.g. "../../evil.sh" or
    # given an absolute path would otherwise write outside extract_path.
    failed: list[str] = []
    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        for member in zip_ref.infolist():
            target_abs = os.path.abspath(os.path.join(extract_path, member.filename))
            if target_abs != extract_path_abs and not target_abs.startswith(extract_path_abs + os.sep):
                logger.warning("Skipping zip entry outside extraction root: %s", member.filename)
                continue
            if member.is_dir():
                os.makedirs(_win_long_path(target_abs), exist_ok=True)
                continue
            try:
                os.makedirs(_win_long_path(os.path.dirname(target_abs)), exist_ok=True)
                with zip_ref.open(member) as src, open(_win_long_path(target_abs), "wb") as dst:
                    shutil.copyfileobj(src, dst)
            except OSError:
                failed.append(member.filename)

    os.remove(zip_path)  # don't need the zip anymore, just the extracted code

    if failed:
        # Something stopped these files from being written (Windows path
        # length is the most likely cause — see _win_long_path). Surface
        # this loudly instead of silently scanning an incomplete tree and
        # reporting a clean-looking 0-findings result.
        preview = ", ".join(failed[:5])
        more = f" and {len(failed) - 5} more" if len(failed) > 5 else ""
        raise RuntimeError(
            f"{len(failed)} file(s) in the uploaded archive could not be extracted "
            f"(path too long or invalid): {preview}{more}"
        )

    # GitHub's "Download ZIP" (and GitLab's/Bitbucket's equivalents) always
    # wraps a repo's contents in a single top-level <repo>-<branch>/
    # folder. Point the scanner at that folder directly instead of at
    # "extracted" itself — a GitHub-URL scan and a ZIP-upload scan of the
    # exact same repo should show the same file paths in their findings,
    # and this is what a user visually expects after opening the extracted
    # folder. On its own this wrapper wasn't why ZIP uploads returned 0
    # findings (semgrep/Trivy scan recursively either way) — the actual
    # fix for that is the long-path handling above — but it's still worth
    # doing for consistency between the two scan methods.
    entries = [e for e in os.listdir(extract_path) if not e.startswith(".")]
    if len(entries) == 1 and os.path.isdir(os.path.join(extract_path, entries[0])):
        extract_path = os.path.join(extract_path, entries[0])

    return extract_path


def cleanup_upload(extract_path: str):
    # Reuse the same pattern as cleanup_repo, just walk up to remove the
    # whole temp_dir. Note: when extract_path was descended into a single
    # wrapper folder above, this only removes temp_dir/extracted (and
    # everything under it) — the outer temp_dir itself is left behind as
    # an empty directory rather than truly orphaned data, and
    # git_service.sweep_orphaned_scans() (run at backend startup) clears
    # out anything older than 24h regardless, so it doesn't accumulate.
    #
    # Previously this was shutil.rmtree(ignore_errors=True) — same
    # silent-failure problem git_service.py's cleanup_repo had: any
    # cleanup failure (a stray read-only file from a zip that preserved
    # that attribute, an AV/indexer lock) vanished without a trace, so
    # orphaned uploads could pile up in tmp_scans/ the same way orphaned
    # clones did. Sharing git_service's onerror handler keeps this
    # consistent and, unlike before, actually logs when it fails.
    parent_temp_dir = os.path.dirname(extract_path)
    try:
        shutil.rmtree(parent_temp_dir, onerror=_clear_readonly_and_retry)
    except FileNotFoundError:
        pass

# scanners/semgrep_runner.py

import json
import logging
import os
import subprocess

logger = logging.getLogger(__name__)


# Maximum time allowed for a Semgrep scan
_TIMEOUT_SECS = 600


# Extensions used only for the sanity check.
# This does NOT control what Semgrep itself scans.
_SOURCE_EXTENSIONS = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".php",
    ".java",
    ".c",
    ".h",
    ".cpp",
    ".cc",
    ".cxx",
    ".cs",
    ".go",
    ".rb",
    ".rs",
    ".swift",
    ".kt",
    ".kts",
    ".scala",
    ".sh",
    ".yaml",
    ".yml",
    ".json",
    ".tf",
}


# Directories we do not count as application source code
_IGNORED_DIRS = {
    ".git",
    "node_modules",
    "venv",
    ".venv",
    "__pycache__",
}


def _count_source_files(repo_path: str) -> int:
    """
    Count likely source files inside the scan target.

    This is only used as a sanity check to detect cases where
    source files exist but Semgrep reports scanning nothing.
    """

    count = 0

    for root, dirs, files in os.walk(repo_path):

        # Prevent walking into directories we intentionally ignore
        dirs[:] = [
            directory
            for directory in dirs
            if directory not in _IGNORED_DIRS
        ]

        for filename in files:

            extension = os.path.splitext(filename)[1].lower()

            if extension in _SOURCE_EXTENSIONS:
                count += 1

    return count


def _get_semgrep_errors(data: dict) -> str:
    """
    Extract readable error messages from Semgrep JSON output.
    """

    errors = data.get("errors", [])

    if not errors:
        return ""

    messages = []

    for error in errors[:5]:

        if isinstance(error, dict):

            message = (
                error.get("message")
                or error.get("short_msg")
                or str(error)
            )

        else:
            message = str(error)

        messages.append(message)

    return "; ".join(messages)


def run_semgrep(repo_path: str):
    """
    Run Semgrep against a repository or extracted ZIP directory.

    Semgrep is executed from inside the target directory and scans "."
    instead of receiving a potentially problematic absolute Windows path.

    --no-git-ignore is used so uploaded/extracted ZIP projects are not
    incorrectly limited to files tracked by Git.
    """

    # Convert to an absolute normalized path
    scan_root = os.path.abspath(repo_path)

    # Validate the target before calling Semgrep
    if not os.path.exists(scan_root):
        raise RuntimeError(
            f"Semgrep scan target does not exist: {scan_root}"
        )

    if not os.path.isdir(scan_root):
        raise RuntimeError(
            f"Semgrep scan target is not a directory: {scan_root}"
        )

    source_file_count = _count_source_files(scan_root)

    logger.info(
        "SAST scan started: source_files=%d",
        source_file_count,
    )

    # Run Semgrep from inside the scan directory.
    # --no-git-ignore is essential for uploaded ZIP projects,
    # because extracted files are not necessarily tracked by Git.
    command = [
        "semgrep",
        "scan",
        "--config=auto",
        "--no-git-ignore",
        "--json",
        ".",
    ]

    try:

        result = subprocess.run(
            command,
            cwd=scan_root,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            check=False,
            timeout=_TIMEOUT_SECS,
        )

    except subprocess.TimeoutExpired as exc:

        raise RuntimeError(
            f"Semgrep did not finish within {_TIMEOUT_SECS} seconds."
        ) from exc

    except FileNotFoundError as exc:

        raise RuntimeError(
            "Semgrep executable was not found. "
            "Make sure Semgrep is installed in the active Python environment."
        ) from exc


    # Semgrep must produce JSON output
    if not result.stdout.strip():

        stderr = result.stderr.strip() or "<no stderr>"

        raise RuntimeError(
            f"Semgrep produced no JSON output. "
            f"Exit code: {result.returncode}. "
            f"stderr: {stderr}"
        )


    # Parse Semgrep JSON
    try:

        data = json.loads(result.stdout)

    except json.JSONDecodeError as exc:

        raise RuntimeError(
            f"Failed to parse Semgrep JSON output: {exc}. "
            f"stderr={result.stderr.strip() or '<no stderr>'}"
        ) from exc


    # Get Semgrep-reported errors
    error_summary = _get_semgrep_errors(data)


    # Only show Semgrep stderr when something actually fails.
    # Semgrep normally writes its successful scan summary to stderr,
    # so logging it on every successful scan creates unnecessary noise.
    if result.returncode != 0:

        if result.stderr.strip():

            logger.error(
                "Semgrep error: %s",
                result.stderr.strip()[:3000],
            )

        raise RuntimeError(
            f"Semgrep failed with exit code {result.returncode}."
            + (
                f" Semgrep errors: {error_summary}"
                if error_summary
                else ""
            )
        )


    # Get files Semgrep reports as scanned
    scanned = []

    if isinstance(data.get("paths"), dict):
        scanned = data.get("paths", {}).get("scanned", [])


    findings = data.get("results", [])


    # Safety check:
    # Source code exists but Semgrep scanned nothing.
    if source_file_count > 0 and len(scanned) == 0:

        logger.error(
            "SAST scan failed: %d source files found but Semgrep scanned 0.",
            source_file_count,
        )

        raise RuntimeError(
            f"Semgrep found {source_file_count} source file(s) in the scan target "
            f"but scanned 0 of them. "
            f"Command: {' '.join(command)}"
            + (
                f". Semgrep errors: {error_summary}"
                if error_summary
                else ""
            )
        )


    # Clean successful scan log
    logger.info(
        "SAST scan completed: scanned=%d, findings=%d",
        len(scanned),
        len(findings),
    )


    return data
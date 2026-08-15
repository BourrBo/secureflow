# scanners/semgrep_runner.py

import json
import subprocess

# Semgrep's own docs note large monorepos can take several minutes with
# --config=auto (it fetches/updates the rule registry over the network on
# top of the actual scan). 10 minutes is generous headroom above that while
# still guaranteeing a hung process can't block a request indefinitely.
_TIMEOUT_SECS = 600


def run_semgrep(repo_path: str):

    try:
        result = subprocess.run(
            [
                "semgrep",
                "scan",
                "--config=auto",
                "--json",
                repo_path
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            check=False,  # returncode is checked manually below, with our own error message
            timeout=_TIMEOUT_SECS,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(
            f"Semgrep did not finish within {_TIMEOUT_SECS}s and was killed. "
            "This usually means an unusually large repo or a network stall "
            "fetching the rule registry — try again, or scan a narrower path."
        ) from exc

    if not result.stdout:
        stderr = result.stderr.strip() or "<no stderr>"
        raise RuntimeError(
            f"Semgrep produced no output (exit code {result.returncode}). "
            f"stderr={stderr}"
        )

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Failed to parse Semgrep JSON output: {exc}. "
            f"stderr={result.stderr.strip() or '<no stderr>'}"
        )
# scanners/semgrep_runner.py

import json
import subprocess


def run_semgrep(repo_path: str):

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
    )

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
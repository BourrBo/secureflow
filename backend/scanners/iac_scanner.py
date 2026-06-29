import json
import os
import shutil
import subprocess
import sys

def run_iac_scan(repo_path: str) -> dict:
    """
    Runs Checkov on the given path and returns raw JSON results.
    Checkov exits with code 1 when it finds issues (same as Semgrep),
    so we ignore exit code and parse stdout directly.
    """
    checkov_cmd = shutil.which("checkov")
    if not checkov_cmd:
        scripts_dir = os.path.join(os.path.dirname(sys.executable), "Scripts")
        checkov_cmd = os.path.join(scripts_dir, "checkov.exe")
        if not os.path.exists(checkov_cmd):
            raise FileNotFoundError(
                "Checkov executable not found. Install Checkov in the current venv and retry."
            )

    result = subprocess.run(
        [
            checkov_cmd,
            "--directory", repo_path,
            "--output", "json",
            "--quiet",
            "--compact"         # removes code block from output, keeps it lean
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore"
    )

    if result.returncode not in (0, 1):
        raise RuntimeError(
            f"Checkov failed: returncode={result.returncode}, stderr={result.stderr.strip()}"
        )

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Unable to parse Checkov JSON output: {exc}. stdout={result.stdout.strip()} stderr={result.stderr.strip()}"
        )
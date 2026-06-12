# scanners/semgrep_runner.py

import subprocess
import json

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
        errors="ignore"
    )

    return json.loads(result.stdout)
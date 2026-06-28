import json
import shutil
import subprocess


def run_trivy(repo_path: str):
    trivy_path = shutil.which("trivy")

    if trivy_path is None:
        raise RuntimeError(
            "Trivy executable not found on PATH. Install it and ensure "
            "it's accessible from the shell running this backend "
            "(see https://aquasecurity.github.io/trivy/latest/getting-started/installation/)."
        )

    result = subprocess.run(
        [
            trivy_path,
            "fs",
            repo_path,
            "--format",
            "json",
            "--scanners",
            "vuln"
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore"
    )

    if result.returncode != 0:
        stderr = result.stderr.strip() or "<no stderr>"
        stdout = result.stdout.strip() or "<no stdout>"

        raise RuntimeError(
            f"Trivy scan failed with exit code {result.returncode}. "
            f"stderr={stderr}. stdout={stdout}."
        )

    if not result.stdout:
        raise RuntimeError("Trivy produced no output.")

    try:
        return json.loads(result.stdout)

    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Failed to parse Trivy JSON output: {exc}"
        )

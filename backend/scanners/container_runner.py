import json
import shutil
import subprocess


def run_container_scan(image_name: str):
    """
    Scan a container image using Trivy.
    Example:
        nginx:latest
        python:3.13
        redis:7
    """

    trivy_path = shutil.which("trivy")

    if trivy_path is None:
        raise RuntimeError("Trivy is not installed or not found in PATH.")

    command = [
        trivy_path,
        "image",
        "--scanners",
        "vuln",
        "--skip-version-check",
        "--format",
        "json",
        image_name
    ]

    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore"
    )

    if result.returncode != 0:
        raise RuntimeError(result.stderr)

    return json.loads(result.stdout)
import json
import os
import shutil
import subprocess

# Longer than the other scanners' 600s — this scan can include pulling the
# image itself over the network before Trivy even starts analyzing layers,
# so it needs more headroom than a local filesystem/dependency scan does.
_TIMEOUT_SECS = 900


def run_container_scan(image_name: str, env: dict[str, str] | None = None):
    """
    Scan a container image using Trivy.
    Example:
        nginx:latest
        python:3.13
        redis:7

    ``env``, when provided, is merged on top of the current process
    environment for this subprocess call only — used to hand Trivy
    short-lived registry credentials (e.g. TRIVY_USERNAME/PASSWORD for
    Docker Hub/GHCR, or AWS_* for ECR) without ever touching os.environ
    globally or writing them to disk. Callers that don't pass ``env``
    keep the exact previous behavior (inherit the parent process env).
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

    subprocess_env = {**os.environ, **env} if env else None

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            check=False,  # returncode is checked manually below, with our own error message
            timeout=_TIMEOUT_SECS,
            env=subprocess_env,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(
            f"Trivy did not finish scanning '{image_name}' within "
            f"{_TIMEOUT_SECS}s and was killed. This usually means a slow "
            "image pull or an unusually large image."
        ) from exc

    if result.returncode != 0:
        raise RuntimeError(result.stderr)

    return json.loads(result.stdout)
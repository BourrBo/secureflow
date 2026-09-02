import json
import logging
import os
import re
import shutil
import subprocess
import time

logger = logging.getLogger(__name__)

# Same reasoning as semgrep_runner.py's _TIMEOUT_SECS.
_TIMEOUT_SECS = 600

# ── Rate-limit retry ─────────────────────────────────────────────────
# Root cause of the 429s seen in Docker: without a persisted cache dir
# (see _DEFAULT_CACHE_DIR below), every container rebuild wiped Trivy's
# vuln DB, so every scan re-downloaded it from ghcr.io (anonymous-pull
# rate limited) and, for Java/Maven projects specifically, Trivy also
# resolves parent POMs against repo.maven.org when it has no local
# cache — both are classic "too many requests from this IP" sources.
# The cache-dir fix below should make this rare in practice; this retry
# is a safety net for whatever gets through anyway (e.g. a genuinely
# busy shared IP), not a substitute for it.
_MAX_RETRIES = 2
_RETRY_BACKOFF_SECS = 30
_MAX_RETRY_WAIT_SECS = 90  # never let a retry wait eat the whole timeout budget

# Trivy's cache (vuln DB + Java DB, ~500-600MB) is pinned to a fixed path
# instead of relying on whatever $HOME resolves to. docker-compose.yml
# mounts a named volume at exactly this path so the DB survives container
# rebuilds instead of re-downloading (and re-triggering rate limits) every
# single time. Override with the TRIVY_CACHE_DIR env var if your setup
# uses a different HOME/user.
_DEFAULT_CACHE_DIR = "/home/appuser/.cache/trivy"

# Trivy config file (Maven mirror settings — see backend/trivy.yaml). Only
# passed to Trivy if the file actually exists, so this never breaks a
# local/non-Docker run where the layout might differ.
_DEFAULT_CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "trivy.yaml")

# ── Offline scan (Java/Maven-specific) ──────────────────────────────
# Separate from the vuln-DB cache above: for pom.xml projects, Trivy
# resolves the full dependency tree by fetching parent/BOM POMs live
# from Maven Central when it has no local .m2 cache — that's what was
# hitting the 429 on DependencyCheck, and it's a real IP-level block
# (Retry-After: 1800s+) that no amount of in-request retrying can wait
# out. --offline-scan skips those live POM lookups entirely.
# Off by default because it can leave some transitive Java dependencies
# unresolved (slightly less complete results) — opt in per-scan by
# setting TRIVY_OFFLINE_SCAN=true, e.g. specifically before scanning a
# large/unfamiliar Java repo.
_OFFLINE_SCAN = os.environ.get("TRIVY_OFFLINE_SCAN", "false").strip().lower() == "true"


def _is_rate_limited(stderr: str) -> bool:
    lowered = stderr.lower()
    return "429" in stderr or "too many requests" in lowered


def _is_maven_rate_limited(stderr: str) -> bool:
    return "remote maven repository returned 429" in stderr.lower()


def _extract_retry_after(stderr: str) -> int | None:
    match = re.search(r"retry-after[:\s]+(\d+)", stderr, re.IGNORECASE)
    return int(match.group(1)) if match else None


# Filenames Trivy actually needs to resolve exact installed versions per
# ecosystem. A manifest alone (package.json, requirements.txt without a
# freeze) only lists version *ranges* — Trivy correctly reports 0 findings
# without one of these, since it has no resolved version to match against
# a CVE. This is the single most common reason a real, vulnerable repo
# scans clean and isn't a bug in this backend at all.
_LOCKFILE_NAMES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "npm-shrinkwrap.json",  # npm/yarn/pnpm
    "composer.lock",  # PHP
    "Pipfile.lock", "poetry.lock", "uv.lock",  # Python
    "Gemfile.lock",  # Ruby
    "go.sum",  # Go
    "Cargo.lock",  # Rust
    "pom.xml", "build.gradle", "build.gradle.kts",  # Java (Trivy can resolve these directly)
}
_MAX_WALK_ENTRIES = 5000  # bail out on pathological repos instead of hanging


def _find_lockfiles(repo_path: str) -> list[str]:
    found = []
    scanned = 0
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "vendor")]
        for name in files:
            scanned += 1
            if name in _LOCKFILE_NAMES:
                found.append(os.path.relpath(os.path.join(root, name), repo_path))
        if scanned > _MAX_WALK_ENTRIES:
            break
    return found


def run_trivy(repo_path: str):
    trivy_path = shutil.which("trivy")

    if trivy_path is None:
        raise RuntimeError(
            "Trivy executable not found on PATH. Install it and ensure "
            "it's accessible from the shell running this backend "
            "(see https://aquasecurity.github.io/trivy/latest/getting-started/installation/)."
        )

    cache_dir = os.environ.get("TRIVY_CACHE_DIR", _DEFAULT_CACHE_DIR)

    trivy_args = [
        trivy_path,
        "--cache-dir",
        cache_dir,
        "fs",
        repo_path,
        "--format",
        "json",
        "--scanners",
        "vuln",
        "--skip-version-check",
        "--disable-telemetry",
    ]
    config_path = os.environ.get("TRIVY_CONFIG_PATH", _DEFAULT_CONFIG_PATH)
    if os.path.isfile(config_path):
        trivy_args.insert(1, "--config")
        trivy_args.insert(2, config_path)
    if _OFFLINE_SCAN:
        # Must come AFTER "fs" — it's a scan-command flag, not a global
        # one (confirmed by Trivy's own --help: --offline-scan isn't in
        # the global flags list). Putting it before "fs" made Trivy try
        # to parse it as a global flag before it even recognized the "fs"
        # subcommand, which is what caused "unknown flag: --offline-scan".
        trivy_args.append("--offline-scan")

    result = None
    last_error = None

    for attempt in range(_MAX_RETRIES + 1):
        try:
            result = subprocess.run(
                trivy_args,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="ignore",
                check=False,  # returncode is checked manually below, with our own error message
                timeout=_TIMEOUT_SECS,
            )
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError(
                f"Trivy did not finish within {_TIMEOUT_SECS}s and was killed. "
                "This usually means an unusually large dependency tree, or a "
                "slow/stalled vulnerability DB download on first run."
            ) from exc

        if result.returncode == 0:
            break

        stderr = result.stderr.strip() or "<no stderr>"
        stdout = result.stdout.strip() or "<no stdout>"
        last_error = RuntimeError(
            f"Trivy scan failed with exit code {result.returncode}. "
            f"stderr={stderr}. stdout={stdout}."
        )

        # Maven Central blocks the whole IP for the server-specified
        # Retry-After window (often 20-30 min). Retrying immediately is
        # guaranteed to fail again — worse, it's another request against
        # an IP that's already blocked, which can prolong the block.
        # Fail fast with clear guidance instead of burning the retry
        # budget on a wait that can't succeed within one request.
        if _is_maven_rate_limited(stderr):
            retry_after = _extract_retry_after(stderr)
            wait_hint = (
                f" Wait at least {retry_after} seconds before retrying."
                if retry_after
                else " Wait for Maven Central's block to expire before retrying."
            )
            raise RuntimeError(
                "Maven Central rate-limited this Java dependency scan."
                + wait_hint
                + " Set TRIVY_OFFLINE_SCAN=true to avoid live Maven Central "
                  "lookups entirely (trade-off: some transitive Java deps "
                  "may not resolve), or configure a Maven mirror/proxy in "
                  "backend/trivy.yaml (scan.maven.mirrors) if your org runs "
                  "one, so Trivy stops contacting Maven Central directly."
            ) from last_error

        if attempt < _MAX_RETRIES and _is_rate_limited(stderr):
            wait = min(_extract_retry_after(stderr) or _RETRY_BACKOFF_SECS, _MAX_RETRY_WAIT_SECS)
            logger.warning(
                "Trivy hit a rate limit on %s (attempt %d/%d) — retrying in %ds. stderr=%s",
                repo_path,
                attempt + 1,
                _MAX_RETRIES + 1,
                wait,
                stderr,
            )
            time.sleep(wait)
            continue

        raise last_error

    if result is None or result.returncode != 0:
        raise last_error or RuntimeError("Trivy scan failed for an unknown reason.")

    if not result.stdout:
        raise RuntimeError("Trivy produced no output.")

    try:
        parsed = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Failed to parse Trivy JSON output: {exc}") from exc

    # Distinguish "genuinely clean scan" from "found nothing to scan at
    # all" — the latter (0 Results, not just 0 Vulnerabilities) usually
    # means an empty/wrong clone dir or a missing manifest, not a secure
    # repo. This never blocks the response — some repos legitimately have
    # nothing scannable — but it makes the difference visible in logs
    # instead of looking identical to a real 0-finding result.
    if not parsed.get("Results"):
        lockfiles = _find_lockfiles(repo_path)
        if lockfiles:
            # Lockfiles exist but Trivy still found nothing — that's the
            # real red flag (clone/path problem, or Trivy couldn't read
            # them for some other reason).
            logger.warning(
                "Trivy returned no Results for %s despite finding lockfiles: %s. "
                "This is unexpected — worth checking Trivy's own stderr/version "
                "and whether these paths are actually readable inside the "
                "container.",
                repo_path,
                lockfiles,
            )
        else:
            # No lockfiles anywhere in the tree — Trivy is correct to find
            # nothing; a manifest alone (package.json etc.) has no resolved
            # versions to check. Not a bug, just nothing scannable here.
            logger.info(
                "Trivy returned no Results for %s — no lockfiles found in "
                "the tree (only manifests, if any), so this is expected, "
                "not a clone/path problem.",
                repo_path,
            )

    return parsed

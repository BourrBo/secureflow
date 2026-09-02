# syntax=docker/dockerfile:1
FROM python:3.12-slim

# ── System deps ──────────────────────────────────────────────────────
# - default-jre-headless: OWASP ZAP needs a JVM
# - git: gitpython shells out to the real `git` binary for repo cloning
# - curl/wget: used by the Trivy and ZAP install steps below
# - build-essential/libpq-dev: psycopg2-binary is a wheel, but keep these
#   in case a future dep needs to compile against libpq
RUN apt-get update && apt-get install -y --no-install-recommends \
    default-jre-headless \
    git \
    curl \
    wget \
    ca-certificates \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# ── Trivy (SCA + container scanning) ────────────────────────────────
# Official install script, pinned to a specific known-good release.
#
# IMPORTANT — do not "helpfully" bump this to just whatever's newest without
# checking first. In March 2026, aquasecurity's own release tooling
# (setup-trivy, trivy-action) was compromised via imposter commits, and a
# malicious trivy binary was briefly published as v0.69.4, with compromised
# Docker Hub images at v0.69.5 and v0.69.6 — never use those three versions.
# Separately (and why this version number changed from what shipped
# earlier): aquasecurity has since pruned many older release binaries from
# GitHub — versions up to at least v0.65.0 now 404 on their release assets
# — so an old pin can silently stop resolving even with zero code changes
# on our side. v0.73.0 is current as of this Dockerfile and its assets +
# checksums are confirmed live; if this ever fails to download again,
# check https://github.com/aquasecurity/trivy/releases for a current
# version before assuming it's something else.
#
# trivy_runner.py / container_runner.py both do `shutil.which("trivy")`,
# so nothing on the Python side needs to know the install path — it just
# needs to end up on PATH, which /usr/local/bin already is in this image.
RUN curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh \
    | sh -s -- -b /usr/local/bin v0.73.0

# ── OWASP ZAP (DAST) ─────────────────────────────────────────────────
# zap_utils.py's own docstring pins this codebase to ZAP 2.17.0 — install
# that version, not an arbitrary "latest", so behavior matches what the
# code was actually written against.
#
# zap_utils._find_zap_executable() does `shutil.which("zap.bat") or
# shutil.which("zap.sh")` — so a symlink named zap.sh on PATH is all
# that's needed for auto-discovery; no ZAP_PATH env var required (though
# it's still honored if set, and takes priority).
RUN wget -q "https://github.com/zaproxy/zaproxy/releases/download/v2.17.0/ZAP_2.17.0_Linux.tar.gz" \
    -O /tmp/zap.tar.gz \
    && mkdir -p /opt/zap \
    && tar -xzf /tmp/zap.tar.gz -C /opt/zap --strip-components=1 \
    && rm /tmp/zap.tar.gz \
    && chmod +x /opt/zap/zap.sh \
    && ln -s /opt/zap/zap.sh /usr/local/bin/zap.sh

WORKDIR /app

# ── Python deps ──────────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# ── Non-root user ────────────────────────────────────────────────────
# ZAP and Trivy both need to write to their own working dirs (ZAP's
# session/home dir, Trivy's vuln DB cache) — give the app user a real
# home directory instead of running as root.
RUN useradd --create-home --shell /bin/bash appuser \
    && mkdir -p /home/appuser/.ZAP /home/appuser/.m2 /app/tmp_scans \
    && chown -R appuser:appuser /home/appuser /app
USER appuser
ENV HOME=/home/appuser

# ── Trivy cache pre-warm ─────────────────────────────────────────────
# Trivy's vuln DB (~500-600MB, from ghcr.io) used to get re-downloaded on
# every container rebuild since nothing persisted it — that's what was
# causing the 429 "too many requests" errors and the multi-minute first
# scan. Baking it into the image here means a scan never depends on that
# download succeeding at runtime at all; docker-compose.yml also mounts a
# volume at this same path so later `trivy db update`-style refreshes
# (Trivy does this automatically every ~24h) persist across rebuilds too.
# `|| true` so a build never breaks if Trivy's download-only flag/output
# changes in a future version — worst case you're back to a runtime
# download on first scan, not a broken image.
ENV TRIVY_CACHE_DIR=/home/appuser/.cache/trivy
RUN trivy image --cache-dir "$TRIVY_CACHE_DIR" --download-db-only || true

# ── Runtime config ───────────────────────────────────────────────────
# ZAP_AUTOSTART defaults to "true" in zap_utils.py already — set it
# explicitly here anyway so the container's behavior doesn't silently
# depend on that default never changing.
ENV ZAP_AUTOSTART=true \
    ZAP_HOST=127.0.0.1 \
    ZAP_PORT=8080 \
    PYTHONUNBUFFERED=1

EXPOSE 8000

# Railway (and most PaaS targets) inject $PORT at runtime and expect the
# app to bind to it. This needs shell-style ${PORT:-8000} expansion, which
# JSON-array CMD doesn't support directly — so this wraps it in `sh -c`
# but with `exec`, which matters here specifically: without `exec`, the
# shell stays as PID 1 and doesn't forward SIGTERM to uvicorn, so
# `docker compose down` / Railway redeploys would kill it abruptly after
# the grace period instead of running the lifespan shutdown handler
# (closing the DB pool cleanly) that main.py relies on. `exec` replaces
# the shell process with uvicorn itself, so it becomes PID 1 and receives
# the signal directly.
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]

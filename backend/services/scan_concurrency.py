"""
services/scan_concurrency.py

Shared concurrency limit for the CPU/RAM-heavy scanner subprocesses:
Semgrep (SAST), Trivy (SCA + container), and Checkov (IaC). DAST already
serializes itself via routes/dast.py's own `_zap_scan_lock` -- ZAP is a
long-running daemon, a different shape of problem -- so this covers
everything else.

Why this exists: on a memory-constrained VPS (the 8GB MVP sizing), several
of these scanners running at once can exhaust RAM even when no single scan
is individually excessive -- this was flagged in the production gap
analysis alongside the ZAP heap cap in utils/zap_utils.py.

MAX_CONCURRENT_SCANS defaults to 1, matching the "cap concurrency to 1 on
an 8GB VPS" sizing guidance. Raise it via the environment once you've
upgraded RAM and confirmed headroom -- no code change needed.
"""

import os
import threading

MAX_CONCURRENT_SCANS = max(1, int(os.environ.get("MAX_CONCURRENT_SCANS", "1")))

scan_semaphore = threading.Semaphore(MAX_CONCURRENT_SCANS)

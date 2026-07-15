"""
scripts/test_zap_scan.py

Phase 3 — standalone DAST test, with no FastAPI/route/DB involved at all.
Run this directly to prove the ZAP integration works on your machine before
routes/dast.py gets wired into main.py.

Usage (from the backend/ folder, with your venv active):

    python scripts/test_zap_scan.py http://localhost:3000

If no URL is given, it defaults to http://localhost:3000.

What it does:
    1. Confirms OWASP ZAP is reachable (starting it via ZAP_PATH if needed)
    2. Runs the full spider -> passive scan -> active scan workflow
    3. Prints a summary (counts by severity)
    4. Writes the raw ZAP alerts to zap_scan_raw.json
    5. Writes the normalized SecureFlow-shaped findings to zap_scan_findings.json

Nothing here touches secureflow.db or the FastAPI app — it's safe to run
repeatedly while you're getting ZAP set up.
"""

import json
import sys
import os

# Allow running this script directly (`python scripts/test_zap_scan.py`)
# without needing the backend package installed — adds the backend/ root
# (one level up from scripts/) to sys.path, same trick main.py's uvicorn
# invocation relies on implicitly when run from the backend/ folder.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scanners.zap_runner import run_zap_scan, ZapScanError
from parsers.zap_parser import normalize_zap_findings


def main():
    target_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"

    print(f"[*] Target: {target_url}")
    print("[*] Starting ZAP scan (spider -> passive -> active)...")
    print("[*] This can take several minutes depending on the app's size.\n")

    try:
        raw_alerts = run_zap_scan(target_url)
    except ZapScanError as e:
        print(f"[!] DAST scan failed: {e}")
        sys.exit(1)

    findings = normalize_zap_findings(raw_alerts)

    counts = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for f in findings:
        counts[f["severity"]] = counts.get(f["severity"], 0) + 1

    print(f"[+] Scan complete — {len(findings)} findings")
    print(f"    HIGH:   {counts.get('HIGH', 0)}")
    print(f"    MEDIUM: {counts.get('MEDIUM', 0)}")
    print(f"    LOW:    {counts.get('LOW', 0)}\n")

    with open("zap_scan_raw.json", "w", encoding="utf-8") as f:
        json.dump(raw_alerts, f, indent=2)
    print("[+] Raw ZAP alerts written to zap_scan_raw.json")

    with open("zap_scan_findings.json", "w", encoding="utf-8") as f:
        json.dump(findings, f, indent=2)
    print("[+] Normalized findings written to zap_scan_findings.json")


if __name__ == "__main__":
    main()

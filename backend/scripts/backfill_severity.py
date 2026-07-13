"""
scripts/backfill_severity.py

One-time fix for findings inserted BEFORE the severity normalizer existed.
Re-normalizes every row's `severity` in place, without re-running any scans.

Run once from the backend/ folder:
    python scripts/backfill_severity.py
"""
import sqlite3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.severity import normalize_severity

DB_PATH = os.getenv("SECUREFLOW_DB", "secureflow.db")


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    rows = conn.execute("SELECT id, severity, scanner FROM findings").fetchall()
    updates = []
    for r in rows:
        fixed = normalize_severity(r["severity"], scanner=r["scanner"])
        if fixed != r["severity"]:
            updates.append((fixed, r["id"]))

    if updates:
        conn.executemany("UPDATE findings SET severity = ? WHERE id = ?", updates)
        conn.commit()

    print(f"Checked {len(rows)} findings, fixed {len(updates)} inconsistent severity values.")
    conn.close()


if __name__ == "__main__":
    main()

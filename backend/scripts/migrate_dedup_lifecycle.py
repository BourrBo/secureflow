"""
scripts/migrate_dedup_lifecycle.py

Adds every column needed for:
  - Cross-engine deduplication: fingerprint, unique_id_from_tool, duplicate_of
  - Finding lifecycle: status, owner, notes, first_seen_at, last_seen_at
  - VAPT report / EPSS / priority-score fields that models.finding.Finding
    already declared but that were never persisted: cvss_vector,
    epss_percentile, epss_risk_level, affected_location, affected_path,
    affected_parameter, additional_observations, revalidation_status,
    new_or_repeat, priority_score, priority_basis, priority_risk_level,
    reference_links (the model's `references` field -- stored under a
    different column name because REFERENCES is a reserved SQL keyword).

Safe to re-run -- every statement is IF NOT EXISTS / has a guard. This is
the exact set already applied directly to the production Supabase project
via the Supabase migration `add_findings_report_priority_fields` (plus the
earlier `dast_scan_states_and_telemetry_fields` for the lifecycle columns) --
running this script against that database is a no-op. It exists so a fresh
environment (local Postgres, a new Supabase project, staging) can reach the
same schema without needing Supabase MCP access.

Run once from the backend/ folder, with DATABASE_URL set the same way the
app itself needs it:
    python scripts/migrate_dedup_lifecycle.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")

STATEMENTS = [
    # Dedup + lifecycle
    "ALTER TABLE findings ADD COLUMN IF NOT EXISTS fingerprint TEXT",
    "ALTER TABLE findings ADD COLUMN IF NOT EXISTS unique_id_from_tool TEXT",
    "ALTER TABLE findings ADD COLUMN IF NOT EXISTS duplicate_of INTEGER REFERENCES findings(id) ON DELETE SET NULL",
    "ALTER TABLE findings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Open'",
    "ALTER TABLE findings ADD COLUMN IF NOT EXISTS owner TEXT",
    "ALTER TABLE findings ADD COLUMN IF NOT EXISTS notes TEXT",
    "ALTER TABLE findings ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()",
    "ALTER TABLE findings ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()",
    # status is constrained at the application layer (see
    # db_service.VALID_FINDING_STATUS) rather than a DB CHECK constraint, so
    # adding a new lifecycle state later doesn't require another migration.

    # VAPT / EPSS / priority-score fields (previously declared on the model,
    # never persisted -- see module docstring above)
    "ALTER TABLE findings ADD COLUMN IF NOT EXISTS cvss_vector TEXT",
    "ALTER TABLE findings ADD COLUMN IF NOT EXISTS epss_percentile TEXT",
    "ALTER TABLE findings ADD COLUMN IF NOT EXISTS epss_risk_level TEXT",
    "ALTER TABLE findings ADD COLUMN IF NOT EXISTS affected_location TEXT",
    "ALTER TABLE findings ADD COLUMN IF NOT EXISTS affected_path TEXT",
    "ALTER TABLE findings ADD COLUMN IF NOT EXISTS affected_parameter TEXT",
    "ALTER TABLE findings ADD COLUMN IF NOT EXISTS additional_observations TEXT",
    "ALTER TABLE findings ADD COLUMN IF NOT EXISTS revalidation_status TEXT NOT NULL DEFAULT 'Open'",
    "ALTER TABLE findings ADD COLUMN IF NOT EXISTS new_or_repeat TEXT NOT NULL DEFAULT 'New'",
    "ALTER TABLE findings ADD COLUMN IF NOT EXISTS priority_score NUMERIC",
    "ALTER TABLE findings ADD COLUMN IF NOT EXISTS priority_basis TEXT",
    "ALTER TABLE findings ADD COLUMN IF NOT EXISTS priority_risk_level TEXT",
    "ALTER TABLE findings ADD COLUMN IF NOT EXISTS reference_links TEXT[] DEFAULT '{}'",

    # Indexes
    "CREATE INDEX IF NOT EXISTS idx_findings_fingerprint ON findings (user_id, project_id, fingerprint)",
    "CREATE INDEX IF NOT EXISTS idx_findings_unique_id_from_tool ON findings (user_id, project_id, unique_id_from_tool)",
    "CREATE INDEX IF NOT EXISTS idx_findings_duplicate_of ON findings (duplicate_of)",
    "CREATE INDEX IF NOT EXISTS idx_findings_status ON findings (user_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_findings_canonical_lookup ON findings (user_id, project_id, duplicate_of) WHERE duplicate_of IS NULL",
    "CREATE INDEX IF NOT EXISTS idx_findings_duplicate_of_lookup ON findings (duplicate_of) WHERE duplicate_of IS NOT NULL",
]


def main():
    if not DATABASE_URL:
        print("DATABASE_URL is not set -- copy it into your .env first.", file=sys.stderr)
        sys.exit(1)

    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn, conn.cursor() as cur:
            for stmt in STATEMENTS:
                print(f"-> {stmt}")
                cur.execute(stmt)
        print(f"Migration complete: {len(STATEMENTS)} statements applied (or already present).")
    finally:
        conn.close()


if __name__ == "__main__":
    main()

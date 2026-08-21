# SecureFlow teammate-merged snapshot audit

## Objective
Confirm the impact of the teammate `secureflow-merged.zip` snapshot on the current Lovable project and recommend a safe integration path that does not downgrade the frontend.

## Findings

### 1. No merged snapshot present in the sandbox uploads
- The exact file `secureflow-merged.zip` was not found in `/mnt/user-uploads/` or `/tmp/user-uploads/`.
- The related archives that are present are all older than the current Lovable project:
  - `secureflow.zip` / `secureflow-2.zip`: Next.js frontend, dated July 5, 2026.
  - `secureflow-main.7z`: backend + Next.js frontend snapshot, dated July 28-29, 2026.
  - `backend.zip`: backend-only snapshot, dated July 5, 2026.
- The Lovable project is on a TanStack Start stack (Vite + TanStack Router + React Query), which is structurally different from the Next.js `app/` directory in the archives.

### 2. Current Lovable frontend is newer than the merged snapshot
Verified that the following advanced frontend files exist and are wired into the running project:

- `src/components/dashboard/findingColumns.tsx` — shared scanner-aware column schema for all findings tables.
- `src/lib/integrationScan.tsx` — persistent integration-triggered scan state across navigation.
- `src/lib/organization.ts` — normalized organization ID lifecycle, no sentinel `0`, centralized clearing.
- `src/lib/dastScan.tsx` — DAST scan persistence, active-scan telemetry, cancel support, and attack-strength tracking.
- `src/lib/moduleScan.tsx` — persistent module scan state for SAST/SCA/IaC/Secrets/Container.
- `src/components/dashboard/ScanLauncher.tsx` — DAST attack-strength selector, real-time telemetry card, and cancel button.
- `src/routes/dashboard.integrations.tsx` — organization validation, recovery on 403, and OAuth-handoff cleanup.
- `src/routes/dashboard.findings.tsx` — server-side search, CSV export, and workspace reset with cache/URL/filter clearing.

These files are absent from the older Next.js frontend snapshots, confirming the user observation that the merged snapshot is behind the current Lovable project.

### 3. Merging the older frontend would be a downgrade
Applying the teammate's `merged/secureflow/` frontend would:
- Replace the unified `findingColumns.tsx` schema with older per-table rendering.
- Lose the organization lifecycle fixes that prevent `/organizations/0/...` 403 loops.
- Lose the DAST attack-strength, telemetry, and cancel features.
- Lose the persistent integration scan and module scan contexts.
- Revert the workspace reset/cache-clear behavior.
- Switch the stack from TanStack Start back to Next.js, which is not the current Lovable architecture.

## Recommendation

- **Do NOT import or replace any current frontend files from the teammate snapshot.**
- **Keep the current Lovable frontend as-is until the new backend contract is known.**
- The only safe integration from the teammate snapshot is **backend-only**, specifically the finding-deduplication logic.

### Before any frontend adaptation to finding dedup, verify the backend contract
1. Are deduplicated findings still returned from the same endpoints?
   - `GET /api/findings`
   - Per-module finding endpoints
2. Does the response schema change? Look for new fields such as:
   - `deduplication_key`, `group_id`, `group_count`, `primary_id`, `duplicate_ids`
3. Are existing finding fields preserved (title, severity, location, scanner, description, cwe, cve, cvss, epss, etc.)?
4. Are IDs stable across scans? Does pagination still work the same way?
5. Does the global search `q` parameter still apply to the deduplicated result set?

### If the contract changes, only these files will need targeted updates
- `src/lib/api.ts` — type definitions for `ApiFinding` and any new query parameters.
- `src/lib/security.ts` — normalization logic if the `scanner` or `severity` mapping changes.
- `src/components/dashboard/findingColumns.tsx` — extra columns if new dedup metadata is surfaced.
- `src/components/dashboard/FindingsTable.tsx` and `FindingDetailDialog.tsx` — rendering of any new fields.
- `src/routes/dashboard.findings.tsx` — query keys and filter handling.

## Scope of this audit
No source files are modified. No code changes are proposed. This is a read-only verification and a safe integration plan.

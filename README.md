# SecureFlow

Enterprise Application Security (AppSec) scanning platform that aggregates
multiple security scanners — static analysis, dependency scanning,
infrastructure-as-code scanning, and secret detection — into a single
unified dashboard, with findings mapped to ISO/IEC 27001:2022 Annex A
controls.

Built as a B.Tech major internship project at Laati Consulting, led by a
4-person intern team.

---

## Current status (as of July 2026)

| Phase | What it covers | Status |
|---|---|---|
| 1 | Persistence layer (SQLite: projects/scans/findings) | ✅ Done |
| 2 | Findings, Projects, Reports, Compliance views | ✅ Backend + frontend done |
| 3 | Container image scanning (Trivy `image` mode) | ⏳ Not started |
| 4 | CI/CD decision layer (Jenkins/GitLab integration) | ⏳ Not started |
| 5 | Settings / API keys | ⏳ Not started |
| 6 | DAST (OWASP ZAP) | ⏳ Not started |

### Known gaps to fix before Phase 3
- `findings/[id]` detail page still reads from `localStorage` (SAST-only,
  index-based) instead of fetching a real finding by database ID — needs
  rewiring before Container/DAST pages can link into it
- `projects/[id]` detail page doesn't exist yet — clicking a project row
  currently 404s
- Secrets scanner has a high false-positive rate on manifest/lockfile-style
  files (`package.json`, lockfiles) — needs a path-based exclusion list

---

## Architecture

### Backend (`/backend`) — FastAPI

```
backend/
├── main.py                  # App entrypoint, mounts all routers + CORS
├── routes/                  # sast, secrets, reports, findings, projects,
│                             # compliance, auth
├── scanners/                # semgrep_runner, trivy_runner, iac_scanner
├── secret_detection/        # in-house entropy + regex secret scanner
├── parsers/                 # normalize each tool's output -> shared Finding
├── models/                  # Finding, ScanRequest pydantic schemas
├── services/                # db_service, git_service, upload_service,
│                             # report_service, auth_service
├── mappings/                # ISO 27001 Annex A control reference data
├── utils/                   # severity.py — shared severity normalizer
└── scripts/                 # backfill_severity.py (one-time DB migration)
```

Four scan modules, one orchestration pattern (inspired by Horusec):

| Module | Tool | 
|---|---|
| SAST | Semgrep |
| SCA (dependencies) | Trivy |
| IaC | Checkov |
| Secrets | Custom entropy + regex scanner |

Every finding, regardless of scanner, is normalized into one shared shape
(title, severity, file, line, CWE, OWASP, ISO 27001 control) so the frontend
treats all four uniformly.

### Frontend (`/secureflow`) — Next.js 14 App Router

15 pages, TypeScript, inline CSS custom properties (no Tailwind), dark
cybersecurity color palette. Pages: homepage, auth flows, dashboard shell,
and module-specific pages for SAST / SCA / IaC / Secrets / Findings /
Projects / Reports / Compliance / Settings (placeholder) / Container
(placeholder) / DAST (placeholder).

---

## Setup

See `Backend.txt` for full backend setup steps (venv, dependencies, Trivy
binary install, environment variables, and the one-time severity backfill
migration).

Frontend:
```
cd secureflow
npm install
npm run dev
```
Visit `http://localhost:3000`. Backend must be running at
`http://127.0.0.1:8000` (hardcoded `BACKEND_URL` constant per-page).

---

## API reference (current)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/sast/scan` | Run Semgrep + Trivy against a GitHub repo URL |
| POST | `/api/sast/scan-local` | Same, against an uploaded ZIP |
| POST | `/api/secrets/scan` / `/scan-local` | Run the secrets scanner |
| GET | `/api/findings` | List findings, filterable by `project_id`, `severity`, `scanner` |
| GET | `/api/projects` | List all projects with scan/finding counts |
| GET | `/api/projects/{id}` | Single project |
| GET | `/api/projects/{id}/scans` | Scan history for a project |
| DELETE | `/api/projects/{id}` | Delete a project (cascades scans/findings) |
| GET | `/api/reports` | List completed scans (report-able) |
| GET | `/api/reports/{scan_id}/pdf` | Regenerate ISO 27001 PDF from stored findings |
| POST | `/api/reports/pdf` | Generate a PDF directly from a findings payload |
| GET | `/api/compliance` | Findings grouped by ISO 27001 Annex A control |
| POST | `/api/auth/signup` / `/login` / `/google` | Auth |
| GET | `/api/auth/me` | Current user |

Full interactive docs: `http://127.0.0.1:8000/docs`

---

## Team

4-person intern team, GitHub repo under `BourrBo` (personal account), using
a fork + pull request workflow with branch protection on `main`.

---

## Roadmap

Next up: fixing the two known gaps above, then Phase 3 (Container scanning,
reusing Trivy in `image` mode) → Phase 4 (CI/CD decision layer: severity
threshold + pass/fail exit codes + SARIF output for Jenkins/GitLab) →
Phase 5 (Settings) → Phase 6 (DAST via OWASP ZAP, the only phase requiring
a live running target rather than a repo/ZIP).

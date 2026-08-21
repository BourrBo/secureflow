# SecureFlow

SecureFlow is an application security (AppSec) platform that brings multiple security scanning capabilities into one dashboard and normalizes their results into a common findings model.

It is developed as a B.Tech major internship project at Laati Consulting. The system is built around a FastAPI backend, a Lovable-managed web frontend, and Supabase PostgreSQL for persistent, user-scoped data.

## What SecureFlow does

| Capability | Purpose |
|---|---|
| SAST | Static source-code analysis |
| SCA | Dependency/package vulnerability scanning |
| IaC | Infrastructure-as-code security analysis |
| Secrets | Regex + entropy based secret detection |
| Container | Container image vulnerability scanning |
| DAST | Dynamic web application security testing |
| Compliance | ISO/IEC 27001:2022 Annex A mapping for applicable findings |
| Reports | VAPT-style PDF, JSON and SARIF outputs |
| CI/CD Gate | Pass/fail security decisions for pipelines |
| Integrations | GitHub/GitLab source control and container registries |
| Organizations & Roles | Multi-user organization access control for integrations |

The goal is to make these scanners operate as one product rather than a collection of independent tools.

## Architecture

```text
                     ┌─────────────────────────┐
                     │       SecureFlow UI     │
                     │ React / TanStack / Bun  │
                     │     Lovable-managed     │
                     └────────────┬────────────┘
                                  │ REST
                                  ▼
                     ┌─────────────────────────┐
                     │     FastAPI Backend     │
                     │      Python / Uvicorn   │
                     └───────┬─────────┬───────┘
                             │         │
                  ┌──────────┘         └───────────────┐
                  ▼                                    ▼
        ┌──────────────────┐                 ┌────────────────────┐
        │   Supabase Auth  │                 │ Supabase PostgreSQL│
        │ email + OAuth    │                 │ projects           │
        │ + API keys       │                 │ scans              │
        └──────────────────┘                 │ findings           │
                                             │ gate_runs          │
                                             │ api_keys           │
                                             │ organizations      │
                                             │ integrations       │
                                             └────────────────────┘
                             │
                             ▼
        ┌───────────────────────────────────────────────────────┐
        │                        Scan Layer                     │
        │ Semgrep  Trivy  Checkov  Secrets  OWASP ZAP  Registry │
        └───────────────────────────────────────────────────────┘
```

## Project sources

### GitHub

Current backend repository:

`https://github.com/BourrBo/secureflow`

The `main` branch is the authoritative Git source for backend code.

### Lovable

Current frontend project:

- Project ID: `3418111a-32b7-4c0f-8a4f-6ea92ef21a06`
- Live app: `secureflow-laati.lovable.app`

Frontend stack:

- React
- TanStack Router
- React Query
- shadcn/ui
- Tailwind
- Bun

### Supabase

Current database:

- Project ID: `avxucyqiwzgrvxaobjxf`
- PostgreSQL
- Supabase Auth
- Row Level Security

### Local development

The backend is developed on Windows from:

```text
D:\secureflow\backend
```

Typical command:

```powershell
cd D:\secureflow\backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

ZAP is bundled locally at:

```text
D:\secureflow\Tools\ZAP\Zed Attack Proxy\zap.bat
```

The backend can automatically start ZAP when required.

# Scanner architecture

## SAST

Semgrep is executed through the backend scanner runner. Its output is normalized into the shared finding model and persisted under the authenticated user's project and scan.

## SCA

Trivy scans project dependencies and can produce:

- ecosystem
- installed version
- fixed version
- CVE
- CVSS
- EPSS when available
- severity

## IaC

Checkov-based scanning evaluates infrastructure-as-code configuration and normalizes findings with rule/location/severity/compliance metadata.

## Secrets

SecureFlow uses a custom entropy + regex detector. Secrets findings are scanner-specific and should not be forced into SCA-only fields such as CVE or EPSS.

## Container

Trivy image scanning provides container vulnerability data and, when available, CVE/CVSS/EPSS information.

## DAST

OWASP ZAP 2.17.0 is used for dynamic application security testing.

Current DAST behavior includes:

- ZAP automatic startup
- fresh ZAP session per scan
- traditional spider
- passive analysis
- AJAX spider for the full scope
- active scanning
- queued/running/completed/failed/cancelled/timed-out states
- persisted progress telemetry
- scanner coverage telemetry
- cancellation
- SSRF target validation
- 4-hour safety ceiling
- Windows sleep prevention for long scans
- background execution so dashboard navigation does not terminate a running scan

### Attack strength

Attack strength is independent from scan scope:

```text
LOW
MEDIUM
HIGH
INSANE
```

`MEDIUM` is the safe default. `INSANE` must be selected deliberately because it can generate tens of thousands of requests and can run for hours.

Recent main-branch DAST work includes:

- `f5b9feb6` — DAST updates for the previous 0% progress issue
- `75ed8e19` — DAST updates and UI changes
- `6d8aafd2` — attack strength added to DAST
- `bce3226c` — findings section update

# Findings model

All scanner outputs are normalized into a shared persistence model so SecureFlow can provide consistent filtering/reporting while still preserving scanner-specific metadata.

Core fields include:

```text
id
user_id
scan_id
project_id
scanner
title
description
severity
rule
file
line
cwe
owasp
ecosystem
installed_version
fixed_version
cve
cvss
epss_score
recommendation
iso27001_control
iso27001_control_name
iso27001_description
code_context
fingerprint
unique_id_from_tool
duplicate_of
status
owner
notes
first_seen_at
last_seen_at
```

Not every field applies to every scanner.

The UI should therefore be scanner-aware instead of displaying meaningless `N/A` columns:

```text
SCA / Container
  CVE / CVSS / EPSS / ecosystem / versions

SAST
  rule / file / line / CWE / OWASP / severity / ISO

Secrets
  secret type / location / evidence / severity / ISO

IaC
  rule / location / category / severity / ISO

DAST
  alert / target / evidence / CWE / OWASP / severity / ISO
```

# Database

SecureFlow uses Supabase PostgreSQL rather than the earlier SQLite implementation.

Core tables include:

```text
projects
scans
findings
api_keys
gate_runs

sf_organizations
sf_organization_members
sf_integrations
sf_api_keys
sf_oauth_states
```

The main ownership hierarchy is:

```text
User
 └── Projects
      └── Scans
           └── Findings
```

Core application tables use `user_id` ownership and RLS.

Organization/integration data uses organization membership and role checks plus RLS.

## Workspace reset

SecureFlow supports an explicit full workspace reset for the authenticated user.

The reset removes:

```text
findings
scans
projects
```

in dependency order.

The frontend also clears:

- React Query cache
- scan-result state
- selected organization
- selected project/scan
- filters
- URL-scoped IDs

Numeric PostgreSQL identity counters are separate from data existence. A complete reset can safely reset sequences only when the corresponding table is globally empty; they must never be reset while another user's rows remain.

# Organizations and roles

The integrations subsystem supports:

```text
Owner
Admin
Security
Viewer
```

These roles control access to integrations, API keys, settings, members, scanning and read-only views.

The backend is the authority for permissions. Frontend visibility is not an authorization mechanism.

Organization lifecycle:

```text
Create
  ↓
Switch
  ↓
Use integrations
  ↓
Delete
  ↓
If last organization:
  → empty/fresh organization state
```

The application must never keep requesting a deleted or unauthorized organization ID.

# Source-control integrations

The integrations subsystem is mounted under:

```text
/integrations
```

It provides GitHub and GitLab adapters.

Typical flow:

```text
OAuth
  ↓
Organization
  ↓
Browse repositories
  ↓
Select repository
  ↓
Persist selection
  ↓
Run scanners
  ↓
Create/reuse project
  ↓
Create scan
  ↓
Persist findings
```

Third-party credentials are encrypted and must not be exposed in ordinary API responses.

OAuth state is short-lived and single-use. The organization used to start OAuth must remain the organization used after the callback.

# Container registries

Registry integrations support:

- Docker Hub
- GHCR
- ECR

Credentials are validated against the provider before the integration is marked connected.

The selected registry image can then be scanned by the container/Trivy pipeline.

# Authentication

Dashboard authentication uses Supabase Auth.

CI/CD callers can additionally authenticate with:

```http
X-API-Key: <generated-key>
```

API keys are:

- generated server-side
- shown once at creation
- stored as hashes
- revocable
- user scoped
- optionally project scoped

# CI/CD security gate

SecureFlow provides a security decision layer for CI/CD.

The gate can:

1. evaluate findings
2. apply a severity threshold
3. return pass/fail
4. persist gate history
5. expose SARIF

SecureFlow does not perform the deployment itself. The external CI/CD system decides whether to block or continue.

Available security outputs include:

```text
JSON
SARIF 2.1.0
PDF
```

Conceptually:

```text
CI pipeline
   ↓
SecureFlow gate API
   ↓
Findings evaluated
   ↓
PASS / FAIL
   ↓
CI decides whether to continue
```

# Compliance

SecureFlow maps applicable scanner findings to ISO/IEC 27001:2022 Annex A controls.

The compliance view provides:

- score
- control breakdown
- finding counts by control
- severity mix
- CSV export

The compliance score is a technical security-posture indicator based on controls the scanners can observe; it is not a substitute for a formal ISO 27001 audit.

# Reporting

SecureFlow generates VAPT-style security reports from persisted findings.

The report flow supports PDF generation plus structured JSON/SARIF exports.

The PDF report layout is branded for Laati Consulting and includes security findings and applicable compliance mappings.

The report service also contains safeguards for unusually large finding fields that previously caused ReportLab layout failures.

# Frontend behavior

Important frontend behavior includes:

- real API-backed dashboard data
- React Query cache
- paginated Findings
- server-side Findings search
- project-specific findings and scans
- scanner-aware Finding metadata
- persistent scan results across dashboard navigation
- persistent DAST scan state
- navigation-safe DAST polling
- organization-aware integrations
- workspace reset that clears persisted frontend state
- themed notifications and warnings
- scanner-specific detail views

The frontend should never display stale scan data after a destructive reset.

# CI and code quality

The backend repository uses:

- Ruff
- Pytest
- GitHub Actions CI

Established validation workflow:

```text
Edit
 ↓
Python syntax / compile check
 ↓
Ruff
 ↓
Pytest
 ↓
FastAPI TestClient verification where practical
```

A real dependency-free test suite was added because the older scanner scripts were live/manual scripts and were unsuitable for reliable CI collection.

# Security principles

SecureFlow is itself an AppSec product, so security requirements apply to the platform too.

## Secrets

Never commit:

```text
.env
.env.*
database passwords
OAuth client secrets
INTEGRATIONS_ENCRYPTION_KEY
API keys
```

Use example environment files with placeholders.

Any credential that has already been exposed must be rotated.

## User isolation

Every project, scan and finding operation must verify the authenticated owner.

Never trust a client-supplied project/scan ID without authorization.

## Organization isolation

Organization permissions must be enforced on the backend.

## DAST SSRF protection

DAST must not become an SSRF primitive. Private/loopback/internal targets and cloud metadata endpoints must be controlled according to the deployment policy.

## Temporary files

Temporary repositories and scan artifacts must be cleaned up. Windows file locking can cause cleanup failures, so failures should be retried and logged rather than silently ignored.

# Current GitHub history

Recent main-branch commits relevant to the current product state:

| Commit | Purpose |
|---|---|
| `bce3226c` | Findings section update |
| `6d8aafd2` | Attack strength added to DAST |
| `75ed8e19` | DAST updates and UI changes |
| `f5b9feb6` | DAST updates for the previous 0% progress issue |
| `145394d1` | Tools added |
| `091435f3` | GitHub integration update for project support |
| `f241a675` | Git integration updates |
| `3607f928` | Docker warning update |
| `2844d49e` | Docker + EPSS fixes |
| `34ea977a` | Docker changes + frontend update |
| `f28b6a45` | Findings section delete-all option |
| `f429885d` | SCA fixes |

The old repository README is stale and describes SQLite/Next.js plus unfinished DAST/CI/CD phases. This document is intended to replace that historical description with the current architecture and behavior.

# Important project history

The following old archives are not authoritative:

- `secureflow-main.7z`
- `github.rar`
- older teammate snapshots

They were identified as stale or structurally different from the current application.

Authoritative sources are:

1. current GitHub `main`
2. current Lovable project
3. current Supabase project
4. explicitly verified local changes

Do not overwrite current code with an old archive simply because it contains a familiar feature.

# Current open work

The main remaining engineering items include:

1. Cross-engine finding deduplication — safe fingerprint-based logic should be adapted to the live schema; stale archive implementations must not be merged wholesale.
2. Production deployment — Docker support exists, but production deployment, reverse proxy, secrets, long-running jobs and Linux/ZAP behavior still require deliberate verification.
3. Repository secret cleanup — previously committed environment files/credentials need to be removed from tracking and exposed credentials rotated.
4. DAST long-running verification — continue validating controlled targets, cancellation, timeout, restart recovery and navigation persistence.
5. Windows temporary-repository cleanup — retry/logging exists, but cleanup should continue to be monitored.
6. Frontend/backend live connectivity — local backend and cloud frontend need a correctly configured reachable URL/tunnel during local development.

# Development conventions

When changing SecureFlow:

- Inspect the current GitHub `main` before trusting older handovers or archives.
- Inspect the current Lovable project before changing frontend contracts.
- Inspect the actual live Supabase schema before changing persistence code.
- Preserve working DAST and security behavior.
- Make the smallest verifiable change.
- Verify backend changes with syntax checks, Ruff, tests and FastAPI TestClient where practical.
- Verify Lovable changes with its typecheck/build flow.
- Never merge a teammate archive directly without comparing it to current main.
- Never expose credentials in source, reports or logs.

## Project principle

> SecureFlow should behave like a real security product: real backend state, real persistence, explicit authorization, truthful UI, scanner-aware data, meaningful tests, observable failures, and no unsupported product claims.

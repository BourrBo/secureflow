# SecureFlow

SecureFlow is an enterprise application security platform that aggregates multiple security scanners — static analysis, dependency scanning, infrastructure-as-code scanning, and secret detection — into a single unified dashboard.

A FastAPI backend orchestrates the underlying scanning tools and normalizes their output into one shared finding format. A Next.js frontend presents results per scanner, with a unified `Finding` shape so every module behaves consistently (same severity scale, same filtering, same table layout).

## Current status

Four scanning modules are built and working end-to-end (backend + frontend, both verified against real repositories with real findings):

| Module | Tool | What it scans |
|---|---|---|
| **SAST** | [Semgrep](https://semgrep.dev/) | Your own source code, for vulnerability patterns (SQL injection, XSS, insecure requests, etc.) |
| **SCA** | [Trivy](https://aquasecurity.github.io/trivy/) | Dependency manifests/lockfiles (`package-lock.json`, `requirements.txt`, etc.) for known CVEs |
| **IaC** | [Checkov](https://www.checkov.io/) | Terraform, CloudFormation, Kubernetes, and Dockerfile misconfigurations |
| **Secrets** | Custom regex + entropy engine | Hardcoded credentials — AWS keys, GitHub/GitLab/Slack/Stripe/OpenAI tokens, private keys, JWTs, DB connection strings, plus generic high-entropy string detection for anything not matching a known vendor format |

Remaining dashboard pages (Container Scan, DAST, Compliance, Projects, Reports, Settings) are still UI-only placeholders with hardcoded mock data — not yet wired to a backend.

## Architecture

```
secureflow/
├── backend/                  FastAPI backend
│   ├── main.py                App entrypoint, CORS, router registration
│   ├── models/
│   │   ├── finding.py          Shared Finding schema used by all 4 scanners
│   │   └── scan_request.py     Request body for GitHub-URL-based scans
│   ├── routes/
│   │   ├── sast.py              /api/sast/*  and /api/iac/*  endpoints
│   │   └── secrets.py           /api/secrets/* endpoints
│   ├── scanners/                Thin subprocess wrappers around each CLI tool
│   │   ├── semgrep_runner.py
│   │   ├── trivy_runner.py
│   │   └── iac_scanner.py        (runs Checkov)
│   ├── secret_detection/         Custom-built scanner (no external CLI dependency)
│   │   ├── rules.py               14 vendor-specific regex patterns
│   │   ├── entropy.py             Shannon entropy scoring for unknown secret formats
│   │   └── scanner.py             Directory walker + finding orchestration
│   ├── parsers/                  Normalize each tool's raw output into the shared Finding shape
│   │   ├── semgrep_parser.py
│   │   ├── trivy_parser.py
│   │   ├── iac_parser.py
│   │   └── secrets_parser.py
│   └── services/
│       ├── git_service.py         Clones a GitHub repo into backend/tmp_scans/
│       └── upload_service.py      Extracts an uploaded .zip into backend/tmp_scans/
│
└── secureflow/                app/ (Next.js)
    └── app/dashboard/
        ├── sast/page.tsx
        ├── sca/page.tsx
        ├── iac/page.tsx
        ├── secrets/page.tsx
        └── findings/[id]/page.tsx   Shared finding detail view
```

## The shared `Finding` model

Every scanner's raw output gets normalized into the same shape before it reaches the frontend, so the UI doesn't need scanner-specific logic to render results:

```python
class Finding(BaseModel):
    title: str
    severity: str          # scanner-specific scale, mapped per-scanner on the frontend
    file: str
    line: int
    description: str
    rule: str               # e.g. a Semgrep rule ID, a CVE, a Checkov check ID, or a secret rule ID
    cwe: str = "CWE-000"
    owasp: str = "A05:2021"
    scanner: str = "semgrep"  # "semgrep" | "trivy" | "checkov" | "secrets"
    code_context: List[CodeLine] = []
    # SCA-only fields, left null for everything else
    installed_version: Optional[str] = None
    fixed_version: Optional[str] = None
    cvss: Optional[float] = None
    ecosystem: Optional[str] = None
```

Each frontend dashboard page calls the same scan endpoint pattern, then filters the response by `scanner` to show only the findings relevant to that page (e.g. the SCA page keeps only `scanner === "trivy"`).

## API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/sast/scan` | Clone a GitHub repo, run Semgrep + Trivy, return merged findings |
| `POST` | `/api/sast/scan-local` | Same, from an uploaded `.zip` |
| `POST` | `/api/iac/scan` | Clone a GitHub repo, run Checkov, return findings |
| `POST` | `/api/iac/scan-local` | Same, from an uploaded `.zip` |
| `POST` | `/api/secrets/scan` | Clone a GitHub repo, run the secret scanner, return findings |
| `POST` | `/api/secrets/scan-local` | Same, from an uploaded `.zip` |
| `GET` | `/` | Health check |

Interactive API docs (Swagger UI) are available at `/docs` once the backend is running.

## Local setup

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

pip install fastapi "uvicorn[standard]" pydantic python-multipart gitpython semgrep checkov
```

Trivy is installed separately (it's a standalone binary, not a pip package):

- **Windows:** `winget install AquaSecurity.trivy`
- **Linux/WSL2:** `curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin`

Run the server:

```bash
uvicorn main:app --reload
```

Backend runs at `http://127.0.0.1:8000`. Swagger UI at `http://127.0.0.1:8000/docs`.

### Frontend

```bash
cd secureflow
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.

## Known environment notes

- **Windows Smart App Control** has been observed blocking Semgrep's bundled executable (`WinError 4551`). If scans fail with no output and this error, either disable Smart App Control (Settings → Privacy & security → Windows Security → App & browser control), or develop inside **WSL2**, where this restriction doesn't apply.
- All cloned repos and extracted uploads are written to `backend/tmp_scans/`, anchored to the backend's own drive — this avoids a cross-drive `os.path.relpath()` failure in Checkov that occurs when system temp folders default to a different drive than the project.
- `backend/tmp_scans/` should be excluded from version control (`.gitignore`) — it's scratch space, regenerated on every scan.

## Roadmap

- **CI/CD integration**: a `/api/*/scan-ci` style ingestion endpoint so scans run automatically in a company's own GitHub Actions pipeline rather than requiring a manual paste-and-click in the dashboard. Requires:
  - API key issuance per company/account
  - Persistent storage (scans + findings tied to a repo/branch/commit over time) — currently every scan is stateless and in-memory only
- Container image scanning (Trivy supports this already; not yet wired into a route)
- DAST module
- Wiring the remaining dashboard pages (Compliance, Projects, Reports) to real data once persistence exists

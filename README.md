# SecureFlow Backend

Backend for **SecureFlow** — an Enterprise Application Security (AppSec) platform that scans code repositories for security vulnerabilities. This backend currently powers the **SAST (Static Application Security Testing)** module, with **Secrets Detection** in progress.

The backend follows an **orchestrator pattern**: instead of building scanners from scratch, it calls existing open-source security tools (Semgrep, Gitleaks) as subprocesses, parses their JSON output, and serves it to the SecureFlow frontend via a REST API.

---

## Architecture

```
SecureFlow Frontend (Next.js)
        ↓  HTTP request
FastAPI Backend  ──────────────►  Clones target GitHub repo
        ↓
   Runs scanner binary (Semgrep / Gitleaks)
        ↓
   Parses JSON output
        ↓
   Returns findings to frontend
        ↓
Frontend dashboard renders results
```

No scanner code is modified or copied — each tool is installed independently and invoked via subprocess, the same approach used by Horusec and DefectDojo.

---

## Tech Stack

| Layer | Tool |
|---|---|
| API framework | FastAPI |
| Server | Uvicorn |
| SAST scanner | Semgrep |
| Secrets scanner | Gitleaks |
| Repo cloning | GitPython |
| Config | python-dotenv |
| Language | Python 3.11+ |

---

## Project Structure

```
secureflow-backend/
├── main.py                    # FastAPI app entrypoint, registers routers
├── models/
│   ├── finding.py             # Finding data model
│   └── scan_request.py        # Request schema
├── parsers/                   # Normalizes raw scanner output
├── routes/
│   ├── sast.py                # /api/sast/scan endpoint
│   └── secrets.py             # /api/secrets/scan endpoint
├── scanners/
│   └── gitleaks_scanner.py    # Gitleaks subprocess wrapper
├── services/
│   └── semgrep_runner.py      # Clone repo + run Semgrep
├── test_repo/                 # Sample repo used for local testing
├── tmp/                       # Cloned repos land here at scan time
├── .env                       # Environment variables (not committed)
├── requirements.txt
└── venv/                      # Python virtual environment (not committed)
```

---

## Prerequisites

Install these before running the project:

- **Python 3.11+**
- **Git**
- **Semgrep** — installed via pip (see below)
- **Gitleaks** — standalone binary, **not** a pip package ([releases page](https://github.com/gitleaks/gitleaks/releases))

> Gitleaks is feature-complete; its maintainer now only ships security patches. It remains stable and fully usable for this project.

---

## Setup — Windows

### 1. Clone and enter the project
```bash
cd secureflow-backend
```

### 2. Create and activate a virtual environment
```bash
python -m venv venv
venv\Scripts\activate.ps1
or 
.\venv\Scripts\Activate.ps1
```
You should see `(venv)` prefixed in your terminal. If activation fails with a permissions error:
```bash
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 3. Install Python dependencies
```bash
pip install -r requirements.txt
```
Or, if setting up fresh:
```bash
pip install fastapi uvicorn semgrep gitpython python-dotenv
pip freeze > requirements.txt
```

### 4. Install Gitleaks
1. Download `gitleaks_8.30.1_windows_x64.zip` from the [Gitleaks releases page](https://github.com/gitleaks/gitleaks/releases)
2. Extract into `C:\Tools\gitleaks`
3. Add `C:\Tools\gitleaks` to your Windows PATH (Environment Variables → System variables → Path → New)
4. Open a **new** terminal and verify:
```bash
gitleaks version
```

---

## Running the Backend

```bash
venv\Scripts\activate
uvicorn main:app --reload
```

Server starts at:
```
http://127.0.0.1:8000
```

Interactive API docs (Swagger UI) are available at:
```
http://127.0.0.1:8000/docs
```
Use this page to manually trigger scans without needing the frontend running.

---

## API Endpoints

### `POST /api/sast/scan`
Runs a Semgrep SAST scan against a public GitHub repo.

**Request body:**
```json
{
  "repo_url": "https://github.com/juice-shop/juice-shop"
}
```

**Response:**
```json
{
  "status": "success",
  "total": 72,
  "findings": [
    {
      "rule_id": "python.flask.security.xss.reflected-xss",
      "path": "app/routes.py",
      "start": { "line": 42 },
      "severity": "ERROR",
      "message": "Reflected XSS vulnerability detected"
    }
  ]
}
```

### `POST /api/secrets/scan`
Runs a Gitleaks secrets scan against a public GitHub repo.

**Request body:**
```json
{
  "repo_url": "https://github.com/some-org/some-repo"
}
```

**Response:**
```json
{
  "status": "success",
  "total": 3,
  "findings": [ ... ]
}
```

---

## Connecting to the Frontend

The SecureFlow Next.js frontend calls these endpoints directly:

```typescript
const response = await fetch("http://localhost:8000/api/sast/scan", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ repo_url: repoUrl })
});
const data = await response.json();
```

CORS is configured in `main.py` to allow requests from `http://localhost:3000`. Update `allow_origins` there if your frontend runs on a different port or is deployed.

---

## Current Status

| Module | Status |
|---|---|
| SAST (Semgrep) | ✅ Working — live scan, no persistence yet |
| Secrets Detection (Gitleaks) | 🔧 In progress |
| SCA (Dependencies) | ⏳ Not started |
| IaC Security | ⏳ Not started |
| Container Scan | ⏳ Not started |
| DAST | ⏳ Not started |
| Database persistence | ⏳ Not started — findings are currently returned live and not saved |
| Authentication | ⏳ Not started |

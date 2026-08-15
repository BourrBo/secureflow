from dotenv import load_dotenv

load_dotenv()

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from routes.api_keys import router as api_keys_router
from routes.compliance import router as compliance_router
from routes.container import router as container_router
from routes.dast import router as dast_router
from routes.findings import router as findings_router
from routes.gate import router as gate_router
from routes.projects import router as projects_router
from routes.reports import router as reports_router
from routes.sast import router as sast_router
from routes.sca import router as sca_router
from routes.secrets import router as secrets_router
from services.db_service import close_pool, init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

logger = logging.getLogger("secureflow")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────
    init_db()
    logger.info("SecureFlow backend startup complete.")

    yield

    # ── Shutdown ─────────────────────────────────────────────────────
    # Runs on a clean Ctrl+C, or on SIGTERM — which is what Docker sends
    # on `docker compose down`/`docker stop` and what Railway sends before
    # replacing a deployment. Without this, in-flight DB connections were
    # just abandoned when the process died rather than closed cleanly.
    # This does NOT try to wait for in-flight scans to finish — a scan
    # that's mid-run when the container is asked to stop is expected to
    # end up marked "failed" by init_db()'s orphan sweep on the *next*
    # startup, same as a crash. Making shutdown actually wait for scans
    # to finish is a bigger behavior change than "clean up on the way out"
    # and isn't part of this pass.
    logger.info("SecureFlow backend shutting down...")
    close_pool()


app = FastAPI(
    title="SecureFlow API",
    version="0.1.0",
    lifespan=lifespan,
)


# ─────────────────────────────────────────────────────────────────────
# Request logging
# ─────────────────────────────────────────────────────────────────────
# Deliberately minimal — method, path, status, duration. No bodies, no
# headers, no query params (some of those can carry tokens/keys) — this
# is "what happened and roughly how long it took" for a production log
# stream, not a debug trace.

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = (time.monotonic() - start) * 1000
    logger.info(
        "%s %s -> %d (%.1fms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


# ─────────────────────────────────────────────────────────────────────
# CORS
# ─────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://192.168.1.4:8080",
    ],
    allow_origin_regex=(
        r"https://([a-zA-Z0-9-]+--)?secureflow-laati\.lovable\.app"
        r"|https://id-preview--3418111a-32b7-4c0f-8a4f-6ea92ef21a06\.lovable\.app"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────

app.include_router(sast_router)
app.include_router(sca_router)
app.include_router(secrets_router)
app.include_router(reports_router)
app.include_router(container_router)
app.include_router(dast_router)

app.include_router(findings_router)
app.include_router(projects_router)
app.include_router(compliance_router)
app.include_router(api_keys_router)
app.include_router(gate_router)


@app.get("/")
def home():
    return {
        "message": "SecureFlow Backend Running"
    }


@app.get("/health")
def health():
    """Liveness/readiness probe for Docker Compose, Railway, and any
    reverse proxy in front of this service. Deliberately does NOT touch
    the database or any scanner — a slow/unreachable Postgres shouldn't
    make the container report unhealthy and get killed mid-scan. This is
    "is the process up and serving requests", not "is everything downstream
    healthy" — that's a separate, deeper check if it's ever needed."""
    return {"status": "ok"}
from dotenv import load_dotenv

load_dotenv()

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from integrations import store as integrations_store
from integrations.app import app as integrations_app
from integrations.organization_delete import register_organization_delete
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
from services.git_service import sweep_orphaned_scans

# ---------------------------------------------------------
# Environment
# ---------------------------------------------------------
# Not present before this change — everything defaults to today's
# (development) behavior unless APP_ENV=production is set explicitly,
# e.g. as a Railway/production env var. Local dev and docker-compose
# are unaffected unless you opt in.

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
IS_PRODUCTION = APP_ENV == "production"

# ---------------------------------------------------------
# Logging
# ---------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

# Keep third-party HTTP libraries quiet during normal operation.
# Real warnings/errors are still shown.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

logger = logging.getLogger("secureflow")


# ---------------------------------------------------------
# Application lifecycle
# ---------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()

    try:
        removed = sweep_orphaned_scans()

        if removed:
            logger.info(
                "Cleaned up %d leftover tmp_scans director%s.",
                removed,
                "y" if removed == 1 else "ies",
            )

    except Exception:
        # Cleanup should never prevent the API from starting.
        logger.warning(
            "Startup sweep of tmp_scans failed; "
            "leftover temporary directories may remain.",
            exc_info=True,
        )

    try:
        integrations_store.initialize()

    except Exception:
        logger.warning(
            "Integrations service tables were not initialized. "
            "Check integrations/README.md for required environment variables.",
            exc_info=True,
        )

    logger.info("SecureFlow backend startup complete (APP_ENV=%s).", APP_ENV)

    yield

    logger.info("SecureFlow backend shutting down...")
    close_pool()


# ---------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------
# Hardening-review item: /docs, /redoc and /openapi.json are not a
# confirmed VAPT finding, but they're unauthenticated by default and
# reveal the full route/schema surface. In production, turn them off;
# in dev/docker they still work exactly as before.

app = FastAPI(
    title="SecureFlow API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------
# Tightened from allow_methods=["*"] / allow_headers=["*"]: the frontend
# (secureflow/src/lib/api.ts) only ever sends GET/POST/PUT/PATCH/DELETE
# and only ever sets Content-Type, Authorization, X-API-Key, and
# ngrok-skip-browser-warning (sent unconditionally by every request
# helper in api.ts, not just when tunneling through ngrok — omitting it
# here previously broke every preflight with a 400, since Starlette's
# CORSMiddleware rejects the whole preflight if any requested header
# isn't in this list). OPTIONS preflight itself is handled by
# CORSMiddleware and doesn't need to be listed.

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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "ngrok-skip-browser-warning"],
)


# ---------------------------------------------------------
# Security headers
# ---------------------------------------------------------
# Remediates the VAPT report's Missing Security Headers finding
# (CWE-693, CVSS 5.3, Medium) against http://localhost:3000/ — the
# report tested the frontend, but this API had the identical gap, so
# it's fixed at both layers (see secureflow/src/server.ts for the
# frontend side). Applied as top-level HTTP middleware so it wraps every
# response the ASGI stack produces, including the /integrations mounted
# sub-app below.
#
# HSTS is added only when the request actually arrived over HTTPS —
# sending Strict-Transport-Security over plain HTTP (localhost/docker
# dev) does nothing useful and, if a browser ever saw it over a
# same-origin HTTPS deploy by mistake, could pin a host that isn't
# ready for it. Checking request.url.scheme keeps local dev/docker
# (always HTTP) completely unaffected.

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    # X-Frame-Options is the VAPT-named header; frame-ancestors is the
    # modern CSP equivalent honored by current browsers. Sent together
    # for the widest coverage. 'self' matches how the app is actually
    # embedded (it isn't meant to be iframed cross-origin at all).
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers.setdefault(
        "Content-Security-Policy", "frame-ancestors 'self'"
    )
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers.setdefault(
        "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
    )
    if request.url.scheme == "https":
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=63072000; includeSubDomains"
        )
    return response


# ---------------------------------------------------------
# API routes
# ---------------------------------------------------------

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


# ---------------------------------------------------------
# Integrations
# ---------------------------------------------------------

register_organization_delete(integrations_app)
app.mount("/integrations", integrations_app)


# ---------------------------------------------------------
# Basic endpoints
# ---------------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "SecureFlow Backend Running"
    }


@app.get("/health")
def health():
    return {
        "status": "ok"
    }
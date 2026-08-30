from dotenv import load_dotenv

load_dotenv()

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
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

    logger.info("SecureFlow backend startup complete.")

    yield

    logger.info("SecureFlow backend shutting down...")
    close_pool()


# ---------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------

app = FastAPI(
    title="SecureFlow API",
    version="0.1.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

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
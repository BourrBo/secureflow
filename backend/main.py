from dotenv import load_dotenv

load_dotenv()

import logging
import time
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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

logger = logging.getLogger("secureflow")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    try:
        removed = sweep_orphaned_scans()
        if removed:
            logger.info("Cleaned up %d leftover tmp_scans director%s from before this startup.", removed, "y" if removed == 1 else "ies")
    except Exception:
        # Never blocks startup over a cleanup sweep — worst case, disk
        # usage stays as it was; it isn't a reason to refuse to serve traffic.
        logger.warning("Startup sweep of tmp_scans failed — leftover directories may remain.", exc_info=True)
    try:
        integrations_store.initialize()
    except Exception:
        logger.warning(
            "Integrations service tables were not initialized (see integrations/README.md for required env vars).",
            exc_info=True,
        )
    logger.info("SecureFlow backend startup complete.")

    yield

    logger.info("SecureFlow backend shutting down...")
    close_pool()


app = FastAPI(
    title="SecureFlow API",
    version="0.1.0",
    lifespan=lifespan,
)


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

# The integrations service is mounted under /integrations. Register the
# organization-delete endpoint on the same sub-app so Lovable's
# DELETE /integrations/organizations/{id} call is backed by the API.
register_organization_delete(integrations_app)
app.mount("/integrations", integrations_app)


@app.get("/")
def home():
    return {"message": "SecureFlow Backend Running"}


@app.get("/health")
def health():
    return {"status": "ok"}

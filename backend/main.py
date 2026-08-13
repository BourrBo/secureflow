from dotenv import load_dotenv

load_dotenv()

import logging

from fastapi import FastAPI
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
from routes.secrets import router as secrets_router
from services.db_service import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(
    title="SecureFlow API",
    version="0.1.0"
)


@app.on_event("startup")
def on_startup():
    init_db()


# CORS
#
# Lovable serves this project from more than one origin pattern, and which
# one you're on can change without warning: the published domain
# (secureflow-laati.lovable.app), a slug-based preview
# (preview--secureflow-laati.lovable.app), and a UUID-based preview
# (id-preview--<project-id>.lovable.app) have all shown up. CORSMiddleware
# rejects a preflight from any origin not explicitly allowed with a hard
# 400 — not a silent "missing header" — so a hardcoded list of exact
# strings breaks the instant Lovable serves from a variant that isn't on
# it, which is exactly what happened here. allow_origin_regex covers every
# variant of *this* project's domain instead of enumerating them by hand.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://192.168.1.4:8080",
    ],
    allow_origin_regex=r"https://([a-zA-Z0-9-]+--)?secureflow-laati\.lovable\.app"
                        r"|https://id-preview--3418111a-32b7-4c0f-8a4f-6ea92ef21a06\.lovable\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(sast_router)
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
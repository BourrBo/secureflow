from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.sast import router as sast_router
from routes.secrets import router as secrets_router
from routes.reports import router as reports_router
from routes.container import router as container_router
from routes.findings import router as findings_router
from routes.projects import router as projects_router
from routes.compliance import router as compliance_router
from routes.dast import router as dast_router

from services.db_service import init_db

app = FastAPI(
    title="SecureFlow API",
    version="0.1.0"
)


@app.on_event("startup")
def on_startup():
    init_db()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://192.168.1.4:8080"  
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(sast_router)
app.include_router(secrets_router)
app.include_router(reports_router)
app.include_router(container_router)

app.include_router(findings_router)
app.include_router(projects_router)
app.include_router(compliance_router)
app.include_router(dast_router)

@app.get("/")
def home():
    return {
        "message": "SecureFlow Backend Running"
    }
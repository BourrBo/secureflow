from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.sast import router as sast_router
from routes.secrets import router as secrets_router
from routes.reports import router as reports_router

app = FastAPI(
    title="SecureFlow API",
    version="0.1.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(sast_router)
app.include_router(secrets_router)
app.include_router(reports_router)

@app.get("/")
def home():
    return {
        "message": "SecureFlow Backend Running"
    }
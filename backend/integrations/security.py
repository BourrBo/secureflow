"""Auth, encrypted-secret, and API-key primitives for the isolated service."""

from __future__ import annotations

import hashlib
import os
import secrets

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import Header, HTTPException

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")


def _fernet() -> Fernet:
    key = os.getenv("INTEGRATIONS_ENCRYPTION_KEY", "")
    if not key:
        raise RuntimeError("INTEGRATIONS_ENCRYPTION_KEY must be configured")
    return Fernet(key.encode())


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt_secret(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken as exc:
        raise RuntimeError("Stored credential could not be decrypted") from exc


def generate_api_key() -> tuple[str, str, str]:
    raw = "sfk_" + secrets.token_urlsafe(32)
    return raw, raw[:10], hashlib.sha256(raw.encode()).hexdigest()


def hash_api_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def current_user_id(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=503, detail="Authentication is not configured")
    token = authorization.split(" ", 1)[1]
    try:
        response = httpx.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
            timeout=5,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Authentication service unavailable") from exc
    if response.status_code != 200 or not response.json().get("id"):
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return str(response.json()["id"])

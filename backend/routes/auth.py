"""
routes/auth.py

Implements exactly the contract the frontend's src/lib/api.ts already
expects:
    POST /api/auth/signup  {email, password, first_name?, last_name?} -> AuthResponse
    POST /api/auth/login   {email, password}                          -> AuthResponse
    POST /api/auth/google  {credential}                                -> AuthResponse
    GET  /api/auth/me      (Authorization: Bearer <token>)             -> {user}

AuthResponse = {token: str, user: ApiUser}
ApiUser      = {id, email, first_name, last_name, avatar_url}
"""

import logging
import os
import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from google.auth.transport import requests as google_transport_requests
from google.oauth2 import id_token as google_id_token
from pydantic import BaseModel

from services.auth_service import (
    create_access_token,
    get_current_user_id,
    hash_password,
    verify_password,
)
from services.db_service import create_user, get_user_by_email, get_user_by_id

router = APIRouter()

logger = logging.getLogger(__name__)

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")


class SignupRequest(BaseModel):
    email: str
    password: str
    first_name: str | None = None
    last_name: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    credential: str


def _to_api_user(user: dict) -> dict:
    """Strips password_hash and any other internal-only fields before a
    user record ever goes back over the wire."""
    return {
        "id": user["id"],
        "email": user["email"],
        "first_name": user.get("first_name") or "",
        "last_name": user.get("last_name") or "",
        "avatar_url": user.get("avatar_url"),
    }


def _auth_response(user: dict) -> dict:
    return {
        "token": create_access_token(user["id"]),
        "user": _to_api_user(user),
    }


@router.post("/api/auth/signup")
def signup(request: SignupRequest):
    # Not using pydantic's EmailStr here: it requires the email-validator
    # package, which isn't in requirements.txt. This is a deliberately
    # minimal sanity check, not full RFC validation.
    if "@" not in request.email or "." not in request.email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Please enter a valid email address")

    if len(request.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    if get_user_by_email(request.email):
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    try:
        user = create_user(
            email=request.email,
            first_name=request.first_name,
            last_name=request.last_name,
            password_hash=hash_password(request.password),
            auth_provider="local",
        )
    except sqlite3.IntegrityError as exc:
        # Race condition: two signups for the same email landed between the
        # get_user_by_email check above and this insert.
        logger.warning("Signup race condition for %s: %s", request.email, exc)
        raise HTTPException(status_code=409, detail="An account with this email already exists") from exc

    return _auth_response(user)


@router.post("/api/auth/login")
def login(request: LoginRequest):
    user = get_user_by_email(request.email)

    if not user or not user.get("password_hash"):
        # Same generic message whether the email doesn't exist or the
        # account is Google-only (no password) — don't leak which case it is.
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return _auth_response(user)


@router.post("/api/auth/google")
def google_auth(request: GoogleAuthRequest):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=501,
            detail="Google sign-in is not configured on this server (GOOGLE_CLIENT_ID unset)",
        )

    try:
        payload = google_id_token.verify_oauth2_token(
            request.credential,
            google_transport_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError as exc:  # google-auth's documented failure type for a
        # malformed/invalid/expired token — the one exception type this
        # library actually promises to raise for verification failures.
        logger.info("Google credential verification failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid Google credential") from exc

    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Google account has no email")

    user = get_user_by_email(email)
    if not user:
        user = create_user(
            email=email,
            first_name=payload.get("given_name"),
            last_name=payload.get("family_name"),
            avatar_url=payload.get("picture"),
            auth_provider="google",
        )

    return _auth_response(user)


@router.get("/api/auth/me")
def me(user_id: int = Depends(get_current_user_id)):
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"user": _to_api_user(user)}

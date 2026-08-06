"""
services/auth_service.py

Identity now comes from Supabase Auth, not a hand-rolled JWT. The frontend
signs users in directly against Supabase (email/password, Google, and
GitHub are all configured as Supabase Auth providers) and sends the
resulting Supabase access token as `Authorization: Bearer <token>` on every
API call. This module's only job is verifying that token and returning the
user's Supabase UUID.

Verification calls Supabase's own `/auth/v1/user` endpoint with the token
instead of decoding the JWT locally. This is slightly slower (one extra
HTTP round-trip per request) but means:
  - it works for every provider identically (password, Google, GitHub —
    they all mint the same kind of Supabase session token)
  - no JWT signing secret needs to live in this backend's env at all
  - a token Supabase has revoked (e.g. user signed out everywhere) is
    rejected immediately, instead of staying valid until its exp claim
If per-request latency to Supabase becomes a problem, this can be swapped
for local JWT verification using the project's JWT secret — but start here.
"""

import logging
import os

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    logger.warning(
        "SUPABASE_URL / SUPABASE_ANON_KEY are not set — every authenticated "
        "request will fail until they're configured in .env."
    )

_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> str:
    """FastAPI dependency — use as `user_id: str = Depends(get_current_user_id)`
    on any route that requires a signed-in user. Returns the caller's
    Supabase auth UUID (as a string) on success, raises HTTPException(401)
    otherwise."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials

    try:
        response = httpx.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_ANON_KEY,
            },
            timeout=5.0,
        )
    except httpx.HTTPError as exc:
        logger.error("Supabase auth check failed: %s", exc)
        raise HTTPException(status_code=503, detail="Auth service unavailable") from exc

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    user = response.json()
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    return user_id


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> dict:
    """Same as get_current_user_id but returns the full Supabase user object
    (id, email, user_metadata with name/avatar from whichever provider they
    used) — use this where a route needs more than just the id, e.g. /me."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials

    try:
        response = httpx.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_ANON_KEY,
            },
            timeout=5.0,
        )
    except httpx.HTTPError as exc:
        logger.error("Supabase auth check failed: %s", exc)
        raise HTTPException(status_code=503, detail="Auth service unavailable") from exc

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    return response.json()

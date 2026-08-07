"""
services/auth_service.py

Identity comes from Supabase Auth, not a hand-rolled JWT. The frontend
signs users in directly against Supabase (email/password, Google, and
GitHub are all configured as Supabase Auth providers) and sends the
resulting Supabase access token as `Authorization: Bearer <token>` on every
API call. This module verifies that token, enforces the business-email-only
policy, and returns the user's Supabase UUID.

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

Business-email-only policy: the frontend also checks this right after
sign-in for a fast, friendly error message, but that check is easy to
bypass (it's just JS). The enforcement that actually matters is here —
every authenticated request re-validates the caller's email domain, so a
personal-email account can't reach any API route even if it somehow got a
valid Supabase session (e.g. signed up before this policy existed).
"""

import logging
import os

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from utils.business_email import is_business_email

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    logger.warning(
        "SUPABASE_URL / SUPABASE_ANON_KEY are not set — every authenticated "
        "request will fail until they're configured in .env."
    )

_bearer_scheme = HTTPBearer(auto_error=False)

_BUSINESS_EMAIL_ERROR = (
    "SecureFlow requires a business/company email address. "
    "Please sign in with your work account."
)


def _fetch_supabase_user(token: str) -> dict:
    """Shared by both dependencies below: verifies the token against
    Supabase and enforces the business-email policy. Raises HTTPException
    on any failure."""
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

    if not is_business_email(user.get("email")):
        logger.info("Rejected personal-email sign-in attempt: %s", user.get("email"))
        raise HTTPException(status_code=403, detail=_BUSINESS_EMAIL_ERROR)

    return user


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> str:
    """FastAPI dependency — use as `user_id: str = Depends(get_current_user_id)`
    on any route that requires a signed-in user. Returns the caller's
    Supabase auth UUID (as a string) on success, raises HTTPException(401)
    if not signed in / session invalid, or HTTPException(403) if the
    account's email isn't a business email."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = _fetch_supabase_user(credentials.credentials)
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

    return _fetch_supabase_user(credentials.credentials)

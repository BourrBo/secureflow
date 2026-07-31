"""
services/auth_service.py

Password hashing (passlib/bcrypt), JWT issuance and verification (PyJWT),
and the get_current_user FastAPI dependency used by protected routes.
"""

import logging
import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext

logger = logging.getLogger(__name__)

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# CI sets JWT_SECRET explicitly (see .github/workflows/ci.yml); local dev
# falls back to a fixed dev-only value so `uvicorn` works out of the box
# without extra setup. This fallback is NOT safe for production — a real
# deployment must set a real JWT_SECRET env var, or every token issued
# becomes forgeable by anyone who reads this source file.
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-only-insecure-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_HOURS = 24 * 7  # 7 days

if JWT_SECRET == "dev-only-insecure-secret-change-me":
    logger.warning(
        "JWT_SECRET is not set — using an insecure dev-only fallback. "
        "Set a real JWT_SECRET env var before deploying anywhere but localhost."
    )

_bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(plain_password: str) -> str:
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return _pwd_context.verify(plain_password, password_hash)
    except ValueError as exc:
        # Malformed/unrecognized hash format — treat as "doesn't match"
        # rather than crashing the login attempt.
        logger.warning("Password hash verification failed to parse: %s", exc)
        return False


def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRES_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> int:
    """Returns the user id encoded in the token, or raises HTTPException(401)."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return int(payload["sub"])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Session expired, please log in again") from exc
    except (jwt.InvalidTokenError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid authentication token") from exc


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> int:
    """FastAPI dependency — use as `user_id: int = Depends(get_current_user_id)`
    on any route that requires a signed-in user."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return decode_access_token(credentials.credentials)

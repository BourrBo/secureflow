"""
routes/auth.py

Signup, login, Google, and GitHub sign-in are no longer handled here — the
frontend talks to Supabase Auth directly (via the supabase-js client) for
all of that, and Supabase issues the session token. This router's only job
is the one thing the frontend still needs from the backend: confirming a
token is valid and returning the user in the shape the UI already expects.

    GET /api/auth/me   (Authorization: Bearer <supabase access token>)
                        -> {user: {id, email, first_name, last_name, avatar_url}}

The old POST /api/auth/signup, /login, and /google endpoints are removed.
If anything on the frontend still calls them, route it to supabase-js's
signUp / signInWithPassword / signInWithOAuth instead.
"""

from fastapi import APIRouter, Depends

from services.auth_service import get_current_user

router = APIRouter()


def _to_api_user(user: dict) -> dict:
    """Maps a Supabase auth user object onto the same shape the frontend
    already renders, pulling name/avatar out of whichever provider set
    them (email/password signup, Google, or GitHub all populate
    user_metadata slightly differently)."""
    metadata = user.get("user_metadata") or {}
    full_name = metadata.get("full_name") or metadata.get("name") or ""
    first_name, _, last_name = full_name.partition(" ")

    return {
        "id": user["id"],
        "email": user.get("email"),
        "first_name": metadata.get("first_name") or first_name or "",
        "last_name": metadata.get("last_name") or last_name or "",
        "avatar_url": metadata.get("avatar_url") or metadata.get("picture"),
    }


@router.get("/api/auth/me")
def me(user: dict = Depends(get_current_user)):
    return {"user": _to_api_user(user)}

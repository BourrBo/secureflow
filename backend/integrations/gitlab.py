"""GitLab OAuth and repository (project) API adapter.

Mirrors integrations/github.py's contract exactly (authorize_settings,
exchange_code, authenticated_user, list_repositories, get_repository,
repository_summary) so the app.py routes wire up symmetrically. Credentials
are accepted from the OAuth provider and returned only to the caller that
persists them encrypted. Public route responses contain selected project
metadata only, never an access token.

Supports gitlab.com by default; set GITLAB_URL to point at a self-hosted
instance instead.
"""

from __future__ import annotations

import os
from urllib.parse import quote

import httpx
from fastapi import HTTPException


def _instance_url() -> str:
    return os.getenv("GITLAB_URL", "https://gitlab.com").rstrip("/")


def _oauth_settings() -> tuple[str, str, str]:
    client_id = os.getenv("GITLAB_CLIENT_ID")
    client_secret = os.getenv("GITLAB_CLIENT_SECRET")
    redirect_uri = os.getenv("GITLAB_REDIRECT_URI")
    if not client_id or not client_secret or not redirect_uri:
        raise HTTPException(status_code=503, detail="GitLab OAuth is not configured")
    return client_id, client_secret, redirect_uri


def authorize_settings() -> tuple[str, str, str]:
    client_id, _, redirect_uri = _oauth_settings()
    return client_id, redirect_uri, _instance_url()


def exchange_code(code: str) -> dict:
    client_id, client_secret, redirect_uri = _oauth_settings()
    try:
        response = httpx.post(
            f"{_instance_url()}/oauth/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            headers={"Accept": "application/json"},
            timeout=10,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="GitLab OAuth service unavailable") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="GitLab rejected the OAuth code")
    payload = response.json()
    if not payload.get("access_token"):
        raise HTTPException(status_code=400, detail="GitLab did not return an access token")
    return payload


def _gitlab_get(path: str, token: str, params: dict | None = None) -> httpx.Response:
    try:
        response = httpx.get(
            f"{_instance_url()}/api/v4{path}",
            headers={"Authorization": f"Bearer {token}"},
            params=params,
            timeout=10,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="GitLab API unavailable") from exc
    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="GitLab connection is no longer authorized")
    if response.status_code == 403:
        raise HTTPException(status_code=403, detail="GitLab denied this request (missing permission)")
    if response.status_code == 429:
        raise HTTPException(status_code=429, detail="GitLab rate limit reached, try again shortly")
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="GitLab API request failed")
    return response


def authenticated_user(token: str) -> dict:
    payload = _gitlab_get("/user", token).json()
    if not payload.get("username"):
        raise HTTPException(status_code=502, detail="GitLab returned an invalid user profile")
    return {"id": payload.get("id"), "login": payload["username"], "avatar_url": payload.get("avatar_url")}


def list_repositories(token: str, page: int, per_page: int) -> list[dict]:
    projects = _gitlab_get(
        "/projects",
        token,
        {"membership": "true", "order_by": "path", "sort": "asc", "page": page, "per_page": per_page},
    ).json()
    return [repository_summary(project) for project in projects]


def get_repository(token: str, full_name: str) -> dict:
    if not full_name or "/" not in full_name:
        raise HTTPException(status_code=400, detail="Repository must be in namespace/name form")
    # GitLab identifies projects by numeric id or URL-encoded "namespace/path".
    encoded_path = quote(full_name, safe="")
    return repository_summary(_gitlab_get(f"/projects/{encoded_path}", token).json())


def repository_summary(repository: dict) -> dict:
    return {
        "id": repository.get("id"),
        "full_name": repository.get("path_with_namespace"),
        "name": repository.get("name"),
        "private": repository.get("visibility") != "public",
        "default_branch": repository.get("default_branch"),
        "html_url": repository.get("web_url"),
        "clone_url": repository.get("http_url_to_repo"),
    }

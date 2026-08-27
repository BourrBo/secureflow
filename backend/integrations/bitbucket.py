"""Bitbucket Cloud OAuth and repository API adapter.

Mirrors integrations/github.py and integrations/gitlab.py's contract
exactly (authorize_settings, exchange_code, authenticated_user,
list_repositories, get_repository, repository_summary) so the app.py
routes wire up symmetrically. Credentials are accepted from the OAuth
provider and returned only to the caller that persists them encrypted.
Public route responses contain selected repository metadata only, never
an access token.

Bitbucket Cloud only (api.bitbucket.org) — Bitbucket Server/Data Center
is out of scope.
"""

from __future__ import annotations

import os

import httpx
from fastapi import HTTPException

BITBUCKET_API_URL = "https://api.bitbucket.org/2.0"
BITBUCKET_AUTHORIZE_URL = "https://bitbucket.org/site/oauth2/authorize"
BITBUCKET_TOKEN_URL = "https://bitbucket.org/site/oauth2/access_token"


def _oauth_settings() -> tuple[str, str, str]:
    client_id = os.getenv("BITBUCKET_CLIENT_ID")
    client_secret = os.getenv("BITBUCKET_CLIENT_SECRET")
    redirect_uri = os.getenv("BITBUCKET_REDIRECT_URI")
    if not client_id or not client_secret or not redirect_uri:
        raise HTTPException(status_code=503, detail="Bitbucket OAuth is not configured")
    return client_id, client_secret, redirect_uri


def authorize_settings() -> tuple[str, str]:
    client_id, _, redirect_uri = _oauth_settings()
    return client_id, redirect_uri


def exchange_code(code: str) -> dict:
    client_id, client_secret, redirect_uri = _oauth_settings()
    try:
        response = httpx.post(
            BITBUCKET_TOKEN_URL,
            data={"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri},
            auth=(client_id, client_secret),
            headers={"Accept": "application/json"},
            timeout=10,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Bitbucket OAuth service unavailable") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="Bitbucket rejected the OAuth code")
    payload = response.json()
    if not payload.get("access_token"):
        raise HTTPException(status_code=400, detail="Bitbucket did not return an access token")
    return payload


def _bitbucket_get(path: str, token: str, params: dict | None = None) -> httpx.Response:
    try:
        response = httpx.get(
            f"{BITBUCKET_API_URL}{path}",
            headers={"Authorization": f"Bearer {token}"},
            params=params,
            timeout=10,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Bitbucket API unavailable") from exc
    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="Bitbucket connection is no longer authorized")
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Bitbucket API request failed")
    return response


def authenticated_user(token: str) -> dict:
    payload = _bitbucket_get("/user", token).json()
    if not payload.get("username"):
        raise HTTPException(status_code=502, detail="Bitbucket returned an invalid user profile")
    avatar = payload.get("links", {}).get("avatar", {}).get("href")
    return {"id": payload.get("uuid"), "login": payload["username"], "avatar_url": avatar}


def list_repositories(token: str, page: int, per_page: int) -> list[dict]:
    # /user/permissions/repositories lists every repo the token's user has
    # access to across all workspaces in one call, unlike the workspace-
    # scoped /repositories/{workspace} endpoint.
    payload = _bitbucket_get(
        "/user/permissions/repositories",
        token,
        {"page": page, "pagelen": per_page},
    ).json()
    return [repository_summary(entry["repository"]) for entry in payload.get("values", []) if entry.get("repository")]


def get_repository(token: str, full_name: str) -> dict:
    workspace, separator, repo_slug = full_name.partition("/")
    if not separator or not workspace or not repo_slug or "/" in repo_slug:
        raise HTTPException(status_code=400, detail="Repository must be in workspace/repo_slug form")
    return repository_summary(_bitbucket_get(f"/repositories/{workspace}/{repo_slug}", token).json())


def repository_summary(repository: dict) -> dict:
    links = repository.get("links", {})
    clone_url = next(
        (link.get("href") for link in links.get("clone", []) if link.get("name") == "https"),
        None,
    )
    return {
        "id": repository.get("uuid"),
        "full_name": repository.get("full_name"),
        "name": repository.get("name"),
        "private": bool(repository.get("is_private")),
        "default_branch": (repository.get("mainbranch") or {}).get("name"),
        "html_url": links.get("html", {}).get("href"),
        "clone_url": clone_url,
    }

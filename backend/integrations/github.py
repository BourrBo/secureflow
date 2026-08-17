"""GitHub OAuth and repository API adapter.

Credentials are accepted from the OAuth provider and returned only to the
caller that persists them encrypted. Public route responses contain selected
repository metadata only, never an access token.
"""

from __future__ import annotations

import os

import httpx
from fastapi import HTTPException

GITHUB_API_URL = "https://api.github.com"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"


def _oauth_settings() -> tuple[str, str, str]:
    client_id = os.getenv("GITHUB_CLIENT_ID")
    client_secret = os.getenv("GITHUB_CLIENT_SECRET")
    redirect_uri = os.getenv("GITHUB_REDIRECT_URI")
    if not client_id or not client_secret or not redirect_uri:
        raise HTTPException(status_code=503, detail="GitHub OAuth is not configured")
    return client_id, client_secret, redirect_uri


def authorize_settings() -> tuple[str, str]:
    client_id, _, redirect_uri = _oauth_settings()
    return client_id, redirect_uri


def exchange_code(code: str) -> dict:
    client_id, client_secret, redirect_uri = _oauth_settings()
    try:
        response = httpx.post(
            GITHUB_TOKEN_URL,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
            },
            headers={"Accept": "application/json"},
            timeout=10,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="GitHub OAuth service unavailable") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="GitHub rejected the OAuth code")
    payload = response.json()
    if not payload.get("access_token") or payload.get("error"):
        raise HTTPException(status_code=400, detail="GitHub did not return an access token")
    return payload


def _github_get(path: str, token: str, params: dict | None = None) -> httpx.Response:
    try:
        response = httpx.get(
            f"{GITHUB_API_URL}{path}",
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {token}",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            params=params,
            timeout=10,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="GitHub API unavailable") from exc
    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="GitHub connection is no longer authorized")
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="GitHub API request failed")
    return response


def authenticated_user(token: str) -> dict:
    payload = _github_get("/user", token).json()
    if not payload.get("login"):
        raise HTTPException(status_code=502, detail="GitHub returned an invalid user profile")
    return {"id": payload.get("id"), "login": payload["login"], "avatar_url": payload.get("avatar_url")}


def list_repositories(token: str, page: int, per_page: int) -> list[dict]:
    repositories = _github_get(
        "/user/repos",
        token,
        {"affiliation": "owner,collaborator,organization", "sort": "full_name", "direction": "asc", "page": page, "per_page": per_page},
    ).json()
    return [repository_summary(repo) for repo in repositories]


def get_repository(token: str, full_name: str) -> dict:
    owner, separator, repo = full_name.partition("/")
    if not separator or not owner or not repo or "/" in repo:
        raise HTTPException(status_code=400, detail="Repository must be in owner/name form")
    return repository_summary(_github_get(f"/repos/{owner}/{repo}", token).json())


def repository_summary(repository: dict) -> dict:
    return {
        "id": repository.get("id"),
        "full_name": repository.get("full_name"),
        "name": repository.get("name"),
        "private": bool(repository.get("private")),
        "default_branch": repository.get("default_branch"),
        "html_url": repository.get("html_url"),
        "clone_url": repository.get("clone_url"),
    }

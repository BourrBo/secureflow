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
    if response.status_code == 403:
        raise HTTPException(status_code=403, detail="Bitbucket denied this request (missing permission)")
    if response.status_code == 429:
        raise HTTPException(status_code=429, detail="Bitbucket rate limit reached, try again shortly")
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
    """Bitbucket has no single 'every repo across every workspace' endpoint
    that works for this app's OAuth token type -- confirmed against a real
    connected account, both ways: /user/permissions/repositories 404s, and
    /repositories?role=member (tried first) 410s even for a token that was
    issued moments earlier, so it isn't a stale-token problem either --
    Bitbucket has just removed that query shape for tokens from a classic
    Workspace Settings -> OAuth consumer app.

    The endpoint that's actually documented and works: enumerate the
    workspaces this token's user belongs to, then list repositories in
    each one. `page`/`per_page` paginate the WORKSPACE list (most accounts
    have only a handful, so this is normally a single page); every repo in
    each returned workspace is fetched and flattened into one list, capped
    at a few pages per workspace so an organization with an unusually large
    workspace can't turn one repository-browser click into an unbounded
    number of upstream requests.
    """
    workspaces_payload = _bitbucket_get(
        "/workspaces",
        token,
        {"page": page, "pagelen": per_page},
    ).json()

    repos: list[dict] = []
    for workspace in workspaces_payload.get("values", []):
        slug = workspace.get("slug")
        if not slug:
            continue
        next_path: str | None = f"/repositories/{slug}"
        next_params: dict | None = {"pagelen": 100}
        for _ in range(5):  # cap: 5 pages (<=500 repos) per workspace
            if not next_path:
                break
            repo_payload = _bitbucket_get(next_path, token, next_params).json()
            repos.extend(repository_summary(repo) for repo in repo_payload.get("values", []))
            next_link = repo_payload.get("next")
            if next_link and next_link.startswith(BITBUCKET_API_URL):
                next_path = next_link[len(BITBUCKET_API_URL):]
                next_params = None  # already encoded in next_link's query string
            else:
                next_path = None
    return repos


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

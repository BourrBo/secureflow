"""Isolated integrations and organization-access API.

It is intentionally a separate ASGI application: existing SecureFlow routes
continue operating unchanged until a deliberate deployment decision mounts
or proxies this service.
"""

from __future__ import annotations

import hashlib
import json
import os
import secrets
from typing import Literal
from urllib.parse import urlencode

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from integrations import bitbucket, github, gitlab, registries, store
from integrations.permissions import require_role_permission
from integrations.security import (
    current_user_id,
    decrypt_secret,
    encrypt_secret,
    generate_api_key,
)

# Container image scanning reuses the existing Trivy runner and finding
# pipeline rather than re-implementing them — this is the one deliberate
# exception to this package's usual isolation from the legacy backend,
# because "scan the image" has no meaning as a duplicate implementation.
from parsers.container_parser import normalize_container_findings
from parsers.secrets_parser import normalize_secret_findings
from parsers.semgrep_parser import normalize_findings as normalize_semgrep_findings
from parsers.trivy_parser import normalize_trivy_findings
from scanners.container_runner import run_container_scan
from scanners.semgrep_runner import run_semgrep
from scanners.trivy_runner import run_trivy
from secret_detection.scanner import scan_directory_for_secrets
from services.db_service import (
    create_scan,
    finish_scan,
    get_or_create_project,
    insert_findings,
)
from services.git_service import build_authenticated_url, cleanup_repo, clone_repo

app = FastAPI(title="SecureFlow Integrations", version="1.0.0")

# Mounted as a sub-app under the main FastAPI instance, so it does NOT
# inherit the parent app's CORS middleware — Starlette does not propagate
# middleware to mounted sub-apps. Kept in sync with main.py's allow list.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://192.168.1.4:8080",
    ],
    allow_origin_regex=(
        r"https://([a-zA-Z0-9-]+--)?secureflow-laati\.lovable\.app"
        r"|https://id-preview--3418111a-32b7-4c0f-8a4f-6ea92ef21a06\.lovable\.app"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_SCOPES = {"projects:read", "projects:write", "scans:read", "scans:run", "findings:read", "reports:read", "settings:manage", "integrations:manage"}


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class MemberUpsert(BaseModel):
    user_id: str = Field(min_length=1, max_length=128)
    role: Literal["admin", "security", "viewer"]


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    scopes: list[str] = ["scans:run", "findings:read"]


class RegistryConnect(BaseModel):
    provider: Literal["dockerhub", "ecr", "ghcr"]
    name: str = Field(min_length=1, max_length=100)
    credentials: dict[str, str]


class GitHubRepositorySelection(BaseModel):
    full_name: str = Field(min_length=3, max_length=300)


class GitLabRepositorySelection(BaseModel):
    full_name: str = Field(min_length=3, max_length=300)


class BitbucketRepositorySelection(BaseModel):
    full_name: str = Field(min_length=3, max_length=300)


class RegistryImageSelection(BaseModel):
    repository: str = Field(min_length=1, max_length=300)
    reference_prefix: str = Field(min_length=1, max_length=400)
    tag: str = Field(min_length=1, max_length=200)


class RegistryScanRequest(BaseModel):
    # Optional override; defaults to the integration's previously-selected image.
    reference_prefix: str | None = Field(default=None, max_length=400)
    tag: str | None = Field(default=None, max_length=200)


def _assert(organization_id: int, user_id: str, permission: str) -> None:
    require_role_permission(store.role_for(organization_id, user_id), permission)


def _oauth_result(provider: str, integration: dict | None, error: str | None = None):
    """Send the browser back to the dashboard's Integrations page after an
    OAuth callback. Falls back to a plain JSON body (the original response
    shape) when INTEGRATIONS_FRONTEND_URL isn't configured, so this stays
    usable for direct API testing too."""
    frontend_url = os.getenv("INTEGRATIONS_FRONTEND_URL", "").rstrip("/")
    if not frontend_url:
        if error:
            raise HTTPException(status_code=400, detail=error)
        return {"connected": True, "integration": integration}
    params = {"connected": provider} if not error else {"error": error, "provider": provider}
    return RedirectResponse(f"{frontend_url}/dashboard/integrations?{urlencode(params)}")


@app.on_event("startup")
def startup() -> None:
    store.initialize()


@app.post("/organizations")
def create_organization(payload: OrganizationCreate, user_id: str = Depends(current_user_id)):
    return store.create_organization(payload.name.strip(), user_id)


@app.get("/organizations")
def list_my_organizations(user_id: str = Depends(current_user_id)):
    """Organizations the current user belongs to, for the frontend's
    "Switch organization" picker."""
    return {"organizations": store.list_organizations_for_user(user_id)}


@app.put("/organizations/{organization_id}/members")
def upsert_member(organization_id: int, payload: MemberUpsert, user_id: str = Depends(current_user_id)):
    _assert(organization_id, user_id, "members:manage")
    return store.add_member(organization_id, payload.user_id, payload.role)


@app.post("/organizations/{organization_id}/api-keys")
def create_key(organization_id: int, payload: ApiKeyCreate, user_id: str = Depends(current_user_id)):
    _assert(organization_id, user_id, "api_keys:manage")
    scopes = sorted(set(payload.scopes))
    invalid = set(scopes) - VALID_SCOPES
    if invalid or not scopes:
        raise HTTPException(status_code=400, detail="Key scopes must be non-empty supported scopes")
    raw, prefix, digest = generate_api_key()
    record = store.put_api_key(organization_id, payload.name.strip(), prefix, digest, scopes, user_id)
    return {**record, "key": raw}  # intentionally the only response containing the raw key


@app.get("/organizations/{organization_id}/api-keys")
def get_keys(organization_id: int, user_id: str = Depends(current_user_id)):
    _assert(organization_id, user_id, "api_keys:manage")
    return {"keys": store.list_api_keys(organization_id)}


@app.delete("/organizations/{organization_id}/api-keys/{key_id}")
def revoke_key(organization_id: int, key_id: int, user_id: str = Depends(current_user_id)):
    _assert(organization_id, user_id, "api_keys:manage")
    if not store.revoke_api_key(organization_id, key_id):
        raise HTTPException(status_code=404, detail="API key not found or already revoked")
    return {"revoked": True}


@app.post("/organizations/{organization_id}/registries")
def connect_registry(organization_id: int, payload: RegistryConnect, user_id: str = Depends(current_user_id)):
    _assert(organization_id, user_id, "integrations:manage")
    if not payload.credentials or any(not value for value in payload.credentials.values()):
        raise HTTPException(status_code=400, detail="Registry credentials are required")
    # Credentials are checked against the real provider before anything is
    # persisted — a registry is never marked "connected" on unverified input.
    account = registries.validate_credentials(payload.provider, payload.credentials)
    integration = store.put_integration(
        organization_id,
        payload.provider,
        payload.name.strip(),
        encrypt_secret(json.dumps(payload.credentials)),
        {"credential_fields": sorted(payload.credentials), "account": account},
        user_id,
    )
    return integration


@app.get("/organizations/{organization_id}/integrations/{integration_id}/registries/images")
def registry_images(
    organization_id: int,
    integration_id: int,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
    user_id: str = Depends(current_user_id),
):
    _assert(organization_id, user_id, "integrations:manage")
    integration, credentials = _registry_credentials(organization_id, integration_id)
    return {"images": registries.list_images(integration["provider"], credentials, page, per_page), "page": page, "per_page": per_page}


@app.get("/organizations/{organization_id}/integrations/{integration_id}/registries/images/{repository}/tags")
def registry_image_tags(organization_id: int, integration_id: int, repository: str, user_id: str = Depends(current_user_id)):
    _assert(organization_id, user_id, "integrations:manage")
    integration, credentials = _registry_credentials(organization_id, integration_id)
    return {"tags": registries.list_tags(integration["provider"], credentials, repository)}


@app.put("/organizations/{organization_id}/integrations/{integration_id}/registries/image")
def select_registry_image(
    organization_id: int,
    integration_id: int,
    payload: RegistryImageSelection,
    user_id: str = Depends(current_user_id),
):
    _assert(organization_id, user_id, "integrations:manage")
    integration, _ = _registry_credentials(organization_id, integration_id)
    selected = {"repository": payload.repository, "reference_prefix": payload.reference_prefix, "tag": payload.tag}
    metadata = {**integration["metadata"], "selected_image": selected}
    updated = store.update_integration_metadata(organization_id, integration_id, metadata)
    return {"integration": updated, "selected_image": selected}


@app.post("/organizations/{organization_id}/integrations/{integration_id}/registries/scan")
def scan_registry_image(
    organization_id: int,
    integration_id: int,
    payload: RegistryScanRequest,
    user_id: str = Depends(current_user_id),
):
    _assert(organization_id, user_id, "scans:run")
    integration, credentials = _registry_credentials(organization_id, integration_id)

    selected = integration["metadata"].get("selected_image") or {}
    reference_prefix = payload.reference_prefix or selected.get("reference_prefix")
    tag = payload.tag or selected.get("tag")
    if not reference_prefix or not tag:
        raise HTTPException(status_code=400, detail="No image selected — select an image and tag, or pass one in the request")

    image_ref = f"{reference_prefix}:{tag}"
    env = registries.trivy_env(integration["provider"], credentials)

    project_id = get_or_create_project(user_id, name=image_ref, source_type="upload")
    scan_id = create_scan(user_id, project_id, "container")
    try:
        raw_results = run_container_scan(image_ref, env=env)
        findings = normalize_container_findings(raw_results)
        insert_findings(user_id, scan_id, project_id, findings)
        finish_scan(user_id, scan_id, "completed")
        return {"image": image_ref, "findings": findings}
    except Exception as exc:
        finish_scan(user_id, scan_id, "failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


REGISTRY_PROVIDERS = ("dockerhub", "ecr", "ghcr")


def _registry_credentials(organization_id: int, integration_id: int) -> tuple[dict, dict]:
    integration = store.get_active_integration(organization_id, integration_id, REGISTRY_PROVIDERS)
    if not integration:
        raise HTTPException(status_code=404, detail="Active registry integration not found")
    try:
        credentials = json.loads(decrypt_secret(integration["encrypted_credentials"]))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=500, detail="Stored registry credentials are invalid") from exc
    return integration, credentials


@app.get("/organizations/{organization_id}/integrations")
def get_integrations(organization_id: int, user_id: str = Depends(current_user_id)):
    _assert(organization_id, user_id, "integrations:manage")
    return {"integrations": store.list_integrations(organization_id)}


@app.delete("/organizations/{organization_id}/integrations/{integration_id}")
def disconnect_integration(organization_id: int, integration_id: int, user_id: str = Depends(current_user_id)):
    _assert(organization_id, user_id, "integrations:manage")
    if not store.revoke_integration(organization_id, integration_id):
        raise HTTPException(status_code=404, detail="Integration not found or already revoked")
    return {"revoked": True}


@app.get("/github/authorize")
def github_authorize(organization_id: int = Query(...), user_id: str = Depends(current_user_id)):
    _assert(organization_id, user_id, "integrations:manage")
    client_id, redirect_uri = github.authorize_settings()
    state = secrets.token_urlsafe(32)
    store.put_oauth_state(hashlib.sha256(state.encode()).hexdigest(), organization_id, user_id)
    return {"authorize_url": "https://github.com/login/oauth/authorize?" + urlencode({"client_id": client_id, "redirect_uri": redirect_uri, "scope": "repo read:org", "state": state})}


@app.get("/github/callback")
def github_callback(code: str = Query(..., min_length=1), state: str = Query(..., min_length=1)):
    state_record = store.consume_oauth_state(hashlib.sha256(state.encode()).hexdigest())
    if not state_record:
        return _oauth_result("github", None, error="Invalid, expired, or already-used OAuth state")
    token = github.exchange_code(code)
    account = github.authenticated_user(token["access_token"])
    credentials = {key: token[key] for key in ("access_token", "token_type", "scope") if token.get(key)}
    integration = store.put_integration(
        state_record["organization_id"],
        "github",
        account["login"],
        encrypt_secret(json.dumps(credentials)),
        {"github_account": account},
        state_record["user_id"],
    )
    return _oauth_result("github", integration)


def _github_token(organization_id: int, integration_id: int) -> tuple[dict, str]:
    integration = store.get_active_integration(organization_id, integration_id, "github")
    if not integration:
        raise HTTPException(status_code=404, detail="Active GitHub integration not found")
    try:
        credentials = json.loads(decrypt_secret(integration["encrypted_credentials"]))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=500, detail="Stored GitHub credentials are invalid") from exc
    token = credentials.get("access_token")
    if not token:
        raise HTTPException(status_code=500, detail="Stored GitHub credentials are incomplete")
    return integration, token


@app.get("/organizations/{organization_id}/integrations/{integration_id}/github/repositories")
def github_repositories(
    organization_id: int,
    integration_id: int,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=100, ge=1, le=100),
    user_id: str = Depends(current_user_id),
):
    _assert(organization_id, user_id, "integrations:manage")
    _, token = _github_token(organization_id, integration_id)
    return {"repositories": github.list_repositories(token, page, per_page), "page": page, "per_page": per_page}


@app.put("/organizations/{organization_id}/integrations/{integration_id}/github/repository")
def select_github_repository(
    organization_id: int,
    integration_id: int,
    payload: GitHubRepositorySelection,
    user_id: str = Depends(current_user_id),
):
    _assert(organization_id, user_id, "integrations:manage")
    integration, token = _github_token(organization_id, integration_id)
    repository = github.get_repository(token, payload.full_name)
    metadata = {**integration["metadata"], "selected_repository": repository}
    updated = store.update_integration_metadata(organization_id, integration_id, metadata)
    return {"integration": updated, "repository": repository}


def _scan_selected_repository(organization_id: int, integration: dict, token: str, provider: str, user_id: str) -> dict:
    """Clone the integration's selected repo with the stored OAuth token and
    run the same SAST + SCA + secrets scanners the legacy routes use.

    This is the completion of the GitHub/GitLab "Select repo → Scan" flow —
    the repository README previously described this step as deliberately
    unimplemented pending an authenticated clone adapter; this is that adapter.
    """
    repository = integration["metadata"].get("selected_repository")
    if not repository or not repository.get("clone_url"):
        raise HTTPException(status_code=400, detail="No repository selected for this integration yet")

    clone_url = repository["clone_url"]
    auth_url = build_authenticated_url(clone_url, token, provider)

    project_id = get_or_create_project(user_id, name=repository.get("full_name") or repository.get("name"), source_type="git", repo_url=repository.get("html_url") or clone_url)
    scan_id = create_scan(user_id, project_id, "sast")

    repo_path = None
    try:
        repo_path = clone_repo(auth_url, log_url=clone_url)
        findings = []
        findings += normalize_semgrep_findings(run_semgrep(repo_path))
        findings += normalize_trivy_findings(run_trivy(repo_path))
        findings += normalize_secret_findings(scan_directory_for_secrets(repo_path))
        insert_findings(user_id, scan_id, project_id, findings)
        finish_scan(user_id, scan_id, "completed")
        return {"repository": repository, "findings": findings}
    except Exception as exc:
        finish_scan(user_id, scan_id, "failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        if repo_path:
            cleanup_repo(repo_path)


@app.post("/organizations/{organization_id}/integrations/{integration_id}/github/scan")
def scan_github_repository(organization_id: int, integration_id: int, user_id: str = Depends(current_user_id)):
    _assert(organization_id, user_id, "scans:run")
    integration, token = _github_token(organization_id, integration_id)
    return _scan_selected_repository(organization_id, integration, token, "github", user_id)


@app.post("/organizations/{organization_id}/integrations/{integration_id}/gitlab/scan")
def scan_gitlab_repository(organization_id: int, integration_id: int, user_id: str = Depends(current_user_id)):
    _assert(organization_id, user_id, "scans:run")
    integration, token = _gitlab_token(organization_id, integration_id)
    return _scan_selected_repository(organization_id, integration, token, "gitlab", user_id)


@app.get("/bitbucket/authorize")
def bitbucket_authorize(organization_id: int = Query(...), user_id: str = Depends(current_user_id)):
    _assert(organization_id, user_id, "integrations:manage")
    client_id, redirect_uri = bitbucket.authorize_settings()
    state = secrets.token_urlsafe(32)
    store.put_oauth_state(hashlib.sha256(state.encode()).hexdigest(), organization_id, user_id)
    return {
        "authorize_url": bitbucket.BITBUCKET_AUTHORIZE_URL
        + "?"
        + urlencode({"client_id": client_id, "redirect_uri": redirect_uri, "response_type": "code", "state": state})
    }


@app.get("/bitbucket/callback")
def bitbucket_callback(code: str = Query(..., min_length=1), state: str = Query(..., min_length=1)):
    state_record = store.consume_oauth_state(hashlib.sha256(state.encode()).hexdigest())
    if not state_record:
        return _oauth_result("bitbucket", None, error="Invalid, expired, or already-used OAuth state")
    token = bitbucket.exchange_code(code)
    account = bitbucket.authenticated_user(token["access_token"])
    credentials = {key: token[key] for key in ("access_token", "refresh_token", "token_type", "scopes") if token.get(key)}
    integration = store.put_integration(
        state_record["organization_id"],
        "bitbucket",
        account["login"],
        encrypt_secret(json.dumps(credentials)),
        {"bitbucket_account": account},
        state_record["user_id"],
    )
    return _oauth_result("bitbucket", integration)


def _bitbucket_token(organization_id: int, integration_id: int) -> tuple[dict, str]:
    integration = store.get_active_integration(organization_id, integration_id, "bitbucket")
    if not integration:
        raise HTTPException(status_code=404, detail="Active Bitbucket integration not found")
    try:
        credentials = json.loads(decrypt_secret(integration["encrypted_credentials"]))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=500, detail="Stored Bitbucket credentials are invalid") from exc
    token = credentials.get("access_token")
    if not token:
        raise HTTPException(status_code=500, detail="Stored Bitbucket credentials are incomplete")
    return integration, token


@app.get("/organizations/{organization_id}/integrations/{integration_id}/bitbucket/repositories")
def bitbucket_repositories(
    organization_id: int,
    integration_id: int,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
    user_id: str = Depends(current_user_id),
):
    _assert(organization_id, user_id, "integrations:manage")
    _, token = _bitbucket_token(organization_id, integration_id)
    return {"repositories": bitbucket.list_repositories(token, page, per_page), "page": page, "per_page": per_page}


@app.put("/organizations/{organization_id}/integrations/{integration_id}/bitbucket/repository")
def select_bitbucket_repository(
    organization_id: int,
    integration_id: int,
    payload: BitbucketRepositorySelection,
    user_id: str = Depends(current_user_id),
):
    _assert(organization_id, user_id, "integrations:manage")
    integration, token = _bitbucket_token(organization_id, integration_id)
    repository = bitbucket.get_repository(token, payload.full_name)
    metadata = {**integration["metadata"], "selected_repository": repository}
    updated = store.update_integration_metadata(organization_id, integration_id, metadata)
    return {"integration": updated, "repository": repository}


@app.post("/organizations/{organization_id}/integrations/{integration_id}/bitbucket/scan")
def scan_bitbucket_repository(organization_id: int, integration_id: int, user_id: str = Depends(current_user_id)):
    _assert(organization_id, user_id, "scans:run")
    integration, token = _bitbucket_token(organization_id, integration_id)
    return _scan_selected_repository(organization_id, integration, token, "bitbucket", user_id)


@app.get("/gitlab/authorize")
def gitlab_authorize(organization_id: int = Query(...), user_id: str = Depends(current_user_id)):
    _assert(organization_id, user_id, "integrations:manage")
    client_id, redirect_uri, instance_url = gitlab.authorize_settings()
    state = secrets.token_urlsafe(32)
    store.put_oauth_state(hashlib.sha256(state.encode()).hexdigest(), organization_id, user_id)
    return {
        "authorize_url": f"{instance_url}/oauth/authorize?"
        + urlencode(
            {
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": "read_api read_repository",
                "state": state,
            }
        )
    }


@app.get("/gitlab/callback")
def gitlab_callback(code: str = Query(..., min_length=1), state: str = Query(..., min_length=1)):
    state_record = store.consume_oauth_state(hashlib.sha256(state.encode()).hexdigest())
    if not state_record:
        return _oauth_result("gitlab", None, error="Invalid, expired, or already-used OAuth state")
    token = gitlab.exchange_code(code)
    account = gitlab.authenticated_user(token["access_token"])
    credentials = {key: token[key] for key in ("access_token", "refresh_token", "token_type", "scope") if token.get(key)}
    integration = store.put_integration(
        state_record["organization_id"],
        "gitlab",
        account["login"],
        encrypt_secret(json.dumps(credentials)),
        {"gitlab_account": account},
        state_record["user_id"],
    )
    return _oauth_result("gitlab", integration)


def _gitlab_token(organization_id: int, integration_id: int) -> tuple[dict, str]:
    integration = store.get_active_integration(organization_id, integration_id, "gitlab")
    if not integration:
        raise HTTPException(status_code=404, detail="Active GitLab integration not found")
    try:
        credentials = json.loads(decrypt_secret(integration["encrypted_credentials"]))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=500, detail="Stored GitLab credentials are invalid") from exc
    token = credentials.get("access_token")
    if not token:
        raise HTTPException(status_code=500, detail="Stored GitLab credentials are incomplete")
    return integration, token


@app.get("/organizations/{organization_id}/integrations/{integration_id}/gitlab/repositories")
def gitlab_repositories(
    organization_id: int,
    integration_id: int,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=100, ge=1, le=100),
    user_id: str = Depends(current_user_id),
):
    _assert(organization_id, user_id, "integrations:manage")
    _, token = _gitlab_token(organization_id, integration_id)
    return {"repositories": gitlab.list_repositories(token, page, per_page), "page": page, "per_page": per_page}


@app.put("/organizations/{organization_id}/integrations/{integration_id}/gitlab/repository")
def select_gitlab_repository(
    organization_id: int,
    integration_id: int,
    payload: GitLabRepositorySelection,
    user_id: str = Depends(current_user_id),
):
    _assert(organization_id, user_id, "integrations:manage")
    integration, token = _gitlab_token(organization_id, integration_id)
    repository = gitlab.get_repository(token, payload.full_name)
    metadata = {**integration["metadata"], "selected_repository": repository}
    updated = store.update_integration_metadata(organization_id, integration_id, metadata)
    return {"integration": updated, "repository": repository}

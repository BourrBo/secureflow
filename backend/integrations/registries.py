"""Container registry adapters (Docker Hub, GHCR, ECR).

Each provider exposes the same three operations used by the integrations
routes:

  validate_credentials(credentials) -> dict   # raises HTTPException(400) if invalid
  list_images(credentials, page, per_page) -> list[dict]
  list_tags(credentials, repository) -> list[dict]

...plus ``trivy_env(provider, credentials, repository)`` which turns stored
credentials into the environment variables Trivy needs to pull a private
image. Nothing here ever returns plaintext credentials to a route response;
callers only ever get back registry metadata (repo names, tag names, account
identifiers).
"""

from __future__ import annotations

import httpx
from fastapi import HTTPException

DOCKERHUB_API_URL = "https://hub.docker.com/v2"
GITHUB_API_URL = "https://api.github.com"

REQUIRED_FIELDS = {
    "dockerhub": {"username", "password"},
    "ghcr": {"username", "token"},
    "ecr": {"access_key_id", "secret_access_key", "region"},
}


def require_fields(provider: str, credentials: dict[str, str]) -> None:
    missing = REQUIRED_FIELDS.get(provider, set()) - set(credentials)
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing credential fields: {', '.join(sorted(missing))}")


def validate_credentials(provider: str, credentials: dict[str, str]) -> dict:
    require_fields(provider, credentials)
    if provider == "dockerhub":
        return _validate_dockerhub(credentials)
    if provider == "ghcr":
        return _validate_ghcr(credentials)
    if provider == "ecr":
        return _validate_ecr(credentials)
    raise HTTPException(status_code=400, detail=f"Unsupported registry provider: {provider}")


def list_images(provider: str, credentials: dict[str, str], page: int, per_page: int) -> list[dict]:
    if provider == "dockerhub":
        return _list_dockerhub_images(credentials, page, per_page)
    if provider == "ghcr":
        return _list_ghcr_images(credentials, page, per_page)
    if provider == "ecr":
        return _list_ecr_images(credentials, page, per_page)
    raise HTTPException(status_code=400, detail=f"Unsupported registry provider: {provider}")


def list_tags(provider: str, credentials: dict[str, str], repository: str) -> list[dict]:
    if provider == "dockerhub":
        return _list_dockerhub_tags(credentials, repository)
    if provider == "ghcr":
        return _list_ghcr_tags(credentials, repository)
    if provider == "ecr":
        return _list_ecr_tags(credentials, repository)
    raise HTTPException(status_code=400, detail=f"Unsupported registry provider: {provider}")


def trivy_env(provider: str, credentials: dict[str, str]) -> dict[str, str]:
    """Environment variables Trivy needs to authenticate an image pull.

    ECR is handled natively by Trivy's bundled AWS SDK via the standard
    AWS_* variables; Docker Hub and GHCR both use registry basic-auth.
    """
    if provider == "dockerhub":
        return {"TRIVY_USERNAME": credentials["username"], "TRIVY_PASSWORD": credentials["password"]}
    if provider == "ghcr":
        return {"TRIVY_USERNAME": credentials["username"], "TRIVY_PASSWORD": credentials["token"]}
    if provider == "ecr":
        return {
            "AWS_ACCESS_KEY_ID": credentials["access_key_id"],
            "AWS_SECRET_ACCESS_KEY": credentials["secret_access_key"],
            # Trivy's underlying AWS SDK reads AWS_REGION first; set both so
            # the region resolves regardless of which env var it checks.
            "AWS_REGION": credentials["region"],
            "AWS_DEFAULT_REGION": credentials["region"],
        }
    raise HTTPException(status_code=400, detail=f"Unsupported registry provider: {provider}")


# ── Docker Hub ────────────────────────────────────────────────────────────

def _dockerhub_token(credentials: dict[str, str]) -> str:
    try:
        response = httpx.post(
            f"{DOCKERHUB_API_URL}/users/login/",
            json={"username": credentials["username"], "password": credentials["password"]},
            timeout=10,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Docker Hub is unavailable") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="Docker Hub rejected these credentials")
    token = response.json().get("token")
    if not token:
        raise HTTPException(status_code=502, detail="Docker Hub did not return a session token")
    return token


def _validate_dockerhub(credentials: dict[str, str]) -> dict:
    _dockerhub_token(credentials)
    return {"provider": "dockerhub", "username": credentials["username"]}


def _list_dockerhub_images(credentials: dict[str, str], page: int, per_page: int) -> list[dict]:
    token = _dockerhub_token(credentials)
    namespace = credentials["username"]
    try:
        response = httpx.get(
            f"{DOCKERHUB_API_URL}/repositories/{namespace}/",
            headers={"Authorization": f"JWT {token}"},
            params={"page": page, "page_size": per_page},
            timeout=10,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Docker Hub is unavailable") from exc
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Docker Hub repository list request failed")
    return [
        {
            "name": repo["name"],
            "full_name": f"{namespace}/{repo['name']}",
            "reference_prefix": f"{namespace}/{repo['name']}",
            "private": repo.get("is_private", False),
            "last_updated": repo.get("last_updated"),
        }
        for repo in response.json().get("results", [])
    ]


def _list_dockerhub_tags(credentials: dict[str, str], repository: str) -> list[dict]:
    token = _dockerhub_token(credentials)
    namespace = credentials["username"]
    try:
        response = httpx.get(
            f"{DOCKERHUB_API_URL}/repositories/{namespace}/{repository}/tags",
            headers={"Authorization": f"JWT {token}"},
            params={"page_size": 100},
            timeout=10,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Docker Hub is unavailable") from exc
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Docker Hub tag list request failed")
    return [
        {"tag": tag["name"], "last_updated": tag.get("last_updated"), "digest": tag.get("digest")}
        for tag in response.json().get("results", [])
    ]


# ── GHCR ──────────────────────────────────────────────────────────────────

def _ghcr_get(path: str, token: str, params: dict | None = None) -> httpx.Response:
    try:
        response = httpx.get(
            f"{GITHUB_API_URL}{path}",
            headers={"Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}"},
            params=params,
            timeout=10,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="GitHub Container Registry is unavailable") from exc
    if response.status_code == 401:
        raise HTTPException(status_code=400, detail="GHCR token is invalid or lacks read:packages scope")
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="GHCR request failed")
    return response


def _validate_ghcr(credentials: dict[str, str]) -> dict:
    payload = _ghcr_get("/user", credentials["token"]).json()
    if not payload.get("login"):
        raise HTTPException(status_code=502, detail="GitHub returned an invalid user profile")
    return {"provider": "ghcr", "username": credentials["username"], "github_login": payload["login"]}


def _list_ghcr_images(credentials: dict[str, str], page: int, per_page: int) -> list[dict]:
    packages = _ghcr_get(
        "/user/packages",
        credentials["token"],
        {"package_type": "container", "page": page, "per_page": per_page},
    ).json()
    owner = credentials["username"]
    return [
        {
            "name": pkg["name"],
            "full_name": f"{owner}/{pkg['name']}",
            "reference_prefix": f"ghcr.io/{owner}/{pkg['name']}",
            "private": pkg.get("visibility") == "private",
            "last_updated": pkg.get("updated_at"),
        }
        for pkg in packages
    ]


def _list_ghcr_tags(credentials: dict[str, str], repository: str) -> list[dict]:
    versions = _ghcr_get(
        f"/user/packages/container/{repository}/versions",
        credentials["token"],
        {"per_page": 100},
    ).json()
    tags: list[dict] = []
    for version in versions:
        for tag in version.get("metadata", {}).get("container", {}).get("tags", []):
            tags.append({"tag": tag, "last_updated": version.get("updated_at")})
    return tags


# ── ECR ───────────────────────────────────────────────────────────────────

def _ecr_client(credentials: dict[str, str], service: str):
    try:
        import boto3
        from botocore.exceptions import BotoCoreError, ClientError
    except ImportError as exc:  # pragma: no cover - dependency declared in requirements.txt
        raise HTTPException(status_code=500, detail="ECR support requires boto3 to be installed") from exc

    client = boto3.client(
        service,
        aws_access_key_id=credentials["access_key_id"],
        aws_secret_access_key=credentials["secret_access_key"],
        region_name=credentials["region"],
    )
    return client, (BotoCoreError, ClientError)


def _validate_ecr(credentials: dict[str, str]) -> dict:
    client, errors = _ecr_client(credentials, "sts")
    try:
        identity = client.get_caller_identity()
    except errors as exc:
        raise HTTPException(status_code=400, detail=f"AWS rejected these credentials: {exc}") from exc
    return {"provider": "ecr", "account_id": identity.get("Account"), "arn": identity.get("Arn")}


def _list_ecr_images(credentials: dict[str, str], page: int, per_page: int) -> list[dict]:
    client, errors = _ecr_client(credentials, "ecr")
    try:
        response = client.describe_repositories(maxResults=min(per_page, 1000))
    except errors as exc:
        raise HTTPException(status_code=400, detail=f"AWS rejected this request: {exc}") from exc
    return [
        {
            "name": repo["repositoryName"],
            "full_name": repo["repositoryName"],
            "reference_prefix": repo["repositoryUri"],
            "private": True,
            "last_updated": repo.get("createdAt").isoformat() if repo.get("createdAt") else None,
        }
        for repo in response.get("repositories", [])
    ]


def _list_ecr_tags(credentials: dict[str, str], repository: str) -> list[dict]:
    client, errors = _ecr_client(credentials, "ecr")
    try:
        response = client.list_images(repositoryName=repository, filter={"tagStatus": "TAGGED"})
    except errors as exc:
        raise HTTPException(status_code=400, detail=f"AWS rejected this request: {exc}") from exc
    tags: list[dict] = []
    for image in response.get("imageIds", []):
        if image.get("imageTag"):
            tags.append({"tag": image["imageTag"], "digest": image.get("imageDigest")})
    return tags

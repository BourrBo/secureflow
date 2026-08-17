from fastapi import HTTPException

ROLE_PERMISSIONS = {
    "owner": {"*"},
    "admin": {"projects:read", "projects:write", "scans:read", "scans:run", "findings:read", "reports:read", "settings:manage", "integrations:manage", "members:manage", "api_keys:manage"},
    "security": {"projects:read", "projects:write", "scans:read", "scans:run", "findings:read", "reports:read"},
    "viewer": {"projects:read", "scans:read", "findings:read", "reports:read"},
}


def require_role_permission(role: str | None, permission: str) -> None:
    allowed = ROLE_PERMISSIONS.get(role or "", set())
    if "*" not in allowed and permission not in allowed:
        raise HTTPException(status_code=403, detail="Insufficient organization permission")

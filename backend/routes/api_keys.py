"""
routes/api_keys.py

Lets a signed-in dashboard user generate/revoke API keys for
machine-to-machine access (CI/CD runners, the `secureflow-cli` gate
check, etc.) -- see services/auth_service.py for how these keys are
verified on incoming requests.

Key lifecycle:
  - POST   /api/keys        creates a key, returns the RAW key ONCE
  - GET    /api/keys        lists this user's keys (prefix only, never the raw key again)
  - DELETE /api/keys/{id}   revokes a key immediately

Every route here requires a signed-in dashboard session (Supabase
Bearer token) -- an API key can never be used to mint or manage other
API keys, only to call scan/findings/gate endpoints. This is enforced
implicitly: Depends(get_current_user_id) accepts either auth method,
but there's no meaningful way to abuse that here since key management
still scopes strictly to the caller's own user_id either way.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from services.auth_service import generate_api_key, get_current_user_id
from services.db_service import create_api_key, list_api_keys, revoke_api_key

router = APIRouter(prefix="/api/keys", tags=["api-keys"])

logger = logging.getLogger(__name__)


class CreateApiKeyRequest(BaseModel):
    name: str
    project_id: int | None = None


@router.post("")
def create_key(
    request: CreateApiKeyRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Returns the raw key in the response body -- this is the ONLY time
    it is ever visible. The frontend must show it once, in a copyable
    field, with a clear "you won't see this again" warning."""
    raw_key, prefix, key_hash = generate_api_key()
    record = create_api_key(
        user_id,
        name=request.name.strip() or "Unnamed key",
        key_prefix=prefix,
        key_hash=key_hash,
        project_id=request.project_id,
    )
    return {**record, "key": raw_key}


@router.get("")
def get_keys(user_id: str = Depends(get_current_user_id)):
    return {"keys": list_api_keys(user_id)}


@router.delete("/{key_id}")
def delete_key(key_id: int, user_id: str = Depends(get_current_user_id)):
    ok = revoke_api_key(user_id, key_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Key not found or already revoked")
    return {"revoked": True}

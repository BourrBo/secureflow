"""Organization deletion endpoint for the SecureFlow integrations service.

This is intentionally isolated so the existing integrations routes are not
rewritten. The endpoint is mounted under /integrations by backend/main.py.
"""

from fastapi import Depends, HTTPException

from integrations import store
from integrations.security import current_user_id


def register_organization_delete(app) -> None:
    @app.delete("/organizations/{organization_id}")
    def delete_organization(
        organization_id: int,
        user_id: str = Depends(current_user_id),
    ):
        # Organization deletion is owner-only. Do not rely on the frontend
        # or on an organization id supplied by the caller for authorization.
        role = store.role_for(organization_id, user_id)
        if role is None:
            raise HTTPException(status_code=404, detail="Organization not found")
        if role != "owner":
            raise HTTPException(status_code=403, detail="Only the organization owner can delete the organization")

        # The Supabase migration adds ON DELETE CASCADE to all organization-
        # scoped integration tables. Deleting the parent therefore removes
        # memberships, integrations, API keys and OAuth state atomically.
        with store.db() as conn, conn.cursor() as cur:
            cur.execute(
                "DELETE FROM sf_organizations WHERE id=%s AND owner_user_id=%s RETURNING id",
                (organization_id, user_id),
            )
            deleted = cur.fetchone()

        if not deleted:
            raise HTTPException(status_code=404, detail="Organization not found")

        return {"deleted": True, "organization_id": organization_id}

"""
routes/projects.py

Phase 2 — CRUD/read view over the `projects` table. Projects themselves
are created implicitly by the scan routes (get_or_create_project); this
router only reads and optionally deletes them. Every route requires a
signed-in user and only ever sees/touches that user's own projects.
"""

from fastapi import APIRouter, Depends, HTTPException

from services.auth_service import get_current_user_id
from services.db_service import (
    delete_project,
    get_project,
    get_scans_for_project,
    list_projects,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("")
def get_projects(user_id: str = Depends(get_current_user_id)):
    return {"projects": list_projects(user_id)}


@router.get("/{project_id}")
def get_single_project(project_id: int, user_id: str = Depends(get_current_user_id)):
    project = get_project(user_id, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/{project_id}/scans")
def get_project_scans(project_id: int, user_id: str = Depends(get_current_user_id)):
    project = get_project(user_id, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"project": project, "scans": get_scans_for_project(user_id, project_id)}


@router.delete("/{project_id}")
def remove_project(project_id: int, user_id: str = Depends(get_current_user_id)):
    deleted = delete_project(user_id, project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"status": "deleted", "project_id": project_id}

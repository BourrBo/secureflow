"""
routes/projects.py

Phase 2 — CRUD/read view over the `projects` table. Projects themselves
are created implicitly by the scan routes (get_or_create_project); this
router only reads and optionally deletes them.
"""

from fastapi import APIRouter, HTTPException

from services.db_service import (
    list_projects,
    get_project,
    get_scans_for_project,
    delete_project,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("")
def get_projects():
    return {"projects": list_projects()}


@router.get("/{project_id}")
def get_single_project(project_id: int):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/{project_id}/scans")
def get_project_scans(project_id: int):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"project": project, "scans": get_scans_for_project(project_id)}


@router.delete("/{project_id}")
def remove_project(project_id: int):
    deleted = delete_project(project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"status": "deleted", "project_id": project_id}

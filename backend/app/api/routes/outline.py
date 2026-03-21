from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.api import StoryboardPatchRequest
from app.services.orchestrator import PptAgentService

router = APIRouter(prefix="/projects/{project_id}", tags=["outline"])


def get_service(db: Session = Depends(get_db)) -> PptAgentService:
    return PptAgentService(db)


@router.get("/outline")
def get_outline(
    project_id: str,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.get_outline(project_id)


@router.patch("/outline/storyboard")
def patch_storyboard(
    project_id: str,
    payload: StoryboardPatchRequest,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.patch_storyboard(project_id, payload.model_dump()["parts"])

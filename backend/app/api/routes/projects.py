from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends, Header, Query, Request
from sse_starlette.sse import EventSourceResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.entities import ProjectEvent
from app.schemas.api import MessageCreateRequest, ProjectCreateRequest
from app.services.events import serialize_event
from app.services.orchestrator import PptAgentService

router = APIRouter(prefix="/projects", tags=["projects"])


def get_service(db: Session = Depends(get_db)) -> PptAgentService:
    return PptAgentService(db)


@router.get("")
def list_projects(
    limit: int = Query(default=20, ge=1, le=100),
    service: PptAgentService = Depends(get_service),
) -> dict:
    return {"items": service.list_projects(limit=limit)}


@router.post("")
def create_project(
    payload: ProjectCreateRequest,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.create_project(payload.title, payload.request_text)


@router.get("/{project_id}")
def get_project(
    project_id: str,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.get_project(project_id)


@router.get("/{project_id}/messages")
def get_messages(
    project_id: str,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return {"items": service.list_messages(project_id)}


@router.post("/{project_id}/messages")
def create_message(
    project_id: str,
    payload: MessageCreateRequest,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.create_message(
        project_id=project_id,
        scope_type=payload.scope_type,
        target_page_id=payload.target_page_id,
        ui_surface=payload.ui_surface,
        content_md=payload.content_md,
        attachments=payload.attachments,
    )


@router.get("/{project_id}/events/stream")
async def stream_events(
    project_id: str,
    request: Request,
    db: Session = Depends(get_db),
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
) -> EventSourceResponse:
    start_id = int(last_event_id) if last_event_id and last_event_id.isdigit() else 0

    async def event_generator():
        current_id = start_id
        while True:
            if await request.is_disconnected():
                break
            stmt = (
                select(ProjectEvent)
                .where(ProjectEvent.project_id == project_id, ProjectEvent.stream_id > current_id)
                .order_by(ProjectEvent.stream_id.asc())
                .limit(100)
            )
            events = list(db.scalars(stmt))
            for event in events:
                current_id = event.stream_id
                payload = serialize_event(event)
                yield {
                    "id": str(event.stream_id),
                    "data": json.dumps(payload, ensure_ascii=False),
                }
            await asyncio.sleep(0.25)

    return EventSourceResponse(event_generator())


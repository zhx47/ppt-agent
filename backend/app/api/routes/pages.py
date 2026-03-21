from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.api import BatchActionRequest, ExportCreateRequest, PageActionRequest, PageOutlinePatchRequest, SummaryPatchRequest
from app.services.orchestrator import PptAgentService

router = APIRouter(prefix="/projects/{project_id}", tags=["pages"])


def get_service(db: Session = Depends(get_db)) -> PptAgentService:
    return PptAgentService(db)


@router.get("/pages")
def list_pages(
    project_id: str,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return {"items": service.list_pages(project_id)}


@router.get("/pages/{page_id}")
def get_page(
    project_id: str,
    page_id: str,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.get_page(project_id, page_id)


@router.post("/pages/{page_id}/search-results/{source_id}:retry")
def retry_page_search_result(
    project_id: str,
    page_id: str,
    source_id: str,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.retry_page_search_result(project_id, page_id, source_id)


@router.patch("/pages/{page_id}/outline")
def patch_page_outline(
    project_id: str,
    page_id: str,
    payload: PageOutlinePatchRequest,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.patch_page_outline(project_id, page_id, payload.model_dump())


@router.post("/pages/{page_id}/search-queries:generate")
def generate_page_search_queries(
    project_id: str,
    page_id: str,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.queue_page_action(project_id, page_id, "page_generate_search_queries")


@router.post("/pages/{page_id}/search:run")
def run_page_search(
    project_id: str,
    page_id: str,
    payload: PageActionRequest,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.queue_page_action(
        project_id,
        page_id,
        payload.action_type,
        replace_existing=payload.replace_existing,
    )


@router.post("/pages/{page_id}/summary:generate")
def generate_page_summary(
    project_id: str,
    page_id: str,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.queue_page_action(project_id, page_id, "page_summary_generate")


@router.patch("/pages/{page_id}/summary")
def patch_page_summary(
    project_id: str,
    page_id: str,
    payload: SummaryPatchRequest,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.patch_page_summary(project_id, page_id, payload.summary_md)


@router.post("/pages/{page_id}/draft:generate")
def generate_page_draft(
    project_id: str,
    page_id: str,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.queue_page_action(project_id, page_id, "page_draft_generate")


@router.get("/pages/{page_id}/draft")
def get_page_draft(
    project_id: str,
    page_id: str,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.get_page_draft(project_id, page_id)


@router.post("/pages/{page_id}/design:generate")
def generate_page_design(
    project_id: str,
    page_id: str,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.queue_page_action(project_id, page_id, "page_design_generate")


@router.get("/pages/{page_id}/design")
def get_page_design(
    project_id: str,
    page_id: str,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.get_page_design(project_id, page_id)


@router.post("/actions/batch")
def run_batch_action(
    project_id: str,
    payload: BatchActionRequest,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.queue_batch_action(project_id, payload.action_type)


@router.post("/exports")
def create_export(
    project_id: str,
    payload: ExportCreateRequest,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.create_export(project_id, payload.export_format)


@router.get("/exports/{export_id}")
def get_export(
    project_id: str,
    export_id: str,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.get_export(project_id, export_id)


@router.get("/exports/{export_id}/download")
def download_export(
    project_id: str,
    export_id: str,
    service: PptAgentService = Depends(get_service),
) -> FileResponse:
    file_path = service.get_export_file_path(project_id, export_id)
    filename = service.get_export_download_name(project_id, export_id)
    return FileResponse(file_path, filename=filename)

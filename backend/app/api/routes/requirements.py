from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.api import (
    ConfirmRequest,
    RequirementAnswerPatchRequest,
    RequirementAnswersBatchRequest,
    RequirementQuestionCreateRequest,
    RequirementQuestionPatchRequest,
)
from app.services.orchestrator import PptAgentService

router = APIRouter(prefix="/projects/{project_id}", tags=["requirements"])


def get_service(db: Session = Depends(get_db)) -> PptAgentService:
    return PptAgentService(db)


@router.get("/requirements/form")
def get_requirement_form(
    project_id: str,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.get_requirement_form(project_id)


@router.post("/requirements/answers:batch")
def submit_requirement_answers(
    project_id: str,
    payload: RequirementAnswersBatchRequest,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.submit_requirement_answers(project_id, [item.model_dump() for item in payload.answers])


@router.patch("/requirements/answers/{question_code}")
def patch_requirement_answer(
    project_id: str,
    question_code: str,
    payload: RequirementAnswerPatchRequest,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.patch_requirement_answer(project_id, question_code, payload.value)


@router.post("/requirements/search-results/{source_id}:retry")
def retry_requirement_source(
    project_id: str,
    source_id: str,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.retry_requirement_source(project_id, source_id)


@router.post("/requirements/questions")
def create_requirement_question(
    project_id: str,
    payload: RequirementQuestionCreateRequest,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.create_requirement_question(project_id, payload.model_dump())


@router.patch("/requirements/questions/{question_code}")
def update_requirement_question(
    project_id: str,
    question_code: str,
    payload: RequirementQuestionPatchRequest,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.update_requirement_question(project_id, question_code, payload.model_dump())


@router.delete("/requirements/questions/{question_code}")
def delete_requirement_question(
    project_id: str,
    question_code: str,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.delete_requirement_question(project_id, question_code)


@router.post("/requirements/confirm")
def confirm_requirements(
    project_id: str,
    payload: ConfirmRequest,
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.confirm_requirements(project_id, note_md=payload.note_md)


@router.post("/assets/backgrounds")
def upload_background(
    project_id: str,
    file: UploadFile = File(...),
    service: PptAgentService = Depends(get_service),
) -> dict:
    return service.upload_background(project_id, file)

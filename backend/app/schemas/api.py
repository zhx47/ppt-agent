from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ProjectCreateRequest(BaseModel):
    title: str | None = None
    request_text: str = Field(min_length=3)


class MessageCreateRequest(BaseModel):
    scope_type: str = "project"
    target_page_id: str | None = None
    ui_surface: str = "init"
    content_md: str = Field(min_length=1)
    attachments: list[dict[str, Any]] = Field(default_factory=list)


class RequirementAnswer(BaseModel):
    question_code: str
    value: Any


class RequirementAnswersBatchRequest(BaseModel):
    answers: list[RequirementAnswer]


class RequirementAnswerPatchRequest(BaseModel):
    value: Any


class RequirementOptionInput(BaseModel):
    option_code: str
    label: str
    description: str | None = None
    value: Any | None = None


class RequirementQuestionCreateRequest(BaseModel):
    question_code: str
    label: str
    description: str | None = None
    options: list[RequirementOptionInput] = Field(default_factory=list)
    allow_custom: bool = True


class RequirementQuestionPatchRequest(BaseModel):
    label: str | None = None
    description: str | None = None
    options: list[RequirementOptionInput] | None = None
    allow_custom: bool | None = None


class ConfirmRequest(BaseModel):
    note_md: str | None = None


class PageOutlinePatchRequest(BaseModel):
    title: str = Field(min_length=1)
    content_outline: list[str] = Field(default_factory=list)
    section_title: str | None = None


class SummaryPatchRequest(BaseModel):
    summary_md: str = Field(min_length=1)


class StoryboardPagePatchRequest(BaseModel):
    page_id: str | None = None
    title: str = Field(min_length=1)
    content_outline: list[str] = Field(default_factory=list)


class StoryboardSectionPatchRequest(BaseModel):
    part_title: str = Field(min_length=1)
    pages: list[StoryboardPagePatchRequest] = Field(default_factory=list)


class StoryboardPatchRequest(BaseModel):
    parts: list[StoryboardSectionPatchRequest] = Field(default_factory=list)


class PageActionRequest(BaseModel):
    action_type: str
    replace_existing: bool = True


class BatchActionRequest(BaseModel):
    action_type: str


class ExportCreateRequest(BaseModel):
    export_format: str = "pptx"

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, new_id, now_utc
from app.models.types import EmbeddingVector


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(Text, default="未命名项目")
    request_text: Mapped[str] = mapped_column(Text)
    current_stage: Mapped[str] = mapped_column(default="init")
    latest_checkpoint_code: Mapped[str] = mapped_column(default="requirements_confirm")
    checkpoint_status: Mapped[str] = mapped_column(default="pending")
    page_count_target: Mapped[int | None] = mapped_column(nullable=True)
    style_preset: Mapped[str | None] = mapped_column(nullable=True)
    background_asset_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    workflow_constraints_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    requirement_form: Mapped["RequirementForm | None"] = relationship(back_populates="project", uselist=False)
    messages: Mapped[list["ProjectMessage"]] = relationship(back_populates="project")
    events: Mapped[list["ProjectEvent"]] = relationship(back_populates="project")
    research_sessions: Mapped[list["ResearchSession"]] = relationship(back_populates="project")
    outline_versions: Mapped[list["OutlineVersion"]] = relationship(back_populates="project")
    pages: Mapped[list["ProjectPage"]] = relationship(back_populates="project")
    exports: Mapped[list["ExportJob"]] = relationship(back_populates="project")
    source_collections: Mapped[list["SourceCollection"]] = relationship(back_populates="project")
    retrieval_runs: Mapped[list["RetrievalRun"]] = relationship(back_populates="project")
    citations: Mapped[list["Citation"]] = relationship(back_populates="project")


class ProjectMessage(Base):
    __tablename__ = "project_messages"

    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    stage: Mapped[str] = mapped_column(default="init")
    scope_type: Mapped[str] = mapped_column(default="project")
    target_page_id: Mapped[str | None] = mapped_column(nullable=True, index=True)
    role: Mapped[str] = mapped_column(default="user")
    content_md: Mapped[str] = mapped_column(Text)
    structured_payload_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, index=True)

    project: Mapped[Project] = relationship(back_populates="messages")


class ProjectEvent(Base):
    __tablename__ = "project_events"

    stream_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(default=new_id, unique=True, index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    event_type: Mapped[str] = mapped_column(index=True)
    stage: Mapped[str] = mapped_column(default="init")
    scope_type: Mapped[str] = mapped_column(default="project")
    target_page_id: Mapped[str | None] = mapped_column(nullable=True, index=True)
    agent_run_id: Mapped[str | None] = mapped_column(nullable=True)
    payload_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, index=True)

    project: Mapped[Project] = relationship(back_populates="events")


class RequirementForm(Base):
    __tablename__ = "requirement_forms"

    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), unique=True, index=True)
    status: Mapped[str] = mapped_column(default="pending_confirmation")
    init_discovery_session_id: Mapped[str | None] = mapped_column(nullable=True)
    init_refine_session_id: Mapped[str | None] = mapped_column(nullable=True)
    active_outline_context_source: Mapped[str] = mapped_column(default="discovery")
    summary_md: Mapped[str] = mapped_column(Text, default="")
    outline_context_md: Mapped[str] = mapped_column(Text, default="")
    outline_context_citations_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    fixed_items_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    init_search_queries_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    init_search_results_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    init_corpus_digest_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    page_count_options_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    ai_questions_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    answers_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    suggested_actions_json: Mapped[list[dict[str, Any]] | list[str]] = mapped_column(JSON, default=list)
    latest_instruction: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    project: Mapped[Project] = relationship(back_populates="requirement_form")


class BochaSearchCache(Base):
    __tablename__ = "bocha_search_cache"

    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    query_key: Mapped[str] = mapped_column(Text, unique=True, index=True)
    query_text: Mapped[str] = mapped_column(Text)
    provider: Mapped[str] = mapped_column(default="bocha-mcp")
    result_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    result_count: Mapped[int] = mapped_column(default=0)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class URLContentCache(Base):
    __tablename__ = "url_content_cache"

    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    normalized_url: Mapped[str] = mapped_column(Text, unique=True, index=True)
    provider: Mapped[str] = mapped_column(default="jina")
    title: Mapped[str] = mapped_column(Text, default="")
    markdown_content: Mapped[str] = mapped_column(Text, default="")
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    content_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(default="ready")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class SourceCollection(Base):
    __tablename__ = "source_collections"

    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    page_id: Mapped[str | None] = mapped_column(ForeignKey("project_pages.id", ondelete="CASCADE"), nullable=True, index=True)
    collection_type: Mapped[str] = mapped_column(default="project_knowledge")
    title: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    project: Mapped[Project] = relationship(back_populates="source_collections")
    documents: Mapped[list["SourceDocument"]] = relationship(back_populates="collection", cascade="all, delete-orphan")


class SourceDocument(Base):
    __tablename__ = "source_documents"

    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    collection_id: Mapped[str] = mapped_column(ForeignKey("source_collections.id", ondelete="CASCADE"), index=True)
    source_type: Mapped[str] = mapped_column(default="url")
    source_uri: Mapped[str] = mapped_column(Text, index=True)
    url_cache_id: Mapped[str | None] = mapped_column(ForeignKey("url_content_cache.id", ondelete="SET NULL"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(Text, default="")
    markdown_content: Mapped[str] = mapped_column(Text, default="")
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    content_hash: Mapped[str | None] = mapped_column(Text, nullable=True, index=True)
    status: Mapped[str] = mapped_column(default="ready")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    collection: Mapped[SourceCollection] = relationship(back_populates="documents")
    url_cache: Mapped[URLContentCache | None] = relationship()
    chunks: Mapped[list["SourceChunk"]] = relationship(back_populates="source_document", cascade="all, delete-orphan")


class SourceChunk(Base):
    __tablename__ = "source_chunks"
    __table_args__ = (
        UniqueConstraint("source_document_id", "chunk_index", name="uq_source_chunk_index"),
    )

    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    source_document_id: Mapped[str] = mapped_column(ForeignKey("source_documents.id", ondelete="CASCADE"), index=True)
    chunk_index: Mapped[int] = mapped_column(default=0)
    section_path: Mapped[str] = mapped_column(Text, default="")
    content_md: Mapped[str] = mapped_column(Text, default="")
    content_for_embedding: Mapped[str] = mapped_column(Text, default="")
    embedding: Mapped[list[float] | None] = mapped_column(EmbeddingVector(1536), nullable=True)
    token_count: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    source_document: Mapped[SourceDocument] = relationship(back_populates="chunks")


class ResearchSession(Base):
    __tablename__ = "research_sessions"

    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    page_id: Mapped[str | None] = mapped_column(ForeignKey("project_pages.id", ondelete="SET NULL"), nullable=True, index=True)
    scope_type: Mapped[str] = mapped_column(default="project")
    session_role: Mapped[str] = mapped_column(default="init_discovery")
    page_brief_version_id: Mapped[str | None] = mapped_column(nullable=True, index=True)
    based_on_session_id: Mapped[str | None] = mapped_column(nullable=True, index=True)
    research_goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    cross_page_outline_snapshot_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    query_plan_json: Mapped[list[dict[str, Any]] | list[str]] = mapped_column(JSON, default=list)
    summary_md: Mapped[str] = mapped_column(Text, default="")
    key_findings_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    overlap_risks_json: Mapped[list[dict[str, Any]] | list[str]] = mapped_column(JSON, default=list)
    open_questions_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(default="pending_confirmation")
    confirmed_by_message_id: Mapped[str | None] = mapped_column(nullable=True)
    context_snapshot_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_by_agent_run_id: Mapped[str | None] = mapped_column(nullable=True)
    candidate_sources_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    selected_citations_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    project: Mapped[Project] = relationship(back_populates="research_sessions")
    sources: Mapped[list["ResearchSource"]] = relationship(back_populates="research_session", cascade="all, delete-orphan")
    selected_sources: Mapped[list["ProjectResearchSource"]] = relationship(
        back_populates="research_session",
        cascade="all, delete-orphan",
    )
    retrieval_runs: Mapped[list["RetrievalRun"]] = relationship(back_populates="research_session", cascade="all, delete-orphan")


class ResearchSource(Base):
    __tablename__ = "research_sources"

    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    research_session_id: Mapped[str] = mapped_column(ForeignKey("research_sessions.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(Text)
    snippet: Mapped[str] = mapped_column(Text, default="")
    content_md: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    research_session: Mapped[ResearchSession] = relationship(back_populates="sources")


class ProjectResearchSource(Base):
    __tablename__ = "project_research_sources"
    __table_args__ = (
        UniqueConstraint("research_session_id", "chunk_id", name="uq_research_source_chunk"),
    )

    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    research_session_id: Mapped[str] = mapped_column(ForeignKey("research_sessions.id", ondelete="CASCADE"), index=True)
    source_document_id: Mapped[str] = mapped_column(ForeignKey("source_documents.id", ondelete="CASCADE"), index=True)
    chunk_id: Mapped[str] = mapped_column(ForeignKey("source_chunks.id", ondelete="CASCADE"), index=True)
    rank_no: Mapped[int] = mapped_column(default=0)
    excerpt_md: Mapped[str] = mapped_column(Text, default="")
    relevance_score: Mapped[float] = mapped_column(Float, default=0.0)
    usage_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)

    research_session: Mapped[ResearchSession] = relationship(back_populates="selected_sources")
    source_document: Mapped[SourceDocument] = relationship()
    chunk: Mapped[SourceChunk] = relationship()


class RetrievalRun(Base):
    __tablename__ = "retrieval_runs"

    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    research_session_id: Mapped[str] = mapped_column(ForeignKey("research_sessions.id", ondelete="CASCADE"), index=True)
    query_text: Mapped[str] = mapped_column(Text)
    retrieval_mode: Mapped[str] = mapped_column(default="hybrid")
    status: Mapped[str] = mapped_column(default="running")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    project: Mapped[Project] = relationship(back_populates="retrieval_runs")
    research_session: Mapped[ResearchSession] = relationship(back_populates="retrieval_runs")
    candidates: Mapped[list["RetrievalCandidate"]] = relationship(back_populates="retrieval_run", cascade="all, delete-orphan")


class RetrievalCandidate(Base):
    __tablename__ = "retrieval_candidates"

    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    retrieval_run_id: Mapped[str] = mapped_column(ForeignKey("retrieval_runs.id", ondelete="CASCADE"), index=True)
    source_document_id: Mapped[str] = mapped_column(ForeignKey("source_documents.id", ondelete="CASCADE"), index=True)
    chunk_id: Mapped[str] = mapped_column(ForeignKey("source_chunks.id", ondelete="CASCADE"), index=True)
    score_vector: Mapped[float] = mapped_column(Float, default=0.0)
    score_keyword: Mapped[float] = mapped_column(Float, default=0.0)
    score_final: Mapped[float] = mapped_column(Float, default=0.0)
    selected: Mapped[bool] = mapped_column(Boolean, default=False)

    retrieval_run: Mapped[RetrievalRun] = relationship(back_populates="candidates")
    source_document: Mapped[SourceDocument] = relationship()
    chunk: Mapped[SourceChunk] = relationship()


class Citation(Base):
    __tablename__ = "citations"
    __table_args__ = (
        UniqueConstraint("project_id", "chunk_id", name="uq_project_citation_chunk"),
    )

    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    source_document_id: Mapped[str] = mapped_column(ForeignKey("source_documents.id", ondelete="CASCADE"), index=True)
    chunk_id: Mapped[str] = mapped_column(ForeignKey("source_chunks.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(Text, default="")
    url: Mapped[str] = mapped_column(Text, default="")
    excerpt_md: Mapped[str] = mapped_column(Text, default="")
    citation_label: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    project: Mapped[Project] = relationship(back_populates="citations")
    source_document: Mapped[SourceDocument] = relationship()
    chunk: Mapped[SourceChunk] = relationship()


class OutlineVersion(Base):
    __tablename__ = "outline_versions"

    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    version_no: Mapped[int] = mapped_column(default=1)
    status: Mapped[str] = mapped_column(default="pending_confirmation")
    outline_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    project: Mapped[Project] = relationship(back_populates="outline_versions")


class ProjectPage(Base):
    __tablename__ = "project_pages"
    __table_args__ = (
        UniqueConstraint("project_id", "page_code", name="uq_project_page_code"),
    )

    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    page_code: Mapped[str] = mapped_column(index=True)
    page_role: Mapped[str] = mapped_column(default="content")
    part_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(default=0)
    current_brief_version_id: Mapped[str | None] = mapped_column(nullable=True)
    current_research_session_id: Mapped[str | None] = mapped_column(nullable=True)
    current_draft_version_id: Mapped[str | None] = mapped_column(nullable=True)
    current_design_version_id: Mapped[str | None] = mapped_column(nullable=True)
    outline_status: Mapped[str] = mapped_column(default="empty")
    search_status: Mapped[str] = mapped_column(default="empty")
    summary_status: Mapped[str] = mapped_column(default="empty")
    research_status: Mapped[str] = mapped_column(default="pending")
    draft_status: Mapped[str] = mapped_column(default="pending")
    design_status: Mapped[str] = mapped_column(default="pending")
    page_search_queries_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    page_search_results_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    page_corpus_digest_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    page_summary_md: Mapped[str] = mapped_column(Text, default="")
    page_summary_citations_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    artifact_staleness_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    project: Mapped[Project] = relationship(back_populates="pages")


class PageBriefVersion(Base):
    __tablename__ = "page_brief_versions"
    __table_args__ = (
        UniqueConstraint("page_id", "version_no", name="uq_page_brief_version"),
    )

    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    page_id: Mapped[str] = mapped_column(ForeignKey("project_pages.id", ondelete="CASCADE"), index=True)
    version_no: Mapped[int] = mapped_column(default=1)
    status: Mapped[str] = mapped_column(default="confirmed")
    section_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str] = mapped_column(Text)
    content_outline_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    content_summary: Mapped[str] = mapped_column(Text, default="")
    self_check_result_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class DraftVersion(Base):
    __tablename__ = "draft_versions"
    __table_args__ = (
        UniqueConstraint("page_id", "version_no", name="uq_page_draft_version"),
    )

    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    page_id: Mapped[str] = mapped_column(ForeignKey("project_pages.id", ondelete="CASCADE"), index=True)
    version_no: Mapped[int] = mapped_column(default=1)
    status: Mapped[str] = mapped_column(default="pending_confirmation")
    page_brief_version_id: Mapped[str | None] = mapped_column(nullable=True)
    research_session_id: Mapped[str | None] = mapped_column(nullable=True)
    draft_svg_markup: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class DesignVersion(Base):
    __tablename__ = "design_versions"
    __table_args__ = (
        UniqueConstraint("page_id", "version_no", name="uq_page_design_version"),
    )

    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    page_id: Mapped[str] = mapped_column(ForeignKey("project_pages.id", ondelete="CASCADE"), index=True)
    version_no: Mapped[int] = mapped_column(default=1)
    status: Mapped[str] = mapped_column(default="pending_confirmation")
    draft_version_id: Mapped[str | None] = mapped_column(nullable=True)
    style_pack_id: Mapped[str | None] = mapped_column(nullable=True)
    background_asset_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    design_svg_markup: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class ExportJob(Base):
    __tablename__ = "export_jobs"

    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    export_format: Mapped[str] = mapped_column(default="pptx")
    status: Mapped[str] = mapped_column(default="completed")
    file_path: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    project: Mapped[Project] = relationship(back_populates="exports")

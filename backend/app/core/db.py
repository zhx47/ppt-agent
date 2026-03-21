from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.models.base import Base

_ENGINE: Engine | None = None
_SESSION_FACTORY: sessionmaker[Session] | None = None

_SCHEMA_UPGRADES: dict[str, list[tuple[str, str]]] = {
    "projects": [
        ("workflow_constraints_json", "JSON"),
    ],
    "requirement_forms": [
        ("init_search_queries_json", "JSON"),
        ("init_search_results_json", "JSON"),
        ("init_corpus_digest_json", "JSON"),
        ("page_count_options_json", "JSON"),
    ],
    "source_collections": [
        ("page_id", "TEXT"),
    ],
    "project_pages": [
        ("outline_status", "TEXT"),
        ("search_status", "TEXT"),
        ("summary_status", "TEXT"),
        ("page_search_queries_json", "JSON"),
        ("page_search_results_json", "JSON"),
        ("page_corpus_digest_json", "JSON"),
        ("page_summary_md", "TEXT"),
        ("page_summary_citations_json", "JSON"),
        ("artifact_staleness_json", "JSON"),
    ],
    "page_brief_versions": [
        ("section_title", "TEXT"),
    ],
    "research_sessions": [
        ("page_brief_version_id", "TEXT"),
        ("based_on_session_id", "TEXT"),
        ("research_goal", "TEXT"),
        ("cross_page_outline_snapshot_json", "JSON"),
        ("key_findings_json", "JSON"),
        ("overlap_risks_json", "JSON"),
        ("open_questions_json", "JSON"),
        ("confirmed_by_message_id", "TEXT"),
        ("context_snapshot_json", "JSON"),
        ("created_by_agent_run_id", "TEXT"),
        ("candidate_sources_json", "JSON"),
    ],
}


def get_engine() -> Engine:
    global _ENGINE
    if _ENGINE is None:
        settings = get_settings()
        connect_args: dict[str, object] = {}
        if settings.database_url.startswith("sqlite"):
            connect_args["check_same_thread"] = False
        _ENGINE = create_engine(
            settings.database_url,
            future=True,
            pool_pre_ping=True,
            connect_args=connect_args,
        )
    return _ENGINE


def get_session_factory() -> sessionmaker[Session]:
    global _SESSION_FACTORY
    if _SESSION_FACTORY is None:
        _SESSION_FACTORY = sessionmaker(
            bind=get_engine(),
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
            future=True,
        )
    return _SESSION_FACTORY


def get_db() -> Generator[Session, None, None]:
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    session = get_session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db() -> None:
    engine = get_engine()
    _ensure_pgvector(engine)
    Base.metadata.create_all(bind=engine)
    _apply_schema_upgrades(engine)
    _relax_pgvector_dimensions(engine)


def reset_db_state() -> None:
    global _ENGINE, _SESSION_FACTORY
    if _ENGINE is not None:
        _ENGINE.dispose()
    _ENGINE = None
    _SESSION_FACTORY = None


def _ensure_pgvector(engine: Engine) -> None:
    if engine.dialect.name != "postgresql":
        return
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    except Exception:
        os.environ["PPT_DISABLE_PGVECTOR"] = "1"


def _apply_schema_upgrades(engine: Engine) -> None:
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table_name, columns in _SCHEMA_UPGRADES.items():
            if table_name not in inspector.get_table_names():
                continue
            existing = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, ddl in columns:
                if column_name in existing:
                    continue
                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {ddl}"))


def _relax_pgvector_dimensions(engine: Engine) -> None:
    if engine.dialect.name != "postgresql" or os.getenv("PPT_DISABLE_PGVECTOR") == "1":
        return

    query = text(
        """
        SELECT format_type(a.atttypid, a.atttypmod) AS column_type
        FROM pg_attribute a
        JOIN pg_class c ON a.attrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE c.relname = 'source_chunks'
          AND a.attname = 'embedding'
          AND a.attnum > 0
          AND NOT a.attisdropped
        LIMIT 1
        """
    )
    with engine.begin() as conn:
        column_type = conn.execute(query).scalar()
        if isinstance(column_type, str) and column_type.startswith("vector("):
            conn.execute(text("ALTER TABLE source_chunks ALTER COLUMN embedding TYPE vector USING embedding::vector"))

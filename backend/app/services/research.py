from __future__ import annotations

import hashlib
import math
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import timedelta
from typing import Any, Callable
from urllib.parse import urldefrag

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.base import now_utc
from app.models.entities import (
    BochaSearchCache,
    Citation,
    Project,
    ProjectPage,
    ProjectResearchSource,
    ResearchSession,
    ResearchSource,
    RetrievalCandidate,
    RetrievalRun,
    SourceChunk,
    SourceCollection,
    SourceDocument,
    URLContentCache,
)
from app.services.mcp_gateway import McpGateway, ReadResult, SearchResult
from app.services.model_gateway import ModelGateway
from app.services.prompt_contracts import get_prompt_text, render_prompt


class ResearchService:
    def __init__(self, session: Session):
        self.session = session
        self.mcp = McpGateway()
        self.models = ModelGateway()

    def build_query_plan(
        self,
        *,
        scope_type: str,
        session_role: str,
        request_text: str,
        project_stage: str,
        project_title: str,
        fixed_fields: dict[str, Any],
        answers: dict[str, Any],
        page_title: str = "",
        page_outline: list[str] | None = None,
        page_section_title: str | None = None,
        outline_full_snapshot: list[dict[str, Any]] | None = None,
        latest_instruction: str = "",
    ) -> list[dict[str, str]]:
        result = self.models.context_json(
            get_prompt_text("research.query_rewrite.system"),
            render_prompt(
                "research.query_rewrite.user",
                {
                    "scope_type": scope_type,
                    "session_role": session_role,
                    "request_text": request_text,
                    "project_stage": project_stage,
                    "project_title": project_title,
                    "fixed_fields_json": fixed_fields,
                    "answers_json": answers,
                    "page_title": page_title,
                    "page_outline_json": page_outline or [],
                    "page_section_title": page_section_title or "",
                    "outline_full_snapshot_json": outline_full_snapshot or [],
                    "latest_instruction": latest_instruction,
                },
            ),
        )
        queries = result.get("queries")
        normalized = self._normalize_query_items(queries)
        if not normalized:
            raise RuntimeError("research.query_rewrite 没有返回有效 queries")
        return normalized

    def search_query_summaries(
        self,
        query_plan: list[dict[str, str]],
        *,
        limit_per_query: int = 3,
        on_query_completed: Callable[[dict[str, Any]], None] | None = None,
    ) -> list[dict[str, Any]]:
        seen_urls: set[str] = set()
        items: list[dict[str, Any]] = []
        total_queries = len(query_plan)
        for query_index, query_item in enumerate(query_plan, start=1):
            query_text = query_item["query_text"]
            query_purpose = query_item["query_purpose"]
            query_results: list[dict[str, Any]] = []
            for search_rank, result in enumerate(self._search_query(query_text, limit_per_query), start=1):
                normalized_url = self._normalize_url(result.url)
                if not normalized_url or normalized_url in seen_urls:
                    continue
                seen_urls.add(normalized_url)
                payload = {
                    "id": self._hash_text(f"{query_text}|{normalized_url}"),
                    "query_text": query_text,
                    "query_purpose": query_purpose,
                    "search_rank": search_rank,
                    "title": result.title,
                    "url": normalized_url,
                    "bocha_summary": result.snippet,
                }
                items.append(payload)
                query_results.append(payload)
            if on_query_completed is not None:
                on_query_completed(
                    {
                        "query_index": query_index,
                        "query_total": total_queries,
                        "query_text": query_text,
                        "query_purpose": query_purpose,
                        "query_result_count": len(query_results),
                        "result_count": len(items),
                        "items": self.build_search_result_cards(items),
                    }
                )
        return items

    def build_search_result_cards(self, search_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
        cards: list[dict[str, Any]] = []
        for item in search_results:
            cards.append(
                {
                    "id": item["id"],
                    "query_text": item["query_text"],
                    "query_purpose": item.get("query_purpose") or "",
                    "search_rank": item["search_rank"],
                    "title": item["title"],
                    "url": self._normalize_url(item["url"]),
                    "bocha_summary": item.get("bocha_summary") or item.get("snippet") or "",
                    "snippet": item.get("snippet") or item.get("bocha_summary") or "",
                    "content_excerpt_md": item.get("content_excerpt_md") or "",
                    "read_status": item.get("read_status") or "pending",
                    "vector_status": item.get("vector_status") or "pending",
                    "source_document_id": item.get("source_document_id"),
                }
            )
        return cards

    def refresh_search_result_cards(self, search_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
        cards = self.build_search_result_cards(search_results)
        document_ids = [str(item.get("source_document_id")) for item in cards if item.get("source_document_id")]
        if not document_ids:
            return cards

        documents = {
            item.id: item
            for item in self.session.scalars(select(SourceDocument).where(SourceDocument.id.in_(document_ids)))
        }
        chunk_document_ids = set(
            self.session.scalars(
                select(SourceChunk.source_document_id)
                .where(SourceChunk.source_document_id.in_(document_ids))
                .distinct()
            )
        )

        refreshed_cards: list[dict[str, Any]] = []
        for item in cards:
            refreshed = dict(item)
            source_document_id = refreshed.get("source_document_id")
            if not source_document_id:
                refreshed_cards.append(refreshed)
                continue

            document = documents.get(str(source_document_id))
            if document is None:
                refreshed["source_document_id"] = None
                refreshed["read_status"] = "failed" if refreshed.get("read_status") == "failed" else "pending"
                refreshed["vector_status"] = "failed" if refreshed.get("read_status") == "failed" else "pending"
                refreshed_cards.append(refreshed)
                continue

            refreshed["title"] = document.title or refreshed["title"]
            if not refreshed.get("content_excerpt_md"):
                refreshed["content_excerpt_md"] = self._clip_excerpt(document.markdown_content, limit=320)
            if refreshed.get("read_status") in {"", "pending", "failed"}:
                refreshed["read_status"] = "ready"
            refreshed["vector_status"] = "ready" if str(source_document_id) in chunk_document_ids else "pending"
            refreshed_cards.append(refreshed)
        return refreshed_cards

    def retry_search_result_card(
        self,
        *,
        collection: SourceCollection,
        search_result: dict[str, Any],
    ) -> dict[str, Any]:
        candidate = self.build_search_result_cards([search_result])[0]
        normalized_url = self._normalize_url(candidate["url"])
        existing_document = None
        if candidate.get("source_document_id"):
            existing_document = self.session.get(SourceDocument, candidate["source_document_id"])
        if existing_document is None:
            existing_document = self.session.scalar(
                select(SourceDocument).where(
                    SourceDocument.collection_id == collection.id,
                    SourceDocument.source_uri == normalized_url,
                )
            )

        try:
            if existing_document is not None and candidate.get("read_status") != "failed":
                metadata = existing_document.metadata_json if isinstance(existing_document.metadata_json, dict) else {}
                read_result = ReadResult(
                    title=existing_document.title,
                    markdown_content=existing_document.markdown_content,
                    provider=str(metadata.get("provider") or "stored"),
                    metadata=metadata,
                )
            else:
                read_result = self._store_read_result(normalized_url, self.mcp.read_url_markdown(normalized_url))

            result = SearchResult(
                title=candidate["title"],
                url=normalized_url,
                snippet=candidate.get("snippet") or candidate.get("bocha_summary") or "",
            )
            document, chunks, reused_existing = self._upsert_source_document(
                collection,
                result,
                read_result,
                defer_embedding=True,
            )
            if chunks:
                self.store_chunk_embeddings(
                    [
                        {
                            "document": document,
                            "chunk": chunk,
                        }
                        for chunk in chunks
                    ]
                )
            candidate["title"] = read_result.title or result.title
            candidate["content_excerpt_md"] = self._clip_excerpt(read_result.markdown_content, limit=320)
            candidate["read_status"] = "reused" if reused_existing and candidate.get("read_status") != "failed" else "ready"
            candidate["vector_status"] = "pending"
            candidate["source_document_id"] = document.id
        except Exception:
            candidate["content_excerpt_md"] = ""
            candidate["read_status"] = "failed"
            candidate["vector_status"] = "failed"
            candidate["source_document_id"] = None

        return self.refresh_search_result_cards([candidate])[0]

    def get_or_create_init_collection(self, project: Project) -> SourceCollection:
        return self._get_or_create_collection(
            project_id=project.id,
            collection_type="init_knowledge",
            page_id=None,
            title=f"{project.title} 初始化资料池",
        )

    def get_or_create_page_collection(self, project: Project, page: ProjectPage) -> SourceCollection:
        return self._get_or_create_collection(
            project_id=project.id,
            collection_type="page_knowledge",
            page_id=page.id,
            title=f"{project.title}::{page.page_code} 页级资料池",
        )

    def clear_collection(self, collection: SourceCollection) -> None:
        document_ids = list(
            self.session.scalars(
                select(SourceDocument.id).where(SourceDocument.collection_id == collection.id)
            )
        )
        if document_ids:
            self.session.execute(delete(SourceDocument).where(SourceDocument.id.in_(document_ids)))
        self.session.flush()

    def ingest_search_results(
        self,
        *,
        collection: SourceCollection,
        search_results: list[dict[str, Any]],
        replace: bool = True,
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        candidate_sources, pending_chunk_records, read_summary = self.hydrate_search_results(
            collection=collection,
            search_results=search_results,
            replace=replace,
        )
        self.store_chunk_embeddings(pending_chunk_records)
        for candidate in candidate_sources:
            if candidate.get("source_document_id") and candidate.get("read_status") != "failed":
                candidate["vector_status"] = "ready"
        failed_urls = read_summary.get("failed_urls") or []
        if not read_summary.get("ingested_count") and failed_urls:
            raise RuntimeError(f"研究来源读取全部失败: {failed_urls[0]}")
        return candidate_sources, self.build_collection_digest(collection.id)

    def hydrate_search_results(
        self,
        *,
        collection: SourceCollection,
        search_results: list[dict[str, Any]],
        replace: bool = True,
        on_read_progress: Callable[[dict[str, Any]], None] | None = None,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
        if replace:
            self.clear_collection(collection)

        planned_candidates: list[dict[str, Any]] = []
        cached_results: dict[str, ReadResult] = {}
        for item in search_results:
            normalized_url = self._normalize_url(item["url"])
            result = SearchResult(
                title=item["title"],
                url=normalized_url,
                snippet=item.get("bocha_summary") or "",
            )
            candidate = {
                "id": item["id"],
                "query_text": item["query_text"],
                "query_purpose": item.get("query_purpose") or "",
                "search_rank": item["search_rank"],
                "title": item["title"],
                "url": normalized_url,
                "snippet": item.get("bocha_summary") or "",
                "bocha_summary": item.get("bocha_summary") or "",
                "content_excerpt_md": "",
                "read_status": "pending",
                "vector_status": "pending",
                "source_document_id": None,
            }
            cached_result = self._get_cached_read_result(normalized_url)
            if cached_result is not None:
                cached_results[normalized_url] = cached_result
            planned_candidates.append(
                {
                    "candidate": candidate,
                    "result": result,
                    "cached": cached_result is not None,
                }
            )

        prefetched_results, fetch_errors = self._fetch_candidate_markdown(planned_candidates, cached_results)
        candidate_sources, pending_chunk_records, ingested_count, failed_urls = self._ingest_candidate_records(
            collection,
            planned_candidates,
            cached_results,
            prefetched_results,
            fetch_errors,
            on_candidate_progress=on_read_progress,
        )
        if ingested_count == 0 and failed_urls:
            raise RuntimeError(f"研究来源读取全部失败: {failed_urls[0]}")
        return candidate_sources, pending_chunk_records, {
            "ingested_count": ingested_count,
            "failed_count": len(failed_urls),
            "failed_urls": failed_urls,
        }

    def store_chunk_embeddings(
        self,
        chunk_records: list[dict[str, Any]],
        *,
        on_embedding_progress: Callable[[dict[str, Any]], None] | None = None,
    ) -> dict[str, Any]:
        self._store_chunk_embeddings(chunk_records, on_embedding_progress=on_embedding_progress)
        return {
            "document_count": len({item["document"].id for item in chunk_records}),
            "chunk_count": len(chunk_records),
        }

    def build_collection_digest(self, collection_id: str) -> dict[str, Any]:
        document_count = self.session.scalar(
            select(func.count(SourceDocument.id)).where(SourceDocument.collection_id == collection_id)
        ) or 0
        chunk_count = self.session.scalar(
            select(func.count(SourceChunk.id))
            .join(SourceDocument, SourceDocument.id == SourceChunk.source_document_id)
            .where(SourceDocument.collection_id == collection_id)
        ) or 0
        latest_document = self.session.scalars(
            select(SourceDocument)
            .where(SourceDocument.collection_id == collection_id)
            .order_by(SourceDocument.created_at.desc())
            .limit(1)
        ).first()
        return {
            "collection_id": collection_id,
            "document_count": document_count,
            "chunk_count": chunk_count,
            "latest_document_title": latest_document.title if latest_document else "",
            "updated_at": latest_document.created_at.isoformat() if latest_document else None,
        }

    def create_session(
        self,
        *,
        project_id: str,
        page_id: str | None,
        scope_type: str,
        session_role: str,
        research_goal: str,
        query_plan: list[dict[str, str]],
        context_snapshot: dict[str, Any],
        status: str = "running",
    ) -> ResearchSession:
        session = ResearchSession(
            project_id=project_id,
            page_id=page_id,
            scope_type=scope_type,
            session_role=session_role,
            research_goal=research_goal,
            query_plan_json=query_plan,
            context_snapshot_json=context_snapshot,
            status=status,
        )
        self.session.add(session)
        self.session.flush()
        return session

    def retrieve_for_collection(
        self,
        *,
        project: Project,
        collection: SourceCollection,
        research_session: ResearchSession,
        query_plan: list[dict[str, str]],
        limit: int,
    ) -> list[dict[str, Any]]:
        chunk_stmt = (
            select(SourceChunk)
            .join(SourceDocument, SourceDocument.id == SourceChunk.source_document_id)
            .where(SourceDocument.collection_id == collection.id)
            .options(selectinload(SourceChunk.source_document))
        )
        chunks = list(self.session.scalars(chunk_stmt))
        if not chunks:
            research_session.selected_citations_json = []
            return []

        query_texts = [item["query_text"] for item in query_plan]
        query_embeddings = self.models.embed_texts(query_texts)
        combined_scores: dict[str, dict[str, Any]] = {}

        for query_index, query_text in enumerate(query_texts):
            retrieval_run = RetrievalRun(
                project_id=project.id,
                research_session_id=research_session.id,
                query_text=query_text,
                retrieval_mode="hybrid" if query_embeddings else "keyword",
                status="running",
            )
            self.session.add(retrieval_run)
            self.session.flush()

            query_embedding = query_embeddings[query_index] if query_index < len(query_embeddings) else None
            ranked: list[dict[str, Any]] = []
            for chunk in chunks:
                keyword_score = self._keyword_score(query_text, chunk.content_for_embedding)
                vector_score = self._cosine_similarity(query_embedding, chunk.embedding)
                final_score = keyword_score
                if query_embedding and chunk.embedding:
                    final_score = (keyword_score * 0.45) + (vector_score * 0.55)
                if final_score <= 0:
                    continue
                ranked.append(
                    {
                        "chunk": chunk,
                        "document": chunk.source_document,
                        "score_keyword": keyword_score,
                        "score_vector": vector_score,
                        "score_final": final_score,
                    }
                )
            ranked.sort(key=lambda item: item["score_final"], reverse=True)
            for rank_no, item in enumerate(ranked[:20], start=1):
                self.session.add(
                    RetrievalCandidate(
                        retrieval_run_id=retrieval_run.id,
                        source_document_id=item["document"].id,
                        chunk_id=item["chunk"].id,
                        score_vector=item["score_vector"],
                        score_keyword=item["score_keyword"],
                        score_final=item["score_final"],
                        selected=False,
                    )
                )
                combined = combined_scores.setdefault(
                    item["chunk"].id,
                    {
                        "chunk": item["chunk"],
                        "document": item["document"],
                        "rrf_score": 0.0,
                        "score_keyword": 0.0,
                        "score_vector": 0.0,
                        "usage_queries": [],
                    },
                )
                combined["rrf_score"] += 1.0 / (60 + rank_no)
                combined["score_keyword"] = max(combined["score_keyword"], item["score_keyword"])
                combined["score_vector"] = max(combined["score_vector"], item["score_vector"])
                combined["usage_queries"].append(query_text)
            retrieval_run.status = "completed"
            self.session.flush()

        ranked_candidates = sorted(
            combined_scores.values(),
            key=lambda item: item["rrf_score"] + (item["score_vector"] * 0.1) + (item["score_keyword"] * 0.1),
            reverse=True,
        )

        self.session.execute(
            delete(ProjectResearchSource).where(ProjectResearchSource.research_session_id == research_session.id)
        )
        self.session.execute(delete(ResearchSource).where(ResearchSource.research_session_id == research_session.id))
        self.session.flush()

        selected_payloads: list[dict[str, Any]] = []
        selected_texts: list[str] = []
        for item in ranked_candidates:
            excerpt = self._clip_excerpt(item["chunk"].content_md, limit=420)
            if self._is_duplicate_excerpt(excerpt, selected_texts):
                continue
            selected_texts.append(excerpt)
            rank_no = len(selected_payloads) + 1
            relevance_score = round(
                item["rrf_score"] + (item["score_vector"] * 0.1) + (item["score_keyword"] * 0.1),
                6,
            )
            usage_note = f"用于支撑查询：{item['usage_queries'][0]}" if item["usage_queries"] else ""
            citation = self._get_or_create_citation(project.id, item["document"], item["chunk"], excerpt)
            self.session.add(
                ProjectResearchSource(
                    research_session_id=research_session.id,
                    source_document_id=item["document"].id,
                    chunk_id=item["chunk"].id,
                    rank_no=rank_no,
                    excerpt_md=excerpt,
                    relevance_score=relevance_score,
                    usage_note=usage_note,
                    is_pinned=False,
                )
            )
            self.session.add(
                ResearchSource(
                    research_session_id=research_session.id,
                    title=item["document"].title,
                    url=item["document"].source_uri,
                    snippet=excerpt,
                    content_md=item["chunk"].content_md,
                )
            )
            selected_payloads.append(
                {
                    "citation_id": citation.id,
                    "source_document_id": item["document"].id,
                    "chunk_id": item["chunk"].id,
                    "title": item["document"].title,
                    "url": item["document"].source_uri,
                    "excerpt_md": excerpt,
                    "citation_label": citation.citation_label,
                    "rank_no": rank_no,
                    "relevance_score": relevance_score,
                    "usage_note": usage_note,
                }
            )
            if len(selected_payloads) >= limit:
                break

        research_session.selected_citations_json = selected_payloads
        self.session.flush()
        return selected_payloads

    def serialize_selected_sources(self, research_session_id: str) -> list[dict[str, Any]]:
        stmt = (
            select(ProjectResearchSource)
            .where(ProjectResearchSource.research_session_id == research_session_id)
            .order_by(ProjectResearchSource.rank_no.asc())
            .options(
                selectinload(ProjectResearchSource.source_document),
                selectinload(ProjectResearchSource.chunk),
            )
        )
        return [self._selected_source_payload(item) for item in self.session.scalars(stmt)]

    def _get_or_create_collection(
        self,
        *,
        project_id: str,
        collection_type: str,
        page_id: str | None,
        title: str,
    ) -> SourceCollection:
        stmt = select(SourceCollection).where(
            SourceCollection.project_id == project_id,
            SourceCollection.collection_type == collection_type,
        )
        if page_id is None:
            stmt = stmt.where(SourceCollection.page_id.is_(None))
        else:
            stmt = stmt.where(SourceCollection.page_id == page_id)
        collection = self.session.scalars(stmt).first()
        if collection is None:
            collection = SourceCollection(
                project_id=project_id,
                page_id=page_id,
                collection_type=collection_type,
                title=title,
            )
            self.session.add(collection)
            self.session.flush()
        return collection

    def _search_query(self, query_text: str, limit: int) -> list[SearchResult]:
        query_key = self._query_key(query_text)
        cache = self.session.scalar(select(BochaSearchCache).where(BochaSearchCache.query_key == query_key))
        now = now_utc()
        if cache and (cache.expires_at is None or cache.expires_at > now):
            items = cache.result_json.get("items", [])
            return [SearchResult(**item) for item in items if item.get("url")]

        results = self.mcp.search_web(query_text, limit=limit)
        payload = {"items": [item.__dict__ for item in results]}
        if cache is None:
            cache = BochaSearchCache(
                query_key=query_key,
                query_text=query_text,
                result_json=payload,
                result_count=len(results),
                expires_at=now + timedelta(hours=12),
            )
            self.session.add(cache)
        else:
            cache.query_text = query_text
            cache.result_json = payload
            cache.result_count = len(results)
            cache.expires_at = now + timedelta(hours=12)
        self.session.flush()
        return results

    def _get_cached_read_result(self, url: str) -> ReadResult | None:
        normalized_url = self._normalize_url(url)
        now = now_utc()
        cache = self.session.scalar(select(URLContentCache).where(URLContentCache.normalized_url == normalized_url))
        if cache and cache.status == "ready" and (cache.expires_at is None or cache.expires_at > now):
            return ReadResult(
                title=cache.title,
                markdown_content=cache.markdown_content,
                provider=cache.provider,
                metadata=cache.metadata_json,
            )
        return None

    def _store_read_result(self, url: str, result: ReadResult) -> ReadResult:
        normalized_url = self._normalize_url(url)
        now = now_utc()
        cache = self.session.scalar(select(URLContentCache).where(URLContentCache.normalized_url == normalized_url))
        content_hash = self._hash_text(result.markdown_content)
        if cache is None:
            cache = URLContentCache(
                normalized_url=normalized_url,
                provider=result.provider,
                title=result.title,
                markdown_content=result.markdown_content,
                metadata_json=result.metadata,
                content_hash=content_hash,
                status="ready",
                expires_at=now + timedelta(days=7),
            )
            self.session.add(cache)
        else:
            cache.provider = result.provider
            cache.title = result.title
            cache.markdown_content = result.markdown_content
            cache.metadata_json = result.metadata
            cache.content_hash = content_hash
            cache.status = "ready"
            cache.expires_at = now + timedelta(days=7)
        self.session.flush()
        return ReadResult(
            title=result.title,
            markdown_content=result.markdown_content,
            provider=result.provider,
            metadata=result.metadata,
        )

    def _fetch_candidate_markdown(
        self,
        planned_candidates: list[dict[str, Any]],
        cached_results: dict[str, ReadResult],
    ) -> tuple[dict[str, ReadResult], dict[str, Exception]]:
        prefetched_results: dict[str, ReadResult] = {}
        fetch_errors: dict[str, Exception] = {}
        urls_to_fetch = [
            item["candidate"]["url"]
            for item in planned_candidates
            if item["candidate"]["url"] not in cached_results
        ]
        if not urls_to_fetch:
            return prefetched_results, fetch_errors
        max_workers = max(1, min(self.mcp.settings.max_research_concurrency, len(urls_to_fetch)))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_map = {
                executor.submit(self.mcp.read_url_markdown, url): url
                for url in urls_to_fetch
            }
            for future in as_completed(future_map):
                url = future_map[future]
                try:
                    prefetched_results[url] = future.result()
                except Exception as exc:
                    fetch_errors[url] = exc
        return prefetched_results, fetch_errors

    def _ingest_candidate_records(
        self,
        collection: SourceCollection,
        planned_candidates: list[dict[str, Any]],
        cached_results: dict[str, ReadResult],
        prefetched_results: dict[str, ReadResult],
        fetch_errors: dict[str, Exception],
        on_candidate_progress: Callable[[dict[str, Any]], None] | None = None,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]], int, list[str]]:
        ingested_count = 0
        failed_urls: list[str] = []
        candidate_sources: list[dict[str, Any]] = []
        pending_chunk_records: list[dict[str, Any]] = []
        total_candidates = len(planned_candidates)
        for item in planned_candidates:
            candidate = item["candidate"]
            result = item["result"]
            normalized_url = candidate["url"]
            try:
                read_result = cached_results.get(normalized_url)
                if read_result is None:
                    if normalized_url in fetch_errors:
                        raise fetch_errors[normalized_url]
                    prefetched = prefetched_results.get(normalized_url)
                    if prefetched is None:
                        raise RuntimeError("markdown prefetch missing result")
                    read_result = self._store_read_result(normalized_url, prefetched)
                document, chunks, reused_existing = self._upsert_source_document(
                    collection,
                    result,
                    read_result,
                    defer_embedding=True,
                )
                candidate["title"] = read_result.title or result.title
                candidate["content_excerpt_md"] = self._clip_excerpt(read_result.markdown_content, limit=320)
                candidate["read_status"] = "reused" if item["cached"] or reused_existing else "ready"
                candidate["source_document_id"] = document.id
                candidate_sources.append(candidate)
                if chunks:
                    pending_chunk_records.extend(
                        {
                            "document": document,
                            "chunk": chunk,
                        }
                        for chunk in chunks
                    )
                ingested_count += 1
            except Exception as exc:
                candidate["read_status"] = "failed"
                candidate["vector_status"] = "failed"
                candidate_sources.append(candidate)
                failed_urls.append(f"{normalized_url}: {exc}")
            if on_candidate_progress is not None:
                on_candidate_progress(
                    {
                        "completed": len(candidate_sources),
                        "total": total_candidates,
                        "ingested_count": ingested_count,
                        "failed_count": len(failed_urls),
                        "candidate_sources": self.build_search_result_cards(candidate_sources),
                        "latest_candidate": candidate.copy(),
                    }
                )
        return candidate_sources, pending_chunk_records, ingested_count, failed_urls

    def _upsert_source_document(
        self,
        collection: SourceCollection,
        search_result: SearchResult,
        read_result: ReadResult,
        *,
        defer_embedding: bool = False,
    ) -> tuple[SourceDocument, list[dict[str, Any]], bool]:
        normalized_url = self._normalize_url(search_result.url)
        cache = self.session.scalar(select(URLContentCache).where(URLContentCache.normalized_url == normalized_url))
        document = self.session.scalar(
            select(SourceDocument).where(
                SourceDocument.collection_id == collection.id,
                SourceDocument.source_uri == normalized_url,
            )
        )
        content_hash = self._hash_text(read_result.markdown_content)
        if document is None:
            document = SourceDocument(
                collection_id=collection.id,
                source_type="url",
                source_uri=normalized_url,
                url_cache_id=cache.id if cache else None,
                title=read_result.title or search_result.title,
                markdown_content=read_result.markdown_content,
                metadata_json={
                    "provider": read_result.provider,
                    "snippet": search_result.snippet,
                    **read_result.metadata,
                },
                content_hash=content_hash,
                status="ready",
            )
            self.session.add(document)
            self.session.flush()
            reused_existing = False
        elif document.content_hash == content_hash and self.session.scalar(
            select(SourceChunk.id).where(SourceChunk.source_document_id == document.id).limit(1)
        ):
            return document, [], True
        else:
            document.url_cache_id = cache.id if cache else document.url_cache_id
            document.title = read_result.title or search_result.title
            document.markdown_content = read_result.markdown_content
            document.metadata_json = {
                "provider": read_result.provider,
                "snippet": search_result.snippet,
                **read_result.metadata,
            }
            document.content_hash = content_hash
            document.status = "ready"
            self.session.execute(delete(SourceChunk).where(SourceChunk.source_document_id == document.id))
            self.session.flush()
            reused_existing = False

        chunks = self._chunk_markdown(document.title, document.markdown_content)
        if defer_embedding:
            return document, chunks, reused_existing
        self._store_chunk_embeddings(
            [
                {
                    "document": document,
                    "chunk": item,
                }
                for item in chunks
            ]
        )
        return document, [], reused_existing

    def _store_chunk_embeddings(
        self,
        chunk_records: list[dict[str, Any]],
        *,
        on_embedding_progress: Callable[[dict[str, Any]], None] | None = None,
    ) -> None:
        if not chunk_records:
            return
        batch_size = 32
        embeddings: list[list[float] | None] = [None] * len(chunk_records)
        total_chunks = len(chunk_records)
        total_documents = len({item["document"].id for item in chunk_records})
        for start in range(0, len(chunk_records), batch_size):
            batch = chunk_records[start : start + batch_size]
            texts = [item["chunk"]["content_for_embedding"] for item in batch]
            batch_embeddings = self.models.embed_texts(texts)
            for index, embedding in enumerate(batch_embeddings):
                embeddings[start + index] = embedding
            if on_embedding_progress is not None:
                on_embedding_progress(
                    {
                        "completed_chunks": min(start + len(batch), total_chunks),
                        "total_chunks": total_chunks,
                        "document_count": total_documents,
                    }
                )

        for index, item in enumerate(chunk_records):
            document = item["document"]
            chunk = item["chunk"]
            self.session.add(
                SourceChunk(
                    source_document_id=document.id,
                    chunk_index=chunk["chunk_index"],
                    section_path=chunk["section_path"],
                    content_md=chunk["content_md"],
                    content_for_embedding=chunk["content_for_embedding"],
                    embedding=embeddings[index] if index < len(embeddings) else None,
                    token_count=chunk["token_count"],
                )
            )
        self.session.flush()

    def _chunk_markdown(self, title: str, markdown: str) -> list[dict[str, Any]]:
        chunks: list[dict[str, Any]] = []
        current_section = title or "正文"
        buffer: list[str] = []

        def flush() -> None:
            nonlocal buffer
            content = "\n".join(line for line in buffer if line.strip()).strip()
            if not content:
                buffer = []
                return
            content_for_embedding = f"{title}\n{current_section}\n{content}".strip()
            chunks.append(
                {
                    "chunk_index": len(chunks),
                    "section_path": current_section,
                    "content_md": content[:4000],
                    "content_for_embedding": content_for_embedding[:5000],
                    "token_count": self._estimate_token_count(content_for_embedding),
                }
            )
            buffer = []

        for raw_line in markdown.splitlines():
            line = raw_line.strip()
            if not line:
                flush()
                continue
            if re.match(r"^#{1,6}\s+", line):
                flush()
                current_section = line.lstrip("#").strip() or current_section
                continue
            buffer.append(line)
            if len("\n".join(buffer)) > 800:
                flush()
        flush()

        if not chunks:
            content = markdown.strip()[:4000]
            chunks.append(
                {
                    "chunk_index": 0,
                    "section_path": title or "正文",
                    "content_md": content,
                    "content_for_embedding": f"{title}\n{content}".strip()[:5000],
                    "token_count": self._estimate_token_count(content),
                }
            )
        return chunks

    def _get_or_create_citation(
        self,
        project_id: str,
        document: SourceDocument,
        chunk: SourceChunk,
        excerpt_md: str,
    ) -> Citation:
        citation = self.session.scalar(
            select(Citation).where(Citation.project_id == project_id, Citation.chunk_id == chunk.id)
        )
        if citation is None:
            citation = Citation(
                project_id=project_id,
                source_document_id=document.id,
                chunk_id=chunk.id,
                title=document.title,
                url=document.source_uri,
                excerpt_md=excerpt_md,
                citation_label=self._build_citation_label(document.title, document.source_uri),
            )
            self.session.add(citation)
            self.session.flush()
        return citation

    def _selected_source_payload(self, item: ProjectResearchSource) -> dict[str, Any]:
        document = item.source_document
        chunk = item.chunk
        return {
            "source_document_id": item.source_document_id,
            "chunk_id": item.chunk_id,
            "title": document.title if document else "",
            "url": document.source_uri if document else "",
            "excerpt_md": item.excerpt_md,
            "content_md": chunk.content_md if chunk else "",
            "rank_no": item.rank_no,
            "relevance_score": item.relevance_score,
            "usage_note": item.usage_note,
        }

    def _normalize_query_items(self, payload: Any) -> list[dict[str, str]]:
        if not isinstance(payload, list):
            return []
        items: list[dict[str, str]] = []
        for raw_item in payload:
            if not isinstance(raw_item, dict):
                continue
            query_text = str(raw_item.get("query_text") or raw_item.get("query") or "").strip()
            query_purpose = str(raw_item.get("query_purpose") or raw_item.get("intent") or "").strip()
            if query_text:
                items.append({"query_text": query_text, "query_purpose": query_purpose})
        return items

    def _build_citation_label(self, title: str, url: str) -> str:
        return (title or url)[:60]

    def _query_key(self, query: str) -> str:
        normalized = re.sub(r"\s+", " ", query).strip().lower()
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def _normalize_url(self, url: str) -> str:
        cleaned, _ = urldefrag(url.strip())
        return cleaned

    def _hash_text(self, text: str) -> str:
        return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()

    def _estimate_token_count(self, text: str) -> int:
        return max(1, len(text.split()))

    def _keyword_score(self, query: str, text: str) -> float:
        query_tokens = set(self._tokenize(query))
        text_tokens = set(self._tokenize(text))
        if not query_tokens or not text_tokens:
            return 0.0
        return len(query_tokens & text_tokens) / max(len(query_tokens), 1)

    def _cosine_similarity(self, left: list[float] | None, right: list[float] | None) -> float:
        if not left or not right or len(left) != len(right):
            return 0.0
        numerator = sum(a * b for a, b in zip(left, right))
        left_norm = math.sqrt(sum(a * a for a in left))
        right_norm = math.sqrt(sum(b * b for b in right))
        if left_norm == 0 or right_norm == 0:
            return 0.0
        return max(0.0, numerator / (left_norm * right_norm))

    def _tokenize(self, text: str) -> list[str]:
        return [token for token in re.split(r"[^0-9A-Za-z\u4e00-\u9fff]+", text.lower()) if token]

    def _clip_excerpt(self, content: str, limit: int = 220) -> str:
        cleaned = re.sub(r"\s+", " ", content).strip()
        return cleaned[:limit]

    def _is_duplicate_excerpt(self, excerpt: str, existing: list[str]) -> bool:
        current_tokens = set(self._tokenize(excerpt))
        if not current_tokens:
            return False
        for item in existing:
            tokens = set(self._tokenize(item))
            if not tokens:
                continue
            jaccard = len(current_tokens & tokens) / len(current_tokens | tokens)
            if jaccard >= 0.8:
                return True
        return False

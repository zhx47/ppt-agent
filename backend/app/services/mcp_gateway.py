from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import Settings, get_settings


@dataclass(frozen=True)
class SearchResult:
    title: str
    url: str
    snippet: str
    provider: str = "bocha-mcp"


@dataclass(frozen=True)
class ReadResult:
    title: str
    markdown_content: str
    provider: str
    metadata: dict[str, Any]


class McpGateway:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    def search_web(self, query: str, limit: int = 5) -> list[SearchResult]:
        if not self.settings.mcp_bocha_auth_header:
            raise RuntimeError("未配置 Bocha 搜索鉴权信息")
        try:
            headers = {"Authorization": self.settings.mcp_bocha_auth_header}
            response = httpx.post(
                "https://api.bochaai.com/v1/web-search",
                headers=headers,
                json={"query": query, "summary": True, "count": limit},
                timeout=20,
            )
            response.raise_for_status()
            return self._parse_bocha_results(response.json(), limit)
        except Exception as exc:
            raise RuntimeError(f"bocha search failed: {exc}") from exc

    def read_url_markdown(self, url: str) -> ReadResult:
        providers: list[str] = []
        if self.settings.mcp_jina_url:
            providers.append("jina")
        if self.settings.mcp_firecrawl_url:
            providers.append("firecrawl")
        if self.settings.mcp_fetch_url:
            providers.append("fetch")
        if not providers:
            raise RuntimeError("未配置任何 Markdown 读取 provider")

        last_error: Exception | None = None
        for provider in providers:
            try:
                if provider == "jina":
                    return self._read_with_jina(url)
                if provider == "firecrawl":
                    return self._read_with_firecrawl(url)
                return self._read_with_fetch(url)
            except Exception as exc:
                last_error = exc

        raise RuntimeError(f"all markdown readers failed for {url}: {last_error}")

    def _parse_bocha_results(self, payload: dict[str, Any], limit: int) -> list[SearchResult]:
        candidates = payload.get("data", payload)
        web_pages = candidates.get("webPages") or candidates.get("webpages") or candidates.get("value") or {}
        items: list[dict[str, Any]]
        if isinstance(web_pages, dict):
            items = web_pages.get("value") or web_pages.get("items") or []
        else:
            items = web_pages
        return [
            SearchResult(
                title=item.get("name") or item.get("title") or f"来源 {index}",
                url=item.get("url") or item.get("link") or "",
                snippet=item.get("snippet") or item.get("summary") or item.get("description") or "",
            )
            for index, item in enumerate(items[:limit], start=1)
            if item.get("url") or item.get("link")
        ]

    def _read_with_jina(self, url: str) -> ReadResult:
        normalized = re.sub(r"^https?://", "", url, flags=re.IGNORECASE)
        headers: dict[str, str] = {}
        if self.settings.mcp_jina_auth_header:
            headers["Authorization"] = self.settings.mcp_jina_auth_header
        response = httpx.get(f"https://r.jina.ai/http://{normalized}", headers=headers, timeout=30)
        response.raise_for_status()
        raw_markdown = response.text.strip()
        markdown = self._strip_jina_wrapper(raw_markdown)
        if len(markdown) < 120:
            raise RuntimeError("jina markdown too short")
        return ReadResult(
            title=self._extract_markdown_title(url, raw_markdown),
            markdown_content=markdown,
            provider="jina",
            metadata={"source_url": url},
        )

    def _read_with_firecrawl(self, url: str) -> ReadResult:
        response = httpx.post(
            self.settings.mcp_firecrawl_url.rstrip("/"),
            json={"url": url, "formats": ["markdown"]},
            timeout=45,
        )
        response.raise_for_status()
        payload = response.json()
        markdown = (
            payload.get("markdown")
            or payload.get("data", {}).get("markdown")
            or payload.get("result", {}).get("markdown")
            or ""
        ).strip()
        if len(markdown) < 120:
            raise RuntimeError("firecrawl markdown too short")
        return ReadResult(
            title=self._extract_markdown_title(url, markdown),
            markdown_content=markdown,
            provider="firecrawl",
            metadata={"source_url": url, "payload_meta": payload.get("metadata", {})},
        )

    def _read_with_fetch(self, url: str) -> ReadResult:
        response = httpx.get(url, timeout=30, follow_redirects=True)
        response.raise_for_status()
        content_type = (response.headers.get("content-type") or "").lower()
        if "text/markdown" not in content_type and "text/plain" not in content_type:
            raise RuntimeError("fetch provider did not return markdown/plain text")
        markdown = response.text.strip()
        if len(markdown) < 120:
            raise RuntimeError("fetch markdown too short")
        return ReadResult(
            title=self._extract_markdown_title(url, markdown),
            markdown_content=markdown,
            provider="fetch",
            metadata={"source_url": url},
        )

    def _extract_markdown_title(self, url: str, markdown: str) -> str:
        for line in markdown.splitlines():
            cleaned = re.sub(r"^Title:\s*", "", line.strip().lstrip("#").strip(), flags=re.IGNORECASE)
            if cleaned:
                return cleaned[:180]
        return url

    def _strip_jina_wrapper(self, markdown: str) -> str:
        lines = markdown.splitlines()
        if len(lines) < 5:
            return markdown
        if not lines[0].startswith("Title:"):
            return markdown

        body_start = None
        for index, line in enumerate(lines):
            if line.strip() == "Markdown Content:":
                body_start = index + 1
                break
        if body_start is None:
            return markdown

        cleaned = "\n".join(lines[body_start:]).strip()
        return cleaned or markdown

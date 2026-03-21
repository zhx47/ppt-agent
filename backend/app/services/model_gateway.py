from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

import httpx
from openai import OpenAI

from app.core.config import Settings, get_settings

_CHAT_PATHS = {"/chat/completions", "chat/completions", "/v1/chat/completions"}
_EMBEDDING_PATHS = {"/embeddings", "embeddings", "/v1/embeddings"}


@dataclass(frozen=True)
class _ModelConfig:
    base_url: str | None
    api_key: str | None
    model: str
    path: str
    timeout_seconds: int

    @property
    def enabled(self) -> bool:
        return bool(self.api_key and self.model)


class _OpenAICompatibleClient:
    def __init__(self, config: _ModelConfig):
        self.config = config
        self._sdk_client: OpenAI | None = None

    def chat_text(self, system_prompt: str, user_prompt: str, *, temperature: float = 0.2, json_mode: bool = False) -> str:
        if not self.config.enabled:
            raise RuntimeError(f"模型未启用: {self.config.model}")
        if self.config.path in _CHAT_PATHS:
            client = self._get_sdk_client()
            payload: dict[str, Any] = {
                "model": self.config.model,
                "temperature": temperature,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "timeout": self.config.timeout_seconds,
            }
            if json_mode:
                payload["response_format"] = {"type": "json_object"}
            response = client.chat.completions.create(**payload)
            return response.choices[0].message.content or ""

        response = httpx.post(
            self._build_url(),
            headers=self._headers(),
            json={
                "model": self.config.model,
                "temperature": temperature,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                **({"response_format": {"type": "json_object"}} if json_mode else {}),
            },
            timeout=self.config.timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
        return payload["choices"][0]["message"]["content"] or ""

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts or not self.config.enabled:
            return []
        if self.config.path in _EMBEDDING_PATHS:
            client = self._get_sdk_client()
            response = client.embeddings.create(model=self.config.model, input=texts, timeout=self.config.timeout_seconds)
            return [list(item.embedding) for item in response.data]

        response = httpx.post(
            self._build_url(),
            headers=self._headers(),
            json={"model": self.config.model, "input": texts},
            timeout=self.config.timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
        return [list(item["embedding"]) for item in payload["data"]]

    def _get_sdk_client(self) -> OpenAI:
        if self._sdk_client is None:
            kwargs: dict[str, Any] = {
                "api_key": self.config.api_key or "",
                "timeout": self.config.timeout_seconds,
                "max_retries": 0,
            }
            if self.config.base_url:
                kwargs["base_url"] = self.config.base_url
            self._sdk_client = OpenAI(**kwargs)
        return self._sdk_client

    def _build_url(self) -> str:
        if not self.config.base_url:
            raise RuntimeError("模型 base_url 未配置")
        return self.config.base_url.rstrip("/") + "/" + self.config.path.lstrip("/")

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.config.api_key or ''}",
            "Content-Type": "application/json",
        }


class ModelGateway:
    def __init__(self, settings: Settings | None = None):
        settings = settings or get_settings()
        self.settings = settings
        self._context = _OpenAICompatibleClient(
            _ModelConfig(
                base_url=settings.context_llm_base_url,
                api_key=settings.context_llm_api_key.get_secret_value() if settings.context_llm_api_key else None,
                model=settings.context_llm_model,
                path=settings.context_llm_path,
                timeout_seconds=settings.context_llm_timeout_seconds,
            )
        )
        self._svg = _OpenAICompatibleClient(
            _ModelConfig(
                base_url=settings.svg_llm_base_url,
                api_key=settings.svg_llm_api_key.get_secret_value() if settings.svg_llm_api_key else None,
                model=settings.svg_llm_model,
                path=settings.svg_llm_path,
                timeout_seconds=settings.svg_llm_timeout_seconds,
            )
        )
        self._embedding = _OpenAICompatibleClient(
            _ModelConfig(
                base_url=settings.embedding_base_url,
                api_key=settings.embedding_api_key.get_secret_value() if settings.embedding_api_key else None,
                model=settings.embedding_model,
                path=settings.embedding_path,
                timeout_seconds=settings.embedding_timeout_seconds,
            )
        )

    def context_json(self, system_prompt: str, user_payload: str | dict[str, Any], *, temperature: float = 0.2) -> dict[str, Any]:
        text = self._context.chat_text(
            system_prompt,
            self._serialize_user_payload(user_payload),
            temperature=temperature,
            json_mode=True,
        )
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            wrapped_json = self._extract_wrapped_json(text)
            if wrapped_json is None:
                raise RuntimeError("上下文模型返回的不是有效 JSON")
            return json.loads(wrapped_json)

    def context_text(self, system_prompt: str, user_payload: str | dict[str, Any], *, temperature: float = 0.2) -> str:
        return self._context.chat_text(
            system_prompt,
            self._serialize_user_payload(user_payload),
            temperature=temperature,
        )

    def svg_text(self, system_prompt: str, user_payload: str | dict[str, Any], *, temperature: float = 0.2) -> str:
        text = self._svg.chat_text(
            system_prompt,
            self._serialize_user_payload(user_payload),
            temperature=temperature,
        )
        matched = re.search(r"<svg[\s\S]*?</svg>", text)
        if matched is None:
            raise RuntimeError("SVG 模型没有返回有效的 <svg> 文档")
        return matched.group(0)

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return self._embedding.embed_texts(texts)

    def _serialize_user_payload(self, user_payload: str | dict[str, Any]) -> str:
        if isinstance(user_payload, str):
            return user_payload
        return json.dumps(user_payload, ensure_ascii=False)

    def _extract_wrapped_json(self, text: str) -> str | None:
        matched = re.search(r"\[(?P<tag>[A-Z_]+)\]\s*(?P<body>\{[\s\S]*\})\s*\[/\1\]", text)
        if matched is None:
            return None
        return matched.group("body")

    @property
    def has_context_model(self) -> bool:
        return self._context.config.enabled

    @property
    def has_svg_model(self) -> bool:
        return self._svg.config.enabled

    @property
    def has_embedding_model(self) -> bool:
        return self._embedding.config.enabled

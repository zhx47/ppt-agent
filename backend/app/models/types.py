from __future__ import annotations

import json
import os
from typing import Any

from sqlalchemy import JSON, Text
from sqlalchemy.engine import Dialect
from sqlalchemy.sql.type_api import TypeEngine
from sqlalchemy.types import TypeDecorator, UserDefinedType


class _PgVectorType(UserDefinedType):
    cache_ok = True

    def __init__(self, dimensions: int):
        self.dimensions = dimensions

    def get_col_spec(self, **_: Any) -> str:
        return "vector"


class EmbeddingVector(TypeDecorator[list[float] | None]):
    cache_ok = True
    impl = Text

    def __init__(self, dimensions: int = 1536):
        super().__init__()
        self.dimensions = dimensions

    def load_dialect_impl(self, dialect: Dialect) -> TypeEngine[Any]:
        if dialect.name == "postgresql" and os.getenv("PPT_DISABLE_PGVECTOR") != "1":
            return dialect.type_descriptor(_PgVectorType(self.dimensions))
        return dialect.type_descriptor(JSON())

    def process_bind_param(self, value: list[float] | None, dialect: Dialect) -> Any:
        if value is None:
            return None
        normalized = [float(item) for item in value]
        if dialect.name == "postgresql":
            return "[" + ",".join(f"{item:.12f}" for item in normalized) + "]"
        return normalized

    def process_result_value(self, value: Any, dialect: Dialect) -> list[float] | None:
        if value is None:
            return None
        if isinstance(value, list):
            return [float(item) for item in value]
        if isinstance(value, str):
            cleaned = value.strip().strip("[]")
            if not cleaned:
                return []
            return [float(item.strip()) for item in cleaned.split(",") if item.strip()]
        if isinstance(value, (bytes, bytearray)):
            return self.process_result_value(value.decode("utf-8"), dialect)
        return json.loads(value)

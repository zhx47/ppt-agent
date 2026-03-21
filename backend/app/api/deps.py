from __future__ import annotations

from app.core.db import get_db
from app.services.orchestrator import PptAgentService


def service_dependency():
    for db in get_db():
        yield PptAgentService(db)

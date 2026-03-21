from __future__ import annotations

from threading import Thread
from typing import Any, Callable

from app.core.config import get_settings


class BackgroundDispatcher:
    def dispatch(self, func: Callable[..., Any], *args: Any, **kwargs: Any) -> None:
        if get_settings().run_jobs_inline:
            func(*args, **kwargs)
            return
        thread = Thread(target=func, args=args, kwargs=kwargs, daemon=True)
        thread.start()


dispatcher = BackgroundDispatcher()


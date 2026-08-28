"""Log có cấu trúc + traceId theo từng request.

Mọi dòng log đều mang traceId để lần được toàn bộ vòng đời 1 request.
traceId cũng trả về trong phản hồi lỗi, nên người dùng báo lỗi kèm mã là tra ra ngay.
"""

from __future__ import annotations

import logging
import sys
import uuid
from contextvars import ContextVar

import structlog

from app.core.config import settings

_trace_id: ContextVar[str] = ContextVar("trace_id", default="-")


def set_trace_id(value: str | None = None) -> str:
    tid = value or uuid.uuid4().hex
    _trace_id.set(tid)
    return tid


def get_trace_id() -> str:
    return _trace_id.get()


def _inject_trace_id(_: object, __: str, event_dict: dict) -> dict:
    event_dict["traceId"] = get_trace_id()
    return event_dict


def configure_logging() -> None:
    """Dev: log màu dễ đọc. Production: JSON để máy đọc."""
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.DEBUG if settings.app_debug else logging.INFO,
    )

    processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        _inject_trace_id,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]
    processors.append(
        structlog.processors.JSONRenderer()
        if settings.is_production
        else structlog.dev.ConsoleRenderer(colors=True)
    )

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


logger = structlog.get_logger("vitaminfun")

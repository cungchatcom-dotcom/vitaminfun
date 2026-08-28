"""Điểm khởi động ứng dụng FastAPI."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging, logger, set_trace_id
from app.db.session import SessionFactory, dispose_engine
from app.modules.auth.router import router as auth_router
from app.modules.media.router import router as media_router
from app.modules.characters.router import router as characters_router
from app.modules.play.router import router as play_router
from app.modules.questions.router import router as questions_router
from app.modules.users.router import router as users_router
from app.modules.worlds.router import router as worlds_router


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    logger.info("api_starting", env=settings.app_env, prefix=settings.api_prefix)
    yield
    await dispose_engine()
    logger.info("api_stopped")


app = FastAPI(
    title=f"{settings.app_name} API",
    version="0.1.0",
    description=(
        "API nền tảng học tiếng Anh game hoá — Lost in Atlantis.\n\n"
        "**Quy ước lỗi:** mọi lỗi trả về `{error: {code, params, traceId}}`. "
        "Backend không trả chuỗi hiển thị — Frontend tra bảng dịch theo `code`."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)


@app.middleware("http")
async def trace_id_middleware(request: Request, call_next) -> Response:  # type: ignore[no-untyped-def]
    """Gắn traceId cho mỗi request; trả về trong header để client báo lỗi kèm mã."""
    trace_id = set_trace_id(request.headers.get("X-Trace-Id"))
    response = await call_next(request)
    response.headers["X-Trace-Id"] = trace_id
    return response


@app.get("/health", tags=["system"], summary="Kiểm tra tình trạng hệ thống")
async def health() -> dict[str, object]:
    checks: dict[str, str] = {}
    try:
        async with SessionFactory() as session:
            await session.execute(text("SELECT 1"))
        checks["db"] = "ok"
    except Exception as exc:
        logger.warning("health_db_failed", error=str(exc))
        checks["db"] = "error"

    healthy = all(v == "ok" for v in checks.values())
    return {
        "status": "ok" if healthy else "degraded",
        "env": settings.app_env,
        "version": app.version,
        "checks": checks,
    }


# --------------------------------------------------------------------------
# Router nghiệp vụ — gắn dần theo từng bước
# --------------------------------------------------------------------------

app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(users_router, prefix=settings.api_prefix)
app.include_router(questions_router, prefix=settings.api_prefix)
app.include_router(media_router, prefix=settings.api_prefix)
app.include_router(worlds_router, prefix=settings.api_prefix)
app.include_router(play_router, prefix=settings.api_prefix)
app.include_router(characters_router, prefix=settings.api_prefix)

# Cùng một /health ở cả gốc lẫn dưới api_prefix: nginx và monitoring hay gọi
# đường có tiền tố, còn smoke test lúc dev thì gọi đường gốc cho nhanh.
app.add_api_route(f"{settings.api_prefix}/health", health, tags=["system"])


# --------------------------------------------------------------------------
# Phục vụ file media
# --------------------------------------------------------------------------
# CHỈ dùng lúc dev. Trên server thật, nginx phục vụ /media thẳng từ đĩa
# (DEPLOY.md §7) — nhanh hơn nhiều và không chiếm worker của Python.
if settings.storage_backend == "local":
    from fastapi.staticfiles import StaticFiles

    from app.modules.media.service import storage_root

    app.mount("/media", StaticFiles(directory=str(storage_root())), name="media")

"""Chuẩn lỗi toàn hệ thống.

LUẬT: Backend KHÔNG BAO GIỜ trả chuỗi tiếng Việt/Anh cho người dùng cuối.
Chỉ trả mã lỗi + tham số; Frontend tra `messages/vi.json` và hiển thị.

Dạng phản hồi lỗi thống nhất:
    {
      "error": {
        "code": "AUTH_INVALID_CREDENTIALS",
        "params": {},
        "traceId": "a1b2c3..."
      }
    }
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_trace_id, logger


class ErrorCode:
    """Danh mục mã lỗi. Mỗi mã ứng với một key trong `web/messages/*.json`.

    Thêm mã mới thì phải thêm bản dịch cùng lúc — mã không có bản dịch sẽ hiện
    ra màn hình dưới dạng chữ in hoa gạch dưới, và người dùng sẽ báo là lỗi.
    """

    # --- Chung ---
    INTERNAL_ERROR = "INTERNAL_ERROR"
    VALIDATION_FAILED = "VALIDATION_FAILED"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    RATE_LIMITED = "RATE_LIMITED"

    # --- Xác thực ---
    AUTH_INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS"
    AUTH_TOKEN_EXPIRED = "AUTH_TOKEN_EXPIRED"
    AUTH_TOKEN_INVALID = "AUTH_TOKEN_INVALID"
    AUTH_ACCOUNT_SUSPENDED = "AUTH_ACCOUNT_SUSPENDED"
    AUTH_REQUIRED = "AUTH_REQUIRED"

    # --- Phân quyền ---
    PERMISSION_DENIED = "PERMISSION_DENIED"
    ROLE_REQUIRED = "ROLE_REQUIRED"

    # --- Soạn câu hỏi ---
    # Mã riêng cho từng lỗi thay vì gộp vào VALIDATION_FAILED: giáo viên đang
    # soạn bài cần biết SAI Ở ĐÂU. Báo chung chung "thông tin chưa hợp lệ" trên
    # một biểu mẫu có chục ô là bắt người ta đoán.
    QUESTION_TYPE_NOT_SUPPORTED = "QUESTION_TYPE_NOT_SUPPORTED"
    QUESTION_FIELD_EMPTY = "QUESTION_FIELD_EMPTY"
    QUESTION_OPTION_COUNT = "QUESTION_OPTION_COUNT"
    QUESTION_OPTION_EMPTY = "QUESTION_OPTION_EMPTY"
    QUESTION_OPTION_NO_ID = "QUESTION_OPTION_NO_ID"
    QUESTION_OPTION_DUPLICATE_ID = "QUESTION_OPTION_DUPLICATE_ID"
    QUESTION_OPTION_DUPLICATE_TEXT = "QUESTION_OPTION_DUPLICATE_TEXT"
    QUESTION_NO_CORRECT_ANSWER = "QUESTION_NO_CORRECT_ANSWER"
    QUESTION_CORRECT_DUPLICATE = "QUESTION_CORRECT_DUPLICATE"
    QUESTION_CORRECT_NOT_IN_OPTIONS = "QUESTION_CORRECT_NOT_IN_OPTIONS"
    QUESTION_ALL_OPTIONS_CORRECT = "QUESTION_ALL_OPTIONS_CORRECT"
    QUESTION_NO_GAP = "QUESTION_NO_GAP"
    QUESTION_TOO_MANY_GAPS = "QUESTION_TOO_MANY_GAPS"
    QUESTION_GAP_DUPLICATE = "QUESTION_GAP_DUPLICATE"
    QUESTION_GAP_NO_ANSWER = "QUESTION_GAP_NO_ANSWER"
    QUESTION_GAP_OPTION_COUNT = "QUESTION_GAP_OPTION_COUNT"
    #: Câu hỏi đang được một màn chơi dùng — không cho xoá.
    QUESTION_IN_USE = "QUESTION_IN_USE"

    # --- Nhap khau tu file .xlsx cua bo phan noi dung ---
    #: File khong mo duoc: khong phai .xlsx, hong, hoac duoc bao ve bang mat khau.
    IMPORT_FILE_UNREADABLE = "IMPORT_FILE_UNREADABLE"
    #: Thieu han mot sheet bat buoc. Bao kem danh sach sheet tim thay, vi nguyen
    #: nhan thuong gap nhat la nguoi dung doi ten sheet hoac gui nham file.
    IMPORT_SHEET_MISSING = "IMPORT_SHEET_MISSING"
    #: Co sheet nhung khong tim thay hang tieu de mang du cac cot bat buoc.
    IMPORT_HEADER_MISSING = "IMPORT_HEADER_MISSING"
    #: Khong dong nao dung dinh dang. Bao rieng vi "nhap 0 cau" trong nhu thanh
    #: cong, va nguoi dung se ngoi doi mot thu khong bao gio toi.
    IMPORT_NO_ROWS = "IMPORT_NO_ROWS"

    # --- Dựng nội dung game ---
    #: Chương còn màn chơi bên trong — xoá màn trước đã.
    CHAPTER_HAS_STAGES = "CHAPTER_HAS_STAGES"
    #: Màn đã có người chơi — xoá là mất lịch sử chơi và mọi báo cáo dựa trên nó.
    STAGE_HAS_RUNS = "STAGE_HAS_RUNS"
    #: Mỗi màn phải giữ đúng một nhiệm vụ NPC — không xoá, không hạ xuống thường.
    ADVISOR_QUEST_REQUIRED = "ADVISOR_QUEST_REQUIRED"
    #: Màn đã có nhiệm vụ NPC rồi — không nâng thêm cái thứ hai lên.
    ADVISOR_QUEST_EXISTS = "ADVISOR_QUEST_EXISTS"

    # --- Media ---
    MEDIA_KIND_NOT_ALLOWED = "MEDIA_KIND_NOT_ALLOWED"
    MEDIA_TOO_LARGE = "MEDIA_TOO_LARGE"
    MEDIA_EMPTY_FILE = "MEDIA_EMPTY_FILE"


class AppError(Exception):
    """Lỗi nghiệp vụ có mã. Dùng thay cho HTTPException ở mọi nơi."""

    def __init__(
        self,
        code: str,
        *,
        http_status: int = status.HTTP_400_BAD_REQUEST,
        params: dict[str, Any] | None = None,
    ) -> None:
        self.code = code
        self.http_status = http_status
        self.params = params or {}
        super().__init__(code)


class NotFoundError(AppError):
    def __init__(self, code: str = ErrorCode.NOT_FOUND, **params: Any) -> None:
        super().__init__(code, http_status=status.HTTP_404_NOT_FOUND, params=params)


class UnauthorizedError(AppError):
    def __init__(self, code: str = ErrorCode.AUTH_REQUIRED, **params: Any) -> None:
        super().__init__(code, http_status=status.HTTP_401_UNAUTHORIZED, params=params)


class ForbiddenError(AppError):
    def __init__(self, code: str = ErrorCode.PERMISSION_DENIED, **params: Any) -> None:
        super().__init__(code, http_status=status.HTTP_403_FORBIDDEN, params=params)


class ConflictError(AppError):
    def __init__(self, code: str = ErrorCode.CONFLICT, **params: Any) -> None:
        super().__init__(code, http_status=status.HTTP_409_CONFLICT, params=params)


class ValidationFailedError(AppError):
    """Dữ liệu gửi lên đúng kiểu nhưng sai về nghiệp vụ.

    Khác với 422 do Pydantic sinh tự động (sai kiểu, thiếu trường): loại đó là
    lỗi lập trình phía client, còn loại này là điều người dùng làm sai và cần
    được giải thích bằng tiếng của họ.
    """

    def __init__(self, code: str = ErrorCode.VALIDATION_FAILED, **params: Any) -> None:
        super().__init__(code, http_status=422, params=params)


def _envelope(code: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "error": {
            "code": code,
            "params": params or {},
            "traceId": get_trace_id(),
        }
    }


def register_exception_handlers(app: FastAPI) -> None:
    """Gắn toàn bộ handler lỗi vào app. Gọi 1 lần trong main.py."""

    @app.exception_handler(AppError)
    async def _handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.http_status, content=_envelope(exc.code, exc.params))

    @app.exception_handler(RequestValidationError)
    async def _handle_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        # Gom lỗi theo field để FE tô đỏ đúng ô nhập.
        fields = [
            {
                "field": ".".join(str(p) for p in err["loc"][1:]) or str(err["loc"][0]),
                "rule": err["type"],
            }
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content=_envelope(ErrorCode.VALIDATION_FAILED, {"fields": fields}),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _handle_http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {
            401: ErrorCode.AUTH_REQUIRED,
            403: ErrorCode.PERMISSION_DENIED,
            404: ErrorCode.NOT_FOUND,
            409: ErrorCode.CONFLICT,
            429: ErrorCode.RATE_LIMITED,
        }.get(exc.status_code, ErrorCode.INTERNAL_ERROR)
        return JSONResponse(status_code=exc.status_code, content=_envelope(code))

    @app.exception_handler(Exception)
    async def _handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        # Lỗi ngoài dự kiến: ghi log đầy đủ, nhưng KHÔNG lộ chi tiết ra ngoài.
        logger.exception("unhandled_exception", error=str(exc))
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_envelope(ErrorCode.INTERNAL_ERROR),
        )

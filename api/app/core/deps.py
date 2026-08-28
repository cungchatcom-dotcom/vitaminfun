"""Dependency dùng chung cho FastAPI: lấy user hiện tại, kiểm tra vai trò.

Đây là chỗ DUY NHẤT được phép quyết định "ai được làm gì". Không viết
`if user.role == "teacher"` rải rác trong router — dùng `require_role()`.
"""

from __future__ import annotations

from typing import Annotated

import jwt
from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ErrorCode, ForbiddenError, UnauthorizedError
from app.core.security import decode_token
from app.db.models.user import User, UserRole, UserStatus
from app.db.session import get_db


def _extract_token(request: Request) -> str:
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:]
    raise UnauthorizedError(ErrorCode.AUTH_REQUIRED)


async def get_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Giải mã access token và nạp user.

    Vai trò lấy từ DATABASE chứ không từ token. Token chỉ mang `role` để phía
    giao diện điều hướng nhanh; nếu tin claim đó ở đây thì ai sửa được token là
    tự phong mình làm giáo viên.
    """
    token = _extract_token(request)

    try:
        payload = decode_token(token, expected_type="access")
    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedError(ErrorCode.AUTH_TOKEN_EXPIRED) from exc
    except jwt.InvalidTokenError as exc:
        raise UnauthorizedError(ErrorCode.AUTH_TOKEN_INVALID) from exc

    user = await db.scalar(select(User).where(User.id == payload.user_id))
    if user is None or user.deleted_at is not None:
        raise UnauthorizedError(ErrorCode.AUTH_TOKEN_INVALID)

    if user.status == UserStatus.SUSPENDED:
        raise UnauthorizedError(ErrorCode.AUTH_ACCOUNT_SUSPENDED)

    # Admin đổi vai trò của một người thì perm_version tăng, token cũ lệch và bị
    # từ chối ngay — không phải chờ token hết hạn.
    if payload.perm_version != user.perm_version:
        raise UnauthorizedError(ErrorCode.AUTH_TOKEN_INVALID)

    return user


async def get_optional_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User | None:
    """Như `get_current_user` nhưng KHÔNG ném lỗi khi chưa đăng nhập."""
    if not request.headers.get("Authorization", "").startswith("Bearer "):
        return None
    try:
        return await get_current_user(request, db)
    except (UnauthorizedError, ForbiddenError):
        # Token hỏng hoặc hết hạn thì coi như khách vãng lai, không chặn trang.
        return None


def require_role(*allowed: str):
    """Dependency chặn theo vai trò.

        @router.post("/worlds", dependencies=[Depends(require_role(UserRole.TEACHER))])

    Lưu ý về ADMIN: admin KHÔNG tự động qua được mọi cửa. Muốn admin vào thì
    phải ghi tên admin ra. Một `if role == ADMIN: return` ẩn ở đây nghĩa là
    không đọc chữ ký hàm mà biết được ai vào được — và đó là kiểu quyền hay bị
    cấp nhầm nhất.
    """
    if not allowed:
        raise ValueError("require_role() phải nhận ít nhất một vai trò")
    unknown = set(allowed) - set(UserRole.ALL)
    if unknown:
        # Bắt lỗi gõ sai ngay lúc import module, không phải lúc có request đầu tiên.
        raise ValueError(f"Vai trò không tồn tại: {sorted(unknown)}")

    async def _guard(current: Annotated[User, Depends(get_current_user)]) -> User:
        if current.role not in allowed:
            raise ForbiddenError(
                ErrorCode.ROLE_REQUIRED,
                required=list(allowed),
                actual=current.role,
            )
        return current

    return _guard


def is_preview_role(user: User | None) -> bool:
    """Người này đang chơi THỬ hay chơi THẬT.

    Dùng ở mọi endpoint /play để đặt `stage_runs.is_trial` và để mở rộng tầm
    nhìn sang nội dung còn ở trạng thái draft. Xem docs/ARCHITECTURE.md §4.
    """
    return user is not None and user.role in UserRole.CAN_PREVIEW


CurrentUserDep = Annotated[User, Depends(get_current_user)]
OptionalUserDep = Annotated[User | None, Depends(get_optional_user)]
DbDep = Annotated[AsyncSession, Depends(get_db)]

__all__ = [
    "CurrentUserDep",
    "DbDep",
    "OptionalUserDep",
    "get_current_user",
    "get_optional_user",
    "is_preview_role",
    "require_role",
]

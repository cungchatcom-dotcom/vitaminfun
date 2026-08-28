"""Nghiệp vụ xác thực."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import ErrorCode, UnauthorizedError
from app.core.security import hash_password, needs_rehash, verify_password
from app.db.models.user import User, UserRole, UserStatus

#: Vai trò -> trang chủ. Bảng ánh xạ DUY NHẤT của cả hệ thống.
#: Frontend đọc `home_route` từ API chứ không giữ bản sao — hai bản sao của
#: cùng một bảng ánh xạ thì sẽ có ngày lệch nhau, và triệu chứng là đăng nhập
#: xong bị đá vòng vòng giữa hai trang.
HOME_ROUTE: dict[str, str] = {
    UserRole.ADMIN: "/admin",
    UserRole.TEACHER: "/teacher",
    UserRole.STUDENT: "/play",
}


def home_route_for(role: str) -> str:
    return HOME_ROUTE.get(role, "/play")


async def authenticate(db: AsyncSession, *, email: str, password: str) -> User:
    """Kiểm tra email + mật khẩu, trả về user nếu đúng.

    Mọi nhánh sai đều trả CÙNG một mã lỗi `AUTH_INVALID_CREDENTIALS`. Phân biệt
    "email không tồn tại" với "sai mật khẩu" là tặng cho người dò một công cụ
    liệt kê tài khoản có thật.
    """
    normalized = email.strip().lower()
    user = await db.scalar(select(User).where(User.email == normalized))

    if user is None or user.deleted_at is not None:
        # Vẫn băm một lần dù không có user, để thời gian phản hồi của "email sai"
        # và "mật khẩu sai" bằng nhau. Không làm thì đo thời gian là biết email
        # nào có thật.
        verify_password(password, _DUMMY_HASH)
        raise UnauthorizedError(ErrorCode.AUTH_INVALID_CREDENTIALS)

    if not verify_password(password, user.password_hash):
        raise UnauthorizedError(ErrorCode.AUTH_INVALID_CREDENTIALS)

    if user.status == UserStatus.SUSPENDED:
        raise UnauthorizedError(ErrorCode.AUTH_ACCOUNT_SUSPENDED)

    # Tham số Argon2 đã cũ thì băm lại — đây là lúc duy nhất ta có mật khẩu thô.
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)

    user.last_login_at = datetime.now(UTC)
    await db.commit()
    return user


#: Băm của một mật khẩu không ai dùng. Chỉ để đốt thời gian cho bằng nhánh thật.
_DUMMY_HASH = (
    "$argon2id$v=19$m=19456,t=2,p=1$"
    "c29tZXNhbHRzb21lc2FsdA$Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9vYmFy"
)


def access_token_ttl_seconds() -> int:
    return settings.jwt_access_token_minutes * 60

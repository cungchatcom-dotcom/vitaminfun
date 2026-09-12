"""Nghiệp vụ xác thực."""

from __future__ import annotations

import re
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import (
    ErrorCode,
    ForbiddenError,
    UnauthorizedError,
    ValidationFailedError,
)
from app.core.security import hash_password_async, needs_rehash, verify_password_async
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
        await verify_password_async(password, _DUMMY_HASH)
        raise UnauthorizedError(ErrorCode.AUTH_INVALID_CREDENTIALS)

    if not await verify_password_async(password, user.password_hash):
        raise UnauthorizedError(ErrorCode.AUTH_INVALID_CREDENTIALS)

    if user.status == UserStatus.SUSPENDED:
        raise UnauthorizedError(ErrorCode.AUTH_ACCOUNT_SUSPENDED)

    # Tham số Argon2 đã cũ thì băm lại — đây là lúc duy nhất ta có mật khẩu thô.
    if needs_rehash(user.password_hash):
        user.password_hash = await hash_password_async(password)

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


# --------------------------------------------------------------------------
# TỰ MỞ TÀI KHOẢN
# --------------------------------------------------------------------------

#: Dạng email, kiểm ở mức "trông như một địa chỉ email".
#:
#: CỐ Ý THÔ. Không có regex nào nhận đúng tập RFC 5322, và mọi bản cố gắng đều
#: dài hơn một màn hình rồi vẫn từ chối những địa chỉ có thật. Thứ duy nhất
#: chứng minh được một email dùng được là gửi thư tới đó — mà đó là việc của
#: bước xác minh, không phải của biểu mẫu này. Ở đây chỉ cần chặn cái lỗi gõ
#: nhầm hay gặp: thiếu `@`, thiếu tên miền, có dấu cách.
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")

#: Độ dài mật khẩu tối thiểu khi TỰ mở tài khoản.
#:
#: Chỉ áp ở đây, không áp ở đăng nhập: tài khoản do quản trị viên tạo trước đó
#: có thể có mật khẩu ngắn hơn, và chúng vẫn phải đăng nhập được.
MIN_PASSWORD_LENGTH = 8


async def signup(
    db: AsyncSession,
    *,
    email: str,
    display_name: str,
    password: str,
) -> User:
    """Mở một tài khoản HỌC SINH mới.

    Vai trò viết cứng là `student`, không nhận từ request. Cho phép người đăng
    ký tự chọn vai trò — kể cả chỉ bằng một trường ẩn — là trao quyền dựng nội
    dung cho bất kỳ ai điền xong ba ô.
    """
    if not settings.allow_self_signup:
        raise ForbiddenError(ErrorCode.SIGNUP_DISABLED)

    normalized = email.strip().lower()
    if not EMAIL_RE.match(normalized):
        raise ValidationFailedError(ErrorCode.SIGNUP_EMAIL_INVALID)

    name = display_name.strip()
    if not name:
        raise ValidationFailedError(ErrorCode.SIGNUP_NAME_REQUIRED)

    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValidationFailedError(
            ErrorCode.SIGNUP_PASSWORD_TOO_SHORT,
            min=MIN_PASSWORD_LENGTH,
        )

    # Hỏi trước cho câu trả lời đẹp, nhưng KHÔNG tin vào nó: giữa lần hỏi này
    # và lần ghi bên dưới, một request khác có thể chen vào với cùng email. Cái
    # chặn thật là ràng buộc UNIQUE ở database, và `IntegrityError` bên dưới
    # dịch nó về cùng một mã lỗi.
    if await db.scalar(select(User.id).where(User.email == normalized)):
        raise ValidationFailedError(ErrorCode.SIGNUP_EMAIL_TAKEN)

    user = User(
        email=normalized,
        password_hash=await hash_password_async(password),
        display_name=name,
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
        last_login_at=datetime.now(UTC),
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise ValidationFailedError(ErrorCode.SIGNUP_EMAIL_TAKEN) from exc

    await db.refresh(user)
    return user

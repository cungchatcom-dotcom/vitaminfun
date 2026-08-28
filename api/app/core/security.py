"""Băm mật khẩu (Argon2id) và phát/kiểm JWT.

Vì sao Argon2id chứ không phải bcrypt: Argon2id là bộ thắng Password Hashing
Competition, chống được cả tấn công GPU lẫn side-channel, và bcrypt có giới hạn
72 byte cho mật khẩu.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from app.core.config import settings

# Tham số theo khuyến nghị OWASP 2024 cho Argon2id.
_hasher = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)

TokenType = Literal["access", "refresh"]


def hash_password(plain: str) -> str:
    return _hasher.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _hasher.verify(hashed, plain)
    except (VerifyMismatchError, InvalidHashError, ValueError):
        return False


def needs_rehash(hashed: str) -> bool:
    """True khi tham số Argon2 đã cũ, nên băm lại lúc user đăng nhập thành công."""
    try:
        return _hasher.check_needs_rehash(hashed)
    except (InvalidHashError, ValueError):
        return True


def create_token(
    *,
    user_id: uuid.UUID,
    role: str,
    token_type: TokenType = "access",
    perm_version: int = 1,
    jti: str | None = None,
    extra: dict[str, Any] | None = None,
) -> str:
    """Phát JWT.

    `role` nằm trong token để middleware của Next điều hướng được mà không phải
    gọi thêm một vòng API cho mỗi lần chuyển trang. Middleware ĐỌC claim này mà
    KHÔNG kiểm chữ ký — xem web/src/middleware.ts. Điều đó an toàn vì việc chặn
    ở giao diện chỉ là trải nghiệm; API vẫn kiểm chữ ký và đối chiếu vai trò
    trong database ở `require_role()`.

    `perm_version` sao chép từ users.perm_version. Khi admin đổi vai trò của một
    người, ta tăng giá trị trong DB, mọi token cũ lệch version và bị từ chối
    ngay — không phải chờ token hết hạn.
    """
    now = datetime.now(UTC)
    lifetime = (
        timedelta(minutes=settings.jwt_access_token_minutes)
        if token_type == "access"
        else timedelta(days=settings.jwt_refresh_token_days)
    )

    payload: dict[str, Any] = {
        "sub": str(user_id),
        "typ": token_type,
        "role": role,
        "pv": perm_version,
        "iat": int(now.timestamp()),
        "exp": int((now + lifetime).timestamp()),
        "jti": jti or str(uuid.uuid4()),
    }
    if extra:
        payload.update(extra)

    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


class TokenPayload:
    """Nội dung token đã giải mã, ở dạng dùng được ngay."""

    def __init__(self, raw: dict[str, Any]) -> None:
        self.raw = raw
        self.user_id = uuid.UUID(raw["sub"])
        self.token_type: str = raw["typ"]
        self.role: str = raw.get("role", "")
        self.perm_version: int = raw.get("pv", 1)
        self.jti: str = raw["jti"]


def decode_token(token: str, *, expected_type: TokenType | None = None) -> TokenPayload:
    """Giải mã và kiểm tra token.

    Ném jwt.ExpiredSignatureError / jwt.InvalidTokenError để tầng gọi chuyển
    thành mã lỗi tương ứng.
    """
    raw = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    payload = TokenPayload(raw)
    if expected_type and payload.token_type != expected_type:
        raise jwt.InvalidTokenError(f"Cần token loại '{expected_type}'")
    return payload

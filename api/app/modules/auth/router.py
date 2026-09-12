"""Endpoint xác thực."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.deps import CurrentUserDep, DbDep
from app.core.security import create_token
from app.db.models.user import User, UserRole
from app.modules.auth.schemas import (
    LoginRequest,
    LoginResponse,
    SignupRequest,
    UserSummary,
)
from app.modules.auth.service import (
    access_token_ttl_seconds,
    authenticate,
    home_route_for,
    signup,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def to_summary(user: User) -> UserSummary:
    return UserSummary(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        locale=user.locale,
        avatar_media_id=user.avatar_media_id,
        home_route=home_route_for(user.role),
        can_preview=user.role in UserRole.CAN_PREVIEW,
    )


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Đăng nhập bằng email và mật khẩu",
)
async def login(payload: LoginRequest, db: DbDep) -> LoginResponse:
    user = await authenticate(db, email=payload.email, password=payload.password)
    token = create_token(
        user_id=user.id,
        role=user.role,
        token_type="access",
        perm_version=user.perm_version,
    )
    return LoginResponse(
        access_token=token,
        expires_in=access_token_ttl_seconds(),
        user=to_summary(user),
    )


@router.post(
    "/signup",
    response_model=LoginResponse,
    summary="Tự mở tài khoản học sinh",
)
async def signup_endpoint(payload: SignupRequest, db: DbDep) -> LoginResponse:
    """Mở tài khoản XONG LÀ ĐĂNG NHẬP LUÔN, trong một request.

    Trả về đúng `LoginResponse` của `/auth/login` chứ không trả 201 rỗng: bắt
    giao diện gọi tiếp `/auth/login` nghĩa là mật khẩu thô đi qua mạng hai lần
    và có một khoảng giữa hai lời gọi để hỏng — mở được tài khoản nhưng không
    vào được, một trạng thái không ai biết phải làm gì tiếp.
    """
    user = await signup(
        db,
        email=payload.email,
        display_name=payload.display_name,
        password=payload.password,
    )
    token = create_token(
        user_id=user.id,
        role=user.role,
        token_type="access",
        perm_version=user.perm_version,
    )
    return LoginResponse(
        access_token=token,
        expires_in=access_token_ttl_seconds(),
        user=to_summary(user),
    )


@router.get(
    "/me",
    response_model=UserSummary,
    summary="Thông tin tài khoản đang đăng nhập",
)
async def me(current: CurrentUserDep) -> UserSummary:
    return to_summary(current)

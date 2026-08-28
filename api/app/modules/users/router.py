"""Quản lý tài khoản — chỉ admin."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.core.deps import DbDep, require_role
from app.db.models.user import User, UserRole
from app.modules.auth.schemas import UserSummary
from app.modules.auth.router import to_summary

router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


@router.get(
    "",
    response_model=list[UserSummary],
    summary="Danh sách tài khoản",
)
async def list_users(db: DbDep) -> list[UserSummary]:
    rows = await db.scalars(
        select(User).where(User.deleted_at.is_(None)).order_by(User.role, User.email)
    )
    return [to_summary(u) for u in rows]

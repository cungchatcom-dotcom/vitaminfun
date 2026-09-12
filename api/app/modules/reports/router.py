"""Báo cáo kết quả chơi — chỉ giáo viên và admin.

Chặn ở CẢ ROUTER chứ không từng endpoint: mọi thứ trong đây đều là dữ liệu của
người khác, và một endpoint mới thêm sau này mà quên dòng bảo vệ thì mặc định
phải là ĐÓNG, không phải mở.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from app.core.deps import DbDep, require_role
from app.core.errors import NotFoundError
from app.db.models.user import UserRole
from app.modules.reports import service
from app.modules.reports.schemas import (
    OverviewOut,
    PlayerDetailOut,
    PlayerListOut,
    WorldOption,
)

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)

#: Mỗi trang 50 người — con số người dùng yêu cầu, và cũng là trần cứng: một
#: trang 5000 dòng thì không phải là phân trang nữa.
PAGE_SIZE = 50


@router.get("/worlds", response_model=list[WorldOption], summary="World đã có người chơi")
async def world_options(db: DbDep) -> list[WorldOption]:
    return [WorldOption(**r) for r in await service.danh_sach_world(db)]


@router.get("/overview", response_model=OverviewOut, summary="Số liệu tổng quan")
async def overview(
    db: DbDep,
    world_id: uuid.UUID | None = Query(default=None, description="Bỏ trống = mọi world"),
) -> OverviewOut:
    return OverviewOut(**await service.tong_quan(db, world_id))


@router.get("/players", response_model=PlayerListOut, summary="Bảng xếp hạng người chơi")
async def players(
    db: DbDep,
    world_id: uuid.UUID | None = Query(default=None, description="Bỏ trống = mọi world"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=PAGE_SIZE, ge=1, le=PAGE_SIZE),
    q: str | None = Query(default=None, description="Tìm theo họ tên hoặc email"),
) -> PlayerListOut:
    items, total = await service.xep_hang(db, world_id=world_id, page=page, size=size, tim=q)
    return PlayerListOut(items=items, total=total, page=page, size=size)


@router.get(
    "/players/{user_id}",
    response_model=PlayerDetailOut,
    summary="Chi tiết kết quả của một người chơi",
)
async def player_detail(user_id: uuid.UUID, db: DbDep) -> PlayerDetailOut:
    data = await service.chi_tiet(db, user_id)
    if data is None:
        raise NotFoundError()
    return PlayerDetailOut(**data)

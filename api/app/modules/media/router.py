"""API media — tải ảnh/âm thanh lên, liệt kê kho."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select

from app.core.deps import CurrentUserDep, DbDep, require_role
from app.db.models import MediaAsset, UserRole
from app.modules.media import service

router = APIRouter(
    prefix="/media",
    tags=["media"],
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)


class MediaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    kind: str
    mime: str | None
    original_name: str | None
    size_bytes: int | None
    width: int | None
    height: int | None
    duration_ms: int | None
    folder: str | None
    created_at: datetime


class MediaListOut(BaseModel):
    items: list[MediaOut]
    total: int


@router.post(
    "",
    response_model=MediaOut,
    status_code=status.HTTP_201_CREATED,
    summary="Tải một file lên",
)
async def upload(
    current: CurrentUserDep,
    db: DbDep,
    file: UploadFile = File(...),
    folder: str | None = Form(default=None),
) -> MediaOut:
    data = await file.read()
    asset = await service.save_upload(
        db,
        filename=file.filename or "",
        data=data,
        uploaded_by_id=current.id,
        folder=folder,
    )
    return MediaOut.model_validate(asset)


@router.get("", response_model=MediaListOut, summary="Danh sách media")
async def list_media(
    db: DbDep,
    kind: str | None = Query(default=None),
    folder: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> MediaListOut:
    query = select(MediaAsset)
    if kind:
        query = query.where(MediaAsset.kind == kind)
    if folder:
        query = query.where(MediaAsset.folder == folder)

    total = await db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = await db.scalars(
        query.order_by(MediaAsset.created_at.desc()).limit(limit).offset(offset)
    )
    return MediaListOut(items=[MediaOut.model_validate(r) for r in rows], total=total)

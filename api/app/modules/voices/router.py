"""Kho giọng đọc: xem danh mục, và kéo danh mục về từ nhà cung cấp.

Cả router yêu cầu vai trò giáo viên hoặc admin. Học sinh không bao giờ chọn
giọng — giọng là một quyết định của người dựng nội dung, gắn vào nhân vật.
"""

from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from app.core.deps import DbDep, require_role
from app.core.errors import ErrorCode, NotFoundError
from app.db.models import UserRole, Voice
from app.modules.voices.providers import PROVIDERS
from app.modules.voices.schemas import (
    VoiceOut,
    VoiceProviderOut,
    VoiceSyncIn,
    VoiceSyncOut,
)

router = APIRouter(
    prefix="/voices",
    tags=["voices"],
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)


@router.get("/providers", response_model=list[VoiceProviderOut], summary="Các dịch vụ giọng")
async def list_providers(db: DbDep) -> list[VoiceProviderOut]:
    """Danh sách dịch vụ đọc chữ thành tiếng, kèm số giọng đã kéo về.

    Đi xuống từ SERVER chứ không viết cứng ở giao diện: thêm một nhà cung cấp là
    thêm một dòng trong `PROVIDERS`, và ô chọn ngoài kia tự có thêm một mục.
    """
    rows = await db.execute(select(Voice.provider, func.count()).group_by(Voice.provider))
    counted = {provider: total for provider, total in rows}
    return [
        VoiceProviderOut(key=key, voice_count=counted.get(key, 0)) for key in sorted(PROVIDERS)
    ]


@router.get("", response_model=list[VoiceOut], summary="Danh mục giọng")
async def list_voices(
    db: DbDep,
    provider: str | None = Query(default=None),
    gender: Literal["male", "female", "neutral"] | None = Query(default=None),
    age_group: Literal["young", "middle_aged", "old"] | None = Query(default=None),
    language: str = Query(default="en"),
) -> list[VoiceOut]:
    """Lọc dần: dịch vụ → giới tính → nhóm tuổi.

    Ba bộ lọc rời chứ không một ô chọn dài hai chục dòng: người dựng biết trước
    họ cần một giọng nam trung niên, và bắt họ đọc hết cả danh sách để tìm là
    bắt làm một việc máy làm được.
    """
    query = select(Voice).where(Voice.language == language)
    if provider:
        query = query.where(Voice.provider == provider)
    if gender:
        query = query.where(Voice.gender == gender)
    if age_group:
        query = query.where(Voice.age_group == age_group)

    voices = list(await db.scalars(query.order_by(Voice.name)))
    return [VoiceOut.model_validate(v) for v in voices]


@router.post("/sync", response_model=VoiceSyncOut, summary="Kéo danh mục giọng về")
async def sync_voices(payload: VoiceSyncIn, db: DbDep) -> VoiceSyncOut:
    """Gọi nhà cung cấp, cập nhật kho.

    CẬP NHẬT chứ không xoá-rồi-nạp-lại: nhân vật đang trỏ vào những dòng này, và
    thay `id` của một giọng là gỡ giọng khỏi mọi nhân vật đang dùng nó. Khoá để
    so là `(provider, external_id)` — thứ nhà cung cấp giữ ổn định.

    Giọng nhà cung cấp đã bỏ đi thì Ở LẠI trong kho: một nhân vật đang dùng nó
    vẫn nói được bằng chính mã đó, và xoá đi là một quyết định không hoàn tác
    được, thực hiện bởi một thao tác đồng bộ mà người ta tưởng là chỉ đọc.
    """
    engine = PROVIDERS.get(payload.provider)
    if engine is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="provider")

    fetched = await engine.fetch(payload.language)

    existing = {
        v.external_id: v
        for v in await db.scalars(select(Voice).where(Voice.provider == payload.provider))
    }

    added = 0
    updated = 0
    for record in fetched:
        row = existing.get(record.external_id)
        if row is None:
            db.add(
                Voice(
                    provider=payload.provider,
                    external_id=record.external_id,
                    name=record.name,
                    gender=record.gender,
                    age_group=record.age_group,
                    accent=record.accent,
                    style=record.style,
                    use_case=record.use_case,
                    language=record.language,
                    preview_url=record.preview_url,
                )
            )
            added += 1
            continue

        row.name = record.name
        row.gender = record.gender
        row.age_group = record.age_group
        row.accent = record.accent
        row.style = record.style
        row.use_case = record.use_case
        row.language = record.language
        row.preview_url = record.preview_url
        updated += 1

    await db.commit()

    total = await db.scalar(
        select(func.count()).select_from(Voice).where(Voice.provider == payload.provider)
    )
    return VoiceSyncOut(provider=payload.provider, total=total or 0, added=added, updated=updated)


@router.get("/health", summary="Dịch vụ đọc chữ còn sống không")
async def voice_health() -> dict[str, object]:
    """Kiểm tra nhà cung cấp giọng đọc — KHÔNG tốn ký tự nào.

    Có ba thứ hỏng được, và trước đây không phân biệt được cái nào: chưa đặt
    khoá, khoá sai, hay mạng không tới. Cả ba đều hiện ra thành "sinh giọng thất
    bại" lúc người dựng đã bấm nút và đã chờ.

    Kèm số ký tự CÒN LẠI: sinh tám mươi câu cho một giọng là một khoản thật, và
    biết trước còn bao nhiêu thì hơn là phát hiện giữa mẻ.
    """
    out: dict[str, object] = {}
    for key, engine in PROVIDERS.items():
        check = getattr(engine, "health", None)
        out[key] = await check() if check else {"ok": False, "reason": "unsupported"}
    return out


@router.get("/{voice_id}", response_model=VoiceOut, summary="Một giọng")
async def read_voice(voice_id: uuid.UUID, db: DbDep) -> VoiceOut:
    voice = await db.scalar(select(Voice).where(Voice.id == voice_id))
    if voice is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="voice")
    return VoiceOut.model_validate(voice)

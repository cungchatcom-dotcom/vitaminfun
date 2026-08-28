"""Quản lý nhân vật người chơi.

Học sinh chọn một nhân vật khi vào world; Phaser vẽ nhân vật đó trong màn chơi
bằng các spritesheet ở đây.

Cả router yêu cầu vai trò giáo viên hoặc admin. Đường đọc cho học sinh (chọn
nhân vật lúc vào world) sẽ nằm ở module `play`, và chỉ trả nhân vật đã phát
hành — cùng nếp với world và màn chơi.
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, status
from sqlalchemy import select

from app.core.deps import CurrentUserDep, DbDep, require_role
from app.core.errors import ConflictError, ErrorCode, NotFoundError
from app.db.models import (
    Character,
    CharacterAction,
    MediaAsset,
    PublishStatus,
    UserRole,
    World,
    WorldCharacter,
)
from app.modules.characters.schemas import (
    CharacterActionIn,
    CharacterIdsIn,
    CharacterActionOut,
    CharacterCreate,
    CharacterOut,
    CharacterUpdate,
)

router = APIRouter(
    tags=["characters"],
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)


async def _media(db: DbDep, media_ids: set[uuid.UUID]) -> dict[uuid.UUID, Any]:
    """URL và khổ của một mớ ảnh, MỘT truy vấn.

    Một nhân vật có avatar cộng năm sáu hành động; hỏi từng cái là bảy lượt đi
    về database cho một màn hình.
    """
    ids = {i for i in media_ids if i}
    if not ids:
        return {}
    rows = await db.execute(
        select(MediaAsset.id, MediaAsset.url, MediaAsset.width, MediaAsset.height).where(
            MediaAsset.id.in_(ids)
        )
    )
    return {row.id: row for row in rows}


async def _out(db: DbDep, character: Character) -> CharacterOut:
    actions = list(
        await db.scalars(
            select(CharacterAction)
            .where(CharacterAction.character_id == character.id)
            .order_by(CharacterAction.action_key)
        )
    )
    media = await _media(db, {character.avatar_media_id, *(a.media_id for a in actions)})
    avatar = media.get(character.avatar_media_id) if character.avatar_media_id else None

    return CharacterOut(
        id=character.id,
        name_i18n=character.name_i18n or {},
        bio_i18n=character.bio_i18n or {},
        avatar_media_id=character.avatar_media_id,
        avatar_url=avatar.url if avatar else None,
        position=character.position,
        status=character.status,
        actions=[
            CharacterActionOut(
                id=action.id,
                action_key=action.action_key,
                media_id=action.media_id,
                media_url=media[action.media_id].url if action.media_id in media else None,
                frames=action.frames,
                frame_width=action.frame_width,
                frame_height=action.frame_height,
                frame_rate=action.frame_rate,
                sheet_width=media[action.media_id].width if action.media_id in media else None,
                sheet_height=media[action.media_id].height if action.media_id in media else None,
            )
            for action in actions
        ],
    )


async def _get(db: DbDep, character_id: uuid.UUID) -> Character:
    character = await db.scalar(select(Character).where(Character.id == character_id))
    if character is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="character")
    return character


@router.get("/characters", response_model=list[CharacterOut], summary="Danh sách nhân vật")
async def list_characters(db: DbDep) -> list[CharacterOut]:
    characters = list(await db.scalars(select(Character).order_by(Character.position, Character.id)))
    return [await _out(db, c) for c in characters]


@router.post(
    "/characters",
    response_model=CharacterOut,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo nhân vật",
)
async def create_character(payload: CharacterCreate, db: DbDep) -> CharacterOut:
    character = Character(
        name_i18n=payload.name_i18n,
        bio_i18n=payload.bio_i18n,
        avatar_media_id=payload.avatar_media_id,
        position=payload.position,
        # Nhân vật mới là bản NHÁP: nó chưa có ảnh, chưa có hành động nào, và
        # học sinh chọn phải nó thì màn chơi không có gì để vẽ.
        status=PublishStatus.DRAFT,
    )
    db.add(character)
    await db.commit()
    await db.refresh(character)
    return await _out(db, character)


@router.get("/characters/{character_id}", response_model=CharacterOut, summary="Một nhân vật")
async def read_character(character_id: uuid.UUID, db: DbDep) -> CharacterOut:
    return await _out(db, await _get(db, character_id))


@router.patch("/characters/{character_id}", response_model=CharacterOut, summary="Sửa nhân vật")
async def update_character(
    character_id: uuid.UUID, payload: CharacterUpdate, db: DbDep
) -> CharacterOut:
    character = await _get(db, character_id)

    for field in ("name_i18n", "bio_i18n", "avatar_media_id", "position", "status"):
        value = getattr(payload, field)
        if value is not None:
            setattr(character, field, value)

    if payload.clear_avatar:
        character.avatar_media_id = None

    await db.commit()
    await db.refresh(character)
    return await _out(db, character)


@router.delete(
    "/characters/{character_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Xoá nhân vật",
)
async def delete_character(character_id: uuid.UUID, db: DbDep) -> None:
    character = await _get(db, character_id)
    # Các hành động đi theo nhờ `ondelete="CASCADE"`. Ảnh trong kho media thì ở
    # lại: cùng một tấm có thể đang được nhân vật khác dùng.
    await db.delete(character)
    await db.commit()


@router.put(
    "/characters/{character_id}/actions",
    response_model=CharacterOut,
    summary="Đặt spritesheet cho một hành động",
)
async def upsert_action(
    character_id: uuid.UUID, payload: CharacterActionIn, db: DbDep
) -> CharacterOut:
    """Tạo hoặc sửa hành động — MỘT đường, không hai.

    `PUT` chứ không `POST`+`PATCH`: giao diện chỉ biết "nhân vật này, hành động
    `walk`, tấm ảnh này", và bắt nó tự tra xem hành động đã tồn tại chưa là đẩy
    một cuộc đua sang phía client.
    """
    character = await _get(db, character_id)

    action = await db.scalar(
        select(CharacterAction).where(
            CharacterAction.character_id == character.id,
            CharacterAction.action_key == payload.action_key,
        )
    )
    if action is None:
        action = CharacterAction(character_id=character.id, action_key=payload.action_key)
        db.add(action)

    action.media_id = payload.media_id
    action.frames = payload.frames
    action.frame_width = payload.frame_width
    action.frame_height = payload.frame_height
    action.frame_rate = payload.frame_rate

    try:
        await db.commit()
    except Exception as exc:  # UNIQUE(character_id, action_key)
        await db.rollback()
        raise ConflictError(ErrorCode.CONFLICT, field="action_key") from exc

    await db.refresh(character)
    return await _out(db, character)


@router.delete(
    "/characters/{character_id}/actions/{action_key}",
    response_model=CharacterOut,
    summary="Xoá một hành động",
)
async def delete_action(character_id: uuid.UUID, action_key: str, db: DbDep) -> CharacterOut:
    character = await _get(db, character_id)
    action = await db.scalar(
        select(CharacterAction).where(
            CharacterAction.character_id == character.id,
            CharacterAction.action_key == action_key,
        )
    )
    if action is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="character_action")

    await db.delete(action)
    await db.commit()
    return await _out(db, character)


# --------------------------------------------------------------------------
# Nhân vật của một world
# --------------------------------------------------------------------------


async def _world(db: DbDep, world_id: uuid.UUID) -> World:
    world = await db.scalar(select(World).where(World.id == world_id))
    if world is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="world")
    return world


async def _world_characters(db: DbDep, world_id: uuid.UUID) -> list[CharacterOut]:
    """Nhân vật của một world, theo đúng thứ tự người dựng đã xếp."""
    characters = list(
        await db.scalars(
            select(Character)
            .join(WorldCharacter, WorldCharacter.character_id == Character.id)
            .where(WorldCharacter.world_id == world_id)
            .order_by(WorldCharacter.position, Character.position, Character.id)
        )
    )
    return [await _out(db, c) for c in characters]


@router.get(
    "/worlds/{world_id}/characters",
    response_model=list[CharacterOut],
    summary="Nhân vật dùng được ở world này",
)
async def list_world_characters(world_id: uuid.UUID, db: DbDep) -> list[CharacterOut]:
    await _world(db, world_id)
    return await _world_characters(db, world_id)


@router.post(
    "/worlds/{world_id}/characters",
    response_model=list[CharacterOut],
    summary="Thêm nhân vật vào world",
)
async def add_world_characters(
    world_id: uuid.UUID, payload: CharacterIdsIn, db: DbDep
) -> list[CharacterOut]:
    """Thêm NHIỀU nhân vật một lần — bộ chọn cho tick nhiều rồi bấm một lần.

    Nhân vật đã có trong world thì bỏ qua, không báo lỗi: người dùng tick lại
    một cái đã có là chuyện thường, và bắt cả mẻ hỏng vì một cái trùng thì họ
    phải tự dò xem cái nào.
    """
    await _world(db, world_id)

    existing = set(
        await db.scalars(
            select(WorldCharacter.character_id).where(WorldCharacter.world_id == world_id)
        )
    )
    found = set(
        await db.scalars(select(Character.id).where(Character.id.in_(payload.character_ids)))
    )

    start = len(existing)
    for index, character_id in enumerate(payload.character_ids):
        if character_id in existing or character_id not in found:
            continue
        db.add(
            WorldCharacter(
                world_id=world_id, character_id=character_id, position=start + index
            )
        )
        existing.add(character_id)

    await db.commit()
    return await _world_characters(db, world_id)


@router.delete(
    "/worlds/{world_id}/characters/{character_id}",
    response_model=list[CharacterOut],
    summary="Gỡ nhân vật khỏi world",
)
async def remove_world_character(
    world_id: uuid.UUID, character_id: uuid.UUID, db: DbDep
) -> list[CharacterOut]:
    await _world(db, world_id)
    link = await db.scalar(
        select(WorldCharacter).where(
            WorldCharacter.world_id == world_id, WorldCharacter.character_id == character_id
        )
    )
    if link is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="world_character")

    # Chỉ gỡ BẢN GHI NỐI. Nhân vật vẫn còn trong kho và vẫn dùng được ở world
    # khác — "gỡ khỏi world này" không phải "xoá nhân vật".
    await db.delete(link)
    await db.commit()
    return await _world_characters(db, world_id)

"""Phần chơi — mở cho CẢ BA vai trò.

Đây là nửa bất đối xứng của luật điều hướng (docs/ARCHITECTURE.md §4): học sinh
bị chặn khỏi `/teacher/*`, nhưng giáo viên và admin KHÔNG bị chặn khỏi `/play/*`
— họ phải chơi thử đúng cái học sinh sắp chơi, trước khi phát hành world.

Vì vậy router này cố ý KHÔNG có `require_role()`. Cái thay đổi theo vai trò là
phạm vi dữ liệu và cờ `is_trial`, không phải quyền vào cửa.
"""

from __future__ import annotations

import uuid
from typing import Any, Literal

from fastapi import APIRouter, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUserDep, DbDep
from app.core.errors import ConflictError, ErrorCode, NotFoundError
from app.db.models import (
    Chapter,
    Character,
    CharacterAction,
    Galaxy,
    MapShardOwned,
    MediaAsset,
    PublishStatus,
    Quest,
    QuestAnswer,
    Room,
    RunStatus,
    Stage,
    StageProgress,
    StageRun,
    StageRunPlayer,
    User,
    UserRole,
    World,
    WorldCharacter,
    WorldProgress,
)
from app.modules.play import service
from app.modules.play.schemas import (
    AppendDialogueIn,
    DialogueLineOut,
    DialogueThreadOut,
    PickCharacterIn,
    PlayCharacterOut,
    PlayChapterOut,
    PlayFrameOut,
    PlayGalaxyOut,
    PlayLobbyOut,
    PlayRankOut,
    PlayStageOut,
    PlayWorldDetailOut,
    PlayWorldOut,
    QuestProgress,
    QuestionProgress,
    ReviewAttempt,
    ReviewOut,
    ReviewQuest,
    ReviewQuestion,
    RunCharacterOut,
    RunOut,
    RunResultOut,
    RunResultPlayer,
    RunSpriteOut,
    SaveDraftIn,
    SavePositionIn,
    SubmitQuestOut,
    TranslationOut,
    TeammateProgress,
)
from app.modules.worlds import service as worlds_service
from app.modules.worlds.balance import read_balance

router = APIRouter(prefix="/play", tags=["play"])


class PlayContext(BaseModel):
    """Ngữ cảnh phiên chơi, giao diện đọc để biết mình đang ở chế độ nào."""

    role: Literal["admin", "teacher", "student"]

    #: True thì giao diện hiện thanh cảnh báo chơi thử, và mọi lượt chơi tạo ra
    #: từ phiên này sẽ mang `stage_runs.is_trial = true`.
    is_preview: bool

    #: True thì được nhìn thấy world/màn còn ở trạng thái draft.
    can_see_draft: bool

    #: True thì được bỏ qua điều kiện điểm chiến lực để mở màn.
    can_bypass_unlock: bool


@router.get("/context", response_model=PlayContext, summary="Đang chơi thật hay chơi thử")
async def get_context(current: CurrentUserDep) -> PlayContext:
    preview = current.role in UserRole.CAN_PREVIEW
    return PlayContext(
        role=current.role,
        is_preview=preview,
        can_see_draft=preview,
        can_bypass_unlock=preview,
    )


# --------------------------------------------------------------------------
# Duyệt nội dung (S0-S2)
# --------------------------------------------------------------------------


async def _world_summary(db: DbDep, user: User, world: World) -> dict[str, Any]:
    """Số liệu tóm tắt của một world, tính riêng cho MỘT người chơi."""
    can_bypass = user.role in UserRole.CAN_PREVIEW
    progress = await db.scalar(
        select(WorldProgress).where(
            WorldProgress.world_id == world.id, WorldProgress.user_id == user.id
        )
    )

    counter = select(func.count()).select_from(Stage).join(Chapter, Chapter.id == Stage.chapter_id)
    total = await db.scalar(counter.where(Chapter.world_id == world.id)) or 0
    published = (
        await db.scalar(
            counter.where(Chapter.world_id == world.id, Stage.status == PublishStatus.PUBLISHED)
        )
        or 0
    )

    cover = None
    if world.cover_media_id:
        cover = await db.scalar(select(MediaAsset.url).where(MediaAsset.id == world.cover_media_id))

    return {
        "id": world.id,
        "name_i18n": world.name_i18n,
        "story_i18n": world.story_i18n,
        "difficulty": world.difficulty,
        "cover_url": cover,
        "shard_total": world.shard_total,
        "scene_x": world.scene_x,
        "scene_y": world.scene_y,
        "icon_size": world.icon_size,
        "pulse_percent": world.pulse_percent,
        "pulse_period_ms": world.pulse_period_ms,
        # Khoá = giáo viên bấm khoá, HOẶC chưa có màn nào phát hành. World rỗng
        # mà mở toang thì học sinh bấm vào một chỗ trống và tưởng game hỏng.
        "is_locked": world.is_locked or published == 0,
        "can_enter": (not world.is_locked and published > 0) or can_bypass,
        "show_ring": world.show_ring,
        "my_skill_pts": progress.skill_pts if progress else 0,
        "my_shards": await service.count_shards(db, world.id, user.id),
        "stages_total": total,
        "stages_published": published,
    }


async def _audio_media(db: DbDep, audio: dict[str, Any]) -> tuple[dict[str, str], dict[str, str]]:
    """(URL, TÊN FILE GỐC) của từng khối tiếng.

    Trả cả tên vì `storage_key` là một chuỗi băm — nhìn vào
    `43e3a40d10bb428e997cc82cc180b69a.mp3` thì không ai biết mình đã tải bản nào
    lên. Tên gốc đã nằm sẵn trong `media_assets.original_name`, chỉ là chưa ai
    chuyển nó ra tới giao diện.

    MỘT truy vấn cho cả bộ, và các khối rất có thể dùng chung một file.
    """
    ids = {
        track["media_id"]
        for track in (audio or {}).values()
        if isinstance(track, dict) and track.get("media_id")
    }
    if not ids:
        return {}, {}

    found = {
        str(row.id): (row.url, row.original_name)
        for row in await db.execute(
            select(MediaAsset.id, MediaAsset.url, MediaAsset.original_name).where(
                MediaAsset.id.in_(ids)
            )
        )
    }
    urls: dict[str, str] = {}
    names: dict[str, str] = {}
    for slot, track in (audio or {}).items():
        if not isinstance(track, dict):
            continue
        hit = found.get(str(track.get("media_id")))
        if not hit:
            continue
        urls[slot] = hit[0]
        if hit[1]:
            names[slot] = hit[1]
    return urls, names


@router.get("/galaxy", response_model=PlayGalaxyOut, summary="Bản đồ thiên hà")
async def read_galaxy(current: CurrentUserDep, db: DbDep) -> PlayGalaxyOut:
    """Màn chọn world: nền, nhạc và các world người này được nhìn thấy.

    Bản đồ hiện MỌI world, kể cả world chưa phát hành hay chưa có màn nào —
    chúng hiện ra kèm ổ khoá và không bấm vào được. Giấu hẳn thì bản đồ thủng
    lỗ chỗ và học sinh không biết còn gì đang được dựng; mà bản đồ là chỗ để
    NHÌN THẤY cả hành trình, không chỉ chặng đang mở.

    Cái chặn nằm ở `can_enter` và ở chính `GET /play/worlds/{id}` — không nằm ở
    danh sách này. Chặn ở danh sách nghĩa là ai gõ thẳng URL vẫn vào được.

    Lấy thiên hà ĐẦU TIÊN theo `position`. Sản phẩm hiện có đúng một thiên hà;
    khi nào có nhiều thì màn này nhận thêm tham số, còn bây giờ bịa ra một bộ
    chọn cho một lựa chọn duy nhất là làm người chơi bấm thừa một lần.
    """
    worlds = list(await db.scalars(select(World).order_by(World.position)))

    galaxy = await db.scalar(select(Galaxy).order_by(Galaxy.position).limit(1))
    if galaxy is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="galaxy")

    async def url_of(media_id):
        if media_id is None:
            return None
        return await db.scalar(select(MediaAsset.url).where(MediaAsset.id == media_id))

    return PlayGalaxyOut(
        id=galaxy.id,
        name_i18n=galaxy.name_i18n,
        description_i18n=galaxy.description_i18n,
        background_url=await url_of(galaxy.background_media_id),
        background_kind=await _kind(db, galaxy.background_media_id),
        audio=galaxy.audio_json or {},
        audio_urls=(await _audio_media(db, galaxy.audio_json or {}))[0],
        title_url=await url_of(galaxy.title_media_id),
        title_x=galaxy.title_x,
        title_y=galaxy.title_y,
        title_width=galaxy.title_width,
        title_color=galaxy.title_color,
        title_font=galaxy.title_font,
        desc_url=await url_of(galaxy.desc_media_id),
        desc_x=galaxy.desc_x,
        desc_y=galaxy.desc_y,
        desc_width=galaxy.desc_width,
        desc_color=galaxy.desc_color,
        desc_font=galaxy.desc_font,
        worlds=[PlayWorldOut(**await _world_summary(db, current, world)) for world in worlds],
    )


async def _url(db: DbDep, media_id) -> str | None:
    """URL của một tấm ảnh. `None` vào thì `None` ra."""
    if media_id is None:
        return None
    return await db.scalar(select(MediaAsset.url).where(MediaAsset.id == media_id))


async def _kind(db: DbDep, media_id) -> str | None:
    """`media_assets.kind` của một tấm nền: `"image"` hay `"video"`.

    Giao diện cần biết để chọn `<img>` hay `<video>`. Hỏi database thay vì đoán
    theo đuôi file trong URL — xem `BackgroundKind` bên `worlds/schemas.py`.
    """
    if media_id is None:
        return None
    return await db.scalar(select(MediaAsset.kind).where(MediaAsset.id == media_id))


async def _urls(db: DbDep, media_ids) -> dict[uuid.UUID, tuple[str, str]]:
    """URL của NHIỀU tấm ảnh, một câu truy vấn.

    Bản gộp của `_url()`, cho những chỗ hỏi ảnh của cả một danh sách: gọi `_url()`
    trong vòng lặp thì một chương ba mươi màn là ba mươi lượt đi về database chỉ
    để lấy ba mươi chuỗi ký tự.

    Ảnh nào không có thì KHÔNG có khoá trong kết quả — người gọi dùng `.get()`,
    và `None` ra `None` y như bản đơn lẻ.

    Trả về `(url, kind)` chứ không chỉ URL: chỗ gọi duy nhất — mặt các màn trên
    minimap — cần biết tấm nền là ảnh hay video để vẽ khung hình đầu thay vì
    một thẻ `<img>` hỏng. Nhét thêm một cột vào câu truy vấn ĐÃ CHẠY thì rẻ hơn
    hẳn một hàm `_kinds()` song song, tức thêm một lượt đi về database cho mỗi
    chương chỉ để lấy mấy chuỗi "image".
    """
    wanted = {mid for mid in media_ids if mid is not None}
    if not wanted:
        return {}
    rows = await db.execute(
        select(MediaAsset.id, MediaAsset.url, MediaAsset.kind).where(MediaAsset.id.in_(wanted))
    )
    return {row.id: (row.url, row.kind) for row in rows}


async def _lobby(db: DbDep, world: World) -> PlayLobbyOut:
    """Phần trình bày của phòng chờ, đã giải xong việc thừa kế từ thiên hà.

    Mỗi trường của khung chữ tự giải riêng: world có thể đặt ảnh riêng mà vẫn
    dùng màu chữ của thiên hà. Giải cả cụm theo kiểu "có ảnh riêng thì lấy hết
    của world" là bắt người dựng phải đặt lại năm thứ khi họ chỉ muốn đổi một.
    """
    galaxy = await db.scalar(select(Galaxy).where(Galaxy.id == world.galaxy_id))

    def pick(name: str, field: str):
        value = getattr(world, f"{name}_{field}", None)
        if value is not None:
            return value
        return getattr(galaxy, f"{name}_{field}", None) if galaxy else None

    async def frame(name: str) -> PlayFrameOut:
        media_id = getattr(world, f"{name}_media_id") or (
            getattr(galaxy, f"{name}_media_id") if galaxy else None
        )
        return PlayFrameOut(
            url=await _url(db, media_id),
            x=pick(name, "x"),
            y=pick(name, "y"),
            width=pick(name, "width"),
            height=pick(name, "height"),
            color=pick(name, "color"),
            font=pick(name, "font"),
        )

    layout = world.lobby_json or {}
    # Cùng phép tra với khối hội thoại — khối phòng chờ và khối hội thoại là
    # cùng một hình dạng dữ liệu (`LobbySaved`), nên cùng một hàm.
    urls = await worlds_service.block_urls(db, layout)

    # MỘT id cho cả URL lẫn loại. Tính hai lần là mở cửa cho hai vế lệch nhau:
    # phòng chờ chưa đặt nền thì thừa nền thiên hà, và nếu vế loại quên mất
    # nhánh thừa kế thì một video sẽ được vẽ bằng `<img>`.
    background_id = world.lobby_media_id or (galaxy.background_media_id if galaxy else None)
    return PlayLobbyOut(
        background_url=await _url(db, background_id),
        background_kind=await _kind(db, background_id),
        title=await frame("title"),
        desc=await frame("desc"),
        layout=layout,
        urls=urls,
        audio=world.audio_json or {},
        audio_urls=(await _audio_media(db, world.audio_json or {}))[0],
    )


async def _stats_numbers(db: DbDep, world: World, user_id: uuid.UUID) -> dict[str, int]:
    """Bốn con số của bảng thành tích mà `_world_summary` chưa có.

    Chỉ đếm màn ĐÃ PHÁT HÀNH: mẫu số phải là thứ người chơi vào được. Cộng cả
    màn đang dựng dở vào thì tiến độ tụt xuống mỗi lần người dựng tạo thêm một
    màn nháp, và không ai hiểu vì sao.

    Sao ĐÃ ĐẠT thì không lọc theo trạng thái màn: đã chơi và đã ăn sao rồi thì
    màn đó có bị rút về nháp sau này cũng không lấy lại sao của người ta.
    """
    in_world = (
        select(Stage.id)
        .join(Chapter, Chapter.id == Stage.chapter_id)
        .where(Chapter.world_id == world.id)
    )
    published = in_world.where(Stage.status == PublishStatus.PUBLISHED)

    star_total = await db.scalar(
        select(func.coalesce(func.sum(Stage.star_max), 0)).where(
            Stage.id.in_(published.scalar_subquery())
        )
    )
    my_stars = await db.scalar(
        select(func.coalesce(func.sum(StageProgress.best_stars), 0)).where(
            StageProgress.user_id == user_id,
            StageProgress.stage_id.in_(in_world.scalar_subquery()),
        )
    )

    quest_total = await db.scalar(
        select(func.count())
        .select_from(Quest)
        .where(Quest.stage_id.in_(published.scalar_subquery()))
    )
    # ĐÃ ĐỘNG TỚI, không phải đã làm đúng: đây là thanh "đi được bao xa", và một
    # nhiệm vụ đã mở ra rồi thì người chơi đã đi qua nó. `DISTINCT` vì mỗi
    # nhiệm vụ có nhiều câu hỏi và mỗi câu có thể nộp nhiều lần.
    my_quests = await db.scalar(
        select(func.count(func.distinct(QuestAnswer.quest_id)))
        .select_from(QuestAnswer)
        .join(Quest, Quest.id == QuestAnswer.quest_id)
        .where(
            QuestAnswer.user_id == user_id,
            Quest.stage_id.in_(in_world.scalar_subquery()),
        )
    )

    return {
        "star_total": int(star_total or 0),
        "my_stars": int(my_stars or 0),
        "quest_total": int(quest_total or 0),
        "my_quests_played": int(my_quests or 0),
    }


async def _leaderboard(db: DbDep, world_id: uuid.UUID, me: uuid.UUID) -> list[PlayRankOut]:
    """Mười người dẫn đầu world này.

    Xếp theo ĐIỂM CHIẾN LỰC của chính world đó — điểm là riêng theo world, nên
    một bảng xếp hạng toàn hệ thống sẽ so nhầm hai thứ khác nhau.
    """
    rows = list(
        await db.execute(
            select(WorldProgress.user_id, WorldProgress.skill_pts, User.display_name)
            .join(User, User.id == WorldProgress.user_id)
            .where(WorldProgress.world_id == world_id)
            .order_by(WorldProgress.skill_pts.desc(), User.display_name)
            # Mười, và con số này phải khớp `LOBBY_RANK_ROWS` bên giao diện —
            # khối xếp hạng chia chiều cao thành đúng bấy nhiêu hàng để hàng
            # không đổi cỡ theo số người đang có.
            .limit(10)
        )
    )
    return [
        PlayRankOut(
            user_id=row.user_id,
            display_name=row.display_name,
            skill_pts=row.skill_pts,
            shards=await service.count_shards(db, world_id, row.user_id),
            is_me=row.user_id == me,
        )
        for row in rows
    ]


async def _world_characters(db: DbDep, world_id: uuid.UUID) -> list[PlayCharacterOut]:
    """Nhân vật world này cho dùng.

    CHỈ nhân vật đã phát hành: bản nháp chưa chắc đã có spritesheet, và học
    sinh chọn phải nó thì màn chơi không có gì để vẽ.
    """
    rows = list(
        await db.execute(
            select(Character, MediaAsset.url)
            .join(WorldCharacter, WorldCharacter.character_id == Character.id)
            .outerjoin(MediaAsset, MediaAsset.id == Character.avatar_media_id)
            .where(
                WorldCharacter.world_id == world_id,
                Character.status == PublishStatus.PUBLISHED,
            )
            .order_by(WorldCharacter.position, Character.position, Character.id)
        )
    )
    return [
        PlayCharacterOut(
            id=character.id,
            name_i18n=character.name_i18n or {},
            bio_i18n=character.bio_i18n or {},
            avatar_url=url,
        )
        for character, url in rows
    ]


async def _my_character_id(
    db: DbDep, world_id: uuid.UUID, user_id: uuid.UUID
) -> uuid.UUID | None:
    """Nhân vật của người này trong world — ĐÃ CHỌN, hoặc MẶC ĐỊNH người đầu danh sách.

    Vào world lần đầu thì chưa chọn ai, và một ô mặt trống là cách mở màn tệ:
    học sinh phải bấm qua một hộp thoại trước khi được nhìn thấy trò chơi, còn
    cảnh chơi thì vẽ một ký hiệu vô danh thay cho nhân vật. Người đầu tiên trong
    dàn của world là một câu trả lời sẵn có, và đổi được bất cứ lúc nào bằng
    đúng cái nút vẫn ở đó.

    TÍNH RA chứ không GHI XUỐNG. Đây là một endpoint GET, và ghi ở đây sẽ tạo
    một dòng `world_progress` cho người mới chỉ NGÓ VÀO world — mà dòng ấy là
    thứ `players_total` đếm và bảng xếp hạng của giáo viên đọc. Một lớp ba mươi
    em bấm xem thử sẽ thành ba mươi "người chơi" với 0 điểm. Lựa chọn thật được
    ghi khi học sinh tự chọn (`pick_character`), hoặc khi lượt chơi đầu tiên bắt
    đầu.

    Cùng thứ tự với `_world_characters` — "người đầu danh sách" phải là người
    đứng đầu trong chính bảng chọn mà học sinh nhìn thấy.
    """
    chosen = await db.scalar(
        select(WorldProgress.character_id).where(
            WorldProgress.world_id == world_id, WorldProgress.user_id == user_id
        )
    )
    if chosen is not None:
        return chosen

    return await db.scalar(
        select(Character.id)
        .join(WorldCharacter, WorldCharacter.character_id == Character.id)
        .where(
            WorldCharacter.world_id == world_id,
            Character.status == PublishStatus.PUBLISHED,
        )
        .order_by(WorldCharacter.position, Character.position, Character.id)
        .limit(1)
    )


@router.put(
    "/worlds/{world_id}/character",
    response_model=PlayWorldDetailOut,
    summary="Chọn nhân vật cho world này",
)
async def pick_character(
    world_id: uuid.UUID, payload: PickCharacterIn, current: CurrentUserDep, db: DbDep
) -> PlayWorldDetailOut:
    """Chọn — hoặc ĐỔI — nhân vật.

    Đổi được, không khoá sau lần đầu: một đứa trẻ chọn nhầm ở giây thứ ba của
    buổi học mà phải chơi hết học kỳ với nhân vật đó là một hình phạt vô cớ.

    Chỉ nhận nhân vật world này cho dùng. Gửi thẳng một `character_id` bất kỳ
    thì bị từ chối — bộ chọn ở giao diện không phải là chỗ kiểm cuối cùng.
    """
    world = await worlds_service.get_world(db, current, world_id)

    allowed = {c.id for c in await _world_characters(db, world.id)}
    if payload.character_id not in allowed:
        raise ConflictError(ErrorCode.CONFLICT, field="character_id")

    progress = await db.scalar(
        select(WorldProgress).where(
            WorldProgress.world_id == world.id, WorldProgress.user_id == current.id
        )
    )
    if progress is None:
        progress = WorldProgress(world_id=world.id, user_id=current.id)
        db.add(progress)

    progress.character_id = payload.character_id
    await db.commit()

    return await read_world(world_id, current, db)


@router.get(
    "/worlds/{world_id}",
    response_model=PlayWorldDetailOut,
    summary="Chi tiết world: chương, màn chơi, tiến độ",
)
async def read_world(world_id: uuid.UUID, current: CurrentUserDep, db: DbDep) -> PlayWorldDetailOut:
    world = await worlds_service.get_world(db, current, world_id)
    summary = await _world_summary(db, current, world)

    # Bản đồ cho NHÌN THẤY world khoá, nhưng không cho VÀO. Chặn ở đây chứ
    # không chỉ làm mờ cái liên kết: một thẻ `<a>` bị làm mờ vẫn gõ URL được.
    #
    # 404 chứ không 403 — cùng lý do với `get_world()`: học sinh không cần biết
    # có tồn tại một world đang dựng dở.
    if not summary["can_enter"]:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="world")

    can_bypass = current.role in UserRole.CAN_PREVIEW
    skill_pts = summary["my_skill_pts"]

    owned = set(
        await db.scalars(
            select(MapShardOwned.shard_index).where(
                MapShardOwned.world_id == world.id, MapShardOwned.user_id == current.id
            )
        )
    )

    chapters = list(
        await db.scalars(
            select(Chapter).where(Chapter.world_id == world.id).order_by(Chapter.order_index)
        )
    )

    out_chapters: list[PlayChapterOut] = []
    for chapter in chapters:
        stages = list(
            await db.scalars(
                worlds_service.visible_stages(current)
                .where(Stage.chapter_id == chapter.id)
                .order_by(Stage.order_index)
            )
        )

        backgrounds = await _urls(db, (stage.background_media_id for stage in stages))

        out_stages: list[PlayStageOut] = []
        for stage in stages:
            required = worlds_service.effective_required_skill_pts(stage, world)
            progress = await db.scalar(
                select(StageProgress).where(
                    StageProgress.stage_id == stage.id, StageProgress.user_id == current.id
                )
            )
            # `(None, None)` khi màn chưa đặt nền — gỡ cặp ra MỘT lần ở đây thay
            # vì lặp lại biểu thức `.get(...) or (None, None)` cho từng vế.
            bg_url, bg_kind = backgrounds.get(stage.background_media_id) or (None, None)
            out_stages.append(
                PlayStageOut(
                    id=stage.id,
                    order_index=stage.order_index,
                    name_i18n=stage.name_i18n,
                    synopsis_i18n=stage.synopsis_i18n,
                    map_shard_index=stage.map_shard_index,
                    quest_count=await worlds_service.quest_count(db, stage.id),
                    background_url=bg_url,
                    background_kind=bg_kind,
                    required_skill_pts=required,
                    # Nhảy bậc là HỆ QUẢ của luật này, không phải ngoại lệ phải
                    # viết riêng: đủ điểm thì mở, bất kể đã chơi màn trước hay chưa.
                    #
                    # KHOÁ TAY thắng mọi thứ điểm: người dựng đóng cửa thì không
                    # có cách nào chơi cho nó mở ra. Chỉ chế độ chơi thử đi qua
                    # được — giáo viên phải thử được cái màn họ vừa khoá.
                    unlocked=can_bypass or (skill_pts >= required and not stage.is_locked),
                    locked_by_teacher=stage.is_locked,
                    completed=stage.map_shard_index in owned,
                    times_played=progress.times_played if progress else 0,
                    best_score=progress.best_score if progress else 0,
                )
            )

        # Chương chưa có màn nào thì KHÔNG gửi xuống.
        #
        # Một cái tiêu đề chương kèm dòng "chưa có màn chơi nào" là lời nhắn gửi
        # cho giáo viên, hiện nhầm chỗ: học sinh không làm được gì với nó ngoài
        # việc tưởng trò chơi bị hỏng. Giáo viên vẫn thấy đủ mọi chương ở màn
        # soạn `/teacher/worlds/{id}` — đó mới là nơi tin đó có ích.
        #
        # Lọc theo `out_stages` chứ không theo "chương có màn nào không": với
        # học sinh, `visible_stages()` chỉ trả màn ĐÃ XUẤT BẢN, nên một chương
        # toàn bản nháp cũng rỗng y như chương chưa có gì — và với giáo viên
        # đang chơi thử thì bản nháp vẫn tính, nên họ vẫn thấy chương đó.
        if not out_stages:
            continue

        out_chapters.append(
            PlayChapterOut(
                id=chapter.id,
                order_index=chapter.order_index,
                name_i18n=chapter.name_i18n,
                synopsis_i18n=chapter.synopsis_i18n,
                cover_url=await _url(db, chapter.cover_media_id),
                minimap_url=await _url(db, chapter.minimap_media_id),
                stages=out_stages,
            )
        )

    return PlayWorldDetailOut(
        **summary,
        lobby=await _lobby(db, world),
        leaderboard=await _leaderboard(db, world.id, current.id),
        players_total=await db.scalar(
            select(func.count()).select_from(WorldProgress).where(WorldProgress.world_id == world.id)
        )
        or 0,
        characters=await _world_characters(db, world.id),
        my_character_id=await _my_character_id(db, world.id, current.id),
        chapters=out_chapters,
        gate_ready=summary["my_shards"] >= world.shard_total,
        level_i18n=world.level_i18n or {},
        resume_stage_id=await _resume_stage_id(db, world.id, current.id),
        **await _stats_numbers(db, world, current.id),
    )

async def _resume_stage_id(db: DbDep, world_id: uuid.UUID, user_id: uuid.UUID) -> uuid.UUID | None:
    """Màn người này đang chơi dở trong world này, nếu lượt đó còn giờ.

    Lấy lượt mới nhất còn `playing`, rồi tự kiểm đồng hồ — `seconds_remaining()`
    là chỗ DUY NHẤT biết luật thời gian, và tính lại bằng SQL ở đây là chép luật
    ra chỗ thứ hai để hai chỗ lệch nhau.

    Không chốt lượt hết giờ ở đây dù biết nó đã hết: đọc một phòng chờ không nên
    ghi vào database. `start_run` chốt nó, và đó là lúc người chơi thật sự quay
    lại màn đó.
    """
    run = await db.scalar(
        select(StageRun)
        .join(StageRunPlayer, StageRunPlayer.stage_run_id == StageRun.id)
        .join(Stage, Stage.id == StageRun.stage_id)
        .join(Chapter, Chapter.id == Stage.chapter_id)
        .where(
            Chapter.world_id == world_id,
            StageRun.status == RunStatus.PLAYING,
            StageRunPlayer.user_id == user_id,
        )
        .order_by(StageRun.started_at.desc())
        .limit(1)
    )
    if run is None or service.seconds_remaining(run) <= 0:
        return None
    return run.stage_id



# --------------------------------------------------------------------------
# Dựng phản hồi
# --------------------------------------------------------------------------


async def _run_character(
    db: DbDep, world_id: uuid.UUID, user_id: uuid.UUID
) -> RunCharacterOut | None:
    """Nhân vật người này đã chọn cho world, kèm spritesheet để vẽ trong màn.

    Chưa chọn, hoặc chọn rồi mà nhân vật bị rút về nháp, thì trả `None` — cảnh
    chơi vẽ ký hiệu mặc định. Một màn chơi không được đứng hình chỉ vì một lựa
    chọn cũ đã hết hiệu lực.

    Phần dựng spritesheet đi qua `service.actors_of`, dùng chung với người canh
    giữ: hai bản chép của cùng phép cắt khung sẽ lệch nhau đúng vào lúc ai đó
    thêm một tư thế.
    """
    # CÙNG một luật với phòng chờ, qua cùng một hàm: phòng chờ hiện mặt ai thì
    # cảnh chơi phải vẽ đúng người đó. Hai phép tính riêng cho cùng một câu hỏi
    # là hai câu trả lời chờ ngày lệch nhau — và triệu chứng sẽ là "ảnh đại diện
    # một đằng, nhân vật chạy trong màn một nẻo".
    character_id = await _my_character_id(db, world_id, user_id)
    if character_id is None:
        return None

    # Kiểm XUẤT BẢN ở đây chứ không trong `actors_of`: học sinh chỉ được chơi
    # nhân vật đã phát hành, còn người canh giữ thì người dựng vừa gán vào và
    # phải thấy được ngay, kể cả khi còn nháp.
    published = await db.scalar(
        select(Character.id).where(
            Character.id == character_id, Character.status == PublishStatus.PUBLISHED
        )
    )
    if published is None:
        return None

    actor = (await service.actors_of(db, [character_id])).get(character_id)
    if actor is None:
        return None
    return RunCharacterOut(**actor.model_dump())


def _quest_progress(
    quest: dict,
    mine: list[QuestAnswer],
    me_row: StageRunPlayer | None,
    drafts: dict,
    max_attempts,
    cleared: bool,
) -> QuestProgress:
    """Tiến độ của MỘT nhiệm vụ, nhìn từ phía một người chơi.

    Tách ra vì hai chỗ cần đúng phép tính này: `_run_out` dựng cả danh sách, còn
    lần nộp bài chỉ cần đúng một nhiệm vụ. Trước đây chỉ có chỗ thứ nhất, nên
    lần nộp nào cũng phải tải lại cả `RunOut` — 66 KB, trong đó 62 KB là đề bài
    đã đóng băng và không bao giờ đổi.
    """
    quest_id = uuid.UUID(quest["id"])

    # ĐANG LÀM TỚI ĐÂU thì chỉ nhìn VÒNG hiện tại: bấm "Làm lại" là mọi câu trở
    # về trắng, lượt thử đếm lại từ đầu. Còn cái NHÃN hoàn thành thì đọc vòng
    # tốt nhất — xem `completed` ở dưới.
    vong = service.round_now(me_row, quest_id)
    trong_vong = service.same_round(mine, vong)

    questions: list[QuestionProgress] = []
    for question in quest["questions"]:
        question_id = uuid.UUID(question["id"])
        tries = [
            a for a in trong_vong if a.quest_id == quest_id and a.question_id == question_id
        ]
        done = any(a.is_correct for a in tries)
        # Nhiệm vụ NPC không đếm lượt — xem `service.submit_quest`.
        left = (
            None
            if max_attempts is None or quest["phase"] == "advisor"
            else (0 if done else max(0, int(max_attempts) - len(tries)))
        )
        questions.append(
            QuestionProgress(
                question_id=question_id,
                completed=done,
                attempts_left=left,
                # Đếm từ chính nhật ký, không suy từ `attempts_left`: cái đó là
                # `null` ở nhiệm vụ NPC, mà nhiệm vụ NPC mới là chỗ người ta thử
                # nhiều lần nhất.
                attempts_used=len(tries),
                draft=drafts.get(question_id),
            )
        )

    return QuestProgress(
        quest_id=quest_id,
        # VÒNG TỐT NHẤT: qua rồi thì mãi mãi là đã qua. Chơi lại mà kém hơn
        # không lấy mất cái nhãn đã giành được — đó đúng là lý do người ta dám
        # bấm Làm lại.
        completed=service.quest_ever_passed(mine, quest),
        locked=not cleared and quest["phase"] != "advisor",
        questions=questions,
    )


async def _run_out(db: DbDep, user: User, run) -> RunOut:
    room = await db.scalar(select(Room).where(Room.id == run.room_id))
    answers = list(
        await db.scalars(select(QuestAnswer).where(QuestAnswer.stage_run_id == run.id))
    )
    mine = [a for a in answers if a.user_id == user.id]

    world = await service.world_of_run(db, run)
    max_attempts = read_balance(world.balance_json).get("maxAttemptsPerQuestion")

    # Tính MỘT LẦN cho cả vòng lặp: cổng NPC giống nhau ở mọi nhiệm vụ, và
    # gọi lại trong thân vòng lặp là quét lại danh sách bài làm mỗi nhiệm vụ.
    cleared = service.advisor_cleared(run.snapshot_json, mine)
    drafts = await service.drafts_of(db, run.id, user.id)

    players_now = list(
        await db.scalars(select(StageRunPlayer).where(StageRunPlayer.stage_run_id == run.id))
    )
    me_row = next((p for p in players_now if p.user_id == user.id), None)

    progress = [
        _quest_progress(quest, mine, me_row, drafts, max_attempts, cleared)
        for quest in run.snapshot_json["quests"]
    ]

    players = players_now
    me = me_row
    names = {
        u.id: u.display_name
        for u in await db.scalars(
            select(User).where(User.id.in_([p.user_id for p in players if p.user_id]))
        )
    }

    team: list[TeammateProgress] = []
    for player in players:
        rows = [a for a in answers if a.user_id == player.user_id]
        done_ids = [
            uuid.UUID(q["id"])
            for q in run.snapshot_json["quests"]
            if service.quest_ever_passed(rows, q)
        ]
        team.append(
            TeammateProgress(
                user_id=player.user_id,
                hero_key=player.hero_key,
                display_name=names.get(player.user_id, "Bot"),
                is_bot=player.is_bot,
                is_me=player.user_id == user.id,
                quest_ids_completed=done_ids,
            )
        )

    return RunOut(
        id=run.id,
        stage_id=run.stage_id,
        character=await _run_character(db, world.id, user.id),
        # `world` đã nạp ở trên để đọc `balance_json` — không thêm truy vấn nào.
        world_id=world.id,
        room_code=room.code if room else "",
        status=run.status,
        is_trial=run.is_trial,
        snapshot=run.snapshot_json,
        hint_cost=int(read_balance(world.balance_json)["energyCost"]["hint"]),
        my_energy_granted=me.energy_granted if me else 0,
        my_energy_remaining=me.energy_remaining if me else 0,
        my_pos_x=me.pos_x if me else None,
        my_pos_y=me.pos_y if me else None,
        seconds_remaining=service.seconds_remaining(run),
        started_at=run.started_at,
        my_progress=progress,
        team=team,
    )


# --------------------------------------------------------------------------
# Vào màn
# --------------------------------------------------------------------------


class StageIntroOut(BaseModel):
    """Video mở màn của một màn chơi. `None` = màn này vào thẳng."""

    intro_video_url: str | None = None


@router.get(
    "/stages/{stage_id}/intro",
    response_model=StageIntroOut,
    summary="Video mở màn — đọc TRƯỚC khi lượt chơi tồn tại",
)
async def stage_intro(stage_id: uuid.UUID, current: CurrentUserDep, db: DbDep) -> StageIntroOut:
    """URL đoạn video che lúc màn chơi đang nạp.

    Đường riêng, KHÔNG đi qua `snapshot_json`, và đó là chủ ý: đoạn này chạy
    *trước khi lượt chơi tồn tại*, nên không thể đợi chính cái request tạo ra
    snapshot. Trang màn chơi gọi nó lúc render phía server, song song với
    `/play/context` — không tốn thêm nhịp chờ nào, và thẻ `<video>` đã nằm sẵn
    trong HTML của lần vẽ đầu tiên. Xem GAME_DOMAIN §3e.

    Cùng bộ lọc hiển thị với `start`, nhưng KHÔNG kiểm điểm chiến lực: biết URL
    một đoạn video của màn chưa mở thì không mở được màn đó. Cái chặn nằm ở
    `start`, chỗ duy nhất tạo ra lượt chơi.

    ## Đang chơi dở thì KHÔNG có video

    Vào lại một màn còn dở là *chơi tiếp* — bài đang làm còn nguyên, đồng hồ vẫn
    đang chạy từ `started_at`. Chiếu lại đoạn mở màn ở đó là kể lại phần mở đầu
    cho người đã đi được nửa đường, và tệ hơn: nó ăn thêm giây của chính cái
    đồng hồ đang chạy.

    Quyết ở SERVER chứ không ở giao diện, vì server là nơi biết câu trả lời —
    và nhờ vậy trình duyệt không tải một đoạn video rồi mới phát hiện ra mình
    không cần nó.

    Dùng chung đúng một hàm với `start_run` (`resumable_run`): hai bản chép của
    luật "vào lại có chơi tiếp không" sẽ lệch nhau ở lượt vừa hết giờ, và hậu
    quả là học sinh xem video xong bước vào một lượt chơi dở — hoặc ngược lại.
    """
    stage = await db.scalar(worlds_service.visible_stages(current).where(Stage.id == stage_id))
    if stage is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="stage")

    if await service.resumable_run(db, current, stage.id) is not None:
        return StageIntroOut(intro_video_url=None)

    return StageIntroOut(intro_video_url=await _url(db, stage.intro_video_media_id))


@router.post(
    "/stages/{stage_id}/start",
    response_model=RunOut,
    status_code=status.HTTP_201_CREATED,
    summary="Bắt đầu một lượt chơi",
)
async def start(stage_id: uuid.UUID, current: CurrentUserDep, db: DbDep) -> RunOut:
    stage = await db.scalar(worlds_service.visible_stages(current).where(Stage.id == stage_id))
    if stage is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="stage")

    # Đủ điểm chiến lực mới được vào. Kiểm ở ĐÂY, không chỉ ở giao diện:
    # nút bị làm mờ chỉ ngăn được người bấm chuột, không ngăn được người
    # gõ thẳng URL.
    if current.role not in UserRole.CAN_PREVIEW:
        world = await worlds_service.world_of_stage(db, stage)
        required = worlds_service.effective_required_skill_pts(stage, world)
        progress = await db.scalar(
            select(WorldProgress).where(
                WorldProgress.world_id == world.id, WorldProgress.user_id == current.id
            )
        )
        have = progress.skill_pts if progress else 0
        if have < required:
            raise ConflictError(service.PlayError.STAGE_LOCKED, required=required, have=have)

    run = await service.start_run(db, current, stage)
    return await _run_out(db, current, run)


@router.get("/runs/{run_id}", response_model=RunOut, summary="Trạng thái một lượt chơi")
async def read_run(run_id: uuid.UUID, current: CurrentUserDep, db: DbDep) -> RunOut:
    run = await service.get_run(db, current, run_id)

    # Hết giờ thì chốt ngay lúc có người hỏi tới, không cần vòng lặp nền.
    if run.status == RunStatus.PLAYING and service.seconds_remaining(run) <= 0:
        await service.settle_run(db, run, RunStatus.LOST_TIME)

    return await _run_out(db, current, run)


@router.put(
    "/runs/{run_id}/quests/{quest_id}/questions/{question_id}/draft",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Lưu đáp án đang dở của một câu",
)
async def save_draft(
    run_id: uuid.UUID,
    quest_id: uuid.UUID,
    question_id: uuid.UUID,
    payload: SaveDraftIn,
    current: CurrentUserDep,
    db: DbDep,
) -> None:
    """Ghi lại lựa chọn, KHÔNG chấm.

    Giao diện gọi mỗi khi người chơi chuyển sang câu khác. Nhờ vậy mất mạng hay
    đóng nhầm tab thì vào lại vẫn thấy đúng những gì mình đã chọn.

    `PUT` chứ không `POST`: gọi hai lần cùng một nội dung cho cùng một kết quả,
    và mạng chập chờn thì lần gửi lại không được sinh ra thêm bản nháp thứ hai.
    """
    run = await service.get_run(db, current, run_id)
    await service.save_draft(db, current, run, quest_id, question_id, payload.response)


@router.post(
    "/runs/{run_id}/quests/{quest_id}/submit",
    response_model=SubmitQuestOut,
    summary="Nộp cả nhiệm vụ",
)
async def submit_quest(
    run_id: uuid.UUID,
    quest_id: uuid.UUID,
    current: CurrentUserDep,
    db: DbDep,
) -> SubmitQuestOut:
    """Chấm CẢ NHIỆM VỤ từ các bản nháp, ở server.

    Trả về ĐÚNG BA TRƯỜNG: không điểm, không đáp án, không giải thích, không
    điểm chiến lực — xem docs/GAME_DOMAIN.md §1.6. Chi tiết ở màn xem lại sau
    khi hết màn.

    Không nhận bài trong thân request: bài đã nằm ở `quest_drafts` rồi. Cho gửi
    kèm ở đây là mở đường thứ hai vào cùng một chỗ, và hai đường thì sẽ có ngày
    một đường nói khác đường kia.
    """
    run = await service.get_run(db, current, run_id)
    kq = await service.submit_quest(db, current, run, quest_id)

    # Dựng tiến độ NGAY TỪ thứ vừa chấm xong, không hỏi lại database.
    #
    # Chỉ còn đúng một truy vấn thêm — bản nháp — vì `drafts` thuộc về màn hình
    # chứ không phải phép chấm. Cả phản hồi nặng khoảng 1 KB, thay cho một vòng
    # `GET /runs/{id}` nặng 66 KB sau mỗi câu trả lời của mỗi học sinh.
    quest = next(
        q for q in run.snapshot_json["quests"] if q["id"] == str(quest_id)
    )
    drafts = await service.drafts_of(db, run.id, current.id)

    return SubmitQuestOut(
        quest_completed=kq.quest_done,
        attempts_left=kq.attempts_left,
        my_energy=kq.energy,
        quest=_quest_progress(
            quest, kq.answers, kq.player, drafts, kq.max_attempts, kq.cleared
        ),
        unlocked=kq.cleared,
        run_status=kq.run_status,
        my_energy_granted=kq.energy_granted,
    )


@router.post(
    "/runs/{run_id}/quests/{quest_id}/retry",
    response_model=RunOut,
    summary="Làm lại một nhiệm vụ từ đầu",
)
async def retry_quest(
    run_id: uuid.UUID,
    quest_id: uuid.UUID,
    current: CurrentUserDep,
    db: DbDep,
) -> RunOut:
    """Mở một VÒNG mới cho một nhiệm vụ: mọi câu trở về trắng, lượt thử đếm lại.

    Không cấm khi nhiệm vụ đã hoàn thành — đó mới là lúc người ta muốn chơi lại
    nhất: đã qua rồi, giờ thử làm cho đẹp hơn. Nhật ký các vòng cũ được giữ
    nguyên và báo cáo đọc vòng TỐT NHẤT, nên lần chơi lại không có gì để mất.

    Trả về cả `RunOut` chứ không phải một con số: sau khi làm lại thì tiến độ,
    điểm và bản nháp đều đổi, và màn chơi cần đúng một lượt gọi để vẽ lại.
    """
    run = await service.get_run(db, current, run_id)
    await service.retry_quest(db, current, run, quest_id)
    return await _run_out(db, current, run)


@router.post(
    "/runs/{run_id}/questions/{question_id}/hints/{kind}",
    response_model=TranslationOut,
    summary="Mua một gợi ý của câu hỏi",
)
async def buy_hint(
    run_id: uuid.UUID,
    question_id: uuid.UUID,
    kind: Literal["translation", "transcript"],
    current: CurrentUserDep,
    db: DbDep,
) -> TranslationOut:
    """Trả năng lượng để đọc bản dịch, hoặc lời thoại của câu nghe.

    `POST` chứ không `GET`: nó TIÊU một thứ. Một đường `GET` thì trình duyệt,
    proxy hay một cú tải lại trang đều có quyền gọi lại mà không hỏi ai.

    Trả một lần rồi thì lần sau miễn phí — xem `buy_hint()`.
    """
    run = await service.get_run(db, current, run_id)
    text_vi, energy = await service.buy_hint(db, current, run, question_id, kind)
    return TranslationOut(text=text_vi, my_energy_remaining=energy)


@router.put(
    "/runs/{run_id}/position",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Lưu chỗ nhân vật đang đứng",
)
async def save_position(
    run_id: uuid.UUID,
    payload: SavePositionIn,
    current: CurrentUserDep,
    db: DbDep,
) -> None:
    """Ghi chỗ đứng của RIÊNG người gọi, để vào lại còn đứng đúng chỗ đó.

    `PUT` chứ không `POST`: gọi mười lần cùng một toạ độ cho cùng một kết quả,
    và đây là thứ được gọi liên tục trong lúc chơi.
    """
    run = await service.get_run(db, current, run_id)
    await service.save_position(db, current, run, payload.x, payload.y)


@router.post(
    "/runs/{run_id}/abandon",
    response_model=RunOut,
    summary="Bỏ dở lượt chơi",
)
async def abandon(run_id: uuid.UUID, current: CurrentUserDep, db: DbDep) -> RunOut:
    run = await service.get_run(db, current, run_id)
    await service.settle_run(db, run, RunStatus.ABANDONED)
    return await _run_out(db, current, run)


# --------------------------------------------------------------------------
# Kết quả & xem lại
# --------------------------------------------------------------------------


@router.get("/runs/{run_id}/result", response_model=RunResultOut, summary="Bảng kết quả màn")
async def result(run_id: uuid.UUID, current: CurrentUserDep, db: DbDep) -> RunResultOut:
    run = await service.get_run(db, current, run_id)
    if run.status == RunStatus.PLAYING:
        raise ConflictError(service.PlayError.RUN_STILL_PLAYING)

    stage = await db.scalar(select(Stage).where(Stage.id == run.stage_id))
    world = await service.world_of_run(db, run)

    players = list(
        await db.scalars(select(StageRunPlayer).where(StageRunPlayer.stage_run_id == run.id))
    )
    names = {
        u.id: u.display_name
        for u in await db.scalars(
            select(User).where(User.id.in_([p.user_id for p in players if p.user_id]))
        )
    }

    progress = await service._get_or_create_world_progress(db, world.id, current.id)
    await db.commit()

    return RunResultOut(
        status=run.status,
        map_shard_index=stage.map_shard_index if (stage and run.status == RunStatus.WON) else None,
        duration_seconds=run.duration_seconds,
        my_energy_remaining=next(
            (p.energy_remaining for p in players if p.user_id == current.id), 0
        ),
        players=[
            RunResultPlayer(
                user_id=p.user_id,
                hero_key=p.hero_key,
                display_name=names.get(p.user_id, "Bot"),
                quests_completed=p.quests_completed,
                score=p.score,
                max_score=p.max_score,
                skill_pts_earned=p.skill_pts_earned,
                got_map_shard=p.got_map_shard,
            )
            for p in players
        ],
        my_world_skill_pts=progress.skill_pts,
        my_shards_owned=await service.count_shards(db, world.id, current.id),
        world_shard_total=world.shard_total,
    )


@router.get("/runs/{run_id}/review", response_model=ReviewOut, summary="Xem lại bài của mình")
async def review(run_id: uuid.UUID, current: CurrentUserDep, db: DbDep) -> ReviewOut:
    """Màn xem lại (S6b).

    Hai chốt: chỉ mở khi lượt chơi ĐÃ KẾT THÚC, và chỉ trả bài của CHÍNH người
    gọi. Không có tab xem bài người khác — không phải vì khó làm, mà vì bài làm
    sai của một đứa trẻ không nên nằm trên màn hình của ba đứa còn lại.
    """
    run = await service.get_run(db, current, run_id)
    if run.status == RunStatus.PLAYING:
        raise ConflictError(service.PlayError.RUN_STILL_PLAYING)

    answers = list(
        await db.scalars(
            select(QuestAnswer)
            .where(QuestAnswer.stage_run_id == run.id, QuestAnswer.user_id == current.id)
            .order_by(QuestAnswer.attempt_no)
        )
    )
    key = run.answer_key_json["questions"]

    quests: list[ReviewQuest] = []
    total_earned = 0.0
    total_max = 0

    for quest in run.snapshot_json["quests"]:
        quest_id = uuid.UUID(quest["id"])
        questions: list[ReviewQuestion] = []

        for question in quest["questions"]:
            question_id = uuid.UUID(question["id"])
            tries = [
                a for a in answers if a.quest_id == quest_id and a.question_id == question_id
            ]
            entry = key.get(question["id"], {})
            earned = sum(a.score for a in tries if a.is_correct)
            total_earned += earned
            total_max += question["points"]

            questions.append(
                ReviewQuestion(
                    question_id=question_id,
                    type=question["type"],
                    content=question["content"],
                    points=question["points"],
                    # Giờ mới lộ đáp án. Trước lúc này nó ở lại server.
                    answer=entry.get("answer"),
                    explanation=entry.get("explanation"),
                    attempts=[
                        ReviewAttempt(
                            attempt_no=a.attempt_no,
                            response=a.response_json,
                            is_correct=a.is_correct,
                            score=a.score,
                        )
                        for a in tries
                    ],
                    earned=earned,
                    skill_pts_awarded=sum(a.skill_pts_awarded for a in tries),
                    # Ba trường này đọc từ ĐỀ BÀI ĐÃ ĐÓNG BĂNG. Câu cũ trong
                    # snapshot có thể thiếu chúng — lượt chơi tạo ra trước khi
                    # có `prompt_kind` vẫn phải xem lại được, nên `.get()` với
                    # đúng mặc định của cột thay vì `[...]`.
                    prompt_kind=question.get("prompt_kind") or "text",
                    show_transcript=bool(question.get("show_transcript")),
                    audio_url=question.get("audio_url"),
                )
            )

        # Màn xem lại đọc VÒNG TỐT NHẤT, cùng con số với báo cáo. Cộng mọi
        # vòng thì tổng điểm ở đây to hơn tổng điểm ở bảng kết quả, và người đọc
        # phải tự đoán chỗ nào nói thật.
        quest_earned = service.quest_best(answers, quest_id)
        quests.append(
            ReviewQuest(
                quest_id=quest_id,
                order_index=quest["order_index"],
                quest_object_key=quest["quest_object_key"],
                name_i18n=quest.get("name_i18n") or {},
                phase=quest["phase"],
                pass_score=quest["pass_score"],
                earned=quest_earned,
                completed=quest_earned >= quest["pass_score"],
                questions=questions,
            )
        )

    player = await db.scalar(
        select(StageRunPlayer).where(
            StageRunPlayer.stage_run_id == run.id, StageRunPlayer.user_id == current.id
        )
    )

    world = await service.world_of_run(db, run)

    return ReviewOut(
        run_id=run.id,
        stage_id=run.stage_id,
        world_id=world.id,
        stage_name_i18n=run.snapshot_json["stage"]["name_i18n"],
        status=run.status,
        quests=quests,
        total_earned=total_earned,
        total_max=total_max,
        skill_pts_earned=player.skill_pts_earned if player else 0,
    )


# --------------------------------------------------------------------------
# NHẬT KÝ HỘI THOẠI
# --------------------------------------------------------------------------


@router.get(
    "/runs/{run_id}/quests/{quest_id}/dialogue",
    response_model=DialogueThreadOut,
    summary="Đoạn chat với người canh giữ",
)
async def read_dialogue(
    run_id: uuid.UUID,
    quest_id: uuid.UUID,
    current: CurrentUserDep,
    db: DbDep,
) -> DialogueThreadOut:
    """Cả đoạn chat của MÌNH với người canh giữ nhiệm vụ này.

    Đọc lúc mở màn hội thoại: vào lại một nhiệm vụ đang dở thì cuộn lên vẫn thấy
    nguyên những câu đã hỏi và đã trả lời, kể cả sau khi đóng trình duyệt hay
    đổi máy.
    """
    run = await service.get_run(db, current, run_id)
    rows = await service.dialogue_messages(db, current, run, quest_id)
    return DialogueThreadOut(
        quest_id=quest_id, lines=[DialogueLineOut.model_validate(r) for r in rows]
    )


@router.post(
    "/runs/{run_id}/quests/{quest_id}/dialogue",
    response_model=DialogueThreadOut,
    summary="Ghi thêm câu nói vào đoạn chat",
)
async def append_dialogue(
    run_id: uuid.UUID,
    quest_id: uuid.UUID,
    payload: AppendDialogueIn,
    current: CurrentUserDep,
    db: DbDep,
) -> DialogueThreadOut:
    """Ghi lại đúng những câu vừa hiện ra trên màn hình.

    Giao diện ghi, không phải server tự suy: lời khen chê bốc ngẫu nhiên trong
    năm câu, bản dịch mua bằng năng lượng, câu mở đầu của nhiệm vụ — server
    không dựng lại được cái nào cho khớp với thứ học sinh vừa đọc.

    Trả về CẢ đoạn, không chỉ phần vừa thêm: giao diện vẽ một danh sách, nhận
    về đúng thứ sắp vẽ thì không phải tự ghép hai nguồn.
    """
    run = await service.get_run(db, current, run_id)
    rows = await service.append_dialogue(
        db, current, run, quest_id, [line.model_dump() for line in payload.lines]
    )
    return DialogueThreadOut(
        quest_id=quest_id, lines=[DialogueLineOut.model_validate(r) for r in rows]
    )

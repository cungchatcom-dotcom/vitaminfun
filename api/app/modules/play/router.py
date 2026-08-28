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
    StageRunPlayer,
    User,
    UserRole,
    World,
    WorldCharacter,
    WorldProgress,
)
from app.modules.play import service
from app.modules.play.schemas import (
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
    SubmitAnswerIn,
    SubmitAnswerOut,
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
        music_url=await url_of(galaxy.music_media_id),
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
    ids = {
        element["media_id"]
        for element in layout.values()
        if isinstance(element, dict) and element.get("media_id")
    }
    urls: dict[str, str] = {}
    if ids:
        found = {
            str(row.id): row.url
            for row in await db.execute(
                select(MediaAsset.id, MediaAsset.url).where(MediaAsset.id.in_(ids))
            )
        }
        urls = {
            key: found[str(element["media_id"])]
            for key, element in layout.items()
            if isinstance(element, dict) and str(element.get("media_id")) in found
        }

    return PlayLobbyOut(
        background_url=await _url(
            db, world.lobby_media_id or (galaxy.background_media_id if galaxy else None)
        ),
        title=await frame("title"),
        desc=await frame("desc"),
        layout=layout,
        urls=urls,
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

        out_stages: list[PlayStageOut] = []
        for stage in stages:
            required = worlds_service.effective_required_skill_pts(stage, world)
            progress = await db.scalar(
                select(StageProgress).where(
                    StageProgress.stage_id == stage.id, StageProgress.user_id == current.id
                )
            )
            out_stages.append(
                PlayStageOut(
                    id=stage.id,
                    order_index=stage.order_index,
                    name_i18n=stage.name_i18n,
                    synopsis_i18n=stage.synopsis_i18n,
                    map_shard_index=stage.map_shard_index,
                    quest_count=await worlds_service.quest_count(db, stage.id),
                    required_skill_pts=required,
                    # Nhảy bậc là HỆ QUẢ của luật này, không phải ngoại lệ phải
                    # viết riêng: đủ điểm thì mở, bất kể đã chơi màn trước hay chưa.
                    unlocked=can_bypass or skill_pts >= required,
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
        my_character_id=await db.scalar(
            select(WorldProgress.character_id).where(
                WorldProgress.world_id == world.id, WorldProgress.user_id == current.id
            )
        ),
        chapters=out_chapters,
        gate_ready=summary["my_shards"] >= world.shard_total,
        level_i18n=world.level_i18n or {},
        **await _stats_numbers(db, world, current.id),
    )


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
    """
    character_id = await db.scalar(
        select(WorldProgress.character_id).where(
            WorldProgress.world_id == world_id, WorldProgress.user_id == user_id
        )
    )
    if character_id is None:
        return None

    character = await db.scalar(
        select(Character).where(
            Character.id == character_id, Character.status == PublishStatus.PUBLISHED
        )
    )
    if character is None:
        return None

    rows = list(
        await db.execute(
            select(CharacterAction, MediaAsset.url, MediaAsset.width, MediaAsset.height)
            .join(MediaAsset, MediaAsset.id == CharacterAction.media_id)
            .where(CharacterAction.character_id == character.id)
        )
    )

    sprites: list[RunSpriteOut] = []
    for action, url, media_width, media_height in rows:
        # Khổ khung để trống thì SUY từ khổ ảnh: một dải ngang `n` khung thì mỗi
        # khung rộng `ảnh ÷ n`, cao bằng cả ảnh. Suy ở đây chứ không ở giao diện
        # vì cắt sai một pixel là cả hoạt ảnh trượt khung.
        width = action.frame_width or (
            int(media_width // action.frames) if media_width else None
        )
        height = action.frame_height or media_height
        if not width or not height:
            continue
        sprites.append(
            RunSpriteOut(
                action_key=action.action_key,
                url=url,
                frames=action.frames,
                frame_width=width,
                frame_height=height,
                frame_rate=action.frame_rate,
            )
        )

    return RunCharacterOut(
        id=character.id, name_i18n=character.name_i18n or {}, sprites=sprites
    )


async def _run_out(db: DbDep, user: User, run) -> RunOut:
    room = await db.scalar(select(Room).where(Room.id == run.room_id))
    answers = list(
        await db.scalars(select(QuestAnswer).where(QuestAnswer.stage_run_id == run.id))
    )
    mine = [a for a in answers if a.user_id == user.id]

    world = await service.world_of_run(db, run)
    max_attempts = read_balance(world.balance_json).get("maxAttemptsPerQuestion")

    progress: list[QuestProgress] = []
    for quest in run.snapshot_json["quests"]:
        quest_id = uuid.UUID(quest["id"])
        questions: list[QuestionProgress] = []
        for question in quest["questions"]:
            question_id = uuid.UUID(question["id"])
            tries = [a for a in mine if a.quest_id == quest_id and a.question_id == question_id]
            done = any(a.is_correct for a in tries)
            left = (
                None
                if max_attempts is None
                else (0 if done else max(0, int(max_attempts) - len(tries)))
            )
            questions.append(
                QuestionProgress(question_id=question_id, completed=done, attempts_left=left)
            )
        progress.append(
            QuestProgress(
                quest_id=quest_id,
                completed=service.quest_earned(mine, quest_id) >= quest["pass_score"],
                questions=questions,
            )
        )

    players = list(
        await db.scalars(select(StageRunPlayer).where(StageRunPlayer.stage_run_id == run.id))
    )
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
            if service.quest_earned(rows, uuid.UUID(q["id"])) >= q["pass_score"]
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
        team_energy_initial=run.team_energy_initial,
        team_energy_remaining=run.team_energy_remaining,
        seconds_remaining=service.seconds_remaining(run),
        started_at=run.started_at,
        my_progress=progress,
        team=team,
    )


# --------------------------------------------------------------------------
# Vào màn
# --------------------------------------------------------------------------


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


@router.post(
    "/runs/{run_id}/quests/{quest_id}/questions/{question_id}/answer",
    response_model=SubmitAnswerOut,
    summary="Nộp bài một câu hỏi",
)
async def submit(
    run_id: uuid.UUID,
    quest_id: uuid.UUID,
    question_id: uuid.UUID,
    payload: SubmitAnswerIn,
    current: CurrentUserDep,
    db: DbDep,
) -> SubmitAnswerOut:
    """Chấm ngay ở server, trả về ĐÚNG BỐN TRƯỜNG.

    Không điểm, không đáp án, không giải thích, không điểm chiến lực — xem
    docs/GAME_DOMAIN.md §1.6. Chi tiết ở màn xem lại sau khi hết màn.
    """
    run = await service.get_run(db, current, run_id)
    completed, quest_done, attempts_left, energy = await service.submit_answer(
        db, current, run, quest_id, question_id, payload.response
    )
    return SubmitAnswerOut(
        completed=completed,
        quest_completed=quest_done,
        attempts_left=attempts_left,
        team_energy=energy,
    )


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
        team_energy_remaining=run.team_energy_remaining,
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
                )
            )

        quest_earned = service.quest_earned(answers, quest_id)
        quests.append(
            ReviewQuest(
                quest_id=quest_id,
                order_index=quest["order_index"],
                quest_object_key=quest["quest_object_key"],
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

    return ReviewOut(
        run_id=run.id,
        stage_name_i18n=run.snapshot_json["stage"]["name_i18n"],
        status=run.status,
        quests=quests,
        total_earned=total_earned,
        total_max=total_max,
        skill_pts_earned=player.skill_pts_earned if player else 0,
    )

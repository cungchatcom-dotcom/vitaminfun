"""API dựng nội dung game — dành cho giáo viên và admin.

Học sinh KHÔNG gọi tới đây. Đường đọc của học sinh là module `play` (Bước 6),
nơi mọi truy vấn đi qua `visible_worlds()` và không bao giờ trả nội dung nháp.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select

from app.core.deps import CurrentUserDep, DbDep, require_role
from app.core.errors import ConflictError, ErrorCode, NotFoundError, ValidationFailedError
from app.db.models import (
    Chapter,
    Galaxy,
    PublishStatus,
    MediaAsset,
    Quest,
    QuestQuestion,
    Question,
    Stage,
    StageRun,
    User,
    UserRole,
    World,
)
from app.modules.worlds import service
from app.db.models.content import DEFAULT_QUESTION_POINTS
from app.modules.worlds.balance import DEFAULT_BALANCE, read_balance
from app.modules.worlds.schemas import (
    ChapterCreate,
    GalaxyOut,
    GalaxyUpdate,
    ChapterOut,
    ChapterUpdate,
    QuestCreate,
    QuestOut,
    QuestQuestionAdd,
    QuestQuestionOut,
    QuestQuestionUpdate,
    QuestUpdate,
    StageBrief,
    StageCreate,
    StageOut,
    StageUpdate,
    WorldCreate,
    WorldOut,
    WorldUpdate,
)

router = APIRouter(
    tags=["worlds"],
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)


# --------------------------------------------------------------------------
# Chuyển đổi
# --------------------------------------------------------------------------


async def _galaxy_out(db: DbDep, galaxy: Galaxy) -> GalaxyOut:
    async def url_of(media_id):
        if media_id is None:
            return None
        return await db.scalar(select(MediaAsset.url).where(MediaAsset.id == media_id))

    return GalaxyOut(
        id=galaxy.id,
        universe_id=galaxy.universe_id,
        name_i18n=galaxy.name_i18n,
        description_i18n=galaxy.description_i18n,
        position=galaxy.position,
        status=galaxy.status,
        background_media_id=galaxy.background_media_id,
        music_media_id=galaxy.music_media_id,
        title_media_id=galaxy.title_media_id,
        title_x=galaxy.title_x,
        title_y=galaxy.title_y,
        title_width=galaxy.title_width,
        title_height=galaxy.title_height,
        title_color=galaxy.title_color,
        title_font=galaxy.title_font,
        desc_media_id=galaxy.desc_media_id,
        desc_x=galaxy.desc_x,
        desc_y=galaxy.desc_y,
        desc_width=galaxy.desc_width,
        desc_height=galaxy.desc_height,
        desc_color=galaxy.desc_color,
        desc_font=galaxy.desc_font,
        background_url=await url_of(galaxy.background_media_id),
        music_url=await url_of(galaxy.music_media_id),
        title_url=await url_of(galaxy.title_media_id),
        desc_url=await url_of(galaxy.desc_media_id),
    )


async def _url_of(db: DbDep, media_id) -> str | None:
    """URL của một tấm ảnh. `None` vào thì `None` ra — chỗ gọi khỏi phải kiểm."""
    if media_id is None:
        return None
    return await db.scalar(select(MediaAsset.url).where(MediaAsset.id == media_id))


async def _lobby_urls(db: DbDep, layout: dict[str, Any]) -> dict[str, str]:
    """Đổi `media_id` bên trong bố cục phòng chờ thành URL.

    MỘT truy vấn cho cả sáu khối, không phải sáu. Chúng thường dùng ít ảnh và
    có khi dùng chung một ảnh, nên gom lại rồi tra một lần.
    """
    ids = {
        element["media_id"]
        for element in layout.values()
        if isinstance(element, dict) and element.get("media_id")
    }
    if not ids:
        return {}

    urls = {
        str(row.id): row.url
        for row in await db.execute(
            select(MediaAsset.id, MediaAsset.url).where(MediaAsset.id.in_(ids))
        )
    }
    return {
        key: urls[str(element["media_id"])]
        for key, element in layout.items()
        if isinstance(element, dict) and str(element.get("media_id")) in urls
    }


async def _world_out(db: DbDep, world: World) -> WorldOut:
    chapters, stages, published = await service.stage_counts(db, world.id)

    async def url_of(media_id):
        if media_id is None:
            return None
        return await db.scalar(select(MediaAsset.url).where(MediaAsset.id == media_id))

    return WorldOut(
        id=world.id,
        galaxy_id=world.galaxy_id,
        name_i18n=world.name_i18n,
        story_i18n=world.story_i18n,
        position=world.position,
        difficulty=world.difficulty,
        age_min=world.age_min,
        age_max=world.age_max,
        shard_total=world.shard_total,
        cover_media_id=world.cover_media_id,
        cover_url=await url_of(world.cover_media_id),
        lobby_media_id=world.lobby_media_id,
        lobby_url=await url_of(world.lobby_media_id),
        title_media_id=world.title_media_id,
        title_url=await url_of(world.title_media_id),
        title_x=world.title_x,
        title_y=world.title_y,
        title_width=world.title_width,
        title_height=world.title_height,
        title_color=world.title_color,
        title_font=world.title_font,
        desc_media_id=world.desc_media_id,
        desc_url=await url_of(world.desc_media_id),
        desc_x=world.desc_x,
        desc_y=world.desc_y,
        desc_width=world.desc_width,
        desc_height=world.desc_height,
        desc_color=world.desc_color,
        desc_font=world.desc_font,
        lobby_json=world.lobby_json or {},
        lobby_urls=await _lobby_urls(db, world.lobby_json or {}),
        scene_x=world.scene_x,
        scene_y=world.scene_y,
        icon_size=world.icon_size,
        pulse_percent=world.pulse_percent,
        pulse_period_ms=world.pulse_period_ms,
        is_locked=world.is_locked,
        show_ring=world.show_ring,
        status=world.status,
        # Trả về bản ĐÃ HỢP NHẤT với mặc định: giao diện không phải tự bù khoá
        # thiếu, và không có hai chỗ cùng biết giá trị mặc định là gì.
        balance=read_balance(world.balance_json),
        chapter_count=chapters,
        stage_count=stages,
        stage_published_count=published,
    )


async def _chapter_out(db: DbDep, chapter: Chapter, current: User) -> ChapterOut:
    """Một chương, ĐẦY ĐỦ — kể cả ảnh và danh sách màn.

    Một chỗ dựng duy nhất cho cả `GET`, `POST` và `PATCH`. Trước đây `POST` và
    `PATCH` tự dựng lấy một bản rút gọn (`stages=[]`, không có ảnh), nên sau khi
    tải ảnh chương lên, giao diện lấy kết quả PATCH đắp vào chỗ cũ là **mất cả
    ảnh vừa tải lẫn danh sách màn** — chương đang mở bỗng hiện ổ khoá cho tới
    khi tải lại trang. Trả về cùng một hình dạng ở cả ba đường thì không còn chỗ
    cho kiểu lệch đó.
    """
    world = await service.get_world(db, current, chapter.world_id)
    stages = list(
        await db.scalars(
            service.visible_stages(current)
            .where(Stage.chapter_id == chapter.id)
            .order_by(Stage.order_index)
        )
    )
    return ChapterOut(
        id=chapter.id,
        world_id=chapter.world_id,
        order_index=chapter.order_index,
        name_i18n=chapter.name_i18n,
        synopsis_i18n=chapter.synopsis_i18n,
        cover_media_id=chapter.cover_media_id,
        cover_url=await _url_of(db, chapter.cover_media_id),
        minimap_media_id=chapter.minimap_media_id,
        minimap_url=await _url_of(db, chapter.minimap_media_id),
        stages=[await _stage_brief(db, stage, world) for stage in stages],
    )


async def _stage_brief(db: DbDep, stage: Stage, world: World) -> StageBrief:
    return StageBrief(
        id=stage.id,
        chapter_id=stage.chapter_id,
        order_index=stage.order_index,
        name_i18n=stage.name_i18n,
        scene_key=stage.scene_key,
        map_shard_index=stage.map_shard_index,
        status=stage.status,
        quest_count=await service.quest_count(db, stage.id),
        required_skill_pts_effective=service.effective_required_skill_pts(stage, world),
    )


async def _quests_out(db: DbDep, stage_id: uuid.UUID) -> list[QuestOut]:
    quests = list(
        await db.scalars(select(Quest).where(Quest.stage_id == stage_id).order_by(Quest.order_index))
    )
    if not quests:
        return []

    links = list(
        await db.scalars(
            select(QuestQuestion)
            .where(QuestQuestion.quest_id.in_([q.id for q in quests]))
            .order_by(QuestQuestion.order_index)
        )
    )

    # Nạp mọi câu hỏi trong một lượt, không phải mỗi nhiệm vụ một truy vấn.
    question_rows = {}
    if links:
        rows = await db.execute(
            select(
                Question.id,
                Question.type,
                Question.status,
                Question.content_json,
                Question.deleted_at,
            ).where(Question.id.in_([link.question_id for link in links]))
        )
        question_rows = {r.id: r for r in rows}

    # Nạp URL ảnh của mọi nhiệm vụ trong một lượt, không phải mỗi cái một truy vấn.
    icon_ids = [q.icon_media_id for q in quests if q.icon_media_id]
    icons: dict[uuid.UUID, str] = {}
    if icon_ids:
        rows = await db.execute(
            select(MediaAsset.id, MediaAsset.url).where(MediaAsset.id.in_(icon_ids))
        )
        icons = {r.id: r.url for r in rows}

    by_quest: dict[uuid.UUID, list[QuestQuestionOut]] = {}
    for link in links:
        row = question_rows.get(link.question_id)
        content = (row.content_json if row else None) or {}
        by_quest.setdefault(link.quest_id, []).append(
            QuestQuestionOut(
                id=link.id,
                question_id=link.question_id,
                order_index=link.order_index,
                points=link.points,
                question_type=row.type if row else None,
                question_status=row.status if row else None,
                question_deleted=(row is None or row.deleted_at is not None),
                # Chỉ đề bài. Sơ đồ màn của giáo viên cũng là thứ có thể bị
                # chiếu lên máy chiếu trong lớp.
                question_prompt=content.get("prompt") or content.get("template"),
            )
        )

    out: list[QuestOut] = []
    for quest in quests:
        items = by_quest.get(quest.id, [])
        total = sum(i.points for i in items)
        out.append(
            QuestOut(
                id=quest.id,
                stage_id=quest.stage_id,
                order_index=quest.order_index,
                phase=quest.phase,
                quest_object_key=quest.quest_object_key,
                name_i18n=quest.name_i18n or {},
                scene_x=quest.scene_x,
                scene_y=quest.scene_y,
                trigger_radius=quest.trigger_radius,
                icon_media_id=quest.icon_media_id,
                icon_size=quest.icon_size,
                pulse_percent=quest.pulse_percent,
                pulse_period_ms=quest.pulse_period_ms,
                icon_url=icons.get(quest.icon_media_id),
                energy_cost=quest.energy_cost,
                questions=items,
                total_points=total,
                pass_score=quest.pass_score,
                pass_score_effective=service.effective_pass_score(quest.pass_score, total),
            )
        )
    return out


async def _one_quest_out(db: DbDep, quest: Quest) -> QuestOut:
    quests = await _quests_out(db, quest.stage_id)
    return next(q for q in quests if q.id == quest.id)


async def _stage_out(db: DbDep, stage: Stage, world: World) -> StageOut:
    brief = await _stage_brief(db, stage, world)
    background_url = None
    if stage.background_media_id:
        background_url = await db.scalar(
            select(MediaAsset.url).where(MediaAsset.id == stage.background_media_id)
        )
    return StageOut(
        **brief.model_dump(),
        background_url=background_url,
        synopsis_i18n=stage.synopsis_i18n,
        time_limit_seconds=stage.time_limit_seconds,
        initial_team_energy=stage.initial_team_energy,
        skill_pts_max=stage.skill_pts_max,
        required_skill_pts=stage.required_skill_pts,
        min_players=stage.min_players,
        max_players=stage.max_players,
        advisor_npc_key=stage.advisor_npc_key,
        background_media_id=stage.background_media_id,
        advisor_portrait_media_id=stage.advisor_portrait_media_id,
        cluebook_i18n=stage.cluebook_i18n,
        quests=await _quests_out(db, stage.id),
        publish_blockers=await service.publish_blockers(db, stage, world),
    )


def _apply(target: object, payload: object, fields: tuple[str, ...]) -> None:
    """Gán các trường khác None từ payload sang model."""
    for field in fields:
        value = getattr(payload, field, None)
        if value is not None:
            setattr(target, field, value)


# --------------------------------------------------------------------------
# World
# --------------------------------------------------------------------------


# --------------------------------------------------------------------------
# Thiên hà
# --------------------------------------------------------------------------


@router.get("/galaxies", response_model=list[GalaxyOut], summary="Danh sách thiên hà")
async def list_galaxies(db: DbDep) -> list[GalaxyOut]:
    """Mọi thiên hà, kể cả bản nháp.

    KHÔNG lọc theo `visible_worlds()`: đây là màn dựng nội dung, và chỉ giáo
    viên với admin vào được router này. Học sinh đọc thiên hà qua
    `GET /play/galaxy`, nơi bộ lọc phát hành được áp cho từng world.
    """
    galaxies = list(await db.scalars(select(Galaxy).order_by(Galaxy.position)))
    return [await _galaxy_out(db, g) for g in galaxies]


@router.patch("/galaxies/{galaxy_id}", response_model=GalaxyOut, summary="Sửa thiên hà")
async def update_galaxy(galaxy_id: uuid.UUID, payload: GalaxyUpdate, db: DbDep) -> GalaxyOut:
    galaxy = await db.scalar(select(Galaxy).where(Galaxy.id == galaxy_id))
    if galaxy is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="galaxy")

    _apply(
        galaxy,
        payload,
        (
            "name_i18n",
            "description_i18n",
            "background_media_id",
            "music_media_id",
            "title_media_id",
            "title_x",
            "title_y",
            "title_width",
            "title_height",
            "title_color",
            "title_font",
            "desc_media_id",
            "desc_x",
            "desc_y",
            "desc_width",
            "desc_height",
            "desc_color",
            "desc_font",
        ),
    )
    # `None` trong PATCH nghĩa là "không gửi trường này". Muốn GỠ một tấm ảnh
    # thì phải nói rõ bằng cờ riêng.
    if payload.clear_background:
        galaxy.background_media_id = None
    if payload.clear_music:
        galaxy.music_media_id = None
    if payload.clear_title:
        galaxy.title_media_id = None
    if payload.clear_desc:
        galaxy.desc_media_id = None

    await db.commit()
    await db.refresh(galaxy)
    return await _galaxy_out(db, galaxy)


# --------------------------------------------------------------------------
# World
# --------------------------------------------------------------------------


@router.get("/worlds", response_model=list[WorldOut], summary="Danh sách world")
async def list_worlds(current: CurrentUserDep, db: DbDep) -> list[WorldOut]:
    worlds = list(await db.scalars(service.visible_worlds(current).order_by(World.position)))
    return [await _world_out(db, w) for w in worlds]


@router.post(
    "/worlds",
    response_model=WorldOut,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo world",
)
async def create_world(payload: WorldCreate, db: DbDep) -> WorldOut:
    galaxy = await db.scalar(select(Galaxy).where(Galaxy.id == payload.galaxy_id))
    if galaxy is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="galaxy")

    world = World(
        galaxy_id=payload.galaxy_id,
        name_i18n=payload.name_i18n,
        story_i18n=payload.story_i18n,
        position=payload.position,
        difficulty=payload.difficulty,
        age_min=payload.age_min,
        age_max=payload.age_max,
        shard_total=payload.shard_total,
        cover_media_id=payload.cover_media_id,
        scene_x=payload.scene_x,
        scene_y=payload.scene_y,
        icon_size=payload.icon_size,
        balance_json=dict(DEFAULT_BALANCE),
        status=PublishStatus.DRAFT,
        # World mới KHOÁ sẵn: nó chưa có chương hay màn nào, mở ra chỉ để học
        # sinh bấm vào một chỗ trống. Giáo viên tự mở khi soạn xong.
        is_locked=True,
    )
    db.add(world)
    await db.commit()
    await db.refresh(world)
    return await _world_out(db, world)


@router.get("/worlds/{world_id}", response_model=WorldOut, summary="Một world")
async def get_world(world_id: uuid.UUID, current: CurrentUserDep, db: DbDep) -> WorldOut:
    world = await service.get_world(db, current, world_id)
    return await _world_out(db, world)


@router.patch("/worlds/{world_id}", response_model=WorldOut, summary="Sửa world")
async def update_world(
    world_id: uuid.UUID, payload: WorldUpdate, current: CurrentUserDep, db: DbDep
) -> WorldOut:
    world = await service.get_world(db, current, world_id)

    _apply(
        world,
        payload,
        (
            "name_i18n",
            "story_i18n",
            "position",
            "difficulty",
            "level_i18n",
            "age_min",
            "age_max",
            "shard_total",
            "cover_media_id",
            "scene_x",
            "scene_y",
            "icon_size",
            "pulse_percent",
            "pulse_period_ms",
            "is_locked",
            "show_ring",
            "status",
            "lobby_media_id",
            "title_media_id",
            "title_x",
            "title_y",
            "title_width",
            "title_height",
            "title_color",
            "title_font",
            "desc_media_id",
            "desc_x",
            "desc_y",
            "desc_width",
            "desc_height",
            "desc_color",
            "desc_font",
        ),
    )

    if payload.lobby_json is not None:
        # GỘP theo từng khối: gửi `{"stats": {...}}` không được làm mất năm
        # khối kia. Cùng luật với `balance_json` ngay dưới.
        merged = dict(world.lobby_json or {})
        for key, element in payload.lobby_json.items():
            merged[key] = element.model_dump(mode="json", exclude_none=True)
        world.lobby_json = merged

    if payload.clear_cover:
        world.cover_media_id = None
    if payload.clear_lobby:
        world.lobby_media_id = None
    if payload.clear_title:
        world.title_media_id = None
    if payload.clear_desc:
        world.desc_media_id = None

    if payload.balance_json is not None:
        # GỘP chứ không thay thế: gửi một khoá không được làm mất mười khoá kia.
        world.balance_json = {**(world.balance_json or {}), **payload.balance_json}

    await db.commit()
    await db.refresh(world)
    return await _world_out(db, world)


# --------------------------------------------------------------------------
# Chương
# --------------------------------------------------------------------------


@router.get(
    "/worlds/{world_id}/chapters",
    response_model=list[ChapterOut],
    summary="Chương và màn chơi của world",
)
async def list_chapters(
    world_id: uuid.UUID, current: CurrentUserDep, db: DbDep
) -> list[ChapterOut]:
    world = await service.get_world(db, current, world_id)
    chapters = list(
        await db.scalars(
            select(Chapter).where(Chapter.world_id == world.id).order_by(Chapter.order_index)
        )
    )

    return [await _chapter_out(db, chapter, current) for chapter in chapters]


@router.post(
    "/worlds/{world_id}/chapters",
    response_model=ChapterOut,
    status_code=status.HTTP_201_CREATED,
    summary="Thêm chương",
)
async def create_chapter(
    world_id: uuid.UUID, payload: ChapterCreate, current: CurrentUserDep, db: DbDep
) -> ChapterOut:
    world = await service.get_world(db, current, world_id)

    taken = await db.scalar(
        select(Chapter).where(
            Chapter.world_id == world.id, Chapter.order_index == payload.order_index
        )
    )
    if taken is not None:
        raise ConflictError(ErrorCode.CONFLICT, field="order_index")

    chapter = Chapter(
        world_id=world.id,
        order_index=payload.order_index,
        name_i18n=payload.name_i18n,
        synopsis_i18n=payload.synopsis_i18n,
    )
    db.add(chapter)
    await db.commit()
    await db.refresh(chapter)
    return await _chapter_out(db, chapter, current)


@router.patch("/chapters/{chapter_id}", response_model=ChapterOut, summary="Sửa chương")
async def update_chapter(
    chapter_id: uuid.UUID, payload: ChapterUpdate, current: CurrentUserDep, db: DbDep
) -> ChapterOut:
    chapter = await service.get_chapter(db, chapter_id)
    _apply(
        chapter,
        payload,
        ("name_i18n", "synopsis_i18n", "order_index", "cover_media_id", "minimap_media_id"),
    )
    if payload.clear_cover:
        chapter.cover_media_id = None
    if payload.clear_minimap:
        chapter.minimap_media_id = None
    await db.commit()
    await db.refresh(chapter)
    return await _chapter_out(db, chapter, current)


@router.delete(
    "/chapters/{chapter_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Xoá chương",
)
async def delete_chapter(chapter_id: uuid.UUID, db: DbDep) -> None:
    """Xoá chương — chỉ khi chương đã rỗng.

    Khoá ngoại là CASCADE, nên xoá một chương còn màn bên trong sẽ kéo theo cả
    màn, nhiệm vụ, và lịch sử chơi. Bắt xoá màn trước là để hành động đó phải
    được nhìn thấy từng bước, không xảy ra sau một cú bấm nhầm.
    """
    chapter = await service.get_chapter(db, chapter_id)

    stages = await db.scalar(
        select(func.count()).select_from(Stage).where(Stage.chapter_id == chapter.id)
    )
    if stages:
        raise ConflictError(ErrorCode.CHAPTER_HAS_STAGES, stageCount=stages)

    await db.delete(chapter)
    await db.commit()


# --------------------------------------------------------------------------
# Màn chơi
# --------------------------------------------------------------------------


@router.post(
    "/chapters/{chapter_id}/stages",
    response_model=StageOut,
    status_code=status.HTTP_201_CREATED,
    summary="Thêm màn chơi",
)
async def create_stage(
    chapter_id: uuid.UUID, payload: StageCreate, db: DbDep
) -> StageOut:
    chapter = await service.get_chapter(db, chapter_id)

    if payload.max_players < payload.min_players:
        raise ValidationFailedError(ErrorCode.VALIDATION_FAILED, field="max_players")

    taken = await db.scalar(
        select(Stage).where(
            Stage.chapter_id == chapter.id, Stage.order_index == payload.order_index
        )
    )
    if taken is not None:
        raise ConflictError(ErrorCode.CONFLICT, field="order_index")

    stage = Stage(chapter_id=chapter.id, status=PublishStatus.DRAFT, **payload.model_dump())
    db.add(stage)
    await db.commit()
    await db.refresh(stage)

    world = await service.world_of_stage(db, stage)
    return await _stage_out(db, stage, world)


@router.get(
    "/stages/{stage_id}",
    response_model=StageOut,
    summary="Chi tiết màn kèm nhiệm vụ và lý do chưa xuất bản được",
)
async def get_stage(stage_id: uuid.UUID, current: CurrentUserDep, db: DbDep) -> StageOut:
    stage = await service.get_stage(db, current, stage_id)
    world = await service.world_of_stage(db, stage)
    return await _stage_out(db, stage, world)


@router.patch("/stages/{stage_id}", response_model=StageOut, summary="Sửa màn chơi")
async def update_stage(
    stage_id: uuid.UUID, payload: StageUpdate, current: CurrentUserDep, db: DbDep
) -> StageOut:
    stage = await service.get_stage(db, current, stage_id)
    world = await service.world_of_stage(db, stage)

    # Xuất bản đi qua endpoint riêng, không qua PATCH: đó là một hành động có
    # điều kiện, không phải một trường dữ liệu.
    if payload.status == PublishStatus.PUBLISHED and stage.status != PublishStatus.PUBLISHED:
        raise ValidationFailedError(ErrorCode.VALIDATION_FAILED, field="status")

    _apply(
        stage,
        payload,
        (
            "name_i18n",
            "synopsis_i18n",
            "order_index",
            "scene_key",
            "map_shard_index",
            "time_limit_seconds",
            "initial_team_energy",
            "skill_pts_max",
            "required_skill_pts",
            "star_max",
            "min_players",
            "max_players",
            "advisor_npc_key",
            "background_media_id",
            "advisor_portrait_media_id",
            "cluebook_i18n",
            "status",
        ),
    )

    # Ngưỡng sao đi riêng: nhận vào thì SẮP XẾP và ép về 0..100 rồi mới lưu.
    # Người dựng gõ "70, 40, 90" là chuyện thường, và một danh sách ngưỡng
    # không tăng dần thì mọi phép so sánh về sau đều phải tự đoán ý.
    if payload.star_score_pcts is not None:
        stage.star_score_pcts = sorted({min(100, max(0, int(p))) for p in payload.star_score_pcts})

    if stage.max_players < stage.min_players:
        raise ValidationFailedError(ErrorCode.VALIDATION_FAILED, field="max_players")

    await db.commit()
    await db.refresh(stage)
    return await _stage_out(db, stage, world)


@router.post(
    "/stages/{stage_id}/publish",
    response_model=StageOut,
    summary="Xuất bản màn chơi",
)
async def publish_stage(stage_id: uuid.UUID, current: CurrentUserDep, db: DbDep) -> StageOut:
    """Xuất bản màn — chỉ khi đủ điều kiện.

    Điều kiện kiểm ở service. Nếu chỉ chặn ở giao diện thì gọi thẳng endpoint
    này là lách được, và một màn thiếu câu hỏi chỉ lộ ra khi học sinh đang chơi
    giữa chừng.
    """
    stage = await service.get_stage(db, current, stage_id)
    world = await service.world_of_stage(db, stage)

    blockers = await service.publish_blockers(db, stage, world)
    if blockers:
        raise ValidationFailedError(ErrorCode.VALIDATION_FAILED, blockers=blockers)

    stage.status = PublishStatus.PUBLISHED
    await db.commit()
    await db.refresh(stage)
    return await _stage_out(db, stage, world)


@router.delete(
    "/stages/{stage_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Xoá màn chơi",
)
async def delete_stage(stage_id: uuid.UUID, current: CurrentUserDep, db: DbDep) -> None:
    """Xoá màn — chỉ khi CHƯA CÓ AI CHƠI.

    `stage_runs` là CASCADE, nên xoá một màn đã có người chơi sẽ xoá luôn lượt
    chơi, bài làm, và điểm chiến lực đã ghi. Không có đường hoàn tác. Lượt chơi
    thử của giáo viên cũng tính — muốn xoá thì dọn tiến độ chơi thử trước.

    Nhiệm vụ bên trong thì xoá theo, đó là chủ ý: chúng không có ý nghĩa gì
    ngoài màn chơi chứa chúng.
    """
    stage = await service.get_stage(db, current, stage_id)

    runs = await db.scalar(
        select(func.count()).select_from(StageRun).where(StageRun.stage_id == stage.id)
    )
    if runs:
        raise ConflictError(ErrorCode.STAGE_HAS_RUNS, runCount=runs)

    await db.delete(stage)
    await db.commit()


# --------------------------------------------------------------------------
# Nhiệm vụ — gán câu hỏi vào vật thể trong cảnh
# --------------------------------------------------------------------------


async def _check_question(db: DbDep, question_id: uuid.UUID) -> Question:
    question = await db.scalar(
        select(Question).where(Question.id == question_id, Question.deleted_at.is_(None))
    )
    if question is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="question")
    return question


async def _append_questions(
    db: DbDep, quest: Quest, question_ids: list[uuid.UUID], points: int
) -> None:
    """Lắp thêm câu hỏi vào cuối nhiệm vụ, bỏ qua câu đã có.

    Bỏ qua thay vì báo lỗi: giáo viên tích nhiều ô rồi bấm Thêm, trong đó có câu
    đã lắp từ trước — bắt cả thao tác thất bại vì một ô thừa là phiền vô ích.
    """
    existing = set(
        await db.scalars(
            select(QuestQuestion.question_id).where(QuestQuestion.quest_id == quest.id)
        )
    )
    next_order = (
        await db.scalar(
            select(func.coalesce(func.max(QuestQuestion.order_index), 0)).where(
                QuestQuestion.quest_id == quest.id
            )
        )
        or 0
    )

    for question_id in question_ids:
        if question_id in existing:
            continue
        await _check_question(db, question_id)
        next_order += 1
        db.add(
            QuestQuestion(
                quest_id=quest.id,
                question_id=question_id,
                order_index=next_order,
                points=points,
            )
        )
        existing.add(question_id)


@router.post(
    "/stages/{stage_id}/quests",
    response_model=QuestOut,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo nhiệm vụ mới cho một vật thể trong cảnh",
)
async def create_quest(
    stage_id: uuid.UUID, payload: QuestCreate, current: CurrentUserDep, db: DbDep
) -> QuestOut:
    stage = await service.get_stage(db, current, stage_id)

    quest = Quest(
        stage_id=stage.id,
        order_index=payload.order_index,
        quest_object_key=payload.quest_object_key,
        name_i18n=payload.name_i18n,
        phase=payload.phase,
        scene_x=payload.scene_x,
        scene_y=payload.scene_y,
        trigger_radius=payload.trigger_radius,
        icon_media_id=payload.icon_media_id,
        icon_size=payload.icon_size,
        pulse_percent=payload.pulse_percent,
        pulse_period_ms=payload.pulse_period_ms,
        energy_cost=payload.energy_cost,
        pass_score=payload.pass_score,
    )
    db.add(quest)
    try:
        await db.flush()
        if payload.question_ids:
            await _append_questions(db, quest, payload.question_ids, DEFAULT_QUESTION_POINTS)
        await db.commit()
    except (NotFoundError, ValidationFailedError):
        await db.rollback()
        raise
    except Exception as exc:  # UNIQUE(stage, order) hoặc UNIQUE(stage, object)
        await db.rollback()
        raise ConflictError(ErrorCode.CONFLICT, field="order_index|quest_object_key") from exc

    await db.refresh(quest)
    return await _one_quest_out(db, quest)


@router.patch("/quests/{quest_id}", response_model=QuestOut, summary="Sửa nhiệm vụ")
async def update_quest(quest_id: uuid.UUID, payload: QuestUpdate, db: DbDep) -> QuestOut:
    quest = await service.get_quest(db, quest_id)

    _apply(
        quest,
        payload,
        (
            "order_index",
            "quest_object_key",
            "name_i18n",
            "phase",
            "scene_x",
            "scene_y",
            "trigger_radius",
            "icon_media_id",
            "icon_size",
            "pulse_percent",
            "pulse_period_ms",
            "energy_cost",
            "pass_score",
        ),
    )
    # `pass_score = None` trong PATCH nghĩa là "không gửi". Muốn xoá về mặc định
    # thì phải nói rõ bằng cờ riêng.
    if payload.clear_pass_score:
        quest.pass_score = None

    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise ConflictError(ErrorCode.CONFLICT, field="order_index|quest_object_key") from exc

    await db.refresh(quest)
    return await _one_quest_out(db, quest)


@router.delete(
    "/quests/{quest_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Gỡ nhiệm vụ khỏi màn",
)
async def delete_quest(quest_id: uuid.UUID, db: DbDep) -> None:
    quest = await service.get_quest(db, quest_id)
    await db.delete(quest)
    await db.commit()


# --------------------------------------------------------------------------
# Câu hỏi bên trong một nhiệm vụ
# --------------------------------------------------------------------------


@router.post(
    "/quests/{quest_id}/questions",
    response_model=QuestOut,
    status_code=status.HTTP_201_CREATED,
    summary="Lắp thêm câu hỏi vào nhiệm vụ",
)
async def add_quest_questions(
    quest_id: uuid.UUID, payload: QuestQuestionAdd, db: DbDep
) -> QuestOut:
    quest = await service.get_quest(db, quest_id)
    await _append_questions(db, quest, payload.question_ids, payload.points)
    await db.commit()
    return await _one_quest_out(db, quest)


@router.patch(
    "/quest-questions/{link_id}",
    response_model=QuestOut,
    summary="Sửa điểm hoặc thứ tự của một câu hỏi trong nhiệm vụ",
)
async def update_quest_question(
    link_id: uuid.UUID, payload: QuestQuestionUpdate, db: DbDep
) -> QuestOut:
    link = await db.scalar(select(QuestQuestion).where(QuestQuestion.id == link_id))
    if link is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="quest_question")

    _apply(link, payload, ("points", "order_index"))
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise ConflictError(ErrorCode.CONFLICT, field="order_index") from exc

    quest = await service.get_quest(db, link.quest_id)
    return await _one_quest_out(db, quest)


@router.delete(
    "/quest-questions/{link_id}",
    response_model=QuestOut,
    summary="Bỏ một câu hỏi khỏi nhiệm vụ",
)
async def remove_quest_question(link_id: uuid.UUID, db: DbDep) -> QuestOut:
    """Gỡ câu hỏi khỏi nhiệm vụ. KHÔNG xoá câu hỏi khỏi kho."""
    link = await db.scalar(select(QuestQuestion).where(QuestQuestion.id == link_id))
    if link is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="quest_question")

    quest_id = link.quest_id
    await db.delete(link)
    await db.commit()

    quest = await service.get_quest(db, quest_id)
    return await _one_quest_out(db, quest)

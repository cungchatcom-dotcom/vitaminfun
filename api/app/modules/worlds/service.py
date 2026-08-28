"""Nghiệp vụ cây nội dung game.

Hai thứ quan trọng nhất ở đây:

  1. `visible_worlds()` — chỗ DUY NHẤT lọc nội dung nháp khỏi tầm nhìn học sinh.
  2. `publish_blockers()` — điều kiện xuất bản màn, kiểm ở service chứ không ở
     giao diện. Đặt ở giao diện thì gọi thẳng API là lách được.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ErrorCode, NotFoundError
from app.db.models import (
    Chapter,
    PublishStatus,
    Quest,
    QuestQuestion,
    Question,
    QuestionStatus,
    Stage,
    User,
    UserRole,
    World,
)
from app.modules.worlds.balance import read_balance, required_skill_pts

# --------------------------------------------------------------------------
# Tầm nhìn theo vai trò
# --------------------------------------------------------------------------


def can_see_draft(user: User) -> bool:
    """Giáo viên và admin thấy nội dung nháp; học sinh thì không."""
    return user.role in UserRole.CAN_PREVIEW


def visible_worlds(user: User) -> Select[Any]:
    """Truy vấn gốc cho MỌI đường đọc world.

    Đây là chỗ duy nhất được phép quyết định ai thấy `draft`. Viết điều kiện này
    rải rác ở từng endpoint là cách chắc chắn nhất để có ngày một endpoint quên
    nó và lộ world nháp cho học sinh.
    """
    query = select(World)
    if not can_see_draft(user):
        query = query.where(World.status == PublishStatus.PUBLISHED)
    return query


def visible_stages(user: User) -> Select[Any]:
    """Như trên, cho màn chơi."""
    query = select(Stage)
    if not can_see_draft(user):
        query = query.where(Stage.status == PublishStatus.PUBLISHED)
    return query


# --------------------------------------------------------------------------
# Đọc
# --------------------------------------------------------------------------


async def get_world(db: AsyncSession, user: User, world_id: uuid.UUID) -> World:
    world = await db.scalar(visible_worlds(user).where(World.id == world_id))
    if world is None:
        # 404 chứ không 403: học sinh không cần biết có tồn tại một world nháp.
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="world")
    return world


async def get_stage(db: AsyncSession, user: User, stage_id: uuid.UUID) -> Stage:
    stage = await db.scalar(visible_stages(user).where(Stage.id == stage_id))
    if stage is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="stage")
    return stage


async def get_chapter(db: AsyncSession, chapter_id: uuid.UUID) -> Chapter:
    chapter = await db.scalar(select(Chapter).where(Chapter.id == chapter_id))
    if chapter is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="chapter")
    return chapter


async def get_quest(db: AsyncSession, quest_id: uuid.UUID) -> Quest:
    quest = await db.scalar(select(Quest).where(Quest.id == quest_id))
    if quest is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="quest")
    return quest


async def world_of_stage(db: AsyncSession, stage: Stage) -> World:
    world = await db.scalar(
        select(World).join(Chapter, Chapter.world_id == World.id).where(Chapter.id == stage.chapter_id)
    )
    if world is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="world")
    return world


async def stage_counts(db: AsyncSession, world_id: uuid.UUID) -> tuple[int, int, int]:
    """(số chương, số màn, số màn đã xuất bản) của một world."""
    chapters = (
        await db.scalar(select(func.count()).select_from(Chapter).where(Chapter.world_id == world_id))
        or 0
    )
    base = select(func.count()).select_from(Stage).join(Chapter, Chapter.id == Stage.chapter_id)
    stages = await db.scalar(base.where(Chapter.world_id == world_id)) or 0
    published = (
        await db.scalar(
            base.where(Chapter.world_id == world_id, Stage.status == PublishStatus.PUBLISHED)
        )
        or 0
    )
    return chapters, stages, published


async def quest_count(db: AsyncSession, stage_id: uuid.UUID) -> int:
    return (
        await db.scalar(select(func.count()).select_from(Quest).where(Quest.stage_id == stage_id))
        or 0
    )


async def quest_total_points(db: AsyncSession, quest_id: uuid.UUID) -> int:
    """Tổng điểm mọi câu hỏi trong một nhiệm vụ."""
    return (
        await db.scalar(
            select(func.coalesce(func.sum(QuestQuestion.points), 0)).where(
                QuestQuestion.quest_id == quest_id
            )
        )
        or 0
    )


def effective_pass_score(pass_score: int | None, total_points: int) -> int:
    """Điểm tối thiểu để hoàn thành nhiệm vụ.

    `None` = phải đúng hết, tức bằng tổng điểm. Mặc định như vậy chứ không phải
    một tỉ lệ nào đó: giáo viên nào muốn dễ hơn thì hạ xuống một cách có ý thức.
    """
    return total_points if pass_score is None else pass_score


def effective_required_skill_pts(stage: Stage, world: World) -> int:
    balance = read_balance(world.balance_json)
    return required_skill_pts(balance, stage.order_index, stage.required_skill_pts)


# --------------------------------------------------------------------------
# Điều kiện xuất bản màn
# --------------------------------------------------------------------------

#: Số nhiệm vụ tối thiểu mỗi màn. Luật của tài liệu thiết kế Atlantis.
MIN_QUESTS_PER_STAGE = 4


class StageBlocker:
    """Mã lý do khiến màn chưa xuất bản được. Giao diện tra bản dịch theo mã."""

    TOO_FEW_QUESTS = "STAGE_TOO_FEW_QUESTS"
    #: Nhiệm vụ rỗng — không có câu hỏi nào để làm.
    QUEST_EMPTY = "STAGE_QUEST_EMPTY"
    QUEST_QUESTION_DRAFT = "STAGE_QUEST_QUESTION_DRAFT"
    #: `pass_score` lớn hơn tổng điểm mọi câu trong nhiệm vụ — không ai qua nổi.
    QUEST_PASS_SCORE_TOO_HIGH = "STAGE_QUEST_PASS_SCORE_TOO_HIGH"
    NO_ADVISOR = "STAGE_NO_ADVISOR"
    SHARD_INDEX_TAKEN = "STAGE_SHARD_INDEX_TAKEN"


async def publish_blockers(db: AsyncSession, stage: Stage, world: World) -> list[dict[str, Any]]:
    """Vì sao màn này chưa xuất bản được. Rỗng = đủ điều kiện.

    Cố ý KHÔNG còn kiểm "có đúng một nhiệm vụ trao mảnh bản đồ": mảnh thuộc về
    MÀN, trao khi hoàn thành tất cả nhiệm vụ, và số hiệu đã nằm ở
    `stages.map_shard_index`. Xem docs/GAME_DOMAIN.md §1.5c.

    Kiểm ở đây chứ không ở giao diện: đặt ở giao diện thì gọi thẳng API là lách
    được, và một màn thiếu câu hỏi chỉ lộ ra khi có học sinh đang chơi giữa chừng.
    """
    blockers: list[dict[str, Any]] = []

    quests = list(
        await db.scalars(select(Quest).where(Quest.stage_id == stage.id).order_by(Quest.order_index))
    )

    if len(quests) < MIN_QUESTS_PER_STAGE:
        blockers.append(
            {
                "code": StageBlocker.TOO_FEW_QUESTS,
                "params": {"required": MIN_QUESTS_PER_STAGE, "actual": len(quests)},
            }
        )

    # Nạp toàn bộ câu hỏi của mọi nhiệm vụ trong một lượt, tránh N+1 truy vấn.
    links = list(
        await db.scalars(
            select(QuestQuestion)
            .where(QuestQuestion.quest_id.in_([q.id for q in quests]))
            .order_by(QuestQuestion.order_index)
        )
        if quests
        else []
    )
    by_quest: dict[uuid.UUID, list[QuestQuestion]] = {}
    for link in links:
        by_quest.setdefault(link.quest_id, []).append(link)

    question_rows = {}
    if links:
        rows = await db.execute(
            select(Question.id, Question.status, Question.deleted_at).where(
                Question.id.in_([link.question_id for link in links])
            )
        )
        question_rows = {r.id: r for r in rows}

    for quest in quests:
        items = by_quest.get(quest.id, [])

        if not items:
            blockers.append(
                {
                    "code": StageBlocker.QUEST_EMPTY,
                    "params": {
                        "questOrder": quest.order_index,
                        "questObject": quest.quest_object_key,
                    },
                }
            )
            continue

        # Mọi câu hỏi phải ĐÃ XUẤT BẢN và chưa bị xoá mềm.
        for link in items:
            row = question_rows.get(link.question_id)
            if row is None or row.deleted_at is not None or row.status != QuestionStatus.PUBLISHED:
                blockers.append(
                    {
                        "code": StageBlocker.QUEST_QUESTION_DRAFT,
                        "params": {
                            "questOrder": quest.order_index,
                            "questObject": quest.quest_object_key,
                        },
                    }
                )
                break

        total = sum(link.points for link in items)
        if quest.pass_score is not None and quest.pass_score > total:
            blockers.append(
                {
                    "code": StageBlocker.QUEST_PASS_SCORE_TOO_HIGH,
                    "params": {
                        "questOrder": quest.order_index,
                        "questObject": quest.quest_object_key,
                        "passScore": quest.pass_score,
                        "totalPoints": total,
                    },
                }
            )

    # NPC cố vấn phải có ít nhất một bước hội thoại — nếu màn có khai báo NPC.
    if stage.advisor_npc_key and not any(q.phase == "advisor" for q in quests):
        blockers.append(
            {"code": StageBlocker.NO_ADVISOR, "params": {"npc": stage.advisor_npc_key}}
        )

    # Hai màn cùng world không được trao cùng một số mảnh bản đồ: luật "đủ 30
    # mảnh KHÁC NHAU" sẽ vô nghĩa nếu màn 5 và màn 9 cùng trao mảnh #5.
    taken = await db.scalar(
        select(func.count())
        .select_from(Stage)
        .join(Chapter, Chapter.id == Stage.chapter_id)
        .where(
            Chapter.world_id == world.id,
            Stage.map_shard_index == stage.map_shard_index,
            Stage.id != stage.id,
        )
    )
    if taken:
        blockers.append(
            {
                "code": StageBlocker.SHARD_INDEX_TAKEN,
                "params": {"shardIndex": stage.map_shard_index},
            }
        )

    return blockers

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
    QUEST_OBJECT_NPC,
    Chapter,
    MediaAsset,
    PublishStatus,
    Quest,
    QuestPhase,
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
#:
#: Nhiệm vụ NPC ĐƯỢC TÍNH vào con số này. Nó là một nhiệm vụ thật — có câu hỏi,
#: có điểm qua ải, học sinh phải làm xong mới đi tiếp — chứ không phải một bước
#: thủ tục, nên đếm nó ra ngoài là tự bịa thêm một khái niệm thứ hai.
MIN_QUESTS_PER_STAGE = 4

#: Thứ tự của nhiệm vụ NPC. Số 0 để nó luôn đứng đầu danh sách, và để `max()+1`
#: của các nhiệm vụ do giáo viên thêm không bao giờ đụng vào nó.
ADVISOR_ORDER_INDEX = 0

#: Giá trị điền vào `stages.scene_key` khi người tạo màn không nói gì.
#:
#: ⚠️ Cột này hiện KHÔNG ĐIỀU KHIỂN GÌ CẢ. Nó có từ thời mỗi màn là một lớp cảnh
#: Phaser viết tay riêng và khoá này chọn lớp nào; giờ cả trò chơi chạy trên MỘT
#: lớp cảnh dựng hoàn toàn từ dữ liệu — ảnh nền lấy từ `background_media_id`,
#: vật thể lấy từ bảng `quests`.
#:
#: Vì không ai đọc nó, một màn từng bị gõ nhầm thành `ship_desk_01` (desk, chứ
#: không phải deck) mà không ai phát hiện ra. Nên nó thôi là ô bắt buộc: bắt
#: người dựng gõ một chuỗi kỹ thuật vô nghĩa mới tạo được màn chơi là thu phí mà
#: không bán gì.
#:
#: Cột vẫn giữ, không xoá: nếu sau này có loại cảnh thứ hai (bản đồ nhìn từ trên
#: xuống, màn chỉ hội thoại...) thì đây đúng là chỗ đánh dấu, và thêm lại một cột
#: đã xoá đắt hơn nhiều so với để nó nằm im.
DEFAULT_SCENE_KEY = "default"

#: Chiều cao nhân vật khi chưa ai đặt gì, theo hệ toạ độ thế giới 3200×1800.
#:
#: Phải khớp `HERO_HEIGHT` trong `web/src/game/scenes/StageScene.ts` — đó là
#: đường lùi cuối cùng của cảnh khi đề bài đóng băng cũ chưa có trường này.
DEFAULT_CHARACTER_HEIGHT = 160


def new_advisor_quest(stage_id: uuid.UUID) -> Quest:
    """Nhiệm vụ NPC bắt buộc của một màn chơi.

    Mọi màn đều có đúng một cái, tạo tự động cùng lúc với màn — giáo viên không
    bấm gì cả. Nó vừa là cổng mở khoá các nhiệm vụ còn lại, vừa là cái bảo đảm
    luật "mỗi thành viên phải hoàn thành ít nhất một nhiệm vụ thì cả đội mới
    được chia mảnh bản đồ": ai cũng phải qua NPC nên ai cũng có ít nhất một.

    `name_i18n` để RỖNG có chủ ý. Đặt sẵn chữ tiếng Việt ở đây là chôn phần
    hiển thị vào database, mà database thì không dịch được sang ngôn ngữ khác.
    Giao diện tự lùi về nhãn dịch của nó; giáo viên đặt tên riêng thì tên đó
    thắng.
    """
    return Quest(
        stage_id=stage_id,
        order_index=ADVISOR_ORDER_INDEX,
        phase=QuestPhase.ADVISOR,
        quest_object_key=QUEST_OBJECT_NPC,
        name_i18n={},
        energy_cost=0,
    )


class StageBlocker:
    """Mã lý do khiến màn chưa xuất bản được. Giao diện tra bản dịch theo mã."""

    TOO_FEW_QUESTS = "STAGE_TOO_FEW_QUESTS"
    #: Nhiệm vụ rỗng — không có câu hỏi nào để làm.
    QUEST_EMPTY = "STAGE_QUEST_EMPTY"
    QUEST_QUESTION_DRAFT = "STAGE_QUEST_QUESTION_DRAFT"
    #: `pass_score` lớn hơn tổng điểm mọi câu trong nhiệm vụ — không ai qua nổi.
    QUEST_PASS_SCORE_TOO_HIGH = "STAGE_QUEST_PASS_SCORE_TOO_HIGH"
    #: Không có nhiệm vụ NPC. Về nguyên tắc không xảy ra — nó được tạo cùng màn
    #: và không xoá được — nhưng vẫn kiểm, vì đây là điều kiện mà cả cổng mở
    #: khoá lẫn luật chia mảnh bản đồ dựa vào.
    NO_ADVISOR = "STAGE_NO_ADVISOR"
    SHARD_INDEX_TAKEN = "STAGE_SHARD_INDEX_TAKEN"


async def effective_character_height(db: AsyncSession, stage: Stage) -> int:
    """Chiều cao nhân vật THẬT SỰ dùng cho màn này.

    Ba nấc, dừng ở nấc đầu tiên có giá trị:

      1. số của chính màn này,
      2. số của màn ĐẦU TIÊN trong world (chương nhỏ nhất, thứ tự nhỏ nhất),
      3. `DEFAULT_CHARACTER_HEIGHT`.

    Nấc thứ hai là chỗ luật "màn 1 làm mặc định cho cả world" thành mã. Đọc LÚC
    CẦN chứ không sao chép sẵn xuống từng màn: sao chép thì sửa lại màn 1 sau đó
    không lan xuống đâu nữa, mà lan xuống mới là điều người dựng muốn.
    """
    if stage.character_height is not None:
        return stage.character_height

    world_id = await db.scalar(select(Chapter.world_id).where(Chapter.id == stage.chapter_id))
    if world_id is None:
        return DEFAULT_CHARACTER_HEIGHT

    first = await db.scalar(
        select(Stage.character_height)
        .join(Chapter, Chapter.id == Stage.chapter_id)
        .where(Chapter.world_id == world_id)
        .order_by(Chapter.order_index, Stage.order_index)
        .limit(1)
    )
    return first or DEFAULT_CHARACTER_HEIGHT


async def effective_dialogue(db: AsyncSession, stage: Stage) -> dict[str, Any]:
    """Bố cục màn hội thoại THẬT SỰ dùng cho màn này.

    Hai nấc, dừng ở nấc đầu tiên có giá trị:

      1. bố cục của chính màn này,
      2. bố cục của màn ĐẦU TIÊN trong world (chương nhỏ nhất, thứ tự nhỏ nhất).

    Không có nấc thứ ba: `{}` nghĩa là chưa ai căn gì, và giao diện tự dùng bố
    cục mặc định của nó. Đặt sẵn một bộ toạ độ ở đây là chép cùng một mặc định
    vào hai chỗ, rồi chúng lệch nhau.

    Đọc LÚC CẦN chứ không sao chép xuống từng màn — cùng lý do với
    `effective_character_height`: sao chép thì sửa lại màn 1 sau đó không lan
    xuống đâu nữa, mà lan xuống mới là điều người dựng muốn.
    """
    if stage.dialogue_json:
        return stage.dialogue_json

    world_id = await db.scalar(select(Chapter.world_id).where(Chapter.id == stage.chapter_id))
    if world_id is None:
        return {}

    first = await db.scalar(
        select(Stage.dialogue_json)
        .join(Chapter, Chapter.id == Stage.chapter_id)
        .where(Chapter.world_id == world_id)
        .order_by(Chapter.order_index, Stage.order_index)
        .limit(1)
    )
    return first or {}


async def block_urls(db: AsyncSession, layout: dict[str, Any]) -> dict[str, str]:
    """URL anh nen cua tung khoi, tra MOT luot.

    Khoi luu `media_id` chu khong luu URL: URL la thu doi khi kho anh doi, con
    id thi khong. Nhung ca trinh thiet ke lan man choi deu can URL de ve, nen
    doi o day - mot lan, ngay truoc khi gui di.

    Tra ca loat vi mot bo cuc co sau khoi: hoi tung cai la sau luot di ve cho
    mot man hinh.

    Tra ve theo KHOA KHOI chu khong theo id anh: cho goi dang cam mot khoi va
    can dung URL cua no, khong phai mot bang tra id.
    """
    ids = {
        block["media_id"]
        for block in layout.values()
        if isinstance(block, dict) and block.get("media_id")
    }
    if not ids:
        return {}

    found = {
        str(row.id): row.url
        for row in await db.execute(
            select(MediaAsset.id, MediaAsset.url).where(MediaAsset.id.in_(ids))
        )
    }
    return {
        key: found[str(block["media_id"])]
        for key, block in layout.items()
        if isinstance(block, dict) and str(block.get("media_id")) in found
    }


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

    # Nhiệm vụ NPC là BẮT BUỘC, không còn phụ thuộc việc màn có khai báo
    # `advisor_npc_key` hay không. Trước đây nó chỉ bị đòi khi giáo viên đã gõ
    # tên NPC vào ô cấu hình — tức là quên gõ thì xuất bản được một màn không có
    # cổng vào, và khi đó không người chơi nào chắc chắn hoàn thành nổi một
    # nhiệm vụ để cả đội được chia mảnh bản đồ.
    if not any(q.phase == QuestPhase.ADVISOR for q in quests):
        blockers.append(
            {"code": StageBlocker.NO_ADVISOR, "params": {"npc": stage.advisor_npc_key or ""}}
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

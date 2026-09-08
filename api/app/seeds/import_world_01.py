"""Nhập nội dung Chương 1 của world Lost in Atlantis từ `public/data/stages/world_01/`.

Chạy: `python -m app.seeds.import_world_01`

LUẬT: giống mọi seed khác, script này phải IDEMPOTENT — chạy mười lần cho kết
quả giống hệt chạy một lần. Nên nó KHÔNG xoá rồi tạo lại, mà tìm bản đang có
theo khoá bền vững rồi ghi đè nội dung lên đúng bản đó:

    màn chơi   ← (chapter_id, order_index)
    nhiệm vụ   ← (stage_id, quest_object_key)
    câu hỏi    ← vị trí trong `quest_questions` của chính nhiệm vụ đó

Dùng lại đúng hàng `questions` cũ chứ không tạo hàng mới, vì `stage_answers`
tham chiếu tới câu hỏi bằng RESTRICT: tạo mới rồi bỏ hàng cũ thì hoặc xoá không
được, hoặc kho câu hỏi phình thêm một bộ rác sau mỗi lần chạy.

MÀN 1 ĐÃ CÓ SẴN và được dựng bằng tay trên giao diện — có ảnh nền, ảnh vật thể,
toạ độ, chiều cao nhân vật. Script chỉ ghi đè PHẦN NHIỆM VỤ của nó (tên, câu
hỏi, điểm qua ải) và sổ tay; các cột còn lại của màn 1 giữ nguyên. Ghi đè cả
những cột kia là xoá công dựng cảnh của người ta bằng dữ liệu mẫu.
"""

from __future__ import annotations

import asyncio
import json
import re
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import configure_logging, logger
from app.db.models import (
    DEFAULT_QUESTION_POINTS,
    QUEST_OBJECT_NPC,
    Chapter,
    PublishStatus,
    Quest,
    QuestPhase,
    QuestQuestion,
    Question,
    QuestionStatus,
    QuestionType,
    Stage,
    User,
    World,
)
from app.db.session import SessionFactory, dispose_engine
from app.modules.worlds.service import DEFAULT_SCENE_KEY

WORLD_EN = "Lost in Atlantis"
CHAPTER_ORDER = 1

#: Thư mục dữ liệu, suy ra từ vị trí file này chứ không viết cứng đường dẫn
#: tuyệt đối: api/app/seeds/x.py → lên ba bậc là gốc kho.
DATA_DIR = Path(__file__).resolve().parents[3] / "public" / "data" / "stages" / "world_01"

#: Hệ toạ độ thế giới của cảnh Phaser. Phải khớp `web/src/game/world.ts`.
WORLD_WIDTH = 3200
WORLD_HEIGHT = 1800

#: Khoá vật thể của màn 1 — GHIM theo đúng khoá đang có trong database.
#:
#: Không sinh khoá từ tên nhiệm vụ như các màn khác: màn 1 đã có `mast`, `hull`,
#: `chest` kèm ảnh và toạ độ do người dựng đặt. Sinh ra `main-mast` thì không
#: khớp cái nào, và màn 1 sẽ có bảy nhiệm vụ thay vì bốn.
STAGE_01_KEYS = {1: "mast", 2: "hull", 3: "buoy", 4: "chest"}

#: Năng lượng cấp cho mỗi người sau khi qua NPC, dùng cho màn TẠO MỚI.
#:
#: Lấy từ `initialEnergy` của file JSON. File nào thiếu thì để `None` và cột
#: giữ mặc định của model — chứ không viết một con số thứ hai ở đây, vì cân bằng
#: game có đúng một chỗ giữ (xem `modules/worlds/balance.py`).
ENERGY_KEY = "initialEnergy"


# --------------------------------------------------------------------------
# Tiện ích
# --------------------------------------------------------------------------


def slugify(text: str) -> str:
    """"Ancient Poem Wall" → "ancient-poem-wall". Dùng làm `quest_object_key`."""
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return s[:64] or "quest"


def english_name(name: str) -> tuple[str, str]:
    """Tách "Coralia (Tinh linh bóng khí)" thành ("Coralia", tên đầy đủ).

    Phần trong ngoặc là chú thích tiếng Việt của người soạn, không phải một phần
    của tên tiếng Anh. Nhét cả cụm vào khoá `en` là dựng sẵn một chỗ hiện tiếng
    Việt cho người đọc tiếng Anh.
    """
    m = re.match(r"^(.*?)\s*\(([^)]*)\)\s*$", name or "")
    return (m.group(1).strip(), name.strip()) if m else ((name or "").strip(), (name or "").strip())


def to_world_xy(point: dict[str, Any], map_size: dict[str, Any]) -> tuple[int, int] | tuple[None, None]:
    """Đổi toạ độ trong file JSON sang hệ toạ độ thế giới 3200×1800.

    Toạ độ trong file lấy TÂM màn làm gốc (x chạy từ âm sang dương), còn cảnh
    Phaser lấy góc trên trái. Không đổi thì mọi vật thể dồn hết về một góc.
    """
    if not point or "x" not in point or "y" not in point:
        return (None, None)
    w = float((map_size or {}).get("width") or WORLD_WIDTH)
    h = float((map_size or {}).get("height") or WORLD_HEIGHT)
    x = round((float(point["x"]) + w / 2) * WORLD_WIDTH / w)
    y = round((float(point["y"]) + h / 2) * WORLD_HEIGHT / h)
    # Kẹp vào trong khung: vài toạ độ trong file nằm ngoài mép, mà vật thể rơi
    # ra ngoài cảnh thì người chơi không bao giờ đi tới được.
    return (max(0, min(WORLD_WIDTH, x)), max(0, min(WORLD_HEIGHT, y)))


async def free_shard_index(db: AsyncSession, world_id: uuid.UUID, stage: Stage, wanted: int) -> int:
    """Số mảnh bản đồ mong muốn, hoặc số trống nhỏ nhất nếu nó đã có chủ.

    Hai màn cùng world trao trùng số mảnh thì màn nào cũng không xuất bản được
    (`STAGE_SHARD_INDEX_TAKEN`). Thà lệch số còn hơn nhập vào một màn chết.

    Không cướp số của màn đang giữ, kể cả khi màn đó chỉ là dữ liệu mẫu: đây là
    script nhập chương 1, không phải chỗ sắp xếp lại cả world.
    """
    taken = set(
        await db.scalars(
            select(Stage.map_shard_index)
            .join(Chapter, Chapter.id == Stage.chapter_id)
            .where(Chapter.world_id == world_id, Stage.id != stage.id)
        )
    )
    if wanted not in taken:
        return wanted

    n = 1
    while n in taken:
        n += 1
    logger.warning("import_shard_taken", stage=stage.order_index, wanted=wanted, used=n)
    return n


def merged(existing: dict[str, str] | None, **new: str) -> dict[str, str]:
    """Ghi đè các khoá mới, GIỮ những ngôn ngữ đang có mà mình không đụng tới."""
    out = dict(existing or {})
    out.update({k: v for k, v in new.items() if v})
    return out


# --------------------------------------------------------------------------
# Câu hỏi
# --------------------------------------------------------------------------


def build_question(q: dict[str, Any]) -> tuple[str, dict, dict]:
    """Một câu trong file JSON → (dạng, `content_json`, `answer_json`).

    `hint` và `text_translation` đi vào ANSWER chứ không vào CONTENT, có chủ ý:
    content được đóng băng vào `snapshot_json` rồi gửi thẳng xuống máy học sinh,
    còn answer thì không rời server khi đang chơi. Cả hai thứ đó đều phải TRẢ
    BẰNG NĂNG LƯỢNG mới được xem — gửi kèm đề bài là phát không, và học sinh chỉ
    cần mở tab mạng của trình duyệt là thấy.

    `wrong_answer_message` thì NGƯỢC LẠI — nó vào content. Nó không tiết lộ gì
    ("trả lời chưa đúng, thử lại đi"), và giao diện phải hiện được nó ngay khi
    chấm xong mà không phải hỏi server thêm một vòng nữa.
    """
    secret = {k: v for k, v in (("hint", q.get("hint")),
                                ("translation", q.get("text_translation"))) if v}
    feedback = {"wrong_answer_message": q["wrong_answer_message"]} if q.get(
        "wrong_answer_message"
    ) else {}

    if q["answer_type"] == "select":
        options = [{"id": o["key"], "text": o["text"]} for o in q["options"]]
        correct = next(o["key"] for o in q["options"] if o.get("isCorrect"))
        return (
            QuestionType.MCQ_SINGLE,
            {"prompt": q["question_text"], "options": options, **feedback},
            {"correctOptionId": correct, **secret},
        )

    if q["answer_type"] == "text":
        accepted = [str(a) for a in q["options"] if str(a).strip()]
        return (
            QuestionType.SHORT_ANSWER,
            {"prompt": q["question_text"], **feedback},
            {"accepted": accepted, **secret},
        )

    raise ValueError("khong ho tro answer_type=%r" % q["answer_type"])


async def sync_questions(
    db: AsyncSession,
    quest: Quest,
    raw_questions: list[dict[str, Any]],
    author_id: uuid.UUID | None,
    topic: str,
    tags: list[str],
) -> None:
    """Ghi đè bộ câu hỏi của một nhiệm vụ, dùng lại các hàng `questions` đang có.

    ⚠️ CHỈ dùng lại hàng nào đang được ĐÚNG MỘT nhiệm vụ trỏ tới. Một câu hỏi
    được phép nằm trong nhiều nhiệm vụ (`quest_questions` sinh ra để làm đúng
    việc đó), và ghi đè một hàng dùng chung là sửa đề bài của những nhiệm vụ
    khác — kể cả nhiệm vụ ở màn khác, chương khác. Hàng dùng chung thì để yên,
    nhiệm vụ này lấy một hàng mới của riêng nó.
    """
    links = list(
        await db.scalars(
            select(QuestQuestion)
            .where(QuestQuestion.quest_id == quest.id)
            .order_by(QuestQuestion.order_index)
        )
    )

    for index, raw in enumerate(raw_questions):
        qtype, content, answer = build_question(raw)
        # Bước hội thoại với NPC không mang `score` — nó là cổng vào màn chứ
        # không phải bài lấy điểm, nên rơi về điểm mặc định của kho câu hỏi.
        points = int(raw.get("score") or 0) or DEFAULT_QUESTION_POINTS

        link = links[index] if index < len(links) else None
        row = None
        if link is not None:
            shared = await db.scalar(
                select(func.count())
                .select_from(QuestQuestion)
                .where(QuestQuestion.question_id == link.question_id)
            )
            if shared == 1:
                row = await db.get(Question, link.question_id)

        if row is None:
            row = Question(created_by_user_id=author_id)
            db.add(row)

        row.type = qtype
        row.schema_version = 1
        row.points = points
        row.content_json = content
        row.answer_json = answer
        row.status = QuestionStatus.PUBLISHED
        row.topic = topic
        row.tags = tags
        row.deleted_at = None
        await db.flush()

        if link is None:
            db.add(
                QuestQuestion(
                    quest_id=quest.id, question_id=row.id, order_index=index, points=points
                )
            )
        else:
            # Đổi cả `question_id`: khi hàng cũ là hàng dùng chung, nhiệm vụ này
            # bỏ nó ra và trỏ sang hàng mới vừa tạo.
            link.question_id = row.id
            link.order_index = index
            link.points = points

    # Câu thừa: gỡ khỏi nhiệm vụ nhưng KHÔNG xoá khỏi kho. Có thể chúng là câu
    # do giáo viên tự soạn trên giao diện, và một lần chạy seed không có quyền
    # xoá công của người khác.
    for link in links[len(raw_questions):]:
        await db.delete(link)

    await db.flush()


# --------------------------------------------------------------------------
# Nhiệm vụ và màn chơi
# --------------------------------------------------------------------------


async def sync_quest(
    db: AsyncSession,
    stage: Stage,
    *,
    key: str,
    phase: str,
    order_index: int,
    name_en: str,
    name_vi: str,
    pass_score: int | None,
    scene_xy: tuple[int | None, int | None],
    raw_questions: list[dict[str, Any]],
    author_id: uuid.UUID | None,
    topic: str,
    tags: list[str],
) -> Quest:
    quest = await db.scalar(
        select(Quest).where(Quest.stage_id == stage.id, Quest.quest_object_key == key)
    )
    is_new = quest is None
    if quest is None:
        quest = Quest(stage_id=stage.id, quest_object_key=key, energy_cost=0)
        db.add(quest)

    quest.order_index = order_index
    quest.phase = phase
    # `en` là dữ liệu mới nên ghi đè; `vi` chỉ ĐIỀN VÀO CHỖ TRỐNG. Tên tiếng
    # Việt đang có là do người dựng tự đặt trên giao diện, và file JSON không
    # có bản dịch nào tốt hơn để thay thế nó.
    name = dict(quest.name_i18n or {})
    if name_en:
        name["en"] = name_en
    if name_vi and not name.get("vi"):
        name["vi"] = name_vi
    quest.name_i18n = name
    quest.pass_score = pass_score

    # Toạ độ chỉ đặt cho nhiệm vụ MỚI. Nhiệm vụ đã có là do người dựng kéo thả
    # trên nền ảnh thật của màn; toạ độ trong file JSON dựng theo một khung nền
    # khác, đè lên là vật thể văng ra khỏi chỗ nó phải đứng.
    if is_new and scene_xy[0] is not None:
        quest.scene_x, quest.scene_y = scene_xy

    await db.flush()
    await sync_questions(db, quest, raw_questions, author_id, topic, tags)
    return quest


async def sync_stage(
    db: AsyncSession,
    chapter: Chapter,
    data: dict[str, Any],
    author_id: uuid.UUID | None,
) -> None:
    order = int(data["stageNumber"])
    advisor = data["advisor"]
    scene = data.get("scene") or {}
    map_size = scene.get("mapSize") or {}
    objects = {int(o["taskId"]): o for o in (scene.get("questObjects") or [])}

    stage = await db.scalar(
        select(Stage).where(Stage.chapter_id == chapter.id, Stage.order_index == order)
    )
    is_new = stage is None

    if stage is None:
        stage = Stage(
            chapter_id=chapter.id,
            order_index=order,
            scene_key=DEFAULT_SCENE_KEY,
            map_shard_index=int(data.get("shardRewardId") or order),
        )
        db.add(stage)

    if is_new:
        # Chỉ đặt các cột này khi TẠO MỚI. Màn đã có thì đó là bản người dựng
        # đã chỉnh trên giao diện — xem ghi chú đầu file.
        stage.name_i18n = {"vi": data["title"]}
        stage.synopsis_i18n = {"vi": data.get("story") or ""}
        stage.time_limit_seconds = int(data.get("timeLimitSeconds") or 300)
        if data.get(ENERGY_KEY) is not None:
            stage.energy_per_player = int(data[ENERGY_KEY])
        stage.advisor_npc_key = advisor.get("id")
        stage.status = PublishStatus.PUBLISHED

    # Sổ tay thì ghi đè cho MỌI màn: nó là nội dung NPC trao, tức thuộc phần
    # nhiệm vụ, và hiện màn nào cũng đang để rỗng.
    book = advisor["cluebook"]
    stage.cluebook_title_i18n = merged(stage.cluebook_title_i18n, en=book["title"])
    stage.cluebook_i18n = merged(stage.cluebook_i18n, en=book["content"])

    # Lời NPC trao sổ tay = bước cuối, bước `answer_type: ""`.
    #
    # `text_translation` của bước đó vào thẳng khoá `vi`. Ở mọi câu hỏi khác nó
    # là GỢI Ý phải trả bằng năng lượng mới được xem, nhưng bước này không hỏi
    # gì cả — không có đáp án nào để mà lộ, nên nó đúng là bản dịch tiếng Việt
    # của câu đó, và người chơi tiếng Việt được đọc thẳng.
    outro = next((s for s in advisor["dialogueSteps"] if not s.get("answer_type")), None)
    if outro is not None:
        stage.advisor_outro_i18n = merged(
            stage.advisor_outro_i18n,
            en=outro.get("question_text") or "",
            vi=outro.get("text_translation") or "",
        )
    await db.flush()

    # Đặt lại mỗi lần chạy, không chỉ lúc tạo: gỡ được màn đang chiếm số rồi
    # chạy lại thì chương 1 tự về đúng bộ mảnh 1–6 của nó.
    stage.map_shard_index = await free_shard_index(
        db, chapter.world_id, stage, int(data.get("shardRewardId") or order)
    )
    await db.flush()

    topic = data["title"]
    advisor_en, advisor_full = english_name(advisor.get("name") or "")

    # Đẩy thứ tự của các nhiệm vụ đang có xuống vùng số âm trước khi đánh lại.
    # `UNIQUE(stage_id, order_index)` không phải ràng buộc hoãn được: đổi tại
    # chỗ mà hai nhiệm vụ tạm thời trùng số một nhịp là câu lệnh vỡ ngay.
    for old_quest in await db.scalars(select(Quest).where(Quest.stage_id == stage.id)):
        old_quest.order_index = -abs(old_quest.order_index) - 1
    await db.flush()

    # --- nhiệm vụ NPC -----------------------------------------------------
    # Chỉ lấy các bước CÓ HỎI. Bước cuối `answer_type: ""` là bước trao sổ tay,
    # không phải câu hỏi — nội dung của nó nằm ở `cluebook_i18n`.
    steps = [s for s in advisor["dialogueSteps"] if s.get("answer_type")]
    await sync_quest(
        db,
        stage,
        key=QUEST_OBJECT_NPC,
        phase=QuestPhase.ADVISOR,
        order_index=0,
        name_en=advisor_en,
        name_vi=advisor_full,
        pass_score=None,  # NPC là cổng vào: phải đúng hết mới qua
        scene_xy=to_world_xy(scene.get("advisorSpawn") or {}, map_size),
        raw_questions=steps,
        author_id=author_id,
        topic=topic,
        tags=["atlantis", "advisor"],
    )

    # --- nhiệm vụ chính ---------------------------------------------------
    for position, task in enumerate(data["tasks"], start=1):
        key = STAGE_01_KEYS.get(task["id"]) if order == 1 else slugify(task["title"])
        await sync_quest(
            db,
            stage,
            key=key or slugify(task["title"]),
            phase=QuestPhase.MAIN,
            order_index=position,
            name_en=task["title"],
            name_vi="",
            pass_score=task.get("pass_score"),
            scene_xy=to_world_xy(objects.get(task["id"]) or {}, map_size),
            raw_questions=task["questions"],
            author_id=author_id,
            topic=topic,
            tags=["atlantis", "skill:" + slugify(task.get("skill") or "")],
        )

    # Nhiệm vụ do giáo viên tự thêm trên giao diện (không có trong file) vẫn
    # đang mang số âm. Trả chúng về cuối danh sách chứ không xoá — file dữ liệu
    # mẫu không phải là toàn bộ sự thật về một màn chơi.
    leftovers = list(
        await db.scalars(
            select(Quest)
            .where(Quest.stage_id == stage.id, Quest.order_index < 0)
            .order_by(Quest.order_index.desc())
        )
    )
    for offset, extra in enumerate(leftovers, start=1):
        extra.order_index = len(data["tasks"]) + offset
    await db.flush()

    logger.info(
        "import_stage_done",
        stage=order,
        extra_quests_kept=len(leftovers),
        created=is_new,
        quests=1 + len(data["tasks"]),
        questions=len(steps) + sum(len(t["questions"]) for t in data["tasks"]),
    )


# --------------------------------------------------------------------------


async def import_world_01(db: AsyncSession) -> None:
    world = await db.scalar(select(World).where(World.name_i18n["en"].astext == WORLD_EN))
    if world is None:
        raise SystemExit(
            "Khong tim thay world %r. Chay `python -m app.seeds.seed_all` truoc." % WORLD_EN
        )

    chapter = await db.scalar(
        select(Chapter).where(Chapter.world_id == world.id, Chapter.order_index == CHAPTER_ORDER)
    )
    if chapter is None:
        raise SystemExit("World %r chua co chuong %d." % (WORLD_EN, CHAPTER_ORDER))

    # Ghi tác giả là tài khoản giáo viên mẫu. Không có cũng không sao — cột này
    # nullable, và một bộ dữ liệu mẫu không có chủ vẫn dùng được.
    author = await db.scalar(
        select(User).where(User.email == settings.seed_teacher_email.strip().lower())
    )

    files = sorted(DATA_DIR.glob("stage_*.json"))
    if not files:
        raise SystemExit("Khong co file nao trong %s" % DATA_DIR)

    for path in files:
        data = json.loads(path.read_text(encoding="utf-8"))
        await sync_stage(db, chapter, data, author.id if author else None)

    await db.commit()
    logger.info("import_done", chapter=CHAPTER_ORDER, stages=len(files))


async def main() -> None:
    configure_logging()
    logger.info("import_starting", source=str(DATA_DIR))
    async with SessionFactory() as db:
        await import_world_01(db)
    await dispose_engine()


if __name__ == "__main__":
    asyncio.run(main())

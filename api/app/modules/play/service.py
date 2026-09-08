"""Nghiệp vụ phần chơi: đóng băng đề, chấm bài, kết toán màn.

Đây là chỗ luật chơi thành code. Ba điều chi phối mọi thứ ở đây:

  1. **Chấm điểm chỉ ở server.** Dùng đúng `grade()` mà trình soạn câu hỏi dùng
     ở nút "Thử chấm" — một bản chấm điểm duy nhất cho cả hệ thống.
  2. **Đề đóng băng lúc bắt đầu.** 4 người phải nhìn cùng một bản đề; đọc thẳng
     `questions` thì giữa chừng có người sửa là hai máy hiện hai đề khác nhau.
  3. **Trong trận chỉ nói xong/chưa xong.** Điểm và đáp án ở lại server cho tới
     khi lượt chơi kết thúc (§1.6).
"""

from __future__ import annotations

import random
import string
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, ErrorCode, NotFoundError
from app.db.models import (
    Chapter,
    MapShardOwned,
    MediaAsset,
    PublishStatus,
    Quest,
    QuestAnswer,
    QuestDraft,
    QuestPhase,
    QuestQuestion,
    Question,
    Room,
    RoomMember,
    RunStatus,
    Stage,
    StageProgress,
    StageRun,
    StageRunPlayer,
    User,
    UserRole,
    World,
    WorldProgress,
)
from app.db.models.room import HeroKey, RoomMode, RoomStatus
from app.modules.questions.grading import grade
from app.modules.worlds.balance import attempt_multiplier, read_balance
from app.modules.worlds.service import effective_character_height, effective_pass_score


#: Khoá của bảng đáp án trong `stage_runs.answer_key_json`.
QUESTIONS_KEY = "questions"

#: Khung toạ độ của cảnh chơi. Phải khớp `WORLD` trong `web/src/game/world.ts`.
WORLD_WIDTH = 3200
WORLD_HEIGHT = 1800


class PlayError:
    RUN_NOT_PLAYING = "RUN_NOT_PLAYING"
    QUESTION_LOCKED = "QUESTION_LOCKED"
    #: Chưa qua nhiệm vụ NPC nên các nhiệm vụ còn lại đang khoá.
    ADVISOR_LOCKED = "ADVISOR_LOCKED"
    QUESTION_ALREADY_CORRECT = "QUESTION_ALREADY_CORRECT"
    STAGE_NOT_PLAYABLE = "STAGE_NOT_PLAYABLE"
    #: Chưa đủ điểm chiến lực để mở màn này.
    STAGE_LOCKED = "STAGE_LOCKED"
    RUN_STILL_PLAYING = "RUN_STILL_PLAYING"


# --------------------------------------------------------------------------
# Đóng băng đề bài
# --------------------------------------------------------------------------


async def build_snapshot(db: AsyncSession, stage: Stage) -> tuple[dict[str, Any], dict[str, Any]]:
    """Dựng (đề bài, đáp án) từ trạng thái HIỆN TẠI của màn.

    Trả về hai cục tách rời: cục thứ nhất an toàn gửi xuống mọi máy, cục thứ hai
    ở lại server. Tách ở đây, một lần, thay vì mỗi endpoint tự nhớ che — quên
    che một chỗ là lộ đáp án cả màn.
    """
    quests = list(
        await db.scalars(select(Quest).where(Quest.stage_id == stage.id).order_by(Quest.order_index))
    )
    links = list(
        await db.scalars(
            select(QuestQuestion)
            .where(QuestQuestion.quest_id.in_([q.id for q in quests]))
            .order_by(QuestQuestion.order_index)
        )
        if quests
        else []
    )
    questions = {
        q.id: q
        for q in await db.scalars(
            select(Question).where(Question.id.in_([link.question_id for link in links]))
        )
    } if links else {}

    # Ảnh vật thể: đóng băng URL vào snapshot, không lưu id. Đề đã đóng băng thì
    # ảnh cũng phải đóng băng — đổi ảnh giữa chừng là hai máy hiện hai cảnh khác nhau.
    icon_ids = [q.icon_media_id for q in quests if q.icon_media_id]
    icons: dict[uuid.UUID, str] = {}
    if icon_ids:
        rows = await db.execute(
            select(MediaAsset.id, MediaAsset.url).where(MediaAsset.id.in_(icon_ids))
        )
        icons = {r.id: r.url for r in rows}

    # Tệp NGHE của câu hỏi: đóng băng URL, đúng lý do với ảnh vật thể ngay trên.
    # Một câu nghe mà đề bài chỉ giữ `media_id` thì giáo viên thay file giữa
    # chừng là hai máy trong cùng một đội nghe hai đoạn khác nhau — và câu trả
    # lời của chúng vẫn được chấm bằng cùng một đáp án.
    #
    # Tra theo `media_id`, không theo câu hỏi: nhiều câu dùng chung một đoạn ghi
    # âm là chuyện thường (một bài nghe, năm câu hỏi về nó).
    q_audio_ids = [q.audio_media_id for q in questions.values() if q.audio_media_id]
    q_audio: dict[uuid.UUID, str] = {}
    if q_audio_ids:
        rows = await db.execute(
            select(MediaAsset.id, MediaAsset.url).where(MediaAsset.id.in_(q_audio_ids))
        )
        q_audio = {r.id: r.url for r in rows}

    by_quest: dict[uuid.UUID, list[QuestQuestion]] = {}
    for link in links:
        by_quest.setdefault(link.quest_id, []).append(link)

    snapshot_quests: list[dict[str, Any]] = []
    answer_key: dict[str, Any] = {}

    for quest in quests:
        items = by_quest.get(quest.id, [])
        total = sum(i.points for i in items)

        snapshot_questions = []
        for link in items:
            question = questions.get(link.question_id)
            if question is None:
                continue
            snapshot_questions.append(
                {
                    "id": str(link.question_id),
                    "type": question.type,
                    "content": question.content_json,
                    "points": link.points,
                    "audio_max_plays": question.audio_max_plays,
                    # CÁCH RA ĐỀ đóng băng cùng đề bài: giáo viên đổi một câu từ
                    # đọc sang nghe giữa chừng thì lượt đang chơi vẫn là cái đề
                    # nó bắt đầu — cùng luật với vùng đi được và ảnh nền.
                    "prompt_kind": question.prompt_kind,
                    "show_transcript": question.show_transcript,
                    "audio_url": q_audio.get(question.audio_media_id),
                }
            )
            answer_key[str(link.question_id)] = {
                "type": question.type,
                "content": question.content_json,
                "answer": question.answer_json,
                "points": link.points,
                "explanation": question.explanation,
            }

        snapshot_quests.append(
            {
                "id": str(quest.id),
                "order_index": quest.order_index,
                "phase": quest.phase,
                "quest_object_key": quest.quest_object_key,
                "name_i18n": quest.name_i18n or {},
                "scene_x": quest.scene_x,
                "scene_y": quest.scene_y,
                "trigger_radius": quest.trigger_radius,
                "icon_url": icons.get(quest.icon_media_id),
                "icon_size": quest.icon_size,
                "pulse_percent": quest.pulse_percent,
                "pulse_period_ms": quest.pulse_period_ms,
                "energy_cost": quest.energy_cost,
                "pass_score": effective_pass_score(quest.pass_score, total),
                "questions": snapshot_questions,
            }
        )

    # URL *và* LOẠI của tấm nền trong một câu truy vấn. Loại phải đóng băng
    # cùng URL: giáo viên đổi nền từ video sang ảnh giữa chừng mà đề bài chỉ giữ
    # URL thì máy đang chơi sẽ nạp một file video bằng đường ảnh, và cả màn mất
    # nền.
    outro_audio_url = None
    if stage.advisor_outro_audio_media_id:
        outro_audio_url = await db.scalar(
            select(MediaAsset.url).where(MediaAsset.id == stage.advisor_outro_audio_media_id)
        )

    bg_url = None
    bg_kind = None
    if stage.background_media_id:
        row = (
            await db.execute(
                select(MediaAsset.url, MediaAsset.kind).where(
                    MediaAsset.id == stage.background_media_id
                )
            )
        ).first()
        if row is not None:
            bg_url, bg_kind = row

    # URL của các khối tiếng — MỘT truy vấn cho cả ba, và ba khối rất có thể
    # dùng chung một file.
    audio_urls: dict[str, str] = {}
    audio_ids = {
        track["media_id"]
        for track in (stage.audio_json or {}).values()
        if isinstance(track, dict) and track.get("media_id")
    }
    if audio_ids:
        found = {
            str(row.id): row.url
            for row in await db.execute(
                select(MediaAsset.id, MediaAsset.url).where(MediaAsset.id.in_(audio_ids))
            )
        }
        audio_urls = {
            slot: found[str(track["media_id"])]
            for slot, track in (stage.audio_json or {}).items()
            if isinstance(track, dict) and str(track.get("media_id")) in found
        }

    snapshot = {
        "stage": {
            "id": str(stage.id),
            "name_i18n": stage.name_i18n,
            "synopsis_i18n": stage.synopsis_i18n,
            "scene_key": stage.scene_key,
            # Chiều cao nhân vật ĐÃ GIẢI XONG chuỗi kế thừa, đóng băng vào đề
            # bài như mọi thứ khác: người dựng chỉnh lại giữa chừng thì lượt
            # đang chơi vẫn vẽ nhân vật đúng cỡ nó bắt đầu.
            "character_height": await effective_character_height(db, stage),
            # CHỖ XUẤT PHÁT cũng đóng băng, cùng lý do với vùng đi được: người
            # dựng dời chỗ xuất phát giữa chừng thì lượt đang chơi vẫn thuộc về
            # cái cảnh nó bắt đầu. Ảnh hưởng thật ra chỉ tới người vào sau —
            # người đang chơi đã có `pos_x/pos_y` riêng và đứng đúng chỗ họ đi
            # tới — nhưng đóng băng thì cả đội cùng một đề bài, không phải một
            # đội mà người vào trước và người vào sau rơi xuống hai chỗ khác nhau.
            #
            # `None` = người dựng chưa đặt; cảnh dùng chỗ mặc định của nó.
            "spawn_x": stage.spawn_x,
            "spawn_y": stage.spawn_y,
            "time_limit_seconds": stage.time_limit_seconds,
            "energy_per_player": stage.energy_per_player,
            "map_shard_index": stage.map_shard_index,
            "advisor_npc_key": stage.advisor_npc_key,
            "advisor_outro_i18n": stage.advisor_outro_i18n,
            # Tiếng của lời NPC cũng ĐÓNG BĂNG như mọi thứ khác trong đề bài.
            "advisor_outro_audio_url": outro_audio_url,
            "advisor_outro_show_transcript": stage.advisor_outro_show_transcript,
            "cluebook_title_i18n": stage.cluebook_title_i18n,
            "cluebook_i18n": stage.cluebook_i18n,
            "background_media_id": str(stage.background_media_id)
            if stage.background_media_id
            else None,
            "background_url": bg_url,
            "background_kind": bg_kind,
            "advisor_portrait_media_id": str(stage.advisor_portrait_media_id)
            if stage.advisor_portrait_media_id
            else None,
            # Vùng đi được cũng ĐÓNG BĂNG như mọi thứ khác: giáo viên sửa lại
            # bản vẽ giữa chừng thì lượt đang chơi vẫn đi trên đúng cái sàn nó
            # bắt đầu. Đổi sàn dưới chân người đang đứng là cách chắc chắn nhất
            # để nhốt họ vào một chỗ không có đường ra.
            "collision": stage.collision_json,
            # Âm thanh cũng đóng băng, cả cấu hình lẫn URL: giáo viên đổi bản
            # nhạc giữa chừng thì lượt đang chơi vẫn nghe đúng cái nó bắt đầu.
            "audio": stage.audio_json or {},
            "audio_urls": audio_urls,
        },
        "quests": snapshot_quests,
    }
    return snapshot, {"questions": answer_key}


# --------------------------------------------------------------------------
# Bắt đầu một lượt chơi
# --------------------------------------------------------------------------


def _room_code() -> str:
    """Mã phòng gõ tay được: ATL-K7Q2.

    Bỏ các ký tự dễ đọc nhầm (0/O, 1/I) — mã này được đọc qua điện thoại cho bạn.
    """
    alphabet = "".join(c for c in string.ascii_uppercase + string.digits if c not in "O0I1")
    return "ATL-" + "".join(random.choice(alphabet) for _ in range(4))


async def open_run_of(db: AsyncSession, user: User, stage_id: uuid.UUID) -> StageRun | None:
    """Lượt `playing` gần nhất của CHÍNH người này ở màn này — kể cả đã hết giờ.

    Chỉ lượt của chính họ (`stage_run_players.user_id`): phòng nhiều người đến ở
    Bước 7, và lúc đó "chơi tiếp" phải hỏi thêm phòng nào.

    Trả về cả lượt đã hết giờ vì `start_run` cần chính hàng đó để CHỐT nó thành
    thua. Ai chỉ muốn biết "vào lại có chơi tiếp không" thì gọi `resumable_run`.
    """
    return await db.scalar(
        select(StageRun)
        .join(StageRunPlayer, StageRunPlayer.stage_run_id == StageRun.id)
        .where(
            StageRun.stage_id == stage_id,
            StageRun.status == RunStatus.PLAYING,
            StageRunPlayer.user_id == user.id,
        )
        .order_by(StageRun.started_at.desc())
        .limit(1)
    )


async def resumable_run(db: AsyncSession, user: User, stage_id: uuid.UUID) -> StageRun | None:
    """Lượt CÒN DỞ của người này: vào lại là chơi tiếp đúng lượt đó.

    `None` = vào lại sẽ mở một lượt mới (chưa từng chơi, đã xong, hoặc lượt cũ
    đã hết giờ).

    Tách ra thành một hàm vì hai chỗ hỏi cùng một câu hỏi: `start_run` hỏi để
    quyết chơi tiếp hay mở lượt mới, và `GET /play/stages/{id}/intro` hỏi để
    quyết có chiếu video mở màn không. Hai bản chép của cùng một luật thì lệch
    nhau ở đúng cái trường hợp khó thấy nhất — lượt vừa hết giờ — và hậu quả là
    học sinh xem video mở màn rồi bước vào một lượt chơi tiếp, hoặc ngược lại.
    """
    run = await open_run_of(db, user, stage_id)
    return run if run is not None and seconds_remaining(run) > 0 else None


async def start_run(db: AsyncSession, user: User, stage: Stage) -> StageRun:
    """Vào một màn chơi: CHƠI TIẾP lượt còn giờ, hoặc mở lượt mới.

    Vẫn tạo `rooms` và `room_members` dù chỉ có một người: lượt chơi luôn thuộc
    về một phòng (GAME_DOMAIN §3.4), và làm khác đi ở chế độ đơn nghĩa là có hai
    đường dẫn tới cùng một thứ.

    Màn đã THẮNG rồi vẫn chơi lại được, và lần đó là một lượt hoàn toàn mới —
    lượt cũ không còn `playing` nên nó không lọt vào nhánh chơi tiếp.
    """
    is_preview = user.role in UserRole.CAN_PREVIEW

    # Học sinh chỉ vào được màn đã xuất bản. Giáo viên vào được cả bản nháp —
    # đó là toàn bộ ý nghĩa của chế độ chơi thử.
    if stage.status != PublishStatus.PUBLISHED and not is_preview:
        raise ConflictError(PlayError.STAGE_NOT_PLAYABLE, status=stage.status)

    # ---------------------------------------------------------------- chơi tiếp
    #
    # Vào lại mà lượt cũ CÒN GIỜ thì trả về đúng lượt đó, không mở lượt mới.
    #
    # Mất mạng, sập pin, đóng nhầm tab — chuyện xảy ra suốt trong lớp học. Mở
    # lượt mới mỗi lần tải trang nghĩa là mọi tai nạn đó đều xoá sạch bài đang
    # làm, và người chơi không có cách nào biết trước điều đó để mà tránh.
    #
    # Trạng thái khôi phục được TOÀN BỘ vì nó vốn nằm ở server cả: đề bài đóng
    # băng trong `snapshot_json`, bài đã chấm ở `quest_answers`, bài đang dở ở
    # `quest_drafts`, năng lượng ở `stage_run_players`, và đồng hồ đếm từ
    # `started_at` chứ không từ lúc mở trang.
    #
    # HẾT GIỜ thì ngược lại: chốt lượt cũ thành thua rồi mở lượt mới, đúng như
    # người chơi mong đợi khi bấm vào một màn đã hết giờ. Không chốt mà cứ bỏ đó
    # thì lượt "đang chơi" ấy nằm lại mãi trong database và mọi báo cáo về sau
    # phải tự nhớ mà loại trừ.
    #
    # Chỉ nhận lượt của CHÍNH người này (`stage_run_players.user_id`): phòng
    # nhiều người đến ở Bước 7, và lúc đó "chơi tiếp" phải hỏi thêm phòng nào.
    existing = await open_run_of(db, user, stage.id)
    if existing is not None:
        if seconds_remaining(existing) > 0:
            return existing
        await settle_run(db, existing, RunStatus.LOST_TIME)


    snapshot, answer_key = await build_snapshot(db, stage)
    if not snapshot["quests"]:
        raise ConflictError(PlayError.STAGE_NOT_PLAYABLE, reason="no_quests")

    # Mã trùng gần như không xảy ra, nhưng thử lại vài lần vẫn rẻ hơn là để một
    # người chơi gặp lỗi 500 vì xui.
    for _ in range(10):
        code = _room_code()
        if not await db.scalar(select(Room.id).where(Room.code == code)):
            break
    else:
        raise ConflictError(ErrorCode.CONFLICT, field="code")

    room = Room(
        code=code,
        stage_id=stage.id,
        host_user_id=user.id,
        mode=RoomMode.SINGLE,
        status=RoomStatus.PLAYING,
        is_trial=is_preview,
        started_at=datetime.now(UTC),
    )
    db.add(room)
    await db.flush()

    db.add(RoomMember(room_id=room.id, user_id=user.id, hero_key=HeroKey.LEO, is_ready=True))

    run = StageRun(
        stage_id=stage.id,
        room_id=room.id,
        snapshot_json=snapshot,
        answer_key_json=answer_key,
        status=RunStatus.PLAYING,
        is_trial=is_preview,
    )
    db.add(run)
    await db.flush()

    db.add(
        StageRunPlayer(
            stage_run_id=run.id,
            user_id=user.id,
            hero_key=HeroKey.LEO,
            max_score=sum(q["pass_score"] for q in snapshot["quests"]),
        )
    )
    await db.commit()
    await db.refresh(run)
    return run


async def get_run(db: AsyncSession, user: User, run_id: uuid.UUID) -> StageRun:
    run = await db.scalar(select(StageRun).where(StageRun.id == run_id))
    if run is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="run")

    # Chỉ người trong phòng mới đọc được lượt chơi.
    member = await db.scalar(
        select(StageRunPlayer.id).where(
            StageRunPlayer.stage_run_id == run.id, StageRunPlayer.user_id == user.id
        )
    )
    if member is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="run")
    return run


def seconds_remaining(run: StageRun) -> int:
    """Thời gian còn lại, tính từ SERVER.

    Đồng hồ trên máy người chơi chỉ để đếm cho mượt. Tin nó thì đổi giờ hệ thống
    là chơi được vô hạn.
    """
    limit = run.snapshot_json["stage"]["time_limit_seconds"]
    elapsed = (datetime.now(UTC) - run.started_at).total_seconds()
    return max(0, int(limit - elapsed))


# --------------------------------------------------------------------------
# Nộp bài
# --------------------------------------------------------------------------


async def _answers_of(
    db: AsyncSession, run_id: uuid.UUID, user_id: uuid.UUID
) -> list[QuestAnswer]:
    return list(
        await db.scalars(
            select(QuestAnswer).where(
                QuestAnswer.stage_run_id == run_id, QuestAnswer.user_id == user_id
            )
        )
    )


def _quest_of(snapshot: dict[str, Any], quest_id: uuid.UUID) -> dict[str, Any]:
    for quest in snapshot["quests"]:
        if quest["id"] == str(quest_id):
            return quest
    raise NotFoundError(ErrorCode.NOT_FOUND, resource="quest")


def _question_of(quest: dict[str, Any], question_id: uuid.UUID) -> dict[str, Any]:
    for question in quest["questions"]:
        if question["id"] == str(question_id):
            return question
    raise NotFoundError(ErrorCode.NOT_FOUND, resource="question")


def quest_earned(answers: list[QuestAnswer], quest_id: uuid.UUID) -> float:
    """Tổng điểm các câu ĐÚNG của một người trong một nhiệm vụ."""
    return sum(a.score for a in answers if a.quest_id == quest_id and a.is_correct)


# --------------------------------------------------------------------------
# Cổng NPC
# --------------------------------------------------------------------------


def advisor_quest(snapshot: dict[str, Any]) -> dict[str, Any] | None:
    """Nhiệm vụ NPC của lượt chơi này, đọc từ ĐỀ ĐÃ ĐÓNG BĂNG.

    Đọc từ snapshot chứ không truy vấn lại bảng `quests`: giáo viên sửa màn giữa
    chừng thì lượt đang chơi vẫn phải theo đúng cái đề nó bắt đầu. Trả `None`
    cho những lượt chơi có từ trước khi nhiệm vụ NPC thành bắt buộc — chúng
    không có cổng, và không được đóng cửa lại giữa chừng với người đang chơi.
    """
    for quest in snapshot["quests"]:
        if quest["phase"] == QuestPhase.ADVISOR:
            return quest
    return None


def advisor_cleared(snapshot: dict[str, Any], answers: list[QuestAnswer]) -> bool:
    """Người này đã qua NPC chưa. Không có NPC thì coi như đã qua.

    Xét theo TỪNG NGƯỜI, không phải cả đội: luật kết quả độc lập nói ai làm được
    nhiệm vụ nào thì tính cho người đó, nên đồng đội gặp NPC xong không mở khoá
    hộ được. Đó cũng chính là điều làm cho cái cổng này bảo đảm được luật "mỗi
    thành viên phải hoàn thành ít nhất một nhiệm vụ" — nếu mở khoá theo đội thì
    người thứ tư vào muộn có thể đi thẳng tới cột buồm mà chưa làm gì cả.
    """
    quest = advisor_quest(snapshot)
    if quest is None:
        return True
    return quest_earned(answers, uuid.UUID(quest["id"])) >= quest["pass_score"]


def quest_locked(snapshot: dict[str, Any], quest: dict[str, Any], answers: list[QuestAnswer]) -> bool:
    """Nhiệm vụ này có đang khoá với người vừa nộp bài không.

    Chính nhiệm vụ NPC thì không bao giờ khoá — nó là cửa, cửa mà khoá thì không
    ai vào được.
    """
    if quest["phase"] == QuestPhase.ADVISOR:
        return False
    return not advisor_cleared(snapshot, answers)

# --------------------------------------------------------------------------
# Đáp án nháp
# --------------------------------------------------------------------------


async def save_draft(
    db: AsyncSession,
    user: User,
    run: StageRun,
    quest_id: uuid.UUID,
    question_id: uuid.UUID,
    response: dict[str, Any] | None,
) -> None:
    """Ghi lại lựa chọn đang dở của một câu. KHÔNG chấm gì cả.

    Ghi đè bản cũ: quay lại sửa câu nào thì bản mới thắng, đúng như người chơi
    vừa làm. Đó cũng là lý do khoá UNIQUE không tính `attempt_no` — nháp không
    có lịch sử, chỉ có bản mới nhất.

    Kiểm `quest_id`/`question_id` có thật trong ĐỀ ĐÃ ĐÓNG BĂNG trước khi ghi:
    không thì đây là một cái kho tự do cho bất kỳ ai gửi bất kỳ khoá nào.
    """
    if run.status != RunStatus.PLAYING:
        raise ConflictError(PlayError.RUN_NOT_PLAYING, status=run.status)

    quest = _quest_of(run.snapshot_json, quest_id)
    _question_of(quest, question_id)

    if quest_locked(run.snapshot_json, quest, await _answers_of(db, run.id, user.id)):
        advisor = advisor_quest(run.snapshot_json)
        raise ConflictError(
            PlayError.ADVISOR_LOCKED, advisorQuestId=advisor["id"] if advisor else None
        )

    row = await db.scalar(
        select(QuestDraft).where(
            QuestDraft.stage_run_id == run.id,
            QuestDraft.user_id == user.id,
            QuestDraft.question_id == question_id,
        )
    )
    if row is None:
        db.add(
            QuestDraft(
                stage_run_id=run.id,
                user_id=user.id,
                quest_id=quest_id,
                question_id=question_id,
                response_json=response,
            )
        )
    else:
        row.response_json = response

    await db.commit()


async def drafts_of(
    db: AsyncSession, run_id: uuid.UUID, user_id: uuid.UUID
) -> dict[uuid.UUID, dict[str, Any] | None]:
    """Bài đang dở của một người trong lượt này, tra theo `question_id`."""
    rows = await db.scalars(
        select(QuestDraft).where(
            QuestDraft.stage_run_id == run_id, QuestDraft.user_id == user_id
        )
    )
    return {row.question_id: row.response_json for row in rows}



async def _grade_one(
    db: AsyncSession,
    user: User,
    run: StageRun,
    world: World,
    balance: dict[str, Any],
    quest_id: uuid.UUID,
    question: dict[str, Any],
    attempt_no: int,
    response: dict[str, Any] | None,
) -> None:
    """Chấm MỘT câu và ghi một dòng nhật ký. Không chốt lượt chơi, không commit.

    Tách khỏi `submit_quest` vì đó là chỗ quyết định CÂU NÀO được chấm; đây chỉ
    làm phép chấm. Hàm này cố ý không biết gì về nháp, về cổng NPC hay về hết
    giờ — người gọi đã kiểm hết những thứ đó, và kiểm hai lần ở hai nơi là hai
    nơi để lệch nhau.
    """
    key = run.answer_key_json[QUESTIONS_KEY][question["id"]]
    result = grade(question["type"], key["content"], key["answer"], response, key["points"])

    skill_pts = 0
    if result.is_correct:
        # Điểm chiến lực CƠ BẢN, cộng ngay nhưng chưa hiện cho người chơi (§6).
        multiplier = balance.get("difficultyMultiplier", {}).get(world.difficulty, 1.0)
        skill_pts = round(
            key["points"] * float(multiplier) * attempt_multiplier(balance, attempt_no)
        )

    # Trả lời SAI không trừ năng lượng.
    #
    # Năng lượng chỉ trả cho các hành động TRỢ GIÚP — xem `PROJECT OVERVIEW.md`.
    # Trừ khi sai là phạt việc dám thử, trong một trò chơi mà mục đích là để học
    # sinh dám nói tiếng Anh. Trần lượt thử vẫn còn, và đó mới là cái chặn đoán
    # bừa. `quest_answers.energy_spent` giữ nguyên cột cho các hành động trợ
    # giúp ghi vào sau này, nên ở đây nó luôn bằng 0.
    db.add(
        QuestAnswer(
            stage_run_id=run.id,
            user_id=user.id,
            quest_id=quest_id,
            question_id=uuid.UUID(question["id"]),
            attempt_no=attempt_no,
            response_json=response,
            score=result.score,
            max_score=key["points"],
            is_correct=result.is_correct,
            detail_json=result.detail,
            skill_pts_awarded=skill_pts,
            energy_spent=0,
        )
    )

    if skill_pts:
        await _award_skill_pts(db, user, run, world, skill_pts)


async def submit_quest(
    db: AsyncSession,
    user: User,
    run: StageRun,
    quest_id: uuid.UUID,
) -> tuple[bool, int | None, int]:
    """Chấm CẢ NHIỆM VỤ một lượt, từ các bản nháp đang có.

    Trả về (nhiệm vụ đã qua ải, còn mấy lượt thử, năng lượng của người nộp).

    Chấm cả cụm chứ không từng câu: một nhiệm vụ là MỘT việc — nói chuyện xong
    với thuyền trưởng, sửa xong cái cột buồm — nên người chơi phải được xem lại
    và sửa cả bộ trước khi chốt. Chấm ngay từng câu thì câu một đã khoá lại
    trước khi họ kịp đọc câu bốn.

    **Một lần nộp nhiệm vụ = một lượt thử cho MỖI câu chưa đúng.** Câu nào đã
    đúng rồi thì bỏ qua, không chấm lại và không tiêu lượt — giữ nguyên luật
    "đúng rồi thì thôi" mà chỉ số một phần `uq_quest_answers_correct_once` đang
    cưỡng chế ở database.

    Câu nào không có nháp thì cũng KHÔNG chấm: bỏ trống không phải là trả lời
    sai, và tính nó là sai thì người chơi mất một lượt thử cho câu họ chưa xem.
    """
    if run.status != RunStatus.PLAYING:
        raise ConflictError(PlayError.RUN_NOT_PLAYING, status=run.status)

    # Hết giờ thì chốt luôn tại đây, không nhận bài nữa.
    if seconds_remaining(run) <= 0:
        await settle_run(db, run, RunStatus.LOST_TIME)
        raise ConflictError(PlayError.RUN_NOT_PLAYING, status=run.status)

    quest = _quest_of(run.snapshot_json, quest_id)
    answers = await _answers_of(db, run.id, user.id)

    if quest_locked(run.snapshot_json, quest, answers):
        advisor = advisor_quest(run.snapshot_json)
        raise ConflictError(
            PlayError.ADVISOR_LOCKED, advisorQuestId=advisor["id"] if advisor else None
        )

    world = await world_of_run(db, run)
    balance = read_balance(world.balance_json)
    max_attempts = balance.get("maxAttemptsPerQuestion")
    drafts = await drafts_of(db, run.id, user.id)

    # Nhiệm vụ NPC là CỔNG VÀO màn chơi, nên KHÔNG có trần lượt thử.
    #
    # Cạn lượt ở một nhiệm vụ thường thì mất điểm câu đó rồi đi tiếp. Cạn lượt ở
    # cổng thì không có "đi tiếp" nào cả: các nhiệm vụ khác vẫn khoá, không nhiệm
    # vụ nào hoàn thành được, và cả màn hỏng hẳn cho tới khi hết giờ. Sai ba lần
    # lúc chào hỏi không đáng bị như thế.
    is_gate = quest["phase"] == QuestPhase.ADVISOR

    for question in quest["questions"]:
        question_id = uuid.UUID(question["id"])
        mine = [a for a in answers if a.question_id == question_id and a.quest_id == quest_id]

        if any(a.is_correct for a in mine):
            continue
        if question_id not in drafts:
            continue

        attempt_no = len(mine) + 1
        if max_attempts is not None and not is_gate and attempt_no > int(max_attempts):
            continue

        await _grade_one(
            db, user, run, world, balance, quest_id, question, attempt_no, drafts[question_id]
        )

    await db.flush()

    answers = await _answers_of(db, run.id, user.id)
    quest_done = quest_earned(answers, quest_id) >= quest["pass_score"]
    player = await _sync_player_row(db, run, user, answers)

    if quest_done and quest["phase"] == QuestPhase.ADVISOR:
        await _grant_energy(db, run, player)

    if await _all_quests_done(db, run):
        await settle_run(db, run, RunStatus.WON)
    else:
        await db.commit()

    return quest_done, _attempts_left(quest, answers, quest_id, max_attempts), (
        player.energy_remaining if player else 0
    )


def _attempts_left(
    quest: dict[str, Any],
    answers: list[QuestAnswer],
    quest_id: uuid.UUID,
    max_attempts: Any,
) -> int | None:
    """Còn mấy lần nộp NHIỆM VỤ nữa, tính theo câu còn nhiều lượt nhất.

    Lấy cái NHIỀU NHẤT chứ không ít nhất: một câu đã cạn lượt không được làm cả
    nhiệm vụ đóng lại khi những câu khác vẫn còn cơ hội gỡ điểm.

    Nhiệm vụ NPC luôn trả `None` — nó là cổng vào màn, thử đến khi đúng thì thôi.
    """
    if max_attempts is None or quest["phase"] == QuestPhase.ADVISOR:
        return None

    left = 0
    for question in quest["questions"]:
        question_id = uuid.UUID(question["id"])
        mine = [a for a in answers if a.question_id == question_id and a.quest_id == quest_id]
        if any(a.is_correct for a in mine):
            continue
        left = max(left, int(max_attempts) - len(mine))
    return max(0, left)


async def save_position(
    db: AsyncSession, user: User, run: StageRun, x: int, y: int
) -> None:
    """Ghi chỗ nhân vật đang đứng. Của RIÊNG người gọi trong lượt này.

    Kẹp vào khung thế giới ngay tại đây: đây là toạ độ do máy người chơi gửi
    lên, và một con số ngoài khung sẽ đẩy nhân vật ra khỏi cảnh ở lần vào sau —
    không sập gì cả, chỉ là mất hút, tức là kiểu hỏng khó lần ra nhất.

    Không kiểm `run.status`: lưu chỗ đứng của một lượt đã kết thúc thì vô hại,
    mà từ chối nó lại làm hỏng cú lưu cuối cùng đúng vào lúc màn vừa chốt xong.
    """
    player = await db.scalar(
        select(StageRunPlayer).where(
            StageRunPlayer.stage_run_id == run.id, StageRunPlayer.user_id == user.id
        )
    )
    if player is None:
        return

    player.pos_x = max(0, min(WORLD_WIDTH, int(x)))
    player.pos_y = max(0, min(WORLD_HEIGHT, int(y)))
    await db.commit()


async def _grant_energy(db: AsyncSession, run: StageRun, player: StageRunPlayer | None) -> None:
    """Cấp năng lượng cho một người, ngay khi họ qua được nhiệm vụ NPC.

    Cấp SAU khi qua NPC chứ không phải lúc vào màn: NPC là cổng vào của màn, và
    cấp trước thì người chơi tiêu hết vào trợ giúp ngay ở cửa rồi bước vào phần
    chính với hai bàn tay trắng — mà phần chính mới là chỗ cần trợ giúp.

    Chỉ cấp MỘT LẦN. `energy_granted > 0` vừa là số đã cấp vừa là cờ đã cấp: qua
    NPC là chuyện một chiều nên hai điều đó là một. Không có cái cờ này thì mỗi
    lần nộp thêm một câu của nhiệm vụ NPC (một nhiệm vụ chứa nhiều câu) lại nạp
    đầy bình thêm một lần nữa.
    """
    if player is None or player.energy_granted > 0:
        return

    stage = await db.scalar(select(Stage).where(Stage.id == run.stage_id))
    if stage is None or stage.energy_per_player <= 0:
        return

    player.energy_granted = stage.energy_per_player
    player.energy_remaining = stage.energy_per_player
    await db.flush()


async def _energy_of(db: AsyncSession, run: StageRun, user: User) -> int:
    """Năng lượng còn lại của CHÍNH người gọi. 0 nếu chưa qua NPC."""
    value = await db.scalar(
        select(StageRunPlayer.energy_remaining).where(
            StageRunPlayer.stage_run_id == run.id, StageRunPlayer.user_id == user.id
        )
    )
    return value or 0


async def _award_skill_pts(
    db: AsyncSession, user: User, run: StageRun, world: World, points: int
) -> None:
    """Cộng điểm chiến lực, giới hạn ở `stages.skill_pts_max` cho mỗi lượt chơi."""
    stage = await db.scalar(select(Stage).where(Stage.id == run.stage_id))
    player = await db.scalar(
        select(StageRunPlayer).where(
            StageRunPlayer.stage_run_id == run.id, StageRunPlayer.user_id == user.id
        )
    )
    if stage is None or player is None:
        return

    room = max(0, stage.skill_pts_max - player.skill_pts_earned)
    granted = min(points, room)
    if granted <= 0:
        return

    player.skill_pts_earned += granted

    progress = await _get_or_create_world_progress(db, world.id, user.id)
    progress.skill_pts += granted
    progress.last_played_at = datetime.now(UTC)


async def _get_or_create_world_progress(
    db: AsyncSession, world_id: uuid.UUID, user_id: uuid.UUID
) -> WorldProgress:
    progress = await db.scalar(
        select(WorldProgress).where(
            WorldProgress.world_id == world_id, WorldProgress.user_id == user_id
        )
    )
    if progress is None:
        progress = WorldProgress(world_id=world_id, user_id=user_id)
        db.add(progress)
        await db.flush()
    return progress


async def _sync_player_row(
    db: AsyncSession, run: StageRun, user: User, answers: list[QuestAnswer]
) -> StageRunPlayer | None:
    """Cập nhật bản cộng dồn của một người chơi.

    Dư thừa so với `quest_answers`, nhưng cần cho bảng điểm và HUD — không muốn
    quét lại toàn bộ nhật ký mỗi lần vẽ lại màn hình.
    """
    player = await db.scalar(
        select(StageRunPlayer).where(
            StageRunPlayer.stage_run_id == run.id, StageRunPlayer.user_id == user.id
        )
    )
    if player is None:
        return None

    player.score = sum(a.score for a in answers if a.is_correct)
    player.quests_completed = sum(
        1
        for quest in run.snapshot_json["quests"]
        if quest_earned(answers, uuid.UUID(quest["id"])) >= quest["pass_score"]
    )
    return player


async def _all_quests_done(db: AsyncSession, run: StageRun) -> bool:
    """Mọi nhiệm vụ đã có ÍT NHẤT MỘT người hoàn thành chưa.

    Nhiệm vụ là việc của cả đội: một người giải xong cột buồm thì cột buồm xong.
    Còn luật "mỗi thành viên phải hoàn thành ≥1 nhiệm vụ" kiểm riêng ở
    `settle_run` — hai luật khác nhau, đừng gộp.
    """
    answers = list(
        await db.scalars(select(QuestAnswer).where(QuestAnswer.stage_run_id == run.id))
    )
    by_user: dict[uuid.UUID, list[QuestAnswer]] = {}
    for answer in answers:
        by_user.setdefault(answer.user_id, []).append(answer)

    for quest in run.snapshot_json["quests"]:
        quest_id = uuid.UUID(quest["id"])
        if not any(
            quest_earned(rows, quest_id) >= quest["pass_score"] for rows in by_user.values()
        ):
            return False
    return True


async def world_of_run(db: AsyncSession, run: StageRun) -> World:
    world = await db.scalar(
        select(World)
        .join(Chapter, Chapter.world_id == World.id)
        .join(Stage, Stage.chapter_id == Chapter.id)
        .where(Stage.id == run.stage_id)
    )
    if world is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="world")
    return world


# --------------------------------------------------------------------------
# Kết toán
# --------------------------------------------------------------------------


def _bonus_for(table: list[dict[str, Any]] | None, remaining_pct: float) -> float:
    """Mức thưởng theo % còn lại. Bảng xếp từ ngưỡng cao xuống thấp."""
    for row in table or []:
        if remaining_pct >= float(row.get("minRemainingPct", 0)):
            return float(row.get("bonus", 0))
    return 0.0


async def settle_run(db: AsyncSession, run: StageRun, status: str) -> None:
    """Chốt lượt chơi: thắng/thua, thưởng, trao mảnh bản đồ.

    Thắng thì mọi thành viên nhận mảnh; thua thì **vẫn giữ điểm chiến lực cơ
    bản** đã kiếm được, chỉ mất phần thưởng và mảnh (§6).
    """
    if run.status != RunStatus.PLAYING:
        return

    now = datetime.now(UTC)
    run.ended_at = now
    run.duration_seconds = int((now - run.started_at).total_seconds())

    players = list(
        await db.scalars(select(StageRunPlayer).where(StageRunPlayer.stage_run_id == run.id))
    )
    humans = [p for p in players if p.user_id is not None]

    # Luật: mọi thành viên phải hoàn thành ≥1 nhiệm vụ thì màn mới tính hoàn thành.
    if status == RunStatus.WON and not all(p.quests_completed >= 1 for p in humans):
        status = RunStatus.PLAYING  # chưa xong — còn người chưa làm gì
        run.ended_at = None
        run.duration_seconds = None
        await db.commit()
        return

    run.status = status

    world = await world_of_run(db, run)
    stage = await db.scalar(select(Stage).where(Stage.id == run.stage_id))
    balance = read_balance(world.balance_json)

    if status == RunStatus.WON and stage is not None:
        time_pct = 100.0 * seconds_remaining(run) / max(1, stage.time_limit_seconds)
        time_mult = 1 + _bonus_for(balance.get("timeBonus"), time_pct)

        for player in humans:
            # Thưởng năng lượng tính theo quỹ CỦA CHÍNH NGƯỜI ĐÓ, không phải một
            # con số chung: công thức Exp là công thức cá nhân, nên người tiêu dè
            # sẻn không bị kéo xuống vì đồng đội xài hoang.
            #
            # Chưa được cấp (chưa qua NPC) thì không có thưởng năng lượng — chia
            # cho 0 là hỏng, mà cho họ 100% cũng sai: họ chưa từng có bình nào.
            energy_pct = (
                100.0 * player.energy_remaining / player.energy_granted
                if player.energy_granted > 0
                else 0.0
            )
            multiplier = time_mult * (1 + _bonus_for(balance.get("energyBonus"), energy_pct))

            # Nhịp 2: cộng nốt phần chênh so với điểm cơ bản đã cộng lúc nộp.
            bonus = round(player.skill_pts_earned * (multiplier - 1))
            capped = min(bonus, max(0, stage.skill_pts_max - player.skill_pts_earned))
            if capped > 0 and player.user_id:
                player.skill_pts_earned += capped
                progress = await _get_or_create_world_progress(db, world.id, player.user_id)
                progress.skill_pts += capped

            if player.user_id:
                await _grant_shard(db, world, stage, run, player)

    # Lượt chơi thử không làm bẩn thống kê, nhưng vẫn ghi tiến trình thật cho
    # chính tài khoản giáo viên đó — xem ARCHITECTURE §4.
    for player in humans:
        if player.user_id:
            await _bump_stage_progress(db, run, player)

    room = await db.scalar(select(Room).where(Room.id == run.room_id))
    if room is not None:
        room.status = RoomStatus.FINISHED
        room.finished_at = now

    await db.commit()


async def _grant_shard(
    db: AsyncSession, world: World, stage: Stage, run: StageRun, player: StageRunPlayer
) -> None:
    """Trao mảnh bản đồ của MÀN cho một người.

    Không có cờ trên nhiệm vụ: hoàn thành cả màn thì được mảnh, và số hiệu mảnh
    là `stages.map_shard_index` (§1.5c).

    `UNIQUE(world, user, shard_index)` ở database lo phần "không trùng mảnh" —
    chơi lại màn 13 mười lần vẫn chỉ có một mảnh #13.
    """
    existing = await db.scalar(
        select(MapShardOwned.id).where(
            MapShardOwned.world_id == world.id,
            MapShardOwned.user_id == player.user_id,
            MapShardOwned.shard_index == stage.map_shard_index,
        )
    )
    player.got_map_shard = True
    if existing is not None:
        return

    db.add(
        MapShardOwned(
            world_id=world.id,
            user_id=player.user_id,
            shard_index=stage.map_shard_index,
            stage_run_id=run.id,
        )
    )
    progress = await _get_or_create_world_progress(db, world.id, player.user_id)
    progress.stages_completed += 1


async def _bump_stage_progress(
    db: AsyncSession, run: StageRun, player: StageRunPlayer
) -> None:
    row = await db.scalar(
        select(StageProgress).where(
            StageProgress.stage_id == run.stage_id, StageProgress.user_id == player.user_id
        )
    )
    if row is None:
        row = StageProgress(stage_id=run.stage_id, user_id=player.user_id)
        db.add(row)
        await db.flush()

    row.times_played += 1
    row.best_score = max(row.best_score, int(player.score))
    row.best_quests_completed = max(row.best_quests_completed, player.quests_completed)
    row.skill_pts_earned_total += player.skill_pts_earned
    if run.status == RunStatus.WON and row.first_completed_at is None:
        row.first_completed_at = datetime.now(UTC)


async def count_shards(db: AsyncSession, world_id: uuid.UUID, user_id: uuid.UUID) -> int:
    return (
        await db.scalar(
            select(func.count())
            .select_from(MapShardOwned)
            .where(MapShardOwned.world_id == world_id, MapShardOwned.user_id == user_id)
        )
        or 0
    )

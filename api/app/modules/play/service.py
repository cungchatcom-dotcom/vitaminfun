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
from app.modules.worlds.service import effective_pass_score


class PlayError:
    RUN_NOT_PLAYING = "RUN_NOT_PLAYING"
    QUESTION_LOCKED = "QUESTION_LOCKED"
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

    bg_url = None
    if stage.background_media_id:
        bg_url = await db.scalar(
            select(MediaAsset.url).where(MediaAsset.id == stage.background_media_id)
        )

    snapshot = {
        "stage": {
            "id": str(stage.id),
            "name_i18n": stage.name_i18n,
            "synopsis_i18n": stage.synopsis_i18n,
            "scene_key": stage.scene_key,
            "time_limit_seconds": stage.time_limit_seconds,
            "initial_team_energy": stage.initial_team_energy,
            "map_shard_index": stage.map_shard_index,
            "advisor_npc_key": stage.advisor_npc_key,
            "cluebook_i18n": stage.cluebook_i18n,
            "background_media_id": str(stage.background_media_id)
            if stage.background_media_id
            else None,
            "background_url": bg_url,
            "advisor_portrait_media_id": str(stage.advisor_portrait_media_id)
            if stage.advisor_portrait_media_id
            else None,
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


async def start_run(db: AsyncSession, user: User, stage: Stage) -> StageRun:
    """Tạo một lượt chơi ĐƠN. Phòng nhiều người đến ở Bước 7.

    Vẫn tạo `rooms` và `room_members` dù chỉ có một người: lượt chơi luôn thuộc
    về một phòng (GAME_DOMAIN §3.4), và làm khác đi ở chế độ đơn nghĩa là có hai
    đường dẫn tới cùng một thứ.
    """
    is_preview = user.role in UserRole.CAN_PREVIEW

    # Học sinh chỉ vào được màn đã xuất bản. Giáo viên vào được cả bản nháp —
    # đó là toàn bộ ý nghĩa của chế độ chơi thử.
    if stage.status != PublishStatus.PUBLISHED and not is_preview:
        raise ConflictError(PlayError.STAGE_NOT_PLAYABLE, status=stage.status)

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
        team_energy_initial=stage.initial_team_energy,
        team_energy_remaining=stage.initial_team_energy,
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


async def submit_answer(
    db: AsyncSession,
    user: User,
    run: StageRun,
    quest_id: uuid.UUID,
    question_id: uuid.UUID,
    response: dict[str, Any] | None,
) -> tuple[bool, bool, int | None, int]:
    """Chấm một câu. Trả về (đúng, nhiệm vụ đã xong, còn mấy lượt, năng lượng đội).

    KHÔNG trả điểm, không trả đáp án, không trả giải thích — xem §1.6.
    """
    if run.status != RunStatus.PLAYING:
        raise ConflictError(PlayError.RUN_NOT_PLAYING, status=run.status)

    # Hết giờ thì chốt luôn tại đây, không nhận bài nữa.
    if seconds_remaining(run) <= 0:
        await settle_run(db, run, RunStatus.LOST_TIME)
        raise ConflictError(PlayError.RUN_NOT_PLAYING, status=run.status)

    quest = _quest_of(run.snapshot_json, quest_id)
    question = _question_of(quest, question_id)
    key = run.answer_key_json["questions"][str(question_id)]

    world = await world_of_run(db, run)
    balance = read_balance(world.balance_json)
    max_attempts = balance.get("maxAttemptsPerQuestion")

    answers = await _answers_of(db, run.id, user.id)
    mine = [a for a in answers if a.quest_id == quest_id and a.question_id == question_id]

    # Đúng rồi thì thôi. Trả về trạng thái hiện tại thay vì báo lỗi: bấm hai lần
    # do mạng chậm không phải là chuyện người dùng làm sai.
    if any(a.is_correct for a in mine):
        return (
            True,
            quest_earned(answers, quest_id) >= quest["pass_score"],
            0 if max_attempts else None,
            run.team_energy_remaining,
        )

    attempt_no = len(mine) + 1
    if max_attempts is not None and attempt_no > int(max_attempts):
        raise ConflictError(PlayError.QUESTION_LOCKED, maxAttempts=int(max_attempts))

    result = grade(question["type"], key["content"], key["answer"], response, key["points"])

    energy_spent = 0
    skill_pts = 0
    if result.is_correct:
        # Điểm chiến lực CƠ BẢN, cộng ngay nhưng chưa hiện cho người chơi (§6).
        multiplier = balance.get("difficultyMultiplier", {}).get(world.difficulty, 1.0)
        skill_pts = round(key["points"] * float(multiplier) * attempt_multiplier(balance, attempt_no))
    else:
        energy_spent = int(balance.get("energyCost", {}).get("wrongAnswer", 0))

    db.add(
        QuestAnswer(
            stage_run_id=run.id,
            user_id=user.id,
            quest_id=quest_id,
            question_id=question_id,
            attempt_no=attempt_no,
            response_json=response,
            score=result.score,
            max_score=key["points"],
            is_correct=result.is_correct,
            detail_json=result.detail,
            skill_pts_awarded=skill_pts,
            energy_spent=energy_spent,
        )
    )

    if energy_spent:
        # Không cho âm: quỹ có ràng buộc CHECK >= 0 ở database.
        run.team_energy_remaining = max(0, run.team_energy_remaining - energy_spent)

    if skill_pts:
        await _award_skill_pts(db, user, run, world, skill_pts)

    await db.flush()

    answers = await _answers_of(db, run.id, user.id)
    earned = quest_earned(answers, quest_id)
    quest_done = earned >= quest["pass_score"]

    await _sync_player_row(db, run, user, answers)

    attempts_left = None if max_attempts is None else max(0, int(max_attempts) - attempt_no)
    if result.is_correct:
        attempts_left = 0 if max_attempts else None

    # Hết năng lượng là cả đội thua, ngay lập tức.
    if run.team_energy_remaining <= 0:
        await settle_run(db, run, RunStatus.LOST_ENERGY)
    elif await _all_quests_done(db, run):
        await settle_run(db, run, RunStatus.WON)
    else:
        await db.commit()

    return result.is_correct, quest_done, attempts_left, run.team_energy_remaining


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
) -> None:
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
        return

    player.score = sum(a.score for a in answers if a.is_correct)
    player.quests_completed = sum(
        1
        for quest in run.snapshot_json["quests"]
        if quest_earned(answers, uuid.UUID(quest["id"])) >= quest["pass_score"]
    )


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
        energy_pct = 100.0 * run.team_energy_remaining / max(1, run.team_energy_initial)
        multiplier = (1 + _bonus_for(balance.get("timeBonus"), time_pct)) * (
            1 + _bonus_for(balance.get("energyBonus"), energy_pct)
        )

        for player in humans:
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

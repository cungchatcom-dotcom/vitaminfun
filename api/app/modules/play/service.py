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
from datetime import UTC, datetime, timedelta
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, ErrorCode, NotFoundError
from app.core.logging import logger
from app.db.models import (
    AudioTarget,
    DialogueKind,
    DialogueMessage,
    PromptKind,
    Chapter,
    Character,
    CharacterAction,
    MapShardOwned,
    MediaAsset,
    PublishStatus,
    Quest,
    QuestAnswer,
    QuestDraft,
    QuestPhase,
    QuestQuestion,
    Question,
    QuestionAudio,
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
from app.modules.play.schemas import DialogueActor, RunSpriteOut
from app.modules.questions.grading import grade
from app.modules.voices import tts
from app.modules.worlds.balance import attempt_multiplier, read_balance
from app.modules.worlds.service import (
    block_urls,
    effective_character_height,
    effective_dialogue,
    effective_pass_score,
)


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
    #: Xin gợi ý mà không đủ năng lượng.
    NOT_ENOUGH_ENERGY = "NOT_ENOUGH_ENERGY"


# --------------------------------------------------------------------------
# Đóng băng đề bài
# --------------------------------------------------------------------------


async def actors_of(
    db: AsyncSession, character_ids: Iterable[uuid.UUID]
) -> dict[uuid.UUID, DialogueActor]:
    """Nhân vật kèm spritesheet, tra cả loạt trong MỘT lượt.

    Dùng cho cả người canh giữ (nằm trong đề bài đóng băng) lẫn nhân vật học
    sinh chọn. Cùng một phép dựng cho cả hai vai, vì cả hai là `characters` và
    cả hai vẽ bằng `character_actions` — hai bản chép sẽ lệch nhau đúng vào lúc
    ai đó thêm một tư thế.

    Tra CẢ LOẠT vì một màn có tới năm nhiệm vụ, mỗi nhiệm vụ một người canh giữ:
    mỗi người một truy vấn là năm lượt hỏi cho một lần dựng đề bài.

    Nhân vật ở trạng thái NHÁP vẫn trả về. Khác với lúc học sinh CHỌN nhân vật —
    ở đó nháp phải giấu đi. Ở đây người dựng vừa gán một NPC vào nhiệm vụ, và
    một khuôn mặt biến mất vì quên bấm xuất bản là thứ không ai đoán ra.
    """
    ids = {cid for cid in character_ids if cid}
    if not ids:
        return {}

    characters = list(await db.scalars(select(Character).where(Character.id.in_(ids))))
    if not characters:
        return {}

    rows = list(
        await db.execute(
            select(CharacterAction, MediaAsset.url, MediaAsset.width, MediaAsset.height)
            .join(MediaAsset, MediaAsset.id == CharacterAction.media_id)
            .where(CharacterAction.character_id.in_(ids))
        )
    )
    by_character: dict[uuid.UUID, list[RunSpriteOut]] = {}
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
        by_character.setdefault(action.character_id, []).append(
            RunSpriteOut(
                action_key=action.action_key,
                url=url,
                frames=action.frames,
                frame_width=width,
                frame_height=height,
                frame_rate=action.frame_rate,
            )
        )

    avatar_ids = [c.avatar_media_id for c in characters if c.avatar_media_id]
    avatars: dict[uuid.UUID, str] = {}
    if avatar_ids:
        found = await db.execute(
            select(MediaAsset.id, MediaAsset.url).where(MediaAsset.id.in_(avatar_ids))
        )
        avatars = {r.id: r.url for r in found}

    return {
        c.id: DialogueActor(
            id=c.id,
            name_i18n=c.name_i18n or {},
            avatar_url=avatars.get(c.avatar_media_id),
            voice_id=c.voice_id,
            sprites=by_character.get(c.id, []),
        )
        for c in characters
    }


async def build_snapshot(db: AsyncSession, stage: Stage) -> tuple[dict[str, Any], dict[str, Any]]:
    """Dựng (đề bài, đáp án) từ trạng thái HIỆN TẠI của màn.

    Trả về hai cục tách rời: cục thứ nhất an toàn gửi xuống mọi máy, cục thứ hai
    ở lại server. Tách ở đây, một lần, thay vì mỗi endpoint tự nhớ che — quên
    che một chỗ là lộ đáp án cả màn.
    """
    quests = list(
        await db.scalars(select(Quest).where(Quest.stage_id == stage.id).order_by(Quest.order_index))
    )

    # Bộ câu phán của WORLD — một lần cho cả màn, vì chữ thì cả world dùng chung.
    # Chỉ TIẾNG mới khác theo từng nhiệm vụ, vì mỗi nhiệm vụ một người canh giữ.
    world = (
        await db.execute(
            select(World)
            .join(Chapter, Chapter.world_id == World.id)
            .where(Chapter.id == stage.chapter_id)
        )
    ).scalars().first()
    #: Ba nhóm, giữ nguyên cho màn chơi chọn câu; và một danh sách phẳng để tra
    #: tiếng. Hai hình dạng của cùng một thứ, dựng cạnh nhau để khỏi lệch.
    verdict_groups = (world.verdict_json or {}) if world else {}
    verdict_lines = tts.verdict_lines(world) if world else []
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
    icon_ids = {q.icon_media_id for q in quests if q.icon_media_id}
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

    # TIẾNG ĐỌC CÁC PHƯƠNG ÁN, gom theo (câu hỏi, giọng).
    #
    # Đóng băng URL như mọi thứ khác trong đề bài. Gửi CẢ các giọng chứ không
    # chọn sẵn một giọng: nhân vật học sinh chọn để chơi nằm ở `world_progress`
    # và đổi được giữa hai lượt, còn đề bài thì đóng băng lúc bắt đầu — chọn hộ
    # ở đây là đóng băng cả một lựa chọn chưa xảy ra.
    #
    # Chỉ `target="option"`. Tiếng của ĐỀ BÀI đã có đường riêng (`audio_url`,
    # tra theo `questions.audio_media_id`).
    option_audio: dict[str, dict[str, dict[str, str]]] = {}
    if questions:
        rows = await db.execute(
            select(
                QuestionAudio.question_id,
                QuestionAudio.voice_id,
                QuestionAudio.option_key,
                MediaAsset.url,
            )
            .join(MediaAsset, MediaAsset.id == QuestionAudio.media_id)
            .where(
                QuestionAudio.question_id.in_(list(questions.keys())),
                QuestionAudio.target == AudioTarget.OPTION,
            )
        )
        for r in rows:
            if not r.option_key or not r.url:
                continue
            theo_cau = option_audio.setdefault(str(r.question_id), {})
            theo_cau.setdefault(str(r.voice_id), {})[r.option_key] = r.url

    # Người canh giữ của MỌI nhiệm vụ trong một lượt tra.
    npcs = await actors_of(db, [q.npc_character_id for q in quests])

    # GIỌNG CỦA NGƯỜI GÁC CỬA — tính MỘT lần cho cả màn.
    #
    # Câu khoá do người gác cửa nói, và cả màn chỉ có một người gác cửa (nhiệm
    # vụ `advisor`). Hầu hết nhiệm vụ thường không gán NPC nào, nên lấy giọng
    # của chính nhiệm vụ ấy thì phần lớn cánh cửa sẽ câm.
    gac = next((q for q in quests if q.phase == QuestPhase.ADVISOR), None)
    giong_gac = await tts.voice_of_character(db, gac.npc_character_id) if gac else None

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
            # LỜI THOẠI của câu nghe là một GỢI Ý PHẢI TRẢ TIỀN, nên nó không
            # được đi cùng đề bài — đúng luật đã ghi cho `translation` và
            # `hint`: thứ gì phải trả bằng năng lượng mới được xem thì không
            # nằm trong `content`. Gửi kèm là phát không, và mở tab mạng của
            # trình duyệt là thấy.
            #
            # Trừ khi giáo viên đã bật `show_transcript`: khi đó chính họ quyết
            # định câu này hiện chữ sẵn, và không có gì để mà bán.
            content = question.content_json
            if question.prompt_kind == PromptKind.AUDIO and not question.show_transcript:
                content = {**content, "prompt": None}

            snapshot_questions.append(
                {
                    "id": str(link.question_id),
                    "type": question.type,
                    "content": content,
                    "points": link.points,
                    "audio_max_plays": question.audio_max_plays,
                    # CÁCH RA ĐỀ đóng băng cùng đề bài: giáo viên đổi một câu từ
                    # đọc sang nghe giữa chừng thì lượt đang chơi vẫn là cái đề
                    # nó bắt đầu — cùng luật với vùng đi được và ảnh nền.
                    "prompt_kind": question.prompt_kind,
                    "show_transcript": question.show_transcript,
                    "audio_url": q_audio.get(question.audio_media_id),
                    # Tiếng đọc từng phương án, theo từng giọng. Màn chơi lấy
                    # giọng của chính nhân vật học sinh đang chơi.
                    "option_audio": option_audio.get(str(link.question_id), {}),
                    # CHỈ cái có hay không, không phải bản dịch. Bản dịch nằm
                    # cùng chỗ với đáp án và phải trả bằng năng lượng mới xem
                    # được; nhưng giao diện cần biết có nên vẽ cái nút Dịch hay
                    # không TRƯỚC khi học sinh bấm vào nó.
                    "has_translation": bool((question.answer_json or {}).get("translation")),
                    #: Có lời thoại để MUA hay không. Câu đọc thì không, và câu
                    #: nghe đã bật `show_transcript` cũng không — chữ hiện sẵn
                    #: rồi thì không còn gì để mở ra.
                    "has_transcript": bool(
                        question.prompt_kind == PromptKind.AUDIO
                        and not question.show_transcript
                        and (question.content_json or {}).get("prompt")
                    ),
                }
            )
            answer_key[str(link.question_id)] = {
                "type": question.type,
                "content": question.content_json,
                "answer": question.answer_json,
                "points": link.points,
                "explanation": question.explanation,
            }

        # LỜI PHÁN — chữ của WORLD, tiếng của người canh giữ NHIỆM VỤ này.
        #
        # Đóng băng cả hai cùng lý do với đề bài: giáo viên sửa câu khen hay đổi
        # giọng giữa chừng thì lượt đang chơi vẫn nghe đúng thứ nó bắt đầu.
        # Danh sách rỗng = màn chơi dùng bộ mặc định trong `messages/`.
        npc_voice = await tts.voice_of_character(db, quest.npc_character_id)
        verdict_audio = await tts.line_urls(
            db, npc_voice.id if npc_voice else None, verdict_lines
        )

        # CÂU KHOÁ và tiếng của nó. Cùng bảng `voice_lines` với lời phán, nên
        # hai nhiệm vụ có cùng câu và cùng giọng thì dùng chung một bản thu.
        khoa = quest.locked_message_i18n or {}
        khoa_audio = await tts.line_urls(
            db,
            giong_gac.id if giong_gac else None,
            [t for t in khoa.values() if t],
        )

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
                # NGƯỜI CANH GIỮ, đóng băng cùng lý do với ảnh vật thể: giáo
                # viên đổi NPC giữa chừng thì lượt đang chơi vẫn nói chuyện với
                # đúng người nó bắt đầu — kể cả khi tư thế được tải thêm sau đó.
                "npc": npc.model_dump(mode="json") if (npc := npcs.get(quest.npc_character_id)) else None,
                "icon_size": quest.icon_size,
                "pulse_percent": quest.pulse_percent,
                "pulse_period_ms": quest.pulse_period_ms,
                "energy_cost": quest.energy_cost,
                "pass_score": effective_pass_score(quest.pass_score, total),
                # LỜI PHÁN: chữ của WORLD, tiếng của người canh giữ NHIỆM VỤ này.
                #
                # Đóng băng cả hai cùng lý do với đề bài: giáo viên sửa câu khen
                # hay đổi giọng giữa chừng thì lượt đang chơi vẫn nghe đúng thứ
                # nó bắt đầu. Rỗng = màn chơi dùng bộ mặc định trong `messages/`.
                "verdict": verdict_groups,
                "verdict_audio": verdict_audio,
                # CÂU KHOÁ: chữ của nhiệm vụ này, tiếng của NGƯỜI GÁC CỬA màn.
                #
                # Chỉ đóng băng URL của bản dịch ĐANG có — màn chơi chọn ngôn
                # ngữ ở máy, nên gửi cả bảng `câu chữ → URL` và để nó tự tra.
                "locked_message_i18n": khoa,
                "locked_audio": khoa_audio,
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
            # Bố cục hội thoại đóng băng ở dạng ĐÃ GIẢI XONG KẾ THỪA: lượt đang
            # chơi không được đi hỏi lại màn 1 của world, vì màn 1 có thể đã
            # đổi — hoặc bị xoá — từ lúc lượt này bắt đầu.
            "dialogue": (dialogue := await effective_dialogue(db, stage)),
            "dialogue_urls": await block_urls(db, dialogue),
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
    """Tổng điểm các câu ĐÚNG của một người trong một nhiệm vụ.

    Cộng đúng những dòng ĐƯỢC ĐƯA VÀO. Chỗ gọi quyết định đưa vào vòng nào —
    xem `same_round()` cho "đang chơi tới đâu" và `quest_best()` cho báo cáo.
    """
    return sum(a.score for a in answers if a.quest_id == quest_id and a.is_correct)


# --------------------------------------------------------------------------
# VÒNG CHƠI của một nhiệm vụ
#
# Người chơi bấm "Làm lại" bao nhiêu lần cũng được. Mỗi lần là một VÒNG mới:
# mọi câu trong nhiệm vụ trở về trắng, lượt thử đếm lại từ đầu. Dòng cũ không bị
# xoá, nên hai câu hỏi khác nhau cần hai phép đọc khác nhau:
#
#   - "đang chơi tới đâu" → CHỈ vòng hiện tại (`same_round`),
#   - "được bao nhiêu" → vòng TỐT NHẤT (`quest_best`).
#
# Lẫn hai cái là hỏng theo hai hướng ngược nhau: lấy tất cả các vòng cho phép
# đầu thì một câu đã trả lời đúng ở vòng trước hoá ra không cần làm lại; lấy
# riêng vòng hiện tại cho phép sau thì chơi lại mà kém hơn là mất điểm cũ.
# --------------------------------------------------------------------------


def round_now(player: StageRunPlayer | None, quest_id: uuid.UUID) -> int:
    """Nhiệm vụ này đang ở vòng thứ mấy. Chưa làm lại lần nào = vòng 1."""
    if player is None:
        return 1
    raw = (player.rounds_json or {}).get(str(quest_id))
    return int(raw) if isinstance(raw, int) and raw >= 1 else 1


def same_round(answers: list[QuestAnswer], round_no: int) -> list[QuestAnswer]:
    """Lọc lấy đúng một vòng."""
    return [a for a in answers if a.round_no == round_no]


def quest_best(answers: list[QuestAnswer], quest_id: uuid.UUID) -> float:
    """Điểm của VÒNG CAO NHẤT — con số đi vào báo cáo.

    Không phải tổng mọi vòng: chơi lại năm lần không có nghĩa được điểm gấp năm.
    """
    theo_vong: dict[int, float] = {}
    for a in answers:
        if a.quest_id != quest_id or not a.is_correct:
            continue
        theo_vong[a.round_no] = theo_vong.get(a.round_no, 0.0) + a.score
    return max(theo_vong.values(), default=0.0)


def quest_ever_passed(answers: list[QuestAnswer], quest: dict[str, Any]) -> bool:
    """Đã có vòng nào qua ải chưa.

    Qua rồi thì mãi mãi là đã qua: chơi lại mà kém hơn không lấy mất cái nhãn đã
    giành được. Đây đúng là lý do người ta dám bấm Làm lại.
    """
    return quest_best(answers, uuid.UUID(quest["id"])) >= quest["pass_score"]


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
    # Vòng TỐT NHẤT, không phải vòng đang chơi: qua cổng rồi mà bấm Làm lại để
    # nghe lại cuộc trò chuyện thì cả màn không được khoá lại sau lưng họ.
    return quest_ever_passed(answers, quest)


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
    round_no: int,
    truoc: list[QuestAnswer],
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

        # CHỈ CỘNG PHẦN HƠN so với những vòng trước của CHÍNH câu này.
        #
        # Không trừ đi thì chơi lại một nhiệm vụ dễ là một cái máy in điểm: làm
        # đúng, bấm Làm lại, làm đúng lần nữa, cộng đủ một lần nữa. Trừ hẳn về 0
        # thì ngược lại — sai ở vòng đầu rồi vòng sau làm đúng ngay lần thử đầu
        # sẽ không được thưởng gì cho việc đã khá lên.
        # CỘNG chứ không lấy max: mỗi dòng đã lưu chính là PHẦN HƠN của lần
        # ấy, nên tổng của chúng đúng bằng mức cao nhất câu này từng đạt. Lấy
        # max thì một câu gỡ điểm dần qua nhiều vòng (6 rồi +4) sẽ cộng lại phần
        # 4 ấy ở mọi vòng sau.
        da_co = sum(
            a.skill_pts_awarded
            for a in truoc
            if a.question_id == uuid.UUID(question["id"]) and a.quest_id == quest_id
        )
        skill_pts = max(0, skill_pts - da_co)

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
            round_no=round_no,
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


@dataclass(frozen=True)
class SubmitOutcome:
    """Mọi thứ chỗ gọi cần biết sau một lần nộp — KHÔNG phải hỏi lại lần nữa.

    Trước đây hàm này trả về đúng ba con số, nên giao diện phải gọi thêm
    `GET /runs/{id}` để biết tiến độ mới. Lượt gọi ấy kéo về cả `RunOut` — 66 KB,
    trong đó 62 KB là đề bài đã đóng băng và không bao giờ đổi trong một lượt
    chơi. Nhân với mỗi câu trả lời của mỗi học sinh suốt một buổi thì đó là phần
    lớn băng thông của cả hệ.

    Mấy trường dưới đây đều đã nằm sẵn trong tay hàm này lúc nó chấm xong; trả
    kèm ra không tốn thêm một truy vấn nào.
    """

    quest_done: bool
    attempts_left: int | None
    energy: int
    energy_granted: int
    #: Bài làm của CHÍNH người nộp, sau khi chấm. Đủ để dựng lại tiến độ.
    answers: list[QuestAnswer]
    player: StageRunPlayer | None
    #: Đã qua cổng NPC chưa, tính SAU lần nộp này.
    cleared: bool
    max_attempts: Any
    run_status: str


async def submit_quest(
    db: AsyncSession,
    user: User,
    run: StageRun,
    quest_id: uuid.UUID,
) -> SubmitOutcome:
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

    # VÒNG đang chơi. Mọi phép đếm dưới đây chỉ nhìn vòng này: bấm "Làm lại" là
    # mọi câu trở về trắng và lượt thử đếm lại từ đầu, dù vòng trước đã trả lời
    # đúng hết.
    player = await _player_row(db, run, user)
    vong = round_now(player, quest_id)
    trong_vong = same_round(answers, vong)

    for question in quest["questions"]:
        question_id = uuid.UUID(question["id"])
        mine = [
            a for a in trong_vong if a.question_id == question_id and a.quest_id == quest_id
        ]

        if any(a.is_correct for a in mine):
            continue
        if question_id not in drafts:
            continue

        attempt_no = len(mine) + 1
        if max_attempts is not None and not is_gate and attempt_no > int(max_attempts):
            continue

        await _grade_one(
            db,
            user,
            run,
            world,
            balance,
            quest_id,
            question,
            attempt_no,
            drafts[question_id],
            vong,
            answers,
        )

    await db.flush()

    answers = await _answers_of(db, run.id, user.id)
    # Vòng NÀY qua ải chưa — đây là thứ người canh giữ nói ngay lúc đó ("đạt" /
    # "chưa đạt"). Cái NHÃN của nhiệm vụ thì đọc vòng tốt nhất, ở `_run_out`.
    quest_done = quest_earned(same_round(answers, vong), quest_id) >= quest["pass_score"]
    player = await _sync_player_row(db, run, user, answers)

    if quest_done and quest["phase"] == QuestPhase.ADVISOR:
        await _grant_energy(db, run, player)

    if await _all_quests_done(db, run):
        await settle_run(db, run, RunStatus.WON)
    else:
        await db.commit()

    # `answers` đã là bài của RIÊNG người nộp — `_answers_of` lọc theo `user_id`.
    return SubmitOutcome(
        quest_done=quest_done,
        attempts_left=_attempts_left(quest, same_round(answers, vong), quest_id, max_attempts),
        energy=player.energy_remaining if player else 0,
        energy_granted=player.energy_granted if player else 0,
        answers=answers,
        player=player,
        cleared=advisor_cleared(run.snapshot_json, answers),
        max_attempts=max_attempts,
        run_status=run.status,
    )


async def retry_quest(
    db: AsyncSession, user: User, run: StageRun, quest_id: uuid.UUID
) -> int:
    """LÀM LẠI một nhiệm vụ từ đầu. Trả về số vòng mới.

    ## Xoá gì, giữ gì

    Xoá: bản NHÁP của mọi câu trong nhiệm vụ, và cả ĐOẠN CHAT với người canh
    giữ. Hai thứ đó là "đang làm dở", mà làm lại nghĩa là không còn gì dở nữa —
    giữ lại thì mở nhiệm vụ ra đã thấy đáp án cũ điền sẵn và một cuộc trò chuyện
    đã kết thúc.

    Giữ: `quest_answers`. Đó là NHẬT KÝ, không phải trạng thái. Xoá đi là mất
    chính cái làm cho việc chơi lại an toàn — báo cáo đọc vòng tốt nhất, và vòng
    tốt nhất có thể là vòng vừa bị bỏ lại.

    ## Vì sao không cấm khi đã hoàn thành

    Vì đó mới là lúc người ta muốn chơi lại nhất: đã qua rồi, giờ thử làm cho
    đẹp hơn. Qua rồi thì mãi mãi là đã qua (`quest_ever_passed`), nên lần chơi
    lại không có gì để mất.
    """
    if run.status != RunStatus.PLAYING:
        raise ConflictError(PlayError.RUN_NOT_PLAYING, status=run.status)

    quest = _quest_of(run.snapshot_json, quest_id)

    player = await _player_row(db, run, user)
    if player is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="player")

    vong = round_now(player, quest_id) + 1
    # Gán lại cả dict: SQLAlchemy không theo dõi phép sửa tại chỗ trên cột JSONB,
    # nên `rounds_json[key] = ...` là một thay đổi lặng lẽ không bao giờ được ghi.
    player.rounds_json = {**(player.rounds_json or {}), str(quest_id): vong}

    ids = [uuid.UUID(q["id"]) for q in quest["questions"]]
    if ids:
        await db.execute(
            delete(QuestDraft).where(
                QuestDraft.stage_run_id == run.id,
                QuestDraft.user_id == user.id,
                QuestDraft.question_id.in_(ids),
            )
        )
    await db.execute(
        delete(DialogueMessage).where(
            DialogueMessage.stage_run_id == run.id,
            DialogueMessage.user_id == user.id,
            DialogueMessage.quest_id == quest_id,
        )
    )

    await db.commit()
    logger.info("play.quest.retry", run=str(run.id), quest=str(quest_id), round=vong)
    return vong


def _phase_of(snapshot: dict[str, Any], question_id: uuid.UUID) -> str | None:
    """Câu hỏi này thuộc nhiệm vụ ở GIAI ĐOẠN nào — `advisor` hay `main`.

    Duyệt đề bài đã đóng băng chứ không hỏi lại bảng `quests`: giáo viên đổi
    giai đoạn giữa chừng thì lượt đang chơi vẫn tính theo đúng cái nó bắt đầu —
    cùng luật với mọi thứ khác của đề bài.
    """
    for quest in snapshot.get("quests", []):
        for item in quest.get("questions", []):
            if str(item.get("id")) == str(question_id):
                return quest.get("phase")
    return None


async def buy_hint(
    db: AsyncSession,
    user: User,
    run: StageRun,
    question_id: uuid.UUID,
    kind: str,
) -> tuple[str, int]:
    """Mua một gợi ý của câu hỏi. Trả về (đoạn chữ, năng lượng còn lại).

    Hai loại, MỘT giá — `balance.energyCost.hint`:

      - `translation` — bản dịch, nằm trong `answer_json`,
      - `transcript`  — lời thoại của câu nghe, tức `content.prompt`.

    Cả hai đều bị GẠN KHỎI đề bài trước khi gửi xuống máy học sinh (xem
    `build_snapshot`), nên đây là đường duy nhất đọc được chúng. Gửi kèm sẵn là
    phát không, và mở tab mạng của trình duyệt là thấy.

    Đọc từ `answer_key_json` của chính lượt chơi chứ không hỏi lại bảng
    `questions`: đề bài đã đóng băng, và giáo viên sửa giữa chừng thì lượt đang
    chơi vẫn phải đọc đúng cái nó bắt đầu — cùng luật với ảnh nền, tiếng, và bố
    cục hội thoại.

    **Trả một lần, xem mãi.** Mua rồi thì lần sau miễn phí: học sinh đóng bảng
    câu hỏi rồi mở lại mà bị trừ tiếp là một cái bẫy, và cái duy nhất họ học
    được từ nó là đừng bao giờ xin giúp nữa.
    """
    if run.status != RunStatus.PLAYING:
        raise ConflictError(PlayError.RUN_NOT_PLAYING, status=run.status)

    entry = (run.answer_key_json or {}).get("questions", {}).get(str(question_id))
    if entry is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="question")

    source = (
        (entry.get("answer") or {}).get("translation")
        if kind == "translation"
        else (entry.get("content") or {}).get("prompt")
    )
    text_vi = (source or "").strip()
    if not text_vi:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource=kind)

    player = await db.scalar(
        select(StageRunPlayer).where(
            StageRunPlayer.stage_run_id == run.id, StageRunPlayer.user_id == user.id
        )
    )
    if player is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="player")

    bought = list((player.hints_json or {}).get(str(question_id), []))
    if kind in bought:
        return text_vi, player.energy_remaining

    world = await db.scalar(
        select(World)
        .join(Chapter, Chapter.world_id == World.id)
        .join(Stage, Stage.chapter_id == Chapter.id)
        .where(Stage.id == run.stage_id)
    )
    price = int(read_balance(world.balance_json if world else None)["energyCost"]["hint"])

    # Nhiệm vụ NPC: MIỄN PHÍ.
    #
    # Đó là màn khởi động, và năng lượng chỉ được cấp SAU KHI qua nó — nên ở đó
    # học sinh luôn có 0. Tính tiền là khoá cả hai cái nút đúng chỗ người ta cần
    # chúng nhất, mà lại không cho họ đường nào kiếm ra tiền để mở.
    #
    # Chặn ở SERVER chứ không chỉ ở giao diện: giá là một luật chơi, và một luật
    # chơi chỉ nằm ở giao diện thì gọi thẳng API là lách được.
    if _phase_of(run.snapshot_json, question_id) == QuestPhase.ADVISOR:
        price = 0

    if player.energy_remaining < price:
        raise ConflictError(
            PlayError.NOT_ENOUGH_ENERGY, need=price, have=player.energy_remaining
        )

    player.energy_remaining -= price
    # Gán lại CẢ object: SQLAlchemy không theo dõi thay đổi bên trong một JSONB
    # đã nạp, nên sửa tại chỗ thì cú `commit` này ghi ra một dòng y như cũ —
    # và học sinh được dịch miễn phí mãi mãi mà không ai biết vì sao.
    player.hints_json = {
        **(player.hints_json or {}),
        str(question_id): [*bought, kind],
    }
    await db.commit()

    return text_vi, player.energy_remaining


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


async def _player_row(
    db: AsyncSession, run: StageRun, user: User
) -> StageRunPlayer | None:
    """Dòng cộng dồn của MỘT người trong MỘT lượt. `None` = người này không ở trong lượt."""
    return await db.scalar(
        select(StageRunPlayer).where(
            StageRunPlayer.stage_run_id == run.id, StageRunPlayer.user_id == user.id
        )
    )


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

    # VÒNG TỐT NHẤT của mỗi nhiệm vụ, không phải tổng mọi dòng đúng: chơi lại
    # một nhiệm vụ năm lần không có nghĩa được điểm gấp năm, mà chơi lại kém hơn
    # cũng không lấy mất con số đã giành được.
    player.score = sum(
        quest_best(answers, uuid.UUID(quest["id"])) for quest in run.snapshot_json["quests"]
    )
    player.quests_completed = sum(
        1 for quest in run.snapshot_json["quests"] if quest_ever_passed(answers, quest)
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
            quest_ever_passed(rows, quest) for rows in by_user.values()
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


def thoi_luong_choi(run: StageRun, now: datetime) -> int:
    """THỜI GIAN LÀM BÀI của một lượt, tính bằng giây, ĐÃ CHẶN TRẦN.

    `now - started_at` là khoảng cách tới lúc CHỐT, không phải thời gian chơi.
    Hai thứ ấy chỉ bằng nhau khi lượt được chốt đúng lúc nó kết thúc — mà nhánh
    hết giờ thì hầu như không bao giờ: đồng hồ cạn ở giây thứ 300, còn lời chốt
    đến từ request kế tiếp của người chơi, hoặc từ vòng quét dọn. Chậm mười tám
    giây thì báo cáo ghi "5:18" cho một màn dài 5 phút; chậm mười bảy ngày (tab
    bị bỏ quên) thì ghi 17 ngày. Con số đầu làm người đọc ngờ ngợ, con số sau
    làm họ thôi tin cả bảng.

    Một hàm RIÊNG, không viết thẳng vào `settle_run`: đây là một luật chơi
    ("không ai chơi một màn lâu hơn giới hạn giờ của màn"), và luật thì phải
    gọi được tên và thử được bằng test.
    """
    troi = int((now - run.started_at).total_seconds())
    tran = _gioi_han_giay(run)
    return max(0, min(troi, tran) if tran is not None else troi)


def _gioi_han_giay(run: StageRun) -> int | None:
    """Giới hạn giờ của màn, đọc từ đề bài đã đóng băng của chính lượt này.

    `None` khi ảnh chụp thiếu trường ấy — lượt cũ từ trước khi có nó, hay dữ
    liệu vá tay. Khi đó KHÔNG chặn trần: thà ghi một con số thô còn hơn ghi một
    con số bịa.
    """
    try:
        return int(run.snapshot_json["stage"]["time_limit_seconds"])
    except (KeyError, TypeError, ValueError):
        return None


async def settle_run(db: AsyncSession, run: StageRun, status: str) -> None:
    """Chốt lượt chơi: thắng/thua, thưởng, trao mảnh bản đồ.

    Thắng thì mọi thành viên nhận mảnh; thua thì **vẫn giữ điểm chiến lực cơ
    bản** đã kiếm được, chỉ mất phần thưởng và mảnh (§6).
    """
    if run.status != RunStatus.PLAYING:
        return

    now = datetime.now(UTC)

    run.duration_seconds = thoi_luong_choi(run, now)

    # `ended_at` đi theo, không để lệch: hai trường cùng nói một việc mà trừ
    # nhau ra số thứ ba thì chỗ nào đọc `ended_at - started_at` cũng sẽ mâu
    # thuẫn với `duration_seconds`. Với lượt hết giờ, mốc ĐÚNG là lúc đồng hồ
    # cạn, không phải lúc vòng quét đi ngang.
    run.ended_at = run.started_at + timedelta(seconds=run.duration_seconds)

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


# --------------------------------------------------------------------------
# NHẬT KÝ HỘI THOẠI
# --------------------------------------------------------------------------


async def dialogue_messages(
    db: AsyncSession, user: User, run: StageRun, quest_id: uuid.UUID
) -> list[DialogueMessage]:
    """Đoạn chat của MỘT học sinh với người canh giữ của MỘT nhiệm vụ."""
    rows = await db.scalars(
        select(DialogueMessage)
        .where(
            DialogueMessage.stage_run_id == run.id,
            DialogueMessage.user_id == user.id,
            DialogueMessage.quest_id == quest_id,
        )
        .order_by(DialogueMessage.seq)
    )
    return list(rows)


async def append_dialogue(
    db: AsyncSession,
    user: User,
    run: StageRun,
    quest_id: uuid.UUID,
    lines: list[dict[str, Any]],
) -> list[DialogueMessage]:
    """Ghi thêm mấy câu vào cuối đoạn chat, và trả về CẢ đoạn.

    ## Số thứ tự do SERVER đánh

    Client biết mình vừa nói câu thứ mấy, nhưng hai tab cùng mở một lượt chơi
    thì cả hai cùng tưởng mình là câu thứ năm. Đếm ở đây, dưới một ràng buộc
    duy nhất, thì hai tab ra hai số khác nhau.

    ## Gọi lại KHÔNG sinh thêm dòng

    Mạng chập chờn thì giao diện gửi lại cùng một mẻ. Câu nào đã có đúng nội
    dung ấy ở cuối đoạn thì bỏ qua — không phải một phép chống trùng hoàn hảo,
    nhưng đủ cho thứ duy nhất thật sự xảy ra: gửi lại nguyên mẻ vừa gửi.

    Trả về cả đoạn chứ không chỉ phần vừa thêm: giao diện vẽ một danh sách, và
    nhận về đúng thứ sắp vẽ thì không phải tự ghép hai nguồn lại.
    """
    have = await dialogue_messages(db, user, run, quest_id)
    seq = have[-1].seq + 1 if have else 0

    # MỘT câu hỏi = MỘT tin nhắn đề bài, và nó được SỬA chứ không nhân đôi.
    #
    # Đề bài đổi chữ giữa chừng là chuyện thường: câu nghe mở đầu bằng một bong
    # bóng chỉ có tiếng, rồi học sinh bấm Lời thoại và chữ hiện ra, rồi mua bản
    # dịch và có thêm một dòng phụ. Coi mỗi lần đổi là một tin mới thì cùng một
    # câu hỏi mọc ra hai ba bong bóng, mỗi cái mang một nửa nội dung và một
    # trình phát của cùng một tệp tiếng. Đã nhìn thấy thật.
    #
    # Chỉ `prompt` mới gộp. Lời phán thì lặp lại hợp lệ — mỗi lần thử một câu.
    theo_cau = {
        m.question_id: m
        for m in have
        if m.kind == DialogueKind.PROMPT and m.question_id is not None
    }

    def khoa(role: Any, kind: Any, text: Any, question_id: Any) -> tuple:
        return (role, kind, text or "", str(question_id) if question_id else None)

    # Chỉ so với tin NGAY TRƯỚC, không so với tám tin gần nhất.
    #
    # Phép chống trùng này chỉ để chặn đúng MỘT chuyện: mạng chập chờn và giao
    # diện gửi lại nguyên mẻ vừa gửi. Lần gửi lại luôn nằm sát ngay sau.
    #
    # So với tám tin thì nó nuốt cả những câu TRÙNG HỢP LÀ GIỐNG NHAU: lời khen
    # bốc trong đúng năm câu, nên trả lời đúng hai câu liền nhau là có khoảng
    # một phần năm cơ hội nghe lại đúng câu ấy — và câu thứ hai bị coi là bản
    # sao rồi biến mất. Trên màn hình nó hiện ra rồi mất ngay khi server trả về
    # bản đã gộp: học sinh thấy nộp bài xong không ai nói gì.
    cuoi = have[-1] if have else None
    truoc = khoa(cuoi.role, cuoi.kind, cuoi.text, cuoi.question_id) if cuoi else None

    for line in lines:
        question_id = line.get("question_id")

        if line.get("kind") == DialogueKind.PROMPT and question_id is not None:
            cu = theo_cau.get(uuid.UUID(str(question_id)))
            if cu is not None:
                cu.text = line.get("text") or ""
                cu.aside = line.get("aside")
                cu.audio_url = line.get("audio_url") or cu.audio_url
                continue

        key = khoa(line.get("role"), line.get("kind"), line.get("text"), question_id)
        if key == truoc:
            continue
        truoc = key
        db.add(
            DialogueMessage(
                stage_run_id=run.id,
                user_id=user.id,
                quest_id=quest_id,
                seq=seq,
                role=line["role"],
                kind=line["kind"],
                text=line.get("text") or "",
                aside=line.get("aside"),
                tone=line.get("tone"),
                question_id=question_id,
                audio_url=line.get("audio_url"),
            )
        )
        seq += 1

    await db.commit()
    return await dialogue_messages(db, user, run, quest_id)

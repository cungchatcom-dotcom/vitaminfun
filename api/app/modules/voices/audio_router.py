"""Sinh tiếng đọc cho câu hỏi — ba mức, cùng một luật.

  - `/questions/{id}/audio` — một câu, dùng ở popup xem câu hỏi.
  - `/quests/{id}/audio`    — cả nhiệm vụ, dùng ở popup sửa nhiệm vụ.
  - `/stages/{id}/audio`    — cả màn, dùng ở trình thiết kế màn chơi.

Mỗi mức có `GET` xem TÌNH TRẠNG và `POST` để SINH. `GET` là phần bắt buộc: giao
diện phải biết trước "câu này đã có tiếng chưa" để còn hỏi *"đã có rồi, tạo lại
không?"* — hỏi sau khi đã gọi API là hỏi sau khi đã tiêu tiền.

Cả router yêu cầu vai trò giáo viên hoặc admin.
"""

from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from app.core.deps import CurrentUserDep, DbDep, require_role
from app.core.errors import ConflictError, ErrorCode, NotFoundError
from app.db.models import (
    AudioTarget,
    Chapter,
    Quest,
    QuestPhase,
    Question,
    Stage,
    UserRole,
    Voice,
    World,
)
from app.modules.voices import tts
from app.modules.voices.audio_schemas import (
    AudioGenerateIn,
    AudioReportOut,
    QuestAudioStatusOut,
    QuestionAudioOut,
    QuestionAudioStatusOut,
    StageAudioStatusOut,
    LockedLineOut,
    LockedLinesOut,
    VerdictLineOut,
    VerdictLinesOut,
)

router = APIRouter(
    tags=["question-audio"],
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)


async def _voices_for(db: DbDep, character_ids: list[uuid.UUID]) -> list[Voice]:
    """Giọng của các nhân vật được chọn, bỏ qua ai chưa gán giọng."""
    out: list[Voice] = []
    for character_id in character_ids:
        voice = await tts.voice_of_character(db, character_id)
        if voice is not None:
            out.append(voice)
    return out


async def _question_status(
    db: DbDep,
    question: Question,
    prompt_voice: Voice | None,
    option_voices: list[Voice],
) -> QuestionAudioStatusOut:
    """Câu này đã có tiếng chưa — tính riêng cho đề bài và cho phương án."""
    voice_ids = [v.id for v in ([prompt_voice] if prompt_voice else []) + option_voices]
    have = await tts.existing_audio(db, [question.id], voice_ids)
    options = tts.option_texts(question)

    urls = await tts.media_urls(db, [row.media_id for row in have.values()])

    prompt_row = (
        have.get((question.id, prompt_voice.id, AudioTarget.PROMPT, ""))
        if prompt_voice
        else None
    )

    # "Đã đủ" nghĩa là MỌI phương án của MỌI giọng đã chọn đều có tiếng. Thiếu
    # một cái là chưa đủ — học sinh chọn đúng nhân vật đó sẽ gặp một khoảng im.
    wanted = len(options) * len(option_voices)
    ready = sum(
        1
        for voice in option_voices
        for key in options
        if (question.id, voice.id, AudioTarget.OPTION, key) in have
    )

    return QuestionAudioStatusOut(
        question_id=question.id,
        type=question.type,
        prompt=tts.prompt_text(question),
        prompt_ready=prompt_row is not None,
        prompt_url=urls.get(prompt_row.media_id) if prompt_row else None,
        option_count=len(options),
        options_wanted=wanted,
        options_ready=ready,
    )


# --------------------------------------------------------------------------
# Một câu hỏi
# --------------------------------------------------------------------------


@router.get(
    "/questions/{question_id}/audio",
    response_model=list[QuestionAudioOut],
    summary="Tiếng đã sinh cho một câu hỏi",
)
async def list_question_audio(
    question_id: uuid.UUID,
    db: DbDep,
    voice_id: uuid.UUID | None = Query(default=None),
) -> list[QuestionAudioOut]:
    """Mọi bản thu của câu này, hoặc chỉ của MỘT giọng.

    Không lọc = trả cả kho: popup xem câu hỏi cần thấy "câu này đã có tiếng của
    những giọng nào", vì đó chính là thứ quyết định lắp nó vào màn khác có phải
    sinh lại hay không.
    """
    query = select(tts.QuestionAudio).where(tts.QuestionAudio.question_id == question_id)
    if voice_id:
        query = query.where(tts.QuestionAudio.voice_id == voice_id)

    rows = list(await db.scalars(query))
    urls = await tts.media_urls(db, [r.media_id for r in rows])
    names = {
        v.id: v.name
        for v in await db.scalars(select(Voice).where(Voice.id.in_({r.voice_id for r in rows})))
    } if rows else {}

    return [
        QuestionAudioOut(
            id=r.id,
            question_id=r.question_id,
            voice_id=r.voice_id,
            voice_name=names.get(r.voice_id),
            target=r.target,
            option_key=r.option_key or None,
            media_id=r.media_id,
            url=urls.get(r.media_id),
        )
        for r in rows
    ]


@router.post(
    "/questions/{question_id}/audio",
    response_model=AudioReportOut,
    summary="Sinh tiếng cho một câu hỏi",
)
async def generate_question_audio(
    question_id: uuid.UUID,
    payload: AudioGenerateIn,
    current: CurrentUserDep,
    db: DbDep,
) -> AudioReportOut:
    """Sinh tiếng cho MỘT câu, bằng những giọng được chỉ ra.

    Ở mức này giọng phải nói rõ — không có nhiệm vụ nào quanh đây để suy ra
    người canh giữ là ai.
    """
    question = await db.scalar(select(Question).where(Question.id == question_id))
    if question is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="question")

    voices = await _voices_for(db, payload.character_ids)
    if not voices:
        tts.require_voice(None, "question")

    report = tts.AudioReport()
    for voice in voices:
        report.merge(
            await tts.generate_for_question(
                db,
                question=question,
                voice=voice,
                target=payload.target,
                overwrite=payload.overwrite,
                user_id=current.id,
            )
        )
    return AudioReportOut(**vars(report))


# --------------------------------------------------------------------------
# Một nhiệm vụ
# --------------------------------------------------------------------------


async def _world_of_quest(db: DbDep, quest: Quest) -> World | None:
    """World chứa nhiệm vụ này — đi qua màn rồi chương.

    Lời phán thuộc về world, mà nút bấm thì ở nhiệm vụ; chỗ nào cũng phải đi
    đúng đường này nên viết một lần.
    """
    row = await db.execute(
        select(World)
        .join(Chapter, Chapter.world_id == World.id)
        .join(Stage, Stage.chapter_id == Chapter.id)
        .where(Stage.id == quest.stage_id)
    )
    return row.scalars().first()


async def _quest_status(
    db: DbDep, quest: Quest, option_voices: list[Voice]
) -> QuestAudioStatusOut:
    npc_voice = await tts.voice_of_character(db, quest.npc_character_id)
    questions = await tts.questions_of_quest(db, quest.id)

    # LỜI PHÁN: bao nhiêu câu, và giọng này đã đọc được mấy câu.
    world = await _world_of_quest(db, quest)
    lines = tts.verdict_lines(world) if world else []
    ready = (
        len(await tts.existing_lines(db, npc_voice.id, lines)) if npc_voice and lines else 0
    )

    # Lời chia tay chỉ gắn vào nhiệm vụ NPC. Hiện nó ở mọi nhiệm vụ thì cùng một
    # đoạn tiếng xuất hiện bảy lần trong một màn bảy nhiệm vụ, và người dựng
    # phải tự đoán bấm ở đâu mới đúng.
    outro_text: str | None = None
    outro_url: str | None = None
    outro_ready = False
    if quest.phase == QuestPhase.ADVISOR:
        stage = await db.scalar(select(Stage).where(Stage.id == quest.stage_id))
        if stage is not None:
            outro_text = tts.outro_text(stage) or None
            outro_ready = stage.advisor_outro_audio_media_id is not None
            urls = await tts.media_urls(db, [stage.advisor_outro_audio_media_id])
            outro_url = urls.get(stage.advisor_outro_audio_media_id)

    return QuestAudioStatusOut(
        quest_id=quest.id,
        name_i18n=quest.name_i18n or {},
        npc_character_id=quest.npc_character_id,
        voice_id=npc_voice.id if npc_voice else None,
        voice_name=npc_voice.name if npc_voice else None,
        questions=[await _question_status(db, q, npc_voice, option_voices) for q in questions],
        outro_text=outro_text,
        outro_ready=outro_ready,
        outro_url=outro_url,
        verdict_total=len(lines),
        verdict_ready=ready,
    )


@router.get(
    "/quests/{quest_id}/audio",
    response_model=QuestAudioStatusOut,
    summary="Tình trạng tiếng đọc của một nhiệm vụ",
)
async def quest_audio_status(
    quest_id: uuid.UUID,
    db: DbDep,
    character_ids: list[uuid.UUID] = Query(default=[]),
) -> QuestAudioStatusOut:
    quest = await db.scalar(select(Quest).where(Quest.id == quest_id))
    if quest is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="quest")
    return await _quest_status(db, quest, await _voices_for(db, character_ids))


@router.post(
    "/quests/{quest_id}/audio",
    response_model=AudioReportOut,
    summary="Sinh tiếng cho cả nhiệm vụ",
)
async def generate_quest_audio(
    quest_id: uuid.UUID,
    payload: AudioGenerateIn,
    current: CurrentUserDep,
    db: DbDep,
) -> AudioReportOut:
    """Sinh cho mọi câu của nhiệm vụ.

    ĐỀ BÀI dùng giọng của người canh giữ — không ai chọn, nó đã được chọn lúc
    gán NPC vào nhiệm vụ. PHƯƠNG ÁN thì dùng giọng của những nhân vật người dựng
    chỉ ra, và chỉ những câu CÓ phương án mới sinh.
    """
    quest = await db.scalar(select(Quest).where(Quest.id == quest_id))
    if quest is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="quest")

    report = await _run_quest(db, quest, payload, current.id, strict=True)
    return AudioReportOut(**vars(report))


@router.post(
    "/quests/{quest_id}/outro-audio",
    response_model=AudioReportOut,
    summary="Sinh tiếng cho lời chia tay của màn",
)
async def generate_outro_audio(
    quest_id: uuid.UUID,
    payload: AudioGenerateIn,
    current: CurrentUserDep,
    db: DbDep,
) -> AudioReportOut:
    """Đọc lời chia tay bằng giọng của NGƯỜI CANH GIỮ nhiệm vụ này.

    Vào qua nhiệm vụ chứ không qua màn, dù lời chia tay là của MÀN: giọng đọc
    nằm ở người canh giữ, mà người canh giữ nằm ở nhiệm vụ. Bắt màn tự đi tìm
    xem nhiệm vụ nào có NPC là chép lại một luật đã có chỗ của nó.

    Chỉ nhiệm vụ NPC. Nhiệm vụ thường cũng gán được người canh giữ, nhưng lời
    chia tay chỉ vang lên đúng một lần trong màn — ở cổng vào.
    """
    quest = await db.scalar(select(Quest).where(Quest.id == quest_id))
    if quest is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="quest")
    if quest.phase != QuestPhase.ADVISOR:
        raise ConflictError(ErrorCode.CONFLICT, field="phase", target="advisor")

    stage = await db.scalar(select(Stage).where(Stage.id == quest.stage_id))
    if stage is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="stage")

    label = (quest.name_i18n or {}).get("en") or quest.quest_object_key
    voice = tts.require_voice(await tts.voice_of_character(db, quest.npc_character_id), label)

    report = await tts.generate_outro(
        db, stage=stage, voice=voice, overwrite=payload.overwrite, user_id=current.id
    )
    return AudioReportOut(**vars(report))


@router.post(
    "/quests/{quest_id}/verdict-audio",
    response_model=AudioReportOut,
    summary="Sinh tiếng cho bộ câu phán của world",
)
async def generate_verdict_audio(
    quest_id: uuid.UUID,
    payload: AudioGenerateIn,
    current: CurrentUserDep,
    db: DbDep,
) -> AudioReportOut:
    """Đọc bộ câu khen/chê của WORLD bằng giọng người canh giữ NHIỆM VỤ này.

    Chữ là của world — cả thế giới ấy nói cùng một giọng điệu. Tiếng thì của
    từng người canh giữ, vì mỗi nhiệm vụ một người.

    Bản thu khoá theo `(giọng, nội dung câu)`, nên nhiệm vụ thứ hai chọn người
    canh giữ khác mà **cùng giọng** thì bấm vào đây báo "đã có sẵn" hết và không
    tốn thêm một xu nào. Đổi chữ một câu thì chỉ câu ấy cần thu lại — băm đổi
    theo chữ.
    """
    quest = await db.scalar(select(Quest).where(Quest.id == quest_id))
    if quest is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="quest")

    world = await _world_of_quest(db, quest)
    if world is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="world")

    label = (quest.name_i18n or {}).get("en") or quest.quest_object_key
    voice = tts.require_voice(await tts.voice_of_character(db, quest.npc_character_id), label)

    # Người dựng chỉ ra câu nào thì CHỈ những câu ấy — nhưng vẫn phải là câu
    # của world này. Nhận bừa chuỗi client gửi lên là mở đường thu bất cứ gì
    # bằng giọng của người khác.
    ca_bo = tts.verdict_lines(world)
    chon = [text for text in ca_bo if text in set(payload.lines)] if payload.lines else ca_bo

    report = await tts.generate_lines(
        db,
        voice=voice,
        texts=chon,
        overwrite=payload.overwrite,
        user_id=current.id,
    )
    return AudioReportOut(**vars(report))


@router.post(
    "/quests/{quest_id}/locked-audio",
    response_model=AudioReportOut,
    summary="Sinh tiếng cho câu khoá của nhiệm vụ",
)
async def generate_locked_audio(
    quest_id: uuid.UUID,
    payload: AudioGenerateIn,
    current: CurrentUserDep,
    db: DbDep,
) -> AudioReportOut:
    """Đọc câu khoá của nhiệm vụ này bằng giọng NGƯỜI CANH GIỮ CỦA CHÍNH NÓ.

    MỘT NHIỆM VỤ, MỘT NGƯỜI, MỘT GIỌNG. Đề bài, phương án, lời khen chê, lời
    chia tay và câu khoá — tất cả đều là `quest.npc_character_id`. Không có
    ngoại lệ nào, vì mọi ngoại lệ đều dẫn tới cùng một chỗ: mặt hiện trên màn
    hình là một người, tiếng vang lên là người khác.

    Bản trước lấy giọng của nhiệm vụ NPC (người gác cổng của MÀN), với lý do
    "hầu hết nhiệm vụ thường không gán ai nên lấy giọng của chính chúng thì phần
    lớn cánh cửa sẽ câm". Lý do ấy chữa triệu chứng sai chỗ: cánh cửa chưa gán
    người thì đúng là chưa có ai để nói, và câu trả lời là gán người cho nó —
    không phải mượn giọng người bên cạnh.

    Chữ lấy THẲNG từ cột của nhiệm vụ, không nhận chuỗi client gửi lên: nhận bừa
    là mở đường thu bất cứ gì bằng giọng của người khác.
    """
    quest = await db.scalar(select(Quest).where(Quest.id == quest_id))
    if quest is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="quest")

    label = (quest.name_i18n or {}).get("en") or quest.quest_object_key
    voice = tts.require_voice(
        await tts.voice_of_character(db, quest.npc_character_id), label
    )

    texts = [t.strip() for t in (quest.locked_message_i18n or {}).values() if t and t.strip()]
    report = await tts.generate_lines(
        db,
        voice=voice,
        texts=texts,
        overwrite=payload.overwrite,
        user_id=current.id,
    )
    return AudioReportOut(**vars(report))


@router.get(
    "/quests/{quest_id}/verdict-lines",
    response_model=VerdictLinesOut,
    summary="Các câu phán và tiếng đọc của chúng",
)
async def read_verdict_lines(
    quest_id: uuid.UUID,
    db: DbDep,
) -> VerdictLinesOut:
    """Cả bộ câu phán của world, kèm URL tiếng theo giọng người canh giữ này.

    Có `url` = nghe thử được ngay. `None` = chưa thu bằng giọng này — và đó
    chính là thứ giao diện cần để đánh dấu câu nào còn thiếu.
    """
    quest = await db.scalar(select(Quest).where(Quest.id == quest_id))
    if quest is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="quest")

    world = await _world_of_quest(db, quest)
    voice = await tts.voice_of_character(db, quest.npc_character_id)
    groups = (world.verdict_json or {}) if world else {}

    texts = tts.verdict_lines(world) if world else []
    urls = await tts.line_urls(db, voice.id if voice else None, texts)

    out: list[VerdictLineOut] = []
    for group in tts.VERDICT_GROUPS:
        for line in groups.get(group) or []:
            text = (line or "").strip()
            if text:
                out.append(VerdictLineOut(group=group, text=text, url=urls.get(text)))

    return VerdictLinesOut(
        quest_id=quest_id, voice_name=voice.name if voice else None, lines=out
    )


@router.get(
    "/quests/{quest_id}/locked-line",
    response_model=LockedLinesOut,
    summary="Câu khoá và tiếng đọc của nó",
)
async def read_locked_line(quest_id: uuid.UUID, db: DbDep) -> LockedLinesOut:
    """Câu khoá của nhiệm vụ, kèm URL tiếng theo giọng người canh giữ nó.

    Sinh đôi với `read_verdict_lines`, và cùng một lý do: người dựng vừa bấm
    thu xong thì việc tiếp theo họ muốn làm là NGHE, ngay tại chỗ. Không có
    đường nghe thì cách duy nhất để biết bản thu ra sao là vào màn chơi, đi tới
    đúng cánh cửa đang khoá.

    `url = None` = chưa thu bằng giọng này — chữ vừa sửa cũng rơi vào đây, vì
    bản thu khoá theo cặp (giọng, nội dung câu).
    """
    quest = await db.scalar(select(Quest).where(Quest.id == quest_id))
    if quest is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="quest")

    voice = await tts.voice_of_character(db, quest.npc_character_id)
    khoa = quest.locked_message_i18n or {}
    texts = [t.strip() for t in khoa.values() if t and t.strip()]
    urls = await tts.line_urls(db, voice.id if voice else None, texts)

    return LockedLinesOut(
        quest_id=quest_id,
        voice_name=voice.name if voice else None,
        lines=[
            LockedLineOut(locale=loc, text=text.strip(), url=urls.get(text.strip()))
            for loc, text in khoa.items()
            if text and text.strip()
        ],
    )


async def _run_quest(
    db: DbDep,
    quest: Quest,
    payload: AudioGenerateIn,
    user_id: uuid.UUID,
    *,
    strict: bool,
) -> tts.AudioReport:
    """Sinh cho một nhiệm vụ. `strict` = thiếu giọng thì BÁO LỖI, không bỏ qua.

    Bấm vào đúng một nhiệm vụ mà nó im lặng không làm gì là tệ; nhưng chạy cả
    màn thì bỏ qua nhiệm vụ thiếu giọng lại đúng — người dựng muốn sinh hết
    những gì sinh được, rồi mới đi vá chỗ thiếu.
    """
    report = tts.AudioReport()
    label = (quest.name_i18n or {}).get("en") or quest.quest_object_key

    if payload.target == AudioTarget.PROMPT:
        voice = await tts.voice_of_character(db, quest.npc_character_id)
        if voice is None:
            if strict:
                tts.require_voice(None, label)
            report.missing_voice.append(label)
            return report
        voices = [voice]
    else:
        voices = await _voices_for(db, payload.character_ids)
        if not voices:
            tts.require_voice(None, "characters")

    questions = await tts.questions_of_quest(db, quest.id)
    for question in questions:
        for voice in voices:
            report.merge(
                await tts.generate_for_question(
                    db,
                    question=question,
                    voice=voice,
                    target=payload.target,
                    overwrite=payload.overwrite,
                    user_id=user_id,
                )
            )
    return report


# --------------------------------------------------------------------------
# Cả màn chơi
# --------------------------------------------------------------------------


@router.get(
    "/stages/{stage_id}/audio",
    response_model=StageAudioStatusOut,
    summary="Tình trạng tiếng đọc của cả màn",
)
async def stage_audio_status(
    stage_id: uuid.UUID,
    db: DbDep,
    character_ids: list[uuid.UUID] = Query(default=[]),
) -> StageAudioStatusOut:
    stage = await db.scalar(select(Stage).where(Stage.id == stage_id))
    if stage is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="stage")

    option_voices = await _voices_for(db, character_ids)
    quests = list(
        await db.scalars(select(Quest).where(Quest.stage_id == stage_id).order_by(Quest.order_index))
    )
    return StageAudioStatusOut(
        stage_id=stage.id,
        quests=[await _quest_status(db, q, option_voices) for q in quests],
    )


@router.post(
    "/stages/{stage_id}/audio",
    response_model=AudioReportOut,
    summary="Sinh tiếng cho cả màn",
)
async def generate_stage_audio(
    stage_id: uuid.UUID,
    payload: AudioGenerateIn,
    current: CurrentUserDep,
    db: DbDep,
) -> AudioReportOut:
    """Chạy hết mọi nhiệm vụ của màn.

    Nhiệm vụ nào chưa có giọng thì BỎ QUA và kể tên trong `missing_voice` —
    không dừng cả mẻ vì một nhiệm vụ thiếu. Sinh được bao nhiêu thì sinh, rồi
    người dựng đi vá chỗ còn lại.
    """
    stage = await db.scalar(select(Stage).where(Stage.id == stage_id))
    if stage is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="stage")

    quests = list(
        await db.scalars(select(Quest).where(Quest.stage_id == stage_id).order_by(Quest.order_index))
    )
    report = tts.AudioReport()
    for quest in quests:
        report.merge(await _run_quest(db, quest, payload, current.id, strict=False))
    return AudioReportOut(**vars(report))


#: Dùng lại ở chỗ khác nếu cần đọc tên loại.
TARGETS: tuple[str, ...] = (AudioTarget.PROMPT, AudioTarget.OPTION)
AudioTargetLiteral = Literal["prompt", "option"]

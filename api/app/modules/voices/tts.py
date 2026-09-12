"""Sinh TIẾNG ĐỌC cho câu hỏi, và nhớ lại thứ đã sinh.

Ba mức, cùng một phép: một câu hỏi → một nhiệm vụ → cả màn chơi. Mức trên chỉ là
vòng lặp quanh mức dưới, nên luật "cùng giọng thì dùng lại" viết đúng một lần.

## Cái gì được đọc

  - `prompt` — đề bài, người CANH GIỮ nói. Giọng lấy từ NPC của nhiệm vụ.
  - `option` — phương án trả lời, nhân vật HỌC SINH nói. Giọng lấy từ nhân vật
    người dựng chọn, và họ chọn được NHIỀU: học sinh nào cũng có thể vào màn
    bằng nhân vật của mình, nên mỗi giọng cần một bản.

Chỉ câu CÓ PHƯƠNG ÁN mới sinh audio cho phương án. Câu gõ chữ thì không có gì
để đọc sẵn — thứ học sinh nói ra là thứ họ tự nghĩ.
"""

from __future__ import annotations

import asyncio
import re
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import ConflictError, ErrorCode, NotFoundError
from app.core.logging import logger
from app.db.models import (
    AudioTarget,
    Character,
    MediaAsset,
    Question,
    QuestionAudio,
    QuestQuestion,
    Voice,
    VoiceLine,
    line_hash,
)
from app.modules.media import service as media_service
from app.modules.voices import beep
from app.modules.voices.providers import PROVIDERS

#: Ô TRỐNG, hai cách viết đều gặp trong nội dung thật:
#:
#:   - `{{1}}`, `{{2}}`… — mã ô của câu GAP_FILL, do trình soạn sinh ra.
#:   - `___` — người soạn gõ tay thẳng vào lời đề, phổ biến ở câu trắc nghiệm
#:     dạng điền khuyết. Đây mới là cách đông hơn trong kho hiện tại.
#:
#: Bỏ sót cách thứ hai thì không có lỗi nào ném ra: câu vẫn sinh được audio,
#: chỉ là máy đọc nguyên mấy cái gạch dưới thành ra một tràng vô nghĩa. Đúng
#: kiểu hỏng chỉ phát hiện được bằng cách NGHE.
GAP = re.compile(r"\{\{\s*\d+\s*\}\}|_{2,}")

#: Ô trống hiện thành gì trên MÀN HÌNH người dựng. Không phải chữ, mà là một
#: vệt trống — cái người dựng cần thấy là "chỗ này sẽ là một tiếng bíp", và một
#: vệt nói được điều đó trong mọi thứ tiếng.
GAP_MARK = "▁▁▁"


@dataclass
class AudioReport:
    """Sinh được gì, bỏ qua gì, và vì sao."""

    generated: int = 0
    #: Đã có sẵn nên không sinh lại (khi `overwrite=False`).
    skipped: int = 0
    #: Nhiệm vụ không sinh được vì chưa có giọng — kèm tên để giao diện nói ra.
    missing_voice: list[str] = field(default_factory=list)

    #: Số câu GỌI HỎNG. Những câu còn lại vẫn được lưu.
    #:
    #: Đếm riêng, không gộp vào `skipped`: "đã có sẵn" là tin tốt, "hỏng" là
    #: việc còn phải làm. Gộp lại thì người dựng nhìn một con số và không biết
    #: mình đã xong hay chưa.
    failed: int = 0
    #: Vài dòng lý do đầu tiên, để giao diện nói được HỎNG VÌ SAO.
    errors: list[str] = field(default_factory=list)

    def merge(self, other: AudioReport) -> None:
        self.generated += other.generated
        self.skipped += other.skipped
        self.missing_voice.extend(other.missing_voice)
        self.failed += other.failed
        self.errors.extend(other.errors)


def prompt_raw(question: Question) -> str:
    """Lời đề nguyên văn, CÒN nguyên các ô trống.

    `template` là đường lùi cho câu điền khuyết — dạng đó không có `prompt`
    riêng, chính câu đang khuyết là lời đề.
    """
    content = question.content_json or {}
    return (content.get("prompt") or content.get("template") or "").strip()


def prompt_text(question: Question) -> str:
    """Lời đề để NGƯỜI DỰNG nhìn: ô trống thành một vệt."""
    return GAP.sub(GAP_MARK, prompt_raw(question)).strip()


def segments(text: str) -> list[str | None]:
    """Cắt lời đề thành khúc chữ và chỗ khuyết. `None` = một tiếng bíp.

    Trả về xen kẽ nhưng không đảm bảo xen kẽ đều: câu mở đầu bằng ô trống, hay
    hai ô trống dính nhau, đều hợp lệ và đều phải ra đúng số tiếng bíp.

    Khúc chỉ có DẤU CÂU thì bỏ — `"… and {{2}}."` cắt ra một khúc cuối là đúng
    một dấu chấm, mà gửi một dấu chấm sang nhà cung cấp là trả tiền cho một
    tiếng thở. Dấu chấm cuối câu vốn không phát ra thành tiếng.
    """
    out: list[str | None] = []
    cursor = 0
    for match in GAP.finditer(text):
        _push(out, text[cursor : match.start()])
        out.append(None)
        cursor = match.end()
    _push(out, text[cursor:])
    return out


def _push(out: list[str | None], chunk: str) -> None:
    """Thêm một khúc chữ, nếu trong đó có gì để đọc."""
    chunk = chunk.strip()
    if chunk and any(ch.isalnum() for ch in chunk):
        out.append(chunk)


def option_texts(question: Question) -> dict[str, str]:
    """Các phương án đọc được, khoá là `option_key`.

    Trắc nghiệm thì khoá là mã phương án. Câu điền khuyết có nhiều ô, mỗi ô một
    bộ phương án có thể TRÙNG mã nhau, nên khoá là `"<ô>:<mã>"`.

    Câu gõ chữ trả về rỗng — không có gì để đọc sẵn.
    """
    content: dict[str, Any] = question.content_json or {}
    out: dict[str, str] = {}

    for option in content.get("options") or []:
        text = (option.get("text") or "").strip()
        if option.get("id") and text:
            out[str(option["id"])] = text

    for gap, spec in (content.get("gaps") or {}).items():
        for option in (spec or {}).get("options") or []:
            text = (option.get("text") or "").strip()
            if option.get("id") and text:
                out[f"{gap}:{option['id']}"] = text

    return out


async def existing_audio(
    db: AsyncSession, question_ids: list[uuid.UUID], voice_ids: list[uuid.UUID]
) -> dict[tuple[uuid.UUID, uuid.UUID, str, str], QuestionAudio]:
    """Audio đã có, tra CẢ LOẠT trong một lượt.

    Một màn có năm nhiệm vụ, mỗi nhiệm vụ mấy câu, mỗi câu bốn phương án — hỏi
    từng cái là hàng trăm lượt đi về cho một cú bấm.
    """
    if not question_ids or not voice_ids:
        return {}
    rows = await db.scalars(
        select(QuestionAudio).where(
            QuestionAudio.question_id.in_(question_ids),
            QuestionAudio.voice_id.in_(voice_ids),
        )
    )
    return {(r.question_id, r.voice_id, r.target, r.option_key): r for r in rows}


async def speak(engine: Any, text: str, external_voice_id: str) -> tuple[bytes, str]:
    """Đọc một đoạn chữ. Trả về (dữ liệu, đuôi file).

    Hai đường, và đường nào cũng nghe được:

      - Không có ô trống → gọi MỘT lần, lấy mp3. Đây là gần hết số câu.
      - Có ô trống → gọi cho TỪNG khúc chữ ở dạng PCM, chèn tiếng bíp vào giữa,
        rồi gói thành WAV. Xem `beep.py` để biết vì sao không nối mp3.

    Câu chỉ có mỗi ô trống thì không gọi nhà cung cấp lần nào — chẳng có chữ nào
    để đọc, và tiếng bíp là của ta.

    Các khúc đi CẢ LOẠT xuống `speak_parts`, không phải từng cái một: nhà cung
    cấp cần biết khúc này đứng ở đâu trong câu thì mới đọc liền hơi được. Đọc
    xong hết rồi mới dựng tiếng bíp — độ to của bíp lấy theo chính giọng vừa
    đọc, mà giọng nào cũng một mức khác nhau.
    """
    parts = segments(text)
    if all(part is not None for part in parts):
        return await engine.speak(text, external_voice_id), ".mp3"

    words = [part for part in parts if part is not None]
    spoken = (
        await engine.speak_parts(words, external_voice_id, pcm_rate=beep.SAMPLE_RATE)
        if words
        else []
    )

    tone = beep.beep_pcm(beep.level_for(b"".join(spoken)))
    chunks = iter(spoken)
    pcm = b"".join(tone if part is None else next(chunks) for part in parts)
    return beep.to_wav(pcm), ".wav"


async def _synthesize(
    db: AsyncSession,
    *,
    question: Question,
    voice: Voice,
    target: str,
    option_key: str,
    text: str,
    user_id: uuid.UUID | None,
    old: QuestionAudio | None,
) -> QuestionAudio:
    """Gọi nhà cung cấp, lưu file, ghi lại một dòng.

    Ghi ĐÈ lên dòng cũ chứ không thêm dòng mới: ràng buộc duy nhất
    `(câu hỏi, giọng, chỗ, phương án)` chỉ cho phép một, và đó là chủ ý — hai
    bản thu của cùng một câu bằng cùng một giọng thì không ai chọn giữa chúng.
    File cũ ở lại trong kho media: xoá file là một việc không hoàn tác được, làm
    bởi một thao tác mà người ta gọi là "sinh lại".
    """
    engine = PROVIDERS.get(voice.provider)
    if engine is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="provider")

    audio, suffix = await speak(engine, text, voice.external_id)
    asset = await media_service.save_upload(
        db,
        filename=f"{question.id}-{target}-{option_key or 'main'}{suffix}",
        data=audio,
        uploaded_by_id=user_id,
        folder="question-audio",
    )

    # SINH GIỌNG CŨNG LÀ TẢI FILE LÊN.
    #
    # Với người dựng, "tải lên một file mp3" và "bấm nút sinh giọng" là cùng một
    # việc: sau cả hai, câu này phải CÓ tiếng để học sinh nghe. Nên tiếng đề bài
    # vừa sinh được gắn thẳng vào `questions.audio_media_id` — chính cột mà ô
    # tải lên đọc, và chính cột mà đường chơi phát.
    #
    # Không làm thế thì file nằm trong kho `question_audios` mà ô tải lên vẫn
    # kêu "chưa có tệp nghe", còn học sinh thì vẫn chỉ đọc chữ. Hai kho tiếng
    # cho cùng một câu, và không cái nào nói cho ai biết cái kia tồn tại.
    #
    # Chỉ ĐỀ BÀI. Phương án không có chỗ nào tương ứng trên câu hỏi, và cũng
    # không nên có: chúng thuộc về từng phương án, không thuộc về cả câu.
    if target == AudioTarget.PROMPT:
        question.audio_media_id = asset.id

    if old is not None:
        old.media_id = asset.id
        await db.commit()
        return old

    row = QuestionAudio(
        question_id=question.id,
        voice_id=voice.id,
        target=target,
        option_key=option_key,
        media_id=asset.id,
    )
    db.add(row)
    await db.commit()
    return row


async def generate_for_question(
    db: AsyncSession,
    *,
    question: Question,
    voice: Voice,
    target: str,
    overwrite: bool,
    user_id: uuid.UUID | None,
    known: dict[tuple[uuid.UUID, uuid.UUID, str, str], QuestionAudio] | None = None,
) -> AudioReport:
    """Sinh audio cho MỘT câu hỏi bằng MỘT giọng."""
    report = AudioReport()
    have = known if known is not None else await existing_audio(db, [question.id], [voice.id])

    if target == AudioTarget.PROMPT:
        wanted = {"": prompt_raw(question)}
    else:
        wanted = option_texts(question)

    for option_key, text in wanted.items():
        if not text:
            continue
        old = have.get((question.id, voice.id, target, option_key))
        if old is not None and not overwrite:
            report.skipped += 1
            # BỎ QUA việc sinh, NHƯNG vẫn nhận giọng này làm giọng đang dùng.
            #
            # "Sinh tiếng đọc" với người dựng nghĩa là *cho câu này nói bằng
            # giọng ấy*. Đã có sẵn bản thu đúng giọng đó thì việc còn lại chỉ là
            # trỏ vào nó — không gọi nhà cung cấp, không tốn một xu, mà kết quả
            # vẫn đúng thứ họ vừa bấm. Không làm bước này thì bấm xong không có
            # gì đổi, và người dựng chỉ biết là nút hỏng.
            if target == AudioTarget.PROMPT and question.audio_media_id != old.media_id:
                question.audio_media_id = old.media_id
                await db.commit()
            continue
        await _synthesize(
            db,
            question=question,
            voice=voice,
            target=target,
            option_key=option_key,
            text=text,
            user_id=user_id,
            old=old,
        )
        report.generated += 1

    return report


async def voice_of_character(db: AsyncSession, character_id: uuid.UUID | None) -> Voice | None:
    """Giọng của một nhân vật. `None` = chưa gán nhân vật, hoặc chưa gán giọng."""
    if character_id is None:
        return None
    character = await db.scalar(select(Character).where(Character.id == character_id))
    if character is None or character.voice_id is None:
        return None
    return await db.scalar(select(Voice).where(Voice.id == character.voice_id))


async def questions_of_quest(db: AsyncSession, quest_id: uuid.UUID) -> list[Question]:
    """Câu hỏi của một nhiệm vụ, đúng thứ tự đã lắp."""
    rows = await db.execute(
        select(Question)
        .join(QuestQuestion, QuestQuestion.question_id == Question.id)
        .where(QuestQuestion.quest_id == quest_id)
        .order_by(QuestQuestion.order_index)
    )
    return list(rows.scalars())


async def media_urls(db: AsyncSession, media_ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
    """URL của một mớ file, MỘT truy vấn."""
    ids = {i for i in media_ids if i}
    if not ids:
        return {}
    rows = await db.execute(select(MediaAsset.id, MediaAsset.url).where(MediaAsset.id.in_(ids)))
    return {row.id: row.url for row in rows}


def require_voice(voice: Voice | None, label: str) -> Voice:
    """Chặn sớm khi chưa có giọng, và nói rõ THIẾU CHỖ NÀO.

    Không âm thầm bỏ qua: người dựng vừa bấm "sinh giọng đọc" và có quyền biết
    vì sao không có gì xảy ra.
    """
    if voice is None:
        raise ConflictError(ErrorCode.CONFLICT, field="voice", target=label)
    return voice


# --------------------------------------------------------------------------
# LỜI CHIA TAY của người canh giữ
# --------------------------------------------------------------------------
#
# Không nằm ở `question_audios`, và đó là cố ý: đây không phải một câu hỏi. Nó
# là một câu nói của MÀN CHƠI, vang lên đúng một lần — lúc học sinh qua được
# nhiệm vụ NPC, ngay trước khi nhận sổ tay. Nhét nó vào bảng khoá theo câu hỏi
# thì phải bịa ra một `question_id` không tồn tại.
#
# Cũng không cần cái kho tái dùng theo giọng: mỗi màn một lời chia tay riêng,
# không có chuyện "lắp lời này sang màn khác".


def outro_text(stage: Any) -> str:
    """Lời chia tay sẽ được ĐỌC — bản tiếng Anh.

    Người canh giữ nói tiếng Anh, kể cả khi học sinh đang xem giao diện tiếng
    Việt: cả trò chơi này dạy tiếng Anh, và chữ tiếng Việt cạnh trình phát là
    bản dịch để đọc theo, không phải lời thoại.

    Lùi về bản bất kỳ nếu chưa có bản tiếng Anh — thà đọc bằng thứ tiếng có sẵn
    còn hơn im lặng mà không nói vì sao.
    """
    text = stage.advisor_outro_i18n or {}
    return (text.get("en") or next((v for v in text.values() if v), "")).strip()


async def generate_outro(
    db: AsyncSession,
    *,
    stage: Any,
    voice: Voice,
    overwrite: bool,
    user_id: uuid.UUID | None,
) -> AudioReport:
    """Sinh tiếng cho lời chia tay của một màn, bằng giọng người canh giữ."""
    report = AudioReport()
    text = outro_text(stage)
    if not text:
        return report

    if stage.advisor_outro_audio_media_id is not None and not overwrite:
        report.skipped += 1
        return report

    engine = PROVIDERS.get(voice.provider)
    if engine is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="provider")

    audio, suffix = await speak(engine, text, voice.external_id)
    asset = await media_service.save_upload(
        db,
        filename=f"{stage.id}-outro{suffix}",
        data=audio,
        uploaded_by_id=user_id,
        # Cùng thư mục với tệp người dựng tự tải lên ở bảng sổ tay: sinh ra hay
        # tải lên thì cũng là cùng một thứ, cùng một chỗ.
        folder="stage-outro",
    )
    stage.advisor_outro_audio_media_id = asset.id
    await db.commit()
    report.generated += 1
    return report


# --------------------------------------------------------------------------
# LỜI PHÁN — câu rời, dùng chung cả world, khoá theo GIỌNG
# --------------------------------------------------------------------------


#: TÁM khoảnh khắc người canh giữ lên tiếng. Phải khớp `FALLBACK` bên
#: `quest-panel.tsx` — thiếu một nhóm ở đây là nhóm ấy không bao giờ được sinh
#: tiếng, và màn chơi im lặng đúng vào lúc đó mà không báo gì.
VERDICT_GROUPS: tuple[str, ...] = (
    "greet",
    "praise",
    "wrong",
    "moveOn",
    "next",
    "passed",
    "failed",
    "revisit",
)


def verdict_lines(world: Any) -> list[str]:
    """Mọi câu phán của một world, gộp ba nhóm thành một danh sách phẳng.

    Phẳng vì việc ở đây chỉ là *đọc từng câu ra tiếng* — nhóm nào không đổi cách
    đọc. Nhóm chỉ có nghĩa lúc CHỌN câu nào để nói, và việc đó ở màn chơi.

    Bỏ câu trùng: hai nhóm có thể vô tình chứa cùng một câu, và thu hai lần cùng
    một tiếng bằng cùng một giọng là trả tiền hai lần cho một tệp.
    """
    data = world.verdict_json or {}
    seen: dict[str, None] = {}
    for group in VERDICT_GROUPS:
        for line in data.get(group) or []:
            text = (line or "").strip()
            if text:
                seen.setdefault(text, None)
    return list(seen)


async def existing_lines(
    db: AsyncSession, voice_id: uuid.UUID, texts: list[str]
) -> dict[str, VoiceLine]:
    """Câu nào đã có tiếng bằng giọng này rồi — tra CẢ LOẠT, khoá là băm."""
    if not texts:
        return {}
    hashes = [line_hash(t) for t in texts]
    rows = await db.scalars(
        select(VoiceLine).where(
            VoiceLine.voice_id == voice_id, VoiceLine.text_hash.in_(hashes)
        )
    )
    return {r.text_hash: r for r in rows}


async def generate_lines(
    db: AsyncSession,
    *,
    voice: Voice,
    texts: list[str],
    overwrite: bool,
    user_id: uuid.UUID | None,
) -> AudioReport:
    """Sinh tiếng cho một loạt câu rời bằng MỘT giọng.

    Đây là chỗ "dùng lại" thành hình: nhiệm vụ thứ hai chọn người canh giữ khác
    nhưng cùng giọng thì mọi câu đã có sẵn, báo `skipped` hết, và không gọi nhà
    cung cấp lần nào.
    """
    report = AudioReport()
    engine = PROVIDERS.get(voice.provider)
    if engine is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="provider")

    have = await existing_lines(db, voice.id, texts)

    can_doc = []
    for text in texts:
        if have.get(line_hash(text)) is not None and not overwrite:
            report.skipped += 1
            continue
        can_doc.append(text)

    if not can_doc:
        return report

    # ĐỌC SONG SONG, có chặn số luồng.
    #
    # ElevenLabs KHÔNG có API gộp lô: mỗi câu một request. Tám mươi câu gọi nối
    # đuôi nhau là tám mươi lượt đi về, mỗi lượt một hai giây — vài phút ngồi
    # nhìn một cái bảng chờ, và đủ lâu để proxy cắt request giữa chừng.
    #
    # Chặn số luồng chứ không thả hết: nhà cung cấp có trần số request đồng thời
    # theo hạng tài khoản, vượt trần thì trả 429 và cả mẻ hỏng lẻ tẻ — tệ hơn là
    # chờ lâu. Xem `ELEVENLABS_CONCURRENCY`.
    #
    # Chỉ phần GỌI MẠNG là song song. Lưu file và ghi database vẫn tuần tự: một
    # phiên SQLAlchemy không dùng được từ nhiều tác vụ cùng lúc.
    khoa = asyncio.Semaphore(max(1, settings.elevenlabs_concurrency))

    async def doc(text: str) -> tuple[str, bytes, str]:
        async with khoa:
            audio, suffix = await speak(engine, text, voice.external_id)
            return text, audio, suffix

    # `return_exceptions=True` là phần BẮT BUỘC, không phải cẩn thận thừa.
    #
    # Không có nó thì câu thứ bốn mươi hỏng là `gather` huỷ cả mẻ và ném lên
    # ngay — ba mươi chín câu đã đọc xong, đã trả tiền, chưa kịp lưu, mất sạch.
    # Bấm lại là trả tiền lần nữa cho đúng ba mươi chín câu ấy.
    #
    # Giữ được bao nhiêu lưu bấy nhiêu, rồi báo số hỏng. Bấm lại lần sau thì
    # `existing_lines` thấy phần đã lưu và bỏ qua — tức là CHỈ chạy lại phần
    # hỏng, không cần một nút riêng nào cho việc đó.
    ket_qua = await asyncio.gather(*(doc(t) for t in can_doc), return_exceptions=True)

    for item in ket_qua:
        if isinstance(item, BaseException):
            report.failed += 1
            if len(report.errors) < 3:
                report.errors.append(f"{type(item).__name__}: {item}"[:200])
            continue

        text, audio, suffix = item
        key = line_hash(text)
        asset = await media_service.save_upload(
            db,
            filename=f"{voice.id}-{key[:12]}{suffix}",
            data=audio,
            uploaded_by_id=user_id,
            folder="voice-line",
        )
        cu = have.get(key)
        if cu is not None:
            cu.media_id = asset.id
            cu.text = text
        else:
            db.add(
                VoiceLine(
                    voice_id=voice.id, text_hash=key, text=text, media_id=asset.id
                )
            )
        report.generated += 1

    # MỘT lần commit cho cả mẻ: tám mươi lần commit là tám mươi vòng đi về với
    # database cho một thao tác mà người dùng coi là một việc.
    #
    # Commit KỂ CẢ khi có câu hỏng — đó là cả điểm của việc giữ phần làm được.
    await db.commit()
    if report.failed:
        logger.warning(
            "voice.lines.partial",
            generated=report.generated,
            failed=report.failed,
            errors=report.errors,
        )
    return report


async def line_urls(
    db: AsyncSession, voice_id: uuid.UUID | None, texts: list[str]
) -> dict[str, str]:
    """`câu chữ → URL tiếng`, cho đúng một giọng. Thiếu câu nào thì vắng câu đó.

    Màn chơi đọc bảng này: có thì phát, không có thì chỉ hiện chữ — tiếng luôn
    là TUỲ CHỌN, không bao giờ là điều kiện để cuộc trò chuyện đi tiếp.
    """
    if voice_id is None or not texts:
        return {}
    have = await existing_lines(db, voice_id, texts)
    urls = await media_urls(db, [row.media_id for row in have.values()])
    out: dict[str, str] = {}
    for text in texts:
        row = have.get(line_hash(text))
        url = urls.get(row.media_id) if row else None
        if url:
            out[text] = url
    return out

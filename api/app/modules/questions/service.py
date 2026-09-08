"""Nghiệp vụ kho câu hỏi.

Việc quan trọng nhất ở đây không phải CRUD mà là **che đáp án**: `answer_json`
chỉ được rời khỏi server khi người gọi có quyền sửa nội dung. Học sinh đang chơi
mà nhận được đáp án trong phản hồi API thì mọi thứ phía sau đều vô nghĩa — xem
docs/GAME_DOMAIN.md §1.6.

Khác bản LMS: bỏ `apply_scope()` và `ScopeFilter`. Vitaminfun không có trung tâm,
nên kho câu hỏi là **một kho duy nhất** mà giáo viên và admin cùng dùng. Việc chặn
nằm ở `require_role()` tại router, không nằm trong câu truy vấn.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Select, Text, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, ErrorCode, NotFoundError, ValidationFailedError
from app.db.models import MediaAsset, Question, Quest, QuestQuestion, Stage
from app.db.models.question import QuestionStatus
from app.modules.questions.import_xlsx import ParseResult
from app.modules.questions.schemas import QuestionOut


def _base_query() -> Select[Any]:
    """Truy vấn gốc cho MỌI đường đọc câu hỏi trong module này.

    Gom về một chỗ để không có đường nào quên lọc câu đã xoá mềm — kể cả đường
    lấy một bản ghi theo id.
    """
    return select(Question).where(Question.deleted_at.is_(None))


async def list_questions(
    db: AsyncSession,
    *,
    qtype: str | None = None,
    status: str | None = None,
    keyword: str | None = None,
    tag: str | None = None,
    level: str | None = None,
    world_code: str | None = None,
    stage_code: str | None = None,
    quest_code: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Question], int]:
    query = _base_query()

    # Lọc theo ĐỊA CHỈ GỐC. Đây là đường mà màn chơi dùng để tự hiện ra những
    # câu thuộc về nó: mở màn `W1-S1` là hỏi `stage_code=W1-S1`, không cần biết
    # câu đó đã được lắp vào nhiệm vụ nào chưa.
    if world_code:
        query = query.where(Question.world_code == world_code)
    if stage_code:
        query = query.where(Question.stage_code == stage_code)
    if quest_code:
        query = query.where(Question.quest_code == quest_code)

    if qtype:
        query = query.where(Question.type == qtype)
    if status:
        query = query.where(Question.status == status)
    if level:
        query = query.where(Question.level == level)
    if tag:
        # JSONB chứa phần tử này. Toán tử @> dùng được index GIN nếu sau này cần.
        query = query.where(Question.tags.contains([tag]))
    if keyword:
        # Tìm trong đề bài lẫn trong chủ đề. `content_json` là JSONB nên phải ép
        # về text — chấp nhận được ở quy mô kho câu hỏi hiện tại; khi kho lớn lên
        # thì thay bằng cột tìm kiếm riêng có index.
        pattern = f"%{keyword.lower()}%"
        query = query.where(
            or_(
                func.lower(func.cast(Question.content_json, Text)).like(pattern),
                func.lower(func.coalesce(Question.topic, "")).like(pattern),
            )
        )

    total = await db.scalar(select(func.count()).select_from(query.subquery())) or 0

    # Kho chung xếp theo MỚI NHẤT TRƯỚC — người soạn vừa tạo xong thì thấy ngay.
    # Nhưng khi đã lọc theo một mã, thứ tự có nghĩa là thứ tự TRONG ĐỀ: câu 1,
    # câu 2, câu 3 như trong file. Xếp theo ngày tạo ở đó là xáo tung một trình
    # tự mà người soạn đã cố ý đặt ra.
    if quest_code or stage_code or world_code:
        order = (
            Question.quest_code.asc(),
            Question.question_order.asc().nulls_last(),
            Question.created_at.asc(),
        )
    else:
        order = (Question.created_at.desc(),)

    rows = await db.scalars(query.order_by(*order).limit(limit).offset(offset))
    return list(rows), total


async def list_codes(db: AsyncSession, *, stage_code: str | None = None) -> dict[str, list[str]]:
    """Những MÃ ĐỊNH DANH thật sự đang có trong kho, để dựng bộ lọc.

    Vì sao hỏi kho chứ không hỏi bảng `stages`/`quests`: hai bên có thể lệch, và
    lệch theo đúng cái chiều làm người dùng bí. Ngay sau một lần nhập file, kho
    có `W1-S1` mà chưa màn nào mang mã đó — người dựng cần thấy `W1-S1` trong bộ
    lọc CHÍNH LÚC ĐÓ, để lọc ra hai mươi sáu câu vừa nhập và lắp vào nhiệm vụ.
    Dựng danh sách từ bảng `stages` thì ô chọn rỗng đúng vào lúc nó cần đầy.

    `quest_codes` thu hẹp theo `stage_code` khi có: một world nhiều màn sẽ có
    hàng trăm mã nhiệm vụ, và một danh sách dài như thế thì không chọn được bằng
    mắt. Không truyền thì trả về mọi mã trong kho.

    Câu soạn tay không mang mã nào, nên chúng không xuất hiện ở đây — đúng: bộ
    lọc này chỉ nói về những câu ĐẾN TỪ FILE.
    """

    async def _distinct(column, extra=None) -> list[str]:
        query = select(column).where(Question.deleted_at.is_(None), column.is_not(None))
        if extra is not None:
            query = query.where(extra)
        rows = await db.scalars(query.distinct().order_by(column.asc()))
        return list(rows)

    return {
        "world_codes": await _distinct(Question.world_code),
        "stage_codes": await _distinct(Question.stage_code),
        "quest_codes": await _distinct(
            Question.quest_code,
            Question.stage_code == stage_code if stage_code else None,
        ),
    }


async def get_question(db: AsyncSession, question_id: uuid.UUID) -> Question:
    question = await db.scalar(_base_query().where(Question.id == question_id))
    if question is None:
        raise NotFoundError(ErrorCode.NOT_FOUND, resource="question")
    return question


async def soft_delete(db: AsyncSession, question: Question) -> None:
    """Xoá mềm — nhưng TỪ CHỐI nếu câu hỏi đang nằm trong một màn chơi.

    Xoá cứng thì khoá ngoại `quest_questions.question_id` (RESTRICT) đã chặn. Nhưng ở đây
    là xoá MỀM, database không biết gì cả — nên phải kiểm bằng tay, nếu không
    giáo viên xoá một câu hỏi là âm thầm làm hỏng một màn đang xuất bản, và lỗi
    chỉ lộ ra khi có học sinh đang chơi giữa chừng.

    Câu hỏi vẫn dùng xoá mềm (không xoá cứng) vì nó có thể đã nằm trong lượt
    chơi mà học sinh đã hoàn thành; xoá cứng là làm hỏng lịch sử và mọi báo cáo.
    """
    rows = await db.execute(
        select(Quest.order_index, Quest.quest_object_key, Stage.name_i18n, Stage.status)
        .join(QuestQuestion, QuestQuestion.quest_id == Quest.id)
        .join(Stage, Stage.id == Quest.stage_id)
        .where(QuestQuestion.question_id == question.id)
        .limit(5)
    )
    used_by = [
        {
            "stageName": r.name_i18n,
            "stageStatus": r.status,
            "questOrder": r.order_index,
            "questObject": r.quest_object_key,
        }
        for r in rows
    ]
    if used_by:
        raise ConflictError(ErrorCode.QUESTION_IN_USE, usedBy=used_by)

    question.deleted_at = datetime.now(UTC)


async def audio_urls(db: AsyncSession, questions: list[Question]) -> dict[uuid.UUID, str]:
    """URL tệp nghe của một loạt câu hỏi, tra MỘT LẦN.

    Một truy vấn cho cả trang thay vì một truy vấn cho mỗi dòng: kho câu hỏi trả
    về tới 200 câu một lần, và tra từng cái là 200 lượt đi về database để vẽ một
    danh sách.

    Trả về khoá theo `media_id` chứ không theo `question_id`: nhiều câu hoàn toàn
    có thể dùng chung một đoạn ghi âm (một bài nghe, năm câu hỏi về nó).
    """
    ids = {q.audio_media_id for q in questions if q.audio_media_id}
    if not ids:
        return {}
    rows = await db.execute(select(MediaAsset.id, MediaAsset.url).where(MediaAsset.id.in_(ids)))
    return {row.id: row.url for row in rows}


async def one_audio_url(db: AsyncSession, question: Question) -> str | None:
    """URL tệp nghe của MỘT câu hỏi. `None` = chưa tải, hoặc câu không nghe."""
    if question.audio_media_id is None:
        return None
    return await db.scalar(select(MediaAsset.url).where(MediaAsset.id == question.audio_media_id))


def to_out(question: Question, *, include_answer: bool, audio_url: str | None) -> QuestionOut:
    """Đổi bản ghi thành phản hồi API.

    `include_answer=False` là mặc định an toàn: gọi nhầm thì mất tính năng, còn
    gọi nhầm chiều ngược lại thì lộ đáp án. Hàm này cũng sẽ là chỗ dựng
    `stage_runs.snapshot_json` ở Bước 8 — đúng một đường sinh ra "đề bài không
    kèm đáp án", không có đường thứ hai để quên che.

    `audio_url` là tham số BẮT BUỘC, không có mặc định `None`, và đó là chủ ý:
    hàm này đồng bộ nên không tự tra được bảng media, mà một mặc định `None` thì
    quên truyền cũng không báo gì — câu hỏi nghe im lặng mất tệp nghe, đúng cái
    kiểu hỏng mà bốn trường mã định danh đã mắc phải một lần. Dùng
    `audio_urls()` cho danh sách, `one_audio_url()` cho một bản ghi.
    """
    return QuestionOut(
        id=question.id,
        type=question.type,
        schema_version=question.schema_version,
        points=question.points,
        time_limit_seconds=question.time_limit_seconds,
        content=question.content_json,
        answer=question.answer_json if include_answer else None,
        explanation=question.explanation if include_answer else None,
        status=question.status,
        level=question.level,
        topic=question.topic,
        tags=question.tags or [],
        # ĐỊA CHỈ GỐC. Bốn trường này có mặt trong `QuestionOut` với mặc định
        # `None`, và cái mặc định đó từng che mất việc chúng không được điền ở
        # đây: API trả `null` cho mọi câu, kể cả câu vừa nhập từ file, mà không
        # một lỗi nào. Giao diện đọc `quest_code` để hiện nhãn nhóm và không
        # hiện gì cả — nhìn ra thì tưởng lỗi ở bộ nhập.
        world_code=question.world_code,
        stage_code=question.stage_code,
        quest_code=question.quest_code,
        question_order=question.question_order,
        prompt_kind=question.prompt_kind,
        show_transcript=question.show_transcript,
        audio_media_id=question.audio_media_id,
        audio_url=audio_url,
        created_at=question.created_at,
        updated_at=question.updated_at,
    )


# ==========================================================================
# Nhập khẩu từ file .xlsx của bộ phận nội dung
# ==========================================================================


@dataclass
class ImportReport:
    """Kết quả một lần nhập. Mọi con số đều là thứ người dùng kiểm chứng được.

    Tách `created` với `updated` vì hai câu chuyện khác hẳn nhau: nhập lần đầu
    thì mong `created` bằng số dòng, còn nhập lại sau khi sửa vài ô thì mong
    `created` bằng 0. Gộp thành một số "đã xử lý" là giấu đi đúng cái người dùng
    cần thấy để biết mình có nhầm file hay không.
    """

    created: int = 0
    updated: int = 0
    #: Đã lắp vào nhiệm vụ vì tìm thấy `quest_code` khớp.
    linked: int = 0
    #: Đã nằm sẵn trong nhiệm vụ từ lần nhập trước, không lắp lại.
    already_linked: int = 0
    #: Nằm lại trong kho vì chưa có nhiệm vụ nào mang mã đó.
    in_bank: int = 0
    #: Các `quest_code` không tìm thấy nhiệm vụ. Đây là danh sách việc-cần-làm
    #: cho giáo viên: điền mã này vào nhiệm vụ rồi nhập lại là xong.
    missing_quest_codes: list[str] = field(default_factory=list)
    #: Dòng bị bỏ qua, kèm lý do.
    skipped: list[str] = field(default_factory=list)


async def apply_import(
    db: AsyncSession,
    parsed: ParseResult,
    *,
    created_by: uuid.UUID | None,
) -> ImportReport:
    """Ghi kết quả đọc file xuống kho, và lắp vào nhiệm vụ khi khớp được mã.

    ## Nhập lại cùng một file KHÔNG sinh ra bản sao

    Danh tính của một dòng là cặp (`quest_code`, `question_order`) — đúng thứ mà
    người soạn dùng để gọi tên một câu ("câu 3 của nhiệm vụ 02"). Có sẵn thì
    GHI ĐÈ nội dung, không tạo mới. Nhờ vậy bộ phận nội dung sửa vài ô trong
    file rồi gửi lại là nhập đè lên được, không phải dọn kho bằng tay.

    ## Trạng thái là `published`

    Đây là nội dung đã soạn xong và đã duyệt, không phải bản nháp của giáo viên.
    Để `draft` thì bộ chọn câu hỏi lọc mất chúng, và người dùng phải bấm xuất
    bản hai mươi sáu lần trước khi làm được việc mình định làm.
    """
    report = ImportReport(skipped=list(parsed.skipped))
    if not parsed.questions:
        raise ValidationFailedError(ErrorCode.IMPORT_NO_ROWS, skipped=report.skipped[:10])

    quests = await _quests_by_code(db, {q.quest_code for q in parsed.questions})
    missing: set[str] = set()
    #: Chỗ trống tiếp theo trong mỗi nhiệm vụ. Nạp lười, một lần mỗi nhiệm vụ.
    next_order: dict[uuid.UUID, int] = {}

    # Xử lý theo ĐÚNG THỨ TỰ TRONG FILE. Các câu mới được nối vào cuối nhiệm vụ,
    # nên thứ tự xử lý chính là thứ tự chúng nằm cạnh nhau sau khi lắp.
    for item in sorted(parsed.questions, key=lambda q: (q.quest_code, q.question_order)):
        row = await db.scalar(
            _base_query().where(
                Question.quest_code == item.quest_code,
                Question.question_order == item.question_order,
            )
        )
        if row is None:
            row = Question(created_by_user_id=created_by)
            db.add(row)
            report.created += 1
        else:
            report.updated += 1

        row.type = item.qtype
        # CÁCH RA ĐỀ theo file. Không đụng `audio_media_id`: bảng tính không
        # chứa file, nên nhập lại một câu nghe KHÔNG được gỡ mất đoạn ghi âm
        # giáo viên đã tải lên. File nói "câu này để nghe"; ai cung cấp tiếng là
        # chuyện của trình soạn.
        row.prompt_kind = item.prompt_kind
        row.content_json = item.content
        row.answer_json = item.answer
        row.points = item.points
        row.status = QuestionStatus.PUBLISHED
        row.world_code = item.world_code
        row.stage_code = item.stage_code
        row.quest_code = item.quest_code
        row.question_order = item.question_order

        quest = quests.get(item.quest_code)
        if quest is None:
            missing.add(item.quest_code)
            report.in_bank += 1
            continue

        # `flush` để câu vừa tạo có `id` — bảng nối cần nó ngay bây giờ.
        await db.flush()
        if await _link_question(db, quest, row, next_order, item.points):
            report.linked += 1
        else:
            report.already_linked += 1

    report.missing_quest_codes = sorted(missing)
    await db.commit()
    return report


async def _quests_by_code(db: AsyncSession, codes: set[str]) -> dict[str, Quest]:
    """Tra nhiệm vụ theo mã, MỘT truy vấn cho cả lần nhập.

    Hỏi từng dòng một thì một file nghìn câu là một nghìn lượt đi về database,
    phần lớn để hỏi lại đúng bảy cái mã.
    """
    if not codes:
        return {}
    rows = await db.scalars(select(Quest).where(Quest.quest_code.in_(codes)))
    return {quest.quest_code: quest for quest in rows if quest.quest_code}


async def _link_question(
    db: AsyncSession,
    quest: Quest,
    question: Question,
    next_order: dict[uuid.UUID, int],
    points: int,
) -> bool:
    """Lắp câu hỏi vào CUỐI nhiệm vụ. `False` = đã có sẵn, chỉ cập nhật điểm.

    ## Nối vào cuối, không dùng `question_order` của file làm chỗ đứng

    Thoạt nhìn thì lấy thẳng `question_order` là đúng nhất — file bảo câu này
    đứng thứ nhất thì cho nó đứng thứ nhất. Nhưng `quest_questions` có ràng buộc
    duy nhất `(quest_id, order_index)`, và một nhiệm vụ hoàn toàn có thể đã có
    câu hỏi từ trước: lắp bằng số của file là đâm thẳng vào chỗ đã có người ngồi,
    và cả lần nhập gãy giữa chừng. Đây là lỗi đo được, không phải giả định.

    Đẩy cái đang ngồi đó ra thì tệ hơn: giáo viên có thể đã tự sắp lại thứ tự,
    và một lần nhập KHÔNG được phép xoá công đó. Nối vào cuối thì không mất gì,
    mà thứ tự tương đối giữa các câu vừa nhập vẫn đúng như trong file — vì vòng
    lặp ở `apply_import()` chạy theo đúng thứ tự ấy.

    Câu đã lắp rồi thì chỉ sửa điểm, KHÔNG động vào `order_index`: nhập lại lần
    thứ hai mà thứ tự nhảy về chỗ khác là một thay đổi không ai yêu cầu.
    """
    link = await db.scalar(
        select(QuestQuestion).where(
            QuestQuestion.quest_id == quest.id, QuestQuestion.question_id == question.id
        )
    )
    if link is not None:
        link.points = points
        return False

    if quest.id not in next_order:
        next_order[quest.id] = (
            await db.scalar(
                select(func.coalesce(func.max(QuestQuestion.order_index), 0)).where(
                    QuestQuestion.quest_id == quest.id
                )
            )
            or 0
        )
    next_order[quest.id] += 1

    db.add(
        QuestQuestion(
            quest_id=quest.id,
            question_id=question.id,
            order_index=next_order[quest.id],
            points=points,
        )
    )
    return True

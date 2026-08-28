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
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Select, Text, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, ErrorCode, NotFoundError
from app.db.models import Question, Quest, QuestQuestion, Stage
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
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Question], int]:
    query = _base_query()

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

    rows = await db.scalars(query.order_by(Question.created_at.desc()).limit(limit).offset(offset))
    return list(rows), total


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


def to_out(question: Question, *, include_answer: bool) -> QuestionOut:
    """Đổi bản ghi thành phản hồi API.

    `include_answer=False` là mặc định an toàn: gọi nhầm thì mất tính năng, còn
    gọi nhầm chiều ngược lại thì lộ đáp án. Hàm này cũng sẽ là chỗ dựng
    `stage_runs.snapshot_json` ở Bước 8 — đúng một đường sinh ra "đề bài không
    kèm đáp án", không có đường thứ hai để quên che.
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
        created_at=question.created_at,
        updated_at=question.updated_at,
    )

"""API kho câu hỏi.

Cả router chỉ dành cho **giáo viên và admin**. Học sinh không bao giờ gọi tới
đây: đề bài đến với các em qua `stage_runs.snapshot_json` đã đóng băng và đã cắt
đáp án (docs/GAME_DOMAIN.md §1.3), không qua kho câu hỏi.

Khác bản LMS: `require_role()` thay cho `scope_for()` + `apply_scope()`, và bỏ
ghi nhật ký kiểm toán (`audit`) — vitaminfun chưa có module đó.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import CurrentUserDep, DbDep, require_role
from app.core.errors import ErrorCode, ValidationFailedError
from app.db.models import Question, QuestionStatus, QuestionType, UserRole
from app.modules.questions import service
from app.modules.questions.grading import grade
from app.modules.questions.schemas import (
    GradePreviewIn,
    GradePreviewOut,
    QuestionCreate,
    QuestionListOut,
    QuestionOut,
    QuestionUpdate,
    validate_payload,
)

router = APIRouter(
    prefix="/questions",
    tags=["questions"],
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)


@router.get("", response_model=QuestionListOut, summary="Danh sách câu hỏi trong kho")
async def list_questions(
    db: DbDep,
    type: str | None = Query(default=None, description="Lọc theo dạng câu hỏi"),
    status_filter: str | None = Query(default=None, alias="status"),
    level: str | None = Query(default=None, description="Lọc theo CEFR"),
    tag: str | None = Query(default=None, description="Lọc theo một tag"),
    q: str | None = Query(default=None, description="Tìm trong đề bài và chủ đề"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> QuestionListOut:
    rows, total = await service.list_questions(
        db,
        qtype=type,
        status=status_filter,
        keyword=q,
        tag=tag,
        level=level,
        limit=limit,
        offset=offset,
    )

    # Danh sách KHÔNG kèm đáp án dù người xem là giáo viên: màn kho chỉ hiện đề
    # bài, mà phản hồi này đi qua cache của trình duyệt.
    return QuestionListOut(
        items=[service.to_out(row, include_answer=False) for row in rows], total=total
    )


@router.post(
    "",
    response_model=QuestionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Soạn câu hỏi mới",
)
async def create_question(
    payload: QuestionCreate, current: CurrentUserDep, db: DbDep
) -> QuestionOut:
    if payload.type not in QuestionType.ALL:
        raise ValidationFailedError(ErrorCode.QUESTION_TYPE_NOT_SUPPORTED, type=payload.type)
    if payload.status not in QuestionStatus.ALL:
        raise ValidationFailedError(ErrorCode.VALIDATION_FAILED, field="status")

    # Kiểm nội dung TRƯỚC khi tạo bản ghi — không để câu hỏi hỏng chạm database.
    validate_payload(payload.type, payload.content, payload.answer)

    question = Question(
        created_by_user_id=current.id,
        type=payload.type,
        points=payload.points,
        time_limit_seconds=payload.time_limit_seconds,
        content_json=payload.content,
        answer_json=payload.answer,
        explanation=payload.explanation,
        status=payload.status,
        level=payload.level,
        topic=payload.topic,
        tags=payload.tags,
        image_media_id=payload.image_media_id,
        audio_media_id=payload.audio_media_id,
        audio_max_plays=payload.audio_max_plays,
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)

    return service.to_out(question, include_answer=True)


@router.get("/{question_id}", response_model=QuestionOut, summary="Một câu hỏi kèm đáp án")
async def get_question(question_id: uuid.UUID, db: DbDep) -> QuestionOut:
    question = await service.get_question(db, question_id)
    return service.to_out(question, include_answer=True)


@router.patch("/{question_id}", response_model=QuestionOut, summary="Sửa câu hỏi")
async def update_question(
    question_id: uuid.UUID,
    payload: QuestionUpdate,
    db: DbDep,
) -> QuestionOut:
    question = await service.get_question(db, question_id)

    # Đáp án luôn tham chiếu id của lựa chọn trong đề. Gửi lẻ một trong hai là
    # tạo ra câu hỏi mà đáp án trỏ vào phương án không còn tồn tại.
    if (payload.content is None) != (payload.answer is None):
        raise ValidationFailedError(ErrorCode.VALIDATION_FAILED, field="content+answer")

    if payload.content is not None and payload.answer is not None:
        validate_payload(question.type, payload.content, payload.answer)
        question.content_json = payload.content
        question.answer_json = payload.answer

    if payload.status is not None:
        if payload.status not in QuestionStatus.ALL:
            raise ValidationFailedError(ErrorCode.VALIDATION_FAILED, field="status")
        question.status = payload.status

    for field in (
        "points",
        "time_limit_seconds",
        "explanation",
        "level",
        "topic",
        "tags",
        "image_media_id",
        "audio_media_id",
        "audio_max_plays",
    ):
        value = getattr(payload, field)
        if value is not None:
            setattr(question, field, value)

    await db.commit()
    await db.refresh(question)

    return service.to_out(question, include_answer=True)


@router.delete(
    "/{question_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    # response_model=None: `-> None` bị FastAPI hiểu thành "có kiểu trả về", mà
    # 204 thì không được có thân phản hồi. Nói thẳng ra để nó khỏi suy diễn.
    response_model=None,
    summary="Xoá mềm câu hỏi",
)
async def delete_question(question_id: uuid.UUID, db: DbDep) -> None:
    question = await service.get_question(db, question_id)
    await service.soft_delete(db, question)
    await db.commit()


@router.post("/{question_id}/check", response_model=GradePreviewOut, summary="Chấm thử")
async def check_answer(
    question_id: uuid.UUID, payload: GradePreviewIn, db: DbDep
) -> GradePreviewOut:
    """Chấm thử một câu trả lời, KHÔNG lưu gì.

    Dùng cho nút "Thử làm" của giáo viên trong trình soạn. Điểm luôn do server
    tính; đáp án không bao giờ xuống máy người làm bài. Cùng hàm `grade()` này
    sẽ chấm bài thật của học sinh ở Bước 8 — một bản chấm điểm duy nhất.
    """
    question = await service.get_question(db, question_id)

    result = grade(
        question.type,
        question.content_json,
        question.answer_json,
        payload.response,
        question.points,
    )
    return GradePreviewOut(
        score=result.score,
        max_score=question.points,
        is_correct=result.is_correct,
        detail=result.detail,
    )

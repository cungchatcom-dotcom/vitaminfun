"""API kho câu hỏi.

Cả router chỉ dành cho **giáo viên và admin**. Học sinh không bao giờ gọi tới
đây: đề bài đến với các em qua `stage_runs.snapshot_json` đã đóng băng và đã cắt
đáp án (docs/GAME_DOMAIN.md §1.3), không qua kho câu hỏi.

Khác bản LMS: `require_role()` thay cho `scope_for()` + `apply_scope()`, và bỏ
ghi nhật ký kiểm toán (`audit`) — vitaminfun chưa có module đó.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Query, UploadFile, status

from app.core.deps import CurrentUserDep, DbDep, require_role
from app.core.errors import ErrorCode, ValidationFailedError
from app.db.models import Question, QuestionStatus, QuestionType, UserRole
from app.modules.questions import service
from app.modules.questions.grading import grade
from app.modules.questions.import_xlsx import parse_workbook
from app.modules.questions.schemas import (
    GradePreviewIn,
    ImportReportOut,
    GradePreviewOut,
    QuestionCodesOut,
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


#: Trường đi qua luật "null = không gửi, giữ nguyên".
#:
#: Đúng cho hầu hết: giao diện vá từng mẩu payload một, và thứ không gửi thì
#: phải giữ nguyên.
KEEP_FIELDS: tuple[str, ...] = (
    "points",
    "time_limit_seconds",
    "explanation",
    "level",
    "topic",
    "tags",
    "audio_max_plays",
    "prompt_kind",
    "show_transcript",
)

#: Trường mà `null` nghĩa là XOÁ. Hai danh sách để CẠNH NHAU vì chúng là hai vế
#: của một luật, và luật đó chỉ đọc được khi nhìn cả hai cùng lúc — một trường
#: nằm ở cả hai chỗ thì kết quả phụ thuộc vào thứ tự hai vòng lặp.
CLEARABLE_FIELDS: tuple[str, ...] = ("image_media_id", "audio_media_id")


@router.get("", response_model=QuestionListOut, summary="Danh sách câu hỏi trong kho")
async def list_questions(
    db: DbDep,
    type: str | None = Query(default=None, description="Lọc theo dạng câu hỏi"),
    status_filter: str | None = Query(default=None, alias="status"),
    level: str | None = Query(default=None, description="Lọc theo CEFR"),
    tag: str | None = Query(default=None, description="Lọc theo một tag"),
    q: str | None = Query(default=None, description="Tìm trong đề bài và chủ đề"),
    world_code: str | None = Query(default=None, description="Lọc theo mã world"),
    stage_code: str | None = Query(default=None, description="Lọc theo mã màn chơi"),
    quest_code: str | None = Query(default=None, description="Lọc theo mã nhiệm vụ"),
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
        world_code=world_code,
        stage_code=stage_code,
        quest_code=quest_code,
        limit=limit,
        offset=offset,
    )

    # Danh sách KHÔNG kèm đáp án dù người xem là giáo viên: màn kho chỉ hiện đề
    # bài, mà phản hồi này đi qua cache của trình duyệt.
    #
    # URL tệp nghe tra MỘT LẦN cho cả trang — xem `service.audio_urls()`.
    urls = await service.audio_urls(db, rows)
    return QuestionListOut(
        items=[
            service.to_out(
                row, include_answer=False, audio_url=urls.get(row.audio_media_id)
            )
            for row in rows
        ],
        total=total,
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
        prompt_kind=payload.prompt_kind,
        show_transcript=payload.show_transcript,
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)

    return service.to_out(
        question, include_answer=True, audio_url=await service.one_audio_url(db, question)
    )


@router.post(
    "/import",
    response_model=ImportReportOut,
    summary="Nhập câu hỏi từ file .xlsx của bộ phận nội dung",
)
async def import_questions(
    db: DbDep,
    current: CurrentUserDep,
    file: UploadFile = File(..., description="File .xlsx có sheet Questions"),
) -> ImportReportOut:
    """Đọc sheet `Questions` và ghi vào kho.

    Câu nào có `quest_code` khớp một nhiệm vụ đang tồn tại thì **tự lắp vào**
    nhiệm vụ đó luôn; còn lại nằm trong kho và giữ mã, chờ nhiệm vụ được đặt mã.

    Trình nhập KHÔNG tạo màn chơi hay nhiệm vụ. Bố cục cảnh — vật thể nằm ở đâu,
    to bao nhiêu, vùng đi được thế nào — là việc của trình thiết kế, và một dòng
    trong bảng tính không nói được điều đó.

    Đường dẫn này phải khai báo TRƯỚC `/{question_id}`: FastAPI khớp route theo
    thứ tự khai báo, nên để sau thì "import" bị đọc thành một UUID và trả 422.
    """
    parsed = parse_workbook(await file.read())
    report = await service.apply_import(db, parsed, created_by=current.id)
    return ImportReportOut(**vars(report))


@router.get(
    "/codes",
    response_model=QuestionCodesOut,
    summary="Những mã định danh đang có trong kho",
)
async def list_codes(
    db: DbDep,
    stage_code: str | None = Query(
        default=None, description="Thu hẹp danh sách mã nhiệm vụ về một màn chơi"
    ),
) -> QuestionCodesOut:
    """Dựng ô chọn cho bộ lọc theo mã.

    Đọc từ KHO CÂU HỎI, không từ bảng `stages`/`quests` — xem `service.list_codes`.
    Ngay sau một lần nhập file, kho đã có `W1-S1` mà chưa màn nào mang mã đó, và
    đó chính là lúc người dựng cần lọc theo nó.

    Khai báo TRƯỚC `/{question_id}`, cùng lý do với `/import`: FastAPI khớp route
    theo thứ tự khai báo, để sau thì "codes" bị đọc thành một UUID và trả 422.
    """
    return QuestionCodesOut(**await service.list_codes(db, stage_code=stage_code))


@router.get("/{question_id}", response_model=QuestionOut, summary="Một câu hỏi kèm đáp án")
async def get_question(question_id: uuid.UUID, db: DbDep) -> QuestionOut:
    question = await service.get_question(db, question_id)
    return service.to_out(
        question, include_answer=True, audio_url=await service.one_audio_url(db, question)
    )


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

    for field in KEEP_FIELDS:
        value = getattr(payload, field)
        if value is not None:
            setattr(question, field, value)

    # TỆP NGHE và ẢNH xoá được, nên `null` ở đây nghĩa là XOÁ chứ không phải
    # "không gửi" — `model_fields_set` phân biệt hai chuyện đó.
    #
    # Nếu để chúng đi qua vòng lặp trên thì nút "Gỡ tệp nghe" sẽ gửi đúng
    # `{"audio_media_id": null}`, server trả 200 kèm bản ghi y như cũ, và người
    # dùng bấm một cái nút không làm gì — lặp đi lặp lại, vì không có gì nói
    # rằng cú bấm đã không tới nơi. Đúng lỗi mà nút "Gỡ ảnh" của nhiệm vụ đã
    # mắc phải; xem `worlds/router.py`.
    sent = payload.model_fields_set
    for field in CLEARABLE_FIELDS:
        if field in sent:
            setattr(question, field, getattr(payload, field))

    await db.commit()
    await db.refresh(question)

    return service.to_out(
        question, include_answer=True, audio_url=await service.one_audio_url(db, question)
    )


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

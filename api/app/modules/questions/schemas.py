"""Schema cho kho câu hỏi.

Hai tầng kiểm tra, cố ý tách rời:

  1. `QuestionCreate` / `QuestionUpdate` — hình dạng chung của một câu hỏi.
  2. `validate_payload()` — nội dung bên trong `content` và `answer`, khác nhau
     theo từng dạng bài.

Tách ra vì tầng 2 sẽ dài dần theo số dạng bài (16 dạng theo hợp đồng dữ liệu),
còn tầng 1 thì không đổi. Gộp chung là mỗi lần thêm dạng lại phải đụng vào lớp
mà mọi dạng đều dùng.

Vì sao kiểm ở server dù builder đã kiểm: builder chỉ ngăn được người dùng cẩn
thận. Một câu hỏi không có đáp án đúng sẽ khiến cả lớp bị 0 điểm và không ai
hiểu vì sao — đắt hơn nhiều so với việc kiểm hai lần.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.core.errors import ErrorCode, ValidationFailedError
from app.db.models import PromptKind, QuestionStatus, QuestionType

MAX_OPTIONS = 6
MIN_OPTIONS = 2
MAX_GAPS = 20

#: Ô trống trong câu: `{{1}}`, `{{ 2 }}`. Khớp cả khi có khoảng trắng thừa vì
#: giáo viên gõ tay được (builder chèn hộ, nhưng không cấm sửa trực tiếp).
_GAP_PATTERN = re.compile(r"\{\{\s*(\w+)\s*\}\}")


# ==========================================================================
# Tầng 1 — hình dạng chung
# ==========================================================================


class QuestionCreate(BaseModel):
    # Cố ý để `str` chứ không phải Literal: dạng lạ phải bị router từ chối bằng
    # mã QUESTION_TYPE_NOT_SUPPORTED có bản dịch, chứ không phải bằng lỗi 422
    # thô của Pydantic mà giáo viên đọc không hiểu.
    type: str
    points: int = Field(default=1, ge=1, le=100)
    time_limit_seconds: int | None = Field(default=None, ge=5, le=3600)
    content: dict[str, Any]
    answer: dict[str, Any]
    explanation: str | None = Field(default=None, max_length=4000)
    status: str = QuestionStatus.DRAFT
    level: str | None = Field(default=None, max_length=32)
    topic: str | None = Field(default=None, max_length=128)
    tags: list[str] = Field(default_factory=list, max_length=20)
    image_media_id: uuid.UUID | None = None
    audio_media_id: uuid.UUID | None = None
    audio_max_plays: int | None = Field(default=None, ge=1, le=10)
    #: CÁCH RA ĐỀ — đọc hay nghe. Vuông góc với `type`; xem `PromptKind`.
    #:
    #: `Literal` chứ không phải `str` (khác `type` ngay trên): danh sách này
    #: ngắn, đóng, và do CHECK trong database chốt lại — nên một giá trị lạ là
    #: lỗi 422 rõ ràng, không cần một mã lỗi có bản dịch riêng.
    prompt_kind: Literal["text", "audio"] = PromptKind.TEXT
    #: Đoạn chữ của đề mở sẵn cạnh trình phát. Chỉ có nghĩa khi nghe.
    show_transcript: bool = False


class QuestionUpdate(BaseModel):
    """Mọi trường đều tuỳ chọn — builder lưu nháp liên tục, không gửi lại cả câu.

    `content` và `answer` phải đi CÙNG NHAU khi sửa: đáp án luôn tham chiếu tới
    id của lựa chọn trong đề, gửi lẻ một cái là hai bên lệch nhau.
    """

    points: int | None = Field(default=None, ge=1, le=100)
    time_limit_seconds: int | None = Field(default=None, ge=5, le=3600)
    content: dict[str, Any] | None = None
    answer: dict[str, Any] | None = None
    explanation: str | None = Field(default=None, max_length=4000)
    status: str | None = None
    level: str | None = Field(default=None, max_length=32)
    topic: str | None = Field(default=None, max_length=128)
    tags: list[str] | None = Field(default=None, max_length=20)
    image_media_id: uuid.UUID | None = None
    audio_media_id: uuid.UUID | None = None
    audio_max_plays: int | None = Field(default=None, ge=1, le=10)
    prompt_kind: Literal["text", "audio"] | None = None
    show_transcript: bool | None = None


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    # Literal chứ không phải str (khác bản LMS): kiểu TS sinh ra thành union,
    # nên frontend gán nhầm một dạng không tồn tại sẽ gãy lúc biên dịch.
    # Chiều VÀO (QuestionCreate) vẫn để `str` — có lý do, xem ghi chú ở đó.
    #
    # ⚠️ Danh sách này phải KHỚP `QuestionType.ALL`. Không sinh tự động được vì
    # `Literal` cần giá trị tĩnh để công cụ kiểm kiểu và bộ sinh OpenAPI đọc ra.
    # Thiếu một dạng ở đây thì câu hỏi LƯU ĐƯỢC nhưng vỡ lúc trả về, và lỗi hiện
    # ra là 500 không nói gì — nên có một test khoá hai danh sách lại với nhau.
    type: Literal["MCQ_SINGLE", "MCQ_MULTI", "GAP_FILL", "GAP_DROPDOWN", "SHORT_ANSWER"]
    schema_version: int
    points: int
    time_limit_seconds: int | None
    content: dict[str, Any]
    #: Chỉ có khi người gọi được phép thấy đáp án. Xem `service.to_out()`.
    answer: dict[str, Any] | None = None
    explanation: str | None = None
    status: Literal["draft", "published"]
    level: str | None
    topic: str | None
    tags: list[str]
    #: ĐỊA CHỈ GỐC nếu câu này đến từ file .xlsx nội dung. Câu soạn tay thì cả
    #: ba đều `None`, và giao diện không hiện gì cả.
    world_code: str | None = None
    stage_code: str | None = None
    quest_code: str | None = None
    question_order: int | None = None

    #: CÁCH RA ĐỀ — đọc hay nghe. Xem `PromptKind` và GAME_DOMAIN §3c.
    prompt_kind: Literal["text", "audio"] = PromptKind.TEXT
    #: Đoạn chữ của đề mở sẵn cạnh trình phát. Nút Transcript thì luôn có.
    show_transcript: bool = False
    audio_media_id: uuid.UUID | None = None
    #: URL tệp nghe, dựng sẵn để giao diện không phải tra bảng media — cùng nếp
    #: với `icon_url` của nhiệm vụ và `background_url` của màn chơi.
    audio_url: str | None = None

    created_at: datetime
    updated_at: datetime


class ImportReportOut(BaseModel):
    """Kết quả một lần nhập file .xlsx.

    Mọi con số ở đây đều kiểm chứng được bằng cách mở kho ra đếm. Đó là chủ ý:
    nhập khẩu là thao tác ghi hàng loạt, và thứ người dùng cần ngay sau đó là
    bằng chứng chuyện vừa xảy ra đúng như họ tưởng.
    """

    created: int
    updated: int
    linked: int
    already_linked: int
    in_bank: int
    #: Mã nhiệm vụ chưa tồn tại. Đây là danh sách việc-cần-làm: điền mã này vào
    #: nhiệm vụ trong trình thiết kế rồi nhập lại là chúng tự lắp vào.
    missing_quest_codes: list[str]
    #: Dòng bị bỏ qua, kèm lý do đọc được.
    skipped: list[str]


class QuestionCodesOut(BaseModel):
    """Những mã định danh đang CÓ THẬT trong kho, để dựng ô chọn bộ lọc.

    Chỉ là danh sách chuỗi: chỗ gọi không cần biết mỗi mã có bao nhiêu câu, nó
    cần biết chọn được những gì.
    """

    world_codes: list[str]
    stage_codes: list[str]
    #: Thu hẹp theo `stage_code` khi truy vấn có truyền — xem `service.list_codes`.
    quest_codes: list[str]


class QuestionListOut(BaseModel):
    items: list[QuestionOut]
    total: int


class GradePreviewIn(BaseModel):
    """Chấm thử một câu trả lời mà không lưu gì.

    Dùng cho nút "Xem trước" của giáo viên và cho chế độ luyện tập của học sinh.
    """

    response: dict[str, Any] | None = None


class GradeDetail(BaseModel):
    """Chi tiết chấm từng phần.

    Khai báo rõ thay vì `dict[str, Any]` (khác bản LMS): OpenAPI sinh ra
    `{}` cho dict trần, và frontend không đọc được `detail.gaps` nếu không ép
    kiểu — mà ép kiểu là chỗ nói dối trình biên dịch.
    """

    #: Ô trống nào đúng: {"1": true, "2": false}. Chỉ có ở GAP_FILL/GAP_DROPDOWN.
    gaps: dict[str, bool] | None = None


class GradePreviewOut(BaseModel):
    score: float
    max_score: int
    is_correct: bool
    detail: GradeDetail | None = None


# ==========================================================================
# Tầng 2 — nội dung theo từng dạng
# ==========================================================================


def _fail(code: str, **params: Any) -> None:
    raise ValidationFailedError(code, **params)


def _require_text(value: Any, field_name: str) -> str:
    text = (value or "").strip() if isinstance(value, str) else ""
    if not text:
        _fail(ErrorCode.QUESTION_FIELD_EMPTY, field=field_name)
    return text


def _validate_mcq(content: dict, answer: dict, multi: bool) -> None:
    _require_text(content.get("prompt"), "prompt")

    options = content.get("options") or []
    if not MIN_OPTIONS <= len(options) <= MAX_OPTIONS:
        _fail(ErrorCode.QUESTION_OPTION_COUNT, min=MIN_OPTIONS, max=MAX_OPTIONS)

    ids: list[str] = []
    for index, option in enumerate(options):
        option_id = (option or {}).get("id")
        if not option_id:
            _fail(ErrorCode.QUESTION_OPTION_NO_ID, index=index)
        # Lựa chọn được phép là ảnh hoặc audio thay vì chữ, nên chỉ bắt buộc
        # phải có ÍT NHẤT một thứ để học sinh nhìn thấy.
        # `_has_value` chứ không phải `option.get(k)`: chuỗi một dấu cách là
        # giá trị "thật" với Python nhưng là ô trống với người dùng.
        if not any(_has_value(option.get(k)) for k in ("text", "image", "audio")):
            _fail(ErrorCode.QUESTION_OPTION_EMPTY, index=index)
        ids.append(option_id)

    if len(set(ids)) != len(ids):
        _fail(ErrorCode.QUESTION_OPTION_DUPLICATE_ID)

    # Hai lựa chọn cùng chữ thì học sinh chọn cái nào cũng tưởng đúng, mà chỉ
    # một cái được tính điểm. Lỗi này rất khó phát hiện khi đọc lại đề.
    texts = [_normalized_option_text(o) for o in options if o.get("text")]
    if len(set(texts)) != len(texts):
        _fail(ErrorCode.QUESTION_OPTION_DUPLICATE_TEXT)

    if multi:
        correct = answer.get("correctOptionIds") or []
        if not correct:
            _fail(ErrorCode.QUESTION_NO_CORRECT_ANSWER)
        if len(set(correct)) != len(correct):
            _fail(ErrorCode.QUESTION_CORRECT_DUPLICATE)
        unknown = set(correct) - set(ids)
        if unknown:
            _fail(ErrorCode.QUESTION_CORRECT_NOT_IN_OPTIONS)
        if len(correct) == len(ids):
            # Đúng hết thì không còn là câu hỏi nữa.
            _fail(ErrorCode.QUESTION_ALL_OPTIONS_CORRECT)
    else:
        correct_id = answer.get("correctOptionId")
        if not correct_id:
            _fail(ErrorCode.QUESTION_NO_CORRECT_ANSWER)
        if correct_id not in ids:
            _fail(ErrorCode.QUESTION_CORRECT_NOT_IN_OPTIONS)


def _has_value(value: Any) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    return bool(value)


def _normalized_option_text(option: dict) -> str:
    return " ".join(str(option.get("text") or "").lower().split())


def _gap_keys(template: str) -> list[str]:
    """Rút các ô trống `{{1}}` `{{2}}` ra khỏi câu, giữ nguyên thứ tự xuất hiện."""
    return _GAP_PATTERN.findall(template or "")


def _validate_gap_template(content: dict) -> list[str]:
    template = _require_text(content.get("template"), "template")
    keys = _gap_keys(template)
    if not keys:
        _fail(ErrorCode.QUESTION_NO_GAP)
    if len(keys) > MAX_GAPS:
        _fail(ErrorCode.QUESTION_TOO_MANY_GAPS, max=MAX_GAPS)
    if len(set(keys)) != len(keys):
        _fail(ErrorCode.QUESTION_GAP_DUPLICATE)
    return keys


def _validate_gap_fill(content: dict, answer: dict) -> None:
    keys = _validate_gap_template(content)
    gaps = answer.get("gaps") or {}

    for key in keys:
        spec = gaps.get(key) or {}
        accepted = [a for a in (spec.get("accepted") or []) if str(a).strip()]
        if not accepted:
            # Ô không có đáp án nào thì học sinh gõ gì cũng sai.
            _fail(ErrorCode.QUESTION_GAP_NO_ANSWER, gap=key)


def _validate_gap_dropdown(content: dict, answer: dict) -> None:
    keys = _validate_gap_template(content)
    content_gaps = content.get("gaps") or {}
    answer_gaps = answer.get("gaps") or {}

    for key in keys:
        options = (content_gaps.get(key) or {}).get("options") or []
        if not MIN_OPTIONS <= len(options) <= MAX_OPTIONS:
            _fail(ErrorCode.QUESTION_GAP_OPTION_COUNT, gap=key, min=MIN_OPTIONS, max=MAX_OPTIONS)

        ids = [o.get("id") for o in options]
        if not all(ids):
            _fail(ErrorCode.QUESTION_OPTION_NO_ID, gap=key)
        if len(set(ids)) != len(ids):
            _fail(ErrorCode.QUESTION_OPTION_DUPLICATE_ID, gap=key)

        texts = [_normalized_option_text(o) for o in options]
        if not all(texts):
            _fail(ErrorCode.QUESTION_OPTION_EMPTY, gap=key)
        if len(set(texts)) != len(texts):
            _fail(ErrorCode.QUESTION_OPTION_DUPLICATE_TEXT, gap=key)

        correct_id = answer_gaps.get(key)
        if not correct_id:
            _fail(ErrorCode.QUESTION_GAP_NO_ANSWER, gap=key)
        if correct_id not in ids:
            _fail(ErrorCode.QUESTION_CORRECT_NOT_IN_OPTIONS, gap=key)


def _validate_short_answer(content: dict, answer: dict) -> None:
    """Học sinh GÕ câu trả lời; chấm bằng cách khớp danh sách `accepted`.

    `accepted` phải có ít nhất một cách viết. Danh sách rỗng nghĩa là gõ gì cũng
    sai — một câu hỏi không ai trả lời đúng được, và người soạn chỉ phát hiện ra
    khi có học sinh đang làm bài.
    """
    _require_text(content.get("prompt"), "prompt")

    accepted = [a for a in (answer.get("accepted") or []) if str(a).strip()]
    if not accepted:
        _fail(ErrorCode.QUESTION_NO_CORRECT_ANSWER)


#: Dạng nào kiểm bằng hàm nào. Thêm dạng mới = thêm một dòng.
_VALIDATORS = {
    QuestionType.MCQ_SINGLE: lambda c, a: _validate_mcq(c, a, multi=False),
    QuestionType.MCQ_MULTI: lambda c, a: _validate_mcq(c, a, multi=True),
    QuestionType.GAP_FILL: _validate_gap_fill,
    QuestionType.GAP_DROPDOWN: _validate_gap_dropdown,
    QuestionType.SHORT_ANSWER: _validate_short_answer,
}


def validate_payload(qtype: str, content: dict, answer: dict) -> None:
    """Kiểm nội dung câu hỏi trước khi ghi xuống database.

    Dạng chưa hỗ trợ thì TỪ CHỐI, không cho lưu. Lưu được một dạng mà chưa có
    hàm chấm nghĩa là tạo ra dữ liệu không ai chấm nổi.
    """
    validator = _VALIDATORS.get(qtype)
    if validator is None:
        _fail(ErrorCode.QUESTION_TYPE_NOT_SUPPORTED, type=qtype)
    else:
        validator(content, answer)

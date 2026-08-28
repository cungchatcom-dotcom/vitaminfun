"""Kho câu hỏi — nội dung của MỌI nhiệm vụ trong game.

Đây là bảng quan trọng nhất của phần tái sử dụng LMS. Xem docs/GAME_DOMAIN.md §1.1:

    Nhiệm vụ LÀ câu hỏi. Không bao giờ tạo bảng `game_questions` riêng.

Nhiệm vụ khác câu hỏi ở chỗ **nó gắn vào vật thể nào trong cảnh** và **tốn bao
nhiêu năng lượng** — hai thứ đó nằm ở bảng `quests` (Bước 3), không nằm ở đây.

⚠️ Đề bài KHÔNG dùng khoá i18n. Quy tắc "chữ hiển thị phải đa ngôn ngữ" nói về
chữ của GIAO DIỆN — nút bấm, nhãn, thông báo. Còn nội dung do giáo viên soạn là
dữ liệu của họ: một câu hỏi tiếng Anh thì viết bằng tiếng Anh, không có bản dịch
và cũng không nên có.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class QuestionType:
    """Mã dạng câu hỏi. Nguồn chân lý: `docs/question-schemas.md`.

    Đợt 1 làm 4 mã dưới đây — đúng bốn dạng mà `grading/graders.py` chấm được.
    Thêm dạng mới = thêm hằng số + schema + hàm chấm + test; KHÔNG phải sửa bảng.

    Đợt 2 (Bước 9): SHORT_ANSWER, MATCHING, REORDER, READ_ALOUD.
    """

    MCQ_SINGLE = "MCQ_SINGLE"
    MCQ_MULTI = "MCQ_MULTI"
    GAP_FILL = "GAP_FILL"
    GAP_DROPDOWN = "GAP_DROPDOWN"

    ALL = (MCQ_SINGLE, MCQ_MULTI, GAP_FILL, GAP_DROPDOWN)


class QuestionStatus:
    DRAFT = "draft"
    PUBLISHED = "published"

    ALL = (DRAFT, PUBLISHED)


class Question(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "questions"
    __table_args__ = (
        # Kho câu hỏi luôn được lọc theo dạng và theo trạng thái.
        Index("ix_questions_type", "type"),
        Index("ix_questions_status", "status"),
        CheckConstraint("status IN ('draft', 'published')", name="status_valid"),
        CheckConstraint("points >= 0", name="points_non_negative"),
    )

    #: Ai soạn. Giữ câu hỏi lại cả khi người đó bị xoá, nên KHÔNG cascade delete.
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    type: Mapped[str] = mapped_column(String(32), nullable=False)
    #: Tăng khi cấu trúc `content_json` / `answer_json` của một dạng đổi kiểu
    #: không tương thích. Có cột này thì mới đọc được dữ liệu cũ sau khi đổi.
    schema_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    #: Điểm tối đa. Số nguyên — điểm lẻ sinh ra khi CHẤM (đúng 2/3 ô trống),
    #: không phải khi soạn.
    points: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    time_limit_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    #: Đề bài — KHÔNG chứa đáp án. Đây là thứ duy nhất được đóng băng vào
    #: `stage_runs.snapshot_json` và gửi xuống máy học sinh khi đang chơi.
    content_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    #: Đáp án + cấu hình chấm. Vào `stage_runs.answer_key_json`, KHÔNG BAO GIỜ
    #: rời server khi đang chơi. Chỉ lộ ở màn xem lại sau khi hết màn (S6b).
    answer_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    #: Giải thích, hiện ở màn xem lại bài (S6b). Xem docs/GAME_DOMAIN.md §1.6 —
    #: đây là lý do trường này tồn tại, nên màn soạn câu hỏi phải nhắc giáo viên
    #: viết cho tử tế.
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Ảnh/âm thanh trỏ tới `media_assets.id`, không lưu URL trần.
    image_media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    audio_media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    #: Số lần được nghe lại. None = không giới hạn.
    #: Trong game, nghe lại còn tốn năng lượng đội (`balance_json.energyCost.replayAudio`).
    audio_max_plays: Mapped[int | None] = mapped_column(Integer, nullable=True)

    status: Mapped[str] = mapped_column(String(16), default=QuestionStatus.DRAFT, nullable=False)
    #: Trình độ CEFR ("Pre-A1", "A1"...). Dùng để lọc khi gán câu hỏi vào nhiệm vụ.
    level: Mapped[str | None] = mapped_column(String(32), nullable=True)
    topic: Mapped[str | None] = mapped_column(String(128), nullable=True)
    #: ["vocab:atlantis", "grammar:imperatives"] — thành `grammarHint` trong game.
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)

    #: Xoá mềm — câu hỏi có thể đã nằm trong lượt chơi mà học sinh đã hoàn thành.
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    def __repr__(self) -> str:
        return f"<Question {self.type} {self.status}>"

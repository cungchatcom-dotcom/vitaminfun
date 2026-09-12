"""AUDIO đã sinh cho câu hỏi — đọc chữ thành tiếng, lưu lại để khỏi sinh lại.

## Khoá theo GIỌNG, không theo màn chơi

Một dòng là `(câu hỏi, giọng, chỗ cần đọc)`. Cùng một câu hỏi lắp vào world khác,
màn khác, người canh giữ khác — nếu **cùng giọng** thì audio cũ dùng lại được
ngay, không tốn thêm một lượt gọi API nào. Giọng khác thì coi như chưa có, vì
đúng là chưa có: một câu đọc bằng giọng nam trung niên không thay được cho giọng
nữ trẻ.

Khoá theo màn chơi thì mỗi màn một bản sao của cùng một file, và tiền trả cho
nhà cung cấp nhân lên theo số màn dùng lại câu hỏi đó.

## Vì sao KHÔNG nhét vào `content_json`

`content_json` bị đóng băng vào đề bài rồi gửi thẳng xuống máy học sinh. Audio
thì sinh sau, sinh dần, và sinh lại được — nhét vào đó là mỗi lần sinh một file
lại phải sửa nội dung câu hỏi, mà nội dung câu hỏi là thứ giáo viên đang soạn.
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AudioTarget:
    """Chỗ nào của câu hỏi được đọc lên."""

    #: Đề bài — thứ người canh giữ nói.
    PROMPT = "prompt"
    #: Một phương án trả lời — thứ nhân vật học sinh nói.
    OPTION = "option"

    ALL = (PROMPT, OPTION)


class QuestionAudio(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "question_audios"
    __table_args__ = (
        UniqueConstraint(
            "question_id",
            "voice_id",
            "target",
            "option_key",
            name="uq_question_audio_slot",
        ),
    )

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    voice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("voices.id", ondelete="CASCADE"), nullable=False, index=True
    )

    target: Mapped[str] = mapped_column(String(16), nullable=False)

    #: Phương án nào. Chuỗi RỖNG cho đề bài — không phải `NULL`.
    #:
    #: Postgres coi hai `NULL` là khác nhau, nên một cột `NULL` ở đây làm ràng
    #: buộc duy nhất mất tác dụng đúng với đề bài: sinh hai lần là hai dòng, và
    #: không có gì ngăn được.
    #:
    #: Câu điền khuyết có nhiều ô, mỗi ô một bộ phương án trùng mã nhau, nên
    #: khoá là `"<ô>:<mã>"`.
    option_key: Mapped[str] = mapped_column(String(64), default="", nullable=False)

    media_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="CASCADE"), nullable=False
    )

    def __repr__(self) -> str:  # pragma: no cover - chỉ để đọc log
        return f"<QuestionAudio {self.target}:{self.option_key or '-'}>"

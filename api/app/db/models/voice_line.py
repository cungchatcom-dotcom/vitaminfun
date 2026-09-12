"""TIẾNG ĐỌC của một CÂU RỜI, khoá theo GIỌNG và theo chính đoạn chữ.

## Khác `question_audios` ở chỗ nào

`question_audios` gắn vào một câu hỏi. Lời phán thì không thuộc câu hỏi nào: nó
là câu người canh giữ nói ra sau khi chấm, và cùng một câu *"Chuẩn."* dùng lại
cho mọi câu hỏi trong world. Nhét nó vào bảng kia thì phải bịa ra một
`question_id`, và mỗi câu hỏi lại một bản thu của cùng một tiếng.

## Khoá là (GIỌNG, BĂM CỦA ĐOẠN CHỮ)

Không phải `(world, vị trí trong danh sách)`. Hai lý do:

1. **Dùng lại được thật.** Hai nhiệm vụ khác nhau, hai người canh giữ khác
   nhau, nhưng nếu họ chọn cùng một giọng thì cùng một câu *"Chuẩn."* đã thu
   rồi — không sinh lại, không tốn thêm.

2. **Sửa chữ là tự hết hạn.** Người dựng đổi *"Chuẩn."* thành *"Khá lắm."* thì
   băm đổi theo, và bản thu cũ tự khắc không còn khớp với câu nào. Khoá theo vị
   trí thì bản thu cũ vẫn nằm đó, vẫn được phát, và người canh giữ nói một câu
   không còn tồn tại trên màn hình.
"""

from __future__ import annotations

import hashlib
import uuid

from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


def line_hash(text: str) -> str:
    """Băm của một câu, sau khi dọn khoảng trắng hai đầu.

    Dọn trước khi băm: một dấu cách thừa ở cuối là thứ không ai nhìn thấy, và
    để nó đổi băm thì người dựng trả tiền thu lại một câu y hệt.
    """
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()[:64]


class VoiceLine(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "voice_lines"
    __table_args__ = (
        UniqueConstraint("voice_id", "text_hash", name="uq_voice_line_slot"),
        Index("ix_voice_lines_voice_id", "voice_id"),
    )

    voice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("voices.id", ondelete="CASCADE"), nullable=False
    )
    text_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    #: Giữ nguyên văn bên cạnh băm — để soi database còn biết đây là câu gì.
    text: Mapped[str] = mapped_column(Text, nullable=False)
    media_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="CASCADE"), nullable=False
    )

    def __repr__(self) -> str:
        return f"<VoiceLine {self.text[:24]!r}>"

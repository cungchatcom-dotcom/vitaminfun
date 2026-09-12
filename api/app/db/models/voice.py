"""Kho GIỌNG ĐỌC — danh mục giọng lấy về từ các dịch vụ đọc chữ thành tiếng.

Một BẢN SAO của danh mục bên nhà cung cấp, không phải một hàng đợi gọi API.
Người dựng nội dung mở ô chọn giọng ra là thấy ngay hai chục giọng kèm nhãn
giới tính, độ tuổi, chất giọng — nếu mỗi lần mở ô chọn lại phải gọi ra
ElevenLabs thì màn hình đứng chờ vài giây, và một sự cố mạng bên họ là không ai
đặt được giọng cho nhân vật nào.

Đồng bộ bằng tay qua `POST /voices/sync`. Không tự chạy nền: danh mục giọng của
một nhà cung cấp gần như không đổi, và một tác vụ nền âm thầm gọi API tính tiền
là thứ không ai nhớ mình đã bật.

`provider` là một chuỗi tự do chứ không phải enum: thêm minimax hay gemini-tts
là thêm một lớp trong `modules/voices/providers.py`, không phải một migration.
"""

from __future__ import annotations

from sqlalchemy import String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class VoiceGender:
    """Nhãn giới tính, đúng bộ ElevenLabs trả về."""

    MALE = "male"
    FEMALE = "female"
    NEUTRAL = "neutral"

    ALL = (MALE, FEMALE, NEUTRAL)


class VoiceAge:
    """Nhóm tuổi, đúng bộ ElevenLabs trả về."""

    YOUNG = "young"
    MIDDLE_AGED = "middle_aged"
    OLD = "old"

    ALL = (YOUNG, MIDDLE_AGED, OLD)


class Voice(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "voices"
    __table_args__ = (
        # Một giọng của một nhà cung cấp chỉ có MỘT dòng. Đồng bộ lần hai thì
        # cập nhật dòng cũ, không đẻ thêm bản sao — mà nhân vật thì đang trỏ
        # vào dòng cũ đó.
        UniqueConstraint("provider", "external_id", name="uq_voices_provider_external"),
    )

    #: `elevenlabs`, và sau này có thể `minimax`, `gemini`. Chuỗi tự do.
    provider: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    #: Mã giọng BÊN NHÀ CUNG CẤP — thứ gửi đi khi gọi API đọc chữ thành tiếng.
    external_id: Mapped[str] = mapped_column(String(128), nullable=False)

    name: Mapped[str] = mapped_column(String(128), nullable=False)

    #: Ba nhãn để LỌC trong ô chọn. `None` = nhà cung cấp không nói.
    gender: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    age_group: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    accent: Mapped[str | None] = mapped_column(String(32), nullable=True)

    #: Tính cách giọng (`calm`, `confident`…) và chỗ dùng (`narrative_story`…).
    #: Chỉ để người dựng đọc mà chọn, không lọc theo.
    style: Mapped[str | None] = mapped_column(String(32), nullable=True)
    use_case: Mapped[str | None] = mapped_column(String(32), nullable=True)

    #: Mã ngôn ngữ. Hiện chỉ đồng bộ `en` — game này dạy tiếng Anh.
    language: Mapped[str] = mapped_column(String(8), default="en", nullable=False, index=True)

    #: Đoạn mẫu để nghe thử. URL của nhà cung cấp, KHÔNG qua kho media của ta:
    #: nó là tài sản của họ, đổi khi họ đổi, và tải về là giữ một bản sao sẽ cũ đi.
    preview_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - chỉ để đọc log
        return f"<Voice {self.provider}:{self.name}>"

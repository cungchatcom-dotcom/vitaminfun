"""Kho media — ảnh, âm thanh cho câu hỏi, nền màn chơi, chân dung NPC.

LUẬT: không cột nào trong hệ thống được lưu URL trần. Ảnh và audio luôn trỏ tới
`media_assets.id`. Nhờ vậy đổi chỗ lưu trữ (đĩa local sang S3) là đổi một cột
`url` ở đây, không phải đi sửa dữ liệu rải rác trong `content_json` của hàng
nghìn câu hỏi.

Cố ý KHÔNG mang sang từ LMS: `slot_definitions` và `asset_slots` — cơ chế
"chỗ cắm ảnh" cho admin đổi giao diện. Đó là nghiệp vụ của một LMS bán cho
nhiều trung tâm, không phải của game này.
"""

from __future__ import annotations

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class MediaKind:
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"

    ALL = (IMAGE, AUDIO, VIDEO)


class MediaAsset(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "media_assets"
    __table_args__ = (
        CheckConstraint("kind IN ('image', 'audio', 'video')", name="kind_valid"),
    )

    #: URL công khai để trình duyệt tải. Sinh từ `STORAGE_PUBLIC_URL` + storage_key.
    url: Mapped[str] = mapped_column(Text, nullable=False)
    #: Đường dẫn tương đối trong kho lưu trữ. Đây mới là thứ định danh file thật;
    #: `url` chỉ là cách hiện tại để với tới nó.
    storage_key: Mapped[str] = mapped_column(Text, nullable=False, unique=True)

    kind: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    mime: Mapped[str | None] = mapped_column(String(128), nullable=True)
    original_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    #: Chữ thay thế cho ảnh, đa ngôn ngữ: {"vi": "...", "en": "..."}.
    alt_i18n: Mapped[dict[str, str]] = mapped_column(JSONB, default=dict, nullable=False)
    folder: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    #: Ai tải lên. Giữ lại file cả khi người đó bị xoá, nên SET NULL.
    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    def __repr__(self) -> str:
        return f"<MediaAsset {self.kind} {self.storage_key}>"

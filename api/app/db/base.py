"""Nền tảng ORM: Base, mixin dùng chung, kiểu dữ liệu tuỳ biến.

Quy ước bắt buộc (docs/GAME_DOMAIN.md):
  - Khoá chính UUIDv7 — sắp xếp được theo thời gian, khác UUIDv4 ngẫu nhiên.
  - Mọi bảng có created_at / updated_at.
  - Trường hiển thị cho người dùng dùng TranslatableText (JSONB), KHÔNG dùng varchar.
  - Trường ảnh trỏ media_assets.id, KHÔNG lưu URL trần.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, MetaData, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from uuid_utils import uuid7

# Đặt tên constraint theo quy ước để Alembic sinh migration ổn định, không bị
# đổi tên lung tung giữa các lần autogenerate.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)

    type_annotation_map = {
        dict[str, Any]: JSONB,
        dict[str, str]: JSONB,
    }


def new_uuid() -> uuid.UUID:
    """UUIDv7 — có thành phần thời gian nên index B-tree không bị phân mảnh."""
    return uuid.UUID(str(uuid7()))


class UUIDPrimaryKeyMixin:
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


TranslatableText = JSONB
"""Trường đa ngôn ngữ: {"vi": "Boong tàu", "en": "Ship deck"}.

Dùng cho MỌI trường hiển thị cho người dùng. Đổi varchar sang JSONB về sau rất
đắt, nên phải quyết đúng ngay từ migration đầu tiên.
"""

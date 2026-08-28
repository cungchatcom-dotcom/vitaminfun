"""Phòng chơi và thành viên trong phòng. Xem docs/GAME_DOMAIN.md §3.3."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class RoomMode:
    SINGLE = "single"
    MULTI = "multi"

    ALL = (SINGLE, MULTI)


class RoomStatus:
    WAITING = "waiting"  # đang chờ người vào
    STARTING = "starting"  # đã đếm ngược, sắp vào trận
    PLAYING = "playing"
    FINISHED = "finished"
    ABANDONED = "abandoned"  # mọi người thoát hết trước khi bắt đầu

    ALL = (WAITING, STARTING, PLAYING, FINISHED, ABANDONED)


class HeroKey:
    """Bốn nhân vật của Lost in Atlantis."""

    LEO = "leo"
    MAYA = "maya"
    SAM = "sam"
    JADE = "jade"

    ALL = (LEO, MAYA, SAM, JADE)


class Room(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "rooms"
    __table_args__ = (
        CheckConstraint("mode IN ('single', 'multi')", name="mode_valid"),
        CheckConstraint(
            "status IN ('waiting', 'starting', 'playing', 'finished', 'abandoned')",
            name="status_valid",
        ),
    )

    #: Mã mời gõ tay được: "ATL-A12". Unique để tra thẳng từ URL.
    code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False, index=True)

    stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    host_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    mode: Mapped[str] = mapped_column(String(16), default=RoomMode.MULTI, nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), default=RoomStatus.WAITING, nullable=False, index=True
    )

    #: Mốc tự bắt đầu, đặt bằng `balance_json.lobbyCountdownSeconds`.
    auto_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    #: Phòng do giáo viên/admin tạo để chơi thử. Danh sách phòng công khai LỌC
    #: BỎ những phòng này — học sinh không được vào nhầm bản nháp.
    #: Xem docs/ARCHITECTURE.md §4.
    is_trial: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<Room {self.code} {self.status}>"


class RoomMember(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Một chỗ ngồi trong phòng.

    ⭐ `UNIQUE(room_id, hero_key)` cưỡng chế luật **"mỗi người một nhân vật"** ở
    tầng database. Hai người cùng bấm chọn Leo trong cùng một phần nghìn giây
    thì người sau bị từ chối — không phụ thuộc vào việc code có kiểm hay không.
    """

    __tablename__ = "room_members"
    __table_args__ = (
        UniqueConstraint("room_id", "hero_key", name="uq_room_members_room_hero"),
        # Một người chỉ có một chỗ trong phòng. NULL (Bot) không bị ràng buộc
        # bởi UNIQUE trong PostgreSQL, nên nhiều Bot vẫn vào được.
        UniqueConstraint("room_id", "user_id", name="uq_room_members_room_user"),
        CheckConstraint(
            "hero_key IN ('leo', 'maya', 'sam', 'jade')",
            name="hero_key_valid",
        ),
        # Bot thì không có user; người thật thì phải có.
        CheckConstraint(
            "(is_bot AND user_id IS NULL) OR (NOT is_bot AND user_id IS NOT NULL)",
            name="bot_has_no_user",
        ),
    )

    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )

    hero_key: Mapped[str] = mapped_column(String(16), nullable=False)
    is_bot: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_ready: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

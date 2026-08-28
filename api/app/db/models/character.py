"""Nhân vật người chơi và spritesheet cho từng hành động."""

from __future__ import annotations

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, TranslatableText, UUIDPrimaryKeyMixin
from app.db.models.content import PublishStatus


class Character(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Nhân vật học sinh chọn khi vào world.

    Ảnh đại diện dùng ở màn CHỌN nhân vật; thứ Phaser vẽ trong màn chơi là các
    spritesheet ở `character_actions`. Hai thứ khác nhau và không thay nhau
    được: một tấm chân dung đẹp không cắt ra thành khung đi bộ được.
    """

    __tablename__ = "characters"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'published')", name="status_valid"),
    )

    name_i18n: Mapped[dict[str, str]] = mapped_column(TranslatableText, nullable=False)
    bio_i18n: Mapped[dict[str, str]] = mapped_column(
        TranslatableText, default=dict, nullable=False
    )
    avatar_media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), default=PublishStatus.DRAFT, nullable=False)

    def __repr__(self) -> str:
        return f"<Character {self.name_i18n.get('en', '?')}>"


class WorldCharacter(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Nhân vật nào dùng được ở world nào.

    Bảng nối chứ không phải cột trên `characters`: một nhân vật dùng được ở
    nhiều world, và một world cho nhiều nhân vật. Xoá world hay xoá nhân vật
    thì bản ghi nối đi theo, nhưng bản thân nhân vật và ảnh của nó không bị
    đụng tới.
    """

    __tablename__ = "world_characters"
    __table_args__ = (UniqueConstraint("world_id", "character_id", name="uq_world_characters"),)

    world_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("worlds.id", ondelete="CASCADE"), nullable=False, index=True
    )
    character_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("characters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    def __repr__(self) -> str:
        return f"<WorldCharacter {self.world_id} -> {self.character_id}>"


class CharacterAction(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Một hành động của nhân vật, kèm tấm spritesheet vẽ nó.

    `action_key` là chuỗi TỰ DO ("idle", "walk", "run", "jump", "talk"…), không
    phải enum: thêm một hành động mới là việc của người dựng nội dung, không
    phải của một migration.

    Bốn con số dưới đây là đúng thứ Phaser cần để cắt tấm ảnh:

        this.load.spritesheet(key, url, { frameWidth, frameHeight })

    `frames = 1` là hợp lệ và có nghĩa: ảnh một khung, Phaser vẽ nó như hình
    tĩnh. Đó là lý do không có ràng buộc `frames > 1`.
    """

    __tablename__ = "character_actions"
    __table_args__ = (
        UniqueConstraint("character_id", "action_key", name="uq_character_actions_key"),
        CheckConstraint("frames >= 1 AND frames <= 240", name="frames_range"),
        CheckConstraint("frame_rate >= 1 AND frame_rate <= 60", name="rate_range"),
    )

    character_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    action_key: Mapped[str] = mapped_column(String(32), nullable=False)
    media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )

    #: Số khung trong tấm ảnh. 1 = ảnh tĩnh.
    frames: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    #: Kích thước MỘT khung, pixel. NULL = suy ra từ khổ ảnh chia cho `frames`.
    frame_width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    frame_height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    #: Số khung mỗi giây khi chạy.
    frame_rate: Mapped[int] = mapped_column(Integer, default=10, nullable=False)

    def __repr__(self) -> str:
        return f"<CharacterAction {self.action_key} x{self.frames}>"

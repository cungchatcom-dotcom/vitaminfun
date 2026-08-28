"""Nhan vat va spritesheet cho tung hanh dong

Hoc sinh chon mot nhan vat khi vao world; nhan vat do la thu Phaser ve trong
man choi.

Moi hanh dong (idle / walk / run / jump / talk ...) la MOT tam anh dai chua cac
khung xep lien tiep, cong bon con so de Phaser cat no ra:

    frame_width, frame_height   kich thuoc MOT khung, tinh bang pixel
    frames                      so khung trong tam anh
    frame_rate                  so khung mot giay khi chay

Anh chi co dung MOT khung van hop le: `frames = 1`, va Phaser ve no nhu mot
hinh tinh. Do la ly do khong co rang buoc `frames > 1`.

action_key la chuoi tu do, khong phai enum: them mot hanh dong moi la viec cua
nguoi dung noi dung, khong phai cua mot migration.

Revision ID: 0016_characters
Revises: 0015_frame_height
Create Date: 2026-08-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0016_characters"
down_revision: str | None = "0015_frame_height"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "characters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        # `server_default` la BAT BUOC, khong phai trang tri: `TimestampMixin`
        # dua vao dong ho cua DATABASE chu khong tu dien gio o Python, nen cot
        # thieu default se nem NotNullViolation ngay o lenh INSERT dau tien.
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("name_i18n", postgresql.JSONB(), nullable=False),
        sa.Column("bio_i18n", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column(
            "avatar_media_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("media_assets.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(16), nullable=False, server_default="draft"),
        sa.CheckConstraint("status IN ('draft', 'published')", name="ck_characters_status_valid"),
    )
    op.create_index("ix_characters_position", "characters", ["position"])

    op.create_table(
        "character_actions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        # `server_default` la BAT BUOC, khong phai trang tri: `TimestampMixin`
        # dua vao dong ho cua DATABASE chu khong tu dien gio o Python, nen cot
        # thieu default se nem NotNullViolation ngay o lenh INSERT dau tien.
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "character_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("characters.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("action_key", sa.String(32), nullable=False),
        sa.Column(
            "media_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("media_assets.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("frames", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("frame_width", sa.Integer(), nullable=True),
        sa.Column("frame_height", sa.Integer(), nullable=True),
        sa.Column("frame_rate", sa.Integer(), nullable=False, server_default="10"),
        # Mot nhan vat chi co MOT tam anh cho moi hanh dong.
        sa.UniqueConstraint("character_id", "action_key", name="uq_character_actions_key"),
        sa.CheckConstraint("frames >= 1 AND frames <= 240", name="ck_character_actions_frames"),
        sa.CheckConstraint(
            "frame_rate >= 1 AND frame_rate <= 60", name="ck_character_actions_rate"
        ),
    )


def downgrade() -> None:
    op.drop_table("character_actions")
    op.drop_index("ix_characters_position", table_name="characters")
    op.drop_table("characters")

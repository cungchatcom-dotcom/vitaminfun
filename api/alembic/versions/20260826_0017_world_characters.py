"""World chon duoc nhung nhan vat nao hoc sinh duoc dung

Bang noi, khong phai cot tren `characters`: mot nhan vat dung duoc o nhieu
world, va mot world cho nhieu nhan vat. Xoa world thi ban ghi noi di theo
(CASCADE); xoa nhan vat cung vay -- nhung ban than nhan vat va anh cua no thi
khong bi dong toi.

Revision ID: 0017_world_characters
Revises: 0016_characters
Create Date: 2026-08-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0017_world_characters"
down_revision: str | None = "0016_characters"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "world_characters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "world_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("worlds.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "character_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("characters.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("world_id", "character_id", name="uq_world_characters"),
    )


def downgrade() -> None:
    op.drop_table("world_characters")

"""Nhan vat hoc sinh da chon cho tung world

Cot tren `world_progress` chu khong phai bang moi: lua chon nay khoa theo dung
cap (world, user) ma bang do da khoa san, va no la mot phan cua "tien trinh
cua toi trong world nay".

SET NULL khi nhan vat bi xoa: hoc sinh quay lai thay o trong va chon lai, chu
khong mat ca tien trinh.

Revision ID: 0018_chosen_character
Revises: 0017_world_characters
Create Date: 2026-08-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0018_chosen_character"
down_revision: str | None = "0017_world_characters"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "world_progress",
        sa.Column(
            "character_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("characters.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("world_progress", "character_id")

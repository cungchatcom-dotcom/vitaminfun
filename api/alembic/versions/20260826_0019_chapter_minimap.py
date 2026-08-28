"""Anh nen minimap cua chuong

Cot RIENG, khong dung lai `cover_media_id`: hai anh phuc vu hai cho khac nhau
va co khuon hinh khac nhau. `cover` la mot o nho tren hang chuong o phong cho;
minimap la ca cai nen trai rong phia sau danh sach man choi. Dung chung mot anh
thi hoac o nho bi meo, hoac cai nen bi vo hat.

SET NULL khi anh bi xoa: chuong van mo ra binh thuong voi nen tron.

Revision ID: 0019_chapter_minimap
Revises: 0018_chosen_character
Create Date: 2026-08-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0019_chapter_minimap"
down_revision: str | None = "0018_chosen_character"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "chapters",
        sa.Column(
            "minimap_media_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("media_assets.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("chapters", "minimap_media_id")

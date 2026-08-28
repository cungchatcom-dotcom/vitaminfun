"""Chieu cao rieng cho khung, va anh rieng cho tung chuong

Khung tieu de / mo ta truoc day chi co be rong, chieu cao suy ra theo ti le goc
cua anh. Gio moi thanh phan keo tha duoc deu co ba tay cam -- phai, duoi, goc --
nen chieu cao phai luu duoc. NULL = van suy ra theo ti le anh, dung nhu cu.

chapters.cover_media_id: anh cua tung chuong, hien o hang chuong trong phong
cho world. Chuong nao chua co thi ve mot khung trong mang ten chuong.

Revision ID: 0015_frame_height
Revises: 0014_lobby_layout
Create Date: 2026-08-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015_frame_height"
down_revision: str | None = "0014_lobby_layout"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLES = ("galaxies", "worlds")
_FRAMES = ("title", "desc")


def upgrade() -> None:
    for table in _TABLES:
        for name in _FRAMES:
            op.add_column(table, sa.Column(f"{name}_height", sa.Integer(), nullable=True))
            op.create_check_constraint(
                op.f(f"ck_{table}_{name}_height_positive"),
                table,
                f"{name}_height IS NULL OR ({name}_height >= 40 AND {name}_height <= 1800)",
            )

    op.add_column(
        "chapters",
        sa.Column(
            "cover_media_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("media_assets.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("chapters", "cover_media_id")
    for table in _TABLES:
        for name in _FRAMES:
            op.execute(
                f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS ck_{table}_{name}_height_positive"
            )
            op.drop_column(table, f"{name}_height")

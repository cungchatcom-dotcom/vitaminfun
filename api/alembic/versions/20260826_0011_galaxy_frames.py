"""Khung tieu de va khung mo ta tren ban do thien ha

Hai tam anh trang tri nam tren ban do chon world. Mac dinh chung mang ten va
mo ta cua THIEN HA; re chuot vao mot world thi doi sang ten va mo ta cua world
do.

Vi tri va be rong dung CHUNG he toa do 3200x1800 voi world va voi canh choi.
Chieu cao suy ra theo ti le goc cua anh -- giong het `worlds.icon_size`.

NULL = chua dat, giao dien dung cho mac dinh (giua, phia duoi).

Revision ID: 0011_galaxy_frames
Revises: 0010_world_ring
Create Date: 2026-08-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011_galaxy_frames"
down_revision: str | None = "0010_world_ring"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COLUMNS = ("title", "desc")


def upgrade() -> None:
    for name in _COLUMNS:
        op.add_column(
            "galaxies",
            sa.Column(
                f"{name}_media_id",
                sa.UUID(as_uuid=True),
                sa.ForeignKey("media_assets.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        op.add_column("galaxies", sa.Column(f"{name}_x", sa.Integer(), nullable=True))
        op.add_column("galaxies", sa.Column(f"{name}_y", sa.Integer(), nullable=True))
        op.add_column("galaxies", sa.Column(f"{name}_width", sa.Integer(), nullable=True))
        op.create_check_constraint(
            op.f(f"ck_galaxies_{name}_width_positive"),
            "galaxies",
            f"{name}_width IS NULL OR ({name}_width >= 80 AND {name}_width <= 3200)",
        )


def downgrade() -> None:
    for name in _COLUMNS:
        op.execute(f"ALTER TABLE galaxies DROP CONSTRAINT IF EXISTS ck_galaxies_{name}_width_positive")
        op.drop_column("galaxies", f"{name}_width")
        op.drop_column("galaxies", f"{name}_y")
        op.drop_column("galaxies", f"{name}_x")
        op.drop_column("galaxies", f"{name}_media_id")

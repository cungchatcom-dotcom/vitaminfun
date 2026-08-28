"""Mau chu va co chu cho khung tieu de / mo ta

Chu trong hai cai khung do la ten + mo ta cua THIEN HA luc nghi, va cua WORLD
khi re chuot vao. Cung mot cho hien ra thi cung mot cach cau hinh -- dat mau
rieng cho tung world nghia la re chuot qua ba world la chu doi mau ba lan.

  *_color  ma mau #rrggbb. NULL = mac dinh cua giao dien.
  *_font   PHAN TRAM so voi co chu mac dinh (100 = giu nguyen), 40..250.

Font luu theo phan tram chu khong luu so tuyet doi: co chu that tinh theo be
rong CUA KHUNG (don vi cqw), nen mot con so px luu trong DB se sai ngay khi ai
do keo cai khung to ra.

Revision ID: 0012_frame_text
Revises: 0011_galaxy_frames
Create Date: 2026-08-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012_frame_text"
down_revision: str | None = "0011_galaxy_frames"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_FRAMES = ("title", "desc")


def upgrade() -> None:
    for name in _FRAMES:
        op.add_column("galaxies", sa.Column(f"{name}_color", sa.String(7), nullable=True))
        op.add_column("galaxies", sa.Column(f"{name}_font", sa.Integer(), nullable=True))
        op.create_check_constraint(
            op.f(f"ck_galaxies_{name}_color_hex"),
            "galaxies",
            f"{name}_color IS NULL OR {name}_color ~ '^#[0-9a-fA-F]{{6}}$'",
        )
        op.create_check_constraint(
            op.f(f"ck_galaxies_{name}_font_range"),
            "galaxies",
            f"{name}_font IS NULL OR ({name}_font >= 40 AND {name}_font <= 250)",
        )


def downgrade() -> None:
    for name in _FRAMES:
        op.execute(f"ALTER TABLE galaxies DROP CONSTRAINT IF EXISTS ck_galaxies_{name}_font_range")
        op.execute(f"ALTER TABLE galaxies DROP CONSTRAINT IF EXISTS ck_galaxies_{name}_color_hex")
        op.drop_column("galaxies", f"{name}_font")
        op.drop_column("galaxies", f"{name}_color")

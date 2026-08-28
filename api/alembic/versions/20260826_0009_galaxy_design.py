"""Ban do thien ha thiet ke duoc bang giao dien

galaxies  anh nen + nhac nen cho man chon world
worlds    vi tri / duong kinh / nhip tho tren ban do, va trang thai khoa

Toa do dung CHUNG he 3200x1800 voi canh choi -- xem web/src/game/world.ts.

is_locked mac dinh TRUE cho world MOI (vua tao thi chua co chapter/stage nao),
nhung cac world DA CO thi dat FALSE: chung dang hien voi hoc sinh, va mot
migration khong duoc lam bien mat noi dung dang chay.

Revision ID: 0009_galaxy_design
Revises: 0008_quest_pulse
Create Date: 2026-08-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009_galaxy_design"
down_revision: str | None = "0008_quest_pulse"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ---------------------------------------------------------------- galaxies
    op.add_column(
        "galaxies",
        sa.Column(
            "background_media_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("media_assets.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "galaxies",
        sa.Column(
            "music_media_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("media_assets.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # ---------------------------------------------------------------- worlds
    op.add_column("worlds", sa.Column("scene_x", sa.Integer(), nullable=True))
    op.add_column("worlds", sa.Column("scene_y", sa.Integer(), nullable=True))
    op.add_column("worlds", sa.Column("icon_size", sa.Integer(), nullable=True))
    op.add_column("worlds", sa.Column("pulse_percent", sa.Integer(), nullable=True))
    op.add_column("worlds", sa.Column("pulse_period_ms", sa.Integer(), nullable=True))

    # Them dang nullable, lap day FALSE cho hang cu, roi moi that chat. Them
    # thang voi server_default TRUE se khoa sach moi world dang chay.
    op.add_column("worlds", sa.Column("is_locked", sa.Boolean(), nullable=True))
    op.execute("UPDATE worlds SET is_locked = false WHERE is_locked IS NULL")
    op.alter_column(
        "worlds", "is_locked", nullable=False, server_default=sa.text("true")
    )

    op.create_check_constraint(
        op.f("ck_worlds_icon_size_positive"),
        "worlds",
        "icon_size IS NULL OR icon_size > 0",
    )
    op.create_check_constraint(
        op.f("ck_worlds_pulse_percent_range"),
        "worlds",
        "pulse_percent IS NULL OR (pulse_percent >= 0 AND pulse_percent <= 50)",
    )
    op.create_check_constraint(
        op.f("ck_worlds_pulse_period_range"),
        "worlds",
        "pulse_period_ms IS NULL OR (pulse_period_ms >= 400 AND pulse_period_ms <= 4000)",
    )


def downgrade() -> None:
    for name in (
        "ck_worlds_pulse_period_range",
        "ck_worlds_pulse_percent_range",
        "ck_worlds_icon_size_positive",
    ):
        op.execute(f"ALTER TABLE worlds DROP CONSTRAINT IF EXISTS {name}")
    for column in ("is_locked", "pulse_period_ms", "pulse_percent", "icon_size", "scene_y", "scene_x"):
        op.drop_column("worlds", column)
    op.drop_column("galaxies", "music_media_id")
    op.drop_column("galaxies", "background_media_id")

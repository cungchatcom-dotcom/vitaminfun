"""Phong cho cua world: anh nen va hai khung rieng

Man hinh hoc sinh nhin thay khi bam vao mot world. Cung bo thiet lap voi ban do
thien ha -- anh nen, khung tieu de, khung mo ta -- nhung rieng cho tung world.

MOI COT DEU NULLABLE, va NULL co nghia la "thua cua thien ha". Nho vay mot world
moi tao da co san giao dien dung tong voi ca ban do, con giao vien chi phai dong
vao nhung cho ho thuc su muon khac.

Revision ID: 0013_world_lobby
Revises: 0012_frame_text
Create Date: 2026-08-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013_world_lobby"
down_revision: str | None = "0012_frame_text"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_FRAMES = ("title", "desc")


def upgrade() -> None:
    op.add_column(
        "worlds",
        sa.Column(
            "lobby_media_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("media_assets.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    for name in _FRAMES:
        op.add_column(
            "worlds",
            sa.Column(
                f"{name}_media_id",
                sa.UUID(as_uuid=True),
                sa.ForeignKey("media_assets.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        op.add_column("worlds", sa.Column(f"{name}_x", sa.Integer(), nullable=True))
        op.add_column("worlds", sa.Column(f"{name}_y", sa.Integer(), nullable=True))
        op.add_column("worlds", sa.Column(f"{name}_width", sa.Integer(), nullable=True))
        op.add_column("worlds", sa.Column(f"{name}_color", sa.String(7), nullable=True))
        op.add_column("worlds", sa.Column(f"{name}_font", sa.Integer(), nullable=True))
        op.create_check_constraint(
            op.f(f"ck_worlds_{name}_width_positive"),
            "worlds",
            f"{name}_width IS NULL OR ({name}_width >= 80 AND {name}_width <= 3200)",
        )
        op.create_check_constraint(
            op.f(f"ck_worlds_{name}_color_hex"),
            "worlds",
            f"{name}_color IS NULL OR {name}_color ~ '^#[0-9a-fA-F]{{6}}$'",
        )
        op.create_check_constraint(
            op.f(f"ck_worlds_{name}_font_range"),
            "worlds",
            f"{name}_font IS NULL OR ({name}_font >= 40 AND {name}_font <= 250)",
        )


def downgrade() -> None:
    for name in _FRAMES:
        for suffix in ("font_range", "color_hex", "width_positive"):
            op.execute(f"ALTER TABLE worlds DROP CONSTRAINT IF EXISTS ck_worlds_{name}_{suffix}")
        for col in ("font", "color", "width", "y", "x", "media_id"):
            op.drop_column("worlds", f"{name}_{col}")
    op.drop_column("worlds", "lobby_media_id")

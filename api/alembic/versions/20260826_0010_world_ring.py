"""Cong tac vanh tron quanh world

Vanh tron vua la khung bao vua la thanh tien do (day dan theo so manh ban do
da gom). Khong phai ban do nao cung muon no, nen no thanh mot cong tac.

MAC DINH FALSE, ke ca cho world da co: bat san mot thu trang tri cho moi nguoi
roi bat ho di tim cho tat la lam nguoc.

Revision ID: 0010_world_ring
Revises: 0009_galaxy_design
Create Date: 2026-08-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010_world_ring"
down_revision: str | None = "0009_galaxy_design"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "worlds",
        sa.Column("show_ring", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("worlds", "show_ring")

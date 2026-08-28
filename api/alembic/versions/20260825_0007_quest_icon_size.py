"""Nhiem vu co kich thuoc anh rieng

Giao vien keo goc khung anh trong trinh thiet ke de doi kich thuoc. Luu theo
pixel he toa do the gioi (3200x1800), khong theo pixel man hinh -- khung soan
co gian theo cua so, nen luu pixel man hinh la mo tren may khac thi anh to nho
khac nhau.

Chi luu MOT chieu: anh giu dung ti le goc, chieu con lai suy ra.

Revision ID: 0007_quest_icon_size
Revises: 0006_quest_scene_design
Create Date: 2026-08-25
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_quest_icon_size"
down_revision: str | None = "0006_quest_scene_design"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("quests", sa.Column("icon_size", sa.Integer(), nullable=True))
    # Alembic khong tu sinh CHECK constraint -- phai viet tay, neu khong thi
    # model co rang buoc ma database thi khong.
    op.create_check_constraint(
        op.f("ck_quests_icon_size_positive"),
        "quests",
        "icon_size IS NULL OR icon_size > 0",
    )


def downgrade() -> None:
    op.execute("ALTER TABLE quests DROP CONSTRAINT IF EXISTS ck_quests_icon_size_positive")
    op.drop_column("quests", "icon_size")

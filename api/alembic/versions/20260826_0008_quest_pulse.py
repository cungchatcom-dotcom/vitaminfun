"""Nhip tho cho anh vat the nhiem vu

Anh phong to thu nhoi lien tuc de nguoi choi nhan ra "cai nay bam duoc".
Giao vien chinh hai so trong trinh thiet ke man choi:

  pulse_percent    to them bao nhieu phan tram o dinh nhip (8 = 108%), 0..50
  pulse_period_ms  mot nhip day du, to roi nho, 400..4000

NULL = lay mac dinh cua canh. 0 = TAT han. Hai thu do khac nhau, nen cot phai
nullable chu khong the mac dinh 0.

San 400ms cho chu ky: nhanh hon nua thi thanh nhap nhay tan so cao.

Revision ID: 0008_quest_pulse
Revises: 0007_quest_icon_size
Create Date: 2026-08-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_quest_pulse"
down_revision: str | None = "0007_quest_icon_size"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("quests", sa.Column("pulse_percent", sa.Integer(), nullable=True))
    op.add_column("quests", sa.Column("pulse_period_ms", sa.Integer(), nullable=True))
    # Alembic khong tu sinh CHECK constraint -- phai viet tay, neu khong thi
    # model co rang buoc ma database thi khong.
    op.create_check_constraint(
        op.f("ck_quests_pulse_percent_range"),
        "quests",
        "pulse_percent IS NULL OR (pulse_percent >= 0 AND pulse_percent <= 50)",
    )
    op.create_check_constraint(
        op.f("ck_quests_pulse_period_range"),
        "quests",
        "pulse_period_ms IS NULL OR (pulse_period_ms >= 400 AND pulse_period_ms <= 4000)",
    )


def downgrade() -> None:
    op.execute("ALTER TABLE quests DROP CONSTRAINT IF EXISTS ck_quests_pulse_period_range")
    op.execute("ALTER TABLE quests DROP CONSTRAINT IF EXISTS ck_quests_pulse_percent_range")
    op.drop_column("quests", "pulse_period_ms")
    op.drop_column("quests", "pulse_percent")

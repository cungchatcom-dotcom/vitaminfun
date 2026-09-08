"""Cho dung cuoi cung cua nhan vat, luu rieng tung nguoi tung luot choi

Thoat ra vao lai thi nhan vat quay ve cho xuat phat, ke ca khi luot choi van
duoc khoi phuc day du moi thu khac. Di bo tu dau ban do toi cho minh dang dung
la mot viec khong hoc them duoc gi.

  stage_run_players.pos_x / pos_y   toa do the gioi 3200x1800.
                                    NULL = chua di dau, canh dat o cho mac dinh.

Dat o `stage_run_players` chu khong o `stage_progress`: mot vi tri chi co nghia
trong CANH cua mot luot choi. Luot moi la mot van moi va nhan vat phai dung lai
o vach xuat phat - dung nep voi moi thu khac cua luot choi (bai da cham, bai
nhap, nang luong) deu reset theo luot.

Bang nay khoa theo (luot choi, nguoi), ma luot choi thuoc ve mot man - nen "rieng
tung student o tung stage" la he qua san co, khong phai them cot.

Revision ID: 0025_player_position
Revises: 0024_quest_drafts
Create Date: 2026-08-28
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0025_player_position"
down_revision: str | None = "0024_quest_drafts"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("stage_run_players", sa.Column("pos_x", sa.Integer(), nullable=True))
    op.add_column("stage_run_players", sa.Column("pos_y", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("stage_run_players", "pos_y")
    op.drop_column("stage_run_players", "pos_x")

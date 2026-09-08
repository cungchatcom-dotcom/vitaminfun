"""Tach so tay thanh TIEU DE + NOI DUNG, va tach loi NPC trao so tay

Truoc day ca cuon so tay chi co mot o chu: `stages.cluebook_i18n`. Nhung du lieu
soan ra co ba manh khac nhau, va ba manh do hien o ba cho khac nhau:

  cluebook_title_i18n   "CAPTAIN DRAKE'S SECRET HANDBOOK" - dau bang so tay
  cluebook_i18n         Toan van bi quyet               - than bang so tay
  advisor_outro_i18n    "Now, press onward..."          - man Claim, noi MOT LAN

Cot rieng chu khong gop: loi trao so tay la cau NPC noi mot lan luc trao, con so
tay la thu nguoi choi mo ra doc lai suot man. Gop lam mot thi moi lan mo so tay
lai phai doc lai cau chia tay cua thuyen truong.

Hai cot moi mac dinh la object rong, nghia la "chua soan". Giao dien tu lui ve
nhan dich cua no, nen khong co du lieu nao can chuyen.

Revision ID: 0026_cluebook_title
Revises: 0025_player_position
Create Date: 2026-08-29
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0026_cluebook_title"
down_revision: str | None = "0025_player_position"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    for name in ("advisor_outro_i18n", "cluebook_title_i18n"):
        op.add_column(
            "stages",
            sa.Column(
                name,
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
                server_default=sa.text("'{}'::jsonb"),
            ),
        )


def downgrade() -> None:
    op.drop_column("stages", "cluebook_title_i18n")
    op.drop_column("stages", "advisor_outro_i18n")

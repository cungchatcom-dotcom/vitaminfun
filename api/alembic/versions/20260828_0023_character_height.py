"""Chieu cao nhan vat trong canh, dat rieng cho tung man choi

Truoc day nhan vat luon cao 160 don vi the gioi - mot hang so nam trong
`StageScene.ts`. Nhung anh nen moi man mot ty le khac nhau: mot boong tau ve can
canh thi nhan vat 160 don vi trong be xiu, con mot quang truong ve tu xa thi no
to nhu kho lua. Nguoi dung man phai chinh duoc.

  stages.character_height  NULL = KE THUA. Xem `effective_character_height()`:
                           lay so cua man DAU TIEN trong world, va neu man do
                           cung de trong thi lay hang so mac dinh.

Ke thua chu khong sao chep: nguoi dung can nhan vat o man 1 mot lan, roi 29 man
con lai theo luon. Sao chep gia tri xuong tung man luc tao thi sua man 1 sau do
khong con lan sang dau nua, ma do moi la thu ho muon.

Khong co du lieu can chuyen: cot moi de NULL, va NULL nghia la "van dung 160 nhu
truoc".

Revision ID: 0023_character_height
Revises: 0022_personal_energy
Create Date: 2026-08-28
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0023_character_height"
down_revision: str | None = "0022_personal_energy"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("stages", sa.Column("character_height", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "character_height_positive",
        "stages",
        "character_height IS NULL OR character_height > 0",
    )


def downgrade() -> None:
    op.drop_constraint("character_height_positive", "stages", type_="check")
    op.drop_column("stages", "character_height")

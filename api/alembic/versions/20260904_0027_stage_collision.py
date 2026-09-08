"""Vung di duoc cua man choi: stages.collision_json

Truoc day nhan vat di duoc tren CA ban do, chua mot le quanh mep. Do la mac dinh
trung thuc duy nhat khi anh nen la tuy y: canh khong biet cho nao trong anh cua
giao vien la "san" va cho nao la "tuong".

Cot nay la cho giao vien tu ve. Mot ban do va cham gom:

  default   'walkable' | 'blocked'  - ngoai MOI hinh thi di duoc hay khong
  shapes[]  moi hinh mang mode 'allow' | 'block', kind 'rect' | 'ellipse' | 'poly'

Luat xet: hinh khop CUOI CUNG thang. Nho vay ghep duoc cac vung long nhau ma
khong can phep toan tap hop nao - vi du loi di quanh mot cai ho la mot hinh oval
'allow' rong, roi mot hinh oval 'block' nho dat de len tren no.

NULL = chua ve, va co nghia la CA BAN DO di duoc - dung y het hanh vi hom nay,
nen khong man nao da dung bi doi va khong co du lieu nao can chuyen.

Revision ID: 0027_stage_collision
Revises: 0026_cluebook_title
Create Date: 2026-09-04
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0027_stage_collision"
down_revision: str | None = "0026_cluebook_title"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "stages",
        sa.Column(
            "collision_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("stages", "collision_json")

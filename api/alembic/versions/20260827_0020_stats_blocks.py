"""Nam chi so cua bang thanh tich: sao va nhan cap do world

Ba cot moi phuc vu bang thanh tich o phong cho:

  worlds.level_i18n       nhan cap do tu do ("Easy", "C2", "3"). Tach khoi
                          `difficulty` vi `difficulty` la ba gia tri CO DINH ma
                          he thong dua vao de loc, con day la chu chi de HIEN.
  stages.star_max         so sao toi da mot man trao. Tong sao cua world = tong
                          cot nay.
  stages.star_score_pcts  nguong diem de nhan tung ngoi sao, tinh bang PHAN TRAM
                          diem toi da cua man. Phan tram chu khong phai diem
                          tuyet doi: them mot cau hoi la diem toi da doi, ma
                          nguong tuyet doi thi dung yen va bong dung de di.
  stage_progress.best_stars  so sao cao nhat tung dat o man do.

Phan CHAM ra sao chua co. Cot tao truoc de nguoi dung dat duoc gia tri va cho
hien thi doc san; khi luat cham xong thi khong phai sua giao dien nua.

Revision ID: 0020_stats_blocks
Revises: 0019_chapter_minimap
Create Date: 2026-08-27
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0020_stats_blocks"
down_revision: str | None = "0019_chapter_minimap"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "worlds",
        sa.Column(
            "level_i18n",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column(
        "stages",
        sa.Column("star_max", sa.Integer(), server_default=sa.text("3"), nullable=False),
    )
    op.add_column(
        "stages",
        sa.Column(
            "star_score_pcts",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.create_check_constraint("star_max_non_negative", "stages", "star_max >= 0")

    op.add_column(
        "stage_progress",
        sa.Column("best_stars", sa.Integer(), server_default=sa.text("0"), nullable=False),
    )
    op.create_check_constraint(
        "best_stars_non_negative", "stage_progress", "best_stars >= 0"
    )


def downgrade() -> None:
    op.drop_constraint("best_stars_non_negative", "stage_progress", type_="check")
    op.drop_column("stage_progress", "best_stars")
    op.drop_constraint("star_max_non_negative", "stages", type_="check")
    op.drop_column("stages", "star_score_pcts")
    op.drop_column("stages", "star_max")
    op.drop_column("worlds", "level_i18n")

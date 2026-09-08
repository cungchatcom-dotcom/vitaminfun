"""Am thanh cua man choi: stages.audio_json

Ba khoi tieng, moi khoi mot file kem am luong / toc do / co lap:

  ambient   nhac nen, chay suot man
  walk      tieng phat khi nhan vat di
  idle      tieng phat khi nhan vat dung lai

Mot cot JSONB chu khong phai muoi hai cot rieng: them mot khoi tieng moi la them
MOT DONG trong so dang ky `AUDIO_SLOTS` o web/src/game/audio.ts, khong phai them
mot migration. Cung khuon voi `worlds.lobby_json`.

NULL = ca man khong co tieng nao, va do la mac dinh dung: mot man choi tu bat
nhac ma nguoi dung khong chu dong chon la thu ca lop hoc phai chiu dung cung
luc. Khong man nao da dung bi doi, va khong co du lieu nao can chuyen.

Revision ID: 0028_stage_audio
Revises: 0027_stage_collision
Create Date: 2026-09-04
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0028_stage_audio"
down_revision: str | None = "0027_stage_collision"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "stages",
        sa.Column(
            "audio_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("stages", "audio_json")

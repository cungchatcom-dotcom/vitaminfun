"""TIENG cho loi chia tay cua NPC, va transcript mo san

Loi NPC noi luc trao so tay (`stages.advisor_outro_i18n`) da co tu truoc nhung
chi la CHU. Migration nay cho no mot doan ghi am, dung co che cua cau hoi nghe
(xem 0032) va dung chung dung mot component ve.

  stages.advisor_outro_audio_media_id   doan ghi am NPC noi. NULL = chi co chu.
  stages.advisor_outro_show_transcript  doan chu MO SAN canh trinh phat.

## Mac dinh TRUE, nguoc voi cau hoi nghe

`questions.show_transcript` mac dinh FALSE; cot nay mac dinh TRUE. Su khac nhau
do co ly do, khong phai mot cho quen dong bo:

  - Cau hoi NGHE giau chu vi doc duoc de thi bai nghe khong con do gi nua. Chu o
    do la DAP AN cua chinh bai tap.
  - Loi NPC khong phai bai tap. No la mot nhan vat dang noi, va hoc sinh vua
    nghe vua doc theo la cach hoc tu moi nhanh nhat. Giau chu di chi de "cho
    giong cau hoi" la bat mot dua tre nghe het ba cau tieng Anh roi tu doan minh
    vua duoc cho cai gi.

Nut thu gon van con - nguoi dung nao muon bat nghe thuan thi tat duoc, nhung
phai chu dong tat.

## Khong co cot transcript rieng

Transcript CHINH LA `advisor_outro_i18n`, cung luat voi cau hoi nghe: mot ban
chep loi rieng la mot ban sao co the lech voi thu dang phat.

Revision ID: 0033_outro_audio
Revises: 0032_question_prompt_kind
Create Date: 2026-09-05
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0033_outro_audio"
down_revision: str | None = "0032_question_prompt_kind"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "stages",
        sa.Column(
            "advisor_outro_audio_media_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("media_assets.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "stages",
        sa.Column(
            "advisor_outro_show_transcript",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("stages", "advisor_outro_show_transcript")
    op.drop_column("stages", "advisor_outro_audio_media_id")

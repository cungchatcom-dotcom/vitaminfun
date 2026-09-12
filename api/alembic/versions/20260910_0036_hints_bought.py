"""Ghi lai nhung goi y da MUA trong mot luot choi.

Ban dich cua mot cau hoi nam trong `questions.answer_json` - cung cho voi dap
an, va co chu y: xem `docs/GAME_DOMAIN.md`. Muon xem thi phai TRA BANG NANG
LUONG. Nhung mot lan tra roi thi xem lai bao nhieu lan cung duoc: hoc sinh dong
bang cau hoi rui roi mo lai ma bi tru tiep la mot cai bay, khong phai mot luat
choi.

Nen phai nho la ai da mua gi. Mot cot JSONB tren chinh nguoi choi trong luot do
- khong phai mot bang rieng - vi no chi co nghia trong pham vi mot luot, chet
theo luot, va khong ai truy van nguoc no bao gio.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0036_hints_bought"
down_revision: str | None = "0035_quest_dialogue"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "stage_run_players",
        sa.Column(
            "hints_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("stage_run_players", "hints_json")

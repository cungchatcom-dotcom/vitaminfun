"""Bo cuc phong cho: mot cot JSONB cho moi khoi keo tha

Phong cho co sau khoi keo tha duoc -- bang thanh tich, bang xep hang, hang
chuong, va ba nut Choi / Tao phong / Vao phong. Moi khoi can vi tri, be rong va
mot tam anh nen: 4 x 6 = 24 cot neu lam bang cot rieng.

Thay vao do MOT cot JSONB:

    {"stats": {"x": 300, "y": 900, "w": 520, "media_id": "..."}, ...}

Them mot khoi moi sau nay = them mot khoa trong so dang ky o frontend, khong
can migration. Doi lai la database khong kiem duoc gia tri ben trong -- nen
Pydantic phai kiem, xem `LobbyElement`.

Khong dung cot rieng cho `title`/`desc`: hai khung do mang CHU va thua cau hinh
tu thien ha, khac han sau khoi nay. Gop chung vao mot cho chi de dem so.

Revision ID: 0014_lobby_layout
Revises: 0013_world_lobby
Create Date: 2026-08-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0014_lobby_layout"
down_revision: str | None = "0013_world_lobby"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "worlds",
        sa.Column(
            "lobby_json",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("worlds", "lobby_json")

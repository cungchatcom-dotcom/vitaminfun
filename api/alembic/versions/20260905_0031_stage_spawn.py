"""CHO XUAT PHAT cua nhan vat, dat rieng cho tung man choi

Truoc migration nay moi man deu tha nguoi choi xuong CUNG MOT cho: chech xuong
trai tam canh, mot cap so viet cung trong `StageScene.create()`. Cai cho do
duoc chon cho mot canh boong tau, va no dung cho dung canh do. Man tiep theo la
mot bai tranh khac, va nguoi choi roi xuong giua bien, tren mot vach da, hay
ben trong mot buc tuong - roi phai tu di bo ra cho co viec de lam.

  stages.spawn_x / spawn_y   toa do the gioi 3200x1800.
                             NULL = cho mac dinh cua canh (xem DEFAULT_SPAWN
                             ben `web/src/game/world.ts`).

## Day la DIEM VA CHAM, khong phai tam tam anh

Cung he quy chieu voi `stage_run_players.pos_x/pos_y` va voi thu `canWalk()`
xet: mot diem cao hon got chan dung `HERO_FOOT_Y`. Hai cho nay cach nhau gan
nua chieu cao nhan vat, nen luu tam tam anh la mo dung mot cho de lech - nguoi
dung cang nhan vat vao vung vua ve thay dung, vao choi thay sai.

## NULL van co nghia, va khong duoc thay bang mot cap so

Dien so vao san cho moi man dang co thi man nao cung mang mot cho xuat phat ma
khong ai chon, va khong con phan biet duoc "chua dat" voi "dat dung vao cho mac
dinh". Trinh thiet ke can phan biet do de biet co nen hien nut go ve mac dinh
hay khong - cung nep voi `character_height`.

Revision ID: 0031_stage_spawn
Revises: 0030_content_codes
Create Date: 2026-09-05
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0031_stage_spawn"
down_revision: str | None = "0030_content_codes"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("stages", sa.Column("spawn_x", sa.Integer(), nullable=True))
    op.add_column("stages", sa.Column("spawn_y", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("stages", "spawn_y")
    op.drop_column("stages", "spawn_x")

"""VIDEO MO MAN cho tung man choi

  stages.intro_video_media_id   NULL = khong co gi thay doi so voi truoc.

## Vi sao co cot nay

Bam vao mot man roi phai nhin chu "Dang tai..." la cho trai nghiem gay. Thoi
gian do co that va khong bo di duoc - goi Phaser gan mot megabyte, anh nen co
khi la video, spritesheet nhan vat bon huong, tieng buoc chan. Thu bo di duoc la
CAI MAN HINH TRONG trong luc cho.

Nen day khong phai mot tinh nang ke chuyen gan them. No la TAM MAN che dung
khoang thoi gian do: video chay o tren, con Phaser va tai san cua canh tai
ngam o duoi, va cua vao man mo khi ca hai da xong.

## NULL la mac dinh, va phai la mac dinh

30 man da dung khong duoc tu dung moc them mot buoc bam. Khong `server_default`,
khong dien san gi: cot nay chi khac NULL khi nguoi dung chu dong tai mot file.

## SET NULL khi file bi xoa

Cung nep voi `background_media_id` va `advisor_outro_audio_media_id`. Xoa file
trong kho media thi man choi lui ve dung hanh vi cu - vao thang, khong co man
che - chu khong hong.

## Khong co cot thoi luong

Do dai doan video la thu chinh the `<video>` biet sau khi doc metadata. Luu them
mot con so o day la mot ban sao co the lech voi file, va khong ai kiem tra duoc
no lech luc nao.

Revision ID: 0034_stage_intro_video
Revises: 0033_outro_audio
Create Date: 2026-09-07
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0034_stage_intro_video"
down_revision: str | None = "0033_outro_audio"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "stages",
        sa.Column(
            "intro_video_media_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("media_assets.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("stages", "intro_video_media_id")

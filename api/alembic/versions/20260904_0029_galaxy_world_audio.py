"""Am thanh cho THIEN HA va PHONG CHO WORLD, va gop nhac thien ha ve mot moi

Truoc day thien ha co `galaxies.music_media_id` — mot cot chi chua ID file,
khong co am luong, khong co toc do, khong co co lap. Phong cho world thi khong
co nhac gi ca.

Migration nay lam ba viec:

  1. Them `galaxies.audio_json` va `worlds.audio_json`, cung hinh dang voi
     `stages.audio_json`: { "ambient": { media_id, volume, rate, loop } }.
  2. CHUYEN du lieu cu sang: moi `music_media_id` khac NULL thanh mot khoi
     `ambient` trong cot moi. Khong mat bai nhac nao da tai len.
  3. BO `galaxies.music_media_id`.

Vi sao bo han chu khong de song song: hai cach luu cung mot thu se lech nhau
dung vao luc ai do sua mot ben. Mot hinh dang duy nhat co nghia la mot bang dieu
khien duy nhat (`AudioPanel`), mot ham quy doi duy nhat (`resolveAudio`), va mot
cho de sua khi them tuy chon moi.

Cot moi mac dinh la object rong = khong co tieng nao, dung y het hanh vi hom nay
voi world (chua bao gio co nhac) va voi thien ha chua ai tai nhac len.

Revision ID: 0029_galaxy_world_audio
Revises: 0028_stage_audio
Create Date: 2026-09-04
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0029_galaxy_world_audio"
down_revision: str | None = "0028_stage_audio"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    for table in ("galaxies", "worlds"):
        op.add_column(
            table,
            sa.Column(
                "audio_json",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
                server_default=sa.text("'{}'::jsonb"),
            ),
        )

    # Chuyen nhac thien ha da tai len sang khoi `ambient`. Chi dat `media_id`;
    # am luong / toc do / lap de trong de chung lay mac dinh cua so dang ky —
    # dung cai ma nguoi dung dang nghe hom nay (lap, am luong day).
    op.execute(
        """
        UPDATE galaxies
        SET audio_json = jsonb_build_object(
            'ambient', jsonb_build_object('media_id', music_media_id::text)
        )
        WHERE music_media_id IS NOT NULL
        """
    )

    op.drop_column("galaxies", "music_media_id")


def downgrade() -> None:
    op.add_column(
        "galaxies",
        sa.Column("music_media_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "galaxies_music_media_id_fkey",
        "galaxies",
        "media_assets",
        ["music_media_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.execute(
        """
        UPDATE galaxies
        SET music_media_id = (audio_json -> 'ambient' ->> 'media_id')::uuid
        WHERE audio_json -> 'ambient' ->> 'media_id' IS NOT NULL
        """
    )
    op.drop_column("worlds", "audio_json")
    op.drop_column("galaxies", "audio_json")

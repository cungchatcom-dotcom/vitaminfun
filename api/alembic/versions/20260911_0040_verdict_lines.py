"""LOI PHAN cua nguoi canh giu - bo cau chung cho world, tieng doc chung theo GIONG.

Chu: bo cau khen/che thuoc ve WORLD, moi world mot bo.
Tieng: khoa theo (GIONG, NOI DUNG CAU) - hai quest khac nhau ma nguoi canh giu
       chon cung mot giong thi dung lai dung ban thu do, khong sinh lai.

Xem `app/db/models/voice_line.py`.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0040_verdict_lines"
down_revision: str | None = "0039_dialogue_messages"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # Bo cau phan cua world. `{}` = dung bo mac dinh trong `messages/`.
    op.add_column(
        "worlds",
        sa.Column(
            "verdict_json",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )

    op.create_table(
        "voice_lines",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("voice_id", postgresql.UUID(as_uuid=True), nullable=False),
        # Bam cua CHINH doan chu. Doi chu la doi bam, tuc ban thu cu tu dong
        # thanh "khong con dung cho cau nay" ma khong can ai di don.
        sa.Column("text_hash", sa.String(length=64), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("media_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["voice_id"], ["voices.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["media_id"], ["media_assets.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("voice_id", "text_hash", name="uq_voice_line_slot"),
    )
    op.create_index("ix_voice_lines_voice_id", "voice_lines", ["voice_id"])


def downgrade() -> None:
    op.drop_index("ix_voice_lines_voice_id", table_name="voice_lines")
    op.drop_table("voice_lines")
    op.drop_column("worlds", "verdict_json")

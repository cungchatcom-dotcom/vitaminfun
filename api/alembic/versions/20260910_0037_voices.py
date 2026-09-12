"""Kho GIONG DOC, va cot giong tren nhan vat.

Mot BAN SAO danh muc giong cua nha cung cap, de o chon giong mo ra la co ngay
- khong phai goi API moi lan mo. Xem `app/db/models/voice.py`.

`characters.voice_id` dung cho CA hai vai: nhan vat hoc sinh va nguoi canh giu
deu la mot dong `characters`, nen ca hai deu gan giong duoc bang cung mot cot.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0037_voices"
down_revision: str | None = "0036_hints_bought"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "voices",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("external_id", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("gender", sa.String(length=16), nullable=True),
        sa.Column("age_group", sa.String(length=16), nullable=True),
        sa.Column("accent", sa.String(length=32), nullable=True),
        sa.Column("style", sa.String(length=32), nullable=True),
        sa.Column("use_case", sa.String(length=32), nullable=True),
        sa.Column("language", sa.String(length=8), server_default="en", nullable=False),
        sa.Column("preview_url", sa.Text(), nullable=True),
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
        sa.UniqueConstraint("provider", "external_id", name="uq_voices_provider_external"),
    )
    op.create_index("ix_voices_provider", "voices", ["provider"])
    op.create_index("ix_voices_gender", "voices", ["gender"])
    op.create_index("ix_voices_age_group", "voices", ["age_group"])
    op.create_index("ix_voices_language", "voices", ["language"])

    op.add_column(
        "characters",
        sa.Column("voice_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    # ON DELETE SET NULL: xoa mot giong khoi danh muc thi nhan vat mat giong,
    # chu khong mat nhan vat.
    op.create_foreign_key(
        "fk_characters_voice",
        "characters",
        "voices",
        ["voice_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_characters_voice", "characters", type_="foreignkey")
    op.drop_column("characters", "voice_id")
    op.drop_index("ix_voices_language", table_name="voices")
    op.drop_index("ix_voices_age_group", table_name="voices")
    op.drop_index("ix_voices_gender", table_name="voices")
    op.drop_index("ix_voices_provider", table_name="voices")
    op.drop_table("voices")

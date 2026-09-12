"""AUDIO da sinh cho cau hoi, khoa theo GIONG.

Cung mot cau hoi lap vao world khac ma van giong do thi audio cu dung lai duoc.
Giong khac thi coi nhu chua co - xem `app/db/models/question_audio.py`.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0038_question_audio"
down_revision: str | None = "0037_voices"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "question_audios",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("voice_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target", sa.String(length=16), nullable=False),
        sa.Column("option_key", sa.String(length=64), server_default="", nullable=False),
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
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["voice_id"], ["voices.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["media_id"], ["media_assets.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "question_id", "voice_id", "target", "option_key", name="uq_question_audio_slot"
        ),
    )
    op.create_index("ix_question_audios_question_id", "question_audios", ["question_id"])
    op.create_index("ix_question_audios_voice_id", "question_audios", ["voice_id"])


def downgrade() -> None:
    op.drop_index("ix_question_audios_voice_id", table_name="question_audios")
    op.drop_index("ix_question_audios_question_id", table_name="question_audios")
    op.drop_table("question_audios")

"""NHAT KY HOI THOAI - tung cau noi giua hoc sinh va nguoi canh giu.

Luu that chu khong dung lai tu `quest_answers`: dung lai nghia la co hai duong
sinh ra cung mot doan chat, va hai duong thi co ngay chung khac nhau - luc do
hoc sinh cuon len va doc duoc mot cuoc tro chuyen khong phai cuoc ho vua trai
qua. Xem `app/db/models/dialogue_message.py`.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0039_dialogue_messages"
down_revision: str | None = "0038_question_audio"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "dialogue_messages",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("stage_run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("quest_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=8), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("aside", sa.Text(), nullable=True),
        sa.Column("tone", sa.String(length=8), nullable=True),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("audio_url", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(["stage_run_id"], ["stage_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "stage_run_id", "user_id", "quest_id", "seq", name="uq_dialogue_message_seq"
        ),
    )
    op.create_index(
        "ix_dialogue_messages_thread",
        "dialogue_messages",
        ["stage_run_id", "user_id", "quest_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_dialogue_messages_thread", table_name="dialogue_messages")
    op.drop_table("dialogue_messages")

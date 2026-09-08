"""Dap an NHAP: luu truoc khi cham, de vao lai khong mat bai

Truoc day moi cau hoi cham ngay luc nop, va khong co cho nao giu "toi da chon
dap an nay nhung chua nop". Nguoi choi lam do mot nhiem vu bon cau roi mat mang
la mat sach.

  quest_drafts  mot dong cho moi (luot choi, nguoi, cau hoi). Ghi de tu do:
                doi y quay lai sua cau nao thi dong do doi theo.

UNIQUE(stage_run_id, user_id, question_id) chu KHONG co quest_id trong khoa:
mot cau hoi chi thuoc mot nhiem vu trong cung mot de bai, nen them quest_id vao
khoa la mo duong cho hai ban nhap cua cung mot cau. `quest_id` van co, de doc ra
ca nhiem vu bang mot cau truy van.

Bang NHAP, khong phai bang diem: khong co `score`, khong co `is_correct`. Cham
diem van la `quest_answers` - nhat ky tung lan thu, khong ghi de. Gop hai thu
vao mot bang thi mat lich su so lan thu, ma do la thu ca cong thuc tinh diem dua
vao.

Revision ID: 0024_quest_drafts
Revises: 0023_character_height
Create Date: 2026-08-28
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0024_quest_drafts"
down_revision: str | None = "0023_character_height"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "quest_drafts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "stage_run_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("stage_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("quest_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("response_json", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint(
            "stage_run_id", "user_id", "question_id", name="uq_quest_drafts_question"
        ),
    )
    op.create_index("ix_quest_drafts_run_user", "quest_drafts", ["stage_run_id", "user_id"])


def downgrade() -> None:
    op.drop_index("ix_quest_drafts_run_user", table_name="quest_drafts")
    op.drop_table("quest_drafts")

"""Bảng users — ba vai trò cố định

Migration đầu tiên của vitaminfun. Cố ý viết tay thay vì autogenerate: bảng
nền móng nên được đọc và duyệt từng dòng, không nên là thứ máy sinh ra rồi
không ai nhìn lại.

Revision ID: 0001_users
Revises:
Create Date: 2026-08-25
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0001_users"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        # Chưa có khoá ngoại: bảng media_assets ra đời ở Bước 2, lúc đó thêm
        # constraint bằng một migration một dòng.
        sa.Column("avatar_media_id", UUID(as_uuid=True), nullable=True),
        sa.Column("locale", sa.String(length=10), nullable=True),
        sa.Column("perm_version", sa.Integer(), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        # Ba vai trò là luật, không phải quy ước. Cưỡng chế ở database để một
        # bản vá dữ liệu bằng tay cũng không tạo ra được vai trò thứ tư.
        sa.CheckConstraint(
            "role IN ('admin', 'teacher', 'student')",
            name=op.f("ck_users_role_valid"),
        ),
        sa.CheckConstraint(
            "status IN ('active', 'suspended')",
            name=op.f("ck_users_status_valid"),
        ),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_role"), "users", ["role"], unique=False)
    op.create_index(op.f("ix_users_deleted_at"), "users", ["deleted_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_deleted_at"), table_name="users")
    op.drop_index(op.f("ix_users_role"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

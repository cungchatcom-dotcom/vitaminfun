"""Bảng media_assets và questions — kho câu hỏi dùng chung

Sinh bằng `alembic revision --autogenerate`, đã đọc lại từng dòng.
Cũng gắn luôn khoá ngoại `users.avatar_media_id` đã để trống từ migration 0001.

Revision ID: 0002_media_and_questions
Revises: 0001_users
Create Date: 2026-08-25
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0002_media_and_questions'
down_revision: str | None = '0001_users'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('media_assets',
    sa.Column('url', sa.Text(), nullable=False),
    sa.Column('storage_key', sa.Text(), nullable=False),
    sa.Column('kind', sa.String(length=16), nullable=False),
    sa.Column('mime', sa.String(length=128), nullable=True),
    sa.Column('original_name', sa.String(length=255), nullable=True),
    sa.Column('width', sa.Integer(), nullable=True),
    sa.Column('height', sa.Integer(), nullable=True),
    sa.Column('size_bytes', sa.Integer(), nullable=True),
    sa.Column('duration_ms', sa.Integer(), nullable=True),
    sa.Column('alt_i18n', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('folder', sa.String(length=255), nullable=True),
    sa.Column('uploaded_by_id', sa.UUID(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("kind IN ('image', 'audio', 'video')", name=op.f('ck_media_assets_kind_valid')),
    sa.ForeignKeyConstraint(['uploaded_by_id'], ['users.id'], name=op.f('fk_media_assets_uploaded_by_id_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_media_assets')),
    sa.UniqueConstraint('storage_key', name=op.f('uq_media_assets_storage_key'))
    )
    op.create_index(op.f('ix_media_assets_folder'), 'media_assets', ['folder'], unique=False)
    op.create_index(op.f('ix_media_assets_kind'), 'media_assets', ['kind'], unique=False)
    op.create_table('questions',
    sa.Column('created_by_user_id', sa.UUID(), nullable=True),
    sa.Column('type', sa.String(length=32), nullable=False),
    sa.Column('schema_version', sa.Integer(), nullable=False),
    sa.Column('points', sa.Integer(), nullable=False),
    sa.Column('time_limit_seconds', sa.Integer(), nullable=True),
    sa.Column('content_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('answer_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('explanation', sa.Text(), nullable=True),
    sa.Column('image_media_id', sa.UUID(), nullable=True),
    sa.Column('audio_media_id', sa.UUID(), nullable=True),
    sa.Column('audio_max_plays', sa.Integer(), nullable=True),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('level', sa.String(length=32), nullable=True),
    sa.Column('topic', sa.String(length=128), nullable=True),
    sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("status IN ('draft', 'published')", name=op.f('ck_questions_status_valid')),
    sa.CheckConstraint('points >= 0', name=op.f('ck_questions_points_non_negative')),
    sa.ForeignKeyConstraint(['audio_media_id'], ['media_assets.id'], name=op.f('fk_questions_audio_media_id_media_assets'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], name=op.f('fk_questions_created_by_user_id_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['image_media_id'], ['media_assets.id'], name=op.f('fk_questions_image_media_id_media_assets'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_questions'))
    )
    op.create_index(op.f('ix_questions_deleted_at'), 'questions', ['deleted_at'], unique=False)
    op.create_index('ix_questions_status', 'questions', ['status'], unique=False)
    op.create_index('ix_questions_type', 'questions', ['type'], unique=False)
    op.create_foreign_key(op.f('fk_users_avatar_media_id_media_assets'), 'users', 'media_assets', ['avatar_media_id'], ['id'], ondelete='SET NULL', use_alter=True)


def downgrade() -> None:
    op.drop_constraint(op.f('fk_users_avatar_media_id_media_assets'), 'users', type_='foreignkey')
    op.drop_index('ix_questions_type', table_name='questions')
    op.drop_index('ix_questions_status', table_name='questions')
    op.drop_index(op.f('ix_questions_deleted_at'), table_name='questions')
    op.drop_table('questions')
    op.drop_index(op.f('ix_media_assets_kind'), table_name='media_assets')
    op.drop_index(op.f('ix_media_assets_folder'), table_name='media_assets')
    op.drop_table('media_assets')

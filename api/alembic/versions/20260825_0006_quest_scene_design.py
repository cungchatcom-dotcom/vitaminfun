"""Nhiem vu co ban kinh pham vi rieng va anh trong canh

Hai cot phuc vu giao dien thiet ke do hoa man choi:
  - trigger_radius: ban kinh kich hoat rieng cho tung nhiem vu
  - icon_media_id : anh tinh hoac GIF cua vat the trong canh

Ca hai deu NULL duoc: nhiem vu cu van chay, canh dung gia tri mac dinh.

Revision ID: 0006_quest_scene_design
Revises: 0005_quest_name
Create Date: 2026-08-25
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '0006_quest_scene_design'
down_revision: str | None = '0005_quest_name'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('quests', sa.Column('trigger_radius', sa.Integer(), nullable=True))
    op.add_column('quests', sa.Column('icon_media_id', sa.UUID(), nullable=True))
    op.create_foreign_key(op.f('fk_quests_icon_media_id_media_assets'), 'quests', 'media_assets', ['icon_media_id'], ['id'], ondelete='SET NULL')
    # Alembic khong tu sinh CHECK constraint -- phai viet tay, neu khong thi model
    # co rang buoc ma database thi khong, va hai ben lech nhau am tham.
    op.create_check_constraint(
        op.f('ck_quests_trigger_radius_positive'),
        'quests',
        'trigger_radius IS NULL OR trigger_radius > 0',
    )


def downgrade() -> None:
    # IF EXISTS: dung nay tung duoc chay o ban migration chua co CHECK, nen tren
    # mot so database no khong ton tai. Downgrade chet vi mot rang buoc khong co
    # la thu bien viec lui lai thanh viec sua tay.
    op.execute('ALTER TABLE quests DROP CONSTRAINT IF EXISTS ck_quests_trigger_radius_positive')
    op.drop_constraint(op.f('fk_quests_icon_media_id_media_assets'), 'quests', type_='foreignkey')
    op.drop_column('quests', 'icon_media_id')
    op.drop_column('quests', 'trigger_radius')

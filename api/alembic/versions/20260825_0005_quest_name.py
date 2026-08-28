"""Nhiệm vụ có tên hiển thị cho người chơi

`quest_object_key` là khoá KỸ THUẬT — Phaser dùng nó để biết gắn nhiệm vụ vào
sprite nào trong cảnh. Cảnh chơi mà hiện "mast" cho học sinh thì không dùng
được, nên thêm `name_i18n` để giáo viên đặt tên thật ("Cột buồm chính").

Thêm cột, không chuyển dữ liệu: nhiệm vụ cũ có tên rỗng và giao diện lùi về
`quest_object_key` cho tới khi giáo viên đặt tên.

Revision ID: 0005_quest_name
Revises: 0004_quest_multi_question
Create Date: 2026-08-25
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_quest_name"
down_revision: str | None = "0004_quest_multi_question"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "quests",
        sa.Column(
            "name_i18n",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            # Bảng đã có dữ liệu thật, nên cột NOT NULL bắt buộc phải có giá trị
            # mặc định ở tầng server — không thì lệnh ALTER chết ngay.
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    # Gỡ mặc định sau khi đã điền xong: từ giờ ứng dụng luôn gửi giá trị, và
    # một mặc định còn sót lại là chỗ để dữ liệu thiếu lọt qua mà không ai biết.
    op.alter_column("quests", "name_i18n", server_default=None)


def downgrade() -> None:
    op.drop_column("quests", "name_i18n")

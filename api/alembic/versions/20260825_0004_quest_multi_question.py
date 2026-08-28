"""Một nhiệm vụ mang NHIỀU câu hỏi; mảnh bản đồ thuộc về màn

Ba thay đổi, xem docs/GAME_DOMAIN.md §1.5b và §1.5c:

1. Tách `quests.question_id` ra bảng nối `quest_questions` có `points` và
   `order_index`. Một nhiệm vụ giờ mang nhiều câu hỏi — đúng như tài liệu thiết
   kế mô tả chuỗi hội thoại NPC.

2. Bỏ `quests.grants_map_shard`. Mảnh bản đồ trao khi hoàn thành **tất cả**
   nhiệm vụ của màn, và số hiệu mảnh đã nằm ở `stages.map_shard_index`. Cờ trên
   nhiệm vụ là nguồn sự thật thứ hai cho cùng một luật.

3. `quest_answers` thêm `question_id` vào hai ràng buộc UNIQUE: một nhiệm vụ
   nhiều câu hỏi thì người chơi trả lời từng câu một.

Migration này CÓ CHUYỂN DỮ LIỆU: mỗi `quests.question_id` cũ thành một dòng
`quest_questions`. Không dòng nào bị mất.

Revision ID: 0004_quest_multi_question
Revises: 0003_game_model
Create Date: 2026-08-25
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0004_quest_multi_question"
down_revision: str | None = "0003_game_model"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_POINTS = 10


def upgrade() -> None:
    # ---------------------------------------------------------------- 1. bảng nối
    op.create_table(
        "quest_questions",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("quest_id", UUID(as_uuid=True), nullable=False),
        sa.Column("question_id", UUID(as_uuid=True), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_quest_questions")),
        sa.ForeignKeyConstraint(
            ["quest_id"],
            ["quests.id"],
            name=op.f("fk_quest_questions_quest_id_quests"),
            ondelete="CASCADE",
        ),
        # RESTRICT: không xoá cứng được câu hỏi đang nằm trong một màn chơi.
        sa.ForeignKeyConstraint(
            ["question_id"],
            ["questions.id"],
            name=op.f("fk_quest_questions_question_id_questions"),
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint(
            "quest_id", "question_id", name=op.f("uq_quest_questions_quest_question")
        ),
        sa.UniqueConstraint("quest_id", "order_index", name=op.f("uq_quest_questions_quest_order")),
        sa.CheckConstraint("points >= 0", name=op.f("ck_quest_questions_points_non_negative")),
    )
    op.create_index(op.f("ix_quest_questions_quest_id"), "quest_questions", ["quest_id"])
    op.create_index("ix_quest_questions_question", "quest_questions", ["question_id"])

    # ---------------------------------------------------------------- 2. chuyển dữ liệu
    # `gen_random_uuid()` có sẵn trong PostgreSQL từ bản 13, không cần pgcrypto.
    # UUIDv4 chứ không phải v7 như code sinh ra — chấp nhận được cho dữ liệu
    # chuyển đổi một lần, và không đáng để nhúng một hàm v7 vào migration.
    op.execute(
        sa.text(
            """
            INSERT INTO quest_questions
                (id, created_at, updated_at, quest_id, question_id, order_index, points)
            SELECT gen_random_uuid(), now(), now(), id, question_id, 1,
                   COALESCE(points_override, :default_points)
            FROM quests
            """
        ).bindparams(default_points=DEFAULT_POINTS)
    )

    # ---------------------------------------------------------------- 3. gọt bảng quests
    op.add_column("quests", sa.Column("pass_score", sa.Integer(), nullable=True))
    op.create_check_constraint(
        op.f("ck_quests_pass_score_non_negative"),
        "quests",
        "pass_score IS NULL OR pass_score >= 0",
    )

    op.drop_index("ix_quests_question", table_name="quests")
    op.drop_constraint(op.f("fk_quests_question_id_questions"), "quests", type_="foreignkey")
    op.drop_column("quests", "question_id")
    op.drop_column("quests", "points_override")
    op.drop_column("quests", "grants_map_shard")

    # ---------------------------------------------------------------- 4. ràng buộc quest_answers
    op.drop_constraint(op.f("uq_quest_answers_attempt"), "quest_answers", type_="unique")
    op.drop_index("uq_quest_answers_correct_once", table_name="quest_answers")

    op.create_unique_constraint(
        op.f("uq_quest_answers_attempt"),
        "quest_answers",
        ["stage_run_id", "user_id", "quest_id", "question_id", "attempt_no"],
    )
    op.create_index(
        "uq_quest_answers_correct_once",
        "quest_answers",
        ["stage_run_id", "user_id", "quest_id", "question_id"],
        unique=True,
        postgresql_where=sa.text("is_correct"),
    )


def downgrade() -> None:
    op.drop_index("uq_quest_answers_correct_once", table_name="quest_answers")
    op.drop_constraint(op.f("uq_quest_answers_attempt"), "quest_answers", type_="unique")
    op.create_unique_constraint(
        op.f("uq_quest_answers_attempt"),
        "quest_answers",
        ["stage_run_id", "user_id", "quest_id", "attempt_no"],
    )
    op.create_index(
        "uq_quest_answers_correct_once",
        "quest_answers",
        ["stage_run_id", "user_id", "quest_id"],
        unique=True,
        postgresql_where=sa.text("is_correct"),
    )

    op.add_column(
        "quests",
        sa.Column("grants_map_shard", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("quests", sa.Column("points_override", sa.Integer(), nullable=True))
    op.add_column("quests", sa.Column("question_id", UUID(as_uuid=True), nullable=True))

    # Lùi lại thì mỗi nhiệm vụ chỉ giữ được câu hỏi ĐẦU TIÊN — mô hình cũ không
    # diễn đạt nổi nhiều câu. Đây là mất mát có thật, không phải lùi sạch.
    op.execute(
        sa.text(
            """
            UPDATE quests q
            SET question_id = sub.question_id, points_override = sub.points
            FROM (
                SELECT DISTINCT ON (quest_id) quest_id, question_id, points
                FROM quest_questions
                ORDER BY quest_id, order_index
            ) sub
            WHERE q.id = sub.quest_id
            """
        )
    )
    # Nhiệm vụ không có câu hỏi nào thì mô hình cũ không chứa được — xoá đi.
    op.execute(sa.text("DELETE FROM quests WHERE question_id IS NULL"))
    op.alter_column("quests", "question_id", nullable=False)

    op.create_foreign_key(
        op.f("fk_quests_question_id_questions"),
        "quests",
        "questions",
        ["question_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_quests_question", "quests", ["question_id"])

    op.drop_constraint(op.f("ck_quests_pass_score_non_negative"), "quests", type_="check")
    op.drop_column("quests", "pass_score")

    op.drop_index("ix_quest_questions_question", table_name="quest_questions")
    op.drop_index(op.f("ix_quest_questions_quest_id"), table_name="quest_questions")
    op.drop_table("quest_questions")

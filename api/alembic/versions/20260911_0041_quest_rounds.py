"""Quest rounds: replay one quest inside a run, keep the best result.

A player may redo a single quest as many times as they like. Each redo starts a
new ROUND. Answers are never deleted, so the log still says what happened every
time; the report reads the BEST round.

Two pieces:

* ``quest_answers.round_no`` - which round an answer belongs to. Both uniqueness
  rules must include it, otherwise round 2 collides with round 1: the attempt
  key would reject a second try at the same question, and the "correct only
  once" partial index would reject answering it correctly again.

* ``stage_run_players.rounds_json`` - the round each quest is CURRENTLY on, as
  ``{quest_id: n}``. Needed because a round can exist with no answers in it yet:
  the player presses Try again and has not answered anything, and there is
  nothing in ``quest_answers`` to read the round from.

Existing data is round 1. That is the truth, not a guess: before this migration
there was exactly one round.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0041_quest_rounds"
down_revision: str | None = "0040_verdict_lines"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "quest_answers",
        sa.Column("round_no", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_check_constraint("round_no_positive", "quest_answers", "round_no >= 1")

    op.drop_constraint("uq_quest_answers_attempt", "quest_answers", type_="unique")
    op.create_unique_constraint(
        "uq_quest_answers_attempt",
        "quest_answers",
        ["stage_run_id", "user_id", "quest_id", "question_id", "round_no", "attempt_no"],
    )

    op.drop_index("uq_quest_answers_correct_once", table_name="quest_answers")
    op.create_index(
        "uq_quest_answers_correct_once",
        "quest_answers",
        ["stage_run_id", "user_id", "quest_id", "question_id", "round_no"],
        unique=True,
        postgresql_where=sa.text("is_correct"),
    )

    op.add_column(
        "stage_run_players",
        sa.Column(
            "rounds_json",
            sa.dialects.postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("stage_run_players", "rounds_json")

    op.drop_index("uq_quest_answers_correct_once", table_name="quest_answers")
    op.create_index(
        "uq_quest_answers_correct_once",
        "quest_answers",
        ["stage_run_id", "user_id", "quest_id", "question_id"],
        unique=True,
        postgresql_where=sa.text("is_correct"),
    )

    op.drop_constraint("uq_quest_answers_attempt", "quest_answers", type_="unique")
    op.create_unique_constraint(
        "uq_quest_answers_attempt",
        "quest_answers",
        ["stage_run_id", "user_id", "quest_id", "question_id", "attempt_no"],
    )

    op.drop_constraint("round_no_positive", "quest_answers", type_="check")
    op.drop_column("quest_answers", "round_no")

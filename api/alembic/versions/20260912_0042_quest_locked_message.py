"""Per-quest LOCKED message.

Today every locked quest shows the same generated sentence: "Locked. Go and
clear <NPC> first ...". One line for every door in the game, so the tenth door
says exactly what the first one said.

The column holds the teacher's own wording per quest, i18n like every other
piece of display text. Empty is the normal state and means "use the generated
sentence" - so nothing changes for worlds nobody has edited.

No column for the audio: recordings live in ``voice_lines``, keyed by
``(voice_id, sha256(text))``. Two quests whose gatekeeper shares a voice and
whose text happens to match reuse the same recording, and editing a line changes
the hash so only that line needs recording again. A column here would be a
second place to keep the same fact.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0042_quest_locked_message"
down_revision: str | None = "0041_quest_rounds"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "quests",
        sa.Column(
            "locked_message_i18n",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("quests", "locked_message_i18n")

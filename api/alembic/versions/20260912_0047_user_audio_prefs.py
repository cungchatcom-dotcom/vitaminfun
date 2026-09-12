"""Music on/off and volume follow the ACCOUNT, not the browser.

The setting lived in localStorage, with a reason written next to it: it is a
property of the machine you are sitting at, so two children sharing a class
account on two computers each keep their own volume.

In a classroom that reasoning is backwards. A child turns the music off on the
lab computer on Monday, sits at a different one on Wednesday, and the music is
back - because the choice stayed with the furniture instead of with them. And
the same shared computer hands the previous child's setting to the next one.

So it moves onto the user row. One column, JSON, because these are the same
kind of small player-side preferences that tend to arrive in twos and threes,
and each of them as its own column is a migration per whim.

Empty object is the normal state and means "the defaults" - music on, full
volume - so nobody's experience changes because of this migration.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0047_user_audio_prefs"
down_revision: str | None = "0046_locked_stage_opacity"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "audio_prefs_json",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "audio_prefs_json")

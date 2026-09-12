"""Manual LOCK on a stage.

Until now a stage opened on skill points alone: reach the threshold, walk in.
That covers "not strong enough yet" but not "not yet, because I say so" - a
stage that is finished, published, and deliberately held shut until a lesson,
a week, an event.

Hiding it instead is a worse answer: the class cannot see that there IS more
coming, and the map grows a hole where a stage used to be. Locked-and-visible
is the shape that says "there is a door here, it opens later".

Default false: every stage that exists today keeps opening exactly the way it
did before this column, so no world changes because of a migration.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0044_stage_locked"
down_revision: str | None = "0043_site_config"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "stages",
        sa.Column(
            "is_locked",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("stages", "is_locked")

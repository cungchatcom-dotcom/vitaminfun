"""How dark a LOCKED stage looks on the student's minimap.

The locked dots carry a dark overlay so the padlock and the stage name stay
readable on top of whatever picture the teacher uploaded. The number that
controls it was written into a Tailwind class - bg-abyss-950/75 - which means
"too dark" was a code change, a build and a deploy.

It is a taste decision on top of art nobody sees until the world is built, so
it belongs to the person who built the world, in the config screen, on a
slider.

Percent, not an opacity float: the screen shows "70%", and a column that holds
exactly what the screen shows is one less conversion to get wrong. Default 75
is the value the class had, so no installation changes look because of this.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0045_locked_stage_dim"
down_revision: str | None = "0044_stage_locked"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "site_config",
        sa.Column(
            "locked_stage_dim",
            sa.SmallInteger(),
            nullable=False,
            server_default=sa.text("75"),
        ),
    )
    op.create_check_constraint(
        "locked_stage_dim_range",
        "site_config",
        "locked_stage_dim >= 0 AND locked_stage_dim <= 100",
    )


def downgrade() -> None:
    op.drop_constraint("locked_stage_dim_range", "site_config", type_="check")
    op.drop_column("site_config", "locked_stage_dim")

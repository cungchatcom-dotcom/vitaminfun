"""Second LAYOUT per screen: portrait, alongside the existing landscape one.

A phone held sideways is about 2.2 to 2.6 units wide for every 1 unit tall. The
artwork is 16:9, which is 1.78. So even after the player turns the phone there
are empty bands down both sides and everything is shrunk to fit the short
dimension. Scaling cannot fix that: what is wrong is the LAYOUT, not the size.

So a screen may now carry two layouts, authored separately: the landscape one
in the existing columns (3200x1800), and a portrait one here (1800x3200 - the
same numbers transposed, so nobody has to learn a second coordinate system).

One JSONB column rather than twenty parallel columns (portrait_title_x,
portrait_title_y, and so on). Parallel columns double with every orientation
anyone ever adds, and the landscape half works today - there is no reason to
reopen it. A separate table was the other option and it is worse for the same
reason: it would mean moving the working landscape rows into a new shape to buy
symmetry on paper.

Empty object is the normal state and means "no portrait layout authored yet".
Every existing galaxy starts there, nobody has to do anything, and the player
side keeps asking those screens to be turned sideways exactly as it does today.

Only what depends on the SHAPE of the screen lives here: background art, the
title and description frame art, and where each world sits and how big it is.
Name, description, music, the world's own ring and pulse - all shared, because
none of them change when the screen turns.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0048_portrait_layout"
down_revision: str | None = "0047_user_audio_prefs"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    for table in ("galaxies", "worlds"):
        op.add_column(
            table,
            sa.Column(
                "portrait_json",
                postgresql.JSONB(),
                nullable=False,
                server_default=sa.text("'{}'::jsonb"),
            ),
        )


def downgrade() -> None:
    for table in ("galaxies", "worlds"):
        op.drop_column(table, "portrait_json")

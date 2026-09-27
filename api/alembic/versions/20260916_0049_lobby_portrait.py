"""Portrait LAYOUT for the world lobby, beside the landscape one.

Same reasoning as 0048, one screen further in: the lobby is another 16:9 picture
with thirteen blocks placed on it by percentage, and a phone held upright cannot
show it.

Its own column, not the one 0048 added. `worlds.portrait_json` is where that
world SITS ON THE GALAXY MAP; this is how its LOBBY is arranged. Two different
screens, two different layouts, and folding them into one column would mean a
key prefix per screen inside a single blob - the same mistake as parallel
columns, just spelled differently.

Shape, mirroring what the landscape half keeps in three separate places:

    {
      "background_media_id": ...,        # worlds.lobby_media_id
      "title_*": ..., "desc_*": ...,     # worlds.title_*, worlds.desc_*
      "blocks": { "<key>": {...} }       # worlds.lobby_json
    }

Empty object means no portrait lobby has been authored, and phones held upright
keep being asked to turn sideways - exactly today's behaviour.

No inheritance between the two orientations. A landscape frame left empty falls
back to the galaxy's, which is an old rule and stays. But an empty portrait
field does NOT fall back to landscape: those coordinates live in a 3200x1800
space, and dropping them into an 1800x3200 one puts them off the edge.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0049_lobby_portrait"
down_revision: str | None = "0048_portrait_layout"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "worlds",
        sa.Column(
            "lobby_portrait_json",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("worlds", "lobby_portrait_json")

"""Portrait LAYOUT for the stage scene and its quests.

Third and last of the 0048/0049 family, and the one that costs most, because
this scene is drawn by Phaser rather than by HTML: the 3200x1800 world grid is
baked into scene setup, hero scaling, the walkable polygon and every quest's
trigger radius.

stages.portrait_json:

    { "background_media_id": ...,   # stages.background_media_id
      "collision": {...},           # stages.collision_json, walkable polygon
      "spawn_x": ..., "spawn_y": ...,
      "character_height": ...,
      "dialogue": {...} }           # stages.dialogue_json, panel layout

quests.portrait_json:

    { "scene_x", "scene_y", "icon_size", "trigger_radius" }

Shared, as before: questions, dialogue lines, the gatekeeper, music, the time
limit, energy, points. Split: anything carrying a coordinate, and anything that
is a picture.

The walkable polygon has to be DRAWN AGAIN rather than scaled. It is a polygon
in a 16:9 grid; multiplying it into a 9:16 one puts the floor somewhere other
than where the floor is - and the portrait background is a different picture,
not the landscape one turned on its side.

Empty object means no portrait layout, and phones held upright keep being asked
to turn sideways, exactly as today.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0050_stage_portrait"
down_revision: str | None = "0049_lobby_portrait"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    for table in ("stages", "quests"):
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
    for table in ("stages", "quests"):
        op.drop_column(table, "portrait_json")

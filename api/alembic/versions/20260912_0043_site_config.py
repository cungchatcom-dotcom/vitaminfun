"""Site-wide configuration: page title and favicon.

One row, holding what the SIGN ABOVE THE DOOR says: the browser tab title and
the tab icon. A school running this wants its own name there, and that is a
thing the teacher changes from the screen while the site is running - not a
thing the operator edits in .env and restarts for.

Both columns are optional. Empty title means "use the name in messages/*.json",
null favicon means "use the static default file", which is exactly how the app
behaved before this table existed - so an installation that never opens the
config screen sees no change at all.

The favicon points at media_assets instead of holding a path: the image goes
through the same upload road as every other image (kind check, size cap,
content-addressed name), and deleting the asset sets this back to null rather
than leaving a link into nothing.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0043_site_config"
down_revision: str | None = "0042_quest_locked_message"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "site_config",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "title_i18n",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "favicon_media_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("media_assets.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("site_config")

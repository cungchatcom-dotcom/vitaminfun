"""Locked stages fade by OPACITY, not by a dark overlay.

0045 shipped a "dimming" percent: a black layer laid over the locked stage. It
works, but it is the wrong knob. A dark layer keeps the shape at full strength
and only drains the light out of it, so at high values the dot turns into a
black coin - still loud on the map, just unreadable.

Opacity is what the teacher actually asked for and what the eye expects from
"not available yet": the whole dot recedes toward the background, keeping its
colours, getting quieter as the number drops.

The two numbers run in OPPOSITE directions - 75 dim meant "mostly hidden", 75
opacity means "mostly visible" - so the column is renamed rather than reused:
a name that lies about its own scale is how a later reader sets the map to
nearly invisible while believing they made it clearer. The stored value resets
to the new default for the same reason.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0046_locked_stage_opacity"
down_revision: str | None = "0045_locked_stage_dim"
branch_labels: str | None = None
depends_on: str | None = None

#: Mo nhat nhung van doc duoc. Nguoi dung keo lai theo anh cua ho.
DEFAULT = 50


def upgrade() -> None:
    op.drop_constraint("locked_stage_dim_range", "site_config", type_="check")
    op.alter_column("site_config", "locked_stage_dim", new_column_name="locked_stage_opacity")
    op.alter_column(
        "site_config",
        "locked_stage_opacity",
        server_default=sa.text(str(DEFAULT)),
    )
    op.execute(f"UPDATE site_config SET locked_stage_opacity = {DEFAULT}")
    op.create_check_constraint(
        "locked_stage_opacity_range",
        "site_config",
        "locked_stage_opacity >= 0 AND locked_stage_opacity <= 100",
    )


def downgrade() -> None:
    op.drop_constraint("locked_stage_opacity_range", "site_config", type_="check")
    op.alter_column("site_config", "locked_stage_opacity", new_column_name="locked_stage_dim")
    op.alter_column("site_config", "locked_stage_dim", server_default=sa.text("75"))
    op.execute("UPDATE site_config SET locked_stage_dim = 75")
    op.create_check_constraint(
        "locked_stage_dim_range",
        "site_config",
        "locked_stage_dim >= 0 AND locked_stage_dim <= 100",
    )

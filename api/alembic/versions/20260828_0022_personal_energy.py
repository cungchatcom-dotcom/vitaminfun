"""Nang luong la cua TUNG NGUOI, va duoc cap sau khi qua NPC

Truoc day nang luong la mot quy CHUNG ca doi, cap ngay luc vao man, va can quy
la ca doi THUA (`status = 'lost_energy'`). Gio theo `PROJECT OVERVIEW.md`:

  - Nang luong la cua RIENG tung nguoi, giu o `stage_run_players`.
  - Vao man thi CHUA CO GI. Moi nguoi duoc cap khi chinh ho qua duoc nhiem vu
    NPC; so luong do giao vien dat o `stages.energy_per_player`.
  - Nang luong chi tra cho cac HANH DONG TRO GIUP (Dich, nghe lai, xem text).
    Tra loi sai KHONG con tru nang luong nua.
  - Het nang luong KHONG lam thua man - chi mat quyen dung tro giup. Vi the
    `'lost_energy'` bi go khoi rang buoc CHECK cua `stage_runs.status`.

Vi sao cap SAU khi qua NPC chu khong phai luc vao man: NPC la cong vao cua man
(xem migration 0021). Cap truoc thi nguoi choi tieu het nang luong vao cac hanh
dong tro giup ngay o cua, roi buoc vao phan chinh voi hai ban tay trang - ma
phan chinh moi la cho can tro giup.

Backfill: cac luot choi cu chia deu quy doi cu cho tung nguoi khong dung, nen
lay thang so cua CA DOI lam so cua moi nguoi. Day la du lieu lich su chi dung
de xem lai; khong co cach doc nguoc chinh xac tu mot quy chung.

Revision ID: 0022_personal_energy
Revises: 0021_npc_gate
Create Date: 2026-08-28
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0022_personal_energy"
down_revision: str | None = "0021_npc_gate"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # ---------------------------------------------------------------- stages
    op.alter_column("stages", "initial_team_energy", new_column_name="energy_per_player")
    # Cho phep 0: mot man khong phat nang luong la lua chon co that ("man nay
    # khong co tro giup"), khac han voi "quen dat".
    op.drop_constraint("energy_positive", "stages", type_="check")
    op.create_check_constraint("energy_per_player_non_negative", "stages", "energy_per_player >= 0")

    # ------------------------------------------------------ stage_run_players
    op.add_column(
        "stage_run_players",
        sa.Column("energy_granted", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "stage_run_players",
        sa.Column("energy_remaining", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_check_constraint(
        "energy_granted_non_negative", "stage_run_players", "energy_granted >= 0"
    )
    op.create_check_constraint(
        "energy_remaining_non_negative", "stage_run_players", "energy_remaining >= 0"
    )

    op.execute(
        """
        UPDATE stage_run_players p
        SET energy_granted   = r.team_energy_initial,
            energy_remaining = r.team_energy_remaining
        FROM stage_runs r
        WHERE r.id = p.stage_run_id
        """
    )

    # ------------------------------------------------------------ stage_runs
    op.drop_constraint("energy_non_negative", "stage_runs", type_="check")
    op.drop_column("stage_runs", "team_energy_initial")
    op.drop_column("stage_runs", "team_energy_remaining")

    # Het nang luong khong con la mot cach thua.
    op.drop_constraint("status_valid", "stage_runs", type_="check")
    op.create_check_constraint(
        "status_valid",
        "stage_runs",
        "status IN ('playing', 'won', 'lost_time', 'abandoned')",
    )


def downgrade() -> None:
    op.drop_constraint("status_valid", "stage_runs", type_="check")
    op.create_check_constraint(
        "status_valid",
        "stage_runs",
        "status IN ('playing', 'won', 'lost_energy', 'lost_time', 'abandoned')",
    )

    op.add_column(
        "stage_runs",
        sa.Column("team_energy_initial", sa.Integer(), nullable=False, server_default="100"),
    )
    op.add_column(
        "stage_runs",
        sa.Column("team_energy_remaining", sa.Integer(), nullable=False, server_default="100"),
    )
    op.create_check_constraint("energy_non_negative", "stage_runs", "team_energy_remaining >= 0")

    op.drop_constraint("energy_remaining_non_negative", "stage_run_players", type_="check")
    op.drop_constraint("energy_granted_non_negative", "stage_run_players", type_="check")
    op.drop_column("stage_run_players", "energy_remaining")
    op.drop_column("stage_run_players", "energy_granted")

    op.drop_constraint("energy_per_player_non_negative", "stages", type_="check")
    op.alter_column("stages", "energy_per_player", new_column_name="initial_team_energy")
    op.create_check_constraint("energy_positive", "stages", "initial_team_energy > 0")

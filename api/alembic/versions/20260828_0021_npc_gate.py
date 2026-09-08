"""Nhiem vu NPC bat buoc: moi man dung MOT cai, va no la cong vao

Truoc day nhiem vu `advisor` chi la mot lua chon: giao vien co the tao mot man
khong co NPC nao, hoac tao ba cai. Gio no la LUAT:

  - moi man co DUNG MOT nhiem vu `phase = 'advisor'` (chi so mot phan ben duoi),
  - nhiem vu do sinh ra cung luc voi man choi (xem `create_stage`),
  - moi nhiem vu khac cua man KHOA cho toi khi nguoi choi qua duoc no.

Cong nay dong thoi bao dam luat "moi thanh vien phai hoan thanh it nhat mot
nhiem vu thi ca doi moi duoc chia manh ban do": ai cung phai qua NPC.

Backfill lam hai nhip, thu tu quan trong:

  1. Man nao da co san mot nhiem vu mang khoa vat the 'npc' ma con dang
     `phase = 'main'` thi NANG no len `advisor`, giu nguyen cau hoi ben trong.
     Chen moi truoc buoc nay se dung UNIQUE(stage_id, quest_object_key).
  2. Man nao van chua co thi CHEN mot cai moi, `order_index` dat sao cho luon
     dung dau danh sach va khong dung ai.

Downgrade CHI go chi so. Khong xoa cac nhiem vu NPC da tao: giao vien co the da
lap cau hoi vao chung, va mot lenh `downgrade` khong duoc phep an bai soan cua
nguoi khac.

Revision ID: 0021_npc_gate
Revises: 0020_stats_blocks
Create Date: 2026-08-28
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0021_npc_gate"
down_revision: str | None = "0020_stats_blocks"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # 1. Nang nhiem vu 'npc' co san len lam nhiem vu NPC chinh thuc.
    op.execute(
        """
        UPDATE quests AS q
        SET phase = 'advisor'
        WHERE q.quest_object_key = 'npc'
          AND q.phase <> 'advisor'
          AND NOT EXISTS (
              SELECT 1 FROM quests other
              WHERE other.stage_id = q.stage_id AND other.phase = 'advisor'
          )
        """
    )

    # 2. Man van chua co thi chen mot cai.
    #
    # `LEAST(0, MIN(order_index) - 1)`: bang 0 khi cac nhiem vu san co bat dau tu
    # 1 tro len (truong hop thuong gap), va lui xuong am khi 0 da bi chiem - kieu
    # nao cung tranh duoc UNIQUE(stage_id, order_index) va van dung dau danh sach.
    op.execute(
        """
        INSERT INTO quests (
            id, stage_id, order_index, phase, quest_object_key,
            name_i18n, energy_cost, created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            s.id,
            LEAST(0, COALESCE(
                (SELECT MIN(q.order_index) FROM quests q WHERE q.stage_id = s.id), 1
            ) - 1),
            'advisor',
            'npc',
            '{}'::jsonb,
            0,
            now(),
            now()
        FROM stages s
        WHERE NOT EXISTS (
            SELECT 1 FROM quests q WHERE q.stage_id = s.id AND q.phase = 'advisor'
        )
        """
    )

    # 3. Tu gio khong the co hai cai. Chi so MOT PHAN chu khong phai UNIQUE
    #    thuong: nhiem vu `main` thi bao nhieu cai cung duoc.
    op.create_index(
        "uq_quests_stage_advisor",
        "quests",
        ["stage_id"],
        unique=True,
        postgresql_where=sa.text("phase = 'advisor'"),
    )


def downgrade() -> None:
    op.drop_index("uq_quests_stage_advisor", table_name="quests")

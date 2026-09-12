"""HOI THOAI VOI NGUOI CANH GIU - bo cuc cua man, NPC cua nhiem vu

  stages.dialogue_json      bo cuc sau khoi. NULL = ke thua man dau cua world.
  characters.kind           'player' | 'npc' - cung mot bang, hai vai tro.
  quests.npc_character_id   NPC canh giu nhiem vu nay. NULL = chua gan.

Xem GAME_DOMAIN.md 3f va UI_META_SCREENS.md S5 / S5b.

## Vi sao NPC la mot CHARACTER, khong phai mot tam anh

Ban dau cot nay la `quests.portrait_media_id` - mot tam chan dung tinh. Nhung
nguoi canh giu can NHIEU tu the: mot luc dang noi, mot luc dang cho hoc sinh tra
loi. Va nhan vat cua hoc sinh con nhieu hon - nghe, nghi, tra loi, bi che, duoc
khen. Bay tam anh, va tat ca deu la spritesheet de chay duoc hoat anh.

Do dung la thu bang `character_actions` da lam tu lau:

    action_key la chuoi TU DO, them mot hanh dong moi la viec cua nguoi dung
    noi dung, khong phai cua mot migration.  (chu thich trong model)

Nen bay tu the la bay `action_key` moi - migration nay KHONG dung toi chung.
Thu duy nhat phai them la mot cot `kind` de biet ban ghi nao la NPC, va mot
khoa ngoai tu nhiem vu sang nhan vat.

`frames = 1` cung da hop le, nen mot anh tinh chi la spritesheet mot khung.
Khong co tu the nao thi lui ve `characters.avatar_media_id`.

## kind: mot bang, hai vai tro

Khong tach bang `npcs` rieng: NPC va nhan vat hoc sinh dung CHUNG toan bo bo may
spritesheet - tai anh, cat khung, xem truoc, doi frame_rate. Tach ra la chep ca
bo do lan thu hai, roi hai ban lech nhau o dung cho ai do sua mot ben.

Mac dinh 'player' de moi ban ghi dang co giu nguyen vai tro cu.

Cai gia: moi cho liet ke nhan vat cho hoc sinh CHON phai loc `kind = 'player'`.
Trong ma nguon hien co dung bon cho goi `select(Character)`, va chi mot trong so
do la danh sach de chon - nen cai gia do dem duoc, va no nho.

## Bo cuc o MAN, NPC o NHIEM VU

Mot man co mot bo mat. Nam nhiem vu nhan ba muoi man la 150 lan can tay cho mot
world - se khong ai lam het, va world se co 150 man hoi thoai lech nhau. Nen bo
cuc thuoc ve MAN; thu duy nhat doi theo nhiem vu la NGUOI canh giu.

`dialogue_json = NULL` nghia la KE THUA bo cuc cua man DAU TIEN trong world,
dung nep `character_height`: can mot lan o man 1, ca world theo, va sua lai man
1 sau do van lan xuong.

## Khong co cot anh nen hoi thoai

Mac dinh la `stages.background_media_id` da co: cuoc noi chuyen dien ra dung cho
hoc sinh dang dung, va khong ai phai tai them anh.

Revision ID: 0035_quest_dialogue
Revises: 0034_stage_intro_video
Create Date: 2026-09-09
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0035_quest_dialogue"
down_revision: str | None = "0034_stage_intro_video"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "stages",
        sa.Column("dialogue_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "characters",
        sa.Column(
            "kind",
            sa.String(length=16),
            nullable=False,
            server_default="player",
        ),
    )
    op.create_check_constraint(
        "kind_valid", "characters", "kind IN ('player', 'npc')"
    )
    op.add_column(
        "quests",
        sa.Column(
            "npc_character_id",
            sa.UUID(as_uuid=True),
            # SET NULL chu khong CASCADE: xoa mot NPC khong duoc xoa theo nhiem
            # vu dang dung no. Nhiem vu mat khuon mat thi hoi thoai lui ve khung
            # avatar trong - van choi duoc, va nguoi dung gan lai mot NPC khac.
            sa.ForeignKey("characters.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("quests", "npc_character_id")
    op.drop_constraint("kind_valid", "characters", type_="check")
    op.drop_column("characters", "kind")
    op.drop_column("stages", "dialogue_json")

"""MA DINH DANH cho world / stage / quest, va dia chi goc cua cau hoi nhap khau

Bo phan noi dung soan game trong mot file .xlsx, va trong do moi thu duoc goi
bang MA chu khong bang UUID: `W1`, `W1-S1`, `W1-S1-Quest-01`. Nhung ma nay do
NGUOI dat, on dinh qua nhieu lan xuat file, va la thu duy nhat noi mot dong
trong bang tinh voi mot ban ghi trong database.

Migration nay them:

  1. `worlds.world_code`, `stages.stage_code`, `quests.quest_code` - dia chi cua
     chinh ban ghi do. Giao vien dien tay trong trinh thiet ke.
  2. `questions.world_code / stage_code / quest_code` - dia chi NOI CAU HOI
     THUOC VE, chep tu file luc nhap.

Vi sao cau hoi giu ma thay vi chi giu khoa ngoai toi quest:

  - Luc nhap, nhiem vu mang ma do CO THE CHUA TON TAI. Khong co cho ghi dia chi
    thi cau hoi roi vao kho ma khong ai biet no thuoc man nao - va nguoi dung
    phai doi chieu bang tay giua file Excel va giao dien.
  - Nhap lai cung mot file KHONG duoc sinh ra ban sao. Cap
    (`quest_code`, `question_order`) chinh la danh tinh cua mot dong trong sheet
    Questions, nen no vua la dia chi vua la khoa chong trung.
  - Mo mot man choi thi hien duoc ngay nhung cau hoi cung `stage_code`, ke ca
    nhung cau chua duoc lap vao nhiem vu nao.

Tat ca deu NULL duoc: du lieu dang co khong co ma nao, va mot world dung tay
khong bat buoc phai co ma.

## Duy nhat, nhung chi khi khac NULL

Ma la mot DIA CHI. Hai nhiem vu cung mang `W1-S1-Quest-01` thi luc nhap khong
biet lap cau hoi vao cai nao - va no se chon bua mot cai. Nen dat unique index
CO DIEU KIEN `WHERE ... IS NOT NULL`: nhieu ban ghi chua co ma thi khong sao,
nhung da co ma thi ma do la cua rieng no.

Revision ID: 0030_content_codes
Revises: 0029_galaxy_world_audio
Create Date: 2026-09-04
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0030_content_codes"
down_revision: str | None = "0029_galaxy_world_audio"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


#: (bang, ten cot) - ma dinh danh cua chinh ban ghi, duy nhat khi khac NULL.
OWN_CODES: tuple[tuple[str, str], ...] = (
    ("worlds", "world_code"),
    ("stages", "stage_code"),
    ("quests", "quest_code"),
)

#: Dia chi goc chep vao cau hoi luc nhap khau. KHONG duy nhat: mot man co nhieu
#: cau, mot nhiem vu cung vay.
QUESTION_CODES: tuple[str, ...] = ("world_code", "stage_code", "quest_code")


def upgrade() -> None:
    for table, column in OWN_CODES:
        op.add_column(table, sa.Column(column, sa.String(length=64), nullable=True))
        op.create_index(
            f"uq_{table}_{column}",
            table,
            [column],
            unique=True,
            postgresql_where=sa.text(f"{column} IS NOT NULL"),
        )

    for column in QUESTION_CODES:
        op.add_column("questions", sa.Column(column, sa.String(length=64), nullable=True))

    # Thu tu trong nhiem vu, theo cot `question_order` cua file. Cung voi
    # `quest_code` thi day la khoa chong trung khi nhap lai cung mot file.
    op.add_column("questions", sa.Column("question_order", sa.Integer(), nullable=True))

    # Loc theo man choi la duong doc nong nhat cua tinh nang nay: mo mot man la
    # hoi ngay "kho co cau nao cua man nay khong".
    op.create_index("ix_questions_stage_code", "questions", ["stage_code"])
    # Cap nay la khoa chong trung luc nhap lai cung mot file. Khong dat unique:
    # mot dong hong trong file cu van co the da tao ra hai ban ghi, va mot rang
    # buoc cung se lam ca lan nhap that bai thay vi sua duoc.
    op.create_index("ix_questions_quest_code", "questions", ["quest_code"])


def downgrade() -> None:
    op.drop_index("ix_questions_quest_code", table_name="questions")
    op.drop_index("ix_questions_stage_code", table_name="questions")
    op.drop_column("questions", "question_order")
    for column in QUESTION_CODES:
        op.drop_column("questions", column)

    for table, column in OWN_CODES:
        op.drop_index(f"uq_{table}_{column}", table_name=table)
        op.drop_column(table, column)

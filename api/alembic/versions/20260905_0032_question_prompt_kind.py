"""CACH RA DE cua cau hoi: doc hay nghe, va transcript mo san hay khong

File noi dung co HAI cot kieu, va chung tra loi hai cau hoi khac han nhau:

  answer_type    hoc sinh TRA LOI bang cach nao   -> questions.type
  question_type  de bai DEN VOI hoc sinh the nao  -> questions.prompt_kind

Hai truc nay vuong goc nhau. Mot cau nghe roi chon phuong an va mot cau nghe roi
go chu la CUNG mot cach ra de voi hai cach tra loi; nhoi chung thanh
`LISTEN_MCQ` / `LISTEN_SHORT` la nhan doi so dang moi lan them mot cach ra de, va
moi ham cham phai hoc thuoc gap doi so ten.

  questions.prompt_kind      'text' (mac dinh) | 'audio'
  questions.show_transcript  doan chu cua de MO SAN hay giau sau nut Transcript

## Vi sao NOT NULL kem mac dinh, khong phai nullable

Moi cau hoi deu co mot cach ra de. Mot cau khong co audio LA mot cau doc - do la
su that, khong phai "chua dat". De nullable la de ra mot trang thai thu ba
(chua-dat) trong khi no hien ra y het `text`, va khong ai phan biet duoc hai cai
do tren man hinh. Moi cau dang co vi the roi vao `text` va khong doi mot chut nao.

## Transcript khong co cot rieng

Transcript CHINH LA `content_json.prompt`. Mot ban chep loi rieng la mot ban sao
co the lech voi thu dang phat, va khong co gi bat hai ben khop nhau. Cau nhap tu
file .xlsx vi the da co san transcript - chinh la `question_content`.

`show_transcript` chi noi doan chu do MO SAN hay khong; nut Transcript thi luon
co. Mac dinh dong: nghe truoc la ca diem cua bai nghe. Nhung khong khoa han -
mot hoc sinh khong nghe ra thi can duong doc lai, va mot cau hoi khong giai ma
noi thi khong do duoc gi ca.

## `audio_media_id` da co san

Cot do duoc chep sang tu ban LMS tu dau nhung chua noi vao dau: khong co giao
dien tai len, `to_out()` khong tra ve, va de bai dong bang khong mang URL. Bo
sung nay la thu bat no vao viec, khong phai them cot moi.

Revision ID: 0032_question_prompt_kind
Revises: 0031_stage_spawn
Create Date: 2026-09-05
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0032_question_prompt_kind"
down_revision: str | None = "0031_stage_spawn"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "questions",
        sa.Column(
            "prompt_kind",
            sa.String(length=16),
            nullable=False,
            server_default="text",
        ),
    )
    op.add_column(
        "questions",
        sa.Column(
            "show_transcript",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    # Chot o DATABASE chu khong chi o Pydantic: mot gia tri la lot vao day thi
    # man hoc sinh khong biet ve cai gi, va no chi lo ra luc ca lop dang ngoi
    # truoc man hinh. Doi mot dong trong seed hay mot script vao thang database
    # deu di qua rang buoc nay.
    op.create_check_constraint(
        "prompt_kind_valid",
        "questions",
        "prompt_kind IN ('text', 'audio')",
    )
    # Loc kho theo cach ra de la duong doc co that: "cho toi xem moi bai nghe".
    op.create_index("ix_questions_prompt_kind", "questions", ["prompt_kind"])


def downgrade() -> None:
    op.drop_index("ix_questions_prompt_kind", table_name="questions")
    op.drop_constraint("prompt_kind_valid", "questions", type_="check")
    op.drop_column("questions", "show_transcript")
    op.drop_column("questions", "prompt_kind")

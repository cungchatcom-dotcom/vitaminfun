"""Test `to_out()` - cho DUY NHAT bien mot ban ghi cau hoi thanh phan hoi API.

Vi sao dang mot file rieng: mot truong khai bao trong `QuestionOut` KEM MOT GIA
TRI MAC DINH ma quen dien o `to_out()` thi khong co loi nao het. Pydantic dung
mac dinh, FastAPI tra 200, OpenAPI van sinh ra dung kieu, va TypeScript ben giao
dien van bien dich sach. Cai duy nhat sai la du lieu: `null` cho moi cau, mai mai.

Do dung la chuyen da xay ra voi bon truong ma dinh danh. Cau hoi nhap tu file
mang day du `stage_code`, `quest_code`, `question_order` trong database, nhung
API tra ve `null` het - nen bo chon cau hoi khong hien duoc nhan nhom nao, va
nhin tu ngoai thi giong het nhu bo nhap khau da khong ghi gi.

Test cuoi file la cai chot: no doi chieu DANH SACH TRUONG cua schema voi nhung
gi `to_out()` thuc su dat, nen mot truong moi them vao `QuestionOut` ma quen
dien se do ngay, khong can ai nho ra de viet them mot test.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest

from app.db.models import Question
from app.modules.questions.schemas import QuestionOut
from app.modules.questions.service import to_out

#: Truong khong den tu ban ghi cau hoi, nen `to_out()` khong dat chung.
#:
#: `answer` va `explanation` bi CHE co chu khi nguoi goi khong duoc phep xem -
#: chung duoc dat, nhung dat thanh `None`. Chung khong nam trong danh sach nay.
KHONG_TU_BAN_GHI: frozenset[str] = frozenset()

#: Mot id media co san trong kho, dung lam tep nghe gia.
ANH = uuid.UUID("01a06c12-779f-71d1-9ad7-514a180dfe59")


def _question(**kw) -> Question:
    """Mot ban ghi trong bo nho, khong cham database.

    `Question(...)` cua SQLAlchemy nhan thang tham so ten cot, va test nay noi
    ve PHEP DOI, khong noi ve luu tru.
    """
    now = datetime.now(UTC)
    mac_dinh = dict(
        id=uuid.uuid4(),
        type="MCQ_SINGLE",
        schema_version=1,
        points=10,
        time_limit_seconds=None,
        content_json={"prompt": "What saved the city?", "options": []},
        answer_json={"correctOptionId": "2"},
        explanation="Vi day la trai tim co khi.",
        status="published",
        level="A2",
        topic="Atlantis",
        tags=["grammar"],
        world_code=None,
        stage_code=None,
        quest_code=None,
        question_order=None,
        prompt_kind="text",
        show_transcript=False,
        image_media_id=None,
        audio_media_id=None,
        audio_max_plays=None,
        created_at=now,
        updated_at=now,
    )
    return Question(**{**mac_dinh, **kw})


# ==========================================================================
# Ma dinh danh - loi da tung xay ra
# ==========================================================================


def test_ma_dinh_danh_di_ra_toi_phan_hoi():
    out = to_out(
        _question(stage_code="W1-S1", quest_code="W1-S1-Quest-01", question_order=3),
        include_answer=False,
        audio_url=None,
    )
    assert out.stage_code == "W1-S1"
    assert out.quest_code == "W1-S1-Quest-01"
    assert out.question_order == 3


def test_cau_soan_tay_khong_co_ma():
    """Khong phai loi: cau khong den tu file thi khong co dia chi goc, va giao
    dien khong hien nhan nao."""
    out = to_out(_question(), include_answer=False, audio_url=None)
    assert (out.world_code, out.stage_code, out.quest_code, out.question_order) == (
        None,
        None,
        None,
        None,
    )


def test_thu_tu_0_khong_bi_doc_thanh_chua_dat():
    """`0` la mot thu tu hop le, va `if question.question_order:` se nuot no.

    Bay nay co that: cau dau tien cua mot file danh so tu 0 se mat thu tu, va
    bon cau cung mot nhiem vu tut xuong thanh bon dong khong phan biet duoc.
    """
    out = to_out(_question(question_order=0), include_answer=False, audio_url=None)
    assert out.question_order == 0


# ==========================================================================
# Cach ra de va tep nghe
# ==========================================================================


def test_cach_ra_de_va_url_tep_nghe_di_ra_toi_phan_hoi():
    """`audio_url` KHONG doc tu ban ghi - no la tham so bat buoc cua `to_out()`.

    Ham nay dong bo nen khong tu tra duoc bang media. Bat buoc truyen chu khong
    mac dinh `None`: quen truyen thi cau hoi nghe im lang mat tep nghe, dung cai
    kieu hong ma bon truong ma dinh danh da mac phai mot lan.
    """
    q = _question(prompt_kind="audio", show_transcript=True, audio_media_id=ANH)
    out = to_out(q, include_answer=False, audio_url="http://x/a.mp3")
    assert out.prompt_kind == "audio"
    assert out.show_transcript is True
    assert out.audio_media_id == ANH
    assert out.audio_url == "http://x/a.mp3"


def test_cau_doc_khong_co_gi_ve_am_thanh():
    out = to_out(_question(), include_answer=False, audio_url=None)
    assert out.prompt_kind == "text"
    assert out.show_transcript is False
    assert out.audio_url is None


# ==========================================================================
# Che dap an
# ==========================================================================


def test_khong_kem_dap_an_thi_che_ca_loi_giai():
    out = to_out(_question(), include_answer=False, audio_url=None)
    assert out.answer is None
    assert out.explanation is None


def test_kem_dap_an_thi_tra_du():
    out = to_out(_question(), include_answer=True, audio_url=None)
    assert out.answer == {"correctOptionId": "2"}
    assert out.explanation is not None


# ==========================================================================
# Cai chot: schema va phep doi khong duoc lech nhau
# ==========================================================================


@pytest.mark.parametrize("include_answer", [False, True])
def test_moi_truong_cua_schema_deu_duoc_dat(include_answer):
    """`to_out()` phai DAT moi truong cua `QuestionOut`, khong duoc de mac dinh.

    `model_fields_set` cua Pydantic nho truong nao that su duoc truyen vao. Mot
    truong vang mat o day nghia la no dang lay gia tri mac dinh cua schema chu
    khong lay gia tri cua ban ghi - dung cai bay da lam bon truong ma dinh danh
    tra ve `null` suot mot thoi gian ma khong ai thay.
    """
    out = to_out(_question(), include_answer=include_answer, audio_url=None)
    thieu = set(QuestionOut.model_fields) - out.model_fields_set - KHONG_TU_BAN_GHI
    assert thieu == set(), f"`to_out()` quen dat: {sorted(thieu)}"

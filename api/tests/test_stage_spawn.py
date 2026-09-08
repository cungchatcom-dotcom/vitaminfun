"""Test CHO XUAT PHAT cua man choi, va luat "null nghia la gi" trong PATCH.

Vi sao mot file rieng cho hai chuyen nghe khong lien quan: chung la CUNG MOT
luat, va mot trong hai da hong vi luat do khong duoc viet ra o dau ca.

Trong PATCH, `null` co the mang hai nghia trai nguoc nhau:

  - "khong gui truong nay"  -> giu nguyen gia tri dang co   (`_apply`)
  - "xoa truong nay"        -> ghi NULL xuong database      (`_apply_optional`)

Chon nham thi khong co loi nao het. Server tra ve 200, tra ve ban ghi y nhu cu,
va nguoi dung bam mot cai nut khong lam gi ca - lap di lap lai, vi khong co gi
tren man hinh noi rang cu bam do da khong toi noi.

Do dung la chuyen da xay ra voi nut "Go anh" cua nhiem vu: no gui
`{"icon_media_id": null}`, `_apply` thay `None` va bo qua. Test o day chot lai
ca hai nhanh cua luat, cho ca hai truong dang song duoi no.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from app.modules.worlds.router import (
    QUEST_CLEARABLE_FIELDS,
    QUEST_KEEP_FIELDS,
    STAGE_CLEARABLE_FIELDS,
    STAGE_KEEP_FIELDS,
    _apply,
    _apply_optional,
)
from app.modules.questions.router import (
    CLEARABLE_FIELDS as QUESTION_CLEARABLE,
    KEEP_FIELDS as QUESTION_KEEP,
)
from app.modules.questions.schemas import QuestionUpdate
from app.modules.worlds.schemas import QuestUpdate, StageUpdate


@dataclass
class FakeQuest:
    """Du de nhan gia tri gan vao. Khong dung model that: test nay noi ve LUAT
    GAN, khong noi ve SQLAlchemy."""

    icon_media_id: uuid.UUID | None = None
    quest_code: str | None = None
    icon_size: int | None = None


@dataclass
class FakeStage:
    spawn_x: int | None = None
    spawn_y: int | None = None
    character_height: int | None = None
    intro_video_media_id: uuid.UUID | None = None
    advisor_outro_audio_media_id: uuid.UUID | None = None
    background_media_id: uuid.UUID | None = None
    time_limit_seconds: int = 300


ANH = uuid.UUID("01a06c12-779f-71d1-9ad7-514a180dfe59")


def _quest(json: str) -> QuestUpdate:
    """Doc tu JSON THAT, khong dung `QuestUpdate(...)`.

    Day la ca diem mau chot: `model_fields_set` chi phan biet duoc "khong gui"
    voi "gui null" khi gia tri di qua duong ma no thuc su di - tu body cua
    request. Dung constructor thi test se dung ke ca khi luat da hong.
    """
    return QuestUpdate.model_validate_json(json)


def _stage(json: str) -> StageUpdate:
    return StageUpdate.model_validate_json(json)


# ==========================================================================
# Go anh nhiem vu - loi da tung xay ra
# ==========================================================================


def test_gui_null_thi_anh_bi_go():
    quest = FakeQuest(icon_media_id=ANH)
    _apply_optional(quest, _quest('{"icon_media_id": null}'), QUEST_CLEARABLE_FIELDS)
    assert quest.icon_media_id is None


def test_khong_gui_thi_anh_giu_nguyen():
    """Trinh thiet ke va tung mau payload mot: keo doi cho vat the gui
    `scene_x`/`scene_y` va khong duoc lam mat tam anh."""
    quest = FakeQuest(icon_media_id=ANH)
    _apply_optional(quest, _quest('{"icon_size": 200}'), QUEST_CLEARABLE_FIELDS)
    assert quest.icon_media_id == ANH


def test_gui_anh_moi_thi_ghi_de():
    khac = uuid.UUID("01a06c12-779f-71d1-9ad7-514a180dfe60")
    quest = FakeQuest(icon_media_id=ANH)
    _apply_optional(quest, _quest(f'{{"icon_media_id": "{khac}"}}'), QUEST_CLEARABLE_FIELDS)
    assert quest.icon_media_id == khac


def test_apply_thuong_KHONG_go_duoc_anh():
    """Chot lai chinh cai bay da lam nut "Go anh" im lang.

    Test nay khong kiem tra code hien tai lam dung - no kiem tra rang `_apply`
    van con cai tinh chat khien no SAI cho truong nay. Ngay nao ai do doi
    `_apply` thanh "null nghia la xoa" thi hai chuc truong khac se bat dau bi
    xoa moi lan trinh thiet ke va mot mau payload, va test nay do truoc.
    """
    quest = FakeQuest(icon_media_id=ANH)
    _apply(quest, _quest('{"icon_media_id": null}'), ("icon_media_id",))
    assert quest.icon_media_id == ANH


def test_hai_danh_sach_khong_giao_nhau():
    """`_apply` va `_apply_optional` khong duoc cung cam mot truong.

    Doc THANG hai hang so cua router, khong chep lai o day - mot ban chep se
    dung mai mai ke ca khi router da doi.

    Thu tu goi trong router la `_apply` truoc, `_apply_optional` sau, nen neu ca
    hai cung cam `icon_media_id` thi ket qua van dung - hom nay. Doi cho hai
    dong do la nut "Go anh" hong lai, im lang y nhu lan truoc.
    """
    assert set(QUEST_KEEP_FIELDS) & set(QUEST_CLEARABLE_FIELDS) == set()


def test_icon_media_id_nam_o_danh_sach_xoa_duoc():
    assert "icon_media_id" in QUEST_CLEARABLE_FIELDS


# ==========================================================================
# Cho xuat phat
# ==========================================================================


def test_dat_cho_xuat_phat():
    stage = FakeStage()
    _apply(stage, _stage('{"spawn_x": 820, "spawn_y": 1440}'), ("spawn_x", "spawn_y"))
    assert (stage.spawn_x, stage.spawn_y) == (820, 1440)


def test_khong_gui_thi_cho_xuat_phat_giu_nguyen():
    """Bang mau sac, bang am thanh, bang vung di duoc deu va tung mau payload
    rieng vao cung mot endpoint. Khong cai nao duoc lam mat cho xuat phat."""
    stage = FakeStage(spawn_x=820, spawn_y=1440)
    _apply(stage, _stage('{"character_height": 300}'), ("spawn_x", "spawn_y"))
    assert (stage.spawn_x, stage.spawn_y) == (820, 1440)


def test_gui_spawn_null_KHONG_xoa():
    """`null` o day nghia la "khong gui", dung nep voi `character_height`.

    Xoa phai noi bang co rieng `clear_spawn`. Neu `null` cung xoa duoc thi mot
    client cu - sinh tu ban OpenAPI truoc khi co cot nay va gui du moi truong -
    se xoa cho xuat phat cua moi man no cham vao.
    """
    stage = FakeStage(spawn_x=820, spawn_y=1440)
    _apply(stage, _stage('{"spawn_x": null, "spawn_y": null}'), ("spawn_x", "spawn_y"))
    assert (stage.spawn_x, stage.spawn_y) == (820, 1440)


def test_co_clear_spawn_doc_duoc():
    assert _stage('{"clear_spawn": true}').clear_spawn is True
    assert _stage('{"spawn_x": 10}').clear_spawn is None


def test_toa_do_am_van_nhan():
    """Khong ap khoang o schema - cung nep voi `quests.scene_x/scene_y`.

    He toa do the gioi la hang so cua phia giao dien, khong cua database, va
    canh choi van cuu ho ve o di duoc gan nhat. Chan o day la ghim mot con so
    3200 vao Python, roi ngay nao khung canh doi kich thuoc thi no sai mot
    cach kho tim.
    """
    stage = FakeStage()
    _apply(stage, _stage('{"spawn_x": -50, "spawn_y": 9000}'), ("spawn_x", "spawn_y"))
    assert (stage.spawn_x, stage.spawn_y) == (-50, 9000)


# ==========================================================================
# Cung mot luat, o module CAU HOI
# ==========================================================================


@dataclass
class FakeQuestion:
    audio_media_id: uuid.UUID | None = None
    image_media_id: uuid.UUID | None = None
    prompt_kind: str = "text"
    show_transcript: bool = False


def _question(json: str) -> QuestionUpdate:
    return QuestionUpdate.model_validate_json(json)


def test_go_tep_nghe_bang_cach_gui_null():
    """Nut "Go tep nghe" gui `{"audio_media_id": null}`. No phai XOA that.

    Day la cung mot cai bay da lam nut "Go anh" cua nhiem vu im lang - lan nay
    chot lai truoc khi no kip xay ra lan thu hai.
    """
    q = FakeQuestion(audio_media_id=ANH)
    _apply_optional(q, _question('{"audio_media_id": null}'), QUESTION_CLEARABLE)
    assert q.audio_media_id is None


def test_va_truong_khac_khong_lam_mat_tep_nghe():
    q = FakeQuestion(audio_media_id=ANH)
    payload = _question('{"show_transcript": true}')
    _apply(q, payload, QUESTION_KEEP)
    _apply_optional(q, payload, QUESTION_CLEARABLE)
    assert q.audio_media_id == ANH
    assert q.show_transcript is True


def test_show_transcript_false_van_luu_duoc():
    """`False` khong duoc bi `if value is not None` nuot mat.

    Bo chon o tich la mot cau tra loi, khong phai mot lan khong gui. Nuot no thi
    o tich bat len duoc ma khong bao gio tat duoc.
    """
    q = FakeQuestion(show_transcript=True)
    _apply(q, _question('{"show_transcript": false}'), QUESTION_KEEP)
    assert q.show_transcript is False


def test_hai_danh_sach_cua_cau_hoi_khong_giao_nhau():
    assert set(QUESTION_KEEP) & set(QUESTION_CLEARABLE) == set()


# ==========================================================================
# VIDEO MO MAN - cung mot luat, o cot moi nhat
# ==========================================================================


def test_go_video_mo_man_bang_cach_gui_null():
    """Nut "Go video" gui `{"intro_video_media_id": null}`. No phai XOA that.

    Lan thu ba cung mot cai bay (anh nhiem vu, tep nghe cau hoi, gio la video).
    Chot lai truoc khi no kip xay ra, chu khong sau.
    """
    stage = FakeStage(intro_video_media_id=ANH)
    _apply_optional(stage, _stage('{"intro_video_media_id": null}'), STAGE_CLEARABLE_FIELDS)
    assert stage.intro_video_media_id is None


def test_sua_thoi_gian_KHONG_lam_mat_video():
    """Keo lai gio choi thi video mo man phai con nguyen.

    Day la duong di THUC TE cua trinh thiet ke: no PATCH tung truong mot, va
    moi lan PATCH deu di qua ca hai vong gan. Mot truong nam nham danh sach thi
    sua bat cu thu gi khac cung xoa mat no.
    """
    stage = FakeStage(intro_video_media_id=ANH)
    payload = _stage('{"time_limit_seconds": 420}')
    _apply(stage, payload, STAGE_KEEP_FIELDS)
    _apply_optional(stage, payload, STAGE_CLEARABLE_FIELDS)
    assert stage.intro_video_media_id == ANH
    assert stage.time_limit_seconds == 420


def test_gan_video_moi_thi_ghi_de():
    stage = FakeStage()
    khac = uuid.UUID("01a06c12-779f-71d1-9ad7-514a180dfe60")
    _apply_optional(
        stage, _stage('{"intro_video_media_id": "%s"}' % khac), STAGE_CLEARABLE_FIELDS
    )
    assert stage.intro_video_media_id == khac


def test_apply_thuong_KHONG_go_duoc_video():
    """Chung minh vi sao `intro_video_media_id` KHONG duoc nam o KEEP.

    Neu ai do don dep bang cach gop no vao danh sach tren, day la thu se xay ra:
    server tra 200, video van con, nut khong lam gi ca.
    """
    stage = FakeStage(intro_video_media_id=ANH)
    _apply(stage, _stage('{"intro_video_media_id": null}'), ("intro_video_media_id",))
    assert stage.intro_video_media_id == ANH


def test_hai_danh_sach_cua_man_choi_khong_giao_nhau():
    """Mot truong nam ca hai cho thi ket qua phu thuoc thu tu hai dong goi.

    `_apply` chay truoc roi `_apply_optional` chay sau, nen ke thang cuoi - tuc
    la luat "null = xoa" am tham thang, ke ca voi nhung truong duoc dat vao KEEP
    chinh vi khong duoc phep xoa. Khong doc ra duoc tu bat cu dong nao trong
    `update_stage`.
    """
    assert set(STAGE_KEEP_FIELDS) & set(STAGE_CLEARABLE_FIELDS) == set()


def test_moi_truong_deu_co_that_tren_schema():
    """Danh sach go tay thi go sai ten se im lang khong lam gi.

    `_apply` doc `model_fields_set`, nen mot ten go nham chi don gian khong bao
    gio khop - khong AttributeError, khong canh bao, chi la mot truong vinh vien
    khong luu duoc.
    """
    co = set(StageUpdate.model_fields)
    assert set(STAGE_KEEP_FIELDS) - co == set()
    assert set(STAGE_CLEARABLE_FIELDS) - co == set()

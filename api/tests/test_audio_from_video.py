"""Test co "lay TIENG CUA VIDEO NEN lam nhac nen".

Vi sao dang mot file rieng: cai co nay la mot cong tac gat giua HAI nguon tieng
cho cung mot khoi `ambient`. Gat sai thi khong co loi nao het — man choi chi im
lang, hoac phat nham ban nhac giao vien tuong da tat. Ca hai deu chi lo ra luc
ca lop dang ngoi truoc man hinh.

Luat duoc kiem o day:

1. Co chi co nghia o khoi `ambient`. `walk`/`idle` gan voi hanh dong cua nhan
   vat — khong co doan tieng video nao tuong ung voi mot buoc chan.
2. Bat co KHONG xoa `media_id`. Bo chon la ban nhac cu phat lai ngay, khong phai
   tai len lan nua.
3. Gop theo tung khoi: gui `ambient` khong duoc lam mat `walk`.
"""

from __future__ import annotations

import uuid

import pytest

from app.core.errors import ValidationFailedError
from app.modules.worlds.router import _merge_audio
from app.modules.worlds.schemas import AudioTrack


def _track(**kw) -> AudioTrack:
    return AudioTrack.model_validate(kw)


# ==========================================================================
# Co chi thuoc ve khoi nhac nen
# ==========================================================================


def test_ambient_duoc_phep_lay_tieng_video():
    merged = _merge_audio({}, {"ambient": _track(from_video=True)})
    assert merged["ambient"]["from_video"] is True


@pytest.mark.parametrize("slot", ["walk", "idle"])
def test_khoi_khac_bat_co_la_loi(slot):
    """Chan ngay o cua vao, khong tin rang giao dien se khong bao gio gui len."""
    with pytest.raises(ValidationFailedError):
        _merge_audio({}, {slot: _track(from_video=True)})


@pytest.mark.parametrize("slot", ["walk", "idle"])
def test_khoi_khac_van_binh_thuong_khi_khong_bat_co(slot):
    """Chot chan chi nham vao `from_video`, khong dung gi den phan con lai."""
    merged = _merge_audio({}, {slot: _track(volume=80)})
    assert merged[slot]["volume"] == 80


def test_from_video_false_khong_bi_chan():
    """`False` la mot cau tra loi hop le cho moi khoi, khong phai mot lan bat co.

    Giao dien bo chon o `walk` (du no chua bao gio bat duoc) van phai luu duoc,
    neu khong thi mot lan bo chon lai bao 422 kho hieu.
    """
    merged = _merge_audio({}, {"walk": _track(from_video=False, volume=50)})
    assert merged["walk"]["from_video"] is False


# ==========================================================================
# Bat co KHONG lam mat file da tai
# ==========================================================================


def test_bat_co_van_giu_media_id():
    """Day la ly do co nam CANH `media_id` chu khong thay the no.

    Bo chon phai tra lai dung ban nhac cu. Neu bat co ma xoa `media_id` thi
    giao vien mat file, va "bo chon" tro thanh "tai len lan nua".
    """
    mid = str(uuid.uuid4())
    merged = _merge_audio({}, {"ambient": _track(media_id=mid, from_video=True, volume=60)})
    assert merged["ambient"]["media_id"] == mid
    assert merged["ambient"]["volume"] == 60


def test_bo_chon_thi_ban_nhac_cu_van_con():
    mid = str(uuid.uuid4())
    buoc1 = _merge_audio({}, {"ambient": _track(media_id=mid, from_video=True)})
    buoc2 = _merge_audio(buoc1, {"ambient": _track(media_id=mid, from_video=False)})
    assert buoc2["ambient"]["media_id"] == mid
    assert buoc2["ambient"]["from_video"] is False


# ==========================================================================
# Gop theo tung khoi
# ==========================================================================


def test_gui_ambient_khong_lam_mat_walk():
    dang_co = {"walk": {"media_id": "abc", "volume": 70}}
    merged = _merge_audio(dang_co, {"ambient": _track(from_video=True)})
    assert merged["walk"]["volume"] == 70
    assert merged["ambient"]["from_video"] is True


def test_khong_gui_gi_thi_giu_nguyen():
    dang_co = {"ambient": {"media_id": "abc", "from_video": True}}
    assert _merge_audio(dang_co, None) == dang_co

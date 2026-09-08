"""Test lop kiem tra du lieu cua VUNG DI DUOC.

Vi sao dang mot file test rieng cho viec nay: mot hinh hong lot xuong database
khong bao loi ngay. No dong bang vao de bai, roi bien thanh mot buc tuong vo
hinh trong luc hoc sinh dang choi — hoac tho hon, mot vung cam nuot ca ban do va
nhot nguoi choi tai cho. Luc do khong ai truy nguoc duoc ve cai hinh nao.

Moi test o day tuong ung mot cach giao vien (hoac mot phien ban cu cua trinh
dung) co the sinh ra du lieu hong ma khong biet.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.modules.worlds.schemas import MAX_POLY_POINTS, MAX_SHAPES, CollisionMap, CollisionShape


def _box(**kw) -> dict:
    return {"id": "s1", "mode": "allow", "kind": "rect", "x": 0, "y": 0, "w": 100, "h": 80} | kw


# ==========================================================================
# Truong hop hop le
# ==========================================================================


def test_hop_va_oval_chi_can_khung_bao():
    for kind in ("rect", "ellipse"):
        shape = CollisionShape.model_validate(_box(kind=kind))
        assert shape.points is None


def test_da_giac_chi_can_dinh():
    shape = CollisionShape.model_validate(
        {"id": "p", "mode": "block", "kind": "poly", "points": [[0, 0], [10, 0], [10, 10]]}
    )
    assert shape.w is None


def test_ban_do_mac_dinh_la_cam_ngoai_moi_hinh():
    """Bat che do ve len la de khoanh CHO DI DUOC, nen hinh dau tien phai an ngay.

    De `walkable` thi hinh `allow` dau tien chang doi gi ca va cong cu trong nhu
    hong. Ai muon nguoc lai thi bat cong tac mot lan.
    """
    assert CollisionMap().default == "blocked"
    assert CollisionMap().shapes == []


def test_ghi_ra_json_khong_keo_theo_khoa_rong():
    """`exclude_none` la thu giu cot JSONB khoi phinh gap doi de chua so khong."""
    dumped = CollisionMap(shapes=[CollisionShape.model_validate(_box())]).model_dump(
        mode="json", exclude_none=True
    )
    assert "points" not in dumped["shapes"][0]
    assert dumped["shapes"][0]["w"] == 100


# ==========================================================================
# Du lieu hong — phai bi chan o server, khong phai o giao dien
# ==========================================================================


def test_da_giac_hai_dinh_bi_chan():
    """Hai dinh chi la mot doan thang, va mot doan thang khong co "ben trong"."""
    with pytest.raises(ValidationError, match="poly_needs_3_points"):
        CollisionShape.model_validate(
            {"id": "p", "mode": "allow", "kind": "poly", "points": [[0, 0], [10, 10]]}
        )


def test_da_giac_khong_co_dinh_bi_chan():
    with pytest.raises(ValidationError, match="poly_needs_3_points"):
        CollisionShape.model_validate({"id": "p", "mode": "allow", "kind": "poly"})


@pytest.mark.parametrize("thieu", ["x", "y", "w", "h"])
def test_hop_thieu_mot_so_do_bi_chan(thieu: str):
    """Mot hinh thieu `w` lot xuong duoc may hoc sinh se thanh tuong vo hinh."""
    payload = _box()
    del payload[thieu]
    with pytest.raises(ValidationError, match="box_needs_x_y_w_h"):
        CollisionShape.model_validate(payload)


def test_canh_bang_khong_bi_chan():
    """Mot hinh be rong 0 khong ve ra duoc, khong bam trung duoc, va van xet."""
    with pytest.raises(ValidationError):
        CollisionShape.model_validate(_box(w=0))


def test_mode_va_kind_chi_nhan_gia_tri_da_biet():
    with pytest.raises(ValidationError):
        CollisionShape.model_validate(_box(mode="maybe"))
    with pytest.raises(ValidationError):
        CollisionShape.model_validate(_box(kind="triangle"))


def test_qua_nhieu_hinh_bi_chan():
    """Canh choi xet TUNG hinh cho MOI buoc chan, nen so hinh la mot gioi han that."""
    shapes = [_box(id=f"s{i}") for i in range(MAX_SHAPES + 1)]
    with pytest.raises(ValidationError):
        CollisionMap.model_validate({"version": 1, "default": "blocked", "shapes": shapes})


def test_da_giac_qua_nhieu_dinh_bi_chan():
    points = [[i, i] for i in range(MAX_POLY_POINTS + 1)]
    with pytest.raises(ValidationError):
        CollisionShape.model_validate(
            {"id": "p", "mode": "allow", "kind": "poly", "points": points}
        )

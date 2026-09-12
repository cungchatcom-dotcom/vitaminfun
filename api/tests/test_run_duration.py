"""Test cho THOI GIAN LAM BAI cua mot luot choi.

Loi nay khong bao gio nem exception. No chi hien ra o mot cho duy nhat: bang bao
cao cua giao vien, duoi dang mot con so hoi la. Mot man dai 5 phut ma ghi "5:18"
thi nguoi doc chi ngo ngo; mot tab bi bo quen ghi "17 ngay" thi keo thoi luong
trung binh cua ca lop len 48 tieng, va luc do khong ai tin cai bang nua.

Nguyen nhan: `now - started_at` la khoang cach toi luc CHOT, khong phai thoi
gian choi. Hai thu ay chi bang nhau khi luot duoc chot dung luc dong ho can — ma
nhanh het gio thi hau nhu khong bao gio: loi chot den tu request ke tiep cua
nguoi choi, hoac tu vong quet don, va ca hai deu den muon.

Tran lay tu DE BAI DA DONG BANG cua chinh luot ay, khong phai tu `stages` hien
tai: nguoi dung sua gioi han gio giua chung thi luot dang choi van phai duoc
cham theo luat no da bat dau.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from app.db.models.run import StageRun
from app.modules.play.service import thoi_luong_choi

BAT_DAU = datetime(2026, 9, 12, 8, 0, 0, tzinfo=UTC)


def _luot(tran: int | None) -> StageRun:
    """Mot luot choi khong can database: chi can hai truong duoi day."""
    snapshot: dict = {"stage": {}}
    if tran is not None:
        snapshot["stage"]["time_limit_seconds"] = tran
    return StageRun(started_at=BAT_DAU, snapshot_json=snapshot)


@pytest.mark.parametrize(
    ("cham_giay", "mong_doi"),
    [
        (177, 177),  # Qua man truoc khi het gio: ghi dung thoi gian that.
        (300, 300),  # Chot dung luc dong ho can.
        (318, 300),  # CHOT MUON 18 giay -> van la 300, khong phai 5:18.
        (17 * 24 * 3600, 300),  # Tab bi bo quen, vong quet don sau 17 ngay.
    ],
)
def test_chan_tran_theo_gio_cua_man(cham_giay: int, mong_doi: int) -> None:
    run = _luot(300)
    assert thoi_luong_choi(run, BAT_DAU + timedelta(seconds=cham_giay)) == mong_doi


def test_moi_man_mot_tran_rieng() -> None:
    """Tran khong phai mot hang so: no la gio cua CHINH man ay."""
    assert thoi_luong_choi(_luot(420), BAT_DAU + timedelta(seconds=500)) == 420
    assert thoi_luong_choi(_luot(60), BAT_DAU + timedelta(seconds=500)) == 60


def test_anh_chup_thieu_tran_thi_khong_chan() -> None:
    """Tha ghi mot con so tho con hon ghi mot con so bia.

    Luot cu tu truoc khi anh chup co truong nay — hoac du lieu va tay — thi
    khong co gi de chan. Doan bua mot tran (vi du 300) o day se lam hong dung
    nhung luot ma ta khong biet gi ve chung.
    """
    assert thoi_luong_choi(_luot(None), BAT_DAU + timedelta(seconds=500)) == 500


def test_khong_bao_gio_am() -> None:
    """Dong ho may chu bi keo lui thi ghi 0, khong ghi so am.

    Mot `duration_seconds` am lot xuong database se lam moi phep `sum`/`avg`
    ben bao cao sai theo, va khong co rang buoc nao o bang chan no lai.
    """
    assert thoi_luong_choi(_luot(300), BAT_DAU - timedelta(seconds=10)) == 0

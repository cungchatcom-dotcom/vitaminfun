"""Test cho viec TU MO TAI KHOAN o man dang nhap.

Ba thu duoc chot lai o day, va ca ba deu thuoc loai "hong ma khong bao loi":

  1. VAI TRO. `signup()` viet cung `student`. Neu mot ngay nao do co nguoi them
     truong `role` vao `SignupRequest` cho "tien", thi bat ky ai dien xong ba o
     cung tro thanh giao vien - va khong co gi tren man hinh noi rang dieu do
     vua xay ra.
  2. CAI CONG `ALLOW_SELF_SIGNUP`. Tat o `.env` ma endpoint van mo thi cai nut
     bi an chi la mot lop son: ai biet go `curl` van tao duoc tai khoan.
  3. TUNG MA LOI RIENG cho tung o. Gop ca ba ve `VALIDATION_FAILED` thi nguoi
     dang ky nhin thay "du lieu khong hop le" tren mot bieu mau ba o, tuc la
     phai doan xem minh sai o dau.

Khong dung database that: `signup()` chi cham vao bon phuong thuc cua session
(`scalar`, `add`, `commit`, `refresh`), nen mot ban gia bon phuong thuc do la du
de chay het moi nhanh - va chay trong mot phan nghin giay.
"""

from __future__ import annotations

from typing import Any

import pytest

from app.core.config import settings
from app.core.errors import AppError, ErrorCode
from app.db.models.user import UserRole, UserStatus
from app.modules.auth.service import MIN_PASSWORD_LENGTH, signup


class FakeSession:
    """Session gia: nho lai thu duoc them vao, tra ve `da_co` cho moi `scalar`."""

    def __init__(self, da_co: Any = None) -> None:
        self.da_co = da_co
        self.added: list[Any] = []
        self.committed = False

    async def scalar(self, *_args: Any, **_kwargs: Any) -> Any:
        return self.da_co

    def add(self, obj: Any) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        self.committed = True

    async def refresh(self, _obj: Any) -> None:
        return None


async def _thu(db: Any, **ghi_de: Any) -> Any:
    tham_so = {
        "email": "Hoc.Sinh@Gmail.COM ",
        "display_name": "  Nguyen Van A  ",
        "password": "matkhau123",
    }
    tham_so.update(ghi_de)
    return await signup(db, **tham_so)


@pytest.fixture(autouse=True)
def bat_dang_ky(monkeypatch: pytest.MonkeyPatch) -> None:
    """Mac dinh moi test chay voi chuc nang dang ky DANG BAT."""
    monkeypatch.setattr(settings, "allow_self_signup", True)


@pytest.mark.asyncio
async def test_tao_tai_khoan_hoc_sinh() -> None:
    db = FakeSession()
    user = await _thu(db)

    # Vai tro viet cung, khong nhan tu request.
    assert user.role == UserRole.STUDENT
    assert user.status == UserStatus.ACTIVE
    # Email chuan hoa: cat khoang trang, ha het ve chu thuong. Khong lam thi
    # "A@x.com" va "a@x.com" la hai tai khoan, con nguoi dung thi nghi la mot.
    assert user.email == "hoc.sinh@gmail.com"
    assert user.display_name == "Nguyen Van A"
    # Mat khau tho khong duoc luu o dau ca.
    assert user.password_hash != "matkhau123"
    assert user.password_hash.startswith("$argon2")
    assert db.committed and db.added == [user]


@pytest.mark.asyncio
async def test_tat_bang_env_thi_tu_choi(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "allow_self_signup", False)
    db = FakeSession()

    with pytest.raises(AppError) as loi:
        await _thu(db)

    assert loi.value.code == ErrorCode.SIGNUP_DISABLED
    assert loi.value.http_status == 403
    assert db.added == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "email",
    ["khongcoa", "thieu@tenmien", "co khoang@trang.com", "@thieuten.com", ""],
)
async def test_email_sai_dang(email: str) -> None:
    with pytest.raises(AppError) as loi:
        await _thu(FakeSession(), email=email)
    assert loi.value.code == ErrorCode.SIGNUP_EMAIL_INVALID


@pytest.mark.asyncio
async def test_thieu_ho_ten() -> None:
    with pytest.raises(AppError) as loi:
        await _thu(FakeSession(), display_name="   ")
    assert loi.value.code == ErrorCode.SIGNUP_NAME_REQUIRED


@pytest.mark.asyncio
async def test_mat_khau_qua_ngan() -> None:
    with pytest.raises(AppError) as loi:
        await _thu(FakeSession(), password="a" * (MIN_PASSWORD_LENGTH - 1))
    assert loi.value.code == ErrorCode.SIGNUP_PASSWORD_TOO_SHORT
    # Con so di kem loi, de ban dich khong phai giu mot ban sao cua chinh sach.
    assert loi.value.params == {"min": MIN_PASSWORD_LENGTH}


@pytest.mark.asyncio
async def test_email_da_co_nguoi_dung() -> None:
    # `scalar` tra ve mot id = da co tai khoan mang email nay.
    db = FakeSession(da_co="co-roi")

    with pytest.raises(AppError) as loi:
        await _thu(db)

    assert loi.value.code == ErrorCode.SIGNUP_EMAIL_TAKEN
    assert db.added == []

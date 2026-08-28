"""Test cho bo chuan hoa text — docs/question-schemas.md muc 0.4.

VIET TRUOC KHI VIET GRADER (CLAUDE.md, thu tu lam viec muc 4).

Vi sao rieng bo chuan hoa duoc mot file test: moi dang bai go chu deu di qua no.
Sai o day thi sai o tat ca, va sai kieu "cham diem oan" — hoc sinh go dung ma bao
sai. Do la loai loi phu huynh se goi dien.
"""

from __future__ import annotations

import pytest

from app.modules.questions.grading.normalize import TextMatchRule, matches, normalize


class TestNormalize:
    def test_bo_khoang_trang_thua(self) -> None:
        assert normalize("  seven  ") == "seven"
        assert normalize("a   red    ball") == "a red ball"

    def test_khong_phan_biet_hoa_thuong(self) -> None:
        assert normalize("Seven") == normalize("SEVEN") == "seven"

    def test_bo_dau_cau(self) -> None:
        assert normalize("It's a dog!") == "its a dog"
        assert normalize("seven.") == "seven"
        assert normalize('"hello"') == "hello"

    def test_giu_dau_cau_khi_tat(self) -> None:
        rule = TextMatchRule(ignore_punctuation=False)
        assert normalize("seven.", rule) == "seven."

    def test_giu_hoa_thuong_khi_bat_case_sensitive(self) -> None:
        rule = TextMatchRule(case_sensitive=True)
        assert normalize("Seven", rule) == "Seven"

    def test_chuoi_rong(self) -> None:
        assert normalize("") == ""
        assert normalize("   ") == ""

    def test_unicode_nfd_ve_nfc(self) -> None:
        """'e' + dau sac roi phai bang 'é' liền một ký tự.

        Ban phim tieng Viet va macOS go ra NFD, Windows go ra NFC. Khong chuan
        hoa thi hai chuoi NHIN GIONG HET NHAU lai khong bang nhau.
        """
        nfc = "café"  # é la MOT ky tu
        nfd = "café"  # e + dau sac roi = HAI ky tu
        assert nfc != nfd, "hai chuoi phai khac nhau o dang tho"
        assert normalize(nfc) == normalize(nfd)

    def test_bo_dau_tieng_viet_khi_bat(self) -> None:
        rule = TextMatchRule(ignore_diacritics=True)
        assert normalize("con mèo", rule) == "con meo"
        assert normalize("Đường", rule) == "duong"

    def test_mac_dinh_khong_bo_dau_tieng_viet(self) -> None:
        """Mac dinh PHAI giu dau: 'ma' va 'mà' la hai tu khac nhau."""
        assert normalize("mà") != normalize("ma")


class TestMatches:
    def test_khop_mot_trong_nhieu_cach_viet(self) -> None:
        assert matches("seven", ["7", "seven"])
        assert matches("7", ["7", "seven"])

    def test_khop_bat_ke_khoang_trang_va_dau_cau(self) -> None:
        assert matches(" Seven ", ["seven"])
        assert matches("seven.", ["seven"])

    def test_bo_trong_luon_sai(self) -> None:
        assert not matches("", ["seven"])
        assert not matches("   ", ["seven"])

    def test_danh_sach_chap_nhan_rong_thi_sai(self) -> None:
        """Giao vien quen nhap dap an -> moi cau tra loi deu sai.

        Ket qua nay khong dep nhung PHAI on dinh: khong duoc cho qua tat ca chi
        vi thieu du lieu. Builder co rang buoc chan luu, day la lop chan cuoi.
        """
        assert not matches("seven", [])

    @pytest.mark.parametrize("go_sai", ["sevn", "seve", "sseven"])
    def test_sai_chinh_ta_mac_dinh_khong_duoc_chap_nhan(self, go_sai: str) -> None:
        assert not matches(go_sai, ["seven"])

    @pytest.mark.parametrize("go_sai", ["sevn", "seve", "sseven", "sevem"])
    def test_sai_mot_ky_tu_duoc_chap_nhan_khi_bat_typo_tolerance(self, go_sai: str) -> None:
        rule = TextMatchRule(typo_tolerance=1)
        assert matches(go_sai, ["seven"], rule)

    def test_typo_tolerance_khong_ap_cho_tu_qua_ngan(self) -> None:
        """'cat' va 'bat' chi khac 1 ky tu nhung la hai tu khac han.

        Nguong 5 ky tu: duoi do thi mot ky tu sai thuong tao ra tu KHAC, khong
        phai loi go nham. Cho qua la day hoc sai.
        """
        rule = TextMatchRule(typo_tolerance=1)
        assert not matches("bat", ["cat"], rule)
        assert not matches("dog", ["dig"], rule)

    def test_typo_tolerance_khong_cho_qua_hai_loi(self) -> None:
        rule = TextMatchRule(typo_tolerance=1)
        assert not matches("svn", ["seven"], rule)  # thieu 2 ky tu
        assert not matches("sevem s", ["seven"], rule)  # 2 phep bien doi

    def test_khong_tu_quy_doi_so_va_chu(self) -> None:
        """'2' KHONG tu dong bang 'two'.

        Co chu y: giao vien phai liet ke ca hai vao `accepted`. Tu quy doi thi
        bai day so dem se khong bao gio kiem tra duoc hoc sinh viet duoc chu so
        bang chu hay chua.
        """
        assert not matches("2", ["two"])
        assert matches("2", ["two", "2"])

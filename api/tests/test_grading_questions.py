"""Test cham diem 4 dang bai dot 1 — docs/question-schemas.md muc 1, 2, 5, 5b.

VIET TRUOC KHI VIET GRADER.

Ba nguyen tac duoc khoa chat o day, vi ca ba deu la loai loi khong ai phat hien
ra bang mat thuong:

  1. BO TRONG = 0 DIEM, KHONG AM DIEM. Tre em bo qua cau kho la binh thuong.
  2. DU LIEU BIA TU CLIENT KHONG DUOC LAM NO SERVER. Hoc sinh (hoac ai do) gui
     len optionId khong ton tai thi tinh sai, khong tra ve loi 500.
  3. DIEM LE LAM TRON 2 CHU SO. 1/3 cua 1 diem la 0.33, khong phai
     0.3333333333333333 — con so do se hien nguyen len bang diem cua phu huynh.
"""

from __future__ import annotations

from typing import ClassVar

import pytest

from app.modules.questions.grading import grade

# --------------------------------------------------------------------------
# Du lieu mau
# --------------------------------------------------------------------------

MCQ_CONTENT = {
    "prompt": "Which one is a mango?",
    "options": [
        {"id": "a", "text": "apple"},
        {"id": "b", "text": "mango"},
        {"id": "c", "text": "banana"},
    ],
}

GAP_FILL_CONTENT = {"template": "My name is {{1}}. I am {{2}} years old."}
GAP_FILL_ANSWER = {
    "gaps": {
        "1": {"accepted": ["Nam"]},
        "2": {"accepted": ["seven", "7"]},
    }
}

DROPDOWN_CONTENT = {
    "template": "hello {{1}}, my name {{2}} Nam",
    "gaps": {
        "1": {"options": [{"id": "o1", "text": "there"}, {"id": "o2", "text": "their"}]},
        "2": {"options": [{"id": "o3", "text": "is"}, {"id": "o4", "text": "are"}]},
    },
}
DROPDOWN_ANSWER = {"gaps": {"1": "o1", "2": "o3"}}


# ==========================================================================
# MCQ_SINGLE
# ==========================================================================


class TestMcqSingle:
    def test_chon_dung_duoc_tron_diem(self) -> None:
        r = grade("MCQ_SINGLE", MCQ_CONTENT, {"correctOptionId": "b"}, {"selectedOptionId": "b"}, 2)
        assert r.score == 2
        assert r.is_correct

    def test_chon_sai_duoc_khong_diem(self) -> None:
        r = grade("MCQ_SINGLE", MCQ_CONTENT, {"correctOptionId": "b"}, {"selectedOptionId": "a"}, 2)
        assert r.score == 0
        assert not r.is_correct

    def test_bo_trong_duoc_khong_diem_khong_am(self) -> None:
        r = grade(
            "MCQ_SINGLE", MCQ_CONTENT, {"correctOptionId": "b"}, {"selectedOptionId": None}, 2
        )
        assert r.score == 0

    def test_khong_gui_gi_ca(self) -> None:
        """Hoc sinh het gio ma chua dong den cau nay -> response la None."""
        r = grade("MCQ_SINGLE", MCQ_CONTENT, {"correctOptionId": "b"}, None, 2)
        assert r.score == 0

    def test_option_bia_tinh_la_sai(self) -> None:
        r = grade(
            "MCQ_SINGLE", MCQ_CONTENT, {"correctOptionId": "b"}, {"selectedOptionId": "zzz"}, 2
        )
        assert r.score == 0


# ==========================================================================
# MCQ_MULTI
# ==========================================================================


class TestMcqMulti:
    ANSWER: ClassVar[dict] = {"correctOptionIds": ["a", "b"]}

    def test_dung_het_duoc_tron_diem(self) -> None:
        r = grade("MCQ_MULTI", MCQ_CONTENT, self.ANSWER, {"selectedOptionIds": ["b", "a"]}, 4)
        assert r.score == 4
        assert r.is_correct

    def test_thu_tu_chon_khong_anh_huong(self) -> None:
        a = grade("MCQ_MULTI", MCQ_CONTENT, self.ANSWER, {"selectedOptionIds": ["a", "b"]}, 4)
        b = grade("MCQ_MULTI", MCQ_CONTENT, self.ANSWER, {"selectedOptionIds": ["b", "a"]}, 4)
        assert a.score == b.score

    def test_mac_dinh_thieu_mot_y_la_mat_het_diem(self) -> None:
        """Mac dinh all-or-nothing — neu khong, chon HET moi o la meo an diem."""
        r = grade("MCQ_MULTI", MCQ_CONTENT, self.ANSWER, {"selectedOptionIds": ["a"]}, 4)
        assert r.score == 0

    def test_chon_het_moi_o_khong_duoc_diem(self) -> None:
        r = grade("MCQ_MULTI", MCQ_CONTENT, self.ANSWER, {"selectedOptionIds": ["a", "b", "c"]}, 4)
        assert r.score == 0

    def test_bat_partial_thi_dung_mot_nua_duoc_nua_diem(self) -> None:
        answer = {**self.ANSWER, "allOrNothing": False}
        r = grade("MCQ_MULTI", MCQ_CONTENT, answer, {"selectedOptionIds": ["a"]}, 4)
        assert r.score == 2

    def test_bat_partial_thi_chon_sai_bi_tru_vao_phan_dung(self) -> None:
        """Dung 2, sai 1 -> (2-1)/2 = 0.5 -> 2 diem.

        Khong tru thi hoc sinh chon het van duoc diem toi da, partial mat y nghia.
        """
        answer = {**self.ANSWER, "allOrNothing": False}
        r = grade("MCQ_MULTI", MCQ_CONTENT, answer, {"selectedOptionIds": ["a", "b", "c"]}, 4)
        assert r.score == 2

    def test_bat_partial_van_khong_bao_gio_am(self) -> None:
        answer = {**self.ANSWER, "allOrNothing": False}
        r = grade("MCQ_MULTI", MCQ_CONTENT, answer, {"selectedOptionIds": ["c"]}, 4)
        assert r.score == 0

    def test_bo_trong(self) -> None:
        r = grade("MCQ_MULTI", MCQ_CONTENT, self.ANSWER, {"selectedOptionIds": []}, 4)
        assert r.score == 0


# ==========================================================================
# GAP_FILL
# ==========================================================================


class TestGapFill:
    def test_dung_het(self) -> None:
        r = grade(
            "GAP_FILL",
            GAP_FILL_CONTENT,
            GAP_FILL_ANSWER,
            {"gaps": {"1": "Nam", "2": "seven"}},
            2,
        )
        assert r.score == 2
        assert r.is_correct

    @pytest.mark.parametrize("go", [" Seven ", "seven.", "SEVEN", "7"])
    def test_chap_nhan_moi_bien_the_hop_le(self, go: str) -> None:
        r = grade("GAP_FILL", GAP_FILL_CONTENT, GAP_FILL_ANSWER, {"gaps": {"1": "Nam", "2": go}}, 2)
        assert r.score == 2, f"'{go}' phai duoc chap nhan"

    def test_dung_mot_nua_duoc_nua_diem(self) -> None:
        r = grade(
            "GAP_FILL", GAP_FILL_CONTENT, GAP_FILL_ANSWER, {"gaps": {"1": "Nam", "2": "ten"}}, 2
        )
        assert r.score == 1
        assert not r.is_correct

    def test_o_bo_trong_tinh_sai(self) -> None:
        r = grade("GAP_FILL", GAP_FILL_CONTENT, GAP_FILL_ANSWER, {"gaps": {"1": "Nam"}}, 2)
        assert r.score == 1

    def test_sai_chinh_ta_mac_dinh_khong_duoc_chap_nhan(self) -> None:
        r = grade(
            "GAP_FILL", GAP_FILL_CONTENT, GAP_FILL_ANSWER, {"gaps": {"1": "Nam", "2": "sevn"}}, 2
        )
        assert r.score == 1

    def test_bat_typo_tolerance_cho_rieng_mot_o(self) -> None:
        answer = {
            "gaps": {
                "1": {"accepted": ["Nam"]},
                "2": {"accepted": ["seven"], "match": {"typoTolerance": 1}},
            }
        }
        r = grade("GAP_FILL", GAP_FILL_CONTENT, answer, {"gaps": {"1": "Nam", "2": "sevn"}}, 2)
        assert r.score == 2

    def test_diem_le_lam_tron_hai_chu_so(self) -> None:
        """1 o dung tren 3 o, thang diem 1 -> 0.33."""
        content = {"template": "{{1}} {{2}} {{3}}"}
        answer = {
            "gaps": {
                "1": {"accepted": ["a"]},
                "2": {"accepted": ["b"]},
                "3": {"accepted": ["c"]},
            }
        }
        r = grade("GAP_FILL", content, answer, {"gaps": {"1": "a", "2": "x", "3": "y"}}, 1)
        assert r.score == 0.33

    def test_detail_chi_ro_o_nao_sai(self) -> None:
        """Man xem lai bai to mau tung o -> grader phai tra ve chi tiet."""
        r = grade(
            "GAP_FILL", GAP_FILL_CONTENT, GAP_FILL_ANSWER, {"gaps": {"1": "Nam", "2": "ten"}}, 2
        )
        assert r.detail == {"gaps": {"1": True, "2": False}}

    def test_khong_gui_gi_ca(self) -> None:
        r = grade("GAP_FILL", GAP_FILL_CONTENT, GAP_FILL_ANSWER, None, 2)
        assert r.score == 0

    def test_o_thua_do_client_gui_len_bi_bo_qua(self) -> None:
        """Chi cham cac o co trong DAP AN. O '99' khong ton tai -> lo di."""
        r = grade(
            "GAP_FILL",
            GAP_FILL_CONTENT,
            GAP_FILL_ANSWER,
            {"gaps": {"1": "Nam", "2": "seven", "99": "hack"}},
            2,
        )
        assert r.score == 2


# ==========================================================================
# GAP_DROPDOWN
# ==========================================================================


class TestGapDropdown:
    def test_dung_het(self) -> None:
        r = grade(
            "GAP_DROPDOWN",
            DROPDOWN_CONTENT,
            DROPDOWN_ANSWER,
            {"gaps": {"1": "o1", "2": "o3"}},
            2,
        )
        assert r.score == 2
        assert r.is_correct

    def test_sai_het(self) -> None:
        r = grade(
            "GAP_DROPDOWN",
            DROPDOWN_CONTENT,
            DROPDOWN_ANSWER,
            {"gaps": {"1": "o2", "2": "o4"}},
            2,
        )
        assert r.score == 0

    def test_dung_mot_nua(self) -> None:
        r = grade(
            "GAP_DROPDOWN",
            DROPDOWN_CONTENT,
            DROPDOWN_ANSWER,
            {"gaps": {"1": "o1", "2": "o4"}},
            2,
        )
        assert r.score == 1

    def test_o_chua_chon_tinh_sai(self) -> None:
        r = grade(
            "GAP_DROPDOWN", DROPDOWN_CONTENT, DROPDOWN_ANSWER, {"gaps": {"1": "o1", "2": None}}, 2
        )
        assert r.score == 1

    def test_option_bia_khong_lam_no_server(self) -> None:
        """Du lieu gui len khong nam trong danh sach lua chon -> tinh sai."""
        r = grade(
            "GAP_DROPDOWN",
            DROPDOWN_CONTENT,
            DROPDOWN_ANSWER,
            {"gaps": {"1": "khong-ton-tai", "2": "o3"}},
            2,
        )
        assert r.score == 1

    def test_detail_chi_ro_o_nao_sai(self) -> None:
        r = grade(
            "GAP_DROPDOWN",
            DROPDOWN_CONTENT,
            DROPDOWN_ANSWER,
            {"gaps": {"1": "o1", "2": "o4"}},
            2,
        )
        assert r.detail == {"gaps": {"1": True, "2": False}}


# ==========================================================================
# Quy tac chung cho MOI dang
# ==========================================================================


class TestChung:
    def test_dang_khong_biet_thi_bao_loi_ro_rang(self) -> None:
        """Khong duoc lang le tra 0 diem — do la loi lap trinh, phai on ao."""
        with pytest.raises(KeyError):
            grade("KHONG_CO_DANG_NAY", {}, {}, {}, 1)

    @pytest.mark.parametrize(
        ("qtype", "content", "answer", "response"),
        [
            ("MCQ_SINGLE", MCQ_CONTENT, {"correctOptionId": "b"}, {"selectedOptionId": "b"}),
            ("MCQ_MULTI", MCQ_CONTENT, {"correctOptionIds": ["a"]}, {"selectedOptionIds": ["a"]}),
            ("GAP_FILL", GAP_FILL_CONTENT, GAP_FILL_ANSWER, {"gaps": {"1": "Nam", "2": "7"}}),
            ("GAP_DROPDOWN", DROPDOWN_CONTENT, DROPDOWN_ANSWER, {"gaps": {"1": "o1", "2": "o3"}}),
        ],
    )
    def test_diem_khong_bao_gio_vuot_diem_toi_da(
        self, qtype: str, content: dict, answer: dict, response: dict
    ) -> None:
        r = grade(qtype, content, answer, response, 3)
        assert 0 <= r.score <= 3

    @pytest.mark.parametrize(
        ("qtype", "content", "answer"),
        [
            ("MCQ_SINGLE", MCQ_CONTENT, {"correctOptionId": "b"}),
            ("MCQ_MULTI", MCQ_CONTENT, {"correctOptionIds": ["a"]}),
            ("GAP_FILL", GAP_FILL_CONTENT, GAP_FILL_ANSWER),
            ("GAP_DROPDOWN", DROPDOWN_CONTENT, DROPDOWN_ANSWER),
        ],
    )
    def test_khong_lam_bai_thi_khong_diem(self, qtype: str, content: dict, answer: dict) -> None:
        r = grade(qtype, content, answer, None, 3)
        assert r.score == 0
        assert not r.is_correct

    @pytest.mark.parametrize(
        ("qtype", "content", "answer"),
        [
            ("MCQ_SINGLE", MCQ_CONTENT, {"correctOptionId": "b"}),
            ("GAP_FILL", GAP_FILL_CONTENT, GAP_FILL_ANSWER),
            ("GAP_DROPDOWN", DROPDOWN_CONTENT, DROPDOWN_ANSWER),
        ],
    )
    def test_khong_dang_nao_can_cham_tay(self, qtype: str, content: dict, answer: dict) -> None:
        """Dot 1 toan dang tu cham duoc. ESSAY/SPEAK moi can nguoi cham."""
        r = grade(qtype, content, answer, None, 1)
        assert not r.needs_manual

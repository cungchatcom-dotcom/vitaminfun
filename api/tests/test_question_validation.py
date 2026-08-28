"""Test lop kiem tra du lieu khi luu cau hoi.

Vi sao dang mot file test rieng cho viec nay: moi lan mot cau hoi hong lot xuong
database, no khong bao loi ngay — no im lang nam do cho toi khi ca lop lam bai
va cung bi sai. Luc do sua thi da co diem sai trong so hoc.

Moi test o day tuong ung mot cach giao vien co the lam hong de ma khong biet.
"""

from __future__ import annotations

from typing import ClassVar

import pytest

from app.core.errors import ErrorCode, ValidationFailedError
from app.modules.questions.schemas import validate_payload


def _loi(qtype: str, content: dict, answer: dict) -> str:
    with pytest.raises(ValidationFailedError) as exc:
        validate_payload(qtype, content, answer)
    return exc.value.code


# ==========================================================================
# Truong hop hop le — phai KHONG nem loi
# ==========================================================================


class TestHopLe:
    def test_mcq_mot_dap_an(self) -> None:
        validate_payload(
            "MCQ_SINGLE",
            {
                "prompt": "Which one is a mango?",
                "options": [
                    {"id": "a", "text": "apple"},
                    {"id": "b", "text": "mango"},
                ],
            },
            {"correctOptionId": "b"},
        )

    def test_mcq_nhieu_dap_an(self) -> None:
        validate_payload(
            "MCQ_MULTI",
            {
                "prompt": "Which are fruits?",
                "options": [
                    {"id": "a", "text": "apple"},
                    {"id": "b", "text": "mango"},
                    {"id": "c", "text": "chair"},
                ],
            },
            {"correctOptionIds": ["a", "b"]},
        )

    def test_lua_chon_bang_anh_khong_can_chu(self) -> None:
        validate_payload(
            "MCQ_SINGLE",
            {
                "prompt": "Pick the cat",
                "options": [
                    {"id": "a", "image": {"url": "/m/1.png"}},
                    {"id": "b", "image": {"url": "/m/2.png"}},
                ],
            },
            {"correctOptionId": "a"},
        )

    def test_gap_fill(self) -> None:
        validate_payload(
            "GAP_FILL",
            {"template": "My name is {{1}}."},
            {"gaps": {"1": {"accepted": ["Nam"]}}},
        )

    def test_gap_dropdown(self) -> None:
        validate_payload(
            "GAP_DROPDOWN",
            {
                "template": "hello {{1}}",
                "gaps": {
                    "1": {"options": [{"id": "o1", "text": "there"}, {"id": "o2", "text": "their"}]}
                },
            },
            {"gaps": {"1": "o1"}},
        )


# ==========================================================================
# Trac nghiem
# ==========================================================================


class TestMcqSai:
    BASE: ClassVar[dict] = {
        "prompt": "Which one is a mango?",
        "options": [{"id": "a", "text": "apple"}, {"id": "b", "text": "mango"}],
    }

    def test_thieu_de_bai(self) -> None:
        content = {**self.BASE, "prompt": "   "}
        assert _loi("MCQ_SINGLE", content, {"correctOptionId": "b"}) == (
            ErrorCode.QUESTION_FIELD_EMPTY
        )

    def test_chi_co_mot_lua_chon(self) -> None:
        content = {**self.BASE, "options": [{"id": "a", "text": "apple"}]}
        assert _loi("MCQ_SINGLE", content, {"correctOptionId": "a"}) == (
            ErrorCode.QUESTION_OPTION_COUNT
        )

    def test_qua_nhieu_lua_chon(self) -> None:
        content = {
            **self.BASE,
            "options": [{"id": str(i), "text": f"o{i}"} for i in range(7)],
        }
        assert _loi("MCQ_SINGLE", content, {"correctOptionId": "0"}) == (
            ErrorCode.QUESTION_OPTION_COUNT
        )

    def test_lua_chon_de_trong(self) -> None:
        content = {**self.BASE, "options": [{"id": "a", "text": "apple"}, {"id": "b", "text": " "}]}
        assert _loi("MCQ_SINGLE", content, {"correctOptionId": "a"}) == (
            ErrorCode.QUESTION_OPTION_EMPTY
        )

    def test_hai_lua_chon_trung_chu(self) -> None:
        """Hoc sinh chon cai nao cung tuong dung, ma chi mot cai duoc diem."""
        content = {
            **self.BASE,
            "options": [{"id": "a", "text": "Mango"}, {"id": "b", "text": " mango "}],
        }
        assert _loi("MCQ_SINGLE", content, {"correctOptionId": "a"}) == (
            ErrorCode.QUESTION_OPTION_DUPLICATE_TEXT
        )

    def test_hai_lua_chon_trung_id(self) -> None:
        content = {
            **self.BASE,
            "options": [{"id": "a", "text": "apple"}, {"id": "a", "text": "mango"}],
        }
        assert _loi("MCQ_SINGLE", content, {"correctOptionId": "a"}) == (
            ErrorCode.QUESTION_OPTION_DUPLICATE_ID
        )

    def test_quen_chon_dap_an_dung(self) -> None:
        """Loi de xay ra nhat: soan xong 4 phuong an roi quen tich cai dung."""
        assert _loi("MCQ_SINGLE", self.BASE, {}) == ErrorCode.QUESTION_NO_CORRECT_ANSWER

    def test_dap_an_dung_tro_toi_lua_chon_khong_ton_tai(self) -> None:
        """Xay ra khi giao vien xoa mot phuong an sau khi da chon no la dap an."""
        assert _loi("MCQ_SINGLE", self.BASE, {"correctOptionId": "zzz"}) == (
            ErrorCode.QUESTION_CORRECT_NOT_IN_OPTIONS
        )

    def test_multi_khong_chon_dap_an_nao(self) -> None:
        assert _loi("MCQ_MULTI", self.BASE, {"correctOptionIds": []}) == (
            ErrorCode.QUESTION_NO_CORRECT_ANSWER
        )

    def test_multi_chon_tat_ca_deu_dung(self) -> None:
        """Dung het thi khong con la cau hoi nua."""
        assert _loi("MCQ_MULTI", self.BASE, {"correctOptionIds": ["a", "b"]}) == (
            ErrorCode.QUESTION_ALL_OPTIONS_CORRECT
        )


# ==========================================================================
# O trong
# ==========================================================================


class TestGapFillSai:
    def test_cau_khong_co_o_trong_nao(self) -> None:
        assert _loi("GAP_FILL", {"template": "My name is Nam."}, {"gaps": {}}) == (
            ErrorCode.QUESTION_NO_GAP
        )

    def test_o_trong_khong_co_dap_an(self) -> None:
        """Hoc sinh go gi cung sai — ca lop 0 diem."""
        assert _loi("GAP_FILL", {"template": "hi {{1}}"}, {"gaps": {}}) == (
            ErrorCode.QUESTION_GAP_NO_ANSWER
        )

    def test_dap_an_chi_co_khoang_trang(self) -> None:
        assert (
            _loi("GAP_FILL", {"template": "hi {{1}}"}, {"gaps": {"1": {"accepted": ["  ", ""]}}})
            == ErrorCode.QUESTION_GAP_NO_ANSWER
        )

    def test_hai_o_trong_trung_so(self) -> None:
        """`{{1}} ... {{1}}` — hai o cung so thi cham o nao?"""
        assert (
            _loi(
                "GAP_FILL",
                {"template": "{{1}} and {{1}}"},
                {"gaps": {"1": {"accepted": ["a"]}}},
            )
            == ErrorCode.QUESTION_GAP_DUPLICATE
        )

    def test_qua_nhieu_o_trong(self) -> None:
        template = " ".join(f"{{{{{i}}}}}" for i in range(25))
        answer = {"gaps": {str(i): {"accepted": ["a"]} for i in range(25)}}
        assert _loi("GAP_FILL", {"template": template}, answer) == (
            ErrorCode.QUESTION_TOO_MANY_GAPS
        )

    def test_thua_dap_an_cho_o_khong_ton_tai_thi_bo_qua(self) -> None:
        """Giao vien xoa o trong nhung dap an cu con sot lai — khong phai loi."""
        validate_payload(
            "GAP_FILL",
            {"template": "hi {{1}}"},
            {"gaps": {"1": {"accepted": ["there"]}, "2": {"accepted": ["cu"]}}},
        )


class TestGapDropdownSai:
    def test_o_trong_chi_co_mot_lua_chon(self) -> None:
        assert (
            _loi(
                "GAP_DROPDOWN",
                {
                    "template": "hi {{1}}",
                    "gaps": {"1": {"options": [{"id": "o1", "text": "there"}]}},
                },
                {"gaps": {"1": "o1"}},
            )
            == ErrorCode.QUESTION_GAP_OPTION_COUNT
        )

    def test_o_trong_khong_co_lua_chon_nao(self) -> None:
        assert (
            _loi(
                "GAP_DROPDOWN",
                {"template": "hi {{1}}", "gaps": {}},
                {"gaps": {"1": "o1"}},
            )
            == ErrorCode.QUESTION_GAP_OPTION_COUNT
        )

    def test_hai_lua_chon_trung_chu(self) -> None:
        assert (
            _loi(
                "GAP_DROPDOWN",
                {
                    "template": "hi {{1}}",
                    "gaps": {
                        "1": {
                            "options": [
                                {"id": "o1", "text": "there"},
                                {"id": "o2", "text": "There"},
                            ]
                        }
                    },
                },
                {"gaps": {"1": "o1"}},
            )
            == ErrorCode.QUESTION_OPTION_DUPLICATE_TEXT
        )

    def test_quen_chon_dap_an_dung_cho_mot_o(self) -> None:
        assert (
            _loi(
                "GAP_DROPDOWN",
                {
                    "template": "hi {{1}} {{2}}",
                    "gaps": {
                        "1": {"options": [{"id": "a", "text": "x"}, {"id": "b", "text": "y"}]},
                        "2": {"options": [{"id": "c", "text": "m"}, {"id": "d", "text": "n"}]},
                    },
                },
                {"gaps": {"1": "a"}},
            )
            == ErrorCode.QUESTION_GAP_NO_ANSWER
        )

    def test_dap_an_khong_nam_trong_lua_chon_cua_o_do(self) -> None:
        assert (
            _loi(
                "GAP_DROPDOWN",
                {
                    "template": "hi {{1}}",
                    "gaps": {
                        "1": {"options": [{"id": "a", "text": "x"}, {"id": "b", "text": "y"}]}
                    },
                },
                {"gaps": {"1": "c"}},
            )
            == ErrorCode.QUESTION_CORRECT_NOT_IN_OPTIONS
        )


# ==========================================================================
# Chung
# ==========================================================================


def test_dang_chua_ho_tro_thi_tu_choi_luu() -> None:
    """Luu duoc dang chua co ham cham = tao du lieu khong ai cham noi."""
    assert _loi("ESSAY", {}, {}) == ErrorCode.QUESTION_TYPE_NOT_SUPPORTED


def test_moi_dang_dot_1_deu_co_ham_kiem_va_ham_cham() -> None:
    """Hai so dang ky phai khop nhau — lech la co dang luu duoc ma khong cham duoc."""
    from app.db.models import QuestionType
    from app.modules.questions.grading import GRADERS
    from app.modules.questions.schemas import _VALIDATORS

    assert set(GRADERS) == set(_VALIDATORS) == set(QuestionType.ALL)

"""Hàm chấm điểm cho từng dạng câu hỏi.

⭐ MỌI HÀM Ở ĐÂY LÀ HÀM THUẦN: nhận vào dict, trả ra điểm. Không đụng database,
không gọi mạng, không đọc đồng hồ. Nhờ vậy test được 100% bằng bảng dữ liệu, và
khi Pha 4 cần chấm hàng loạt thì không phải sửa gì.

Đây là **bản duy nhất** của logic chấm trong toàn hệ thống — frontend không tính
điểm, kể cả ở chế độ luyện tập (xem `docs/question-schemas.md` §16).

Quy tắc chung cho mọi dạng:
  • Bỏ trống = 0 điểm, KHÔNG âm điểm.
  • Dữ liệu bịa từ client (id không tồn tại) = tính sai, không nổ lỗi.
  • Điểm lẻ làm tròn 2 chữ số — `0.3333333333` sẽ hiện nguyên lên bảng điểm.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from app.modules.questions.grading.normalize import TextMatchRule, matches


@dataclass
class GradeResult:
    score: float
    is_correct: bool
    #: Đúng/sai từng mục con, để màn xem lại bài tô màu được.
    detail: dict[str, Any] | None = None
    #: True = chờ giáo viên hoặc AI chấm (ESSAY, SPEAK_*). Đợt 1 luôn False.
    needs_manual: bool = False


def _result(ratio: float, points: int, detail: dict[str, Any] | None = None) -> GradeResult:
    ratio = max(0.0, min(1.0, ratio))
    score = round(points * ratio, 2)
    return GradeResult(score=score, is_correct=ratio >= 1.0, detail=detail)


# ==========================================================================
# Trắc nghiệm
# ==========================================================================


def grade_mcq_single(
    content: dict, answer: dict, response: dict | None, points: int
) -> GradeResult:
    selected = (response or {}).get("selectedOptionId")
    correct = answer.get("correctOptionId")
    # `selected` có thể là None (bỏ trống). So sánh với `correct` cũng None thì
    # phải ra SAI, nên chặn trước.
    hit = bool(selected) and selected == correct
    return _result(1.0 if hit else 0.0, points)


def grade_mcq_multi(content: dict, answer: dict, response: dict | None, points: int) -> GradeResult:
    correct = set(answer.get("correctOptionIds") or [])
    selected = set((response or {}).get("selectedOptionIds") or [])

    # Mặc định all-or-nothing. Cho điểm từng phần ở dạng này là mở đường cho mẹo
    # "chọn hết mọi ô" — xem `answer.allOrNothing` để giáo viên tự tắt.
    if answer.get("allOrNothing", True):
        return _result(1.0 if selected == correct and correct else 0.0, points)

    if not correct:
        return _result(0.0, points)

    dung = len(selected & correct)
    sai = len(selected - correct)
    # Trừ phần chọn sai vào phần chọn đúng, nếu không thì chọn hết vẫn đạt tối đa.
    return _result((dung - sai) / len(correct), points)


# ==========================================================================
# Ô trống
# ==========================================================================


def grade_gap_fill(content: dict, answer: dict, response: dict | None, points: int) -> GradeResult:
    gaps: dict[str, Any] = answer.get("gaps") or {}
    if not gaps:
        return _result(0.0, points, {"gaps": {}})

    given: dict[str, Any] = (response or {}).get("gaps") or {}
    detail: dict[str, bool] = {}

    for key, spec in gaps.items():
        rule = TextMatchRule.from_json(spec.get("match"))
        detail[key] = matches(str(given.get(key) or ""), spec.get("accepted") or [], rule)

    # Chỉ chấm những ô có trong ĐÁP ÁN. Ô lạ do client gửi lên bị bỏ qua chứ
    # không được làm thay đổi mẫu số.
    return _result(sum(detail.values()) / len(gaps), points, {"gaps": detail})


def grade_gap_dropdown(
    content: dict, answer: dict, response: dict | None, points: int
) -> GradeResult:
    gaps: dict[str, str] = answer.get("gaps") or {}
    if not gaps:
        return _result(0.0, points, {"gaps": {}})

    given: dict[str, Any] = (response or {}).get("gaps") or {}
    # Id nào là hợp lệ cho từng ô — id bịa sẽ không nằm trong tập này.
    hop_le = {
        key: {opt.get("id") for opt in (spec.get("options") or [])}
        for key, spec in (content.get("gaps") or {}).items()
    }

    detail: dict[str, bool] = {}
    for key, correct_id in gaps.items():
        chosen = given.get(key)
        detail[key] = bool(chosen) and chosen in hop_le.get(key, set()) and chosen == correct_id

    return _result(sum(detail.values()) / len(gaps), points, {"gaps": detail})


# ==========================================================================
# Sổ đăng ký
# ==========================================================================

Grader = Callable[[dict, dict, dict | None, int], GradeResult]

#: Thêm dạng bài mới = thêm một dòng ở đây + một hàm ở trên + test.
#: Không phải sửa router, không phải sửa service.
def grade_short_answer(
    content: dict, answer: dict, response: dict | None, points: int
) -> GradeResult:
    """Khớp câu người học gõ với một trong các cách viết được chấp nhận.

    Được ăn cả, ngã về không — không có điểm lẻ. Một câu trả lời ngắn thì hoặc
    nói đúng ý hoặc không; chấm nửa vời ở đây sẽ thành đoán xem "gần đúng" là
    gần đến đâu, mà không có thang nào đo được điều đó.

    Cách viết được chấp nhận do người soạn liệt kê. `TextMatchRule` lo phần hoa
    thường, dấu câu, khoảng trắng — xem `normalize.py`.
    """
    accepted = [str(a) for a in (answer.get("accepted") or []) if str(a).strip()]
    if not accepted:
        return _result(0.0, points, {"ok": False})

    rule = TextMatchRule.from_json(answer.get("match"))
    text = str((response or {}).get("text") or "")
    ok = matches(text, accepted, rule)
    return _result(1.0 if ok else 0.0, points, {"ok": ok})


GRADERS: dict[str, Grader] = {
    "MCQ_SINGLE": grade_mcq_single,
    "MCQ_MULTI": grade_mcq_multi,
    "GAP_FILL": grade_gap_fill,
    "GAP_DROPDOWN": grade_gap_dropdown,
    "SHORT_ANSWER": grade_short_answer,
}


def grade(
    qtype: str, content: dict, answer: dict, response: dict | None, points: int
) -> GradeResult:
    """Chấm một câu.

    Dạng chưa đăng ký thì ném `KeyError` — đó là lỗi lập trình, phải ồn ào. Trả
    về 0 điểm cho êm chuyện là cách chắc chắn nhất để cả lớp bị 0 mà không ai
    biết vì sao.
    """
    return GRADERS[qtype](content, answer, response, points)

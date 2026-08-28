"""Chuẩn hoá text trước khi so đáp án — `docs/question-schemas.md` §0.4.

Mọi dạng bài có gõ chữ đều đi qua đây. Sai ở đây là chấm oan trên diện rộng, nên
`tests/test_grading_normalize.py` khoá chặt từng quy tắc một.
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass

#: Dấu câu bị bỏ khi so sánh. Không dùng `string.punctuation` vì bộ đó có cả
#: `+ - * / = %` — những ký tự mang nghĩa thật trong bài toán và bài khoa học.
_PUNCTUATION = ".,!?;:'\"“”‘’()[]{}…"

#: Dưới ngưỡng này thì KHÔNG áp dụng bỏ qua lỗi gõ. "cat" và "bat" chỉ khác một
#: ký tự nhưng là hai từ khác hẳn — cho qua là dạy sai.
_MIN_LEN_FOR_TYPO_TOLERANCE = 5


@dataclass(frozen=True)
class TextMatchRule:
    case_sensitive: bool = False
    ignore_punctuation: bool = True
    trim_spaces: bool = True
    #: Chỉ bật cho đáp án tiếng Việt. Mặc định TẮT: "ma" và "mà" là hai từ khác nhau.
    ignore_diacritics: bool = False
    #: Số ký tự sai được bỏ qua (Levenshtein). Chỉ 0 hoặc 1.
    typo_tolerance: int = 0

    @classmethod
    def from_json(cls, raw: dict | None) -> TextMatchRule:
        """Đọc từ `answerJson`, nơi khoá viết kiểu camelCase như hợp đồng dữ liệu."""
        if not raw:
            return cls()
        return cls(
            case_sensitive=bool(raw.get("caseSensitive", False)),
            ignore_punctuation=bool(raw.get("ignorePunctuation", True)),
            trim_spaces=bool(raw.get("trimSpaces", True)),
            ignore_diacritics=bool(raw.get("ignoreDiacritics", False)),
            typo_tolerance=1 if raw.get("typoTolerance") else 0,
        )


_DEFAULT_RULE = TextMatchRule()


def normalize(value: str, rule: TextMatchRule | None = None) -> str:
    rule = rule or _DEFAULT_RULE

    # NFC trước tiên: bàn phím tiếng Việt và macOS gõ ra NFD ("e" + dấu rời),
    # Windows gõ ra NFC. Hai chuỗi nhìn giống hệt nhau mà không bằng nhau.
    text = unicodedata.normalize("NFC", value)

    if not rule.case_sensitive:
        text = text.lower()

    if rule.ignore_diacritics:
        # "đ" không phải là "d" + dấu nên NFD không tách được, phải thay tay.
        text = text.replace("đ", "d").replace("Đ", "D")
        text = "".join(
            ch
            for ch in unicodedata.normalize("NFD", text)
            if unicodedata.category(ch) != "Mn"  # Mn = dấu phụ
        )

    if rule.ignore_punctuation:
        text = "".join(ch for ch in text if ch not in _PUNCTUATION)

    if rule.trim_spaces:
        text = " ".join(text.split())

    return text


def matches(response: str, accepted: list[str], rule: TextMatchRule | None = None) -> bool:
    """Câu trả lời có khớp một trong các cách viết được chấp nhận không."""
    rule = rule or _DEFAULT_RULE
    got = normalize(response or "", rule)
    if not got:
        return False  # bỏ trống luôn sai, kể cả khi `accepted` cũng rỗng

    for candidate in accepted:
        want = normalize(candidate, rule)
        if got == want:
            return True
        if (
            rule.typo_tolerance
            and len(want) >= _MIN_LEN_FOR_TYPO_TOLERANCE
            and _levenshtein_within(got, want, rule.typo_tolerance)
        ):
            return True

    return False


def _levenshtein_within(a: str, b: str, limit: int) -> bool:
    """Khoảng cách sửa lỗi giữa hai chuỗi có ≤ `limit` không.

    Cắt sớm theo chênh lệch độ dài để không phải dựng cả ma trận cho những cặp
    chắc chắn quá xa nhau.
    """
    if abs(len(a) - len(b)) > limit:
        return False

    previous = list(range(len(b) + 1))
    for i, ch_a in enumerate(a, start=1):
        current = [i]
        for j, ch_b in enumerate(b, start=1):
            current.append(
                min(
                    previous[j] + 1,  # xoá
                    current[j - 1] + 1,  # thêm
                    previous[j - 1] + (ch_a != ch_b),  # thay
                )
            )
        # Cả hàng đã vượt ngưỡng thì mọi hàng sau cũng vậy — dừng luôn.
        if min(current) > limit:
            return False
        previous = current

    return previous[-1] <= limit

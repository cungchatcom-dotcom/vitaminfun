"""Giá trị mặc định cho `worlds.balance_json`.

⚠️ ĐÂY LÀ GIÁ TRỊ KHỞI TẠO, KHÔNG PHẢI NGUỒN CHÂN LÝ LÚC CHẠY.

Nguồn chân lý là cột `worlds.balance_json` trong database. Module này chỉ dùng
để **seed** một world mới. Code nghiệp vụ phải đọc từ world, không được import
`DEFAULT_BALANCE` rồi dùng thẳng — làm vậy là biến giá trị cân bằng thành thứ
phải sửa code mới đổi được, đúng cái mà docs/GAME_DOMAIN.md §6 cấm.

Dùng `read_balance(world)` để đọc, nó tự bù các khoá còn thiếu.
"""

from __future__ import annotations

from typing import Any

DEFAULT_BALANCE: dict[str, Any] = {
    # --- Mở khoá màn ---
    #: required_skill_pts(màn N) = skillPtsStep × (N − 1)
    "skillPtsStep": 50,
    # --- Công thức điểm chiến lực (§6) ---
    "difficultyMultiplier": {"easy": 1.0, "medium": 1.3, "hard": 1.6},
    "timeBonus": [
        {"minRemainingPct": 50, "bonus": 0.2},
        {"minRemainingPct": 25, "bonus": 0.1},
    ],
    "energyBonus": [
        {"minRemainingPct": 50, "bonus": 0.2},
        {"minRemainingPct": 25, "bonus": 0.1},
    ],
    # --- Thử lại (§1.7) ---
    #: Số lần thử cho MỖI CÂU HỎI. Hết lượt thì câu đó khoá trong lượt chơi.
    #: Đổi tên từ `maxAttemptsPerQuest` khi một nhiệm vụ mang nhiều câu hỏi —
    #: lượt thử áp cho từng câu, không phải cho cả cụm.
    "maxAttemptsPerQuestion": 3,
    #: Hệ số điểm theo lần thử thứ 1, 2, 3. null = không phạt.
    "attemptPenalty": [1.0, 0.6, 0.3],
    # --- Chơi lại (§6, đã chốt: cộng đủ điểm mỗi lần) ---
    "replayRatio": 1.0,
    "replayCapMultiplier": None,
    # --- Phòng chờ ---
    "lobbyCountdownSeconds": 30,
    # --- Năng lượng đội ---
    "energyCost": {
        "wrongAnswer": 2,
        "replayAudio": 1,
        "showSubtitle": 3,
        "translate": 5,
    },
}


def read_balance(balance_json: dict[str, Any] | None) -> dict[str, Any]:
    """Đọc cấu hình cân bằng của một world, bù khoá thiếu bằng mặc định.

    Bù ở tầng thứ nhất và thứ hai (ví dụ `energyCost.wrongAnswer`): thêm một
    khoá mới vào `DEFAULT_BALANCE` thì world đã seed từ trước vẫn chạy được mà
    không cần migration dữ liệu.
    """
    merged: dict[str, Any] = {}
    for key, default in DEFAULT_BALANCE.items():
        value = (balance_json or {}).get(key)
        if isinstance(default, dict) and isinstance(value, dict):
            merged[key] = {**default, **value}
        elif value is None and key not in (balance_json or {}):
            merged[key] = default
        else:
            merged[key] = value
    # Giữ lại khoá lạ mà người vận hành tự thêm — không lặng lẽ vứt đi.
    for key, value in (balance_json or {}).items():
        merged.setdefault(key, value)

    # Tương thích ngược: world seed trước khi đổi tên vẫn dùng khoá cũ. Đọc nó
    # thay vì bắt người vận hành đi sửa dữ liệu.
    old = (balance_json or {}).get("maxAttemptsPerQuest")
    if old is not None and "maxAttemptsPerQuestion" not in (balance_json or {}):
        merged["maxAttemptsPerQuestion"] = old

    return merged


def required_skill_pts(balance: dict[str, Any], order_index: int, override: int | None) -> int:
    """Điểm chiến lực cần có để mở màn thứ `order_index` (đếm từ 1).

    `override` là `stages.required_skill_pts`; khác None thì thắng công thức.
    Nhờ vậy 30 màn không phải lưu 30 dòng cấu hình, mà màn nào cần khác quy luật
    chung thì vẫn đặt riêng được.
    """
    if override is not None:
        return override
    step = balance.get("skillPtsStep") or 0
    return int(step) * max(0, order_index - 1)


def attempt_multiplier(balance: dict[str, Any], attempt_no: int) -> float:
    """Hệ số điểm theo lần thử thứ mấy (đếm từ 1).

    Vượt quá độ dài bảng thì lấy giá trị cuối — không rơi về 0, vì trả lời đúng
    thì vẫn phải được điểm.
    """
    penalty = balance.get("attemptPenalty")
    if not penalty:
        return 1.0
    index = min(max(attempt_no, 1), len(penalty)) - 1
    return float(penalty[index])

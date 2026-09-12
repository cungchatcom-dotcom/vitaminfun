"""Schema cho màn báo cáo của giáo viên.

Mọi chuỗi hiển thị vẫn nằm ở `web/messages/*.json`; ở đây chỉ có SỐ, MỐC THỜI
GIAN và tên nội dung (`name_i18n` — chữ do chính người dựng gõ, không phải chữ
giao diện).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel


class WindowCount(BaseModel):
    """Một con số đếm theo BỐN cửa sổ thời gian.

    Gộp bốn mốc vào một khối thay vì tám trường phẳng (`players_today`,
    `players_7d`…): giao diện vẽ chúng bằng CÙNG một ô thẻ, nên chúng nên có
    cùng một hình dạng. Thêm mốc thứ năm sau này cũng chỉ là thêm một trường ở
    đây, không phải thêm một ô vào mỗi chỗ đang đọc.
    """

    today: int
    last_7d: int
    last_30d: int
    total: int


class DayPoint(BaseModel):
    """Một cột của biểu đồ ngày."""

    day: date
    players: int
    runs: int


class OverviewOut(BaseModel):
    #: Người chơi KHÁC NHAU — đếm theo `user_id`, không phải theo lượt.
    players: WindowCount
    #: Lượt chơi: mỗi `stage_runs` là một lượt.
    runs: WindowCount

    #: Phân rã theo kết thúc, tính trên TOÀN BỘ lịch sử của bộ lọc đang chọn.
    runs_won: int
    runs_lost: int
    runs_abandoned: int
    runs_playing: int

    #: Tỉ lệ thắng trên các lượt ĐÃ KẾT THÚC (0..1). `None` = chưa có lượt nào
    #: kết thúc; khác hẳn 0.0 là "có chơi nhưng chưa thắng lần nào".
    win_rate: float | None
    #: Điểm trung bình, tính theo PHẦN TRĂM của điểm tối đa (0..1).
    avg_score_pct: float | None
    #: Thời lượng trung bình một lượt đã kết thúc, tính bằng giây.
    avg_duration_seconds: int | None

    #: Tổng số nhiệm vụ đã hoàn thành và điểm chiến lực đã trao.
    quests_completed: int
    skill_pts_awarded: int

    #: Chuỗi ngày gần đây cho biểu đồ cột. Dài đúng `days` ngày, NGÀY NÀO KHÔNG
    #: AI CHƠI vẫn có mặt với số 0 — bỏ trống ngày đó thì cái biểu đồ nói dối:
    #: mười bốn cột đều nhau trông như mười bốn ngày đều đặn.
    daily: list[DayPoint]

    #: Múi giờ dùng để cắt "hôm nay". Trả ra để giao diện nói được cho giáo viên
    #: biết con số này tính theo giờ nào — xem `settings.reports_timezone`.
    timezone: str


class PlayerRow(BaseModel):
    """Một hàng của bảng xếp hạng."""

    user_id: uuid.UUID
    display_name: str
    email: str

    #: Hạng, đếm từ 1, tính trên TOÀN BỘ bảng chứ không phải trong trang.
    rank: int

    #: Điểm chiến lực. Lọc theo world thì là điểm của world ấy; không lọc thì là
    #: TỔNG qua mọi world — điểm chiến lực vốn riêng theo từng world (xem
    #: `WorldProgress`), nên cộng lại chỉ có nghĩa như một con số xếp hạng chung.
    skill_pts: int
    stages_completed: int
    worlds_played: int

    runs: int
    runs_won: int
    play_seconds: int
    last_played_at: datetime | None


class PlayerListOut(BaseModel):
    items: list[PlayerRow]
    total: int
    page: int
    size: int


class StageResult(BaseModel):
    stage_id: uuid.UUID
    name_i18n: dict[str, str]
    chapter_name_i18n: dict[str, str]
    order_index: int

    best_score: int
    #: Điểm tối đa của màn — lấy từ lượt chơi gần nhất, vì đề bài có thể đổi.
    max_score: int
    best_quests_completed: int
    times_played: int
    skill_pts_earned_total: int

    #: Thời lượng lượt NHANH NHẤT đã kết thúc, tính bằng giây.
    best_duration_seconds: int | None
    first_completed_at: datetime | None
    last_played_at: datetime | None
    #: Kết thúc của lượt GẦN NHẤT: won · lost_time · abandoned · playing.
    last_status: str | None


class WorldResult(BaseModel):
    world_id: uuid.UUID
    name_i18n: dict[str, str]

    skill_pts: int
    stages_completed: int
    shards_owned: int
    shard_total: int

    first_played_at: datetime | None
    last_played_at: datetime | None
    completed_at: datetime | None
    gate_opened_at: datetime | None

    stages: list[StageResult]


class RunRow(BaseModel):
    run_id: uuid.UUID
    stage_id: uuid.UUID
    stage_name_i18n: dict[str, str]
    world_name_i18n: dict[str, str]

    status: str
    score: float
    max_score: int
    quests_completed: int
    skill_pts_earned: int
    got_map_shard: bool

    duration_seconds: int | None
    started_at: datetime
    ended_at: datetime | None


class PlayerDetailOut(BaseModel):
    user_id: uuid.UUID
    display_name: str
    email: str
    created_at: datetime | None

    runs: int
    runs_won: int
    play_seconds: int
    skill_pts: int

    worlds: list[WorldResult]
    #: Lịch sử gần đây, mới nhất trước. Có trần — một học sinh chăm chỉ có hàng
    #: trăm lượt, và không ai đọc hết một danh sách như thế trong một hộp thoại.
    recent_runs: list[RunRow]


class WorldOption(BaseModel):
    """Một lựa chọn của ô lọc world."""

    world_id: uuid.UUID
    name_i18n: dict[str, str]
    players: int
    runs: int

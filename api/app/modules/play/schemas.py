"""Schema cho phần chơi.

⚠️ LUẬT QUAN TRỌNG NHẤT CỦA FILE NÀY:

`SubmitAnswerOut` **không được có** `score`, `detail`, `answer`, hay `skill_pts`.
Trong trận, người chơi chỉ biết nhiệm vụ xong hay chưa xong. Chi tiết chấm điểm
để dành cho màn xem lại sau khi hết màn — xem docs/GAME_DOMAIN.md §1.6.

Thêm một trường vào đó "cho tiện debug" là làm hỏng cả cơ chế, vì nó vừa cắt
mạch chơi vừa rò đáp án cho người còn lượt thử và cho đồng đội ngồi cạnh.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


# ==========================================================================
# Đề bài đã đóng băng
# ==========================================================================


class SnapshotQuestion(BaseModel):
    """Một câu hỏi trong đề đã đóng băng. KHÔNG chứa đáp án."""

    id: uuid.UUID
    type: str
    content: dict[str, Any]
    points: int
    audio_max_plays: int | None = None


class SnapshotQuest(BaseModel):
    id: uuid.UUID
    order_index: int
    phase: Literal["advisor", "main"]
    quest_object_key: str
    #: Tên hiển thị. Rỗng thì giao diện lùi về `quest_object_key`.
    name_i18n: dict[str, str] = {}
    scene_x: int | None = None
    scene_y: int | None = None
    trigger_radius: int | None = None
    #: URL ảnh vật thể, đã đóng băng vào snapshot.
    icon_url: str | None = None
    #: Bề rộng ảnh theo hệ toạ độ thế giới. None = mặc định của cảnh.
    icon_size: int | None = None
    #: Nhịp thở của ảnh. None = mặc định của cảnh, 0 = tắt hẳn.
    pulse_percent: int | None = None
    pulse_period_ms: int | None = None
    energy_cost: int
    pass_score: int
    questions: list[SnapshotQuestion]


class SnapshotStage(BaseModel):
    id: uuid.UUID
    name_i18n: dict[str, str]
    synopsis_i18n: dict[str, str]
    scene_key: str
    time_limit_seconds: int
    initial_team_energy: int
    map_shard_index: int
    advisor_npc_key: str | None = None
    cluebook_i18n: dict[str, str]
    background_media_id: uuid.UUID | None = None
    #: URL ảnh nền, đã đóng băng.
    background_url: str | None = None
    advisor_portrait_media_id: uuid.UUID | None = None


class StageSnapshot(BaseModel):
    """Toàn bộ đề bài của một lượt chơi, an toàn gửi xuống mọi máy."""

    stage: SnapshotStage
    quests: list[SnapshotQuest]


# ==========================================================================
# Tiến độ trong trận
# ==========================================================================


class QuestionProgress(BaseModel):
    question_id: uuid.UUID
    #: Người này đã trả lời đúng câu này chưa.
    completed: bool
    #: Còn mấy lượt thử. `null` = không giới hạn.
    attempts_left: int | None


class QuestProgress(BaseModel):
    quest_id: uuid.UUID
    #: Người này đã đạt `pass_score` của nhiệm vụ chưa.
    completed: bool
    questions: list[QuestionProgress]


class TeammateProgress(BaseModel):
    """Tiến độ của MỘT thành viên, nhìn từ ngoài.

    Chỉ có "xong nhiệm vụ nào", không có điểm và không có bài làm — bảng tiến độ
    đội trong trận không được thành chỗ chép bài.
    """

    user_id: uuid.UUID | None
    hero_key: str
    display_name: str
    is_bot: bool
    is_me: bool
    quest_ids_completed: list[uuid.UUID]


class RunSpriteOut(BaseModel):
    """Một hành động của nhân vật, đúng thứ Phaser cần để cắt tấm ảnh:

        this.load.spritesheet(key, url, { frameWidth, frameHeight })

    `frames = 1` là hợp lệ: ảnh một khung, vẽ như hình tĩnh.
    """

    action_key: str
    url: str
    frames: int
    frame_width: int
    frame_height: int
    frame_rate: int


class RunCharacterOut(BaseModel):
    """Nhân vật người chơi đã chọn cho world của màn này.

    Chỉ những hành động CÓ ẢNH mới đi kèm: hành động chưa tải spritesheet thì
    Phaser không có gì để nạp.
    """

    id: uuid.UUID
    name_i18n: dict[str, str]
    sprites: list[RunSpriteOut] = []


class RunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    stage_id: uuid.UUID
    #: World chứa màn này. Có mặt để giao diện dựng được lối THOÁT — rời trận
    #: thì về đúng bản đồ world vừa đi ra, không phải về bản đồ thiên hà.
    #:
    #: Đặt ở đây chứ không nhét vào `snapshot`: snapshot là ĐỀ BÀI đóng băng,
    #: còn đây là dữ liệu điều hướng. Để trong snapshot thì mọi lượt chơi cũ
    #: đều thiếu trường này, mà nó thì không bao giờ đổi theo thời gian.
    world_id: uuid.UUID
    room_code: str
    status: Literal["playing", "won", "lost_energy", "lost_time", "abandoned"]
    is_trial: bool

    snapshot: StageSnapshot

    team_energy_initial: int
    team_energy_remaining: int
    #: Số giây còn lại, tính từ `started_at`. Server là nguồn duy nhất của thời
    #: gian — đồng hồ trên máy người chơi chỉ để hiển thị cho mượt.
    seconds_remaining: int
    started_at: datetime

    #: Nhân vật người gọi đã chọn cho world này. `None` = chưa chọn, và cảnh
    #: chơi vẽ ký hiệu mặc định.
    #:
    #: Ở `RunOut` chứ không trong `snapshot`, cùng lý do với `world_id`:
    #: snapshot là ĐỀ BÀI đóng băng, còn nhân vật là lựa chọn của người chơi và
    #: đổi được giữa hai lượt.
    character: RunCharacterOut | None = None

    #: Tiến độ của CHÍNH người gọi.
    my_progress: list[QuestProgress]
    team: list[TeammateProgress]


# ==========================================================================
# Nộp bài
# ==========================================================================


class SubmitAnswerIn(BaseModel):
    response: dict[str, Any] | None = None


class SubmitAnswerOut(BaseModel):
    """Phản hồi khi nộp một câu.

    ⚠️ Bốn trường. Không hơn. Xem ghi chú đầu file.
    """

    #: Câu này đã trả lời đúng chưa.
    completed: bool
    #: Cả NHIỆM VỤ đã đạt điểm qua ải chưa — đây là thứ hiện "MISSION COMPLETE".
    quest_completed: bool
    #: Còn mấy lượt thử cho câu này. `null` = không giới hạn, `0` = đã khoá.
    attempts_left: int | None
    #: Năng lượng ĐỘI còn lại sau lần nộp này.
    team_energy: int


# ==========================================================================
# Kết thúc & xem lại
# ==========================================================================


class RunResultPlayer(BaseModel):
    user_id: uuid.UUID | None
    hero_key: str
    display_name: str
    quests_completed: int
    score: float
    max_score: int
    skill_pts_earned: int
    got_map_shard: bool


class RunResultOut(BaseModel):
    status: Literal["playing", "won", "lost_energy", "lost_time", "abandoned"]
    #: Mảnh bản đồ của màn này — chỉ trao khi thắng.
    map_shard_index: int | None
    duration_seconds: int | None
    team_energy_remaining: int
    players: list[RunResultPlayer]
    #: Điểm chiến lực của người gọi trong world này, SAU khi đã cộng.
    my_world_skill_pts: int
    my_shards_owned: int
    world_shard_total: int


class ReviewAttempt(BaseModel):
    attempt_no: int
    response: dict[str, Any] | None
    is_correct: bool
    score: float


class ReviewQuestion(BaseModel):
    question_id: uuid.UUID
    type: str
    content: dict[str, Any]
    points: int
    #: Giờ mới lộ — chỉ sau khi lượt chơi kết thúc.
    answer: dict[str, Any] | None
    explanation: str | None
    attempts: list[ReviewAttempt]
    earned: float
    skill_pts_awarded: int


class ReviewQuest(BaseModel):
    quest_id: uuid.UUID
    order_index: int
    quest_object_key: str
    phase: Literal["advisor", "main"]
    pass_score: int
    earned: float
    completed: bool
    questions: list[ReviewQuestion]


class ReviewOut(BaseModel):
    """Màn xem lại (S6b) — CHỈ bài của chính người gọi."""

    run_id: uuid.UUID
    stage_name_i18n: dict[str, str]
    status: str
    quests: list[ReviewQuest] = Field(default_factory=list)
    total_earned: float
    total_max: int
    skill_pts_earned: int


# ==========================================================================
# Duyệt nội dung cho người chơi (S0-S2)
# ==========================================================================


class PlayStageOut(BaseModel):
    """Một màn chơi, nhìn từ phía học sinh."""

    id: uuid.UUID
    order_index: int
    name_i18n: dict[str, str]
    synopsis_i18n: dict[str, str]
    map_shard_index: int
    quest_count: int

    #: Điểm chiến lực cần để mở, đã tính từ balance_json của world.
    required_skill_pts: int
    #: Đủ điểm để vào chưa. Giáo viên và admin chơi thử thì luôn true.
    unlocked: bool
    #: Đã lấy được mảnh bản đồ của màn này chưa.
    completed: bool
    times_played: int
    best_score: int


class PlayChapterOut(BaseModel):
    id: uuid.UUID
    order_index: int
    name_i18n: dict[str, str]
    synopsis_i18n: dict[str, str]
    stages: list[PlayStageOut]
    #: Ảnh của chương, hiện ở hàng chương trong phòng chờ.
    cover_url: str | None = None
    #: Ảnh nền của minimap — bảng màn chơi mở ra khi bấm vào chương.
    minimap_url: str | None = None


class PlayWorldOut(BaseModel):
    """Một world trên bản đồ thiên hà (S0)."""

    id: uuid.UUID
    name_i18n: dict[str, str]
    story_i18n: dict[str, str]
    difficulty: str
    cover_url: str | None = None
    shard_total: int

    #: Chỗ đứng trên bản đồ, theo hệ toạ độ 3200×1800. None = chưa đặt, màn
    #: chọn world tự rải đều.
    scene_x: int | None = None
    scene_y: int | None = None
    #: Đường kính vòng tròn. None = mặc định của màn.
    icon_size: int | None = None
    pulse_percent: int | None = None
    pulse_period_ms: int | None = None

    #: Khoá HAY KHÔNG — giá trị đã tính, không phải cột thô.
    #:
    #: Khoá khi giáo viên bấm khoá, HOẶC khi world chưa có màn nào phát hành.
    #: Vế thứ hai không suy ra được ở phía giao diện: nó phải đếm màn, mà đếm
    #: màn thì phải hỏi database.
    is_locked: bool = False
    #: Người đang gọi có vào được world này không.
    #:
    #: Tách khỏi `is_locked` vì hai câu hỏi khác nhau: ổ khoá là thứ VẼ RA cho
    #: mọi người thấy, còn vào được hay không thì giáo viên chơi thử khác học
    #: sinh. Trộn hai thứ vào một cờ là hoặc giáo viên không xem trước được,
    #: hoặc học sinh đi thẳng vào world chưa phát hành.
    can_enter: bool = True
    #: Vẽ vành tròn (khung bao + thanh tiến độ) quanh world.
    show_ring: bool = False

    #: Tiến độ của CHÍNH người gọi, không phải của cả phòng.
    my_skill_pts: int
    my_shards: int
    stages_total: int
    stages_published: int


class PlayGalaxyOut(BaseModel):
    """Toàn bộ màn CHỌN WORLD (S0) trong một lần gọi.

    Nền, nhạc và danh sách world về cùng nhau vì chúng dựng nên MỘT màn hình.
    Tách làm hai lượt gọi thì màn hình vẽ hai lần, và có một khoảnh khắc các
    world nổi trên nền trống.
    """

    id: uuid.UUID
    name_i18n: dict[str, str]
    description_i18n: dict[str, str]
    background_url: str | None = None
    music_url: str | None = None

    #: Khung tiêu đề và khung mô tả. `*_url` rỗng thì giao diện vẽ một tấm nền
    #: trơn — màn hình vẫn chạy được trước khi ai kịp tải ảnh trang trí lên.
    title_url: str | None = None
    title_x: int | None = None
    title_y: int | None = None
    title_width: int | None = None
    title_color: str | None = None
    title_font: int | None = None
    desc_url: str | None = None
    desc_x: int | None = None
    desc_y: int | None = None
    desc_width: int | None = None
    desc_color: str | None = None
    desc_font: int | None = None

    worlds: list[PlayWorldOut]


class PlayFrameOut(BaseModel):
    """Một khung chữ của phòng chờ, ĐÃ giải xong việc thừa kế.

    World để trống trường nào thì lấy của thiên hà. Giải ở server chứ không ở
    giao diện: màn của học sinh không nạp thiên hà, và bắt nó nạp thêm chỉ để
    biết một cái nền là thêm một vòng gọi cho mỗi lần mở world.
    """

    url: str | None = None
    x: int | None = None
    y: int | None = None
    width: int | None = None
    height: int | None = None
    color: str | None = None
    font: int | None = None


class PlayLobbyOut(BaseModel):
    """Toàn bộ phần TRÌNH BÀY của phòng chờ."""

    background_url: str | None = None
    title: PlayFrameOut
    desc: PlayFrameOut
    #: Bố cục các khối kéo thả — nguyên `worlds.lobby_json`.
    layout: dict[str, Any] = {}
    #: Ảnh nền của từng khối, tra sẵn theo `media_id` bên trong `layout`.
    urls: dict[str, str] = {}


class PlayRankOut(BaseModel):
    """Một dòng bảng xếp hạng của world."""

    user_id: uuid.UUID
    display_name: str
    skill_pts: int
    shards: int
    #: Chính người đang xem. Giao diện làm nổi dòng này lên.
    is_me: bool = False


class PlayCharacterOut(BaseModel):
    """Một nhân vật ở màn chọn nhân vật.

    Chỉ ba thứ người chơi cần để chọn: mặt, tên, và vài dòng giới thiệu.
    Spritesheet KHÔNG gửi kèm — chúng chỉ có ích khi đã vào màn chơi, và gửi cả
    bộ cho năm nhân vật là kéo về mấy megabyte để người ta nhìn năm cái mặt.
    """

    id: uuid.UUID
    name_i18n: dict[str, str]
    bio_i18n: dict[str, str]
    avatar_url: str | None = None


class PickCharacterIn(BaseModel):
    character_id: uuid.UUID


class PlayWorldDetailOut(PlayWorldOut):
    """Chi tiết một world: chương, màn chơi, tiến độ (S1-S2)."""

    #: Nhân vật world này cho dùng, và cái người gọi đã chọn.
    characters: list[PlayCharacterOut] = []
    my_character_id: uuid.UUID | None = None

    #: Phần trình bày: nền, hai khung chữ, bố cục các khối.
    lobby: PlayLobbyOut
    #: Năm người dẫn đầu world này, và tổng số người đã từng chơi.
    leaderboard: list[PlayRankOut] = []
    players_total: int = 0

    chapters: list[PlayChapterOut]
    #: Đủ mảnh bản đồ để mở Cánh cổng Thời gian chưa.
    gate_ready: bool

    # ----------------------------------------------------------------------
    # Năm con số của BẢNG THÀNH TÍCH ở phòng chờ.
    #
    # Chỉ có ở màn CHI TIẾT world, không có ở bản đồ thiên hà: mỗi con số là
    # một phép đếm riêng, mà bản đồ vẽ mọi world cùng lúc — nhét chúng vào đó
    # là nhân số câu truy vấn lên theo số world để hiện những con số không ai
    # nhìn thấy trên bản đồ.
    #
    # Điểm chiến lực và mảnh bản đồ đã có sẵn ở `PlayWorldOut`.
    # ----------------------------------------------------------------------

    #: Nhãn cấp độ do người dựng đặt. Rỗng = giao diện tự dùng `difficulty`.
    level_i18n: dict[str, str] = Field(default_factory=dict)

    #: Sao đã đạt / tổng sao của world. Tổng là thật (cộng `stages.star_max`);
    #: phần đã đạt còn đứng ở 0 cho tới khi luật chấm sao hoàn thiện.
    my_stars: int = 0
    star_total: int = 0

    #: Nhiệm vụ đã từng động tới / tổng nhiệm vụ của các màn đã phát hành.
    #: Tiến độ world = thương của hai số này.
    my_quests_played: int = 0
    quest_total: int = 0

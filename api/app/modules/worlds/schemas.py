"""Schema cho cây nội dung game."""

from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

I18nText = dict[str, str]


# ==========================================================================
# Thiên hà — cái nền mà các world nằm lên trên
# ==========================================================================


class GalaxyUpdate(BaseModel):
    name_i18n: I18nText | None = None
    description_i18n: I18nText | None = None
    background_media_id: uuid.UUID | None = None
    music_media_id: uuid.UUID | None = None

    #: Khung tiêu đề và khung mô tả: ảnh, chỗ đứng, bề rộng.
    title_media_id: uuid.UUID | None = None
    title_x: int | None = None
    title_y: int | None = None
    title_width: int | None = Field(default=None, ge=80, le=3200)
    title_height: int | None = Field(default=None, ge=40, le=1800)
    #: Mã màu `#rrggbb`. Kiểm ở đây để lỗi trả về là 422 có chỗ sai rõ ràng,
    #: không phải một `CHECK` của Postgres nổ ra thành 500.
    title_color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    #: PHẦN TRĂM so với cỡ chữ mặc định. 100 = giữ nguyên.
    title_font: int | None = Field(default=None, ge=40, le=250)
    desc_media_id: uuid.UUID | None = None
    desc_x: int | None = None
    desc_y: int | None = None
    desc_width: int | None = Field(default=None, ge=80, le=3200)
    desc_height: int | None = Field(default=None, ge=40, le=1800)
    desc_color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    desc_font: int | None = Field(default=None, ge=40, le=250)

    #: Gỡ ảnh. Cần cờ riêng vì `None` trong PATCH nghĩa là "không gửi trường
    #: này", không phải "xoá đi".
    clear_background: bool | None = None
    clear_music: bool | None = None
    clear_title: bool | None = None
    clear_desc: bool | None = None


class GalaxyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    universe_id: uuid.UUID
    name_i18n: I18nText
    description_i18n: I18nText
    position: int
    status: Literal["draft", "published"]

    background_media_id: uuid.UUID | None
    music_media_id: uuid.UUID | None
    title_media_id: uuid.UUID | None
    title_x: int | None
    title_y: int | None
    title_width: int | None
    title_height: int | None
    title_color: str | None
    title_font: int | None
    desc_media_id: uuid.UUID | None
    desc_x: int | None
    desc_y: int | None
    desc_width: int | None
    desc_height: int | None
    desc_color: str | None
    desc_font: int | None
    #: URL dựng sẵn để giao diện không phải tra bảng media.
    background_url: str | None = None
    music_url: str | None = None
    title_url: str | None = None
    desc_url: str | None = None


# ==========================================================================
# World
# ==========================================================================


class LobbyContent(BaseModel):
    """Khung NỘI DUNG bên trong một khối phòng chờ — chỗ thật sự vẽ chữ và số.

    Ảnh nền của khối gần như bao giờ cũng là một tấm khung trang trí, và chỗ
    viết được chỉ là một ô ở giữa nó. Khung này nói ô đó nằm đâu.

    Toạ độ tính bằng PHẦN TRĂM CỦA KHỐI, không phải hệ 3200×1800: ảnh nền căng
    theo khối, nên kéo khối to ra là hoa văn to theo, và khung nội dung phải to
    theo cùng nhịp.
    """

    model_config = ConfigDict(extra="forbid")

    #: Tâm khung, phần trăm bề rộng/chiều cao khối.
    x: float | None = Field(default=None, ge=0, le=100)
    y: float | None = Field(default=None, ge=0, le=100)
    #: Bề rộng và chiều cao, cũng theo phần trăm khối. Sàn 5%: nhỏ hơn nữa thì
    #: không còn chỗ cho một chữ cái, mà tay cầm đổi cỡ thì lại biến mất.
    w: float | None = Field(default=None, ge=5, le=100)
    h: float | None = Field(default=None, ge=5, le=100)
    #: Màu chữ. Kiểm ở đây để sai thì ra 422 có chỗ sai rõ ràng.
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    #: PHẦN TRĂM so với cỡ chữ nền của khối. 100 = giữ nguyên.
    font: int | None = Field(default=None, ge=40, le=250)


class LobbyElement(BaseModel):
    """Một khối kéo thả được trong phòng chờ.

    Database không kiểm được bên trong một cột JSONB, nên chỗ kiểm duy nhất là
    ở đây. `extra="forbid"`: gửi nhầm tên trường thì báo lỗi ngay, chứ không
    lặng lẽ lưu một khoá không ai đọc.
    """

    model_config = ConfigDict(extra="forbid")

    #: Tâm khối, hệ toạ độ 3200×1800 — cùng hệ với world và với cảnh chơi.
    x: int | None = Field(default=None, ge=0, le=3200)
    y: int | None = Field(default=None, ge=0, le=1800)
    #: Bề rộng và chiều cao. `h` bỏ trống thì suy ra theo tỉ lệ gốc của ảnh —
    #: giữ nguyên nếp cũ cho khối chưa ai kéo cạnh dưới.
    w: int | None = Field(default=None, ge=40, le=3200)
    h: int | None = Field(default=None, ge=40, le=1800)
    media_id: uuid.UUID | None = None
    #: Chữ in đè lên khối — hiện chỉ ba cái nút dùng tới, và MẶC ĐỊNH LÀ RỖNG.
    #:
    #: Ảnh nút người dựng tải lên thường đã vẽ sẵn chữ ("CREATE ROOM") trong
    #: chính tấm ảnh; in thêm một dòng của hệ thống lên trên là hai lớp chữ
    #: chồng nhau. Nên chữ ở đây là thứ NGƯỜI DỰNG chủ động gõ, không phải thứ
    #: hệ thống tự điền.
    #:
    #: `dict` theo ngôn ngữ chứ không phải một chuỗi: nút của world song ngữ
    #: phải đọc được ở cả hai thứ tiếng, cùng luật với `name_i18n`.
    text_i18n: I18nText | None = None
    #: Khung nội dung — xem `LobbyContent`.
    content: LobbyContent | None = None


class WorldCreate(BaseModel):
    galaxy_id: uuid.UUID
    name_i18n: I18nText
    story_i18n: I18nText = Field(default_factory=dict)
    position: int = 0
    difficulty: Literal["easy", "medium", "hard"] = "easy"
    #: Nhãn cấp độ tự do hiện ở phòng chờ. Rỗng = dùng nhãn của `difficulty`.
    level_i18n: I18nText = Field(default_factory=dict)
    age_min: int | None = Field(default=None, ge=3, le=99)
    age_max: int | None = Field(default=None, ge=3, le=99)
    shard_total: int = Field(default=30, ge=1, le=200)
    cover_media_id: uuid.UUID | None = None
    #: Vị trí và đường kính trên bản đồ thiên hà. Bỏ trống được: trình thiết
    #: kế đặt chúng bằng cách kéo thả, không bằng cách gõ số lúc tạo.
    scene_x: int | None = None
    scene_y: int | None = None
    icon_size: int | None = Field(default=None, ge=40, le=1200)


class WorldUpdate(BaseModel):
    name_i18n: I18nText | None = None
    story_i18n: I18nText | None = None
    position: int | None = None
    difficulty: Literal["easy", "medium", "hard"] | None = None
    level_i18n: I18nText | None = None
    age_min: int | None = Field(default=None, ge=3, le=99)
    age_max: int | None = Field(default=None, ge=3, le=99)
    shard_total: int | None = Field(default=None, ge=1, le=200)
    cover_media_id: uuid.UUID | None = None
    status: Literal["draft", "published"] | None = None
    scene_x: int | None = None
    scene_y: int | None = None
    icon_size: int | None = Field(default=None, ge=40, le=1200)
    #: Nhịp thở của vòng tròn world. Cùng khoảng với `quests.pulse_*`.
    pulse_percent: int | None = Field(default=None, ge=0, le=50)
    pulse_period_ms: int | None = Field(default=None, ge=400, le=4_000)
    #: Học sinh chưa vào được world này.
    is_locked: bool | None = None
    #: Vẽ vành tròn (khung bao + thanh tiến độ) quanh world.
    show_ring: bool | None = None
    #: Gỡ ảnh world. `None` trong PATCH nghĩa là "không gửi", không phải "xoá".
    clear_cover: bool | None = None

    #: Phòng chờ của world. NULL = thừa của thiên hà — xem model.
    lobby_media_id: uuid.UUID | None = None
    title_media_id: uuid.UUID | None = None
    title_x: int | None = None
    title_y: int | None = None
    title_width: int | None = Field(default=None, ge=80, le=3200)
    title_height: int | None = Field(default=None, ge=40, le=1800)
    title_color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    title_font: int | None = Field(default=None, ge=40, le=250)
    desc_media_id: uuid.UUID | None = None
    desc_x: int | None = None
    desc_y: int | None = None
    desc_width: int | None = Field(default=None, ge=80, le=3200)
    desc_height: int | None = Field(default=None, ge=40, le=1800)
    desc_color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    desc_font: int | None = Field(default=None, ge=40, le=250)
    #: Bố cục phòng chờ. GỘP theo từng khối, không thay cả cục: gửi
    #: `{"stats": {...}}` chỉ đụng tới khối `stats`.
    #:
    #: Gộp ở mức KHỐI chứ không sâu hơn — chỗ gọi luôn gửi trọn một khối, và
    #: một phép gộp sâu tuỳ tiện thì không ai đoán được `media_id: null` nghĩa
    #: là "gỡ ảnh" hay "không gửi".
    lobby_json: dict[str, LobbyElement] | None = None

    #: Gỡ ảnh, quay về dùng của thiên hà.
    clear_lobby: bool | None = None
    clear_title: bool | None = None
    clear_desc: bool | None = None

    #: Chỉnh cân bằng game. Gộp vào giá trị hiện có, không thay thế cả cục —
    #: gửi một khoá không được làm mất mười khoá kia.
    balance_json: dict[str, Any] | None = None


class WorldOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    galaxy_id: uuid.UUID
    name_i18n: I18nText
    story_i18n: I18nText
    position: int
    difficulty: str
    #: Nhãn cấp độ tự do. Rỗng = giao diện dùng nhãn của `difficulty`.
    level_i18n: I18nText = Field(default_factory=dict)
    age_min: int | None
    age_max: int | None
    shard_total: int
    cover_media_id: uuid.UUID | None
    #: URL ảnh, dựng sẵn để giao diện không phải tra bảng media.
    cover_url: str | None = None
    scene_x: int | None
    scene_y: int | None
    icon_size: int | None
    pulse_percent: int | None
    pulse_period_ms: int | None
    is_locked: bool
    show_ring: bool
    status: Literal["draft", "published"]

    lobby_media_id: uuid.UUID | None
    lobby_url: str | None = None
    title_media_id: uuid.UUID | None
    title_url: str | None = None
    title_x: int | None
    title_y: int | None
    title_width: int | None
    title_height: int | None
    title_color: str | None
    title_font: int | None
    desc_media_id: uuid.UUID | None
    desc_url: str | None = None
    desc_x: int | None
    desc_y: int | None
    desc_width: int | None
    desc_height: int | None
    desc_color: str | None
    desc_font: int | None

    #: Đã hợp nhất với giá trị mặc định — giao diện không phải tự bù khoá thiếu.
    balance: dict[str, Any]

    lobby_json: dict[str, Any] = Field(default_factory=dict)
    #: URL ảnh của từng khối, dựng sẵn theo `media_id` bên trong `lobby_json`.
    #: Giao diện không phải tra bảng media, và không phải biết `media_id` là gì.
    lobby_urls: dict[str, str] = Field(default_factory=dict)

    #: Số liệu tóm tắt cho màn danh sách world của giáo viên.
    chapter_count: int = 0
    stage_count: int = 0
    stage_published_count: int = 0


# ==========================================================================
# Chương
# ==========================================================================


class ChapterCreate(BaseModel):
    name_i18n: I18nText
    synopsis_i18n: I18nText = Field(default_factory=dict)
    order_index: int = Field(ge=1, le=999)


class ChapterUpdate(BaseModel):
    name_i18n: I18nText | None = None
    synopsis_i18n: I18nText | None = None
    order_index: int | None = Field(default=None, ge=1, le=999)
    cover_media_id: uuid.UUID | None = None
    #: Ảnh nền của minimap — bảng màn chơi mở ra khi bấm vào chương.
    minimap_media_id: uuid.UUID | None = None
    #: Gỡ ảnh chương. `None` trong PATCH nghĩa là "không gửi", không phải "xoá".
    clear_cover: bool | None = None
    #: Gỡ ảnh nền minimap. Cùng luật với `clear_cover`.
    clear_minimap: bool | None = None


class ChapterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    world_id: uuid.UUID
    order_index: int
    name_i18n: I18nText
    synopsis_i18n: I18nText
    #: Luôn được điền. Không đặt mặc định để OpenAPI đánh dấu bắt buộc,
    #: nhờ vậy frontend không phải kiểm `undefined` cho thứ không bao giờ thiếu.
    stages: list[StageBrief]

    cover_media_id: uuid.UUID | None = None
    cover_url: str | None = None
    #: Ảnh nền của minimap chương.
    minimap_media_id: uuid.UUID | None = None
    minimap_url: str | None = None


# ==========================================================================
# Màn chơi
# ==========================================================================


class StageCreate(BaseModel):
    name_i18n: I18nText
    synopsis_i18n: I18nText = Field(default_factory=dict)
    order_index: int = Field(ge=1, le=999)
    scene_key: str = Field(min_length=1, max_length=64)
    map_shard_index: int = Field(ge=1, le=200)
    time_limit_seconds: int = Field(default=300, ge=30, le=7200)
    initial_team_energy: int = Field(default=100, ge=1, le=10_000)
    skill_pts_max: int = Field(default=80, ge=1, le=10_000)
    required_skill_pts: int | None = Field(default=None, ge=0)
    star_max: int = Field(default=3, ge=0, le=10)
    star_score_pcts: list[int] = Field(default_factory=list)
    min_players: int = Field(default=1, ge=1, le=4)
    max_players: int = Field(default=4, ge=1, le=4)
    advisor_npc_key: str | None = Field(default=None, max_length=64)
    background_media_id: uuid.UUID | None = None
    advisor_portrait_media_id: uuid.UUID | None = None
    cluebook_i18n: I18nText = Field(default_factory=dict)


class StageUpdate(BaseModel):
    name_i18n: I18nText | None = None
    synopsis_i18n: I18nText | None = None
    order_index: int | None = Field(default=None, ge=1, le=999)
    scene_key: str | None = Field(default=None, min_length=1, max_length=64)
    map_shard_index: int | None = Field(default=None, ge=1, le=200)
    time_limit_seconds: int | None = Field(default=None, ge=30, le=7200)
    initial_team_energy: int | None = Field(default=None, ge=1, le=10_000)
    skill_pts_max: int | None = Field(default=None, ge=1, le=10_000)
    required_skill_pts: int | None = Field(default=None, ge=0)
    star_max: int | None = Field(default=None, ge=0, le=10)
    #: Ngưỡng PHẦN TRĂM để nhận từng sao, ví dụ `[40, 70, 90]`. Tự sắp xếp tăng
    #: dần ở router, nên người dựng gõ lộn thứ tự cũng không sao.
    star_score_pcts: list[int] | None = None
    min_players: int | None = Field(default=None, ge=1, le=4)
    max_players: int | None = Field(default=None, ge=1, le=4)
    advisor_npc_key: str | None = Field(default=None, max_length=64)
    background_media_id: uuid.UUID | None = None
    advisor_portrait_media_id: uuid.UUID | None = None
    cluebook_i18n: I18nText | None = None
    status: Literal["draft", "published"] | None = None


class StageBrief(BaseModel):
    """Đủ để vẽ danh sách màn, không kèm nhiệm vụ."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    chapter_id: uuid.UUID
    order_index: int
    name_i18n: I18nText
    scene_key: str
    map_shard_index: int
    status: Literal["draft", "published"]
    quest_count: int = 0
    #: Điểm chiến lực cần để mở — đã tính từ balance nếu không đặt riêng.
    required_skill_pts_effective: int = 0


class StageOut(StageBrief):
    synopsis_i18n: I18nText = Field(default_factory=dict)
    time_limit_seconds: int = 300
    initial_team_energy: int = 100
    skill_pts_max: int = 80
    required_skill_pts: int | None = None
    star_max: int = 3
    star_score_pcts: list[int] = Field(default_factory=list)
    min_players: int = 1
    max_players: int = 4
    advisor_npc_key: str | None = None
    background_media_id: uuid.UUID | None = None
    #: URL ảnh nền, dựng sẵn để giao diện không phải tra bảng media.
    background_url: str | None = None
    advisor_portrait_media_id: uuid.UUID | None = None
    cluebook_i18n: I18nText = Field(default_factory=dict)
    quests: list[QuestOut]
    #: Vì sao chưa xuất bản được. Rỗng = đủ điều kiện.
    publish_blockers: list[PublishBlocker]


class PublishBlocker(BaseModel):
    """Một lý do khiến màn chưa xuất bản được.

    Trả về mã + tham số, không trả câu tiếng Việt: giao diện tra
    `messages/*.json` để hiển thị, đúng quy ước lỗi của cả hệ thống.
    """

    code: str
    params: dict[str, Any] = Field(default_factory=dict)


# ==========================================================================
# Nhiệm vụ
# ==========================================================================


class QuestCreate(BaseModel):
    """Tạo một nhiệm vụ RỖNG (chưa có câu hỏi).

    Câu hỏi thêm sau bằng `POST /quests/{id}/questions` — một nhiệm vụ mang
    nhiều câu, nên không có "câu hỏi của nhiệm vụ" để nhận ngay lúc tạo.
    """

    order_index: int = Field(ge=1, le=99)
    quest_object_key: str = Field(min_length=1, max_length=64)
    name_i18n: I18nText = Field(default_factory=dict)
    phase: Literal["advisor", "main"] = "main"
    scene_x: int | None = None
    scene_y: int | None = None
    #: Bán kính phạm vi kích hoạt. None = mặc định của cảnh.
    trigger_radius: int | None = Field(default=None, ge=20, le=1200)
    icon_media_id: uuid.UUID | None = None
    icon_size: int | None = Field(default=None, ge=16, le=2000)
    #: Nhịp thở của ảnh. None = mặc định của cảnh, 0 = tắt hẳn.
    pulse_percent: int | None = Field(default=None, ge=0, le=50)
    #: Một nhịp đầy đủ (to rồi nhỏ), mili giây. None = mặc định của cảnh.
    pulse_period_ms: int | None = Field(default=None, ge=400, le=4_000)
    energy_cost: int = Field(default=0, ge=0, le=1000)
    #: Điểm tối thiểu để hoàn thành. None = tổng điểm mọi câu trong nhiệm vụ.
    pass_score: int | None = Field(default=None, ge=0, le=10_000)
    #: Thêm luôn vài câu hỏi cho tiện — giao diện chọn nhiều rồi bấm một lần.
    question_ids: list[uuid.UUID] = Field(default_factory=list, max_length=50)


class QuestUpdate(BaseModel):
    order_index: int | None = Field(default=None, ge=1, le=99)
    quest_object_key: str | None = Field(default=None, min_length=1, max_length=64)
    name_i18n: I18nText | None = None
    phase: Literal["advisor", "main"] | None = None
    scene_x: int | None = None
    scene_y: int | None = None
    trigger_radius: int | None = Field(default=None, ge=20, le=1200)
    icon_media_id: uuid.UUID | None = None
    icon_size: int | None = Field(default=None, ge=16, le=2000)
    pulse_percent: int | None = Field(default=None, ge=0, le=50)
    pulse_period_ms: int | None = Field(default=None, ge=400, le=4_000)
    energy_cost: int | None = Field(default=None, ge=0, le=1000)
    pass_score: int | None = Field(default=None, ge=0, le=10_000)
    #: True = xoá `pass_score` về None (quay lại "phải đúng hết"). Cần cờ riêng
    #: vì `pass_score=None` trong PATCH nghĩa là "không gửi", không phải "xoá".
    #: Kiểu `bool | None` chứ không phải `bool = False`: trường có giá trị mặc
    #: định bị OpenAPI sinh thành BẮT BUỘC ở phía TypeScript.
    clear_pass_score: bool | None = None


class QuestQuestionAdd(BaseModel):
    """Lắp câu hỏi vào nhiệm vụ. Chọn nhiều câu rồi thêm một lần."""

    question_ids: list[uuid.UUID] = Field(min_length=1, max_length=50)
    #: Điểm cho MỖI câu vừa thêm. Mặc định 10.
    points: int = Field(default=10, ge=0, le=1000)


class QuestQuestionUpdate(BaseModel):
    points: int | None = Field(default=None, ge=0, le=1000)
    order_index: int | None = Field(default=None, ge=1, le=99)


class QuestQuestionOut(BaseModel):
    """Một câu hỏi bên trong một nhiệm vụ."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    question_id: uuid.UUID
    order_index: int
    points: int

    #: Tóm tắt câu hỏi để vẽ sơ đồ màn. KHÔNG bao giờ kèm đáp án.
    question_type: str | None = None
    question_status: str | None = None
    #: Câu hỏi đã bị xoá mềm. Tách riêng khỏi `question_status` vì một câu có
    #: thể vừa `published` vừa đã xoá — xem ghi chú lịch sử ở CHANGELOG của T3.
    question_deleted: bool = False
    question_prompt: str | None = None


class QuestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    stage_id: uuid.UUID
    order_index: int
    phase: Literal["advisor", "main"]
    quest_object_key: str
    name_i18n: I18nText
    scene_x: int | None
    scene_y: int | None
    trigger_radius: int | None
    icon_media_id: uuid.UUID | None
    icon_size: int | None
    #: Nhịp thở của ảnh. `null` = mặc định của cảnh, `0` = tắt hẳn.
    pulse_percent: int | None
    pulse_period_ms: int | None
    #: URL ảnh, dựng sẵn để giao diện không phải tra bảng media.
    icon_url: str | None = None
    energy_cost: int

    questions: list[QuestQuestionOut]

    #: Tổng điểm mọi câu hỏi trong nhiệm vụ.
    total_points: int
    #: Giá trị thô, `null` = chưa đặt riêng.
    pass_score: int | None
    #: Đã tính: `pass_score` nếu có, không thì bằng `total_points`.
    pass_score_effective: int


# Pydantic cần giải các tham chiếu tới lớp khai báo sau.
ChapterOut.model_rebuild()
StageOut.model_rebuild()

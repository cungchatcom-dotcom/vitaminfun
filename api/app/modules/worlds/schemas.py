"""Schema cho cây nội dung game."""

from __future__ import annotations

import uuid
from typing import Annotated, Any, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, model_validator

I18nText = dict[str, str]


def _lam_sach_ma(value: Any) -> Any:
    """Cắt khoảng trắng, và coi ô TRỐNG là `None`.

    Bắt buộc phải có, không phải cho gọn: unique index của mã là loại CÓ ĐIỀU
    KIỆN (`WHERE ... IS NOT NULL`). Để chuỗi rỗng lọt xuống thì hai bản ghi cùng
    `''` sẽ đụng nhau, và người dùng nhận một lỗi "trùng mã" cho hai ô mà họ vừa
    xoá trắng — không cách nào đoán ra.
    """
    if isinstance(value, str):
        return value.strip() or None
    return value


#: MÃ ĐỊNH DANH do bộ phận nội dung đặt: `W1`, `W1-S1`, `W1-S1-Quest-01`.
#:
#: Gửi `null` hoặc chuỗi rỗng để XOÁ mã. Xem `_apply_optional()` bên router —
#: mã là một trong số ít trường mà `null` mang nghĩa "bỏ đi" chứ không phải
#: "không gửi".
ContentCode = Annotated[
    str | None, BeforeValidator(_lam_sach_ma), Field(default=None, max_length=64)
]


# ==========================================================================
# Âm thanh
# ==========================================================================

#: Các khối tiếng một màn có. Phải khớp `AUDIO_SLOTS` ở `web/src/game/audio.ts`.
#:
#: Nhắc lại danh sách ở đây thay vì nhận `str` bất kỳ, và đó là một cuộc đổi
#: chác có tính: hai chỗ phải sửa cùng lúc khi thêm khối mới, đổi lại một khoá
#: gõ sai ("ambiant") báo lỗi 422 ngay thay vì lặng lẽ nằm trong database mãi
#: mãi, không bao giờ phát, và không ai truy ra được vì sao.
AudioSlot = Literal["ambient", "walk", "idle"]

#: Ảnh nền là ẢNH hay VIDEO. Lấy thẳng từ `media_assets.kind` — bảng đó đã biết
#: rồi, vì server suy ra từ đuôi file lúc tải lên.
#:
#: Trả cái loại này xuống thay vì để giao diện đoán theo đuôi trong URL: đoán
#: theo đuôi là dựng một nguồn sự thật THỨ HAI cho một câu hỏi database đã trả
#: lời xong, và hai nguồn thì sớm muộn cũng lệch (một CDN trả URL không đuôi là
#: đủ). `None` = chưa đặt ảnh nền.
BackgroundKind = Literal["image", "video"]


class AudioTrack(BaseModel):
    """Một khối tiếng: file, âm lượng, tốc độ, có lặp hay không.

    Bỏ trống trường nào thì lấy mặc định của khối đó trong sổ đăng ký — xem
    `resolveAudio()`. `volume: 0` KHÁC `volume: null`: 0 là "câm hẳn", null là
    "chưa đặt".
    """

    model_config = ConfigDict(extra="forbid")

    media_id: uuid.UUID | None = None
    #: PHẦN TRĂM, không phải 0..1. Cùng nếp với `pulse_percent` và `title_font`.
    volume: int | None = Field(default=None, ge=0, le=100)
    #: Tốc độ phát, PHẦN TRĂM. 100 = nguyên bản. Sàn 50: chậm hơn nữa thì bản
    #: nhạc nào cũng thành tiếng rên, và người nghe tưởng file hỏng.
    rate: int | None = Field(default=None, ge=50, le=200)
    loop: bool | None = None
    #: Lấy TIẾNG CỦA VIDEO NỀN làm nhạc nền, thay cho `media_id`.
    #:
    #: Chỉ có nghĩa ở khối `ambient`, và chỉ khi ảnh nền thật sự là video —
    #: `_merge_audio()` chặn các khối khác bằng 422. Nằm CẠNH `media_id` chứ
    #: không thay thế nó: bỏ chọn là bản nhạc đã tải lên phát lại ngay, không
    #: phải tải lên lần nữa.
    from_video: bool | None = None


# ==========================================================================
# Thiên hà — cái nền mà các world nằm lên trên
# ==========================================================================


class GalaxyUpdate(BaseModel):
    name_i18n: I18nText | None = None
    description_i18n: I18nText | None = None
    background_media_id: uuid.UUID | None = None

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
    #: Âm thanh. GỘP theo từng khối, không thay cả cục — cùng luật với
    #: `StageUpdate.audio`. Khối gửi lên mà không có `media_id` nghĩa là gỡ file.
    audio: dict[AudioSlot, AudioTrack] | None = None
    clear_background: bool | None = None
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
    #: Ảnh nền là ảnh hay video — quyết định vẽ bằng `<img>` hay `<video>`.
    background_kind: BackgroundKind | None = None
    title_url: str | None = None
    desc_url: str | None = None
    #: Âm thanh. Object rỗng = màn hình này im lặng.
    audio: dict[str, AudioTrack] = Field(default_factory=dict)
    #: URL từng khối tiếng, dựng sẵn theo `media_id` — cùng nếp với `lobby_urls`.
    audio_urls: dict[str, str] = Field(default_factory=dict)
    #: TÊN FILE GỐC của từng khối. `storage_key` là một chuỗi băm, nên không có
    #: nó thì người dựng không biết mình đã tải bản nào lên.
    audio_names: dict[str, str] = Field(default_factory=dict)


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
    #: Mã world trong file nội dung. Chưa có file nào mang cột này, nên hôm nay
    #: nó luôn để trống — thêm sẵn để world thứ hai không phải chờ một migration.
    world_code: ContentCode = None
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

    #: Âm thanh phòng chờ. GỘP theo từng khối, cùng luật với `lobby_json`.
    audio: dict[AudioSlot, AudioTrack] | None = None

    #: Gỡ ảnh, quay về dùng của thiên hà.
    clear_lobby: bool | None = None
    clear_title: bool | None = None
    clear_desc: bool | None = None

    #: Chỉnh cân bằng game. Gộp vào giá trị hiện có, không thay thế cả cục —
    #: gửi một khoá không được làm mất mười khoá kia.
    balance_json: dict[str, Any] | None = None

    #: LỜI PHÁN của người canh giữ — ba danh sách câu, dùng chung cả world.
    #:
    #: `{"praise": [...], "wrong": [...], "moveOn": [...]}`. Gửi lên thì THAY
    #: HẲN nhóm được gửi — khác `balance_json` gộp theo khoá: ở đây một khoá là
    #: cả một danh sách, và "gộp" hai danh sách thì không có nghĩa nào đúng.
    #: Gửi `{}` = xoá hết, quay về bộ mặc định trong `messages/`.
    verdict_json: dict[str, list[str]] | None = None


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

    world_code: str | None = None
    lobby_media_id: uuid.UUID | None
    lobby_url: str | None = None
    #: Nền phòng chờ là ảnh hay video. Xem `GalaxyOut.background_kind`.
    lobby_kind: BackgroundKind | None = None
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

    #: Bộ câu phán của world. `{}` = chưa đặt, màn chơi dùng bộ trong `messages/`.
    verdict_json: dict[str, list[str]] = Field(default_factory=dict)

    lobby_json: dict[str, Any] = Field(default_factory=dict)
    #: URL ảnh của từng khối, dựng sẵn theo `media_id` bên trong `lobby_json`.
    #: Giao diện không phải tra bảng media, và không phải biết `media_id` là gì.
    lobby_urls: dict[str, str] = Field(default_factory=dict)

    #: Âm thanh phòng chờ. Object rỗng = phòng chờ im lặng.
    audio: dict[str, AudioTrack] = Field(default_factory=dict)
    audio_urls: dict[str, str] = Field(default_factory=dict)
    audio_names: dict[str, str] = Field(default_factory=dict)

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
# Vùng đi được
# ==========================================================================

#: Khung toạ độ của cảnh chơi. Phải khớp `WORLD` trong `web/src/game/world.ts`.
WORLD_W = 3200
WORLD_H = 1800

#: Trần số hình một màn. Không phải giới hạn kỹ thuật — cảnh chơi xét từng hình
#: cho MỖI bước chân, nên vài trăm hình là vài trăm phép kiểm mỗi khung hình.
#: Một màn cần tới ngần này hình thì thứ nó cần là một tilemap, không phải thêm
#: chỗ trong danh sách.
MAX_SHAPES = 120

#: Trần số đỉnh một đa giác. Nét vẽ tay rút gọn xong hiếm khi quá 30.
MAX_POLY_POINTS = 200


class CollisionShape(BaseModel):
    """Một hình trong bản đồ va chạm.

    `rect` và `ellipse` mô tả bằng KHUNG BAO — `x`/`y` là mép trên-trái, không
    phải tâm. Khác với nhiệm vụ (lưu tâm) là có chủ ý: một cú kéo chuột sinh ra
    hai góc, và quy về tâm rồi lại quy ngược lại là hai phép đổi để sai.
    """

    id: str = Field(min_length=1, max_length=40)
    #: `allow` = bên TRONG hình đi được. `block` = bên trong hình cấm.
    mode: Literal["allow", "block"]
    kind: Literal["rect", "ellipse", "poly"]

    #: Khung bao — chỉ `rect` và `ellipse` dùng.
    x: int | None = Field(default=None, ge=-WORLD_W, le=WORLD_W * 2)
    y: int | None = Field(default=None, ge=-WORLD_H, le=WORLD_H * 2)
    w: int | None = Field(default=None, ge=1, le=WORLD_W * 2)
    h: int | None = Field(default=None, ge=1, le=WORLD_H * 2)

    #: Đỉnh đa giác `[[x, y], ...]` — chỉ `poly` dùng.
    points: list[tuple[int, int]] | None = Field(default=None, max_length=MAX_POLY_POINTS)

    @model_validator(mode="after")
    def _shape_is_complete(self) -> CollisionShape:
        """Hình phải mang đủ số liệu của CHÍNH LOẠI nó.

        Kiểm ở đây chứ không ở cảnh chơi: một hình thiếu `w` lọt xuống được máy
        học sinh sẽ thành một bức tường vô hình mà không ai giải thích nổi.
        """
        if self.kind == "poly":
            if self.points is None or len(self.points) < 3:
                raise ValueError("poly_needs_3_points")
        elif self.x is None or self.y is None or self.w is None or self.h is None:
            raise ValueError("box_needs_x_y_w_h")
        return self


class CollisionMap(BaseModel):
    """Bản đồ va chạm của một màn.

    Luật xét: **hình khớp CUỐI CÙNG thắng**, `shapes[0]` dưới cùng. Một câu, và
    nhờ nó mà ghép được các vùng lồng nhau không cần phép toán tập hợp.

    `shapes` RỖNG nghĩa là cả bản đồ đi được, bất kể `default` — xem
    `canWalkAt()` bên `web/src/game/collision.ts`. Không có luật đó thì bật chế
    độ vẽ rồi chưa vẽ gì là nhốt luôn nhân vật tại chỗ.
    """

    version: Literal[1] = 1
    #: Ngoài MỌI hình thì đi được hay không.
    default: Literal["walkable", "blocked"] = "blocked"
    shapes: list[CollisionShape] = Field(default_factory=list, max_length=MAX_SHAPES)


# ==========================================================================
# Màn chơi
# ==========================================================================


class StageCreate(BaseModel):
    #: Mã màn chơi trong file nội dung, ví dụ `W1-S1`. Câu hỏi nhập khẩu
    #: mang cùng mã sẽ tự hiện ra khi mở màn này.
    stage_code: ContentCode = None
    name_i18n: I18nText
    synopsis_i18n: I18nText = Field(default_factory=dict)
    order_index: int = Field(ge=1, le=999)
    #: Bỏ trống được — server điền `DEFAULT_SCENE_KEY`. Xem ghi chú ở đó.
    scene_key: str = Field(default="", max_length=64)
    map_shard_index: int = Field(ge=1, le=200)
    #: `None` = kế thừa từ màn đầu tiên của world. Trần 900 = nửa chiều cao thế
    #: giới; cao hơn nữa thì nhân vật che mất chính cái cảnh nó đang đứng trong.
    character_height: int | None = Field(default=None, ge=40, le=900)
    time_limit_seconds: int = Field(default=300, ge=30, le=7200)
    #: Năng lượng cấp cho MỖI người, sau khi họ qua nhiệm vụ NPC. 0 = màn này
    #: không có trợ giúp. Mặc định 10 = năm lần xin gợi ý.
    energy_per_player: int = Field(default=10, ge=0, le=10_000)
    skill_pts_max: int = Field(default=80, ge=1, le=10_000)
    required_skill_pts: int | None = Field(default=None, ge=0)
    star_max: int = Field(default=3, ge=0, le=10)
    star_score_pcts: list[int] = Field(default_factory=list)
    min_players: int = Field(default=1, ge=1, le=4)
    max_players: int = Field(default=4, ge=1, le=4)
    advisor_npc_key: str | None = Field(default=None, max_length=64)
    background_media_id: uuid.UUID | None = None
    #: Video mở màn. `None` = vào thẳng, y như trước khi có tính năng này.
    intro_video_media_id: uuid.UUID | None = None
    #: Bố cục màn hội thoại. `None` = kế thừa màn đầu của world.
    dialogue_json: dict[str, Any] | None = None
    advisor_portrait_media_id: uuid.UUID | None = None
    advisor_outro_i18n: I18nText = Field(default_factory=dict)
    cluebook_title_i18n: I18nText = Field(default_factory=dict)
    cluebook_i18n: I18nText = Field(default_factory=dict)


class StageUpdate(BaseModel):
    #: Mã màn chơi trong file nội dung, ví dụ `W1-S1`. Câu hỏi nhập khẩu
    #: mang cùng mã sẽ tự hiện ra khi mở màn này.
    stage_code: ContentCode = None
    name_i18n: I18nText | None = None
    synopsis_i18n: I18nText | None = None
    #: KHOÁ TAY. `None` = không gửi, giữ nguyên — xem `STAGE_KEEP_FIELDS`.
    is_locked: bool | None = None
    order_index: int | None = Field(default=None, ge=1, le=999)
    scene_key: str | None = Field(default=None, min_length=1, max_length=64)
    map_shard_index: int | None = Field(default=None, ge=1, le=200)
    character_height: int | None = Field(default=None, ge=40, le=900)
    #: `null` trong PATCH nghĩa là "không gửi", nên xoá về kế thừa phải nói bằng
    #: một cờ riêng. Cùng nếp với `clear_pass_score`.
    clear_character_height: bool | None = None
    #: CHỖ XUẤT PHÁT của nhân vật — điểm va chạm, hệ toạ độ thế giới. Không kèm
    #: khoảng, cùng nếp với `quests.scene_x/scene_y`: hệ toạ độ thế giới là hằng
    #: số của phía giao diện, và cảnh chơi vẫn cứu hộ về ô đi được gần nhất.
    spawn_x: int | None = None
    spawn_y: int | None = None
    #: Gỡ chỗ xuất phát riêng, về chỗ mặc định của cảnh. Cờ riêng vì `null`
    #: trong PATCH nghĩa là "không gửi". Cùng nếp với `clear_character_height`.
    #:
    #: MỘT cờ cho CẢ HAI trục, không phải hai: một chỗ đứng chỉ có nghĩa khi đủ
    #: cả x lẫn y, nên xoá được một nửa là mở đường cho một trạng thái không ai
    #: đọc nổi.
    clear_spawn: bool | None = None
    time_limit_seconds: int | None = Field(default=None, ge=30, le=7200)
    energy_per_player: int | None = Field(default=None, ge=0, le=10_000)
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
    #: Video mở màn. `null` = XOÁ (đi qua `_apply_optional`), cùng luật với
    #: `advisor_outro_audio_media_id` ngay dưới — nút "Gỡ video" phải gỡ được
    #: thật, chứ không trả 200 rồi không đổi gì.
    intro_video_media_id: uuid.UUID | None = None
    advisor_portrait_media_id: uuid.UUID | None = None
    advisor_outro_i18n: I18nText | None = None
    #: Đoạn ghi âm NPC nói lời chia tay. `null` = XOÁ (đi qua `_apply_optional`),
    #: cùng luật với `quests.icon_media_id` và `questions.audio_media_id`.
    advisor_outro_audio_media_id: uuid.UUID | None = None
    advisor_outro_show_transcript: bool | None = None
    cluebook_title_i18n: I18nText | None = None
    cluebook_i18n: I18nText | None = None
    #: Vùng đi được. Gửi cả bản đồ mỗi lần, không vá từng hình: trình thiết kế
    #: giữ danh sách trong bộ nhớ để hoàn tác, nên nó luôn có bản đầy đủ trong
    #: tay — và một PATCH từng hình thì hai tab mở cùng lúc sẽ trộn hai bản vẽ
    #: vào nhau thành một thứ không ai vẽ ra.
    collision: CollisionMap | None = None
    #: Xoá vùng đi được về "cả bản đồ đi được". Cần cờ riêng vì `null` trong
    #: PATCH nghĩa là "không gửi trường này". Cùng nếp với `clear_character_height`.
    clear_collision: bool | None = None
    #: Bố cục màn hội thoại — GHI ĐÈ CẢ CỤC, cùng luật với `collision`: trình
    #: thiết kế luôn cầm bản đầy đủ đang trên màn hình họ.
    dialogue_json: dict[str, Any] | None = None
    #: Trả bố cục về KẾ THỪA màn đầu của world. Cờ riêng vì `null` trong PATCH
    #: nghĩa là "không gửi". Cùng nếp với `clear_collision`.
    clear_dialogue: bool | None = None
    #: Âm thanh. GỘP theo từng khối, không thay cả cục: gửi `{"walk": {...}}`
    #: chỉ đụng tới tiếng bước chân, nhạc nền giữ nguyên. Cùng luật với
    #: `lobby_json`, và gộp ở mức KHỐI chứ không sâu hơn — chỗ gọi luôn gửi trọn
    #: một khối, còn một phép gộp sâu tuỳ tiện thì không ai đoán được
    #: `media_id: null` nghĩa là "gỡ file" hay "không gửi".
    audio: dict[AudioSlot, AudioTrack] | None = None
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
    stage_code: str | None = None
    status: Literal["draft", "published"]
    #: KHOÁ TAY — xem `Stage.is_locked`. Đã phát hành vẫn khoá được.
    is_locked: bool = False
    quest_count: int = 0
    #: Điểm chiến lực cần để mở — đã tính từ balance nếu không đặt riêng.
    required_skill_pts_effective: int = 0


class StageOut(StageBrief):
    synopsis_i18n: I18nText = Field(default_factory=dict)
    #: Số ĐÃ ĐẶT RIÊNG cho màn này. `None` = đang kế thừa từ màn đầu của world.
    character_height: int | None = None
    #: Số THẬT SỰ dùng — đã giải xong chuỗi kế thừa. Giao diện vẽ theo cái này,
    #: và ô nhập thì đọc `character_height` để biết đâu là số của riêng màn.
    character_height_effective: int = 160
    #: Chỗ xuất phát ĐÃ ĐẶT RIÊNG. `None` = dùng chỗ mặc định của cảnh, và
    #: trình thiết kế đọc chính cái `None` đó để biết có nên hiện nút gỡ.
    spawn_x: int | None = None
    spawn_y: int | None = None
    time_limit_seconds: int = 300
    energy_per_player: int = 10
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
    #: Ảnh nền là ảnh hay video. Xem `GalaxyOut.background_kind`.
    background_kind: BackgroundKind | None = None
    intro_video_media_id: uuid.UUID | None = None
    #: URL video mở màn, dựng sẵn để giao diện không phải tra bảng media.
    #: `None` = màn này vào thẳng.
    intro_video_url: str | None = None
    advisor_portrait_media_id: uuid.UUID | None = None
    advisor_outro_i18n: I18nText = Field(default_factory=dict)
    advisor_outro_audio_media_id: uuid.UUID | None = None
    #: URL đoạn ghi âm, dựng sẵn để giao diện không phải tra bảng media.
    advisor_outro_audio_url: str | None = None
    #: Đoạn chữ mở sẵn cạnh trình phát. Mặc định `True` — ngược với câu hỏi
    #: nghe, và có lý do; xem `Stage.advisor_outro_show_transcript`.
    advisor_outro_show_transcript: bool = True
    cluebook_title_i18n: I18nText = Field(default_factory=dict)
    cluebook_i18n: I18nText = Field(default_factory=dict)
    #: Bố cục hội thoại ĐÃ ĐẶT RIÊNG. `None` = đang kế thừa màn đầu của world,
    #: và trình thiết kế đọc chính cái `None` đó để biết có nên hiện nút gỡ.
    dialogue_json: dict[str, Any] | None = None
    #: Bố cục THẬT SỰ dùng — đã giải xong chuỗi kế thừa. Giao diện vẽ theo cái
    #: này; ô chỉnh thì đọc `dialogue_json` để biết đâu là của riêng màn.
    dialogue_effective: dict[str, Any] = Field(default_factory=dict)
    #: URL ảnh nền từng khối hội thoại, dựng sẵn theo `media_id` bên trong —
    #: cùng nếp với `audio_urls`. Khối lưu id chứ không lưu URL, mà trình thiết
    #: kế thì phải vẽ ra được ngay.
    dialogue_urls: dict[str, str] = Field(default_factory=dict)
    #: Vùng đi được. `None` = chưa vẽ, tức CẢ BẢN ĐỒ đi được.
    collision: CollisionMap | None = None
    #: Âm thanh. Object rỗng = màn không có tiếng nào.
    audio: dict[str, AudioTrack] = Field(default_factory=dict)
    #: URL từng khối tiếng, dựng sẵn theo `media_id` bên trong `audio` — giao
    #: diện không phải tra bảng media. Cùng nếp với `lobby_urls`.
    audio_urls: dict[str, str] = Field(default_factory=dict)
    #: Tên file gốc của từng khối — xem `GalaxyOut.audio_names`.
    audio_names: dict[str, str] = Field(default_factory=dict)
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

    #: Mã nhiệm vụ trong sheet Questions, ví dụ `W1-S1-Quest-01`. Trình nhập
    #: khẩu dựa vào đây để lắp câu hỏi vào đúng nhiệm vụ.
    quest_code: ContentCode = None
    order_index: int = Field(ge=1, le=99)
    quest_object_key: str = Field(min_length=1, max_length=64)
    name_i18n: I18nText = Field(default_factory=dict)
    phase: Literal["advisor", "main"] = "main"
    scene_x: int | None = None
    scene_y: int | None = None
    #: Bán kính phạm vi kích hoạt. None = mặc định của cảnh.
    trigger_radius: int | None = Field(default=None, ge=20, le=1200)
    icon_media_id: uuid.UUID | None = None
    #: NGƯỜI CANH GIỮ nhiệm vụ — một `character` với `kind = 'npc'`, không phải
    #: một tấm ảnh. `null` trong PATCH = GỠ khỏi nhiệm vụ.
    npc_character_id: uuid.UUID | None = None
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
    #: Mã nhiệm vụ trong sheet Questions, ví dụ `W1-S1-Quest-01`. Trình nhập
    #: khẩu dựa vào đây để lắp câu hỏi vào đúng nhiệm vụ.
    quest_code: ContentCode = None
    order_index: int | None = Field(default=None, ge=1, le=99)
    quest_object_key: str | None = Field(default=None, min_length=1, max_length=64)
    name_i18n: I18nText | None = None
    phase: Literal["advisor", "main"] | None = None
    scene_x: int | None = None
    scene_y: int | None = None
    trigger_radius: int | None = Field(default=None, ge=20, le=1200)
    icon_media_id: uuid.UUID | None = None
    #: NGƯỜI CANH GIỮ nhiệm vụ — một `character` với `kind = 'npc'`, không phải
    #: một tấm ảnh. `null` trong PATCH = GỠ khỏi nhiệm vụ.
    npc_character_id: uuid.UUID | None = None
    #: CÂU KHOÁ — người gác cửa nói gì khi học sinh tới nhiệm vụ chưa mở.
    #: `{}` = dùng câu tự sinh trong `messages/`.
    locked_message_i18n: I18nText | None = None
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

    #: MÃ trong file nội dung của chính câu hỏi này.
    #:
    #: Đi kèm ra đây để bộ chọn câu hỏi biết nhiệm vụ này TRƯỚC ĐÂY lấy câu từ
    #: đâu, rồi mở sẵn đúng chỗ đó. Không có nó thì lần nào mở bộ chọn cũng là
    #: cả kho, và người dựng phải tự lọc lại từ đầu.
    #:
    #: Không suy được từ `quests.quest_code`: cột kia là mã người dựng ĐẶT cho
    #: nhiệm vụ, thường vẫn trống, còn cái này là mã câu hỏi THẬT SỰ mang.
    stage_code: str | None = None
    quest_code: str | None = None


class QuestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    stage_id: uuid.UUID
    quest_code: str | None = None
    order_index: int
    phase: Literal["advisor", "main"]
    quest_object_key: str
    name_i18n: I18nText
    scene_x: int | None
    scene_y: int | None
    trigger_radius: int | None
    icon_media_id: uuid.UUID | None
    npc_character_id: uuid.UUID | None = None
    locked_message_i18n: I18nText = Field(default_factory=dict)
    icon_size: int | None
    #: Nhịp thở của ảnh. `null` = mặc định của cảnh, `0` = tắt hẳn.
    pulse_percent: int | None
    pulse_period_ms: int | None
    #: URL ảnh, dựng sẵn để giao diện không phải tra bảng media.
    icon_url: str | None = None
    #: Tên và ảnh đại diện của người canh giữ, dựng sẵn để danh sách nhiệm vụ
    #: hiện được ai đang đứng ở đó mà không phải tra thêm.
    npc_name_i18n: I18nText = Field(default_factory=dict)
    npc_avatar_url: str | None = None
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

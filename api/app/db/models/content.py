"""Cây nội dung: Vũ trụ → Thiên hà → Hành tinh → Chương → Màn chơi → Nhiệm vụ.

Xem docs/GAME_DOMAIN.md §2 và §3.1.

Hai luật hình thành nên các bảng ở đây:

  - **Nhiệm vụ LÀ câu hỏi.** `quests` là bảng nối trỏ tới `questions`, đúng khuôn
    `exam_questions` của LMS. Không có bảng `game_questions` riêng.
  - **Màn chơi KHÔNG phải đề thi.** `stages` là bảng riêng vì nó mang một tập
    thuộc tính mà đề thi không bao giờ có: mảnh bản đồ, năng lượng đội, NPC cố
    vấn, toạ độ vật thể trong cảnh, điểm chiến lực yêu cầu.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    text,
    true,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, TranslatableText, UUIDPrimaryKeyMixin


class PublishStatus:
    """Trạng thái xuất bản, dùng chung cho mọi tầng của cây nội dung.

    `draft` chỉ giáo viên và admin nhìn thấy; học sinh chỉ thấy `published`.
    Cưỡng chế ở đúng một chỗ: `visible_worlds()` — xem ARCHITECTURE.md §7.
    """

    DRAFT = "draft"
    PUBLISHED = "published"

    ALL = (DRAFT, PUBLISHED)


class Difficulty:
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"

    ALL = (EASY, MEDIUM, HARD)


class QuestPhase:
    """Giai đoạn của nhiệm vụ trong màn chơi.

    Gộp cả hội thoại NPC lẫn nhiệm vụ chính vào MỘT bảng: chuỗi câu hỏi giao
    tiếp với NPC cố vấn bản chất cũng là `MCQ_SINGLE`, nên không cần bảng
    `advisor_steps` riêng và giáo viên soạn chúng bằng cùng một trình soạn.
    """

    ADVISOR = "advisor"  # giai đoạn 1: gặp NPC để lấy bí quyết/mật khẩu
    MAIN = "main"  # giai đoạn 2: vận dụng bí quyết để giải vật thể nhiệm vụ

    ALL = (ADVISOR, MAIN)


#: Khoá vật thể của nhiệm vụ NPC được tạo tự động cùng màn chơi.
#:
#: Là hằng số chứ không phải chữ rải rác: migration, `create_stage` và cảnh
#: Phaser đều phải gọi đúng một cái tên, và gõ lệch một chữ thì màn chơi có hai
#: nhiệm vụ NPC hoặc không có cái nào.
QUEST_OBJECT_NPC = "npc"


_STATUS_CHECK = "status IN ('draft', 'published')"


class Universe(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "universes"
    __table_args__ = (CheckConstraint(_STATUS_CHECK, name="status_valid"),)

    name_i18n: Mapped[dict[str, str]] = mapped_column(TranslatableText, nullable=False)
    description_i18n: Mapped[dict[str, str]] = mapped_column(
        TranslatableText, default=dict, nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default=PublishStatus.DRAFT, nullable=False)


class Galaxy(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "galaxies"
    __table_args__ = (CheckConstraint(_STATUS_CHECK, name="status_valid"),)

    universe_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("universes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name_i18n: Mapped[dict[str, str]] = mapped_column(TranslatableText, nullable=False)
    description_i18n: Mapped[dict[str, str]] = mapped_column(
        TranslatableText, default=dict, nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default=PublishStatus.DRAFT, nullable=False)

    #: Ảnh nền và nhạc nền của màn CHỌN WORLD. Thuộc về thiên hà chứ không phải
    #: từng world: đây là cái nền mà mọi world trong thiên hà nằm lên trên.
    background_media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    #: ÂM THANH của màn chọn world. CÙNG hình dạng với `stages.audio_json`.
    #:
    #: Thay cho `music_media_id` cũ — một cột chỉ chứa ID file, không có âm
    #: lượng, không có tốc độ, không có cờ lặp. Hai cách lưu cùng một thứ sẽ
    #: lệch nhau đúng vào lúc ai đó sửa một bên, nên nhạc thiên hà giờ đi chung
    #: một hình dạng, một bảng điều khiển, một hàm quy đổi với mọi màn khác.
    audio_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    #: KHUNG TIÊU ĐỀ và KHUNG MÔ TẢ — hai tấm ảnh trang trí nằm trên bản đồ.
    #:
    #: Mặc định chúng mang tên và mô tả của chính thiên hà; rê chuột vào một
    #: world thì đổi sang tên và mô tả của world đó. Nội dung là của world, còn
    #: cái khung là của thiên hà — vẽ lại một bộ khung cho từng world nghĩa là
    #: bản đồ nhấp nháy đổi hình mỗi lần con trỏ đi ngang.
    #:
    #: Toạ độ và bề rộng theo hệ 3200×1800, chiều cao suy ra theo tỉ lệ gốc của
    #: ảnh — cùng luật với `worlds.icon_size`. NULL = chưa đặt, giao diện dùng
    #: chỗ mặc định (giữa, phía dưới).
    #: `*_color` là mã màu `#rrggbb`, `*_font` là PHẦN TRĂM so với cỡ chữ mặc
    #: định (100 = giữ nguyên). Cỡ chữ thật tính theo bề rộng CỦA KHUNG, nên
    #: lưu một con số pixel ở đây sẽ sai ngay khi ai đó kéo cái khung to ra.
    #:
    #: Chữ trong khung là của thiên hà lúc nghỉ, của world khi rê chuột — CÙNG
    #: một chỗ hiện ra thì cùng một cách cấu hình. Đặt màu riêng cho từng world
    #: nghĩa là rê qua ba world là chữ đổi màu ba lần.
    title_media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    title_x: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title_y: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title_width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    #: Chiều cao riêng. NULL = suy ra theo tỉ lệ gốc của ảnh.
    title_height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title_color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    title_font: Mapped[int | None] = mapped_column(Integer, nullable=True)

    desc_media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    desc_x: Mapped[int | None] = mapped_column(Integer, nullable=True)
    desc_y: Mapped[int | None] = mapped_column(Integer, nullable=True)
    desc_width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    desc_height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    desc_color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    desc_font: Mapped[int | None] = mapped_column(Integer, nullable=True)


class World(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Hành tinh — đơn vị BÁN, và đơn vị tính Điểm chiến lực."""

    __tablename__ = "worlds"
    __table_args__ = (
        CheckConstraint(_STATUS_CHECK, name="status_valid"),
        CheckConstraint("difficulty IN ('easy', 'medium', 'hard')", name="difficulty_valid"),
        CheckConstraint("shard_total > 0", name="shard_total_positive"),
        CheckConstraint("icon_size IS NULL OR icon_size > 0", name="icon_size_positive"),
        CheckConstraint(
            "pulse_percent IS NULL OR (pulse_percent >= 0 AND pulse_percent <= 50)",
            name="pulse_percent_range",
        ),
        CheckConstraint(
            "pulse_period_ms IS NULL OR (pulse_period_ms >= 400 AND pulse_period_ms <= 4000)",
            name="pulse_period_range",
        ),
    )

    galaxy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("galaxies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name_i18n: Mapped[dict[str, str]] = mapped_column(TranslatableText, nullable=False)
    story_i18n: Mapped[dict[str, str]] = mapped_column(
        TranslatableText, default=dict, nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    cover_media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )

    difficulty: Mapped[str] = mapped_column(String(16), default=Difficulty.EASY, nullable=False)

    #: Nhãn CẤP ĐỘ hiện ở phòng chờ: "Easy", "Hard", "C2", "3"…
    #:
    #: Tách khỏi `difficulty` chứ không dùng lại nó: `difficulty` là ba giá trị
    #: CỐ ĐỊNH mà cả hệ thống dựa vào để lọc và xếp world, còn cái này là chữ
    #: người dựng tự gõ và chỉ để HIỆN. Nhét "C2" vào `difficulty` là phá cái
    #: ràng buộc đang giữ cho phép lọc chạy đúng.
    #:
    #: Rỗng thì phòng chờ hiện nhãn của `difficulty` — world mới không phải là
    #: một ô trống.
    level_i18n: Mapped[dict[str, str]] = mapped_column(
        TranslatableText, default=dict, nullable=False
    )

    age_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    age_max: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Numeric chứ không phải Float: tiền mà tính bằng dấu phẩy động thì sớm muộn
    # cũng ra 99.99999. Chưa bán ở giai đoạn này nhưng cột sai kiểu thì sửa đắt.
    price_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    price_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)

    #: Số mảnh bản đồ cần gom để mở Cánh cổng Thời gian. Atlantis = 30.
    shard_total: Mapped[int] = mapped_column(Integer, default=30, nullable=False)

    #: World phải hoàn thành trước mới mở world này. NULL = mở sẵn.
    unlock_requires_world_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("worlds.id", ondelete="SET NULL"), nullable=True
    )

    #: Vị trí trên bản đồ thiên hà, theo hệ toạ độ 3200×1800 — CÙNG hệ với
    #: cảnh chơi. NULL = chưa đặt; màn chọn world sẽ tự rải đều.
    scene_x: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scene_y: Mapped[int | None] = mapped_column(Integer, nullable=True)

    #: Đường kính vòng tròn world trên bản đồ, theo pixel hệ toạ độ trên.
    #: Vòng tròn này VỪA là khung ảnh (ảnh bị cắt lọt trong đó), VỪA là thanh
    #: tiến độ: vành ngoài đầy dần theo số mảnh bản đồ đã gom.
    icon_size: Mapped[int | None] = mapped_column(Integer, nullable=True)

    #: Vẽ vành tròn quanh world hay không. Vành này vừa là khung bao, vừa là
    #: thanh tiến độ — đầy dần theo số mảnh bản đồ người chơi đã gom.
    #:
    #: MẶC ĐỊNH TẮT. Bật sẵn một thứ trang trí cho mọi người rồi bắt họ đi tìm
    #: chỗ tắt là làm ngược; ai muốn thì bật.
    show_ring: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    #: Nhịp thở của vòng tròn — cùng ý nghĩa và cùng khoảng giá trị với
    #: `quests.pulse_*`. NULL = mặc định, 0 = tắt.
    pulse_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pulse_period_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    #: Học sinh chưa vào được world này. Cột RIÊNG, không suy ra từ số màn đã
    #: xuất bản: giáo viên phải khoá được một world đã có nội dung (đang sửa
    #: dở, để dành cho học kỳ sau), và điều đó thì không suy ra từ đâu được.
    #: World mới tạo mặc định KHOÁ — lúc đó nó chưa có chương hay màn nào.
    is_locked: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # ---------------------------------------------------------------- phòng chờ
    #
    # Màn hình học sinh nhìn thấy khi bấm vào world này. Cùng bộ thiết lập với
    # bản đồ thiên hà — ảnh nền, khung tiêu đề, khung mô tả — nhưng riêng cho
    # từng world.
    #
    # MỌI CỘT ĐỀU NULLABLE, và NULL nghĩa là **thừa của thiên hà**. Nhờ vậy một
    # world vừa tạo đã có sẵn giao diện đúng tông với cả bản đồ, còn giáo viên
    # chỉ phải động vào những chỗ họ thực sự muốn khác. Chép sẵn giá trị của
    # thiên hà xuống lúc tạo thì đổi nền thiên hà sau này không lan xuống được
    # world nào nữa.
    #: MA DINH DANH do bo phan noi dung dat, khop cot `world_code` trong file .xlsx.
    #:
    #: Day la thu duy nhat noi mot dong trong bang tinh voi ban ghi nay. NULL
    #: duoc: world dung tay khong bat buoc phai co ma. Duy nhat khi khac NULL - xem migration 0030.
    world_code: Mapped[str | None] = mapped_column(String(64), nullable=True)

    lobby_media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )

    title_media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    title_x: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title_y: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title_width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    #: Chiều cao riêng. NULL = suy ra theo tỉ lệ gốc của ảnh.
    title_height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title_color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    title_font: Mapped[int | None] = mapped_column(Integer, nullable=True)

    desc_media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    desc_x: Mapped[int | None] = mapped_column(Integer, nullable=True)
    desc_y: Mapped[int | None] = mapped_column(Integer, nullable=True)
    desc_width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    desc_height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    desc_color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    desc_font: Mapped[int | None] = mapped_column(Integer, nullable=True)

    #: Bố cục phòng chờ: mọi khối kéo thả được, trong MỘT cột.
    #:
    #:     {"stats": {"x": 300, "y": 900, "w": 520, "media_id": "..."}, ...}
    #:
    #: Sáu khối (thành tích, xếp hạng, hàng chương, ba nút) × bốn thuộc tính =
    #: 24 cột nếu làm bằng cột riêng. Thêm khối mới sau này chỉ cần thêm một
    #: khoá trong sổ đăng ký ở frontend, không cần migration.
    #:
    #: Đổi lại là database không kiểm được giá trị bên trong, nên Pydantic phải
    #: kiểm — xem `LobbyElement`. Khoá thiếu thì giao diện dùng mặc định của sổ
    #: đăng ký, y như `null` ở các cột kia.
    lobby_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    #: ÂM THANH của phòng chờ world. CÙNG hình dạng với `stages.audio_json`.
    #:
    #: Object rỗng = phòng chờ im lặng, và nó KHÔNG kế thừa nhạc của thiên hà:
    #: hai màn hình này người chơi đi qua liên tiếp nhau, và một bản nhạc chạy
    #: tiếp qua ranh giới đó thì không nói được là mình đã sang chỗ khác. Muốn
    #: giống nhau thì tải cùng một file lên cả hai — một cú bấm, và nó nhìn
    #: thấy được.
    audio_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    #: TOÀN BỘ hằng số cân bằng game. Xem docs/GAME_DOMAIN.md §6.
    #: Đây là chỗ luật "không hardcode giá trị cân bằng" được thực thi: chỉnh
    #: độ khó là việc của người vận hành, không cần lập trình viên, không deploy lại.
    balance_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    #: LỜI PHÁN của người canh giữ — ba danh sách câu, dùng chung cả world.
    #:
    #: `{"praise": [...], "wrong": [...], "moveOn": [...]}`. Rỗng = dùng bộ mặc
    #: định trong `messages/`, tức mọi world đang chạy hôm nay không đổi gì.
    #:
    #: Ở WORLD chứ không ở từng câu hỏi: đây là giọng điệu của cả thế giới ấy,
    #: không phải phản hồi cho một bài cụ thể. Câu chê riêng cho một bài thì đã
    #: có `content_json.wrong_answer_message`.
    verdict_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb"), nullable=False
    )

    status: Mapped[str] = mapped_column(String(16), default=PublishStatus.DRAFT, nullable=False)

    def __repr__(self) -> str:
        return f"<World {self.name_i18n.get('vi', '?')}>"


class Chapter(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "chapters"
    __table_args__ = (
        # Hai chương cùng số thứ tự trong một world là lỗi dữ liệu, không phải
        # chuyện phải xử lý lúc hiển thị.
        UniqueConstraint("world_id", "order_index", name="uq_chapters_world_order"),
    )

    world_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("worlds.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    name_i18n: Mapped[dict[str, str]] = mapped_column(TranslatableText, nullable=False)

    #: Ảnh của chương, hiện ở hàng chương trong phòng chờ world. Chưa có thì
    #: giao diện vẽ một khung trống mang tên chương — hàng chương phải đọc được
    #: ngay cả khi chưa ai kịp vẽ ảnh.
    cover_media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )

    #: Ảnh nền của MINIMAP — cái bảng mở ra khi học sinh bấm vào chương ở phòng
    #: chờ, bên trong là danh sách màn chơi.
    #:
    #: Cột riêng, không dùng lại `cover_media_id`: hai ảnh phục vụ hai chỗ có
    #: khuôn hình khác hẳn nhau. `cover` là một ô nhỏ trên hàng chương; minimap
    #: là cả cái nền trải rộng phía sau danh sách màn. Dùng chung một ảnh thì
    #: hoặc ô nhỏ bị méo, hoặc cái nền bị vỡ hạt.
    minimap_media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )

    synopsis_i18n: Mapped[dict[str, str]] = mapped_column(
        TranslatableText, default=dict, nullable=False
    )


class Stage(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Màn chơi — đơn vị CHƠI, trao đúng 1 Mảnh bản đồ."""

    __tablename__ = "stages"
    __table_args__ = (
        UniqueConstraint("chapter_id", "order_index", name="uq_stages_chapter_order"),
        CheckConstraint(_STATUS_CHECK, name="status_valid"),
        CheckConstraint("min_players >= 1", name="min_players_positive"),
        CheckConstraint("max_players >= min_players", name="max_players_gte_min"),
        CheckConstraint("time_limit_seconds > 0", name="time_limit_positive"),
        CheckConstraint("energy_per_player >= 0", name="energy_per_player_non_negative"),
        CheckConstraint(
            "character_height IS NULL OR character_height > 0",
            name="character_height_positive",
        ),
        CheckConstraint("map_shard_index >= 1", name="shard_index_positive"),
    )

    chapter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    name_i18n: Mapped[dict[str, str]] = mapped_column(TranslatableText, nullable=False)
    synopsis_i18n: Mapped[dict[str, str]] = mapped_column(
        TranslatableText, default=dict, nullable=False
    )

    #: Khoá cảnh Phaser: "ship_deck_01". `web/src/game/` tra khoá này ra scene.
    scene_key: Mapped[str] = mapped_column(String(64), nullable=False)

    #: Chiều CAO của nhân vật trong cảnh, theo hệ toạ độ thế giới 3200×1800.
    #:
    #: Cao chứ không rộng: mỗi nhân vật một khổ spritesheet khác nhau, nhưng thứ
    #: người chơi so sánh là "cao bằng chừng nào so với vật thể quanh mình". Ghim
    #: bề rộng thì nhân vật gầy cao vống lên còn nhân vật mập thì lùn tịt.
    #:
    #: `NULL` = KẾ THỪA từ màn đầu tiên của world — xem
    #: `effective_character_height()`. Kế thừa chứ không sao chép: người dựng căn
    #: nhân vật ở màn 1 một lần rồi 29 màn còn lại theo luôn, và sửa lại màn 1
    #: sau đó vẫn lan xuống. Sao chép giá trị xuống từng màn lúc tạo thì mất đúng
    #: cái đó.
    character_height: Mapped[int | None] = mapped_column(Integer, nullable=True)

    #: CHỖ XUẤT PHÁT của nhân vật trong màn này, hệ toạ độ thế giới 3200×1800.
    #:
    #: Là ĐIỂM VA CHẠM — cùng thứ `canWalk()` xét, tức cao hơn gót chân
    #: `HERO_FOOT_Y` — chứ không phải tâm tấm ảnh. Cùng hệ quy chiếu với
    #: `stage_run_players.pos_x/pos_y`, nên `StageScene` đọc hai nguồn đó bằng
    #: đúng một phép toán.
    #:
    #: `NULL` = chỗ mặc định của cảnh (`DEFAULT_SPAWN` bên
    #: `web/src/game/world.ts`). Không điền sẵn một cặp số: "chưa đặt" và "đặt
    #: đúng vào chỗ mặc định" là hai chuyện khác nhau, và trình thiết kế cần
    #: phân biệt để biết có nên hiện nút gỡ hay không — cùng nếp với
    #: `character_height`.
    #:
    #: Không kèm ràng buộc khoảng: cùng nếp với `quests.scene_x/scene_y`, và
    #: hệ toạ độ thế giới là hằng số của phía giao diện chứ không của database.
    #: Cảnh chơi vẫn cứu hộ về ô đi được gần nhất (`rescueToWalkable`), nên một
    #: chỗ nằm ngoài vùng đi được là chuyện cảnh biết xử lý.
    spawn_x: Mapped[int | None] = mapped_column(Integer, nullable=True)
    spawn_y: Mapped[int | None] = mapped_column(Integer, nullable=True)

    #: MA DINH DANH do bo phan noi dung dat, khop cot `stage_code` trong file .xlsx.
    #:
    #: Day la thu duy nhat noi mot dong trong bang tinh voi ban ghi nay. NULL
    #: duoc: man dung tay khong bat buoc phai co ma. Duy nhat khi khac NULL - xem migration 0030.
    stage_code: Mapped[str | None] = mapped_column(String(64), nullable=True)

    background_media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )

    #: VIDEO MỞ MÀN — tấm màn che đúng lúc màn chơi đang nạp.
    #:
    #: `NULL` = vào thẳng, y như trước khi có cột này. Đó là mặc định, và phải
    #: là mặc định: màn đã dựng không được tự dưng mọc thêm một bước bấm.
    #:
    #: Không phải một tính năng kể chuyện gắn thêm. Gói Phaser gần một megabyte,
    #: ảnh nền có khi là video, spritesheet bốn hướng — khoảng chờ đó có thật và
    #: không bỏ đi được. Thứ bỏ đi được là cái màn hình trống trong lúc chờ, nên
    #: video chạy Ở TRÊN còn cảnh dựng Ở DƯỚI, và cửa mở khi cả hai xong.
    #:
    #: KHÔNG vào `snapshot_json`: nó chạy trước khi lượt chơi tồn tại, nên phải
    #: đọc được trước cả cái request tạo ra snapshot. Xem GAME_DOMAIN §3e.
    intro_video_media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )

    time_limit_seconds: Mapped[int] = mapped_column(Integer, default=300, nullable=False)
    #: Năng lượng cấp cho MỖI người chơi, sau khi chính họ qua được nhiệm vụ NPC.
    #:
    #: Của từng người, không phải một quỹ chung: bài làm của một người không được
    #: rút cạn tài nguyên của đồng đội. Xem `PROJECT OVERVIEW.md` mục Hệ thống điểm.
    #:
    #: Cấp SAU khi qua NPC chứ không phải lúc vào màn — NPC là cổng vào của màn,
    #: và cấp trước thì người chơi tiêu hết vào các hành động trợ giúp ngay ở cửa
    #: rồi bước vào phần chính với hai bàn tay trắng, mà phần chính mới là chỗ
    #: cần trợ giúp.
    #:
    #: 0 là hợp lệ và có nghĩa: "màn này không có trợ giúp".
    #:
    #: Mặc định 10, tức NĂM lần xin gợi ý cho cả màn (mỗi lần 2). Con số nhỏ có
    #: chủ ý: gợi ý phải là thứ người chơi cân nhắc, không phải thứ bấm bừa.
    energy_per_player: Mapped[int] = mapped_column(Integer, default=10, nullable=False)

    #: Điểm chiến lực cần có để mở màn này. NULL = suy ra từ
    #: `balance_json.skillPtsStep × (order − 1)`. Đặt số cụ thể để ghi đè.
    required_skill_pts: Mapped[int | None] = mapped_column(Integer, nullable=True)
    #: Trần điểm chiến lực nhận được trong một lượt chơi màn này.
    skill_pts_max: Mapped[int] = mapped_column(Integer, default=80, nullable=False)

    #: Số SAO tối đa màn này trao. Tổng sao của world = tổng cột này.
    star_max: Mapped[int] = mapped_column(Integer, default=3, nullable=False)

    #: Ngưỡng điểm để nhận từng ngôi sao, tính bằng PHẦN TRĂM điểm tối đa của
    #: màn — `[40, 70, 90]` nghĩa là đạt 40% được một sao, 70% hai sao, 90% ba.
    #:
    #: Phần trăm chứ không phải điểm tuyệt đối: người dựng thêm một câu hỏi là
    #: điểm tối đa đổi, mà ngưỡng tuyệt đối thì đứng yên và bỗng dưng dễ đi.
    #:
    #: Danh sách rỗng = chưa đặt, và lúc đó không trao sao nào. Chỗ TÍNH ra sao
    #: chưa có; cột này để người dựng đặt trước, phần chấm hoàn thiện sau.
    star_score_pcts: Mapped[list[int]] = mapped_column(JSONB, default=list, nullable=False)

    #: Mảnh bản đồ số mấy trong bộ của world (1..shard_total).
    map_shard_index: Mapped[int] = mapped_column(Integer, nullable=False)

    min_players: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    max_players: Mapped[int] = mapped_column(Integer, default=4, nullable=False)

    advisor_npc_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    advisor_portrait_media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    #: Lời NPC nói lúc TRAO sổ tay — bước cuối của chuỗi hội thoại, bước không
    #: hỏi gì cả. Hiện trên màn Claim, ngay trước nút nhận.
    #:
    #: Cột riêng chứ không nhét vào `cluebook_i18n`: đây là lời NPC nói MỘT LẦN
    #: lúc trao, còn sổ tay là thứ người chơi mở ra đọc lại suốt màn. Gộp làm một
    #: thì mỗi lần mở sổ tay lại phải đọc lại câu chia tay của thuyền trưởng.
    advisor_outro_i18n: Mapped[dict[str, str]] = mapped_column(
        TranslatableText, default=dict, nullable=False
    )
    #: Đoạn ghi âm NPC nói lời chia tay. `NULL` = chỉ có chữ.
    #:
    #: Tự phát khi bảng hiện ra, đúng cơ chế của câu hỏi nghe (§3c) và dùng
    #: chung đúng một component vẽ.
    advisor_outro_audio_media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    #: Đoạn chữ MỞ SẴN cạnh trình phát. Mặc định `True` — NGƯỢC với
    #: `questions.show_transcript`, và sự khác nhau đó có lý do:
    #:
    #: Câu hỏi nghe giấu chữ vì đọc được đề thì bài nghe không còn đo gì nữa —
    #: chữ ở đó là đáp án của chính bài tập. Lời NPC thì không phải bài tập: nó
    #: là một nhân vật đang nói, và vừa nghe vừa đọc theo là cách học từ mới
    #: nhanh nhất. Xem migration 0033.
    advisor_outro_show_transcript: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true(), nullable=False
    )
    #: Tên sổ tay: "📜 CAPTAIN DRAKE'S SECRET HANDBOOK". Hiện ở đầu bảng sổ tay.
    cluebook_title_i18n: Mapped[dict[str, str]] = mapped_column(
        TranslatableText, default=dict, nullable=False
    )
    #: Sổ tay bí quyết NPC trao sau khi xong giai đoạn hội thoại.
    cluebook_i18n: Mapped[dict[str, str]] = mapped_column(
        TranslatableText, default=dict, nullable=False
    )

    #: VÙNG ĐI ĐƯỢC — bản đồ va chạm do giáo viên vẽ trong trình thiết kế.
    #:
    #: `NULL` = chưa vẽ, và có nghĩa là **cả bản đồ đi được** — đúng y hệt hành
    #: vi trước khi có cột này. Nhờ vậy mọi màn đã dựng không đổi một chút nào.
    #:
    #: Hình dạng dữ liệu (xem `web/src/game/collision.ts` — đó là bản mô tả
    #: chính, cả hai đầu đọc chung một luật):
    #:
    #:     { "version": 1,
    #:       "default": "blocked",              // ngoài MỌI hình
    #:       "shapes": [ { "id", "mode", "kind", ... } ] }
    #:
    #: **Hình khớp CUỐI CÙNG thắng.** Một câu, và nhờ nó mà ghép được các vùng
    #: lồng nhau mà không cần phép toán tập hợp: lối đi quanh một cái hồ là một
    #: oval `allow` rộng, rồi một oval `block` nhỏ đặt đè lên trên.
    #:
    #: `none_as_null=True` chứ không để mặc định: mặc định của SQLAlchemy biến
    #: `None` của Python thành JSON `null` — một GIÁ TRỊ nằm trong ô, không phải
    #: một ô rỗng. Đọc thì vẫn ra `None` nên không ai thấy gì, cho tới ngày có
    #: người viết `WHERE collision_json IS NULL` và câu đó trả về sai.
    collision_json: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB(none_as_null=True), nullable=True
    )

    #: BỐ CỤC MÀN HỘI THOẠI — sáu khối do giáo viên kéo thả (§S5b).
    #:
    #: Cùng hình dạng với `worlds.lobby_json`, và cố ý thế: khối có `x/y/w/h`,
    #: `media_id` làm ảnh nền, và một `content` là khung chữ bên trong với toạ
    #: độ tính bằng PHẦN TRĂM CỦA KHỐI. Xem `LobbySaved` bên
    #: `web/src/game/world.ts` — đó là bản mô tả chính, cả hai đầu đọc chung.
    #:
    #: Sáu khối: `npcAvatar`, `npcBubble`, `playerBubble`, `npcVerdict`,
    #: `playerAvatar`, `answerBox`.
    #:
    #: `NULL` = KẾ THỪA bố cục của màn ĐẦU TIÊN trong world, đúng nếp
    #: `character_height`. Kế thừa chứ không sao chép: người dựng căn một lần ở
    #: màn 1 rồi cả world theo, và sửa lại màn 1 sau đó vẫn lan xuống.
    #:
    #: Bố cục ở MÀN chứ không ở nhiệm vụ vì một màn có một bộ mặt. Năm nhiệm vụ
    #: nhân ba mươi màn là 150 lần căn tay cho một world — sẽ không ai làm hết,
    #: và world sẽ có 150 màn hội thoại lệch nhau.
    #:
    #: `none_as_null=True` vì `NULL` ở đây MANG NGHĨA — xem ghi chú ở
    #: `collision_json`.
    dialogue_json: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB(none_as_null=True), nullable=True
    )

    #: ÂM THANH của màn — nhạc nền, tiếng đi, tiếng đứng.
    #:
    #: Object RỖNG = màn không có tiếng nào, và đó là mặc định đúng: một màn tự
    #: bật nhạc mà người dựng không chủ động chọn là thứ cả lớp phải chịu cùng lúc.
    #:
    #: Một cột JSONB chứ không phải mười hai cột riêng, cùng khuôn với
    #: `worlds.lobby_json`: thêm một khối tiếng mới là thêm MỘT DÒNG trong sổ
    #: đăng ký `AUDIO_SLOTS` ở `web/src/game/audio.ts` — không migration, không
    #: sửa trình thiết kế, không sửa cảnh chơi.
    #:
    #:     { "ambient": { "media_id", "volume", "rate", "loop" },
    #:       "walk":    { ... },
    #:       "idle":    { ... } }
    #:
    #: `volume` và `rate` tính bằng PHẦN TRĂM — xem `resolveAudio()`.
    audio_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    status: Mapped[str] = mapped_column(String(16), default=PublishStatus.DRAFT, nullable=False)

    #: KHOÁ TAY: màn đã dựng xong, đã phát hành, nhưng người dựng chủ động giữ
    #: kín cho tới một thời điểm nào đó.
    #:
    #: Khác `status`: bản NHÁP là "chưa xong, học sinh không được thấy"; khoá
    #: tay là "xong rồi, thấy được, nhưng chưa tới lúc vào". Trên minimap nó
    #: hiện y như một màn chưa đủ điểm — có cửa, và cửa đang đóng. Giấu hẳn thì
    #: lớp không biết là còn có gì phía trước, và bản đồ thủng một lỗ.
    #:
    #: Khác `required_skill_pts`: điểm chiến lực là luật CHƠI — cứ đủ là mở, tự
    #: học sinh mở lấy. Cột này là quyết định của GIÁO VIÊN, và không có cách nào
    #: chơi cho nó mở ra.
    #:
    #: Mặc định `False`: mọi màn đang có vẫn mở đúng như trước khi có cột này.
    is_locked: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )

    def __repr__(self) -> str:
        return f"<Stage #{self.order_index} {self.name_i18n.get('vi', '?')}>"


#: Điểm mặc định của một câu hỏi khi lắp vào nhiệm vụ.
DEFAULT_QUESTION_POINTS = 10


class Quest(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Nhiệm vụ — một vật thể trong cảnh, mang **nhiều** câu hỏi.

    Bấm vào cột buồm không nhất thiết chỉ hỏi một câu. Chuỗi hội thoại với NPC
    (chào hỏi → giới thiệu → nói mục đích) cũng là nhiều câu trong CÙNG một
    nhiệm vụ `npc`. Xem docs/GAME_DOMAIN.md §1.5b.

    Câu hỏi nằm ở bảng nối `quest_questions`, không nằm ở đây.
    """

    __tablename__ = "quests"
    __table_args__ = (
        UniqueConstraint("stage_id", "order_index", name="uq_quests_stage_order"),
        # Một vật thể trong cảnh chỉ mang một nhiệm vụ.
        UniqueConstraint("stage_id", "quest_object_key", name="uq_quests_stage_object"),
        CheckConstraint("phase IN ('advisor', 'main')", name="phase_valid"),
        # ĐÚNG MỘT nhiệm vụ NPC cho mỗi màn. Chỉ số một phần (`WHERE`) chứ không
        # phải UNIQUE thường: các nhiệm vụ `main` thì bao nhiêu cái cũng được.
        #
        # Ràng buộc ở database chứ không chỉ ở tầng ứng dụng, vì cả cổng mở khoá
        # lẫn luật "ai cũng hoàn thành được ít nhất một nhiệm vụ" đều dựa vào
        # việc cái NPC này CÓ và CHỈ CÓ MỘT. Hai cái thì người chơi qua cái nào?
        Index(
            "uq_quests_stage_advisor",
            "stage_id",
            unique=True,
            postgresql_where=text("phase = 'advisor'"),
        ),
        CheckConstraint("energy_cost >= 0", name="energy_cost_non_negative"),
        CheckConstraint("pass_score IS NULL OR pass_score >= 0", name="pass_score_non_negative"),
        CheckConstraint(
            "trigger_radius IS NULL OR trigger_radius > 0", name="trigger_radius_positive"
        ),
        CheckConstraint("icon_size IS NULL OR icon_size > 0", name="icon_size_positive"),
        CheckConstraint(
            "pulse_percent IS NULL OR (pulse_percent >= 0 AND pulse_percent <= 50)",
            name="pulse_percent_range",
        ),
        CheckConstraint(
            "pulse_period_ms IS NULL OR (pulse_period_ms >= 400 AND pulse_period_ms <= 4000)",
            name="pulse_period_range",
        ),
    )

    stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stages.id", ondelete="CASCADE"), nullable=False, index=True
    )

    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    phase: Mapped[str] = mapped_column(String(16), default=QuestPhase.MAIN, nullable=False)

    #: Vật thể trong cảnh: "mast" | "hull" | "buoy" | "chest" | "npc".
    #: Nhiệm vụ NPC bắt buộc dùng khoá `QUEST_OBJECT_NPC`.
    #: Khoá KỸ THUẬT — Phaser dùng để biết gắn nhiệm vụ vào sprite nào.
    #: MA DINH DANH do bo phan noi dung dat, khop cot `quest_code` trong sheet
    #: Questions cua file .xlsx.
    #:
    #: Day la thu ma trinh nhap khau dua vao de biet mot cau hoi thuoc nhiem vu
    #: nao. NULL duoc: nhiem vu dung tay khong bat buoc phai co ma. Duy nhat khi
    #: khac NULL - hai nhiem vu cung ma thi luc nhap khong biet lap vao cai nao.
    quest_code: Mapped[str | None] = mapped_column(String(64), nullable=True)

    quest_object_key: Mapped[str] = mapped_column(String(64), nullable=False)

    #: Tên hiển thị cho người chơi: {"vi": "Cột buồm chính"}.
    #: Rỗng thì giao diện lùi về `quest_object_key` — nhưng đừng để rỗng, vì
    #: học sinh không nên nhìn thấy khoá kỹ thuật của lập trình viên.
    name_i18n: Mapped[dict[str, str]] = mapped_column(
        TranslatableText, default=dict, nullable=False
    )
    #: Toạ độ trong cảnh, theo hệ toạ độ thế giới 3200x1800 của Phaser.
    #: NULL = chưa đặt; cảnh sẽ rải đều theo vòng tròn.
    scene_x: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scene_y: Mapped[int | None] = mapped_column(Integer, nullable=True)

    #: Bán kính phạm vi kích hoạt. Người chơi phải bước vào trong bán kính này
    #: thì bảng câu hỏi mới mở. NULL = lấy mặc định của cảnh.
    trigger_radius: Mapped[int | None] = mapped_column(Integer, nullable=True)

    #: Ảnh của vật thể trong cảnh — ảnh tĩnh hoặc GIF. NULL = vẽ vòng sáng mặc định.
    icon_media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )

    #: Bề rộng ảnh vật thể, theo pixel hệ toạ độ thế giới. Ảnh giữ đúng tỉ lệ
    #: gốc nên chỉ cần một chiều. NULL = kích thước mặc định của cảnh.
    icon_size: Mapped[int | None] = mapped_column(Integer, nullable=True)

    #: NGƯỜI CANH GIỮ nhiệm vụ này — một hàng trong `characters` với
    #: `kind = 'npc'`, không phải một tấm ảnh.
    #:
    #: Vì sao không phải một cột ảnh: người canh giữ cần NHIỀU tư thế — một lúc
    #: đang nói, một lúc đang chờ học sinh trả lời — và tất cả đều là
    #: spritesheet để chạy được hoạt ảnh. Đó đúng là thứ `character_actions` đã
    #: làm từ lâu, với `action_key` là chuỗi tự do.
    #:
    #: Không dùng lại `icon_media_id`: cái đó là VẬT THỂ trong cảnh — cột buồm,
    #: cái hòm — thứ học sinh đi tới và bấm vào. Cái này là NGƯỜI nói chuyện với
    #: họ. Một tấm ảnh không làm tốt cả hai việc.
    #:
    #: NULL = chưa gán ai; hội thoại vẫn chạy với khung avatar trống.
    npc_character_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("characters.id", ondelete="SET NULL"), nullable=True
    )

    #: CÂU KHOÁ — người gác cửa nói gì khi học sinh tới một nhiệm vụ chưa mở.
    #:
    #: RỖNG là trạng thái bình thường, và nghĩa là "dùng câu tự sinh" — cái câu
    #: ghép sẵn trong `messages/` có nhắc tên người gác cửa. Nên world nào chưa
    #: ai soạn thì không đổi một chữ.
    #:
    #: Đặt ở TỪNG NHIỆM VỤ chứ không ở màn: mười cánh cửa cùng nói đúng một câu
    #: thì cánh thứ mười không còn là một nhân vật nói chuyện nữa, nó là một hộp
    #: thoại lỗi. Mỗi cửa một câu mới là lý do có cột này.
    #:
    #: KHÔNG có cột cho tiếng đọc: bản thu nằm ở `voice_lines`, khoá theo
    #: `(giọng, băm nội dung)`. Thêm một cột ở đây là thêm một chỗ thứ hai giữ
    #: cùng một sự thật.
    locked_message_i18n: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb"), nullable=False
    )

    #: Nhịp thở của ảnh: to thêm bao nhiêu PHẦN TRĂM ở đỉnh nhịp.
    #: NULL = mặc định của cảnh. 0 = TẮT hẳn — hai thứ khác nhau, nên cột phải
    #: nullable chứ không thể mặc định 0.
    pulse_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)

    #: Một nhịp thở đầy đủ (to rồi nhỏ), tính bằng mili giây. NULL = mặc định
    #: của cảnh. Sàn 400ms: nhanh hơn nữa thì thành nhấp nháy tần số cao.
    pulse_period_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    #: Năng lượng bị trừ khi bắt đầu nhiệm vụ này.
    #:
    #: ⚠️ CHƯA ĐƯỢC DÙNG. Cột có từ trước, lưu và hiển thị được, nhưng không chỗ
    #: nào trừ nó cả. Để nguyên chứ không xoá vì hai lẽ: xoá rồi cần lại thì đắt
    #: hơn nhiều so với để nó nằm im, và nếu bật nó lên thì phải nhớ MIỄN cho
    #: nhiệm vụ NPC — người chơi chỉ có năng lượng SAU khi qua NPC, nên một cái
    #: cổng đòi năng lượng để đi qua là cái cổng không mở được.
    energy_cost: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    #: Điểm tối thiểu để HOÀN THÀNH nhiệm vụ.
    #: NULL = phải đúng hết, tức bằng tổng `points` của mọi câu trong nhiệm vụ.
    #: Đặt số nhỏ hơn để cho phép sai một vài câu mà vẫn qua.
    pass_score: Mapped[int | None] = mapped_column(Integer, nullable=True)

    def __repr__(self) -> str:
        return f"<Quest #{self.order_index} {self.quest_object_key}>"


class QuestQuestion(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Bảng nối nhiệm vụ ↔ câu hỏi, đúng khuôn `exam_questions` của LMS.

    `points` nằm ở ĐÂY chứ không ở `questions`: cùng một câu hỏi lắp vào hai
    nhiệm vụ khác nhau có thể đáng số điểm khác nhau.

    Khoá ngoại tới `questions` là **RESTRICT** chứ không CASCADE, có chủ ý: xoá
    một câu hỏi đang nằm trong màn chơi phải BỊ CHẶN, chứ không được âm thầm làm
    rỗng nhiệm vụ.
    """

    __tablename__ = "quest_questions"
    __table_args__ = (
        # Không lắp trùng một câu hỏi vào cùng một nhiệm vụ.
        UniqueConstraint("quest_id", "question_id", name="uq_quest_questions_quest_question"),
        UniqueConstraint("quest_id", "order_index", name="uq_quest_questions_quest_order"),
        CheckConstraint("points >= 0", name="points_non_negative"),
        Index("ix_quest_questions_question", "question_id"),
    )

    quest_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("questions.id", ondelete="RESTRICT"), nullable=False
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    points: Mapped[int] = mapped_column(Integer, default=DEFAULT_QUESTION_POINTS, nullable=False)

    def __repr__(self) -> str:
        return f"<QuestQuestion #{self.order_index} {self.points}d>"

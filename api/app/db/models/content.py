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
    music_media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )

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

    #: TOÀN BỘ hằng số cân bằng game. Xem docs/GAME_DOMAIN.md §6.
    #: Đây là chỗ luật "không hardcode giá trị cân bằng" được thực thi: chỉnh
    #: độ khó là việc của người vận hành, không cần lập trình viên, không deploy lại.
    balance_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

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
        CheckConstraint("initial_team_energy > 0", name="energy_positive"),
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
    background_media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )

    time_limit_seconds: Mapped[int] = mapped_column(Integer, default=300, nullable=False)
    initial_team_energy: Mapped[int] = mapped_column(Integer, default=100, nullable=False)

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
    #: Sổ tay bí quyết NPC trao sau khi xong giai đoạn hội thoại.
    cluebook_i18n: Mapped[dict[str, str]] = mapped_column(
        TranslatableText, default=dict, nullable=False
    )

    status: Mapped[str] = mapped_column(String(16), default=PublishStatus.DRAFT, nullable=False)

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
    #: Khoá KỸ THUẬT — Phaser dùng để biết gắn nhiệm vụ vào sprite nào.
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

    #: Nhịp thở của ảnh: to thêm bao nhiêu PHẦN TRĂM ở đỉnh nhịp.
    #: NULL = mặc định của cảnh. 0 = TẮT hẳn — hai thứ khác nhau, nên cột phải
    #: nullable chứ không thể mặc định 0.
    pulse_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)

    #: Một nhịp thở đầy đủ (to rồi nhỏ), tính bằng mili giây. NULL = mặc định
    #: của cảnh. Sàn 400ms: nhanh hơn nữa thì thành nhấp nháy tần số cao.
    pulse_period_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    #: Năng lượng ĐỘI bị trừ khi bắt đầu nhiệm vụ này. Trả lời sai còn tốn thêm
    #: `balance_json.energyCost.wrongAnswer`.
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

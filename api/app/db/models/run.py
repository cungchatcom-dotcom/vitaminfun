"""Lượt chơi và kết quả. Xem docs/GAME_DOMAIN.md §3.4, §1.5, §1.7.

Đây là phần mô phỏng `Attempt`/`AnswerRecord` của LMS, nhưng ở **cấp phòng**:
quỹ năng lượng là của cả đội, thắng/thua là của cả đội, và đề phải là một bản
duy nhất cho cả 4 máy. Tách thành 4 `Attempt` riêng là biến ba thứ đó thành ba
nguồn có thể mâu thuẫn nhau.

Ngược lại, **bài làm thì của từng người** — xem `QuestAnswer` bên dưới.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class RunStatus:
    PLAYING = "playing"
    WON = "won"
    LOST_TIME = "lost_time"  # hết giờ — cách THUA duy nhất
    ABANDONED = "abandoned"

    # Không còn `lost_energy`. Năng lượng giờ chỉ trả cho các hành động trợ giúp
    # và là của riêng từng người; hết thì mất quyền dùng trợ giúp, không thua
    # màn. Để một người tiêu hết năng lượng làm cả đội thua là đúng thứ mà luật
    # "kết quả từng người độc lập" sinh ra để loại trừ.
    ALL = (PLAYING, WON, LOST_TIME, ABANDONED)
    #: Đã kết thúc — điều kiện để mở màn xem lại bài (S6b).
    ENDED = (WON, LOST_TIME, ABANDONED)


class StageRun(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "stage_runs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('playing', 'won', 'lost_time', 'abandoned')",
            name="status_valid",
        ),
    )

    stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True
    )

    #: ⭐ Đề bài ĐÃ ĐÓNG BĂNG, an toàn gửi xuống cả 4 máy. KHÔNG chứa đáp án.
    #: Đóng băng vì 4 người phải nhìn thấy cùng một bản đề: đọc thẳng từ
    #: `questions` mà giữa chừng có người sửa câu hỏi thì hai máy trong cùng
    #: phòng hiển thị hai đề khác nhau.
    snapshot_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    #: ⭐ Đáp án. KHÔNG BAO GIỜ rời server khi đang chơi. Chỉ lộ ở màn xem lại
    #: sau khi lượt chơi kết thúc — xem docs/GAME_DOMAIN.md §1.6.
    answer_key_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    # Không còn cột năng lượng nào ở ĐÂY. Năng lượng là của từng người và nằm ở
    # `stage_run_players` — giữ thêm một con số cho cả đội ở đây là tạo ra một
    # nguồn thứ hai có thể lệch với tổng của các nguồn kia.

    status: Mapped[str] = mapped_column(
        String(16), default=RunStatus.PLAYING, nullable=False, index=True
    )

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    #: ⭐ Giáo viên/admin chơi thử. Mọi báo cáo và thống kê LỌC BỎ những lượt này.
    is_trial: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    def __repr__(self) -> str:
        return f"<StageRun {self.status}>"


class StageRunPlayer(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Kết quả cộng dồn của MỘT người trong MỘT lượt chơi.

    Dư thừa về lý thuyết — suy được hết từ `quest_answers` — nhưng cần cho bảng
    tiến độ đội vẽ trực tiếp trong trận và cho màn kết thúc. Không muốn quét lại
    toàn bộ nhật ký trả lời mỗi lần vẽ lại HUD.
    """

    __tablename__ = "stage_run_players"
    __table_args__ = (
        UniqueConstraint("stage_run_id", "hero_key", name="uq_stage_run_players_run_hero"),
        CheckConstraint(
            "hero_key IN ('leo', 'maya', 'sam', 'jade')",
            name="hero_key_valid",
        ),
        CheckConstraint(
            "(is_bot AND user_id IS NULL) OR (NOT is_bot AND user_id IS NOT NULL)",
            name="bot_has_no_user",
        ),
        CheckConstraint("energy_granted >= 0", name="energy_granted_non_negative"),
        CheckConstraint("energy_remaining >= 0", name="energy_remaining_non_negative"),
    )

    stage_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("stage_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    hero_key: Mapped[str] = mapped_column(String(16), nullable=False)
    is_bot: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    #: Năng lượng đã cấp cho người này trong lượt chơi này.
    #:
    #: 0 = CHƯA CẤP — họ chưa qua nhiệm vụ NPC. Đây cũng là cờ chống cấp hai lần:
    #: qua NPC là chuyện một chiều, nên "đã cấp" và "> 0" là cùng một điều.
    energy_granted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    #: Còn lại bao nhiêu sau khi tiêu cho các hành động trợ giúp.
    energy_remaining: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    #: Những gợi ý ĐÃ MUA trong lượt này: `{"<question_id>": ["translation"]}`.
    #:
    #: Trả tiền một lần, xem lại bao nhiêu lần cũng được. Học sinh đóng bảng câu
    #: hỏi rồi mở lại mà bị trừ tiếp là một cái bẫy, không phải một luật chơi —
    #: và họ sẽ học được cách duy nhất để không mất năng lượng là đừng bao giờ
    #: xin giúp, tức là đúng ngược cái mà năng lượng sinh ra để khuyến khích.
    #:
    #: Một cột JSONB trên chính người chơi trong lượt đó, không phải một bảng
    #: riêng: nó chỉ có nghĩa trong phạm vi một lượt, chết theo lượt, và không
    #: ai truy vấn ngược nó bao giờ.
    hints_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb"), nullable=False
    )

    #: Mỗi nhiệm vụ đang ở VÒNG thứ mấy: `{quest_id: n}`. Thiếu khoá = vòng 1.
    #:
    #: Phải lưu riêng chứ không suy từ `quest_answers`: bấm "Làm lại" xong mà
    #: chưa trả lời câu nào thì vòng mới chưa có dòng nào để mà suy ra, và mọi
    #: phép đếm lượt thử sẽ đọc nhầm sang vòng cũ.
    rounds_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb"), nullable=False
    )

    #: Chỗ nhân vật đang đứng, hệ toạ độ thế giới 3200×1800.
    #:
    #: `NULL` = chưa đi đâu cả; cảnh đặt nhân vật ở chỗ xuất phát mặc định.
    #:
    #: Ở ĐÂY chứ không ở `stage_progress`: một vị trí chỉ có nghĩa trong CẢNH của
    #: một lượt chơi. Lượt mới là một ván mới và nhân vật phải đứng lại ở vạch
    #: xuất phát — đúng nếp với mọi thứ khác của lượt chơi (bài đã chấm, bài
    #: nháp, năng lượng) đều reset theo lượt.
    pos_x: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pos_y: Mapped[int | None] = mapped_column(Integer, nullable=True)

    quests_completed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    max_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    #: Điểm chiến lực người này nhận được từ lượt chơi này (đã gồm cả thưởng
    #: thời gian/năng lượng nếu thắng). Xem hai nhịp cộng điểm ở §6.
    skill_pts_earned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    got_map_shard: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class QuestAnswer(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """NHẬT KÝ các lần thử — mỗi lần nộp là MỘT dòng mới, không ghi đè.

    Hai ràng buộc UNIQUE ở đây là chỗ luật §1.5 và §1.7 được cưỡng chế:

    1. ``UNIQUE(run, user, quest, question, attempt_no)`` chặn nộp trùng. Người chơi bấm
       hai lần, hoặc gói tin gửi lại khi mạng chập chờn, thì không thành hai lần
       thử và không trừ năng lượng hai lần.

    2. ``UNIQUE(run, user, quest, question) WHERE is_correct`` — **partial index của
       PostgreSQL**. Cho phép nhiều dòng sai, nhưng nhiều nhất MỘT dòng đúng.
       Đây là chỗ luật "đúng rồi thì thôi, không ăn điểm hai lần" được database
       bảo đảm.

       Viết nó thành ``if await already_correct(...)`` trong service thì có ngày
       hai request đến cùng lúc lọt qua cả hai lần kiểm tra và cộng điểm hai lần
       — kiểu lỗi chỉ xuất hiện khi đông người chơi và gần như không tái hiện được.

    Cả hai đều có ``user_id``. Thiếu nó thì người thứ hai nộp cùng một nhiệm vụ
    sẽ bị database từ chối, và toàn bộ mô hình điểm cá nhân sụp.
    """

    __tablename__ = "quest_answers"
    __table_args__ = (
        # Cả hai ràng buộc đều tính tới `question_id`: một nhiệm vụ chứa nhiều
        # câu hỏi (GAME_DOMAIN §1.5b), người chơi trả lời từng câu một.
        # Cả hai đều tính tới `round_no`: chơi lại một nhiệm vụ là một VÒNG
        # mới, và vòng hai phải được trả lời lại đúng những câu của vòng một.
        # Thiếu nó thì khoá lần thử từ chối lần nộp đầu của vòng hai, còn chỉ
        # mục "đúng một lần" từ chối việc trả lời đúng lại.
        UniqueConstraint(
            "stage_run_id",
            "user_id",
            "quest_id",
            "question_id",
            "round_no",
            "attempt_no",
            name="uq_quest_answers_attempt",
        ),
        Index(
            "uq_quest_answers_correct_once",
            "stage_run_id",
            "user_id",
            "quest_id",
            "question_id",
            "round_no",
            unique=True,
            postgresql_where=text("is_correct"),
        ),
        CheckConstraint("attempt_no >= 1", name="attempt_no_positive"),
        CheckConstraint("round_no >= 1", name="round_no_positive"),
        CheckConstraint("energy_spent >= 0", name="energy_spent_non_negative"),
        CheckConstraint("skill_pts_awarded >= 0", name="skill_pts_non_negative"),
    )

    stage_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("stage_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    #: Ai nộp. KHÔNG nullable: Bot không giải nhiệm vụ ở giai đoạn này.
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quest_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: Lưu lại dù suy được từ `quest_id`: câu hỏi có thể bị xoá mềm hoặc sửa sau
    #: khi lượt chơi kết thúc, còn dòng này phải nói đúng lúc đó đã hỏi câu nào.
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("questions.id", ondelete="RESTRICT"), nullable=False
    )

    #: VÒNG chơi thứ mấy của nhiệm vụ này, đếm từ 1.
    #:
    #: Người chơi bấm "Làm lại" là mở một vòng mới: mọi câu trong nhiệm vụ trở
    #: về trắng, lượt thử đếm lại từ đầu. Dòng cũ KHÔNG bị xoá — nhật ký vẫn nói
    #: đúng họ đã làm gì ở mỗi vòng, và báo cáo đọc vòng TỐT NHẤT.
    #:
    #: Vòng "hiện tại" không suy được từ bảng này: bấm Làm lại xong mà chưa trả
    #: lời câu nào thì vòng mới chưa có dòng nào. Nó nằm ở
    #: `stage_run_players.rounds_json`.
    round_no: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    #: Lần thử thứ mấy TRONG VÒNG NÀY: 1, 2... Trần đọc từ
    #: `balance_json.maxAttemptsPerQuestion`.
    attempt_no: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    response_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    max_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    #: Chi tiết chấm từng phần, ví dụ ô trống nào đúng. Chỉ lộ ở màn xem lại.
    detail_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    #: Điểm chiến lực CƠ BẢN đã cộng ngay lúc nộp. Chỉ khác 0 ở dòng đúng đầu
    #: tiên. Phần thưởng thời gian/năng lượng cộng sau, lúc kết thúc màn.
    skill_pts_awarded: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    #: Năng lượng ĐỘI bị trừ vì lần nộp này.
    energy_spent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    answered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<QuestAnswer attempt={self.attempt_no} correct={self.is_correct}>"


class QuestDraft(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Đáp án NHÁP — người chơi đã chọn nhưng chưa nộp.

    Sinh ra để một lượt chơi dở dang không biến mất. Người chơi làm tới câu ba
    của một nhiệm vụ bốn câu rồi mất mạng, tắt máy, hay đóng nhầm tab; vào lại
    mà còn giờ thì phải thấy đúng những gì mình đã chọn. Giữ ở máy (localStorage)
    thì đổi máy là mất, và cũng không có cách nào tin được nó.

    **Đây là bảng NHÁP, không phải bảng điểm.** Không có `score`, không có
    `is_correct`, không có `attempt_no`. Chấm điểm vẫn là việc của
    `quest_answers` — nhật ký từng lần thử, không ghi đè. Gộp hai thứ vào một
    bảng thì mất lịch sử số lần thử, mà đó là thứ cả công thức tính điểm dựa vào.

    `UNIQUE(stage_run_id, user_id, question_id)` — KHÔNG có `quest_id` trong
    khoá: một câu hỏi chỉ thuộc một nhiệm vụ trong cùng một đề bài đã đóng băng,
    nên thêm `quest_id` vào khoá là mở đường cho hai bản nháp của cùng một câu.
    Cột `quest_id` vẫn có, để đọc cả nhiệm vụ bằng một câu truy vấn.
    """

    __tablename__ = "quest_drafts"
    __table_args__ = (
        UniqueConstraint(
            "stage_run_id", "user_id", "question_id", name="uq_quest_drafts_question"
        ),
        Index("ix_quest_drafts_run_user", "stage_run_id", "user_id"),
    )

    stage_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stage_runs.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    quest_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    question_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    #: Bài làm đang dở, đúng dạng mà `grade()` nhận. `NULL` = đã xoá lựa chọn.
    response_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    def __repr__(self) -> str:
        return f"<QuestDraft q={self.question_id}>"

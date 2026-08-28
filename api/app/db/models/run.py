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
    LOST_ENERGY = "lost_energy"  # hết năng lượng đội
    LOST_TIME = "lost_time"  # hết giờ
    ABANDONED = "abandoned"

    ALL = (PLAYING, WON, LOST_ENERGY, LOST_TIME, ABANDONED)
    #: Đã kết thúc — điều kiện để mở màn xem lại bài (S6b).
    ENDED = (WON, LOST_ENERGY, LOST_TIME, ABANDONED)


class StageRun(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "stage_runs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('playing', 'won', 'lost_energy', 'lost_time', 'abandoned')",
            name="status_valid",
        ),
        CheckConstraint("team_energy_remaining >= 0", name="energy_non_negative"),
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

    team_energy_initial: Mapped[int] = mapped_column(Integer, nullable=False)
    #: MỘT con số duy nhất cho cả đội. Đây là chỗ luật "năng lượng dùng chung"
    #: được cưỡng chế — không có bản sao nào khác để lệch nhau.
    team_energy_remaining: Mapped[int] = mapped_column(Integer, nullable=False)

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
        return f"<StageRun {self.status} energy={self.team_energy_remaining}>"


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
        UniqueConstraint(
            "stage_run_id",
            "user_id",
            "quest_id",
            "question_id",
            "attempt_no",
            name="uq_quest_answers_attempt",
        ),
        Index(
            "uq_quest_answers_correct_once",
            "stage_run_id",
            "user_id",
            "quest_id",
            "question_id",
            unique=True,
            postgresql_where=text("is_correct"),
        ),
        CheckConstraint("attempt_no >= 1", name="attempt_no_positive"),
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

    #: Lần thử thứ mấy: 1, 2, 3... Trần đọc từ `balance_json.maxAttemptsPerQuest`.
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

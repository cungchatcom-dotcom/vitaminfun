"""Tiến trình người chơi: điểm chiến lực, mảnh bản đồ, thành tích từng màn.

Xem docs/GAME_DOMAIN.md §3.2.

Ba bảng này là nơi **luật chơi được cưỡng chế bởi database**, không phải bởi
code. Xem `map_shards_owned` bên dưới cho ví dụ rõ nhất.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class WorldProgress(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Tiến trình của một người trong một world.

    Điểm chiến lực là **riêng theo từng world**: sang world khác thì bắt đầu lại
    từ 0. Đó là lý do bảng này khoá theo cặp (world, user) chứ không phải một
    cột `skill_pts` trên `users`.
    """

    __tablename__ = "world_progress"
    __table_args__ = (
        UniqueConstraint("world_id", "user_id", name="uq_world_progress_world_user"),
        CheckConstraint("skill_pts >= 0", name="skill_pts_non_negative"),
    )

    world_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("worlds.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    #: Điểm chiến lực. Dùng để mở khoá màn, kể cả nhảy bậc.
    skill_pts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    stages_completed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    first_played_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_played_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    #: Đã mở được Cánh cổng Thời gian chưa (đủ shard_total mảnh khác nhau).
    gate_opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    #: Nhân vật người này đã chọn cho world này. NULL = chưa chọn.
    #:
    #: Cột ở đây chứ không phải bảng mới: lựa chọn khoá theo đúng cặp
    #: (world, user) mà bảng này đã khoá sẵn, và nó là một phần của "tiến trình
    #: của tôi trong world này".
    #:
    #: `SET NULL` khi nhân vật bị xoá — học sinh quay lại thấy ô trống và chọn
    #: lại, chứ không mất cả tiến trình.
    character_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("characters.id", ondelete="SET NULL"), nullable=True
    )


class MapShardOwned(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Một mảnh bản đồ mà một người đã sở hữu trong một world.

    ⭐ `UNIQUE(world_id, user_id, shard_index)` là chỗ luật **"đủ 30 mảnh KHÁC
    NHAU"** được database cưỡng chế, không phải code.

    Chơi lại màn 13 mười lần vẫn chỉ có một mảnh #13. Không cần câu `if` nào,
    không có đường nào lách được — kể cả một lệnh INSERT gõ tay.
    """

    __tablename__ = "map_shards_owned"
    __table_args__ = (
        UniqueConstraint(
            "world_id", "user_id", "shard_index", name="uq_map_shards_world_user_index"
        ),
        CheckConstraint("shard_index >= 1", name="shard_index_positive"),
    )

    world_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("worlds.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    shard_index: Mapped[int] = mapped_column(Integer, nullable=False)

    #: Lượt chơi nào đã trao mảnh này. Giữ lại để tra ngược khi có khiếu nại;
    #: xoá lượt chơi thì mảnh vẫn còn, nên SET NULL.
    stage_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stage_runs.id", ondelete="SET NULL"), nullable=True
    )
    earned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class StageProgress(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Thành tích tốt nhất của một người ở một màn.

    Bảng cộng dồn, suy ra được từ `stage_run_players` — nhưng cần có sẵn để vẽ
    danh sách 30 màn mà không phải quét toàn bộ lịch sử chơi mỗi lần mở trang.
    """

    __tablename__ = "stage_progress"
    __table_args__ = (
        UniqueConstraint("stage_id", "user_id", name="uq_stage_progress_stage_user"),
        CheckConstraint("best_stars >= 0", name="best_stars_non_negative"),
    )

    stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    best_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    best_quests_completed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    #: Số sao CAO NHẤT từng đạt ở màn này. Cộng lại thành số sao của world.
    #:
    #: Cao nhất chứ không phải lần gần nhất, và cũng không cộng dồn qua các lần
    #: chơi: sao là huy hiệu cho thành tích tốt nhất, chơi lại kém đi thì không
    #: mất, mà chơi lại mười lần cũng không thành ba mươi sao.
    #:
    #: Phần chấm sao chưa có nên cột này còn đứng ở 0; chỗ hiển thị đã đọc nó
    #: rồi, nên khi luật chấm xong thì không phải sửa gì ở giao diện nữa.
    best_stars: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    times_played: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    #: Tổng điểm chiến lực đã kiếm từ màn này qua MỌI lần chơi.
    #: Hiện chưa dùng để chặn gì — `balance_json.replayCapMultiplier` mặc định
    #: là null, tức chơi lại cộng đủ điểm mỗi lần (§6, đã chốt). Tạo cột ngay từ
    #: đầu vì thêm cột vào bảng đã có dữ liệu thật thì phải backfill, còn tạo
    #: sẵn lúc này thì miễn phí.
    skill_pts_earned_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    first_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

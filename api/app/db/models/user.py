"""Tài khoản đăng nhập.

Cố ý ĐƠN GIẢN. Không copy hệ RBAC động của LMS EDUPLAY (roles, permissions,
memberships, 4 mức phạm vi): vitaminfun chỉ có ba vai trò cố định và không có
khái niệm trung tâm. Xem docs/ARCHITECTURE.md §7.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class UserRole:
    """Ba vai trò cố định. Không có bảng roles, không cấu hình được từ giao diện."""

    ADMIN = "admin"  # quản lý tài khoản, chỉnh balance_json, chơi thử
    TEACHER = "teacher"  # soạn câu hỏi, dựng world/màn/nhiệm vụ, chơi thử
    STUDENT = "student"  # chơi

    ALL = (ADMIN, TEACHER, STUDENT)

    #: Vai trò nào được vào chế độ chơi thử. Xem docs/ARCHITECTURE.md §4:
    #: điều hướng bất đối xứng — học sinh bị chặn khỏi /teacher, nhưng giáo
    #: viên và admin ĐƯỢC vào /play để chơi thử trước khi phát hành world.
    CAN_PREVIEW = (ADMIN, TEACHER)


class UserStatus:
    ACTIVE = "active"
    SUSPENDED = "suspended"

    ALL = (ACTIVE, SUSPENDED)


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"
    __table_args__ = (
        # Ba vai trò là luật, không phải quy ước. Cưỡng chế ở database để một
        # bản vá dữ liệu bằng tay cũng không tạo ra được vai trò thứ tư.
        CheckConstraint(
            "role IN ('admin', 'teacher', 'student')",
            name="role_valid",
        ),
        CheckConstraint(
            "status IN ('active', 'suspended')",
            name="status_valid",
        ),
    )

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)

    role: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), default=UserStatus.ACTIVE, nullable=False)

    # use_alter=True: users và media_assets trỏ lẫn nhau (user có ảnh đại diện,
    # ảnh có người tải lên). Không có nó thì SQLAlchemy không sắp được thứ tự
    # tạo bảng và báo vòng lặp phụ thuộc.
    avatar_media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("media_assets.id", ondelete="SET NULL", use_alter=True),
        nullable=True,
    )

    locale: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Tăng lên khi vai trò của user thay đổi, làm mọi JWT đã phát mất hiệu lực
    # ngay lập tức thay vì phải chờ hết hạn.
    perm_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    #: TUỲ CHỌN ÂM THANH của người chơi: `{"on": true, "master": 1.0}`.
    #:
    #: Theo TÀI KHOẢN, không theo trình duyệt. Trước đây nó nằm ở
    #: `localStorage` với lý do "thuộc về cái máy đang ngồi" — lý do ấy ngược
    #: với phòng máy của một lớp học: em tắt nhạc ở máy thứ Hai, thứ Tư ngồi máy
    #: khác thì nhạc bật lại, vì lựa chọn ở lại với cái bàn chứ không đi theo
    #: người. Và cùng một cái máy thì trao tuỳ chọn của em trước cho em sau.
    #:
    #: RỖNG = mặc định (bật nhạc, âm lượng đầy), nên tài khoản chưa đụng tới
    #: vẫn nghe đúng như cũ. Giao diện vẫn giữ một bản sao ở `localStorage`,
    #: nhưng chỉ để vẽ ngay lúc mở trang; con số thật nằm ở đây.
    audio_prefs_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb"), nullable=False
    )

    def __repr__(self) -> str:
        return f"<User {self.email} role={self.role}>"

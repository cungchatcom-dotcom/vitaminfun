"""Cấu hình chung của cả trang web.

MỘT DÒNG, không hơn. Đây không phải một bảng danh sách: nó là cái bảng hiệu
treo trước cửa — tên trang và cái biểu tượng trên tab trình duyệt — và một bản
cài chỉ có một cái.

Vì sao một BẢNG chứ không phải mấy biến trong `.env`: những giá trị này do GIÁO
VIÊN đổi, từ trong giao diện, lúc trang đang chạy. Một biến `.env` thì phải vào
được máy chủ, sửa file, rồi khởi động lại — ba việc mà người dựng nội dung không
làm được và cũng không nên phải làm. `.env` giữ những thứ của NGƯỜI VẬN HÀNH
(cổng, chuỗi kết nối, khoá API); bảng này giữ những thứ của NGƯỜI DÙNG.
"""

from __future__ import annotations

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, SmallInteger, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, TranslatableText, UUIDPrimaryKeyMixin


class SiteConfig(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "site_config"
    __table_args__ = (
        CheckConstraint(
            "locked_stage_opacity >= 0 AND locked_stage_opacity <= 100",
            name="locked_stage_opacity_range",
        ),
    )

    #: Tên trang, hiện ở tab trình duyệt và ở thanh đầu trang.
    #:
    #: Đa ngôn ngữ như mọi chữ hiển thị khác trong hệ thống: cùng một bản cài
    #: phục vụ cả hai giao diện, và một cái tên tiếng Anh nằm trên trang tiếng
    #: Việt là thứ người ta nhìn thấy đầu tiên khi mở máy.
    #:
    #: RỖNG là hợp lệ và là mặc định: khi đó giao diện dùng tên trong
    #: `messages/*.json`, đúng như trước khi có bảng này.
    title_i18n: Mapped[dict[str, str]] = mapped_column(
        TranslatableText, default=dict, nullable=False
    )

    #: Ảnh làm biểu tượng tab (favicon). `NULL` = dùng file tĩnh mặc định.
    #:
    #: Trỏ tới `media_assets` chứ không lưu một đường dẫn: ảnh đi qua đúng
    #: đường tải lên của mọi ảnh khác — kiểm loại file, kiểm dung lượng, đặt tên
    #: theo nội dung — và xoá ảnh thì cột này tự về `NULL` thay vì trỏ vào hư
    #: không.
    favicon_media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("media_assets.id", ondelete="SET NULL"),
        nullable=True,
    )

    #: MÀN ĐANG KHOÁ trên minimap hiện rõ bao nhiêu phần trăm (độ mờ).
    #:
    #: `100` = rõ như màn đã mở, `0` = biến mất. Đây là ĐỘ MỜ của cả cái chấm,
    #: không phải một lớp đen phủ lên: lớp đen giữ nguyên hình khối và chỉ rút
    #: ánh sáng ra, nên vặn mạnh là cái chấm thành một đồng xu đen — vẫn to
    #: tiếng trên bản đồ, chỉ là không đọc được nữa. Độ mờ thì đúng thứ mắt chờ
    #: đợi ở "chưa tới lượt": cả cái chấm lùi về phía nền, giữ nguyên màu, nhỏ
    #: tiếng dần.
    #:
    #: Bao nhiêu là vừa thì phụ thuộc vào chính những tấm ảnh người dựng tải
    #: lên, tức là thứ chỉ họ nhìn thấy — nên núm vặn nằm ở màn Cấu hình, không
    #: nằm trong một lớp Tailwind.
    locked_stage_opacity: Mapped[int] = mapped_column(
        SmallInteger, default=50, server_default=text("50"), nullable=False
    )

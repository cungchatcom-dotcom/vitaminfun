"""Schema cho cấu hình chung của trang."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, Field

I18nText = dict[str, str]


class SiteConfigOut(BaseModel):
    #: Tên trang. RỖNG = giao diện dùng tên mặc định trong `messages/*.json`.
    title_i18n: I18nText = Field(default_factory=dict)

    favicon_media_id: uuid.UUID | None = None
    #: URL dựng sẵn để `<link rel="icon">` dùng thẳng. `None` = chưa đặt ảnh.
    favicon_url: str | None = None
    #: Cỡ THẬT của ảnh đó, đọc từ `media_assets`.
    #:
    #: Có mặt ở đây vì web app manifest bắt khai `sizes` cho từng biểu tượng, và
    #: Chrome chỉ cho cài lên màn hình chính khi có một biểu tượng từ 192px trở
    #: lên. Khai bừa "512x512" thì Chrome giải mã ảnh ra, thấy không khớp, và bỏ
    #: qua — tức là nói dối xong vẫn không cài được, chỉ khác là không biết vì
    #: sao. `None` = ảnh không phải kiểu đọc được cỡ (SVG chẳng hạn).
    favicon_width: int | None = None
    favicon_height: int | None = None

    #: Màn đang khoá trên minimap hiện rõ bao nhiêu phần trăm (độ mờ, 0..100).
    locked_stage_opacity: int = 50


class SiteConfigUpdate(BaseModel):
    """`None` = KHÔNG GỬI, giữ nguyên. Xem `QUEST_KEEP_FIELDS` cho cùng luật ấy.

    Xoá favicon thì gửi `clear_favicon = true`, không gửi `favicon_media_id =
    null`: `null` ở đây đã mang nghĩa "không đụng tới", và một trường không thể
    mang hai nghĩa trái ngược nhau.
    """

    title_i18n: I18nText | None = None
    favicon_media_id: uuid.UUID | None = None
    clear_favicon: bool = False
    locked_stage_opacity: int | None = Field(default=None, ge=0, le=100)

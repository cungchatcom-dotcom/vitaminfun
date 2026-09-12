"""Schema cho kho giọng đọc."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict


class VoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    provider: str
    #: Mã bên nhà cung cấp. Giao diện không dùng tới, nhưng nó là thứ duy nhất
    #: nối dòng này với giọng thật khi đi tra lỗi.
    external_id: str
    name: str
    gender: str | None = None
    age_group: str | None = None
    accent: str | None = None
    style: str | None = None
    use_case: str | None = None
    language: str = "en"
    #: Đoạn mẫu để nghe thử. `None` = nhà cung cấp không có mẫu cho giọng này.
    preview_url: str | None = None


class VoiceProviderOut(BaseModel):
    """Một dịch vụ đọc chữ thành tiếng, cho ô chọn đầu tiên."""

    key: str
    #: Đã đồng bộ được bao nhiêu giọng. `0` = có dịch vụ nhưng chưa kéo về lần
    #: nào — giao diện đọc con số này để mời người dùng bấm Đồng bộ, thay vì
    #: hiện một ô chọn rỗng không giải thích gì.
    voice_count: int


class VoiceSyncIn(BaseModel):
    provider: str
    #: Chỉ kéo về giọng của ngôn ngữ này. Game dạy tiếng Anh.
    language: str = "en"


class VoiceSyncOut(BaseModel):
    provider: str
    #: Tổng số giọng của nhà cung cấp này sau khi đồng bộ.
    total: int
    added: int
    updated: int

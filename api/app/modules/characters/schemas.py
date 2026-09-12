"""Schema cho nhân vật người chơi."""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.voices.schemas import VoiceOut

I18nText = dict[str, str]


class CharacterActionIn(BaseModel):
    """Đặt spritesheet cho MỘT hành động.

    `action_key` là chuỗi tự do, chỉ giới hạn ký tự để nó còn dùng được làm khoá
    texture trong Phaser: `character_<id>_<action_key>`. Cho phép dấu cách hay
    dấu tiếng Việt ở đây là đẩy rắc rối xuống chỗ khác.
    """

    action_key: str = Field(min_length=1, max_length=32, pattern=r"^[a-z][a-z0-9_]*$")
    media_id: uuid.UUID | None = None
    #: Số khung trong tấm ảnh. 1 = ảnh tĩnh, và đó là giá trị hợp lệ.
    frames: int = Field(default=1, ge=1, le=240)
    #: Kích thước MỘT khung. None = giao diện suy ra từ khổ ảnh chia cho `frames`.
    #:
    #: Trần 8192 chứ không 4096: một tấm dải 8 khung mỗi khung 640px đã là
    #: 5128px, và người dùng hoàn toàn có thể để `frames = 1` cho một tấm như
    #: thế. Trần ở đây chỉ để chặn rác, không phải để bắt bẻ ảnh thật.
    frame_width: int | None = Field(default=None, ge=1, le=8192)
    frame_height: int | None = Field(default=None, ge=1, le=8192)
    frame_rate: int = Field(default=10, ge=1, le=60)


class CharacterActionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    action_key: str
    media_id: uuid.UUID | None
    #: URL dựng sẵn — Phaser nạp thẳng từ đây.
    media_url: str | None = None
    frames: int
    frame_width: int | None
    frame_height: int | None
    frame_rate: int

    #: Khổ CẢ TẤM ảnh, lấy từ kho media. Giao diện cần nó để suy ra bề rộng một
    #: khung mỗi khi số khung đổi — không phải nạp lại ảnh chỉ để đo.
    sheet_width: int | None = None
    sheet_height: int | None = None


class CharacterIdsIn(BaseModel):
    """Một mẻ nhân vật để thêm vào world. Bộ chọn tick nhiều rồi gửi một lần."""

    character_ids: list[uuid.UUID] = Field(min_length=1, max_length=50)


class CharacterCreate(BaseModel):
    #: `player` = nhân vật học sinh chọn · `npc` = người canh giữ nhiệm vụ.
    #: Cùng một bảng, cùng bộ máy spritesheet — xem `Character.kind`.
    kind: Literal["player", "npc"] = "player"
    name_i18n: I18nText
    bio_i18n: I18nText = Field(default_factory=dict)
    avatar_media_id: uuid.UUID | None = None
    voice_id: uuid.UUID | None = None
    position: int = 0


class CharacterUpdate(BaseModel):
    kind: Literal["player", "npc"] | None = None
    name_i18n: I18nText | None = None
    bio_i18n: I18nText | None = None
    avatar_media_id: uuid.UUID | None = None
    voice_id: uuid.UUID | None = None
    position: int | None = None
    status: Literal["draft", "published"] | None = None
    #: Gỡ ảnh đại diện. `None` trong PATCH nghĩa là "không gửi", không phải "xoá".
    clear_avatar: bool | None = None
    #: Gỡ giọng. Cùng lý do với `clear_avatar`.
    clear_voice: bool | None = None


class CharacterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: Literal["player", "npc"] = "player"
    name_i18n: I18nText
    bio_i18n: I18nText
    avatar_media_id: uuid.UUID | None
    avatar_url: str | None = None
    voice_id: uuid.UUID | None = None
    #: Cả giọng, dựng sẵn. Giao diện cần TÊN và ĐOẠN MẪU để hiện ra, mà đi hỏi
    #: thêm một lượt nữa cho mỗi nhân vật trong danh sách là hai chục lượt cho
    #: một màn hình.
    voice: VoiceOut | None = None
    position: int
    status: Literal["draft", "published"]
    actions: list[CharacterActionOut] = Field(default_factory=list)

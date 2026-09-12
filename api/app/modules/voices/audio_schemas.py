"""Schema cho việc sinh tiếng đọc của câu hỏi."""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel


class AudioGenerateIn(BaseModel):
    """Sinh cái gì, bằng giọng của ai, có ghi đè không."""

    #: `prompt` = đề bài (người canh giữ đọc) · `option` = phương án (học sinh đọc).
    target: Literal["prompt", "option"] = "prompt"

    #: Nhân vật lấy giọng — CHỈ dùng cho `option`.
    #:
    #: Nhiều nhân vật vì mỗi học sinh vào màn bằng nhân vật của mình, và mỗi
    #: nhân vật một giọng. Sinh cho một giọng rồi thì học sinh chọn nhân vật
    #: khác sẽ gặp một khoảng im.
    #:
    #: Với `prompt` thì bỏ trống: giọng đã được chọn lúc gán người canh giữ vào
    #: nhiệm vụ, và bắt chọn lại ở đây là mời người ta chọn lệch đi.
    character_ids: list[uuid.UUID] = []

    #: Đã có tiếng rồi thì sinh lại và GHI ĐÈ. Mặc định là không: mỗi lần sinh
    #: là một lần trả tiền cho nhà cung cấp.
    overwrite: bool = False

    #: CHỈ sinh những câu này. Rỗng = cả bộ.
    #:
    #: Có nó thì người dựng nghe thử tám mươi câu, thấy ba câu đọc chưa ưng, và
    #: thu lại đúng ba câu ấy. Không có thì lựa chọn duy nhất là sinh lại cả
    #: tám mươi — trả tiền cho bảy mươi bảy câu đã đúng.
    lines: list[str] = []


class AudioReportOut(BaseModel):
    generated: int
    #: Đã có sẵn nên bỏ qua. Giao diện đọc con số này để hỏi "tạo lại không?".
    skipped: int
    #: Tên những nhiệm vụ không sinh được vì chưa có giọng.
    missing_voice: list[str] = []

    #: Số câu GỌI HỎNG. Phần còn lại vẫn đã được lưu — bấm lại chỉ chạy phần này.
    failed: int = 0
    #: Vài dòng lý do, để giao diện nói được hỏng vì sao.
    errors: list[str] = []


class QuestionAudioOut(BaseModel):
    id: uuid.UUID
    question_id: uuid.UUID
    voice_id: uuid.UUID
    voice_name: str | None = None
    target: str
    #: `None` với đề bài. Với phương án là mã phương án, hoặc `"<ô>:<mã>"`.
    option_key: str | None = None
    #: File của bản thu. Giao diện so nó với `questions.audio_media_id` để biết
    #: giọng nào ĐANG ĐƯỢC DÙNG — so bằng URL thì hỏng ngay khi kho file đổi
    #: cách dựng đường dẫn.
    media_id: uuid.UUID
    url: str | None = None


class QuestionAudioStatusOut(BaseModel):
    question_id: uuid.UUID
    type: str
    #: Đoạn chữ SẼ được đọc, đã dọn ô trống. Người dựng nhìn đúng thứ máy sẽ đọc.
    prompt: str
    prompt_ready: bool
    prompt_url: str | None = None
    #: Câu này có bao nhiêu phương án. `0` = câu gõ chữ, không sinh gì cả.
    option_count: int
    #: Cần bao nhiêu bản (phương án × số giọng đã chọn) và đã có bao nhiêu.
    options_wanted: int
    options_ready: int


class QuestAudioStatusOut(BaseModel):
    quest_id: uuid.UUID
    name_i18n: dict[str, str] = {}
    npc_character_id: uuid.UUID | None = None
    #: Giọng của người canh giữ. `None` = chưa gán NPC, hoặc NPC chưa có giọng —
    #: và giao diện phải nói rõ là cái nào.
    voice_id: uuid.UUID | None = None
    voice_name: str | None = None
    questions: list[QuestionAudioStatusOut] = []

    #: LỜI CHIA TAY của màn chơi. Chỉ có ở nhiệm vụ NPC — đó là khoảnh khắc nó
    #: vang lên: qua được nhiệm vụ NPC, nghe lời chia tay, rồi nhận sổ tay.
    #: `None` = nhiệm vụ này không phải cổng vào, hoặc màn chưa soạn lời chia tay.
    outro_text: str | None = None
    outro_ready: bool = False
    outro_url: str | None = None

    #: LỜI PHÁN — bộ câu khen/chê của world, đọc bằng giọng người canh giữ này.
    #:
    #: Đếm theo GIỌNG chứ không theo nhiệm vụ: hai nhiệm vụ chọn cùng một giọng
    #: thì cái thứ hai mở ra đã thấy đủ, không phải sinh lại.
    verdict_total: int = 0
    verdict_ready: int = 0


class StageAudioStatusOut(BaseModel):
    stage_id: uuid.UUID
    quests: list[QuestAudioStatusOut] = []


class VerdictLineOut(BaseModel):
    """Một câu phán, kèm tiếng đọc của giọng đang xét."""

    #: `praise` · `wrong` · `moveOn`… — để giao diện gom nhóm.
    group: str
    text: str
    #: `None` = chưa có tiếng bằng giọng này.
    url: str | None = None


class VerdictLinesOut(BaseModel):
    quest_id: uuid.UUID
    voice_name: str | None = None
    lines: list[VerdictLineOut] = []

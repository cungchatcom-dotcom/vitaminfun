"""Schema cho phần chơi.

⚠️ LUẬT QUAN TRỌNG NHẤT CỦA FILE NÀY:

`SubmitQuestOut` **không được có** `score`, `detail`, `answer`, hay `skill_pts`.
Trong trận, người chơi chỉ biết nhiệm vụ xong hay chưa xong. Chi tiết chấm điểm
để dành cho màn xem lại sau khi hết màn — xem docs/GAME_DOMAIN.md §1.6.

Thêm một trường vào đó "cho tiện debug" là làm hỏng cả cơ chế, vì nó vừa cắt
mạch chơi vừa rò đáp án cho người còn lượt thử và cho đồng đội ngồi cạnh.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# Vùng đi được dùng CHUNG một lược đồ với bên soạn thảo, không sao chép sang
# đây: hai bản mô tả của cùng một hình dạng dữ liệu sẽ lệch nhau đúng vào lúc ai
# đó thêm một loại hình mới ở một bên.
from app.modules.worlds.schemas import AudioTrack, BackgroundKind, CollisionMap


# ==========================================================================
# Đề bài đã đóng băng
# ==========================================================================


class RunSpriteOut(BaseModel):
    """Một hành động của nhân vật, đúng thứ Phaser cần để cắt tấm ảnh:

        this.load.spritesheet(key, url, { frameWidth, frameHeight })

    `frames = 1` là hợp lệ: ảnh một khung, vẽ như hình tĩnh.

    Khai báo Ở ĐÂY, trên cùng, vì cả đề bài đóng băng lẫn `RunOut` đều cần —
    người canh giữ nằm trong đề bài, nhân vật học sinh thì không.
    """

    action_key: str
    url: str
    frames: int
    frame_width: int
    frame_height: int
    frame_rate: int


class DialogueActor(BaseModel):
    """Một người đứng trong màn hội thoại: người canh giữ, hoặc học sinh.

    Cùng một hình dạng cho cả hai vai, vì cả hai là `characters` và cả hai vẽ
    bằng `character_actions`. Hai khai báo cho cùng một thứ là hai chỗ để lệch
    nhau khi thêm tư thế.

    `sprites` chỉ mang hành động CÓ ẢNH. Tư thế chưa tải thì lùi về tư thế nghỉ
    rồi tới `avatar_url` — luật lùi nằm ở `web/src/game/character.ts`, một chỗ.
    """

    id: uuid.UUID
    name_i18n: dict[str, str]
    avatar_url: str | None = None
    #: Giọng đọc đã gán cho nhân vật. Màn chơi tra `option_audio` bằng nó để
    #: biết câu trả lời của học sinh được đọc bằng tiếng nào.
    voice_id: uuid.UUID | None = None
    sprites: list[RunSpriteOut] = []



class SnapshotQuestion(BaseModel):
    """Một câu hỏi trong đề đã đóng băng. KHÔNG chứa đáp án."""

    id: uuid.UUID
    type: str
    content: dict[str, Any]
    points: int
    audio_max_plays: int | None = None

    #: CÁCH RA ĐỀ, đã đóng băng. Đề bài cũ (trước khi có cột này) không mang
    #: trường này và mặc định là `"text"` — đúng sự thật cho những lượt bắt đầu
    #: từ khi chưa có câu nghe nào, chứ không phải một phỏng đoán.
    prompt_kind: Literal["text", "audio"] = "text"
    #: Đoạn chữ của đề mở sẵn cạnh trình phát. Nút Transcript thì luôn có.
    show_transcript: bool = False
    #: URL tệp nghe, ĐÓNG BĂNG như ảnh nền. `None` = câu đọc, hoặc câu nghe mà
    #: giáo viên chưa tải file — màn học sinh khi đó hiện thẳng đoạn chữ ra.
    audio_url: str | None = None

    #: TIẾNG ĐỌC TỪNG PHƯƠNG ÁN: `{voice_id: {option_key: url}}`.
    #:
    #: Theo GIỌNG chứ không phải một bộ phẳng: câu trả lời là thứ nhân vật HỌC
    #: SINH nói, mà nhân vật ấy do chính em chọn và đổi được giữa hai lượt — còn
    #: đề bài thì đóng băng lúc bắt đầu. Chọn hộ một giọng ở đây là đóng băng cả
    #: một lựa chọn chưa xảy ra.
    #:
    #: Rỗng là chuyện thường: tiếng cho phương án luôn là TUỲ CHỌN.
    option_audio: dict[str, dict[str, str]] = {}

    #: Câu này CÓ bản dịch hay không — chỉ cái CÓ hay KHÔNG, không phải bản dịch.
    #:
    #: Bản dịch nằm trong `answer_json` và phải trả bằng năng lượng mới xem
    #: được, nên nó không bao giờ đi cùng đề bài. Nhưng giao diện phải biết có
    #: nên vẽ cái nút Dịch hay không TRƯỚC khi học sinh bấm: một cái nút bấm vào
    #: rồi báo "câu này không có bản dịch" là đã tiêu mất một nhịp chú ý của
    #: người đang bí, và một con số `bool` thì không lộ ra chữ nào.
    has_translation: bool = False
    #: Câu này có LỜI THOẠI để mua hay không. Câu đọc thì không; câu nghe mà
    #: giáo viên đã bật `show_transcript` cũng không — chữ hiện sẵn rồi.
    has_transcript: bool = False


class SnapshotQuest(BaseModel):
    id: uuid.UUID
    order_index: int
    phase: Literal["advisor", "main"]
    quest_object_key: str
    #: Tên hiển thị. Rỗng thì giao diện lùi về `quest_object_key`.
    name_i18n: dict[str, str] = {}
    scene_x: int | None = None
    scene_y: int | None = None
    trigger_radius: int | None = None
    #: URL ảnh vật thể, đã đóng băng vào snapshot.
    icon_url: str | None = None
    #: NGƯỜI CANH GIỮ nhiệm vụ này, đã đóng băng cùng đề bài — tên, ảnh đại
    #: diện, và mọi tư thế đã tải. `None` = chưa gán ai.
    npc: DialogueActor | None = None
    #: Bề rộng ảnh theo hệ toạ độ thế giới. None = mặc định của cảnh.
    icon_size: int | None = None
    #: Nhịp thở của ảnh. None = mặc định của cảnh, 0 = tắt hẳn.
    pulse_percent: int | None = None
    pulse_period_ms: int | None = None
    energy_cost: int
    pass_score: int

    #: CÂU KHOÁ do giáo viên soạn cho riêng nhiệm vụ này. `{}` = màn chơi dùng
    #: câu tự sinh trong `messages/` (có nhắc tên người gác cửa).
    locked_message_i18n: dict[str, str] = {}
    #: `câu chữ → URL tiếng`, đọc bằng giọng NGƯỜI GÁC CỬA của màn.
    #:
    #: Bảng chứ không phải một URL, cùng hình dạng với `verdict_audio`: ngôn ngữ
    #: do MÁY HỌC SINH chọn, nên server không biết trước câu nào sẽ hiện ra.
    #: Thiếu câu nào thì vắng câu đó — tiếng luôn là TUỲ CHỌN.
    locked_audio: dict[str, str] = {}

    #: LỜI PHÁN của người canh giữ — chữ của WORLD, đã đóng băng.
    #:
    #: Giữ NGUYÊN BA NHÓM (`praise` · `wrong` · `moveOn`), không gộp phẳng: màn
    #: chơi chọn câu theo nhóm — khen khi đúng, chê khi sai — nên một danh sách
    #: phẳng thì không còn biết câu nào dùng lúc nào.
    #:
    #: Rỗng = world chưa soạn bộ riêng, và màn chơi dùng bộ mặc định trong
    #: `messages/` — đúng như mọi lượt đang chạy hôm nay.
    verdict: dict[str, list[str]] = {}
    #: `câu chữ → URL tiếng`, đọc bằng giọng của CHÍNH người canh giữ này.
    #:
    #: Thiếu câu nào thì vắng câu đó: tiếng luôn là TUỲ CHỌN, không bao giờ là
    #: điều kiện để cuộc trò chuyện đi tiếp.
    verdict_audio: dict[str, str] = {}

    questions: list[SnapshotQuestion]


class SnapshotStage(BaseModel):
    id: uuid.UUID
    name_i18n: dict[str, str]
    synopsis_i18n: dict[str, str]
    scene_key: str
    #: Chiều CAO nhân vật trong cảnh, hệ toạ độ thế giới. Đã giải xong kế thừa.
    character_height: int = 160
    #: CHỖ XUẤT PHÁT của nhân vật, đã đóng băng. Điểm va chạm, hệ toạ độ thế
    #: giới. `None` = người dựng chưa đặt, cảnh dùng chỗ mặc định của nó — và
    #: đề bài cũ (trước khi có cột này) cũng rơi đúng vào nhánh đó, tức là
    #: những lượt đang chơi dở không đổi một chút nào.
    spawn_x: int | None = None
    spawn_y: int | None = None
    time_limit_seconds: int
    energy_per_player: int
    map_shard_index: int
    advisor_npc_key: str | None = None
    #: Loi NPC noi luc trao so tay. Rong = chua soan.
    advisor_outro_i18n: dict[str, str] = {}
    #: URL đoạn ghi âm NPC nói lời chia tay, đã đóng băng. `None` = chỉ có chữ.
    advisor_outro_audio_url: str | None = None
    #: Đoạn chữ mở sẵn cạnh trình phát. Mặc định `True` — đề bài cũ không mang
    #: trường này, và mở sẵn là đúng với thứ chúng vẫn hiện ra từ trước tới nay.
    advisor_outro_show_transcript: bool = True
    #: Ten so tay. Rong = giao dien lui ve nhan dich cua no.
    cluebook_title_i18n: dict[str, str] = {}
    cluebook_i18n: dict[str, str]
    background_media_id: uuid.UUID | None = None
    #: URL ảnh nền, đã đóng băng.
    background_url: str | None = None
    #: Ảnh nền là ảnh hay video, cũng ĐÓNG BĂNG. Đề bài cũ không có trường này
    #: và mặc định là ảnh — đúng sự thật cho những lượt bắt đầu từ khi chưa có
    #: video, chứ không phải một phỏng đoán.
    background_kind: BackgroundKind | None = None
    advisor_portrait_media_id: uuid.UUID | None = None
    #: Vùng đi được, đã đóng băng. `None` = chưa vẽ, tức cả bản đồ đi được.
    #: Xem `CollisionMap` bên `worlds/schemas.py` — cùng một hình dạng dữ liệu.
    collision: CollisionMap | None = None
    #: Âm thanh, đã đóng băng. Object rỗng = màn không có tiếng nào.
    audio: dict[str, AudioTrack] = {}
    #: URL từng khối tiếng, ĐÓNG BĂNG như ảnh nền: đổi file giữa chừng thì hai
    #: máy đang chơi cùng màn sẽ nghe hai thứ khác nhau.
    audio_urls: dict[str, str] = {}
    #: BỐ CỤC MÀN HỘI THOẠI, đã giải xong kế thừa từ màn đầu của world.
    #:
    #: `{}` = chưa ai căn gì, giao diện tự dùng bố cục mặc định của nó. Đóng
    #: băng ở dạng đã giải: lượt đang chơi không được đi hỏi lại màn 1, vì màn 1
    #: có thể đã đổi — hoặc bị xoá — từ lúc lượt này bắt đầu.
    dialogue: dict[str, Any] = {}
    #: URL ảnh nền từng khối, ĐÓNG BĂNG như `audio_urls` và vì cùng lý do: đổi
    #: file giữa chừng thì hai máy đang chơi cùng màn sẽ thấy hai thứ khác nhau.
    dialogue_urls: dict[str, str] = {}


class StageSnapshot(BaseModel):
    """Toàn bộ đề bài của một lượt chơi, an toàn gửi xuống mọi máy."""

    stage: SnapshotStage
    quests: list[SnapshotQuest]


# ==========================================================================
# Tiến độ trong trận
# ==========================================================================


class QuestionProgress(BaseModel):
    question_id: uuid.UUID
    #: Người này đã trả lời đúng câu này chưa.
    completed: bool
    #: Còn mấy lượt thử. `null` = không giới hạn.
    attempts_left: int | None
    #: ĐÃ thử mấy lần — số dòng `quest_answers` của chính người này cho câu này.
    #:
    #: Không suy được từ `attempts_left`: nhiệm vụ NPC không có trần nên trường
    #: đó là `null`, mà đó lại đúng là nhiệm vụ thử nhiều lần nhất.
    #:
    #: Màn hội thoại cần con số này để dựng lại đúng cuộc trò chuyện khi học
    #: sinh vào lại: lời của người canh giữ chọn theo `(question_id, attempt_no)`
    #: chứ không phải ngẫu nhiên, nên thiếu nó là mỗi lần vào lại NPC nói một
    #: câu khác cho cùng một lần thử. Xem GAME_DOMAIN §3f.
    attempts_used: int = 0
    #: Bài đang DỞ — đã chọn nhưng chưa nộp. `null` = chưa chọn gì.
    #:
    #: Có mặt để vào lại là khôi phục được đúng cái người chơi đang làm. Đây
    #: KHÔNG phải đáp án đúng: nó là chính bài của họ, gửi lên rồi gửi về.
    draft: dict[str, Any] | None = None


class QuestProgress(BaseModel):
    quest_id: uuid.UUID
    #: Người này đã đạt `pass_score` của nhiệm vụ chưa.
    completed: bool
    #: Nhiệm vụ đang KHOÁ với người này vì chưa qua NPC.
    #:
    #: Tính theo TỪNG NGƯỜI: đồng đội gặp NPC xong không mở khoá hộ được. Nhiệm
    #: vụ NPC không bao giờ khoá, và những lượt chơi cũ không có NPC thì mọi
    #: nhiệm vụ đều mở — không đóng cửa lại giữa chừng với người đang chơi.
    locked: bool = False
    questions: list[QuestionProgress]


class TeammateProgress(BaseModel):
    """Tiến độ của MỘT thành viên, nhìn từ ngoài.

    Chỉ có "xong nhiệm vụ nào", không có điểm và không có bài làm — bảng tiến độ
    đội trong trận không được thành chỗ chép bài.
    """

    user_id: uuid.UUID | None
    hero_key: str
    display_name: str
    is_bot: bool
    is_me: bool
    quest_ids_completed: list[uuid.UUID]


class RunCharacterOut(DialogueActor):
    """Nhân vật người chơi đã chọn cho world của màn này.

    Không thêm trường nào so với `DialogueActor` — giữ tên riêng vì `RunOut`
    dùng nó, và một cái tên nói đúng vai thì đọc chỗ gọi dễ hơn.
    """


class RunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    stage_id: uuid.UUID
    #: World chứa màn này. Có mặt để giao diện dựng được lối THOÁT — rời trận
    #: thì về đúng bản đồ world vừa đi ra, không phải về bản đồ thiên hà.
    #:
    #: Đặt ở đây chứ không nhét vào `snapshot`: snapshot là ĐỀ BÀI đóng băng,
    #: còn đây là dữ liệu điều hướng. Để trong snapshot thì mọi lượt chơi cũ
    #: đều thiếu trường này, mà nó thì không bao giờ đổi theo thời gian.
    world_id: uuid.UUID
    room_code: str
    status: Literal["playing", "won", "lost_time", "abandoned"]
    is_trial: bool

    snapshot: StageSnapshot

    #: Năng lượng đã cấp cho NGƯỜI GỌI trong lượt này. `0` = chưa qua NPC nên
    #: chưa được cấp — giao diện dựa vào đúng con số này để biết nên vẽ thanh
    #: năng lượng hay vẽ dòng "qua NPC để nhận".
    #: Giá MỘT lần xin giúp, đọc từ `balance_json` của world.
    #:
    #: Gửi kèm lượt chơi chứ không để giao diện tự biết: nó là một con số cân
    #: bằng, giáo viên đổi được cho từng world, và một bản chép ở client thì sẽ
    #: nói sai đúng vào cái world vừa được chỉnh.
    hint_cost: int = 0
    my_energy_granted: int
    #: Còn lại bao nhiêu sau khi tiêu cho các hành động trợ giúp.
    my_energy_remaining: int

    #: Chỗ nhân vật của NGƯỜI GỌI đang đứng. `null` = chưa đi đâu, cảnh dùng
    #: chỗ xuất phát mặc định của nó.
    my_pos_x: int | None = None
    my_pos_y: int | None = None
    #: Số giây còn lại, tính từ `started_at`. Server là nguồn duy nhất của thời
    #: gian — đồng hồ trên máy người chơi chỉ để hiển thị cho mượt.
    seconds_remaining: int
    started_at: datetime

    #: Nhân vật người gọi đã chọn cho world này. `None` = chưa chọn, và cảnh
    #: chơi vẽ ký hiệu mặc định.
    #:
    #: Ở `RunOut` chứ không trong `snapshot`, cùng lý do với `world_id`:
    #: snapshot là ĐỀ BÀI đóng băng, còn nhân vật là lựa chọn của người chơi và
    #: đổi được giữa hai lượt.
    character: RunCharacterOut | None = None

    #: Tiến độ của CHÍNH người gọi.
    my_progress: list[QuestProgress]
    team: list[TeammateProgress]


# ==========================================================================
# Nộp bài
# ==========================================================================


class SavePositionIn(BaseModel):
    """Chỗ nhân vật đang đứng, hệ toạ độ thế giới 3200×1800."""

    x: int = Field(ge=0, le=3200)
    y: int = Field(ge=0, le=1800)


class SaveDraftIn(BaseModel):
    """Lựa chọn đang dở của một câu. Không chấm gì cả."""

    response: dict[str, Any] | None = None


class TranslationOut(BaseModel):
    """Bản dịch của một câu hỏi, sau khi đã trả bằng năng lượng."""

    text: str
    #: Năng lượng còn lại SAU khi trừ. Trả về ngay để thanh HUD không phải hỏi
    #: lại — và để con số trên màn hình không lệch với con số ở server dù chỉ
    #: một nhịp.
    my_energy_remaining: int


class SubmitQuestOut(BaseModel):
    """Phản hồi khi nộp CẢ MỘT NHIỆM VỤ.

    ⚠️ KHÔNG điểm, KHÔNG đáp án, KHÔNG giải thích, KHÔNG điểm chiến lực — xem
    ghi chú đầu file. Những trường dưới đây chỉ nói XONG hay CHƯA.

    Mang đủ để màn chơi tự cập nhật, KHÔNG phải gọi thêm `GET /runs/{id}`. Lần
    nộp nào cũng tải lại cả lượt chơi là gửi lại 66 KB, trong đó 62 KB là đề bài
    đã đóng băng và không bao giờ đổi trong suốt một lượt — mỗi câu trả lời của
    mỗi học sinh, suốt cả buổi.
    """

    #: Cả nhiệm vụ đã đạt điểm qua ải chưa — đây là thứ hiện "MISSION COMPLETE".
    quest_completed: bool
    #: Còn mấy lần nộp NHIỆM VỤ nữa. `null` = không giới hạn, `0` = đã khoá.
    attempts_left: int | None
    #: Năng lượng CỦA CHÍNH người nộp, còn lại sau lần nộp này.
    #:
    #: Nộp bài không tiêu năng lượng, nhưng con số vẫn đi kèm: chính lần nộp làm
    #: xong nhiệm vụ NPC là lần năng lượng được CẤP, và giao diện phải thấy ngay.
    my_energy: int

    #: Tiến độ của CHÍNH nhiệm vụ vừa nộp, sau khi chấm.
    #:
    #: `completed` ở đây là vòng TỐT NHẤT (đã qua một lần thì mãi là đã qua),
    #: khác với `quest_completed` ở trên — cái đó nói về đúng lần nộp này.
    quest: QuestProgress

    #: Cổng NPC đã mở với người này chưa, tính SAU lần nộp này.
    #:
    #: Một cờ thay cho cả danh sách: mở khoá là mở HẾT, nên màn chơi chỉ cần
    #: biết có hay không rồi tự gỡ ổ khoá trên mọi nhiệm vụ.
    unlocked: bool

    #: Trạng thái lượt chơi sau lần nộp — `playing`, `won`, ...
    #:
    #: Câu trả lời cuối cùng có thể là câu làm xong cả màn, và lúc đó `settle_run`
    #: chốt lượt ngay trong chính request này.
    run_status: str

    #: Quỹ năng lượng được CẤP cho người này, sau lần nộp.
    #:
    #: Đi cùng `my_energy` vì chính lần nộp làm xong nhiệm vụ NPC là lần quỹ
    #: được cấp: trước đó nó bằng 0. Thiếu nó thì ô năng lượng trên HUD mất mẫu
    #: số đúng vào giây nó vừa có nghĩa lần đầu.
    my_energy_granted: int


# ==========================================================================
# Kết thúc & xem lại
# ==========================================================================


class RunResultPlayer(BaseModel):
    user_id: uuid.UUID | None
    hero_key: str
    display_name: str
    quests_completed: int
    score: float
    max_score: int
    skill_pts_earned: int
    got_map_shard: bool


class RunResultOut(BaseModel):
    status: Literal["playing", "won", "lost_time", "abandoned"]
    #: Mảnh bản đồ của màn này — chỉ trao khi thắng.
    map_shard_index: int | None
    duration_seconds: int | None
    #: Năng lượng còn lại của NGƯỜI GỌI lúc chốt màn.
    my_energy_remaining: int
    players: list[RunResultPlayer]
    #: Điểm chiến lực của người gọi trong world này, SAU khi đã cộng.
    my_world_skill_pts: int
    my_shards_owned: int
    world_shard_total: int


class ReviewAttempt(BaseModel):
    attempt_no: int
    response: dict[str, Any] | None
    is_correct: bool
    score: float


class ReviewQuestion(BaseModel):
    question_id: uuid.UUID
    type: str
    content: dict[str, Any]
    points: int
    #: Giờ mới lộ — chỉ sau khi lượt chơi kết thúc.
    answer: dict[str, Any] | None
    explanation: str | None
    attempts: list[ReviewAttempt]
    earned: float
    skill_pts_awarded: int
    #: CÁCH RA ĐỀ, lấy từ đề bài đã đóng băng — không hỏi lại bảng `questions`.
    #:
    #: Màn xem lại phải vẽ đúng câu hỏi mà học sinh ĐÃ làm. Giáo viên đổi một
    #: câu từ đọc sang nghe sau đó thì bài chữa vẫn phải là bài họ đã ngồi làm,
    #: không phải một câu khác mang cùng mã.
    prompt_kind: Literal["text", "audio"] = "text"
    show_transcript: bool = False
    audio_url: str | None = None


class ReviewQuest(BaseModel):
    quest_id: uuid.UUID
    order_index: int
    quest_object_key: str
    #: Tên nhiệm vụ do giáo viên đặt. Rỗng thì giao diện lùi về nhãn dịch hoặc
    #: về chính `quest_object_key` — cùng luật với trong trận (`questLabel`).
    name_i18n: dict[str, str] = Field(default_factory=dict)
    phase: Literal["advisor", "main"]
    pass_score: int
    earned: float
    completed: bool
    questions: list[ReviewQuestion]


class ReviewOut(BaseModel):
    """Màn xem lại (S6b) — CHỈ bài của chính người gọi."""

    run_id: uuid.UUID
    #: Hai khoá để dựng hai cái nút ở cuối màn — "Chơi lại màn này" và
    #: "Về world". Trả kèm ở đây chứ không bắt giao diện gọi thêm một vòng:
    #: màn xem lại vốn đã biết mình thuộc lượt chơi nào, và một vòng gọi nữa
    #: chỉ để lấy hai UUID là một vòng thừa.
    stage_id: uuid.UUID
    world_id: uuid.UUID
    stage_name_i18n: dict[str, str]
    status: str
    quests: list[ReviewQuest] = Field(default_factory=list)
    total_earned: float
    total_max: int
    skill_pts_earned: int


# ==========================================================================
# Duyệt nội dung cho người chơi (S0-S2)
# ==========================================================================


class PlayStageOut(BaseModel):
    """Một màn chơi, nhìn từ phía học sinh."""

    id: uuid.UUID
    order_index: int
    name_i18n: dict[str, str]
    synopsis_i18n: dict[str, str]
    map_shard_index: int
    quest_count: int

    #: Ảnh nền của màn — chính tấm ảnh người chơi sẽ thấy khi vào chơi, dùng
    #: luôn làm mặt của màn trên minimap.
    #:
    #: Không thêm cột "ảnh đại diện màn" riêng: minimap là lời hứa về nơi sắp
    #: đến, mà nơi sắp đến TRÔNG NHƯ THẾ NÀO thì đã có sẵn một câu trả lời đúng.
    #: Một cột nữa chỉ tạo ra cơ hội cho hai ảnh nói hai điều khác nhau.
    background_url: str | None = None
    #: Nền của màn có thể là VIDEO. Trên minimap nó được ghim ở khung hình đầu —
    #: nhiều màn hiện cùng lúc, cho tất cả chạy vòng lặp là bắt máy học sinh
    #: giải mã N luồng video để vẽ mấy vòng tròn nhỏ.
    background_kind: BackgroundKind | None = None

    #: Điểm chiến lực cần để mở, đã tính từ balance_json của world.
    required_skill_pts: int
    #: Đủ điểm để vào chưa. Giáo viên và admin chơi thử thì luôn true.
    unlocked: bool
    #: Đã lấy được mảnh bản đồ của màn này chưa.
    completed: bool
    times_played: int
    best_score: int


class PlayChapterOut(BaseModel):
    id: uuid.UUID
    order_index: int
    name_i18n: dict[str, str]
    synopsis_i18n: dict[str, str]
    stages: list[PlayStageOut]
    #: Ảnh của chương, hiện ở hàng chương trong phòng chờ.
    cover_url: str | None = None
    #: Ảnh nền của minimap — bảng màn chơi mở ra khi bấm vào chương.
    minimap_url: str | None = None


class PlayWorldOut(BaseModel):
    """Một world trên bản đồ thiên hà (S0)."""

    id: uuid.UUID
    name_i18n: dict[str, str]
    story_i18n: dict[str, str]
    difficulty: str
    cover_url: str | None = None
    shard_total: int

    #: Chỗ đứng trên bản đồ, theo hệ toạ độ 3200×1800. None = chưa đặt, màn
    #: chọn world tự rải đều.
    scene_x: int | None = None
    scene_y: int | None = None
    #: Đường kính vòng tròn. None = mặc định của màn.
    icon_size: int | None = None
    pulse_percent: int | None = None
    pulse_period_ms: int | None = None

    #: Khoá HAY KHÔNG — giá trị đã tính, không phải cột thô.
    #:
    #: Khoá khi giáo viên bấm khoá, HOẶC khi world chưa có màn nào phát hành.
    #: Vế thứ hai không suy ra được ở phía giao diện: nó phải đếm màn, mà đếm
    #: màn thì phải hỏi database.
    is_locked: bool = False
    #: Người đang gọi có vào được world này không.
    #:
    #: Tách khỏi `is_locked` vì hai câu hỏi khác nhau: ổ khoá là thứ VẼ RA cho
    #: mọi người thấy, còn vào được hay không thì giáo viên chơi thử khác học
    #: sinh. Trộn hai thứ vào một cờ là hoặc giáo viên không xem trước được,
    #: hoặc học sinh đi thẳng vào world chưa phát hành.
    can_enter: bool = True
    #: Vẽ vành tròn (khung bao + thanh tiến độ) quanh world.
    show_ring: bool = False

    #: Tiến độ của CHÍNH người gọi, không phải của cả phòng.
    my_skill_pts: int
    my_shards: int
    stages_total: int
    stages_published: int


class PlayGalaxyOut(BaseModel):
    """Toàn bộ màn CHỌN WORLD (S0) trong một lần gọi.

    Nền, nhạc và danh sách world về cùng nhau vì chúng dựng nên MỘT màn hình.
    Tách làm hai lượt gọi thì màn hình vẽ hai lần, và có một khoảnh khắc các
    world nổi trên nền trống.
    """

    id: uuid.UUID
    name_i18n: dict[str, str]
    description_i18n: dict[str, str]
    background_url: str | None = None
    #: Nền là ảnh hay video. Xem `BackgroundKind` bên `worlds/schemas.py`.
    background_kind: BackgroundKind | None = None
    #: Nhạc nền của bản đồ. Object rỗng = màn hình này im lặng.
    audio: dict[str, AudioTrack] = {}
    audio_urls: dict[str, str] = {}

    #: Khung tiêu đề và khung mô tả. `*_url` rỗng thì giao diện vẽ một tấm nền
    #: trơn — màn hình vẫn chạy được trước khi ai kịp tải ảnh trang trí lên.
    title_url: str | None = None
    title_x: int | None = None
    title_y: int | None = None
    title_width: int | None = None
    title_color: str | None = None
    title_font: int | None = None
    desc_url: str | None = None
    desc_x: int | None = None
    desc_y: int | None = None
    desc_width: int | None = None
    desc_color: str | None = None
    desc_font: int | None = None

    worlds: list[PlayWorldOut]


class PlayFrameOut(BaseModel):
    """Một khung chữ của phòng chờ, ĐÃ giải xong việc thừa kế.

    World để trống trường nào thì lấy của thiên hà. Giải ở server chứ không ở
    giao diện: màn của học sinh không nạp thiên hà, và bắt nó nạp thêm chỉ để
    biết một cái nền là thêm một vòng gọi cho mỗi lần mở world.
    """

    url: str | None = None
    x: int | None = None
    y: int | None = None
    width: int | None = None
    height: int | None = None
    color: str | None = None
    font: int | None = None


class PlayLobbyOut(BaseModel):
    """Toàn bộ phần TRÌNH BÀY của phòng chờ."""

    background_url: str | None = None
    #: Nền là ảnh hay video — đã giải xong việc thừa kế nền từ thiên hà.
    background_kind: BackgroundKind | None = None
    title: PlayFrameOut
    desc: PlayFrameOut
    #: Bố cục các khối kéo thả — nguyên `worlds.lobby_json`.
    layout: dict[str, Any] = {}
    #: Ảnh nền của từng khối, tra sẵn theo `media_id` bên trong `layout`.
    urls: dict[str, str] = {}
    #: Nhạc nền của phòng chờ. Object rỗng = im lặng.
    audio: dict[str, AudioTrack] = {}
    audio_urls: dict[str, str] = {}


class PlayRankOut(BaseModel):
    """Một dòng bảng xếp hạng của world."""

    user_id: uuid.UUID
    display_name: str
    skill_pts: int
    shards: int
    #: Chính người đang xem. Giao diện làm nổi dòng này lên.
    is_me: bool = False


class PlayCharacterOut(BaseModel):
    """Một nhân vật ở màn chọn nhân vật.

    Chỉ ba thứ người chơi cần để chọn: mặt, tên, và vài dòng giới thiệu.
    Spritesheet KHÔNG gửi kèm — chúng chỉ có ích khi đã vào màn chơi, và gửi cả
    bộ cho năm nhân vật là kéo về mấy megabyte để người ta nhìn năm cái mặt.
    """

    id: uuid.UUID
    name_i18n: dict[str, str]
    bio_i18n: dict[str, str]
    avatar_url: str | None = None


class PickCharacterIn(BaseModel):
    character_id: uuid.UUID


class PlayWorldDetailOut(PlayWorldOut):
    """Chi tiết một world: chương, màn chơi, tiến độ (S1-S2)."""

    #: Nhân vật world này cho dùng, và cái người gọi đã chọn.
    characters: list[PlayCharacterOut] = []
    my_character_id: uuid.UUID | None = None

    #: Phần trình bày: nền, hai khung chữ, bố cục các khối.
    lobby: PlayLobbyOut
    #: Năm người dẫn đầu world này, và tổng số người đã từng chơi.
    leaderboard: list[PlayRankOut] = []
    players_total: int = 0

    chapters: list[PlayChapterOut]
    #: Đủ mảnh bản đồ để mở Cánh cổng Thời gian chưa.
    gate_ready: bool

    # ----------------------------------------------------------------------
    # Năm con số của BẢNG THÀNH TÍCH ở phòng chờ.
    #
    # Chỉ có ở màn CHI TIẾT world, không có ở bản đồ thiên hà: mỗi con số là
    # một phép đếm riêng, mà bản đồ vẽ mọi world cùng lúc — nhét chúng vào đó
    # là nhân số câu truy vấn lên theo số world để hiện những con số không ai
    # nhìn thấy trên bản đồ.
    #
    # Điểm chiến lực và mảnh bản đồ đã có sẵn ở `PlayWorldOut`.
    # ----------------------------------------------------------------------

    #: Nhãn cấp độ do người dựng đặt. Rỗng = giao diện tự dùng `difficulty`.
    level_i18n: dict[str, str] = Field(default_factory=dict)

    #: Sao đã đạt / tổng sao của world. Tổng là thật (cộng `stages.star_max`);
    #: phần đã đạt còn đứng ở 0 cho tới khi luật chấm sao hoàn thiện.
    my_stars: int = 0
    star_total: int = 0

    #: Nhiệm vụ đã từng động tới / tổng nhiệm vụ của các màn đã phát hành.
    #: Tiến độ world = thương của hai số này.
    my_quests_played: int = 0
    quest_total: int = 0

    #: Màn người này đang chơi DỞ và VẪN CÒN GIỜ. `None` = không có màn nào dở.
    #:
    #: Nút Chơi ngay ở phòng chờ nhảy thẳng vào đây. Không có nó thì người chơi
    #: đóng nhầm tab giữa chừng, vào lại phòng chờ, bấm Chơi ngay — và rơi vào
    #: màn mở CAO NHẤT, không phải màn họ đang làm dở.
    #:
    #: Chỉ trả về màn còn giờ: lượt đã hết giờ thì bấm vào cũng là bắt đầu lại
    #: từ đầu, nên dẫn người ta tới đó là hứa một thứ không có.
    resume_stage_id: uuid.UUID | None = None


# --------------------------------------------------------------------------
# NHẬT KÝ HỘI THOẠI
# --------------------------------------------------------------------------


class DialogueLineIn(BaseModel):
    """Một câu vừa được nói ra, gửi lên để ghi lại."""

    #: `npc` hoặc `player`.
    role: str = Field(max_length=8)
    #: `intro` · `prompt` · `answer` · `verdict` · `outro`.
    kind: str = Field(max_length=16)
    text: str = ""
    #: Dòng phụ nhỏ dưới câu chính — bản dịch, hay transcript của câu nghe.
    aside: str | None = None
    #: `praise` · `wrong` · `None`. Chỉ đổi màu chữ.
    tone: str | None = Field(default=None, max_length=8)
    question_id: uuid.UUID | None = None
    audio_url: str | None = None


class AppendDialogueIn(BaseModel):
    """Một mẻ câu nói. Gửi cả mẻ chứ không từng câu một.

    Một lượt hỏi-đáp sinh ra hai ba câu liền nhau, và ba lượt gọi mạng cho một
    cú bấm là ba chỗ để hỏng lẻ tẻ — nửa đoạn chat ghi được, nửa không.
    """

    lines: list[DialogueLineIn] = []


class DialogueLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    seq: int
    role: str
    kind: str
    text: str
    aside: str | None = None
    tone: str | None = None
    question_id: uuid.UUID | None = None
    audio_url: str | None = None


class DialogueThreadOut(BaseModel):
    quest_id: uuid.UUID
    lines: list[DialogueLineOut] = []

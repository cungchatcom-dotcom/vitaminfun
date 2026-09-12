"""NHẬT KÝ HỘI THOẠI — từng câu nói giữa học sinh và người canh giữ.

## Vì sao LƯU, chứ không dựng lại từ `quest_answers`

Gần hết đoạn chat suy ra được từ thứ đã có: đề bài nằm trong `snapshot_json`,
bài làm nằm trong `quest_answers`, đúng hay sai nằm ở `is_correct`. Cám dỗ là
viết một hàm dựng lại đoạn chat khi học sinh vào lại, và khỏi cần bảng này.

Nhưng làm thế là có HAI đường sinh ra cùng một đoạn chat: đường đang chạy lúc
chơi, và đường dựng lại lúc vào lại. Hai đường thì có ngày chúng khác nhau, mà
khác nhau ở đây nghĩa là học sinh cuộn lên và đọc được một cuộc trò chuyện
**không phải cuộc họ vừa trải qua**. Không có lỗi nào ném ra, và không ai
đối chiếu lại.

Có những câu còn không suy lại được: lời khen chê của người canh giữ bốc ngẫu
nhiên trong năm câu, bản dịch học sinh mua bằng năng lượng, câu mở đầu của
nhiệm vụ. Nói gì thì ghi đúng cái đó.

Một nhiệm vụ vài câu hỏi, mỗi câu vài dòng — đổi lại vài chục dòng chữ ngắn cho
mỗi học sinh mỗi màn. Rẻ.

## Đoạn chat thuộc về (LƯỢT CHƠI, HỌC SINH, NHIỆM VỤ)

Một lượt chơi có nhiều học sinh, mỗi em nói chuyện riêng với người canh giữ của
từng nhiệm vụ. Thiếu `user_id` thì cả đội nhìn thấy chung một đoạn chat trộn
lẫn; thiếu `quest_id` thì bảy nhiệm vụ dồn vào một cuộn dài.
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class DialogueRole:
    """Ai nói câu này."""

    NPC = "npc"
    PLAYER = "player"
    ALL = (NPC, PLAYER)


class DialogueKind:
    """Câu này là loại gì — dùng để VẼ, không dùng để chấm.

    Giữ riêng khỏi `role` vì cùng một người nói ra nhiều loại câu khác nhau, và
    mỗi loại hiện một kiểu: lời phán có màu, đề bài có nút nghe, bản dịch nằm
    nhỏ dưới câu chính.
    """

    #: Câu mở đầu nhiệm vụ, người canh giữ chào.
    INTRO = "intro"
    #: Đề bài.
    PROMPT = "prompt"
    #: Bài làm của học sinh.
    ANSWER = "answer"
    #: Người canh giữ nói đúng hay sai.
    VERDICT = "verdict"
    #: Lời chia tay, ngay trước khi trao sổ tay.
    OUTRO = "outro"
    ALL = (INTRO, PROMPT, ANSWER, VERDICT, OUTRO)


class DialogueMessage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "dialogue_messages"
    __table_args__ = (
        # Thứ tự trong một đoạn chat là thứ tự NGƯỜI TA NÓI, không phải thứ tự
        # dòng rơi vào database. Mạng chập chờn thì hai câu có thể tới ngược
        # nhau, và `created_at` sẽ xếp sai. `seq` do chỗ gọi đánh số.
        UniqueConstraint(
            "stage_run_id", "user_id", "quest_id", "seq", name="uq_dialogue_message_seq"
        ),
        Index("ix_dialogue_messages_thread", "stage_run_id", "user_id", "quest_id"),
    )

    stage_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stage_runs.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    quest_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    #: Thứ tự trong đoạn chat, bắt đầu từ 0. Chỗ gọi đánh số.
    seq: Mapped[int] = mapped_column(Integer, nullable=False)

    role: Mapped[str] = mapped_column(String(8), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)

    text: Mapped[str] = mapped_column(Text, nullable=False)

    #: Dòng phụ nhỏ dưới câu chính — bản dịch, hoặc transcript của câu nghe.
    #:
    #: Cùng MỘT tin nhắn chứ không phải tin nhắn thứ hai: bản dịch không phải
    #: một câu người canh giữ nói ra, nó là chú thích cho câu vừa nói. Tách ra
    #: thành tin riêng là dựng thêm một người thứ ba trong cuộc trò chuyện.
    aside: Mapped[str | None] = mapped_column(Text, nullable=True)

    #: `praise` · `wrong` · `None`. Chỉ đổi MÀU CHỮ, không đổi bố cục.
    tone: Mapped[str | None] = mapped_column(String(8), nullable=True)

    #: Câu hỏi sinh ra tin nhắn này, nếu có. Để sau này lọc lại theo câu.
    question_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    #: Tệp nghe đi kèm — đề bài dạng nghe, hay tiếng đọc đã sinh.
    audio_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<DialogueMessage {self.role}#{self.seq} {self.kind}>"

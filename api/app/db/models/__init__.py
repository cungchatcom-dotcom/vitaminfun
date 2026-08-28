"""Gom toàn bộ model về một chỗ.

Alembic autogenerate chỉ thấy bảng nào đã được import vào metadata. Model mới
mà quên thêm vào đây thì `alembic revision --autogenerate` sẽ lặng lẽ sinh ra
migration RỖNG — không báo lỗi gì cả.
"""

from app.db.base import Base
from app.db.models.content import (
    DEFAULT_QUESTION_POINTS,
    Chapter,
    Difficulty,
    Galaxy,
    PublishStatus,
    Quest,
    QuestPhase,
    QuestQuestion,
    Stage,
    Universe,
    World,
)
from app.db.models.media import MediaAsset, MediaKind
from app.db.models.character import Character, CharacterAction, WorldCharacter
from app.db.models.progress import MapShardOwned, StageProgress, WorldProgress
from app.db.models.question import Question, QuestionStatus, QuestionType
from app.db.models.room import HeroKey, Room, RoomMember, RoomMode, RoomStatus
from app.db.models.run import QuestAnswer, RunStatus, StageRun, StageRunPlayer
from app.db.models.user import User, UserRole, UserStatus

__all__ = [
    "Base",
    # nội dung
    "Universe",
    "Galaxy",
    "Character",
    "CharacterAction",
    "WorldCharacter",
    "World",
    "Chapter",
    "Stage",
    "Quest",
    "QuestQuestion",
    "DEFAULT_QUESTION_POINTS",
    "PublishStatus",
    "Difficulty",
    "QuestPhase",
    # kho câu hỏi & media
    "Question",
    "QuestionStatus",
    "QuestionType",
    "MediaAsset",
    "MediaKind",
    # tiến trình
    "WorldProgress",
    "MapShardOwned",
    "StageProgress",
    # phòng
    "Room",
    "RoomMember",
    "RoomMode",
    "RoomStatus",
    "HeroKey",
    # lượt chơi
    "StageRun",
    "StageRunPlayer",
    "QuestAnswer",
    "RunStatus",
    # người dùng
    "User",
    "UserRole",
    "UserStatus",
]

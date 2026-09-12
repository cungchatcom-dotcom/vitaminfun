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
    QUEST_OBJECT_NPC,
    QuestQuestion,
    Stage,
    Universe,
    World,
)
from app.db.models.media import MediaAsset, MediaKind
from app.db.models.character import Character, CharacterAction, WorldCharacter
from app.db.models.progress import MapShardOwned, StageProgress, WorldProgress
from app.db.models.question import PromptKind, Question, QuestionStatus, QuestionType
from app.db.models.room import HeroKey, Room, RoomMember, RoomMode, RoomStatus
from app.db.models.dialogue_message import DialogueKind, DialogueMessage, DialogueRole
from app.db.models.run import QuestAnswer, QuestDraft, RunStatus, StageRun, StageRunPlayer
from app.db.models.user import User, UserRole, UserStatus
from app.db.models.question_audio import AudioTarget, QuestionAudio
from app.db.models.voice_line import VoiceLine, line_hash
from app.db.models.voice import Voice, VoiceAge, VoiceGender
from app.db.models.site import SiteConfig

__all__ = [
    "Base",
    "SiteConfig",
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
    "QUEST_OBJECT_NPC",
    # kho câu hỏi & media
    "Question",
    "PromptKind",
    "AudioTarget",
    "QuestionAudio",
    "Voice",
    "VoiceLine",
    "line_hash",
    "VoiceAge",
    "VoiceGender",
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
    "DialogueKind",
    "DialogueMessage",
    "DialogueRole",
    "QuestAnswer",
    "QuestDraft",
    "RunStatus",
    # người dùng
    "User",
    "UserRole",
    "UserStatus",
]

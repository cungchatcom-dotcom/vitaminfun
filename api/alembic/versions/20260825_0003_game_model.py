"""Cây nội dung, tiến trình, phòng chơi, lượt chơi — 14 bảng

Sinh bằng `alembic revision --autogenerate`, đã đọc lại từng dòng.

Điểm cần chú ý khi đọc lại:
  - `uq_map_shards_world_user_index`  -> luật "đủ 30 mảnh KHÁC NHAU"
  - `uq_room_members_room_hero`       -> luật "mỗi người một nhân vật"
  - `uq_quest_answers_attempt`        -> chặn nộp trùng do bấm hai lần
  - `uq_quest_answers_correct_once`   -> partial index, "đúng rồi không ăn điểm lần hai"

Revision ID: 0003_game_model
Revises: 0002_media_and_questions
Create Date: 2026-08-25
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0003_game_model'
down_revision: str | None = '0002_media_and_questions'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('universes',
    sa.Column('name_i18n', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('description_i18n', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("status IN ('draft', 'published')", name=op.f('ck_universes_status_valid')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_universes'))
    )
    op.create_table('galaxies',
    sa.Column('universe_id', sa.UUID(), nullable=False),
    sa.Column('name_i18n', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('description_i18n', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("status IN ('draft', 'published')", name=op.f('ck_galaxies_status_valid')),
    sa.ForeignKeyConstraint(['universe_id'], ['universes.id'], name=op.f('fk_galaxies_universe_id_universes'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_galaxies'))
    )
    op.create_index(op.f('ix_galaxies_universe_id'), 'galaxies', ['universe_id'], unique=False)
    op.create_table('worlds',
    sa.Column('galaxy_id', sa.UUID(), nullable=False),
    sa.Column('name_i18n', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('story_i18n', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('cover_media_id', sa.UUID(), nullable=True),
    sa.Column('difficulty', sa.String(length=16), nullable=False),
    sa.Column('age_min', sa.Integer(), nullable=True),
    sa.Column('age_max', sa.Integer(), nullable=True),
    sa.Column('price_amount', sa.Numeric(precision=12, scale=2), nullable=True),
    sa.Column('price_currency', sa.String(length=3), nullable=True),
    sa.Column('shard_total', sa.Integer(), nullable=False),
    sa.Column('unlock_requires_world_id', sa.UUID(), nullable=True),
    sa.Column('balance_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("difficulty IN ('easy', 'medium', 'hard')", name=op.f('ck_worlds_difficulty_valid')),
    sa.CheckConstraint("status IN ('draft', 'published')", name=op.f('ck_worlds_status_valid')),
    sa.CheckConstraint('shard_total > 0', name=op.f('ck_worlds_shard_total_positive')),
    sa.ForeignKeyConstraint(['cover_media_id'], ['media_assets.id'], name=op.f('fk_worlds_cover_media_id_media_assets'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['galaxy_id'], ['galaxies.id'], name=op.f('fk_worlds_galaxy_id_galaxies'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['unlock_requires_world_id'], ['worlds.id'], name=op.f('fk_worlds_unlock_requires_world_id_worlds'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_worlds'))
    )
    op.create_index(op.f('ix_worlds_galaxy_id'), 'worlds', ['galaxy_id'], unique=False)
    op.create_table('chapters',
    sa.Column('world_id', sa.UUID(), nullable=False),
    sa.Column('order_index', sa.Integer(), nullable=False),
    sa.Column('name_i18n', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('synopsis_i18n', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['world_id'], ['worlds.id'], name=op.f('fk_chapters_world_id_worlds'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_chapters')),
    sa.UniqueConstraint('world_id', 'order_index', name='uq_chapters_world_order')
    )
    op.create_index(op.f('ix_chapters_world_id'), 'chapters', ['world_id'], unique=False)
    op.create_table('world_progress',
    sa.Column('world_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('skill_pts', sa.Integer(), nullable=False),
    sa.Column('stages_completed', sa.Integer(), nullable=False),
    sa.Column('first_played_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('last_played_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('gate_opened_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('skill_pts >= 0', name=op.f('ck_world_progress_skill_pts_non_negative')),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_world_progress_user_id_users'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['world_id'], ['worlds.id'], name=op.f('fk_world_progress_world_id_worlds'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_world_progress')),
    sa.UniqueConstraint('world_id', 'user_id', name='uq_world_progress_world_user')
    )
    op.create_index(op.f('ix_world_progress_user_id'), 'world_progress', ['user_id'], unique=False)
    op.create_index(op.f('ix_world_progress_world_id'), 'world_progress', ['world_id'], unique=False)
    op.create_table('stages',
    sa.Column('chapter_id', sa.UUID(), nullable=False),
    sa.Column('order_index', sa.Integer(), nullable=False),
    sa.Column('name_i18n', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('synopsis_i18n', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('scene_key', sa.String(length=64), nullable=False),
    sa.Column('background_media_id', sa.UUID(), nullable=True),
    sa.Column('time_limit_seconds', sa.Integer(), nullable=False),
    sa.Column('initial_team_energy', sa.Integer(), nullable=False),
    sa.Column('required_skill_pts', sa.Integer(), nullable=True),
    sa.Column('skill_pts_max', sa.Integer(), nullable=False),
    sa.Column('map_shard_index', sa.Integer(), nullable=False),
    sa.Column('min_players', sa.Integer(), nullable=False),
    sa.Column('max_players', sa.Integer(), nullable=False),
    sa.Column('advisor_npc_key', sa.String(length=64), nullable=True),
    sa.Column('advisor_portrait_media_id', sa.UUID(), nullable=True),
    sa.Column('cluebook_i18n', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("status IN ('draft', 'published')", name=op.f('ck_stages_status_valid')),
    sa.CheckConstraint('initial_team_energy > 0', name=op.f('ck_stages_energy_positive')),
    sa.CheckConstraint('map_shard_index >= 1', name=op.f('ck_stages_shard_index_positive')),
    sa.CheckConstraint('max_players >= min_players', name=op.f('ck_stages_max_players_gte_min')),
    sa.CheckConstraint('min_players >= 1', name=op.f('ck_stages_min_players_positive')),
    sa.CheckConstraint('time_limit_seconds > 0', name=op.f('ck_stages_time_limit_positive')),
    sa.ForeignKeyConstraint(['advisor_portrait_media_id'], ['media_assets.id'], name=op.f('fk_stages_advisor_portrait_media_id_media_assets'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['background_media_id'], ['media_assets.id'], name=op.f('fk_stages_background_media_id_media_assets'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['chapter_id'], ['chapters.id'], name=op.f('fk_stages_chapter_id_chapters'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_stages')),
    sa.UniqueConstraint('chapter_id', 'order_index', name='uq_stages_chapter_order')
    )
    op.create_index(op.f('ix_stages_chapter_id'), 'stages', ['chapter_id'], unique=False)
    op.create_table('quests',
    sa.Column('stage_id', sa.UUID(), nullable=False),
    sa.Column('question_id', sa.UUID(), nullable=False),
    sa.Column('order_index', sa.Integer(), nullable=False),
    sa.Column('phase', sa.String(length=16), nullable=False),
    sa.Column('quest_object_key', sa.String(length=64), nullable=False),
    sa.Column('scene_x', sa.Integer(), nullable=True),
    sa.Column('scene_y', sa.Integer(), nullable=True),
    sa.Column('energy_cost', sa.Integer(), nullable=False),
    sa.Column('points_override', sa.Integer(), nullable=True),
    sa.Column('grants_map_shard', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("phase IN ('advisor', 'main')", name=op.f('ck_quests_phase_valid')),
    sa.CheckConstraint('energy_cost >= 0', name=op.f('ck_quests_energy_cost_non_negative')),
    sa.ForeignKeyConstraint(['question_id'], ['questions.id'], name=op.f('fk_quests_question_id_questions'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['stage_id'], ['stages.id'], name=op.f('fk_quests_stage_id_stages'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_quests')),
    sa.UniqueConstraint('stage_id', 'order_index', name='uq_quests_stage_order'),
    sa.UniqueConstraint('stage_id', 'quest_object_key', name='uq_quests_stage_object')
    )
    op.create_index('ix_quests_question', 'quests', ['question_id'], unique=False)
    op.create_index(op.f('ix_quests_stage_id'), 'quests', ['stage_id'], unique=False)
    op.create_table('rooms',
    sa.Column('code', sa.String(length=16), nullable=False),
    sa.Column('stage_id', sa.UUID(), nullable=False),
    sa.Column('host_user_id', sa.UUID(), nullable=False),
    sa.Column('mode', sa.String(length=16), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('auto_start_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('is_trial', sa.Boolean(), nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("mode IN ('single', 'multi')", name=op.f('ck_rooms_mode_valid')),
    sa.CheckConstraint("status IN ('waiting', 'starting', 'playing', 'finished', 'abandoned')", name=op.f('ck_rooms_status_valid')),
    sa.ForeignKeyConstraint(['host_user_id'], ['users.id'], name=op.f('fk_rooms_host_user_id_users'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['stage_id'], ['stages.id'], name=op.f('fk_rooms_stage_id_stages'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_rooms'))
    )
    op.create_index(op.f('ix_rooms_code'), 'rooms', ['code'], unique=True)
    op.create_index(op.f('ix_rooms_host_user_id'), 'rooms', ['host_user_id'], unique=False)
    op.create_index(op.f('ix_rooms_is_trial'), 'rooms', ['is_trial'], unique=False)
    op.create_index(op.f('ix_rooms_stage_id'), 'rooms', ['stage_id'], unique=False)
    op.create_index(op.f('ix_rooms_status'), 'rooms', ['status'], unique=False)
    op.create_table('stage_progress',
    sa.Column('stage_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('best_score', sa.Integer(), nullable=False),
    sa.Column('best_quests_completed', sa.Integer(), nullable=False),
    sa.Column('times_played', sa.Integer(), nullable=False),
    sa.Column('skill_pts_earned_total', sa.Integer(), nullable=False),
    sa.Column('first_completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['stage_id'], ['stages.id'], name=op.f('fk_stage_progress_stage_id_stages'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_stage_progress_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_stage_progress')),
    sa.UniqueConstraint('stage_id', 'user_id', name='uq_stage_progress_stage_user')
    )
    op.create_index(op.f('ix_stage_progress_stage_id'), 'stage_progress', ['stage_id'], unique=False)
    op.create_index(op.f('ix_stage_progress_user_id'), 'stage_progress', ['user_id'], unique=False)
    op.create_table('room_members',
    sa.Column('room_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=True),
    sa.Column('hero_key', sa.String(length=16), nullable=False),
    sa.Column('is_bot', sa.Boolean(), nullable=False),
    sa.Column('is_ready', sa.Boolean(), nullable=False),
    sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('left_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("hero_key IN ('leo', 'maya', 'sam', 'jade')", name=op.f('ck_room_members_hero_key_valid')),
    sa.CheckConstraint('(is_bot AND user_id IS NULL) OR (NOT is_bot AND user_id IS NOT NULL)', name=op.f('ck_room_members_bot_has_no_user')),
    sa.ForeignKeyConstraint(['room_id'], ['rooms.id'], name=op.f('fk_room_members_room_id_rooms'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_room_members_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_room_members')),
    sa.UniqueConstraint('room_id', 'hero_key', name='uq_room_members_room_hero'),
    sa.UniqueConstraint('room_id', 'user_id', name='uq_room_members_room_user')
    )
    op.create_index(op.f('ix_room_members_room_id'), 'room_members', ['room_id'], unique=False)
    op.create_index(op.f('ix_room_members_user_id'), 'room_members', ['user_id'], unique=False)
    op.create_table('stage_runs',
    sa.Column('stage_id', sa.UUID(), nullable=False),
    sa.Column('room_id', sa.UUID(), nullable=False),
    sa.Column('snapshot_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('answer_key_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('team_energy_initial', sa.Integer(), nullable=False),
    sa.Column('team_energy_remaining', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('duration_seconds', sa.Integer(), nullable=True),
    sa.Column('is_trial', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("status IN ('playing', 'won', 'lost_energy', 'lost_time', 'abandoned')", name=op.f('ck_stage_runs_status_valid')),
    sa.CheckConstraint('team_energy_remaining >= 0', name=op.f('ck_stage_runs_energy_non_negative')),
    sa.ForeignKeyConstraint(['room_id'], ['rooms.id'], name=op.f('fk_stage_runs_room_id_rooms'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['stage_id'], ['stages.id'], name=op.f('fk_stage_runs_stage_id_stages'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_stage_runs'))
    )
    op.create_index(op.f('ix_stage_runs_is_trial'), 'stage_runs', ['is_trial'], unique=False)
    op.create_index(op.f('ix_stage_runs_room_id'), 'stage_runs', ['room_id'], unique=False)
    op.create_index(op.f('ix_stage_runs_stage_id'), 'stage_runs', ['stage_id'], unique=False)
    op.create_index(op.f('ix_stage_runs_status'), 'stage_runs', ['status'], unique=False)
    op.create_table('map_shards_owned',
    sa.Column('world_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('shard_index', sa.Integer(), nullable=False),
    sa.Column('stage_run_id', sa.UUID(), nullable=True),
    sa.Column('earned_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('shard_index >= 1', name=op.f('ck_map_shards_owned_shard_index_positive')),
    sa.ForeignKeyConstraint(['stage_run_id'], ['stage_runs.id'], name=op.f('fk_map_shards_owned_stage_run_id_stage_runs'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_map_shards_owned_user_id_users'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['world_id'], ['worlds.id'], name=op.f('fk_map_shards_owned_world_id_worlds'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_map_shards_owned')),
    sa.UniqueConstraint('world_id', 'user_id', 'shard_index', name='uq_map_shards_world_user_index')
    )
    op.create_index(op.f('ix_map_shards_owned_user_id'), 'map_shards_owned', ['user_id'], unique=False)
    op.create_index(op.f('ix_map_shards_owned_world_id'), 'map_shards_owned', ['world_id'], unique=False)
    op.create_table('quest_answers',
    sa.Column('stage_run_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('quest_id', sa.UUID(), nullable=False),
    sa.Column('question_id', sa.UUID(), nullable=False),
    sa.Column('attempt_no', sa.Integer(), nullable=False),
    sa.Column('response_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('score', sa.Float(), nullable=False),
    sa.Column('max_score', sa.Integer(), nullable=False),
    sa.Column('is_correct', sa.Boolean(), nullable=False),
    sa.Column('detail_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('skill_pts_awarded', sa.Integer(), nullable=False),
    sa.Column('energy_spent', sa.Integer(), nullable=False),
    sa.Column('answered_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('attempt_no >= 1', name=op.f('ck_quest_answers_attempt_no_positive')),
    sa.CheckConstraint('energy_spent >= 0', name=op.f('ck_quest_answers_energy_spent_non_negative')),
    sa.CheckConstraint('skill_pts_awarded >= 0', name=op.f('ck_quest_answers_skill_pts_non_negative')),
    sa.ForeignKeyConstraint(['quest_id'], ['quests.id'], name=op.f('fk_quest_answers_quest_id_quests'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['question_id'], ['questions.id'], name=op.f('fk_quest_answers_question_id_questions'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['stage_run_id'], ['stage_runs.id'], name=op.f('fk_quest_answers_stage_run_id_stage_runs'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_quest_answers_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_quest_answers')),
    sa.UniqueConstraint('stage_run_id', 'user_id', 'quest_id', 'attempt_no', name='uq_quest_answers_attempt')
    )
    op.create_index(op.f('ix_quest_answers_quest_id'), 'quest_answers', ['quest_id'], unique=False)
    op.create_index(op.f('ix_quest_answers_stage_run_id'), 'quest_answers', ['stage_run_id'], unique=False)
    op.create_index(op.f('ix_quest_answers_user_id'), 'quest_answers', ['user_id'], unique=False)
    op.create_index('uq_quest_answers_correct_once', 'quest_answers', ['stage_run_id', 'user_id', 'quest_id'], unique=True, postgresql_where=sa.text('is_correct'))
    op.create_table('stage_run_players',
    sa.Column('stage_run_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=True),
    sa.Column('hero_key', sa.String(length=16), nullable=False),
    sa.Column('is_bot', sa.Boolean(), nullable=False),
    sa.Column('quests_completed', sa.Integer(), nullable=False),
    sa.Column('score', sa.Float(), nullable=False),
    sa.Column('max_score', sa.Integer(), nullable=False),
    sa.Column('skill_pts_earned', sa.Integer(), nullable=False),
    sa.Column('got_map_shard', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("hero_key IN ('leo', 'maya', 'sam', 'jade')", name=op.f('ck_stage_run_players_hero_key_valid')),
    sa.CheckConstraint('(is_bot AND user_id IS NULL) OR (NOT is_bot AND user_id IS NOT NULL)', name=op.f('ck_stage_run_players_bot_has_no_user')),
    sa.ForeignKeyConstraint(['stage_run_id'], ['stage_runs.id'], name=op.f('fk_stage_run_players_stage_run_id_stage_runs'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_stage_run_players_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_stage_run_players')),
    sa.UniqueConstraint('stage_run_id', 'hero_key', name='uq_stage_run_players_run_hero')
    )
    op.create_index(op.f('ix_stage_run_players_stage_run_id'), 'stage_run_players', ['stage_run_id'], unique=False)
    op.create_index(op.f('ix_stage_run_players_user_id'), 'stage_run_players', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_stage_run_players_user_id'), table_name='stage_run_players')
    op.drop_index(op.f('ix_stage_run_players_stage_run_id'), table_name='stage_run_players')
    op.drop_table('stage_run_players')
    op.drop_index('uq_quest_answers_correct_once', table_name='quest_answers', postgresql_where=sa.text('is_correct'))
    op.drop_index(op.f('ix_quest_answers_user_id'), table_name='quest_answers')
    op.drop_index(op.f('ix_quest_answers_stage_run_id'), table_name='quest_answers')
    op.drop_index(op.f('ix_quest_answers_quest_id'), table_name='quest_answers')
    op.drop_table('quest_answers')
    op.drop_index(op.f('ix_map_shards_owned_world_id'), table_name='map_shards_owned')
    op.drop_index(op.f('ix_map_shards_owned_user_id'), table_name='map_shards_owned')
    op.drop_table('map_shards_owned')
    op.drop_index(op.f('ix_stage_runs_status'), table_name='stage_runs')
    op.drop_index(op.f('ix_stage_runs_stage_id'), table_name='stage_runs')
    op.drop_index(op.f('ix_stage_runs_room_id'), table_name='stage_runs')
    op.drop_index(op.f('ix_stage_runs_is_trial'), table_name='stage_runs')
    op.drop_table('stage_runs')
    op.drop_index(op.f('ix_room_members_user_id'), table_name='room_members')
    op.drop_index(op.f('ix_room_members_room_id'), table_name='room_members')
    op.drop_table('room_members')
    op.drop_index(op.f('ix_stage_progress_user_id'), table_name='stage_progress')
    op.drop_index(op.f('ix_stage_progress_stage_id'), table_name='stage_progress')
    op.drop_table('stage_progress')
    op.drop_index(op.f('ix_rooms_status'), table_name='rooms')
    op.drop_index(op.f('ix_rooms_stage_id'), table_name='rooms')
    op.drop_index(op.f('ix_rooms_is_trial'), table_name='rooms')
    op.drop_index(op.f('ix_rooms_host_user_id'), table_name='rooms')
    op.drop_index(op.f('ix_rooms_code'), table_name='rooms')
    op.drop_table('rooms')
    op.drop_index(op.f('ix_quests_stage_id'), table_name='quests')
    op.drop_index('ix_quests_question', table_name='quests')
    op.drop_table('quests')
    op.drop_index(op.f('ix_stages_chapter_id'), table_name='stages')
    op.drop_table('stages')
    op.drop_index(op.f('ix_world_progress_world_id'), table_name='world_progress')
    op.drop_index(op.f('ix_world_progress_user_id'), table_name='world_progress')
    op.drop_table('world_progress')
    op.drop_index(op.f('ix_chapters_world_id'), table_name='chapters')
    op.drop_table('chapters')
    op.drop_index(op.f('ix_worlds_galaxy_id'), table_name='worlds')
    op.drop_table('worlds')
    op.drop_index(op.f('ix_galaxies_universe_id'), table_name='galaxies')
    op.drop_table('galaxies')
    op.drop_table('universes')

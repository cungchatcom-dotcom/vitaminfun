'use client';

/** Lớp gọi API phần chơi, dùng ở Client Component. */

import { request } from './browser-api';

import type { components } from './api-types';

export type Run = components['schemas']['RunOut'];
export type Snapshot = components['schemas']['StageSnapshot'];
export type SnapshotQuest = components['schemas']['SnapshotQuest'];
export type SnapshotQuestion = components['schemas']['SnapshotQuestion'];
export type QuestProgress = components['schemas']['QuestProgress'];
export type SubmitAnswerOut = components['schemas']['SubmitAnswerOut'];
export type RunResult = components['schemas']['RunResultOut'];
export type Review = components['schemas']['ReviewOut'];
export type PlayCharacter = components['schemas']['PlayCharacterOut'];

export const startRun = (stageId: string) =>
  request<Run>(`/play/stages/${stageId}/start`, { method: 'POST' });

export const getRun = (runId: string) => request<Run>(`/play/runs/${runId}`);

export const abandonRun = (runId: string) =>
  request<Run>(`/play/runs/${runId}/abandon`, { method: 'POST' });

export const getResult = (runId: string) => request<RunResult>(`/play/runs/${runId}/result`);

export const getReview = (runId: string) => request<Review>(`/play/runs/${runId}/review`);

/**
 * Nộp một câu.
 *
 * ⚠️ Phản hồi CHỈ có 4 trường: `completed`, `quest_completed`, `attempts_left`,
 * `team_energy`. Không điểm, không đáp án — đó là chủ ý, xem GAME_DOMAIN §1.6.
 * Frontend không có gì để tự tính điểm, và đó chính là điều mong muốn.
 */
export const submitAnswer = (
  runId: string,
  questId: string,
  questionId: string,
  response: Record<string, unknown> | null,
) =>
  request<SubmitAnswerOut>(
    `/play/runs/${runId}/quests/${questId}/questions/${questionId}/answer`,
    { method: 'POST', body: { response } },
  );

/**
 * Chọn — hoặc đổi — nhân vật cho một world.
 *
 * Trả về NGUYÊN bản chi tiết world sau khi đổi, không phải một câu "ok": màn
 * hình cần cả `my_character_id` mới lẫn danh sách nhân vật, và một vòng gọi
 * thêm chỉ để đọc lại thứ server vừa biết là một vòng thừa.
 */
export const pickCharacter = (worldId: string, characterId: string) =>
  request<unknown>(`/play/worlds/${worldId}/character`, {
    method: 'PUT',
    body: { character_id: characterId },
  });

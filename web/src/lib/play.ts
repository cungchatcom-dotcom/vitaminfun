'use client';

/** Lớp gọi API phần chơi, dùng ở Client Component. */

import { request } from './browser-api';

import type { components } from './api-types';

export type Run = components['schemas']['RunOut'];
export type Snapshot = components['schemas']['StageSnapshot'];
export type SnapshotQuest = components['schemas']['SnapshotQuest'];
export type SnapshotQuestion = components['schemas']['SnapshotQuestion'];
export type QuestProgress = components['schemas']['QuestProgress'];
export type QuestionProgress = components['schemas']['QuestionProgress'];
export type SubmitQuestOut = components['schemas']['SubmitQuestOut'];
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
 * Ghi lại đáp án đang dở của MỘT câu. Không chấm gì cả.
 *
 * Gọi mỗi khi người chơi chuyển sang câu khác. Nhờ vậy mất mạng, tắt máy hay
 * đóng nhầm tab thì vào lại vẫn thấy đúng những gì mình đã chọn — trạng thái
 * nằm ở server, không ở tab.
 *
 * `PUT` chứ không `POST`: gọi hai lần cùng một nội dung cho cùng một kết quả.
 */
export const saveDraft = (
  runId: string,
  questId: string,
  questionId: string,
  response: Record<string, unknown> | null,
) =>
  request<void>(`/play/runs/${runId}/quests/${questId}/questions/${questionId}/draft`, {
    method: 'PUT',
    body: { response },
  });

/**
 * Ghi chỗ nhân vật đang đứng, để thoát ra vào lại còn ở đúng đó.
 *
 * Của RIÊNG người gọi trong lượt chơi này — bốn người cùng phòng thì mỗi người
 * một chỗ đứng, và server lấy người từ token chứ không từ thân request.
 *
 * `PUT`: gọi mười lần cùng một toạ độ cho cùng một kết quả, và đây là thứ được
 * gọi liên tục trong lúc chơi.
 */
export const savePosition = (runId: string, x: number, y: number) =>
  request<void>(`/play/runs/${runId}/position`, { method: 'PUT', body: { x, y } });

/**
 * Nộp CẢ MỘT NHIỆM VỤ. Server chấm từ các bản nháp đã lưu.
 *
 * ⚠️ Phản hồi CHỈ có 3 trường: `quest_completed`, `attempts_left`, `my_energy`.
 * Không điểm, không đáp án — đó là chủ ý, xem GAME_DOMAIN §1.6. Frontend không
 * có gì để tự tính điểm, và đó chính là điều mong muốn.
 *
 * Không gửi kèm bài: bài đã ở server rồi. Gửi lại ở đây là mở đường thứ hai vào
 * cùng một chỗ.
 */
export const submitQuest = (runId: string, questId: string) =>
  request<SubmitQuestOut>(`/play/runs/${runId}/quests/${questId}/submit`, { method: 'POST' });

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

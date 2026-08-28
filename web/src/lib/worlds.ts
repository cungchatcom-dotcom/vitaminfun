'use client';

/**
 * Lớp gọi API dựng nội dung game, dùng ở Client Component.
 *
 * Kiểu lấy từ `api-types.ts` (sinh từ OpenAPI), không khai báo tay.
 */

import { request } from './browser-api';

import type { components } from './api-types';

export type World = components['schemas']['WorldOut'];
export type WorldCreatePayload = components['schemas']['WorldCreate'];
export type WorldUpdatePayload = components['schemas']['WorldUpdate'];

/**
 * Đầu vào tạo world: chỉ THIÊN HÀ và CÁI TÊN là bắt buộc.
 *
 * Cùng lý do với `StageCreateInput` bên dưới: trường nào có giá trị mặc định
 * trong Pydantic thì OpenAPI sinh ra thành BẮT BUỘC ở phía TypeScript. Liệt kê
 * lại `shard_total = 30` ở đây là tạo bản sao thứ hai của một con số, và sẽ có
 * ngày hai bản lệch nhau. Mặc định có đúng một nguồn, và nó ở backend.
 */
export type WorldCreateInput = Pick<WorldCreatePayload, 'galaxy_id' | 'name_i18n'> &
  Partial<WorldCreatePayload>;

export type Chapter = components['schemas']['ChapterOut'];
export type ChapterCreatePayload = components['schemas']['ChapterCreate'];
export type ChapterUpdatePayload = components['schemas']['ChapterUpdate'];

export type StageBrief = components['schemas']['StageBrief'];
export type Stage = components['schemas']['StageOut'];
export type StageCreatePayload = components['schemas']['StageCreate'];

/**
 * Đầu vào tạo màn chơi: bốn trường bắt buộc, còn lại để **server** điền mặc định.
 *
 * Không liệt kê mặc định ở đây: `time_limit_seconds = 300` mà cả hai phía cùng
 * biết thì sẽ có ngày chúng lệch nhau. Một nguồn duy nhất, và nó ở backend.
 */
export type StageCreateInput = Pick<
  StageCreatePayload,
  'name_i18n' | 'order_index' | 'scene_key' | 'map_shard_index'
> &
  Partial<StageCreatePayload>;
export type StageUpdatePayload = components['schemas']['StageUpdate'];

export type Quest = components['schemas']['QuestOut'];
export type QuestQuestion = components['schemas']['QuestQuestionOut'];
export type QuestQuestionAddPayload = components['schemas']['QuestQuestionAdd'];
export type QuestQuestionUpdatePayload = components['schemas']['QuestQuestionUpdate'];
export type QuestCreatePayload = components['schemas']['QuestCreate'];
export type QuestUpdatePayload = components['schemas']['QuestUpdate'];

export type PublishBlocker = components['schemas']['PublishBlocker'];

// --- World -----------------------------------------------------------------

export const listWorlds = () => request<World[]>('/worlds');

export const getWorld = (id: string) => request<World>(`/worlds/${id}`);

export const createWorld = (payload: WorldCreateInput) =>
  request<World>('/worlds', { method: 'POST', body: payload });

export const updateWorld = (id: string, payload: WorldUpdatePayload) =>
  request<World>(`/worlds/${id}`, { method: 'PATCH', body: payload });

// --- Chương ----------------------------------------------------------------

export const listChapters = (worldId: string) =>
  request<Chapter[]>(`/worlds/${worldId}/chapters`);

export const createChapter = (worldId: string, payload: ChapterCreatePayload) =>
  request<Chapter>(`/worlds/${worldId}/chapters`, { method: 'POST', body: payload });

export const updateChapter = (id: string, payload: ChapterUpdatePayload) =>
  request<Chapter>(`/chapters/${id}`, { method: 'PATCH', body: payload });

export const deleteChapter = (id: string) =>
  request<void>(`/chapters/${id}`, { method: 'DELETE' });

// --- Màn chơi --------------------------------------------------------------

export const getStage = (id: string) => request<Stage>(`/stages/${id}`);

export const createStage = (chapterId: string, payload: StageCreateInput) =>
  request<Stage>(`/chapters/${chapterId}/stages`, { method: 'POST', body: payload });

export const updateStage = (id: string, payload: StageUpdatePayload) =>
  request<Stage>(`/stages/${id}`, { method: 'PATCH', body: payload });

export const publishStage = (id: string) =>
  request<Stage>(`/stages/${id}/publish`, { method: 'POST' });

/** Rút màn về nháp. Đi qua PATCH vì gỡ xuống không có điều kiện gì. */
export const unpublishStage = (id: string) =>
  request<Stage>(`/stages/${id}`, { method: 'PATCH', body: { status: 'draft' } });

export const deleteStage = (id: string) => request<void>(`/stages/${id}`, { method: 'DELETE' });

// --- Nhiệm vụ --------------------------------------------------------------

export const createQuest = (stageId: string, payload: QuestCreatePayload) =>
  request<Quest>(`/stages/${stageId}/quests`, { method: 'POST', body: payload });

export const updateQuest = (id: string, payload: QuestUpdatePayload) =>
  request<Quest>(`/quests/${id}`, { method: 'PATCH', body: payload });

export const deleteQuest = (id: string) => request<void>(`/quests/${id}`, { method: 'DELETE' });

// --- Câu hỏi bên trong một nhiệm vụ ----------------------------------------

/** Lắp thêm nhiều câu hỏi vào một nhiệm vụ. Trả về nhiệm vụ đã cập nhật. */
export const addQuestQuestions = (questId: string, payload: QuestQuestionAddPayload) =>
  request<Quest>(`/quests/${questId}/questions`, { method: 'POST', body: payload });

export const updateQuestQuestion = (linkId: string, payload: QuestQuestionUpdatePayload) =>
  request<Quest>(`/quest-questions/${linkId}`, { method: 'PATCH', body: payload });

/** Gỡ câu hỏi khỏi nhiệm vụ. KHÔNG xoá câu hỏi khỏi kho. */
export const removeQuestQuestion = (linkId: string) =>
  request<Quest>(`/quest-questions/${linkId}`, { method: 'DELETE' });

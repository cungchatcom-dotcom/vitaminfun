'use client';

/**
 * Sinh tiếng đọc cho câu hỏi — ba mức, cùng một luật.
 *
 * Mỗi mức có một đường ĐỌC tình trạng và một đường SINH. Đọc trước là phần bắt
 * buộc: giao diện phải biết "câu này đã có tiếng chưa" để còn hỏi *"đã có rồi,
 * tạo lại không?"* — hỏi sau khi đã gọi API là hỏi sau khi đã tiêu tiền.
 */

import { request } from './browser-api';

import type { components } from './api-types';

export type AudioTarget = 'prompt' | 'option';
export type QuestAudioStatus = components['schemas']['QuestAudioStatusOut'];
export type StageAudioStatus = components['schemas']['StageAudioStatusOut'];
export type QuestionAudio = components['schemas']['QuestionAudioOut'];
export type AudioReport = components['schemas']['AudioReportOut'];

export interface GenerateInput {
  target: AudioTarget;
  /** Nhân vật lấy giọng — CHỈ dùng cho `option`. */
  character_ids?: string[];
  overwrite?: boolean;
}

const ids = (list: string[]) =>
  list.map((id) => `character_ids=${encodeURIComponent(id)}`).join('&');

export const questAudioStatus = (questId: string, characterIds: string[] = []) =>
  request<QuestAudioStatus>(
    `/quests/${questId}/audio${characterIds.length ? `?${ids(characterIds)}` : ''}`,
  );

export const stageAudioStatus = (stageId: string, characterIds: string[] = []) =>
  request<StageAudioStatus>(
    `/stages/${stageId}/audio${characterIds.length ? `?${ids(characterIds)}` : ''}`,
  );

export const listQuestionAudio = (questionId: string) =>
  request<QuestionAudio[]>(`/questions/${questionId}/audio`);

export const generateQuestAudio = (questId: string, body: GenerateInput) =>
  request<AudioReport>(`/quests/${questId}/audio`, { method: 'POST', body });

export const generateStageAudio = (stageId: string, body: GenerateInput) =>
  request<AudioReport>(`/stages/${stageId}/audio`, { method: 'POST', body });

export const generateQuestionAudio = (questionId: string, body: GenerateInput) =>
  request<AudioReport>(`/questions/${questionId}/audio`, { method: 'POST', body });

/**
 * Sinh tiếng cho LỜI CHIA TAY của màn, bằng giọng người canh giữ nhiệm vụ này.
 *
 * Vào qua nhiệm vụ chứ không qua màn, dù lời chia tay là của màn: giọng đọc nằm
 * ở người canh giữ, mà người canh giữ nằm ở nhiệm vụ.
 */
export const generateQuestOutroAudio = (questId: string, body: { overwrite?: boolean }) =>
  request<AudioReport>(`/quests/${questId}/outro-audio`, {
    method: 'POST',
    body: { target: 'prompt', ...body },
  });

/**
 * Sinh tiếng cho BỘ CÂU PHÁN của world, bằng giọng người canh giữ nhiệm vụ này.
 *
 * Chữ là của world — cả thế giới ấy nói cùng một giọng điệu. Tiếng thì của từng
 * người canh giữ. Bản thu khoá theo `(giọng, nội dung câu)`, nên hai nhiệm vụ
 * chọn cùng một giọng thì cái thứ hai không tốn thêm gì.
 */
export const generateVerdictAudio = (
  questId: string,
  body: { overwrite?: boolean; lines?: string[] },
) =>
  request<AudioReport>(`/quests/${questId}/verdict-audio`, {
    method: 'POST',
    body: { target: 'prompt', ...body },
  });

/**
 * Sinh tiếng cho CÂU KHOÁ của một nhiệm vụ, bằng giọng NGƯỜI GÁC CỬA của màn.
 *
 * Không gửi chữ lên: server đọc thẳng từ cột của nhiệm vụ. Nhận chuỗi client gửi
 * là mở đường thu bất cứ gì bằng giọng của người khác.
 */
export const generateLockedAudio = (questId: string, body: { overwrite?: boolean }) =>
  request<AudioReport>(`/quests/${questId}/locked-audio`, {
    method: 'POST',
    body: { target: 'prompt', ...body },
  });

/** Dịch vụ giọng đọc còn sống không, và còn bao nhiêu ký tự. KHÔNG tốn credit. */
export const voiceHealth = () => request<Record<string, VoiceHealth>>('/voices/health');

export interface VoiceHealth {
  ok: boolean;
  reason?: string;
  tier?: string;
  characters_used?: number;
  characters_limit?: number;
  characters_left?: number;
}

/** Cả bộ câu phán của world, kèm tiếng đọc theo giọng người canh giữ nhiệm vụ. */
export const verdictLines = (questId: string) =>
  request<VerdictLines>(`/quests/${questId}/verdict-lines`);

export type VerdictLines = components['schemas']['VerdictLinesOut'];
export type VerdictLine = components['schemas']['VerdictLineOut'];

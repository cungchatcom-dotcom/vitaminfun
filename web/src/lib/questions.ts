'use client';

/**
 * Lớp gọi API kho câu hỏi, dùng ở Client Component.
 *
 * ⚠️ Frontend KHÔNG tính điểm. Muốn biết đúng/sai thì gọi `checkAnswer()` —
 * đáp án nằm ở server và ở nguyên đó. Xem docs/ARCHITECTURE.md §6 nguyên tắc 1.
 *
 * Kiểu dữ liệu lấy từ `api-types.ts` (sinh từ OpenAPI), không khai báo tay:
 * đổi schema ở backend mà frontend không sửa thì gãy lúc `tsc`, không gãy lúc
 * người dùng bấm nút.
 */

import { request } from './browser-api';

import type { components } from './api-types';

export type QuestionSummary = components['schemas']['QuestionOut'];
export type QuestionListResult = components['schemas']['QuestionListOut'];
export type QuestionPayload = components['schemas']['QuestionCreate'];
export type QuestionUpdatePayload = components['schemas']['QuestionUpdate'];
export type CheckResult = components['schemas']['GradePreviewOut'];
export type ImportReport = components['schemas']['ImportReportOut'];
export type QuestionCodes = components['schemas']['QuestionCodesOut'];

export const QUESTION_TYPES = [
  'MCQ_SINGLE',
  'MCQ_MULTI',
  'GAP_FILL',
  'GAP_DROPDOWN',
  'SHORT_ANSWER',
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];
export type QuestionStatus = 'draft' | 'published';

export interface ListParams {
  type?: string;
  status?: string;
  level?: string;
  tag?: string;
  q?: string;
  /**
   * Lọc theo ĐỊA CHỈ GỐC — mã do bộ phận nội dung đặt trong file .xlsx.
   *
   * `stage_code` là đường mà màn chơi dùng để tự hiện ra câu hỏi của nó, kể cả
   * những câu chưa được lắp vào nhiệm vụ nào.
   */
  world_code?: string;
  stage_code?: string;
  quest_code?: string;
  limit?: number;
  offset?: number;
}

export async function listQuestions(
  params: ListParams,
  signal?: AbortSignal,
): Promise<QuestionListResult> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const suffix = query.toString();
  return request<QuestionListResult>(`/questions${suffix ? `?${suffix}` : ''}`, { signal });
}

/**
 * Những mã định danh đang CÓ THẬT trong kho, để dựng ô chọn bộ lọc.
 *
 * Hỏi kho chứ không hỏi danh sách màn chơi: ngay sau một lần nhập file, kho đã
 * có `W1-S1` mà chưa màn nào mang mã đó — và đó chính là lúc người dựng cần lọc
 * theo nó để lắp câu vào nhiệm vụ.
 */
export async function listQuestionCodes(
  stageCode?: string | null,
  signal?: AbortSignal,
): Promise<QuestionCodes> {
  const query = stageCode ? `?stage_code=${encodeURIComponent(stageCode)}` : '';
  return request<QuestionCodes>(`/questions/codes${query}`, { signal });
}

export async function getQuestion(id: string): Promise<QuestionSummary> {
  return request<QuestionSummary>(`/questions/${id}`);
}

export async function createQuestion(payload: QuestionPayload): Promise<QuestionSummary> {
  return request<QuestionSummary>('/questions', { method: 'POST', body: payload });
}

export async function updateQuestion(
  id: string,
  payload: QuestionUpdatePayload,
): Promise<QuestionSummary> {
  return request<QuestionSummary>(`/questions/${id}`, { method: 'PATCH', body: payload });
}

export async function deleteQuestion(id: string): Promise<void> {
  return request<void>(`/questions/${id}`, { method: 'DELETE' });
}

export async function checkAnswer(
  id: string,
  response: Record<string, unknown> | null,
): Promise<CheckResult> {
  return request<CheckResult>(`/questions/${id}/check`, {
    method: 'POST',
    body: { response },
  });
}

/**
 * Nhập câu hỏi từ file .xlsx của bộ phận nội dung.
 *
 * Gửi bằng `FormData` — KHÔNG tự đặt `Content-Type`, trình duyệt phải tự sinh
 * kèm `boundary`. Cùng luật với `uploadMedia()`.
 */
export async function importQuestions(file: File): Promise<ImportReport> {
  const form = new FormData();
  form.append('file', file);
  return request<ImportReport>('/questions/import', { method: 'POST', formData: form });
}

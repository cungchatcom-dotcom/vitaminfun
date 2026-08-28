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

export const QUESTION_TYPES = ['MCQ_SINGLE', 'MCQ_MULTI', 'GAP_FILL', 'GAP_DROPDOWN'] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];
export type QuestionStatus = 'draft' | 'published';

export interface ListParams {
  type?: string;
  status?: string;
  level?: string;
  tag?: string;
  q?: string;
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

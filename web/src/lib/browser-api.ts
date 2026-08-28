'use client';

/**
 * Gọi API từ TRÌNH DUYỆT, đi qua proxy `/api/be/*`.
 *
 * Cặp đôi với `api-client.ts` (chỉ chạy phía server). Chọn cái nào:
 *
 *     Server Component, Route Handler   ->  api-client.ts   (apiFetch)
 *     Client Component ('use client')   ->  file này        (request)
 *
 * Cả hai đều ném `ApiError` có `code`, nên chỗ hiển thị lỗi dùng chung một
 * đường: tra `messages/*.json` theo mã.
 */

import { ApiError } from './api-error';

export { ApiError };

interface ErrorEnvelope {
  error?: { code?: string; params?: Record<string, unknown>; traceId?: string };
}

/** Trần thời gian chờ. Xem giải thích ở `api-client.ts`. */
const TIMEOUT_MS = 15_000;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Gửi FormData (upload file). Khi đó KHÔNG được tự đặt Content-Type. */
  formData?: FormData;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, formData, signal, timeoutMs = TIMEOUT_MS } = options;

  const headers = new Headers({ Accept: 'application/json' });
  let payload: BodyInit | undefined;

  if (formData) {
    // Cố tình KHÔNG đặt Content-Type: trình duyệt phải tự sinh kèm `boundary`.
    payload = formData;
  } else if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`/api/be${path.startsWith('/') ? path : `/${path}`}`, {
      method,
      headers,
      body: payload,
      // Gộp tín hiệu huỷ của người gọi với đồng hồ đếm ngược: cái nào đến
      // trước thì thắng.
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof DOMException) {
      // Người dùng huỷ request (đổi bộ lọc liên tục) không phải lỗi mạng.
      if (error.name === 'AbortError') throw error;
      if (error.name === 'TimeoutError') throw new ApiError('TIMEOUT', 504);
    }
    throw new ApiError('NETWORK', 0);
  }

  if (response.status === 204) return undefined as T;

  const data = (await response.json().catch(() => ({}))) as unknown;

  if (!response.ok) {
    const envelope = data as ErrorEnvelope;
    throw new ApiError(
      envelope.error?.code ?? 'INTERNAL_ERROR',
      response.status,
      envelope.error?.params ?? {},
      envelope.error?.traceId,
    );
  }

  return data as T;
}

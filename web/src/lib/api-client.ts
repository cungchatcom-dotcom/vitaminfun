/**
 * Gọi API từ phía SERVER (Server Component, Route Handler).
 *
 * Không có bản dùng ở trình duyệt: token nằm trong cookie httpOnly nên mã chạy
 * trên trình duyệt không lấy được. Cần dữ liệu ở client thì fetch trong Server
 * Component rồi truyền xuống props, hoặc thêm một Route Handler làm cầu.
 */

import { cookies } from 'next/headers';

import { ApiError } from './api-error';
import { SESSION_COOKIE } from './session';

export { ApiError };

/** URL server-to-server. Trong Docker sẽ khác URL trình duyệt dùng. */
export function apiBaseUrl(): string {
  const url = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error('Thiếu API_INTERNAL_URL (hoặc NEXT_PUBLIC_API_URL) trong .env ở gốc repo');
  }
  return url.replace(/\/$/, '');
}

interface ErrorEnvelope {
  error?: { code?: string; params?: Record<string, unknown>; traceId?: string };
}

/**
 * Trần thời gian chờ API.
 *
 * Không có trần thì API treo = trang treo VĨNH VIỄN: người dùng nhìn màn hình
 * trắng quay mãi, không có thông báo lỗi, không biết phải làm gì. Thà báo lỗi
 * sau 15 giây còn hơn quay mãi không bao giờ dừng.
 */
const TIMEOUT_MS = 15_000;

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Tự đính token từ cookie. Tắt cho các lệnh gọi công khai như đăng nhập. */
  auth?: boolean;
  /** Đổi trần thời gian chờ cho lệnh gọi này (mili giây). */
  timeoutMs?: number;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, auth = true, headers, timeoutMs = TIMEOUT_MS, signal, ...rest } = options;

  const finalHeaders = new Headers(headers);
  finalHeaders.set('Accept', 'application/json');
  if (body !== undefined) finalHeaders.set('Content-Type', 'application/json');

  if (auth) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      // Dữ liệu theo từng người dùng, không được nằm trong cache dùng chung.
      cache: 'no-store',
      signal: signal ?? AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    // Quá hạn chờ báo mã riêng: "máy chủ không phản hồi" khác hẳn "không kết
    // nối được", và người vận hành cần phân biệt được hai thứ đó.
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('TIMEOUT', 504);
    }
    throw new ApiError('NETWORK', 0);
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => ({}))) as unknown;

  if (!response.ok) {
    const envelope = payload as ErrorEnvelope;
    throw new ApiError(
      envelope.error?.code ?? 'INTERNAL_ERROR',
      response.status,
      envelope.error?.params ?? {},
      envelope.error?.traceId,
    );
  }

  return payload as T;
}

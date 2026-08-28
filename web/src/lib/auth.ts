/** Lấy người dùng hiện tại ở phía server. Dùng trong Server Component và layout. */

import { redirect } from 'next/navigation';

import { ApiError, apiFetch } from './api-client';
import type { UserSummary } from './types';

export async function getCurrentUser(): Promise<UserSummary | null> {
  try {
    return await apiFetch<UserSummary>('/auth/me');
  } catch (error) {
    // Token hết hạn hoặc chưa đăng nhập thì coi như khách, để tầng trên quyết định.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
}

/**
 * Bắt buộc đã đăng nhập.
 *
 * Middleware đã chặn từ trước, nhưng lớp này vẫn cần: middleware bỏ qua khi
 * cookie còn hạn nhưng tài khoản đã bị khoá hoặc đổi vai trò ở phía server.
 */
export async function requireUser(): Promise<UserSummary> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

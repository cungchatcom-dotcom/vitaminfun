'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { UserSummary } from '@/lib/types';

const AuthContext = createContext<UserSummary | null>(null);

/**
 * Người dùng hiện tại, cho các component chạy ở trình duyệt.
 *
 * Dữ liệu do Server Component nạp rồi truyền xuống — client KHÔNG tự gọi
 * `/auth/me`, vì token nằm trong cookie httpOnly mà nó không đọc được.
 */
export function AuthProvider({ user, children }: { user: UserSummary; children: ReactNode }) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useCurrentUser(): UserSummary {
  const user = useContext(AuthContext);
  if (!user) throw new Error('useCurrentUser phải nằm trong <AuthProvider>');
  return user;
}

'use client';

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

import { cacheMusicPrefs } from '@/game/music-prefs';

import type { UserSummary } from '@/lib/types';

const AuthContext = createContext<UserSummary | null>(null);

/**
 * Người dùng hiện tại, cho các component chạy ở trình duyệt.
 *
 * Dữ liệu do Server Component nạp rồi truyền xuống — client KHÔNG tự gọi
 * `/auth/me`, vì token nằm trong cookie httpOnly mà nó không đọc được.
 */
export function AuthProvider({ user, children }: { user: UserSummary; children: ReactNode }) {
  /**
   * TUỲ CHỌN ÂM THANH CỦA TÀI KHOẢN GHI ĐÈ BẢN SAO Ở MÁY.
   *
   * Đây là chỗ duy nhất biết "ai đang đăng nhập", nên cũng là chỗ duy nhất
   * dựng lại được bản sao cho đúng người. Máy chỉ nhớ hộ; tài khoản mới là
   * nguồn tin — em nào ngồi vào cũng nghe đúng thứ mình đã chọn, chứ không phải
   * thứ người ngồi trước để lại.
   *
   * Chạy MỘT LẦN cho mỗi người: đè theo mỗi lượt vẽ thì cú bấm tắt nhạc của
   * chính người dùng sẽ bị chính hiệu ứng này bật lại ngay sau đó.
   */
  const daDong = useRef<string | null>(null);
  useEffect(() => {
    if (daDong.current === user.id) return;
    daDong.current = user.id;
    const prefs = user.audio_prefs;
    if (!prefs) return;
    cacheMusicPrefs({ on: prefs.on ?? true, master: prefs.master ?? 1 });
  }, [user.id, user.audio_prefs]);

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useCurrentUser(): UserSummary {
  const user = useContext(AuthContext);
  if (!user) throw new Error('useCurrentUser phải nằm trong <AuthProvider>');
  return user;
}

/**
 * Đọc phiên đăng nhập từ cookie.
 *
 * Token nằm trong cookie httpOnly nên JavaScript phía trình duyệt KHÔNG đọc
 * được — đó là chủ ý. Mọi thứ cần token đều chạy ở phía server: Server
 * Component, Route Handler, middleware.
 */

import type { Role } from './types';

export const SESSION_COOKIE = 'vf_session';

// Role suy ra từ OpenAPI của backend (xem types.ts). Định nghĩa lại union ở đây
// nghĩa là thêm một vai trò ở backend mà frontend vẫn biên dịch trót lọt.
export type { Role };

export interface SessionClaims {
  sub: string;
  role: Role;
  exp: number;
}

/**
 * Giải mã phần payload của JWT mà KHÔNG kiểm chữ ký.
 *
 * Đây là một quyết định có chủ ý, không phải chỗ quên làm.
 *
 * Middleware chỉ dùng `role` để quyết định điều hướng — tức là để trải nghiệm.
 * Người tự sửa cookie để đổi vai trò sẽ thấy đúng cái vỏ giao diện đó rồi mọi
 * lệnh gọi API đều trả 403, vì backend kiểm chữ ký và đối chiếu vai trò trong
 * database ở `require_role()`. Xem docs/ARCHITECTURE.md §4:
 * "Chặn ở giao diện là để trải nghiệm, chặn ở API mới là bảo mật."
 *
 * Đổi lại, khoá bí mật JWT không cần có mặt ở phía web — thu hẹp được phạm vi
 * ảnh hưởng nếu tiến trình web bị chiếm.
 */
export function decodeSession(token: string | undefined): SessionClaims | null {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const payload = parts[1];
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as SessionClaims;

    if (typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) return null;
    const ROLES: readonly string[] = ['admin', 'teacher', 'student'];
    if (!ROLES.includes(claims.role)) return null;
    return claims;
  } catch {
    return null;
  }
}

/** Trang chủ theo vai trò. Phải khớp HOME_ROUTE ở api/app/modules/auth/service.py. */
export const HOME_ROUTE: Record<Role, string> = {
  admin: '/admin',
  teacher: '/teacher',
  student: '/play',
};

/**
 * Vai trò nào vào được vùng nào.
 *
 * Bất đối xứng có chủ ý (docs/ARCHITECTURE.md §4): học sinh bị chặn khỏi
 * /teacher, nhưng giáo viên và admin KHÔNG bị chặn khỏi /play — họ cần chơi
 * thử đúng cái học sinh sắp chơi, trước khi phát hành world.
 */
export const AREA_ACCESS: Record<string, readonly Role[]> = {
  '/admin': ['admin'],
  '/teacher': ['teacher', 'admin'],
  '/play': ['student', 'teacher', 'admin'],
};

/** Vai trò được vào chế độ chơi thử. Khớp UserRole.CAN_PREVIEW ở backend. */
export const CAN_PREVIEW: readonly Role[] = ['teacher', 'admin'];

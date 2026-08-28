import type { NextRequest } from 'next/server';

/**
 * Cookie phiên có nên mang cờ `Secure` không.
 *
 * Căn theo **giao thức của chính request**, KHÔNG theo `NODE_ENV`.
 *
 * Vì sao không dùng `NODE_ENV === 'production'`: `pnpm start` luôn chạy ở chế độ
 * production, kể cả khi phục vụ qua `http://localhost`. Cookie `Secure` thì
 * trình duyệt không gửi lại qua HTTP — hậu quả là đăng nhập báo thành công rồi
 * mọi request sau đó vẫn là khách vãng lai, và người dùng bị đá về `/login`
 * vòng vòng mà không có thông báo lỗi nào.
 *
 * `x-forwarded-proto` là cho trường hợp đứng sau nginx: nginx nói chuyện TLS với
 * trình duyệt rồi chuyển tiếp bằng HTTP thường vào Next, nên tự nhìn
 * `request.nextUrl.protocol` sẽ thấy `http` và bỏ mất cờ `Secure` đáng ra phải có.
 * Xem docs/DEPLOY.md §7 — nginx phải đặt header này.
 */
export function isSecureRequest(request: NextRequest): boolean {
  const forwarded = request.headers.get('x-forwarded-proto');
  if (forwarded) return forwarded.split(',')[0]?.trim() === 'https';
  return request.nextUrl.protocol === 'https:';
}

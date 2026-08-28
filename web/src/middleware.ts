import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from '@/i18n/locales';
import { routing } from '@/i18n/routing';
import { AREA_ACCESS, HOME_ROUTE, SESSION_COOKIE, decodeSession, type Role } from '@/lib/session';

const intlMiddleware = createIntlMiddleware(routing);

/** Tách tiền tố ngôn ngữ ra khỏi đường dẫn: /en/teacher -> { locale: 'en', rest: '/teacher' } */
function splitLocale(pathname: string): { prefix: string; rest: string } {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return { prefix: `/${locale}`, rest: '/' };
    if (pathname.startsWith(`/${locale}/`)) {
      return { prefix: `/${locale}`, rest: pathname.slice(locale.length + 1) };
    }
  }
  return { prefix: '', rest: pathname };
}

function areaOf(path: string): string | null {
  for (const area of Object.keys(AREA_ACCESS)) {
    if (path === area || path.startsWith(`${area}/`)) return area;
  }
  return null;
}

export function middleware(request: NextRequest) {
  const { prefix, rest } = splitLocale(request.nextUrl.pathname);
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);

  /**
   * Tiền tố dùng cho MỌI đường chuyển hướng phát ra từ đây.
   *
   * URL đã có tiền tố thì giữ nguyên — người dùng nói rõ rồi. Không có tiền tố
   * nghĩa là "chưa nói", và khi đó ta tôn trọng lựa chọn gần nhất của họ, lưu
   * trong cookie do bộ chọn ngôn ngữ đặt. Không có cookie thì rơi về mặc định
   * là tiếng Anh, đúng như thiết kế.
   *
   * Chỗ này phải tự làm vì `localeDetection` đang tắt, mà cờ đó tắt cả đường
   * đọc cookie của next-intl — xem ghi chú trong `i18n/routing.ts`. Nếu không
   * có đoạn này thì người đã chọn tiếng Việt cứ gõ tên miền là bị trả về tiếng
   * Anh, và "đổi ngôn ngữ" hoá ra chỉ có tác dụng trong đúng một lần bấm.
   */
  const chosen = request.cookies.get(LOCALE_COOKIE)?.value;
  const localePrefix =
    prefix || (isLocale(chosen) && chosen !== DEFAULT_LOCALE ? `/${chosen}` : '');

  const go = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = `${localePrefix}${to}`;
    url.search = '';
    return NextResponse.redirect(url);
  };

  // Đã đăng nhập mà vào /login thì đưa thẳng về nhà theo vai trò.
  if (rest === '/login') {
    return session ? go(HOME_ROUTE[session.role]) : intlMiddleware(request);
  }

  // Gốc "/" chỉ là bàn phân loại: chưa đăng nhập -> /login, đã đăng nhập -> nhà.
  if (rest === '/') {
    return go(session ? HOME_ROUTE[session.role] : '/login');
  }

  const area = areaOf(rest);
  if (area === null) return intlMiddleware(request);

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = `${localePrefix}/login`;
    // Nhớ chỗ đang muốn vào để đăng nhập xong quay lại đúng đó — và nhớ theo
    // ngôn ngữ của trang đăng nhập sắp hiện, không phải theo URL vừa gõ. Đá
    // sang `/vi/login` rồi đăng nhập xong ném về `/teacher` tiếng Anh thì lựa
    // chọn ngôn ngữ mất ngay tại cửa.
    url.search = `?next=${encodeURIComponent(`${localePrefix}${rest}`)}`;
    return NextResponse.redirect(url);
  }

  const allowed = AREA_ACCESS[area] as readonly Role[];
  if (!allowed.includes(session.role)) {
    // Đá về nhà của chính mình, KHÔNG hiện trang 403. Học sinh gõ nhầm /teacher
    // thì thấy trang chơi của mình, không thấy một cánh cửa khoá gợi ý rằng có
    // thứ gì đó thú vị đằng sau.
    return go(HOME_ROUTE[session.role]);
  }

  return intlMiddleware(request);
}

export const config = {
  // Bỏ qua route handler (/api/*), file tĩnh và ảnh tối ưu.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};

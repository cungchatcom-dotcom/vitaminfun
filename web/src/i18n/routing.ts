import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';

import { DEFAULT_LOCALE, LOCALES } from './locales';

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,

  // 'as-needed': ngôn ngữ mặc định không có tiền tố (`/teacher`), ngôn ngữ khác
  // thì có (`/vi/teacher`). Bản đồ route trong ARCHITECTURE.md khớp URL thật.
  localePrefix: 'as-needed',

  /**
   * TẮT dò ngôn ngữ theo trình duyệt.
   *
   * Bật lên thì next-intl đọc header `Accept-Language`, mà gần như mọi máy ở
   * đây cài tiếng Việt — người dùng sẽ bị đá sang `/vi` ngay lần vào đầu tiên,
   * tức là "mặc định tiếng Anh" chỉ đúng trên giấy. Đổi ngôn ngữ phải là hành
   * động có chủ ý, qua bộ chọn ở thanh trên cùng.
   *
   * Cờ này tắt CẢ dò theo cookie (xem `resolveLocale` của next-intl: URL →
   * cookie → Accept-Language → mặc định, hai bước giữa cùng chung một cờ). Nên
   * việc nhớ lựa chọn do middleware của ta tự làm, đọc `LOCALE_COOKIE` — và chỉ
   * cho những đường dẫn không có tiền tố.
   */
  localeDetection: false,
});

export type { Locale } from './locales';

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

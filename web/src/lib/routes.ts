import { DEFAULT_LOCALE } from '@/i18n/locales';

/**
 * Gắn tiền tố ngôn ngữ vào một đường dẫn nội bộ.
 *
 * Cấu hình `localePrefix: 'as-needed'` nên ngôn ngữ mặc định — TIẾNG ANH —
 * KHÔNG có tiền tố, còn các ngôn ngữ khác thì có:
 *
 *     localizedPath('/teacher/questions', 'en')  ->  /teacher/questions
 *     localizedPath('/teacher/questions', 'vi')  ->  /vi/teacher/questions
 *
 * Dùng khi phải điều hướng bằng `router.push()` của `next/navigation` — nó
 * không tự biết ngôn ngữ. Với thẻ liên kết thì dùng `Link` của `@/i18n/routing`,
 * nó tự lo.
 */
export function localizedPath(path: string, locale: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  return `/${locale}${clean}`;
}

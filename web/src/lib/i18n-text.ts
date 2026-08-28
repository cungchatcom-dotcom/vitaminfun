import { DEFAULT_LOCALE } from '@/i18n/locales';

/**
 * Chữ ĐỂ HIỆN: ngôn ngữ đang xem, thiếu thì mượn ngôn ngữ mặc định, rồi tới
 * khoá đầu tiên có gì. Thiếu sạch thì trả CHUỖI RỖNG.
 *
 * Rỗng chứ không phải '—': chỗ gọi thường còn một cái tên dự phòng tử tế hơn
 * (`quest_object_key` chẳng hạn), mà trả về '—' — một chuỗi "đúng" — thì
 * `pickText(...) || quest.quest_object_key` không bao giờ chạy tới vế sau.
 * Quyết định hiện gì khi không có gì là việc của chỗ gọi, không phải của hàm
 * này.
 *
 * Đặt ở `lib/` chứ không ở trong một component: nó là hàm thuần, không đụng tới
 * React. Để trong `stage-builder.tsx` — vốn có `'use client'` — thì mọi Server
 * Component muốn hiện một cái tên đều phải kéo theo cả trình dựng màn chơi vào
 * gói tải về.
 */
export function pickText(i18n: Record<string, string> | undefined, locale: string): string {
  if (!i18n) return '';
  return i18n[locale] ?? i18n[DEFAULT_LOCALE] ?? Object.values(i18n)[0] ?? '';
}

/**
 * Chữ ĐỂ SỬA: bản dịch của ĐÚNG ngôn ngữ này, KHÔNG mượn của ngôn ngữ khác.
 *
 * Ô nhập trong màn soạn thảo phải dùng hàm này, không được dùng `pickText`.
 * Một màn chơi mới đặt tên tiếng Anh, người soạn chuyển sang tiếng Việt: nếu ô
 * nhập mượn tên tiếng Anh thì họ chỉ cần bấm Lưu — hoặc rời chuột — là tên
 * tiếng Anh bị ghi thành tên tiếng Việt, mà chẳng ai gõ chữ nào. Chưa dịch thì
 * ô phải TRỐNG; muốn cho thấy bản gốc để đối chiếu thì đưa `pickText` xuống
 * `placeholder`.
 */
export function ownText(i18n: Record<string, string> | undefined, locale: string): string {
  return i18n?.[locale] ?? '';
}

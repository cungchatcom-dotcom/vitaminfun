/**
 * Danh sách ngôn ngữ — dữ liệu thuần, KHÔNG import next-intl.
 *
 * Tách khỏi `routing.ts` để middleware, `lib/routes.ts`, `lib/i18n-text.ts` và
 * bộ chọn ngôn ngữ dùng chung MỘT danh sách. Thêm ngôn ngữ mới = thêm một dòng
 * ở đây + một file `messages/<mã>.json` đủ khoá.
 */
export const LOCALES = ['en', 'vi'] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * MẶC ĐỊNH LÀ TIẾNG ANH.
 *
 * Đây là sản phẩm dạy tiếng Anh — chữ trên giao diện cũng là một phần bài học,
 * nên người học phải gặp tiếng Anh trước. Tiếng Việt là lối thoát khi bí, không
 * phải điểm xuất phát.
 *
 * Đi cùng `localePrefix: 'as-needed'`, ngôn ngữ mặc định KHÔNG có tiền tố URL:
 * `/play` là tiếng Anh, `/vi/play` là tiếng Việt.
 */
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Cookie ghi lựa chọn ngôn ngữ gần nhất của người dùng.
 *
 * Bộ chọn ngôn ngữ ghi, middleware đọc. Không ai khác đụng vào — nên cookie này
 * TỒN TẠI nghĩa là "người dùng đã tự tay chọn", không bao giờ có nghĩa gì khác.
 *
 * KHÔNG dùng tên `NEXT_LOCALE` của next-intl, dù nó đang bỏ trống tên đó
 * (`localeDetection` tắt thì next-intl không ghi cookie). Lý do: hồi mặc định
 * còn là tiếng Việt, next-intl ĐÃ ghi `NEXT_LOCALE=vi` vào máy mọi người từng
 * mở trang. Đọc lại tên cũ thì họ vẫn bị đẩy sang tiếng Việt vĩnh viễn, và
 * "mặc định tiếng Anh" không bao giờ đến được với đúng những người đã dùng sản
 * phẩm. Tên mới bắt đầu từ con số không.
 */
export const LOCALE_COOKIE = 'vf_locale';

/**
 * Tên ngôn ngữ, viết BẰNG CHÍNH NGÔN NGỮ ĐÓ.
 *
 * Đây là ngoại lệ có chủ ý của luật "chữ hiển thị nằm trong `messages/`". Nếu
 * dịch tên ngôn ngữ theo giao diện đang bật thì người đang lạc trong một thứ
 * tiếng họ không đọc được sẽ không tìm thấy tiếng của mình — mà đó đúng là lúc
 * họ cần bộ chọn này nhất. Cho nên "Tiếng Việt" luôn là "Tiếng Việt".
 *
 * Chỉ có chữ, KHÔNG có cờ. Windows không có glyph cho ký tự cờ nên 🇬🇧 hiện ra
 * thành một ô chữ "GB" — mà phần lớn máy ở đây chạy Windows. Với lại cờ Anh
 * quốc không phải là tiếng Anh: người Mỹ, Úc, Ấn Độ đều nói thứ tiếng đó.
 */
export const LOCALE_LABEL: Record<Locale, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
};

export function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (LOCALES as readonly string[]).includes(value);
}

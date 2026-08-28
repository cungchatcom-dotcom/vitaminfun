'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { usePathname, useRouter } from '@/i18n/routing';
import { LOCALES, LOCALE_COOKIE, LOCALE_LABEL, type Locale } from '@/i18n/locales';

/** Nhớ lựa chọn một năm. Đây là sở thích, không phải phiên đăng nhập. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Bộ chọn ngôn ngữ.
 *
 * Đặt ngay trên thanh đầu trang và ở màn đăng nhập, KHÔNG giấu trong trang cài
 * đặt: mặc định là tiếng Anh, nên người chưa đọc được tiếng Anh phải nhìn thấy
 * lối ra ngay ở màn hình đầu tiên — trước cả khi họ đăng nhập được.
 *
 * Là các nút bấm chứ không phải `<select>`: hai ngôn ngữ thì một cú bấm là
 * xong, và cả hai lựa chọn đều hiện sẵn nên không phải mở ra mới biết có gì.
 * Danh sách dựng từ `LOCALES` nên thêm ngôn ngữ vẫn không phải sửa file này.
 */
export function LocaleSwitcher() {
  const active = useLocale() as Locale;
  const t = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: Locale) {
    if (next === active) return;

    // Ghi lựa chọn để middleware biết đường mà tôn trọng ở những URL không có
    // tiền tố ngôn ngữ (gõ thẳng tên miền, hay bị đá về nhà sau khi đăng nhập).
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${COOKIE_MAX_AGE};samesite=lax`;

    // `usePathname` của next-intl trả đường dẫn ĐÃ BỎ tiền tố, và `replace`
    // gắn lại tiền tố đúng cho ngôn ngữ mới — nên ở đây không phải cắt chuỗi.
    // Query giữ nguyên: đang lọc ngân hàng câu hỏi mà đổi ngôn ngữ thì không
    // có lý do gì mất bộ lọc. Đọc từ `window` chứ không dùng `useSearchParams`,
    // vì hook đó bắt mọi trang chứa nút này phải bọc trong <Suspense>.
    const search = window.location.search;
    startTransition(() => router.replace(`${pathname}${search}`, { locale: next }));
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('language')}>
      {LOCALES.map((code) => {
        const current = code === active;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            disabled={pending}
            aria-current={current ? 'true' : undefined}
            onClick={() => change(code)}
            className={`rounded-lg px-2.5 py-1 text-xs transition disabled:opacity-50 ${
              current
                ? 'bg-abyss-700 text-slate-100'
                : 'text-slate-400 hover:bg-abyss-800 hover:text-slate-200'
            }`}
          >
            {LOCALE_LABEL[code]}
          </button>
        );
      })}
    </div>
  );
}

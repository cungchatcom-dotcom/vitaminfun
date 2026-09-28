import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { SiteConfigProvider } from '@/components/site-config-context';
import { routing, type Locale } from '@/i18n/routing';
import { pickText } from '@/lib/i18n-text';
import { readSiteConfig } from '@/lib/site-server';

import '../globals.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * TIÊU ĐỀ VÀ BIỂU TƯỢNG TAB đọc từ cấu hình của trang, không viết cứng.
 *
 * `generateMetadata` chứ không phải `metadata` tĩnh: hai giá trị này do giáo
 * viên đổi từ màn Cấu hình lúc trang đang chạy, nên chúng phải được hỏi lại ở
 * mỗi request. Một hằng số ở đây nghĩa là đổi tên trang xong phải build lại cả
 * frontend.
 *
 * Chưa đặt gì thì lùi về `messages/*.json` — đúng cái tên trang vẫn mang trước
 * khi có màn cấu hình, nên một bản cài chưa ai đụng tới không thấy gì đổi.
 *
 * Favicon: chỉ khai `icons` KHI ĐÃ CÓ ảnh. Khai một mảng rỗng sẽ chặn mất
 * `/favicon.ico` mặc định mà Next tự tìm, và kết quả là tab trống trơn.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [t, config] = await Promise.all([
    getTranslations({ locale, namespace: 'app' }),
    readSiteConfig(),
  ]);

  const ten = pickText(config.title_i18n ?? {}, locale) || `${t('name')} — ${t('tagline')}`;

  // Nhãn DƯỚI biểu tượng ngoài màn hình chính. Ngắn, không kèm khẩu hiệu: iOS
  // cắt nhãn ở khoảng một chục ký tự, nên "Vitaverse — Play to Learn" hiện ra
  // thành "Vitaverse —…". Cùng một quy tắc với `short_name` trong manifest.
  const tenNgan = pickText(config.title_i18n ?? {}, locale) || t('name');

  return {
    title: ten,
    description: t('metaDescription'),

    // "Thêm vào màn hình chính" — xem `app/manifest.ts`. Đường dẫn tuyệt đối
    // từ gốc, không theo ngôn ngữ: manifest là MỘT bản cho cả trang.
    manifest: '/manifest.webmanifest',

    /**
     * iOS đọc RIÊNG mấy thẻ này, không đọc manifest cho phần đó.
     *
     * `capable` phát ra `apple-mobile-web-app-capable`: thiếu nó thì bấm biểu
     * tượng ngoài màn hình chính vẫn mở ra Safari đầy đủ thanh địa chỉ — tức là
     * cài xong mà chẳng được gì.
     *
     * `statusBarStyle: 'black'` chứ không `'black-translucent'`: cái sau đẩy
     * nội dung chui xuống DƯỚI thanh trạng thái, và phải tự chừa `safe-area`ở
     * mọi màn mới không bị đồng hồ với vạch sóng đè lên. Chưa làm phần chừa ấy
     * thì đừng bật cái cờ đòi nó.
     */
    appleWebApp: { capable: true, title: tenNgan, statusBarStyle: 'black' },

    // Next phát ra `mobile-web-app-capable` — tên MỚI, và Chrome đã bỏ tên cũ.
    // Nhưng Safari đời trước chỉ hiểu tên cũ, và ở đó "không hiểu" nghĩa là bấm
    // biểu tượng ngoài màn hình chính vẫn mở ra Safari đủ thanh địa chỉ, tức là
    // cài xong mà chẳng được gì. Hai thẻ cùng lúc: thẻ thừa thì vô hại, còn
    // thiếu thì hỏng đúng cái tính năng vừa dựng.
    other: { 'apple-mobile-web-app-capable': 'yes' },

    ...(config.favicon_url
      ? {
          icons: {
            icon: config.favicon_url,
            // Biểu tượng trên màn hình chính của iPhone/iPad. Cùng một ảnh:
            // giáo viên đặt một chỗ, dùng cho mọi chỗ.
            apple: config.favicon_url,
          },
        }
      : {}),
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();

  setRequestLocale(locale);
  const [messages, config] = await Promise.all([getMessages(), readSiteConfig()]);

  return (
    <html lang={locale} className="h-full">
      <body className="h-full bg-abyss-950 text-slate-100">
        <NextIntlClientProvider messages={messages}>
          <SiteConfigProvider config={config}>{children}</SiteConfigProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

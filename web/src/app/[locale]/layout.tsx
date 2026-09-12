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

  return {
    title: ten,
    description: t('metaDescription'),
    ...(config.favicon_url ? { icons: { icon: config.favicon_url } } : {}),
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

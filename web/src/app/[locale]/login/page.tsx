import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { LoginForm } from '@/components/login-form';

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('login');
  const tApp = await getTranslations('app');

  // Gợi ý tài khoản mẫu CHỈ hiện ở môi trường dev. Trên production đây là
  // một tấm biển chỉ đường cho người dò tài khoản.
  const showDemo = process.env.NODE_ENV !== 'production';

  return (
    <main className="flex min-h-full items-center justify-center bg-linear-to-b from-abyss-950 to-abyss-800 px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Bộ chọn ngôn ngữ đứng TRƯỚC ô đăng nhập. Giao diện mặc định là
            tiếng Anh, nên một học sinh chưa đọc được tiếng Anh phải có lối
            đổi ngay ở màn hình đầu tiên — chứ không phải đăng nhập xong,
            vào tới thanh đầu trang mới thấy. */}
        <div className="mb-6 flex justify-center">
          <LocaleSwitcher />
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-orichalcum-400">{tApp('name')}</h1>
          <p className="mt-1 text-sm text-slate-400">{tApp('tagline')}</p>
        </div>

        <div className="rounded-2xl border border-abyss-700 bg-abyss-900/60 p-6 shadow-xl">
          <h2 className="mb-1 text-lg font-semibold">{t('title')}</h2>
          <p className="mb-6 text-sm text-slate-400">{t('subtitle')}</p>

          <Suspense>
            <LoginForm />
          </Suspense>
        </div>

        {showDemo && (
          <div className="mt-6 rounded-xl border border-abyss-800 bg-abyss-900/40 p-4 text-xs text-slate-400">
            <p className="mb-2 font-medium text-slate-300">{t('demoHint')}</p>
            <ul className="space-y-1 font-mono">
              <li>admin@vitaminfun.local</li>
              <li>teacher@vitaminfun.local</li>
              <li>student@vitaminfun.local</li>
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}

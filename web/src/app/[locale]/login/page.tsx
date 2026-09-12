import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { Suspense } from 'react';

import { LoginForm } from '@/components/login-form';
import { localizedPath } from '@/lib/routes';
import { selfSignupEnabled } from '@/lib/signup';

/**
 * DỰNG LẠI Ở MỖI REQUEST, không nướng sẵn vào bản build.
 *
 * Trang này đọc `ALLOW_SELF_SIGNUP` từ `.env`. Next mặc định dựng sẵn mọi trang
 * không chạm vào dữ liệu của request — và khi đó `selfSignupEnabled()` chạy
 * MỘT LẦN lúc `next build`, nên đổi biến trong `.env` rồi khởi động lại vẫn ra
 * y hệt màn hình cũ. Một cái công tắc gạt mà đèn không đổi là thứ người ta sẽ
 * gạt đi gạt lại rồi kết luận là hỏng.
 */
export const dynamic = 'force-dynamic';

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('login');
  const tApp = await getTranslations('app');
  const tSignup = await getTranslations('signup');

  // Một biến `.env` duy nhất quyết định có lối tự mở tài khoản hay không —
  // xem `lib/signup.ts`. Ở đây chỉ là cái nút; chốt thật nằm ở API.
  const choDangKy = selfSignupEnabled();

  // Gợi ý tài khoản mẫu CHỈ hiện ở môi trường dev. Trên production đây là
  // một tấm biển chỉ đường cho người dò tài khoản.
  const showDemo = process.env.NODE_ENV !== 'production';

  return (
    <main className="flex min-h-full items-center justify-center bg-linear-to-b from-abyss-950 to-abyss-800 px-4 py-12">
      <div className="w-full max-w-sm">
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

          {/* Lối mở tài khoản đứng NGAY DƯỚI ô đăng nhập, không nấp ở chân
              trang: người chưa có tài khoản thì cả màn hình này chưa có việc
              gì cho họ làm cả. */}
          {choDangKy && (
            <p className="mt-6 border-t border-abyss-800 pt-5 text-center text-sm text-slate-400">
              {tSignup('noAccount')}{' '}
              <Link
                href={localizedPath('/signup', locale)}
                className="font-medium text-lagoon-400 hover:text-lagoon-300"
              >
                {tSignup('cta')}
              </Link>
            </p>
          )}
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

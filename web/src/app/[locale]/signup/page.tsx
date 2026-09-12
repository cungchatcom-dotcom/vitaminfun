import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SignupForm } from '@/components/signup-form';
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

export default async function SignupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Tắt bằng `.env` thì trang này KHÔNG TỒN TẠI, không chỉ là cái nút bị ẩn.
  // Người gõ thẳng URL cũng về đúng chỗ duy nhất còn ý nghĩa: màn đăng nhập.
  if (!selfSignupEnabled()) redirect(localizedPath('/login', locale));

  const t = await getTranslations('signup');
  const tApp = await getTranslations('app');

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

          <SignupForm />

          <p className="mt-6 text-center text-sm text-slate-400">
            {t('haveAccount')}{' '}
            <Link
              href={localizedPath('/login', locale)}
              className="font-medium text-lagoon-400 hover:text-lagoon-300"
            >
              {t('toLogin')}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

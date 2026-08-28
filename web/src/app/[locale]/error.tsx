'use client';

import { useTranslations } from 'next-intl';

/**
 * Màn báo lỗi cho mọi trang trong `[locale]`.
 *
 * Không có file này thì một lỗi ở Server Component cho ra **trang trắng** — và
 * người dùng không có cách nào biết chuyện gì đã xảy ra hay phải làm gì tiếp.
 * Đó chính là triệu chứng đã gặp khi API treo.
 *
 * Next bắt buộc đây là Client Component: nó phải chạy được sau khi phía server
 * đã hỏng.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('error');
  const tPage = useTranslations('errorPage');

  // Lỗi từ `apiFetch` mang `code`, còn lỗi lập trình thì không.
  const code = (error as { code?: string }).code;
  const known = code === 'TIMEOUT' || code === 'NETWORK';

  return (
    <main className="flex min-h-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <p className="text-4xl" aria-hidden>
          🐙
        </p>
        <h1 className="mt-4 text-lg font-semibold text-slate-100">{tPage('title')}</h1>

        <p className="mt-2 text-sm text-slate-400">
          {known ? t(code) : t('INTERNAL_ERROR')}
        </p>

        {/* `digest` là mã Next gán cho lỗi phía server; đọc log theo mã này ra
            đúng dấu vết. Hiện ra để người dùng đọc cho ta qua điện thoại. */}
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-slate-600">{error.digest}</p>
        )}

        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-lg bg-lagoon-500 px-4 py-2 text-sm font-semibold text-abyss-950 transition hover:bg-lagoon-400"
        >
          {tPage('retry')}
        </button>
      </div>
    </main>
  );
}

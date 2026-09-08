import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { AuthProvider } from '@/components/auth-context';
import { WorldStages } from '@/components/game/world-stages';
import { PreviewBanner } from '@/components/preview-banner';
import { TopBar } from '@/components/top-bar';
import { apiFetch } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { requireUser } from '@/lib/auth';

import type { PlayContext, PlayWorldDetail } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function WorldPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await requireUser();

  const [context, world] = await Promise.all([
    apiFetch<PlayContext>('/play/context'),
    apiFetch<PlayWorldDetail>(`/play/worlds/${id}`).catch((error) => {
      // World chưa phát hành thì backend trả 404 cho học sinh — đúng như world
      // không tồn tại. Chuyển thành trang 404 thay vì để lỗi tràn ra màn hình:
      // "không tìm thấy" và "có nhưng bạn không được xem" phải giống hệt nhau,
      // nếu không thì chính thông báo lỗi đã tiết lộ nội dung chưa phát hành.
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }),
  ]);

  return (
    <AuthProvider user={user}>
      <div className="flex min-h-full flex-col">
        {context.is_preview && <PreviewBanner />}
        <TopBar accent="student" />

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
          <WorldStages world={world} locale={locale} />
        </main>
      </div>
    </AuthProvider>
  );
}

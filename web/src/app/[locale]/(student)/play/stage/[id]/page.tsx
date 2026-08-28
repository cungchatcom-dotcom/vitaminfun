import { setRequestLocale } from 'next-intl/server';

import { AuthProvider } from '@/components/auth-context';
import { PreviewBanner } from '@/components/preview-banner';
import { TopBar } from '@/components/top-bar';
import { StagePlay } from '@/components/game/stage-play';
import { apiFetch } from '@/lib/api-client';
import { requireUser } from '@/lib/auth';
import type { PlayContext } from '@/lib/types';

// Trang này hiển thị dữ liệu RIÊNG của từng người, không bao giờ được nằm
// trong bộ nhớ đệm dùng chung.
export const dynamic = 'force-dynamic';

/**
 * Màn chơi (S5).
 *
 * Phaser vẽ cảnh 2.5D, React vẽ HUD chồng lên, server giữ đáp án và chấm điểm.
 */
export default async function StagePlayPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await requireUser();
  const context = await apiFetch<PlayContext>('/play/context');

  return (
    <AuthProvider user={user}>
      <div className="flex min-h-full flex-col">
        {context.is_preview && <PreviewBanner />}
        <TopBar accent="student" />
        <main className="flex-1">
          <StagePlay stageId={id} />
        </main>
      </div>
    </AuthProvider>
  );
}

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
      {/* TRỌN MÀN HÌNH. Tấm bản đồ là một BỨC TRANH 3200×1800 do chính người
          dựng vẽ ra; nhốt nó trong một cột rộng 72rem giữa hai dải trống thì
          phân nửa công sức ấy không ai nhìn thấy.

          `h-dvh` chứ không `h-screen`: trên điện thoại, `100vh` tính cả phần bị
          thanh địa chỉ che, nên mép dưới bản đồ bị cắt.

          Thanh trên cùng GIỮ LẠI, khác màn chơi: ở đây người dùng còn cần lối
          đăng xuất và tên mình, mà màn này không có HUD nào mang chúng. */}
      <div className="flex h-dvh flex-col overflow-hidden">
        {context.is_preview && (
          <div className="shrink-0">
            <PreviewBanner />
          </div>
        )}
        <div className="shrink-0">
          <TopBar accent="student" />
        </div>

        {/* `relative` để lời báo Cánh cổng Thời gian neo được vào đây. */}
        <main className="relative flex min-h-0 flex-1 items-center justify-center p-3">
          <WorldStages world={world} locale={locale} />
        </main>
      </div>
    </AuthProvider>
  );
}

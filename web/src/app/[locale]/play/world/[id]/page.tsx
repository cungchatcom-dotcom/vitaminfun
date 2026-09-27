import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { AuthProvider } from '@/components/auth-context';
import { WorldStages } from '@/components/game/world-stages';
import { PreviewBanner } from '@/components/preview-banner';
import { RotateGate } from '@/components/game/rotate-gate';
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

          KHÔNG có thanh trên cùng, giống màn chơi: nó ăn ~56px chiều cao để chở
          ba thứ mà tấm khung đã có chỗ cho — xem `PlayerMenu`. Xoay ngang điện
          thoại thì 56px ấy là một phần tám màn hình, cắt thẳng vào tấm tranh
          16:9 vốn đã phải co để vừa chiều cao. */}
      <div className="flex h-dvh flex-col overflow-hidden">
        {context.is_preview && (
          <div className="shrink-0">
            <PreviewBanner />
          </div>
        )}
        {/* `relative` để lời báo Cánh cổng Thời gian neo được vào đây. */}
        {/* `play-frame`: bỏ đệm và cắt phần tràn khi màn hình dọc — xem
            `globals.css`. */}
        <main className="play-frame relative flex min-h-0 flex-1 items-center justify-center p-3">
          <WorldStages world={world} locale={locale} />
        </main>
      </div>

      {/* Mời xoay ngang CHỈ KHI chưa có bố cục dọc — cùng luật với bản đồ
          thiên hà. Có rồi thì điện thoại dựng đứng nhận đúng tấm phòng chờ dành
          cho nó, và một lớp phủ đè lên trên là phủ nhận chính công sức vừa bỏ
          ra thiết kế nó. */}
      {!world.lobby_portrait && <RotateGate />}
    </AuthProvider>
  );
}

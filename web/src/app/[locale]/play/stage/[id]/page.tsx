import { setRequestLocale } from 'next-intl/server';

import { AuthProvider } from '@/components/auth-context';
import { PreviewBanner } from '@/components/preview-banner';
import { StagePlay } from '@/components/game/stage-play';
import { apiFetch } from '@/lib/api-client';
import { requireUser } from '@/lib/auth';
import type { PlayContext, StageIntro } from '@/lib/types';

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

  // SONG SONG, không nối đuôi: hai request độc lập nhau, và chờ lần lượt là
  // cộng thêm đúng một vòng mạng vào cái khoảnh khắc mà cả tính năng video mở
  // màn sinh ra để rút ngắn.
  //
  // Đọc Ở ĐÂY chứ không ở client: nhờ vậy thẻ `<video>` đã nằm sẵn trong HTML
  // của lần vẽ đầu tiên và bắt đầu tải ngay, thay vì đợi React chạy rồi mới hỏi
  // server xem màn này có video hay không.
  const [context, intro] = await Promise.all([
    apiFetch<PlayContext>('/play/context'),
    apiFetch<StageIntro>(`/play/stages/${id}/intro`),
  ]);

  return (
    <AuthProvider user={user}>
      {/* TRỌN MÀN HÌNH. Không có thanh điều hướng ở đây, và đó là chủ ý: màn
          chơi là một khung cảnh, không phải một trang trong website. Đường ra
          nằm ngay trong HUD ("Rời màn", góc trên phải), tức là ở chỗ người chơi
          đang nhìn chứ không phải ở một thanh menu phía trên.

          `h-dvh` chứ không `h-screen`: trên điện thoại, `100vh` tính cả phần bị
          thanh địa chỉ che, nên cảnh bị cắt mất một dải dưới đáy.

          Dải CHƠI THỬ thì vẫn giữ — nó là của giáo viên, mang nút Thoát và Xoá
          tiến độ, và học sinh không bao giờ thấy nó. */}
      <div className="flex h-dvh flex-col overflow-hidden">
        {context.is_preview && (
          <div className="shrink-0">
            <PreviewBanner />
          </div>
        )}
        <main className="min-h-0 flex-1">
          <StagePlay stageId={id} introVideoUrl={intro.intro_video_url ?? null} />
        </main>
      </div>
    </AuthProvider>
  );
}

import { setRequestLocale } from 'next-intl/server';

import { AuthProvider } from '@/components/auth-context';
import { GalaxyMap } from '@/components/game/galaxy-map';
import { PreviewBanner } from '@/components/preview-banner';
import { RotateGate } from '@/components/game/rotate-gate';
import { apiFetch } from '@/lib/api-client';
import { requireUser } from '@/lib/auth';

import type { PlayContext, PlayGalaxy } from '@/lib/types';

// Trang này hiển thị dữ liệu RIÊNG của từng người, không bao giờ được nằm
// trong bộ nhớ đệm dùng chung. `cookies()` vốn đã làm nó động, nhưng ghi rõ ra
// đây vì hậu quả của việc đoán sai là người này thấy trang của người kia.
export const dynamic = 'force-dynamic';

export default async function GalaxyMapPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireUser();

  // Chế độ chơi thử do BACKEND quyết định, không suy ra từ vai trò ở frontend.
  // Một chỗ quyết định thì không có hai chỗ để lệch nhau.
  const [context, galaxy] = await Promise.all([
    apiFetch<PlayContext>('/play/context'),
    // Nền, nhạc và danh sách world về CÙNG một lượt gọi: chúng dựng nên một
    // màn hình, tách ra là màn hình vẽ hai lần.
    apiFetch<PlayGalaxy>('/play/galaxy'),
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
        {/* Không có tiêu đề trang phía trên tấm bản đồ.
            "Galaxy map" thì chính tấm bản đồ đã nói rõ hơn mọi dòng chữ, còn
            "Chào <tên>" thì nút tài khoản góc trên phải đã mang tên người đang
            đăng nhập.
            Hai dòng đó chỉ đẩy bản đồ tụt xuống và ăn mất chiều cao màn hình —
            thứ mà một bức tranh 3200×1800 cần hơn cả. */}
        {/* `play-frame`: bỏ đệm khi màn hình dọc — xem `globals.css`. */}
        <main className="play-frame flex min-h-0 flex-1 items-center justify-center p-3">
          <GalaxyMap galaxy={galaxy} />
        </main>
      </div>

      {/* Mời xoay ngang CHỈ KHI chưa có bố cục dọc.
          Có rồi thì điện thoại dựng đứng nhận đúng tấm bản đồ dành cho nó, và
          một lớp phủ mời xoay đè lên trên là phủ nhận chính công sức vừa bỏ ra
          thiết kế nó. Ảnh nền là dấu hiệu "đã thiết kế", quyết ở server. */}
      {!galaxy.portrait?.background_url && <RotateGate />}
    </AuthProvider>
  );
}

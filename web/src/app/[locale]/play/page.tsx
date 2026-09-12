import { setRequestLocale } from 'next-intl/server';

import { AuthProvider } from '@/components/auth-context';
import { GalaxyMap } from '@/components/game/galaxy-map';
import { PreviewBanner } from '@/components/preview-banner';
import { TopBar } from '@/components/top-bar';
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

        {/* Không có tiêu đề trang phía trên tấm bản đồ.
            "Galaxy map" thì chính tấm bản đồ đã nói rõ hơn mọi dòng chữ, còn
            "Chào <tên>" thì thanh trên cùng đã có sẵn tên người đang đăng nhập.
            Hai dòng đó chỉ đẩy bản đồ tụt xuống và ăn mất chiều cao màn hình —
            thứ mà một bức tranh 3200×1800 cần hơn cả. */}
        <main className="flex min-h-0 flex-1 items-center justify-center p-3">
          <GalaxyMap galaxy={galaxy} />
        </main>
      </div>
    </AuthProvider>
  );
}

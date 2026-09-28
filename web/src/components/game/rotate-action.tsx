'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * MỘT cú chạm, và mỗi máy làm được tới đâu thì làm tới đó.
 *
 * Lớp phủ đứng đó mời người ta xoay máy. Nút này rút ngắn lời mời ấy thành một
 * cú chạm — nhưng chỉ hứa đúng thứ cái máy trước mặt làm được, nên không bao
 * giờ có cảnh bấm vào rồi không xảy ra gì.
 *
 * Ba bậc, lấy bậc cao nhất máy cho phép:
 *
 * 1. **Xoay thật** — `requestFullscreen()` rồi `orientation.lock('landscape')`.
 *    Hệ điều hành quay màn hình và giữ nguyên, ĐÈ LÊN cả khoá xoay của máy: học
 *    sinh không phải chui vào trung tâm điều khiển. Kèm theo một món hời: toàn
 *    màn hình giấu luôn thanh địa chỉ và thanh tab, thứ đang ăn khoảng một phần
 *    tư chiều cao khi chơi ngang.
 * 2. **Chỉ toàn màn hình** — máy có `requestFullscreen` nhưng không cho khoá
 *    hướng. Vẫn đáng một cú chạm vì món hời ở trên, rồi xoay máy nốt.
 * 3. **Không gì cả** — Safari trên iPhone: không có `requestFullscreen` cho thẻ
 *    thường (chỉ video), cũng không có `lock()`. Không vẽ nút nào. Một cái nút
 *    bấm vào không xảy ra gì còn tệ hơn là không có nút, vì người ta sẽ bấm lại
 *    vài lần rồi mới chịu đọc dòng chữ bên dưới.
 *
 * Cả ba bậc đều KHÔNG bắt buộc: xoay máy bằng tay lúc nào cũng làm lớp phủ biến
 * mất, vì việc ẩn/hiện là của media query chứ không phải của cái nút này.
 *
 * ## Vì sao không tự chạy, phải có người chạm
 *
 * `requestFullscreen()` chỉ chạy trong một sự kiện do NGƯỜI DÙNG sinh ra —
 * trình duyệt chặn để không trang nào tự chiếm màn hình. Gọi lúc nạp trang là
 * ném lỗi và không làm gì. Mà cú chạm ấy vốn đã phải có: trình duyệt cũng đòi
 * đúng một cú chạm như vậy trước khi cho phát nhạc. Nên đây không phải một bước
 * thêm vào, chỉ là đặt tên cho bước đã có.
 *
 * ## Vì sao không quay cái TRANG bằng `transform: rotate(90deg)`
 *
 * Đó là cách duy nhất "tự xoay" được trên iPhone, và nó hỏng ba chỗ:
 *
 *  - **Phaser** chạy ở chế độ `Scale.RESIZE`, tự đo khung bằng
 *    `getBoundingClientRect()`. Sau một phép quay, hàm đó trả về hình chữ nhật
 *    BAO NGOÀI canvas đã quay: Phaser vừa đo sai kích thước vừa đổi ngược trục
 *    toạ độ điểm chạm — chạm vào NPC bên trái thì nhận một cú chạm phía dưới.
 *  - **Bàn phím ảo** (có dạng câu hỏi gõ chữ) do hệ điều hành vẽ, nó không biết
 *    trang đang tự quay nên bật lên theo chiều dọc, che mất ô đang gõ.
 *  - `100dvh`, `position: fixed`, thanh địa chỉ Safari — vẫn tính theo màn dọc.
 *
 * Và nó cũng chẳng tiết kiệm được cú chạm nào: iOS bắt xin quyền cảm biến
 * nghiêng, cũng bằng một cú chạm. Tức là trả đúng cái giá đó để lấy về một giao
 * diện trông thì ngang mà bấm thì lệch.
 */
export function RotateAction() {
  const t = useTranslations('play.rotate');

  // `null` = chưa dò xong. Lần vẽ đầu chạy ở server, nơi không có `screen`, nên
  // không được đoán: đoán "làm được" thì cái nút loé lên rồi biến mất.
  const [bac, setBac] = useState<'xoay' | 'toan-man' | 'khong' | null>(null);

  useEffect(() => {
    const coToanMan = typeof document.documentElement.requestFullscreen === 'function';
    if (!coToanMan) return setBac('khong');
    setBac(typeof huong()?.lock === 'function' ? 'xoay' : 'toan-man');
  }, []);

  if (bac === null || bac === 'khong') return null;

  async function cham() {
    try {
      await document.documentElement.requestFullscreen();
      // Khoá hướng RIÊNG một lượt thử: máy có thể cho toàn màn hình mà từ chối
      // khoá hướng (máy tính bảng đang bật khoá xoay của hệ điều hành). Gộp
      // chung một `try` thì một cái hỏng kéo cả cái kia thành "không làm được",
      // và ta vứt đi mất phần toàn màn hình vừa lấy được.
      if (typeof huong()?.lock === 'function') {
        await huong()!.lock!('landscape');
      }
    } catch {
      // Không báo lỗi: lớp phủ vẫn còn đó và vẫn nói đúng việc phải làm — xoay
      // bằng tay. Một hộp thoại "không khoá được hướng màn hình" thì phiền hơn
      // chính cái nó báo, vì người dùng chẳng làm gì được với nó.
      setBac('khong');
    }
  }

  return (
    <button
      type="button"
      onClick={cham}
      className="mt-6 rounded-xl border border-orichalcum-500/60 bg-orichalcum-500/15 px-5 py-3 font-bold text-orichalcum-400 transition active:bg-orichalcum-500/30"
    >
      {t(bac === 'xoay' ? 'auto' : 'fullscreen')}
    </button>
  );
}

/**
 * `screen.orientation`, khai báo kèm `lock()`.
 *
 * Kiểu sẵn có của TypeScript không có `lock()` trong `ScreenOrientation` vì nó
 * chưa nằm trong phần chuẩn mà mọi trình duyệt đã theo — đúng cái lý do phải dò
 * lúc chạy. Và `screen.orientation` cũng có thể không tồn tại.
 */
type HuongManHinh = ScreenOrientation & {
  lock?: (huong: 'landscape') => Promise<void>;
};

function huong(): HuongManHinh | undefined {
  return window.screen?.orientation as HuongManHinh | undefined;
}

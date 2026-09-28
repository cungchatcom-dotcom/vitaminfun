import { getTranslations } from 'next-intl/server';

import { RotateAction } from './rotate-action';

/**
 * "Xoay ngang máy để chơi" — lớp phủ kín màn khi điện thoại đang dựng đứng.
 *
 * Mọi màn của học sinh là một BỨC TRANH 16:9 do người dựng vẽ: bản đồ thiên hà,
 * phòng chờ, màn chơi. Tranh 16:9 nhét vào một khung dọc thì chỉ co lại được,
 * không xếp lại được — cao 3200×1800 trong một màn rộng 390px là một dải ảnh
 * cao 220px nằm giữa hai khoảng trống, chữ trong đó bé tới mức không đọc nổi.
 * Không có cách bố trí nào cứu được, vì chính tỉ lệ mới là thứ sai.
 *
 * Nên câu trả lời không phải "xếp lại cho vừa màn dọc" mà là "màn dọc không
 * phải tư thế để chơi" — và nói thẳng điều đó ra, thay vì để học sinh nhìn một
 * màn hình hỏng rồi tự đoán.
 *
 * ## Xoay giúp, ở máy nào làm được
 *
 * `screen.orientation.lock('landscape')` xoay thật cái màn hình, nhưng chỉ chạy
 * khi trang đang toàn màn hình — mà vào toàn màn hình thì phải có một cú bấm
 * của người dùng. Tức là vẫn cần đúng cái lớp phủ này để có chỗ mà bấm; nút ấy
 * là `RotateAction`, và nó tự ẩn ở máy không làm được (iOS).
 *
 * Nên lớp phủ vẫn là thứ chính, không phải bản dự phòng: nó chạy ở MỌI máy, còn
 * cái nút là lối tắt cho máy nào có.
 *
 * Bên dưới lớp phủ, trang VẪN CHẠY: Phaser giữ nguyên cảnh, nhạc giữ nguyên
 * nhịp. Xoay xong là lộ ra đúng chỗ đang dở, không phải nạp lại.
 *
 * Ẩn/hiện thuần CSS — xem `.rotate-gate` trong `globals.css`.
 */
export async function RotateGate() {
  const t = await getTranslations('play.rotate');

  return (
    <div
      // `aria-hidden` khi đang ẩn thì không cần: `display:none` đã cắt nó khỏi
      // cây trợ năng. Còn lúc hiện thì nó là thứ DUY NHẤT trên màn, nên để
      // trình đọc màn hình đọc được là đúng.
      className="rotate-gate fixed inset-0 z-[60] place-items-center bg-abyss-950 p-8 text-center"
    >
      <div className="max-w-xs">
        <span className="rotate-hint block text-7xl leading-none" aria-hidden>
          📱
        </span>
        <p className="mt-8 text-xl font-bold text-orichalcum-400">{t('title')}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{t('body')}</p>
        <RotateAction />

        {/* Vì sao có dòng này: người bật khoá xoay màn hình thì XOAY MÁY KHÔNG
            LÀM GÌ CẢ — trình duyệt không bao giờ biết máy vừa quay, nên lớp phủ
            nằm lì. Không nói ra thì họ xoay đi xoay lại vài lần rồi kết luận
            trang hỏng, vì mọi thứ trên màn đang bảo họ làm đúng cái việc vừa
            làm mà không ăn thua.

            Nhỏ và mờ hơn hẳn: nó chỉ dành cho thiểu số đang mắc kẹt, còn với
            người bình thường thì xoay máy là xong và dòng này là nhiễu. */}
        <p className="mt-6 text-xs leading-relaxed text-slate-500">{t('hint')}</p>
      </div>
    </div>
  );
}

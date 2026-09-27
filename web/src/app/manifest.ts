import { getTranslations } from 'next-intl/server';

import { DEFAULT_LOCALE } from '@/i18n/locales';
import { pickText } from '@/lib/i18n-text';
import { readSiteConfig } from '@/lib/site-server';

import type { MetadataRoute } from 'next';

/**
 * WEB APP MANIFEST — "Thêm vào màn hình chính" trên cả Android và iOS.
 *
 * Cài lên màn hình chính thì trang mở ra KHÔNG CÓ thanh địa chỉ và thanh tab.
 * Đó không phải chuyện thẩm mỹ: ở chế độ ngang trên điện thoại, hai thanh ấy ăn
 * khoảng một phần tư chiều cao — đúng thứ một tấm tranh 16:9 đang thiếu. Bấm
 * biểu tượng ngoài màn hình chính là vào thẳng, không thanh nào cả, mà không
 * phải bấm nút toàn màn hình mỗi lần.
 *
 * ## Hai hệ, hai mức hiểu
 *
 * - **Android/Chrome** đọc trọn file này. `orientation: 'landscape'` được tôn
 *   trọng: mở từ màn hình chính là NẰM NGANG SẴN, kể cả khi máy đang bật khoá
 *   xoay. Đây là câu trả lời gọn nhất cho toàn bộ chuyện xoay màn.
 * - **iOS/Safari** đọc `name`, `short_name`, `icons`, `display`, `start_url`,
 *   nhưng **bỏ qua `orientation`**. Nên trên iPhone, cài lên màn hình chính lấy
 *   được phần "không còn thanh địa chỉ" — phần lớn nhất — còn hướng màn thì vẫn
 *   do người dùng xoay, và `RotateGate` vẫn là thứ nhắc họ.
 *
 * Khai `orientation` vẫn đúng dù iOS lờ đi: một trường bị lờ thì vô hại, còn bỏ
 * nó đi là Android cũng mất nốt.
 *
 * ## Tên và biểu tượng lấy từ CẤU HÌNH, không viết cứng
 *
 * Cùng một chỗ giáo viên đặt tên trang và tải favicon ở màn Cấu hình. Viết cứng
 * ở đây thì đổi tên trang xong, biểu tượng ngoài màn hình chính vẫn mang tên cũ
 * — và đó là chỗ người dùng nhìn thấy nhiều nhất.
 *
 * `dynamic = 'force-dynamic'` vì lẽ đó: hai giá trị này đổi lúc trang đang
 * chạy, nên không được nướng vào lúc build.
 */
export const dynamic = 'force-dynamic';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [t, config] = await Promise.all([
    getTranslations({ locale: DEFAULT_LOCALE, namespace: 'app' }),
    readSiteConfig(),
  ]);

  const ten = pickText(config.title_i18n ?? {}, DEFAULT_LOCALE) || t('name');

  return {
    name: `${ten} — ${t('tagline')}`,
    // Cái hiện DƯỚI biểu tượng ngoài màn hình chính. Chỗ đó chỉ vừa khoảng một
    // chục ký tự, nên là tên trần, không kèm khẩu hiệu.
    short_name: ten,
    description: t('metaDescription'),

    // Vào gốc, KHÔNG vào thẳng `/play`: cùng một bản cài phục vụ cả giáo viên
    // lẫn học sinh, và middleware đã biết đưa từng vai trò về đâu. Ghim
    // `/play` ở đây là giáo viên cài xong thì mở ra màn chơi thử.
    start_url: '/',

    display: 'standalone',
    orientation: 'landscape',

    // Cùng màu với `body` (`bg-abyss-950`). Lệch màu thì lúc mở app có một cú
    // nháy sáng trước khi trang vẽ xong.
    background_color: '#04121f',
    theme_color: '#04121f',

    ...(config.favicon_url
      ? {
          icons: [
            {
              src: config.favicon_url,
              // Cỡ THẬT đọc từ `media_assets`. Không đọc được (SVG) thì khai
              // `any` — đúng nghĩa "co giãn được", và đó cũng là điều duy nhất
              // trung thực có thể nói.
              sizes:
                config.favicon_width && config.favicon_height
                  ? `${config.favicon_width}x${config.favicon_height}`
                  : 'any',
              // KHÔNG khai `maskable`. Nghe thì đẹp hơn — Android được cắt
              // ảnh theo khuôn của máy thay vì dán một ô vuông vào chỗ tròn —
              // nhưng `maskable` là một LỜI HỨA: ảnh phải chừa sẵn viền an toàn
              // khoảng 20% quanh mép, vì máy được phép cắt tới đó. Ảnh giáo
              // viên tải lên là cái favicon họ có, không ai bảo họ chừa viền,
              // nên hứa thế là hứa hộ — và cái giá là logo bị xén mất mép trên
              // đúng cái màn hình chính.
              purpose: 'any',
            },
          ],
        }
      : {}),
  };
}

import createNextIntlPlugin from 'next-intl/plugin';

import { loadRootEnv } from './scripts/root-env.mjs';

import type { NextConfig } from 'next';

/**
 * Nạp `.env` ở gốc repo — lần thứ hai, cố ý.
 *
 * `scripts/with-root-env.mjs` đã nạp trước khi Next khởi động (bắt buộc, vì CLI
 * đọc PORT ngay lúc đó). Gọi lại ở đây là lưới an toàn cho trường hợp `next`
 * được gọi thẳng, không qua `pnpm dev` / `pnpm build` — ví dụ một công cụ IDE
 * hoặc lệnh gõ tay. `loadRootEnv()` không ghi đè biến đã có nên gọi hai lần
 * không sinh tác dụng phụ.
 */
loadRootEnv();

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * Tắt cái nút "N" nổi ở góc màn hình khi chạy `next dev`.
   *
   * Đó là chỉ báo của Next.js, không phải của dự án, và nó KHÔNG BAO GIỜ có
   * trong bản dựng phát hành — học sinh không thể thấy nó. Tắt đi chỉ vì lúc
   * căn bố cục phòng chờ thì một cái nút lạ nằm đè lên góc màn hình là thứ gây
   * nhiễu: người dựng phải tự nhắc mình rằng cái đó không thuộc về mình.
   *
   * `false` là cách tắt của Next 15.2 trở lên; hai khoá `buildActivity` và
   * `buildActivityPosition` của bản cũ đã bị bỏ.
   */
  devIndicators: false,

  // Gốc repo còn package-lock.json của bản prototype Vite, nên Next đoán nhầm
  // workspace root. web/ tự quản phụ thuộc của mình — chỉ nó thôi. Dòng này sẽ
  // xem lại ở Bước 5 khi prototype được gộp vào đây.
  outputFileTracingRoot: __dirname,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? '',
  },

  /**
   * `/media/*` — chuyển tiếp sang API khi không có ai khác phục vụ nó.
   *
   * ## Vì sao đường dẫn media phải TƯƠNG ĐỐI
   *
   * `media_assets.url` được ghi MỘT LẦN lúc tải file lên. Ghi tuyệt đối
   * (`https://abc.vita.com/media/...`) là đóng đinh một tên miền vào dữ liệu:
   * người vào bằng `xyz.vita.com` vẫn tải ảnh từ `abc`, và cái ngày `abc` đổi
   * tên hay ngừng dùng thì mọi tấm ảnh đã tải lên trước đó chết theo — sửa lại
   * là một lượt UPDATE trên cả bảng.
   *
   * Đường dẫn tương đối (`/media/...`) thì mỗi tên miền tự phục vụ file của
   * mình, và dữ liệu không biết gì về tên miền cả — thêm bao nhiêu tên miền
   * cũng không phải đụng vào một dòng nào.
   *
   * ## Vì sao cần rewrite này
   *
   * Trên server thật, nginx bắt `/media/` TRƯỚC Next và đọc thẳng từ đĩa
   * (DEPLOY.md §7) — nhanh hơn nhiều và không chiếm worker của Python. Rewrite
   * này khi đó không bao giờ chạy tới.
   *
   * Ở máy dev thì không có nginx: web ở cổng 5000, API ở 8000. Không có nó thì
   * `/media/...` trả 404 và cả trang chơi trắng ảnh. Có nó thì máy dev chạy
   * ĐÚNG như server thật — cùng một đường dẫn, cùng một origin, nên cũng không
   * còn chuyện ảnh bị chặn vì CORS giữa hai cổng.
   */
  async rewrites() {
    const api = (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '').replace(
      /\/$/,
      '',
    );
    // `API_INTERNAL_URL` trỏ tới tiền tố API (`http://host:8000/api/v1`), còn
    // media nằm ở GỐC của cùng máy chủ ấy — cắt tiền tố đi, đừng nối thêm.
    const goc = api.replace(/\/api\/v\d+$/, '');
    if (!goc) return [];
    return [{ source: '/media/:path*', destination: `${goc}/media/:path*` }];
  },
};

export default withNextIntl(nextConfig);

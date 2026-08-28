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

  // Gốc repo còn package-lock.json của bản prototype Vite, nên Next đoán nhầm
  // workspace root. web/ tự quản phụ thuộc của mình — chỉ nó thôi. Dòng này sẽ
  // xem lại ở Bước 5 khi prototype được gộp vào đây.
  outputFileTracingRoot: __dirname,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? '',
  },
};

export default withNextIntl(nextConfig);

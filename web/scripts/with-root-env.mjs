/**
 * Chạy một lệnh sau khi đã nạp `.env` ở gốc repo.
 *
 *     node scripts/with-root-env.mjs next dev
 *
 * Vì sao cần lớp này: CLI của Next đọc `process.env.PORT` NGAY lúc khởi động,
 * trước khi nạp `next.config.ts`. Nạp `.env` bên trong next.config.ts là quá
 * muộn — cổng đã bị chốt ở 3000 rồi. Triệu chứng của việc này rất khó đoán:
 * đổi PORT trong .env mà không có gì thay đổi cả.
 *
 * Nhờ lớp này, `pnpm dev` và `pnpm start` không cần tham số `-p`, đúng nguyên
 * tắc "lệnh chạy không chứa giá trị cấu hình" (DEPLOY.md §3).
 */

import { spawn } from 'node:child_process';

import { loadRootEnv } from './root-env.mjs';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Cách dùng: node scripts/with-root-env.mjs <lệnh> [tham số...]');
  process.exit(1);
}

loadRootEnv();

// shell: true để `next` phân giải được qua node_modules/.bin trên cả Windows
// (next.cmd) lẫn Linux, không phải viết cứng đường dẫn theo hệ điều hành.
const child = spawn(args.join(' '), {
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

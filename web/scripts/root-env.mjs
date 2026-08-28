import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Nạp `.env` ở GỐC REPO vào process.env.
 *
 * DEPLOY.md §3 chốt: một file `.env` duy nhất cho cả `api/` và `web/`. Next chỉ
 * tự đọc `.env` nằm cạnh package.json, nên phải tự nạp lên.
 *
 * Biến đã có sẵn trong môi trường thì KHÔNG ghi đè — trên server thật,
 * systemd hoặc Docker truyền biến vào và chúng phải thắng file.
 *
 * @returns {string[]} tên các biến vừa được nạp
 */
export function loadRootEnv() {
  const loaded = [];

  for (const name of ['.env', '.env.local']) {
    let raw;
    try {
      raw = readFileSync(resolve(WEB_ROOT, '..', name), 'utf8');
    } catch {
      continue;
    }

    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;

      const key = trimmed.slice(0, eq).trim();
      const value = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, '');

      if (process.env[key] === undefined) {
        process.env[key] = value;
        loaded.push(key);
      }
    }
  }

  return loaded;
}

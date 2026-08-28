/**
 * Khai báo kiểu cho `root-env.mjs`.
 *
 * File nguồn phải giữ dạng `.mjs` chứ không viết bằng TypeScript: nó được
 * `with-root-env.mjs` nạp bằng `node` thuần, trước khi có bất kỳ bước biên dịch
 * nào. Vì vậy kiểu phải khai báo tay ở đây.
 */
export declare function loadRootEnv(): string[];

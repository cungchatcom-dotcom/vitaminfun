'use client';

import { createContext, useContext, type ReactNode } from 'react';

import { EMPTY_SITE_CONFIG, type SiteConfig } from '@/lib/site';

/**
 * Cấu hình chung của trang, đưa xuống cho mọi Client Component.
 *
 * Dựng ở LAYOUT và truyền xuống, không để mỗi chỗ tự hỏi server: thanh đầu
 * trang xuất hiện trên mọi màn, nên "tự hỏi" nghĩa là một lượt gọi mạng thừa ở
 * mọi lần chuyển trang — cho một giá trị đổi vài tháng một lần.
 *
 * Giá trị mặc định là cấu hình RỖNG, không phải `undefined`: chỗ đọc không phải
 * kiểm tra xem mình có nằm trong provider hay không, và trống đã có nghĩa rõ
 * ràng sẵn — "dùng tên mặc định trong `messages/`".
 */
const Ctx = createContext<SiteConfig>(EMPTY_SITE_CONFIG);

export function SiteConfigProvider({
  config,
  children,
}: {
  config: SiteConfig;
  children: ReactNode;
}) {
  return <Ctx.Provider value={config}>{children}</Ctx.Provider>;
}

export function useSiteConfig(): SiteConfig {
  return useContext(Ctx);
}

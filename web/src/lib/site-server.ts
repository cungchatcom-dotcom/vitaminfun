/**
 * Cấu hình chung của trang — phần chạy ở SERVER.
 *
 * Tách khỏi `site.ts` vì `api-client.ts` nhập `next/headers`: kéo nó vào một
 * file mà Client Component có nhập là bản dựng gãy. Xem ghi chú ở `site.ts`.
 */

import { cache } from 'react';

import { apiFetch } from './api-client';
import { EMPTY_SITE_CONFIG, type SiteConfig } from './site';

/**
 * ĐỌC cho `generateMetadata` của layout.
 *
 * KHÔNG cần đăng nhập: cái tên và cái favicon nằm trên chính màn hình đăng
 * nhập, tức ở chỗ chưa có ai để phân quyền.
 *
 * `cache()` của React: `generateMetadata` và thân layout cùng cần giá trị này,
 * và chúng chạy trong CÙNG một request — gói lại thì một lượt gọi mạng phục vụ
 * cả hai, thay vì hai lượt cho cùng một câu trả lời.
 *
 * Hỏng thì trả về cấu hình rỗng chứ KHÔNG ném: API chết là một sự cố, nhưng
 * "không đọc được tên trang" mà làm trắng cả trang thì là một sự cố tệ hơn
 * nhiều. Trống thì tiêu đề lùi về chuỗi trong `messages/*.json`.
 */
export const readSiteConfig = cache(async (): Promise<SiteConfig> => {
  try {
    return await apiFetch<SiteConfig>('/site/config', { auth: false });
  } catch {
    return EMPTY_SITE_CONFIG;
  }
});

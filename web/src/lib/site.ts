/**
 * Cấu hình chung của trang — phần chạy ở TRÌNH DUYỆT.
 *
 * Bản đọc phía server nằm ở `site-server.ts`. Hai file chứ không một, và đây là
 * lý do: `api-client.ts` nhập `next/headers`, mà thứ đó chỉ tồn tại ở server.
 * Một file duy nhất — kể cả khi phần server nằm sau `await import()` — vẫn bị
 * webpack kéo cả cụm vào gói của trình duyệt, và bản dựng gãy với "You're
 * importing a component that needs next/headers". Cùng cách chia mà
 * `api-client.ts` / `browser-api.ts` đã chia sẵn.
 */

import { request } from './browser-api';

import type { components } from './api-types';

export type SiteConfig = components['schemas']['SiteConfigOut'];
export type SiteConfigUpdate = components['schemas']['SiteConfigUpdate'];

/** Giá trị dùng khi API chưa trả lời được. Trống = giao diện dùng mặc định. */
export const EMPTY_SITE_CONFIG: SiteConfig = {
  title_i18n: {},
  favicon_media_id: null,
  favicon_url: null,
};

export const getSiteConfig = () => request<SiteConfig>('/site/config');

/**
 * `Partial<...>`: `clear_favicon` có giá trị mặc định ở server, nên bộ sinh kiểu
 * coi nó là "luôn có mặt trong phản hồi" và gắn luôn vào kiểu gửi lên. Phía gửi
 * thì được phép bỏ qua — đó chính là ý nghĩa của một giá trị mặc định.
 */
export const saveSiteConfig = (payload: Partial<SiteConfigUpdate>) =>
  request<SiteConfig>('/site/config', { method: 'PATCH', body: payload });

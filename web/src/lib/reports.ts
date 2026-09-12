'use client';

/**
 * Lớp gọi API báo cáo. Kiểu lấy từ `api-types.ts` (sinh từ OpenAPI).
 *
 * Chỉ có ĐỌC. Màn báo cáo không sửa gì cả — nó nhìn vào kết quả đã xảy ra, và
 * một cái nút sửa ở đây sẽ là cửa để đổi điểm của học sinh mà không để lại dấu.
 */

import { request } from './browser-api';

import type { components } from './api-types';

export type ReportOverview = components['schemas']['OverviewOut'];
export type ReportPlayerRow = components['schemas']['PlayerRow'];
export type ReportPlayerList = components['schemas']['PlayerListOut'];
export type ReportPlayerDetail = components['schemas']['PlayerDetailOut'];
export type ReportWorldOption = components['schemas']['WorldOption'];
export type ReportWorldResult = components['schemas']['WorldResult'];
export type ReportStageResult = components['schemas']['StageResult'];
export type ReportRunRow = components['schemas']['RunRow'];

/** `?world_id=...` chỉ xuất hiện khi CÓ lọc — `world_id=` rỗng là một giá trị khác. */
function truyVan(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const getReportWorlds = () => request<ReportWorldOption[]>('/reports/worlds');

export const getReportOverview = (worldId?: string | null) =>
  request<ReportOverview>(`/reports/overview${truyVan({ world_id: worldId })}`);

export const getReportPlayers = (opts: {
  worldId?: string | null;
  page?: number;
  size?: number;
  q?: string | null;
}) =>
  request<ReportPlayerList>(
    `/reports/players${truyVan({
      world_id: opts.worldId,
      page: opts.page,
      size: opts.size,
      q: opts.q,
    })}`,
  );

export const getReportPlayerDetail = (userId: string) =>
  request<ReportPlayerDetail>(`/reports/players/${userId}`);

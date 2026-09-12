'use client';

/**
 * Đọc số cho người, không cho máy.
 *
 * Gom về một chỗ vì cùng một con số xuất hiện ở ba nơi — thẻ tổng quan, bảng
 * xếp hạng, hộp thoại chi tiết — và ba cách viết khác nhau của cùng một giây
 * đồng hồ là thứ khiến người đọc phải dừng lại để đối chiếu.
 */

/** `294` -> `4 m 54 s`; `43269` -> `12 h 01 m`; `0`/`null` -> `—`. */
export function thoiLuong(giay: number | null | undefined): string {
  if (giay === null || giay === undefined) return '—';
  if (giay <= 0) return '—';
  if (giay < 60) return `${Math.round(giay)}s`;
  const phut = Math.floor(giay / 60);
  if (phut < 60) return `${phut}m ${String(Math.round(giay % 60)).padStart(2, '0')}s`;
  const gio = Math.floor(phut / 60);
  return `${gio}h ${String(phut % 60).padStart(2, '0')}m`;
}

/** `0.0724` -> `7%`. Không có dữ liệu thì `—`, KHÁC với `0%`. */
export function phanTram(ti: number | null | undefined, le = 0): string {
  if (ti === null || ti === undefined) return '—';
  return `${(ti * 100).toFixed(le)}%`;
}

/** Mốc thời gian đầy đủ, theo ngôn ngữ đang xem. */
export function lucNao(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Chỉ ngày, dùng cho nhãn biểu đồ. */
export function ngay(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
  });
}

/** Nhóm hàng nghìn. `1270` -> `1.270` (vi) / `1,270` (en). */
export function so(n: number | null | undefined, locale: string): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB');
}

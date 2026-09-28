'use client';

/** Tải ảnh/âm thanh lên kho media. */

import { request } from './browser-api';

import type { components } from './api-types';

export type MediaAsset = components['schemas']['MediaOut'];

/**
 * Tải một file lên.
 *
 * Gửi bằng `FormData` — KHÔNG tự đặt `Content-Type`, trình duyệt phải tự sinh
 * kèm `boundary`. Đặt tay là server không tách được các phần của multipart.
 */
export async function uploadMedia(file: File, folder?: string): Promise<MediaAsset> {
  const form = new FormData();
  form.append('file', file);
  if (folder) form.append('folder', folder);
  return request<MediaAsset>('/media', { method: 'POST', formData: form });
}

/** Đuôi file được phép. Phải khớp `ALLOWED` ở api/app/modules/media/service.py. */
export const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.svg';
export const AUDIO_ACCEPT = '.mp3,.ogg,.wav,.m4a';
export const VIDEO_ACCEPT = '.mp4,.webm';

/**
 * Ảnh nền: ảnh TĨNH hoặc VIDEO.
 *
 * Chỉ dùng cho ba chỗ người chơi đứng lại và nhìn — bản đồ thiên hà, phòng chờ
 * world, màn chơi. Ảnh bìa chương, khung tiêu đề, ảnh vật thể vẫn là
 * `IMAGE_ACCEPT`: một tấm bìa 120px đang chạy vòng lặp thì không ai xem, chỉ
 * tốn một bộ giải mã của máy học sinh.
 */
export const BACKGROUND_ACCEPT = `${IMAGE_ACCEPT},${VIDEO_ACCEPT}`;

/** Ảnh nền là ảnh hay video. Server trả xuống, giao diện KHÔNG đoán theo đuôi. */
export type BackgroundKind = 'image' | 'video';

/**
 * Đuôi của ảnh POSTER nằm cạnh mỗi video — PHẢI khớp `POSTER_SUFFIX` phía API
 * (`api/app/modules/media/video.py`). Server tách khung hình đầu ra lúc tải lên.
 */
const POSTER_SUFFIX = '.poster.jpg';

/**
 * URL ảnh poster của một video: khung hình đầu, hiện NGAY trong lúc video còn
 * tải — không còn khoảng đen khi vào phòng chờ hay màn chơi.
 *
 * Suy ra theo quy ước tên, không có cột riêng: mọi chỗ đang cầm URL video (kể
 * cả đề bài đã đóng băng) đều tự có poster. Video tải lên trước khi có tính năng
 * này thì chạy `scripts/optimize_videos.py` một lần; thiếu poster thì trình
 * duyệt chỉ bỏ qua, không vỡ gì.
 */
export function posterOf(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const sach = url.split('#')[0]!.split('?')[0]!;
  return `${sach}${POSTER_SUFFIX}`;
}

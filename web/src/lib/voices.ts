'use client';

/**
 * Lớp gọi API kho giọng đọc.
 *
 * Danh mục giọng là một BẢN SAO nằm ở server, không phải một cú gọi thẳng ra
 * ElevenLabs từ trình duyệt — khoá API không bao giờ rời khỏi server, và ô chọn
 * giọng không phụ thuộc vào việc máy học sinh có ra được internet nước ngoài
 * hay không.
 */

import { request } from './browser-api';

import type { components } from './api-types';

export type Voice = components['schemas']['VoiceOut'];
export type VoiceProvider = components['schemas']['VoiceProviderOut'];
export type VoiceSync = components['schemas']['VoiceSyncOut'];

export type VoiceGender = 'male' | 'female' | 'neutral';
export type VoiceAge = 'young' | 'middle_aged' | 'old';

/**
 * Ba bộ lọc, và không cái nào bắt buộc.
 *
 * Bỏ trống một cái = "mọi giá trị", chứ không phải "chưa chọn nên chưa tìm":
 * người dựng mở ô chọn ra là phải thấy giọng ngay, rồi mới thu hẹp dần.
 */
export const listVoices = (filter: {
  provider?: string;
  gender?: VoiceGender | null;
  age_group?: VoiceAge | null;
}) => {
  const query = new URLSearchParams();
  if (filter.provider) query.set('provider', filter.provider);
  if (filter.gender) query.set('gender', filter.gender);
  if (filter.age_group) query.set('age_group', filter.age_group);
  const suffix = query.toString();
  return request<Voice[]>(`/voices${suffix ? `?${suffix}` : ''}`);
};

export const listVoiceProviders = () => request<VoiceProvider[]>('/voices/providers');

/** Kéo danh mục về từ nhà cung cấp. Cập nhật dòng cũ, không xoá đi nạp lại. */
export const syncVoices = (provider: string) =>
  request<VoiceSync>('/voices/sync', { method: 'POST', body: { provider, language: 'en' } });

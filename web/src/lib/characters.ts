'use client';

/** Lớp gọi API nhân vật người chơi. */

import { request } from './browser-api';

import type { components } from './api-types';

export type Character = components['schemas']['CharacterOut'];
export type CharacterAction = components['schemas']['CharacterActionOut'];
export type CharacterActionPayload = components['schemas']['CharacterActionIn'];
export type CharacterUpdatePayload = components['schemas']['CharacterUpdate'];
export type CharacterCreatePayload = components['schemas']['CharacterCreate'];

/**
 * Tạo nhân vật: chỉ CÁI TÊN là bắt buộc.
 *
 * Cùng lý do với `WorldCreateInput`: trường có giá trị mặc định trong Pydantic
 * bị OpenAPI sinh thành bắt buộc ở phía TypeScript, và nhắc lại mặc định ở đây
 * là tạo bản sao thứ hai của một con số.
 */
export type CharacterCreateInput = Pick<CharacterCreatePayload, 'name_i18n'> &
  Partial<CharacterCreatePayload>;

/** Đặt spritesheet cho một hành động: `action_key` là bắt buộc, còn lại tuỳ. */
export type CharacterActionInput = Pick<CharacterActionPayload, 'action_key'> &
  Partial<CharacterActionPayload>;

export const listCharacters = () => request<Character[]>('/characters');

export const createCharacter = (payload: CharacterCreateInput) =>
  request<Character>('/characters', { method: 'POST', body: payload });

export const updateCharacter = (id: string, payload: CharacterUpdatePayload) =>
  request<Character>(`/characters/${id}`, { method: 'PATCH', body: payload });

export const deleteCharacter = (id: string) =>
  request<void>(`/characters/${id}`, { method: 'DELETE' });

/** Tạo HOẶC sửa — một đường duy nhất, xem ghi chú ở router. */
export const upsertAction = (characterId: string, payload: CharacterActionInput) =>
  request<Character>(`/characters/${characterId}/actions`, { method: 'PUT', body: payload });

export const deleteAction = (characterId: string, actionKey: string) =>
  request<Character>(`/characters/${characterId}/actions/${actionKey}`, { method: 'DELETE' });

// --- Nhân vật của một world --------------------------------------------------

export type CharacterIdsPayload = components['schemas']['CharacterIdsIn'];

export const listWorldCharacters = (worldId: string) =>
  request<Character[]>(`/worlds/${worldId}/characters`);

/** Thêm NHIỀU nhân vật một lần. Cái đã có thì server bỏ qua, không báo lỗi. */
export const addWorldCharacters = (worldId: string, payload: CharacterIdsPayload) =>
  request<Character[]>(`/worlds/${worldId}/characters`, { method: 'POST', body: payload });

/** Gỡ khỏi WORLD NÀY. Nhân vật vẫn còn trong kho và dùng được ở world khác. */
export const removeWorldCharacter = (worldId: string, characterId: string) =>
  request<Character[]>(`/worlds/${worldId}/characters/${characterId}`, { method: 'DELETE' });

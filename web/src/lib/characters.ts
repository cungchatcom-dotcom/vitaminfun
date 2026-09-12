'use client';

/** Lớp gọi API nhân vật người chơi. */

import { frameSize } from '@/game/character';

import { request } from './browser-api';

import type { components } from './api-types';
import type { DialogueActor } from './play';

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

/**
 * Danh sách nhân vật, lọc được theo vai.
 *
 * Không truyền `kind` = cả hai vai — màn quản lý cần thấy hết để đếm hai thẻ.
 * Bộ chọn người canh giữ ở trình thiết kế nhiệm vụ thì gọi kèm `'npc'`.
 */
export const listCharacters = (kind?: Character['kind']) =>
  request<Character[]>(kind ? `/characters?kind=${kind}` : '/characters');

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

// --- Đổi sang hình dạng màn hội thoại ---------------------------------------

/**
 * Một nhân vật của màn quản trị, đổi sang hình dạng màn hội thoại dùng.
 *
 * `DialogueActor` là thứ SERVER dựng cho lượt chơi (`actors_of`). Trình thiết
 * kế thì cầm `CharacterOut` — cùng dữ liệu, khác vỏ — nên đổi vỏ ở đây để khung
 * xem trước dùng lại đúng component màn chơi vẽ. Không đổi thì phải viết bản vẽ
 * thứ hai cho khung mặt, và hai bản sẽ lệch nhau đúng vào lúc không ai để ý.
 *
 * Hành động CHƯA CÓ ẢNH thì bỏ qua: `DialogueActor` hứa mỗi tư thế có một tấm
 * chạy được, và một tư thế rỗng lọt xuống dưới sẽ che mất nấc lùi về ảnh đại
 * diện — khung mặt hiện ra trống trơn thay vì hiện tấm ảnh đang có.
 */
export function dialogueActor(character: Character): DialogueActor {
  return {
    id: character.id,
    name_i18n: character.name_i18n,
    avatar_url: character.avatar_url,
    sprites: (character.actions ?? []).flatMap((action) => {
      const size = frameSize(action.sheet_width, action.sheet_height, action.frames);
      const width = action.frame_width ?? size.frame_width;
      const height = action.frame_height ?? size.frame_height;
      if (!action.media_url || !width || !height) return [];
      return [
        {
          action_key: action.action_key,
          url: action.media_url,
          frames: action.frames,
          frame_width: width,
          frame_height: height,
          frame_rate: action.frame_rate,
        },
      ];
    }),
  };
}

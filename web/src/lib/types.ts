/**
 * Kiểu dữ liệu của API.
 *
 * `api-types.ts` được SINH TỰ ĐỘNG từ OpenAPI của FastAPI:
 *
 *     pnpm gen:api-types      (cần API đang chạy)
 *
 * Không sửa tay `api-types.ts`. File này chỉ đặt tên ngắn cho vài kiểu hay dùng,
 * và nhờ vậy đổi schema ở backend là frontend gãy lúc `tsc` chứ không gãy lúc
 * người dùng bấm nút.
 */

import type { components } from './api-types';

export type UserSummary = components['schemas']['UserSummary'];
export type LoginResponse = components['schemas']['LoginResponse'];
export type PlayContext = components['schemas']['PlayContext'];

export type Role = UserSummary['role'];

// --- Duyệt nội dung phía người chơi (S0-S2) -------------------------------
export type PlayWorld = components['schemas']['PlayWorldOut'];
export type PlayGalaxy = components['schemas']['PlayGalaxyOut'];
export type PlayWorldDetail = components['schemas']['PlayWorldDetailOut'];
export type PlayChapter = components['schemas']['PlayChapterOut'];
export type PlayStage = components['schemas']['PlayStageOut'];

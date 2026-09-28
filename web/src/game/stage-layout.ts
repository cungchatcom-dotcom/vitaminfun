import { WORLD } from './world';

import type { Snapshot, SnapshotQuest } from '@/lib/play';

/**
 * BỐ CỤC DỌC CỦA MÀN CHƠI — khung vẽ và phép quy đổi toạ độ.
 *
 * Chỗ duy nhất biết bản dọc khác bản ngang ở đâu. Cảnh Phaser và React đều đi
 * qua đây, nên không có chỗ nào tự suy lấy một nửa luật.
 */

/**
 * Khung vẽ của màn chơi ở bố cục DỌC — 3200×1800 **hoán vị**, cùng cách đặt số
 * với bản đồ thiên hà và phòng chờ.
 */
export const STAGE_PORTRAIT = { width: WORLD.height, height: WORLD.width } as const;

export function stageCanvas(portrait: boolean): { width: number; height: number } {
  return portrait ? STAGE_PORTRAIT : WORLD;
}

// ------------------------------------------------------------------ HUD

/**
 * BA CỤM HUD của màn chơi, và không có cụm thứ tư.
 *
 *   - `info`  — tên màn, đồng hồ, số nhiệm vụ đã xong
 *   - `exits` — Chơi lại, Rời màn
 *   - `tools` — toàn màn hình, loa, sổ tay, năng lượng, trợ giúp
 */
export const HUD_KEYS = ['info', 'exits', 'tools'] as const;
export type HudKey = (typeof HUD_KEYS)[number];

/**
 * Chỗ đứng mặc định của ba cụm ở bố cục DỌC — hệ toạ độ 1800×3200.
 *
 * Bản ngang đóng đinh chúng vào ba góc (`top-3 left-3`, `top-3 right-3`,
 * `right-3 bottom-3`) và không có gì chen nhau: màn rộng 1780px thì cụm
 * trên-trái và trên-phải cách nhau cả nghìn pixel.
 *
 * Màn dọc chỉ rộng chừng 390px, và hai cụm ấy ĐÈ LÊN NHAU — đúng lỗi "hai nút
 * Chơi lại / Rời màn đè vào đồng hồ". Nên ở đây chúng XẾP THÀNH TẦNG, không
 * phải hai góc:
 *
 *   tầng trên  : `info` chạy hết bề ngang
 *   tầng kế    : `exits` ngay dưới, neo phải
 *   đáy        : `tools`, neo phải
 *
 * Tất cả nằm TRONG VÙNG AN TOÀN (9% mỗi mép = 162 ngang, 288 dọc): cảnh dọc
 * được phóng cho phủ kín màn và mép thừa bị cắt, nên một cái nút sát góc là
 * một cái nút rơi ra ngoài màn hình trên đúng những máy cao nhất.
 */
export const HUD_BLOCKS_PORTRAIT: Record<HudKey, { x: number; y: number; w: number; h: number }> = {
  info: { x: 900, y: 360, w: 1420, h: 120 },
  exits: { x: 1130, y: 530, w: 960, h: 120 },
  tools: { x: 1050, y: 2830, w: 1120, h: 130 },
};

/** Khung của một cụm HUD: số đã đặt, không thì chỗ mặc định. */
export function hudBox(key: HudKey, saved: Record<string, unknown> | undefined) {
  const spec = HUD_BLOCKS_PORTRAIT[key];
  const s = (saved ?? {}) as { x?: number; y?: number; w?: number; h?: number };
  return { x: s.x ?? spec.x, y: s.y ?? spec.y, w: s.w ?? spec.w, h: s.h ?? spec.h };
}

/**
 * Màn này CÓ bản dọc không — tức người dựng đã thiết kế chưa.
 *
 * Ảnh nền là dấu hiệu, và server đã quyết điều đó một lần khi đóng băng đề bài
 * (`_snapshot_portrait` trả `None` khi chưa có nền). Ở đây chỉ cần kiểm `null`.
 *
 * Ảnh chụp đề bài CŨ không có khoá `portrait` và cũng đọc ra `null` — đúng
 * nghĩa "màn này chưa có bản dọc", không cần vá dữ liệu cũ.
 */
export function coBanDoc(snapshot: Snapshot): boolean {
  return Boolean(snapshot.stage.portrait);
}

/**
 * TOẠ ĐỘ NHÂN VẬT: client luôn NÓI CHUYỆN VỚI SERVER BẰNG HỆ NGANG.
 *
 * `stage_run_players.pos_x/pos_y` là một cặp số trong hệ 3200×1800, và đã có
 * dữ liệu thật nằm đó. Thêm hệ thứ hai vào cùng hai cột ấy thì một lượt chơi
 * lưu lẫn lộn hai hệ, và không ai nhìn vào cặp số mà biết nó thuộc hệ nào.
 *
 * Nên bản dọc quy đổi ở HAI ĐẦU: đọc vị trí về thì đổi sang hệ dọc, gửi đi thì
 * đổi ngược lại. Bản ngang là phép đồng nhất — không một dòng nào của nó đổi.
 *
 * Quy đổi theo TỈ LỆ, và nó gần đúng chứ không chính xác: hai bố cục là hai bức
 * tranh khác nhau, cái ghế ở góc trái bản ngang không nằm ở đâu cả trên bản
 * dọc. Chấp nhận được vì đây chỉ là chỗ ĐỨNG — tiến độ thật (câu đã trả lời,
 * nhiệm vụ đã xong, năng lượng) nằm ở server và không dính gì tới toạ độ. Rơi
 * vào chỗ không đi được thì cảnh tự cứu về ô đi được gần nhất, đúng như khi
 * người dựng đặt một chỗ xuất phát nằm ngoài sàn.
 */
export function sangHeDoc(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round((x / WORLD.width) * STAGE_PORTRAIT.width),
    y: Math.round((y / WORLD.height) * STAGE_PORTRAIT.height),
  };
}

export function sangHeNgang(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round((x / STAGE_PORTRAIT.width) * WORLD.width),
    y: Math.round((y / STAGE_PORTRAIT.height) * WORLD.height),
  };
}

/**
 * Phần trình bày của màn, theo hướng đang vẽ — nền, sàn, chỗ xuất phát, cỡ
 * nhân vật, bố cục hội thoại.
 *
 * Một hàm CHỌN, không phải hai nhánh rải khắp nơi: chỗ gọi đọc ra một object và
 * không cần biết mình đang ở hướng nào.
 */
export function boCucMan(snapshot: Snapshot, portrait: boolean) {
  const st = snapshot.stage;
  if (!portrait || !st.portrait) {
    return {
      backgroundUrl: st.background_url ?? '',
      backgroundKind: st.background_kind ?? null,
      collision: st.collision,
      spawnX: st.spawn_x ?? null,
      spawnY: st.spawn_y ?? null,
      characterHeight: st.character_height,
      dialogue: st.dialogue,
      dialogueUrls: st.dialogue_urls,
      // Bản ngang không có cụm HUD đặt tay — chúng đóng đinh vào ba góc.
      hud: {} as Record<string, Record<string, unknown>>,
    };
  }
  const p = st.portrait;
  return {
    backgroundUrl: p.background_url ?? '',
    backgroundKind: p.background_kind ?? null,
    collision: p.collision ?? null,
    spawnX: p.spawn_x ?? null,
    spawnY: p.spawn_y ?? null,
    // Chiều cao nhân vật: bản dọc chưa đặt thì KHÔNG lùi về số của bản ngang —
    // nó là chiều cao trong một khung khác, và một nhân vật cao 200 trên khung
    // cao 1800 sẽ thành tí hon trên khung cao 3200. Để trống thì cảnh dùng mặc
    // định của chính nó.
    characterHeight: p.character_height ?? undefined,
    dialogue: p.dialogue ?? {},
    dialogueUrls: p.dialogue_urls ?? {},
    hud: (p.hud ?? {}) as Record<string, Record<string, unknown>>,
  };
}

/** Chỗ đứng và cỡ của một nhiệm vụ, theo hướng đang vẽ. */
export function boCucNhiemVu(quest: SnapshotQuest, portrait: boolean) {
  if (!portrait) {
    return {
      scene_x: quest.scene_x ?? null,
      scene_y: quest.scene_y ?? null,
      icon_size: quest.icon_size ?? null,
      trigger_radius: quest.trigger_radius ?? null,
    };
  }
  const p = quest.portrait;
  return {
    scene_x: p?.scene_x ?? null,
    scene_y: p?.scene_y ?? null,
    icon_size: p?.icon_size ?? null,
    trigger_radius: p?.trigger_radius ?? null,
  };
}

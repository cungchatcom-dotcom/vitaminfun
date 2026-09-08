/**
 * ÂM THANH của màn chơi: nhạc nền, tiếng đi, tiếng đứng.
 *
 * File này KHÔNG import Phaser, cùng lý do với `world.ts` và `collision.ts`:
 * trình thiết kế cần đúng những con số này để dựng ô nhập và nghe thử, nhưng nó
 * là DOM chứ không phải một cảnh game.
 *
 * ## Sổ đăng ký
 *
 * Thêm một khối nhạc mới = thêm **một dòng** trong `AUDIO_SLOTS`, cộng một khoá
 * chữ trong `messages/`. Không migration, không sửa trình thiết kế, không sửa
 * cảnh chơi — cả hai bên đều duyệt qua sổ này. Đó là toàn bộ lý do dữ liệu nằm
 * trong một cột JSONB thay vì bốn cột riêng cho mỗi loại tiếng.
 *
 * ## Mặc định là IM LẶNG
 *
 * Ô nào chưa tải file thì không phát gì cả, và cột `NULL` nghĩa là cả màn không
 * có tiếng nào. Đó là mặc định đúng: một màn chơi tự bật nhạc mà người dựng
 * không chủ động chọn là thứ cả lớp học phải chịu đựng cùng lúc.
 */

/** Một khối nhạc: `walk` và `idle` loại trừ nhau, `ambient` chạy song song. */
export type AudioSlot = 'ambient' | 'walk' | 'idle';

export interface AudioSlotSpec {
  /** Lặp lại khi hết, nếu người dựng chưa đặt riêng. */
  loop: boolean;
  /**
   * Âm lượng mặc định, PHẦN TRĂM.
   *
   * Nhạc nền nhỏ hơn hẳn tiếng bước chân, và đó là chủ ý: nó chạy suốt màn dưới
   * một bảng câu hỏi, còn tiếng bước chân chỉ kêu lúc người chơi vừa bấm đi và
   * đang cần biết là lệnh của mình có ăn không.
   */
  volume: number;
}

/**
 * SỔ ĐĂNG KÝ các khối nhạc của màn chơi.
 *
 * Thứ tự ở đây cũng là thứ tự hiện trên bảng của giáo viên.
 */
export const AUDIO_SLOTS: Record<AudioSlot, AudioSlotSpec> = {
  // Nhạc nền: gần như luôn cần lặp — hết bài mà im bặt giữa màn thì người chơi
  // tưởng mất tiếng.
  ambient: { loop: true, volume: 45 },
  // Tiếng bước chân: lặp, vì nó kêu suốt quãng đường đi chứ không phải một
  // tiếng "bụp" lúc khởi hành.
  walk: { loop: true, volume: 70 },
  // Tiếng lúc đứng: cũng lặp. Người dựng nào muốn một tiếng thở dài duy nhất
  // thì tắt lặp — nút có sẵn.
  idle: { loop: true, volume: 55 },
};

export const AUDIO_SLOT_KEYS = Object.keys(AUDIO_SLOTS) as AudioSlot[];

/** Màn hình có nhạc. Mỗi màn dùng một tập khối khác nhau. */
export type AudioSurface = 'stage' | 'galaxy' | 'lobby';

/**
 * Màn nào dùng những khối nào.
 *
 * Bản đồ thiên hà và phòng chờ world chỉ có nhạc nền — ở đó không có nhân vật
 * nào đi lại, nên `walk`/`idle` không có nghĩa gì. Tách bằng bảng này thay vì
 * ba sổ đăng ký riêng: mặc định của `ambient` phải GIỐNG NHAU ở cả ba màn, mà
 * chép nó ra ba chỗ là ba chỗ để lệch.
 */
export const AUDIO_SURFACE_SLOTS: Record<AudioSurface, readonly AudioSlot[]> = {
  stage: ['ambient', 'walk', 'idle'],
  galaxy: ['ambient'],
  lobby: ['ambient'],
};

/**
 * Khoảng chỉnh được. GIỐNG HỆT `CHECK` bên Pydantic — lệch một con số là cú kéo
 * thanh trượt kết thúc bằng lỗi 422 mà người dựng không hiểu vì sao.
 *
 * Tốc độ chặn dưới ở 50%: chậm hơn nữa thì mọi bản nhạc đều thành tiếng rên, và
 * người nghe tưởng file hỏng chứ không tưởng là cài đặt.
 */
export const AUDIO_RANGE = {
  volumeMin: 0,
  volumeMax: 100,
  rateMin: 50,
  rateMax: 200,
} as const;

/** Một khối nhạc như nó được lưu trong `stages.audio_json`. */
export interface AudioTrack {
  media_id?: string | null;
  /** Âm lượng, PHẦN TRĂM. `0` là "câm hẳn", khác `null` là "chưa đặt". */
  volume?: number | null;
  /** Tốc độ phát, PHẦN TRĂM. 100 = nguyên bản. */
  rate?: number | null;
  loop?: boolean | null;
  /**
   * Lấy TIẾNG CỦA VIDEO NỀN làm nhạc nền, thay cho `media_id`.
   *
   * Chỉ có nghĩa ở khối `ambient`. Đừng đọc thẳng trường này — hỏi
   * `ambientFromVideo()`, nơi giữ luật đầy đủ.
   */
  from_video?: boolean | null;
}

/** Cả bộ nhạc của một màn. Khoá thiếu = khối đó chưa có gì. */
export type AudioMap = Partial<Record<AudioSlot, AudioTrack>>;

/** Thông số đưa thẳng cho trình phát. */
export interface AudioSpec {
  /** 0..1 — thang của cả `<audio>` lẫn Phaser. */
  volume: number;
  /** 1 = nguyên bản. */
  rate: number;
  loop: boolean;
}

/**
 * Âm lượng của tiếng MÀN CHƠI khi bảng câu hỏi có tiếng đang mở — nhân với
 * âm lượng bình thường, không thay thế nó.
 *
 * `0.2` = hạ 80%. Không hạ hẳn về 0: cắt phăng nhạc nền mỗi lần mở một câu hỏi
 * nghe thì cái im lặng đột ngột còn dễ nhận ra hơn cả bản nhạc, và học sinh
 * tưởng game vừa đứng. Để lại một chút thì màn chơi vẫn còn đó, chỉ lùi ra sau.
 *
 * Một hằng số ở đây, cạnh các con số tiếng khác, vì nó là một quyết định về
 * bản phối chứ không phải luật chơi — `balance_json` là chỗ của luật chơi.
 */
export const DUCK_VOLUME = 0.2;

/**
 * Quy đổi con số của giáo viên thành thông số phát.
 *
 * MỘT hàm dùng chung cho cả hai nơi phát — nút nghe thử trong trình thiết kế và
 * cảnh chơi. Mỗi bên tự quy đổi thì sớm muộn cũng lệch, và giáo viên chỉnh xong
 * nghe thử thấy vừa, vào chơi thấy khác.
 */
export function resolveAudio(slot: AudioSlot, saved: AudioTrack | undefined): AudioSpec {
  const spec = AUDIO_SLOTS[slot];
  return {
    volume: clamp(saved?.volume ?? spec.volume, AUDIO_RANGE.volumeMin, AUDIO_RANGE.volumeMax) / 100,
    rate: clamp(saved?.rate ?? 100, AUDIO_RANGE.rateMin, AUDIO_RANGE.rateMax) / 100,
    loop: saved?.loop ?? spec.loop,
  };
}

/**
 * Đọc bộ nhạc từ server, gạn bỏ khoá không có trong sổ đăng ký.
 *
 * Cột là JSONB tự do và đề bài đóng băng lưu lại nguyên văn cái đã lưu từ
 * trước, nên một khối của phiên bản cũ — hoặc một khối đã bị gỡ khỏi sổ — vẫn
 * có thể chui tới đây. Gạn ở MỘT chỗ, ngay cửa vào.
 */
export function readAudio(raw: unknown, surface: AudioSurface = 'stage'): AudioMap {
  if (!raw || typeof raw !== 'object') return {};
  const source = raw as Record<string, unknown>;
  const out: AudioMap = {};
  for (const slot of AUDIO_SURFACE_SLOTS[surface]) {
    const track = source[slot];
    if (track && typeof track === 'object') out[slot] = track as AudioTrack;
  }
  return out;
}

/**
 * Nhạc nền có đang lấy từ TIẾNG CỦA VIDEO NỀN không.
 *
 * Hai vế, và phải đủ cả hai. Cái cờ của giáo viên là một Ý ĐỊNH; ảnh nền có
 * thật sự là video hay không là một SỰ THẬT. Cờ bật mà nền đang là ảnh tĩnh thì
 * chẳng có tiếng nào để lấy, và lúc đó bản nhạc đã tải lên phát như thường —
 * không phải im lặng vì một cái cờ mồ côi.
 *
 * MỘT hàm cho cả bốn nơi phải trả lời câu này (bản đồ thiên hà, phòng chờ, cảnh
 * Phaser, bảng của giáo viên). Mỗi nơi tự viết `track.from_video && kind ===
 * 'video'` là bốn chỗ để quên mất vế thứ hai.
 */
export function ambientFromVideo(
  audio: AudioMap,
  backgroundKind: string | null | undefined,
): boolean {
  return Boolean(audio.ambient?.from_video) && backgroundKind === 'video';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

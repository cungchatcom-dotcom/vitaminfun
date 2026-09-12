/**
 * Nhân vật người chơi: spritesheet và cách phát nó.
 *
 * File này KHÔNG import Phaser — màn quản trị cần đúng những con số này để xem
 * trước, nhưng không cần engine.
 */

/**
 * Tên hành động gợi ý.
 *
 * Chỉ là GỢI Ý, không phải danh sách đóng: `action_key` là chuỗi tự do, và thêm
 * một hành động mới là việc của người dựng nội dung, không phải của một
 * migration. Nhưng để mỗi nhân vật một bộ tên riêng thì cảnh chơi không biết
 * gọi hành động nào — nên đây là bộ tên chuẩn để mọi người cùng dùng.
 */
export const ACTION_SUGGESTIONS = ['idle', 'walk', 'run', 'jump', 'talk', 'win', 'lose'] as const;

/** Hành động mặc định khi cảnh chơi chưa yêu cầu gì. */
export const DEFAULT_ACTION = 'idle';

/**
 * TƯ THẾ TRONG MÀN HỘI THOẠI — bảy hành động, hai vai.
 *
 * Vẫn là `action_key` như mọi hành động khác, nên không cần cột mới, không cần
 * migration, và dùng lại nguyên ô tải spritesheet của màn quản lý nhân vật.
 * Chỉ là một bộ tên chuẩn nữa, giống hệt `ACTION_SUGGESTIONS`.
 *
 * Tách theo VAI vì trình soạn chỉ nên gợi ý những tư thế hợp với vai đang sửa:
 * một người canh giữ không cần tư thế "suy nghĩ", và nhân vật học sinh không
 * cần tư thế "đang hỏi".
 */
export const DIALOGUE_POSES = {
  /** Người canh giữ: đang nói, và đang chờ học sinh trả lời. */
  npc: ['say', 'wait'] as const,
  /**
   * Nhân vật học sinh, theo đúng thứ tự một vòng hỏi–đáp:
   * nghe đề → nghĩ → trả lời → nghe khen hoặc nghe chê.
   */
  player: ['listen', 'think', 'answer', 'right', 'wrong'] as const,
} as const;

export type DialogueRole = keyof typeof DIALOGUE_POSES;
export type DialoguePose =
  | (typeof DIALOGUE_POSES)['npc'][number]
  | (typeof DIALOGUE_POSES)['player'][number];

/**
 * Tư thế lùi về khi chưa ai tải spritesheet cho tư thế đang cần.
 *
 * Hai nấc, dừng ở nấc đầu tiên có ảnh:
 *
 *   1. tư thế đang cần,
 *   2. tư thế NGHỈ của vai đó (`wait` / `listen`),
 *
 * rồi mới tới `characters.avatar_media_id` — một tấm tĩnh, nhưng còn hơn một
 * khung trống. Người dựng tải đúng MỘT tấm cũng đã có hội thoại chạy được, và
 * tải thêm tấm nào thì tấm đó tự nhận việc.
 */
export const DIALOGUE_REST: Record<DialogueRole, DialoguePose> = {
  npc: 'wait',
  player: 'listen',
};

/**
 * TRẠNG THÁI cuộc hội thoại tại một thời điểm — bốn điều đang đúng.
 *
 * Không phải một enum "khoảnh khắc": hai bên có hai trục ĐỘC LẬP. Người canh
 * giữ đang đọc hay đang chờ không phụ thuộc vào việc học sinh đã chọn gì; ép
 * chúng thành một danh sách cặp có sẵn thì sẽ đẻ ra những cặp không bao giờ
 * xảy ra — và đó đúng là chỗ trình thiết kế từng nói dối: nó vẽ người canh giữ
 * `say` lúc lời khen đã hiện, trong khi màn chơi lúc đó vẽ `wait`.
 */
export interface DialogueState {
  /** Người canh giữ đang đọc một câu — ba chấm đang chạy. */
  speaking: boolean;
  /** Học sinh vừa bấm Trả lời, đang chờ chấm. */
  submitting: boolean;
  /** Lời phán ĐÃ hiện thành chữ. `null` = chưa phán gì. */
  verdict: 'praise' | 'wrong' | null;
  /** Học sinh đã chọn hoặc gõ được gì đó chưa. */
  drafted: boolean;
}

/**
 * TƯ THẾ của hai bên, suy từ trạng thái hội thoại.
 *
 * Một hàm, hai chỗ gọi: màn chơi (`quest-panel.tsx`) và khung xem trước của
 * trình thiết kế. Trước đây mỗi bên tự suy lấy, và hai bản đã lệch nhau ở đúng
 * chỗ khó thấy nhất — người dựng căn xong một cảnh không có thật.
 *
 * Người canh giữ chỉ `say` lúc ĐANG ĐỌC. Lời phán hiện thành chữ rồi thì họ
 * `wait` — đọc xong là chờ, đó là trạng thái mặc định của một người vừa hỏi.
 *
 * Học sinh đi đúng một vòng: chưa chọn gì thì `listen`, chọn rồi thì `think`,
 * đang nộp thì `answer`, rồi `right` hoặc `wrong` theo lời phán.
 */
export function dialoguePoses(state: DialogueState): {
  npc: DialoguePose;
  player: DialoguePose;
} {
  return {
    npc: state.speaking ? 'say' : 'wait',
    player: state.submitting
      ? 'answer'
      : state.verdict === 'praise'
        ? 'right'
        : state.verdict === 'wrong'
          ? 'wrong'
          : state.drafted
            ? 'think'
            : 'listen',
  };
}

/**
 * Chỗ đặt CHÂN nhân vật so với ĐIỂM VA CHẠM, theo hệ toạ độ thế giới.
 *
 * Điểm va chạm — thứ `canWalk()` xét — nằm CAO HƠN gót chân chừng này. Trong
 * cảnh chơi, nó là gốc của container, còn tấm sprite vẽ ở `y = +22` với gốc
 * giữa-dưới; nên mép dưới tấm ảnh thấp hơn điểm va chạm đúng 22 đơn vị.
 *
 * Con số này ra khỏi `StageScene` vì **trình thiết kế cũng phải biết nó**. Người
 * dựng ướm nhân vật lên vùng vừa vẽ mà đo bằng TÂM tấm ảnh thì lệch gần một nửa
 * chiều cao nhân vật — vẽ tường thấy đúng, vào chơi thấy sai, và không có gì
 * trên màn hình giải thích tại sao.
 */
export const HERO_FOOT_Y = 22;

/**
 * Tốc độ đi của nhân vật, đơn vị thế giới mỗi giây.
 *
 * Dùng chung với chế độ ĐI THỬ của trình thiết kế, và đó là cả lý do nó nằm ở
 * đây. Người dựng thử lách qua một khe hẹp bằng một tốc độ khác tốc độ thật thì
 * cái họ vừa kiểm không phải là cái học sinh sẽ gặp.
 */
export const HERO_SPEED = 280;

/**
 * Bề rộng và chiều cao MỘT khung, suy từ khổ cả tấm.
 *
 * Tấm dải ngang `n` khung thì mỗi khung rộng `ảnh ÷ n`, cao bằng cả ảnh.
 *
 * Suy LẠI mỗi lần số khung đổi, không đông cứng lúc tải lên: ai tải ảnh lên khi
 * ô "Số khung" còn là 1 thì bề rộng khung bằng cả tấm — với một tấm 5128px thì
 * con số đó vượt trần và server từ chối bằng một câu chẳng chỉ ra chỗ nào sai.
 *
 * Ở đây chứ không ở màn quản lý nhân vật, vì cùng phép tính này còn cần cho
 * việc dựng tư thế hội thoại ra xem trước. Server có bản Python của riêng nó
 * (`actors_of`) — hai ngôn ngữ thì không tránh được, nhưng trong một ngôn ngữ
 * thì một bản là đủ.
 */
export function frameSize(
  sheetW: number | null | undefined,
  sheetH: number | null | undefined,
  frames: number,
): { frame_width?: number; frame_height?: number } {
  if (!sheetW || !sheetH || frames < 1) return {};
  return { frame_width: Math.round(sheetW / frames), frame_height: sheetH };
}

export interface SpriteSheet {
  media_url?: string | null;
  frames: number;
  frame_width?: number | null;
  frame_height?: number | null;
  frame_rate: number;
}

/**
 * Thông số vẽ MỘT spritesheet bằng CSS, để xem trước không cần Phaser.
 *
 * Nguyên lý giống hệt thứ Phaser làm: một tấm ảnh dài chứa `frames` khung xếp
 * ngang, và mỗi khung hình là dịch nền sang đúng một khung. `steps(n)` của CSS
 * làm việc dịch giật từng nấc đó; `linear` sẽ trượt mượt qua giữa hai khung và
 * cho ra một con mờ nhoè.
 *
 * `background-size` đặt theo BỀ RỘNG TỔNG: khung rộng `w` × `frames` khung.
 */
export function spriteFrame(
  sheet: SpriteSheet,
  /**
   * Trần kích thước hiển thị, pixel. Khung THẬT có thể rất to — một tấm dải
   * 8 khung của ảnh 5128px thì mỗi khung rộng 641px, tràn khỏi thẻ ngay. Thu
   * nhỏ bằng `transform: scale()` chứ không đổi `width`: đổi `width` là phải
   * đổi luôn `background-size` và mọi con số bên trong, còn `scale` thu cả cụm
   * đúng tỉ lệ mà phép tính khung không suy suyển.
   */
  fit?: { w: number; h: number },
): { style: React.CSSProperties; wrapperStyle: React.CSSProperties } {
  const width = sheet.frame_width ?? 64;
  const height = sheet.frame_height ?? 64;
  const frames = Math.max(1, sheet.frames);

  const zoom = fit ? Math.min(1, fit.w / width, fit.h / height) : 1;

  return {
    wrapperStyle: { width: width * zoom, height: height * zoom, overflow: 'hidden' },
    style: {
      width,
      height,
      transform: zoom < 1 ? `scale(${zoom})` : undefined,
      transformOrigin: 'top left',
      backgroundImage: sheet.media_url ? `url(${sheet.media_url})` : undefined,
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${width * frames}px ${height}px`,
      // Ảnh pixel-art phóng to phải giữ nét vuông; làm mịn là hỏng cả phong cách.
      imageRendering: 'pixelated',
      // Một khung thì không có gì để chạy — và một `animation` với `steps(1)`
      // chỉ tốn một luồng hoạt hình cho một hình đứng yên.
      ...(frames > 1 && {
        animationName: 'sprite-play',
        animationDuration: `${frames / sheet.frame_rate}s`,
        // `steps(n)` cho ra đúng n vị trí rời rạc: 0, −w, …, −(n−1)w. Vì vậy
        // quãng dịch là n × w chứ không phải (n−1) × w.
        animationTimingFunction: `steps(${frames})`,
        animationIterationCount: 'infinite',
        '--sprite-travel': `${-frames * width}px`,
      }),
      // Ép kiểu vì `CSSProperties` không biết tới biến CSS tự đặt.
    } as React.CSSProperties,
  };
}

/**
 * MÀN HỘI THOẠI VỚI NGƯỜI CANH GIỮ — bố cục năm khối.
 *
 * Bản mô tả CHÍNH của hình dạng `stages.dialogue_json`. Trình thiết kế của giáo
 * viên và màn chơi của học sinh cùng đọc file này, nên căn ở đâu thì hiện ra
 * đúng ở đó — cùng nếp với `collision.ts` và với các khối phòng chờ.
 *
 * Dùng lại `LobbySaved` chứ không định nghĩa hình dạng thứ hai: khối phòng chờ
 * và khối hội thoại là **cùng một thứ** — một hình chữ nhật kéo thả được, có
 * ảnh nền, và bên trong có một khung chữ. Hai khai báo cho cùng một thứ là hai
 * chỗ để lệch nhau khi thêm thuộc tính.
 *
 * Xem `docs/UI_META_SCREENS.md` §S5b và `docs/GAME_DOMAIN.md` §3f.
 */

import type { DialogueState } from './character';

import { lobbyContentBox, type LobbySaved } from './world';

/**
 * Hệ toạ độ của màn hội thoại: 1000×700.
 *
 * Một hệ RIÊNG, không dùng chung 3200×1800 của cảnh chơi. Cảnh chơi là một tấm
 * bản đồ người ta đi lại trên đó; màn hội thoại là một tấm bảng phủ lên màn
 * hình. Trộn hai hệ vào nhau thì một khối hội thoại rộng 460 nghe như "gần một
 * phần bảy bản đồ", mà thật ra nó là gần nửa bề ngang tấm bảng.
 *
 * Khung thật co giãn theo cửa sổ; hệ này chỉ là tỉ lệ, đúng như 3200×1800.
 */
export const DIALOGUE = { width: 1000, height: 700 } as const;

/**
 * Sáu khối, và không có khối thứ bảy.
 *
 * Mỗi khối trả lời đúng một câu hỏi trên màn hình:
 *
 *   - `npcAvatar`    — người canh giữ là AI
 *   - `npcBubble`    — họ HỎI gì
 *   - `playerBubble` — học sinh vừa TRẢ LỜI gì
 *   - `npcVerdict`   — họ nói bài đó đúng hay sai
 *   - `playerAvatar` — và học sinh là ai
 *   - `answerBox`    — chỗ để trả lời câu tiếp theo
 *
 * Người canh giữ có TỐI ĐA hai bong bóng, học sinh có một.
 *
 * ## Vì sao lời phán là khối RIÊNG, không dùng lại `npcBubble`
 *
 * Chen lời phán vào chỗ câu hỏi thì đúng lúc học sinh cần đối chiếu nhất — vừa
 * trả lời xong, nghe nói mình sai, còn một lượt nữa — thì đề bài biến mất khỏi
 * màn hình. Họ phải nhớ lại đề bằng trí nhớ để thử lần hai. Hai bong bóng thì
 * đề bài, bài mình vừa làm, và lời phán cùng nằm đó.
 *
 * Và chỉ NPC nói lời phán — không có thông báo hệ thống nào. Người canh giữ là
 * một nhân vật; một dòng "✗ Sai rồi" in bằng giọng máy giữa cuộc trò chuyện thì
 * cắt đứt đúng cái mà cả màn này dựng lên để tạo ra.
 *
 * Thứ tự khai báo là thứ tự xếp lớp và thứ tự trong danh sách khối của trình
 * thiết kế — khối vẽ sau nằm trên, nên `answerBox` ở cuối.
 */
export const DIALOGUE_BLOCKS = {
  // Hai người đứng ở HAI MÉP, cao và hẹp: khối chứa một nhân vật đứng, không
  // phải một tấm chân dung tròn. Đứng trên mép dưới của khối (`Actor` căn theo
  // chân), nên chiều cao khối chính là chiều cao nhân vật.
  npcAvatar: { x: 110, y: 330, width: 190, height: 220, round: false, ink: '#1c2b3a' },
  npcBubble: { x: 530, y: 110, width: 640, height: 150, round: false, ink: '#1c2b3a' },
  playerBubble: { x: 610, y: 250, width: 360, height: 92, round: false, ink: '#f8fafc' },
  // NGAY DƯỚI bong bóng của học sinh, nhưng lệch về phía người canh giữ: mắt
  // đi từ đề bài (trên) xuống bài mình làm (phải) rồi tới lời phán (dưới,
  // trái) — đúng thứ tự ba việc vừa xảy ra.
  npcVerdict: { x: 420, y: 352, width: 400, height: 92, round: false, ink: '#1c2b3a' },
  playerAvatar: { x: 890, y: 330, width: 190, height: 220, round: false, ink: '#f8fafc' },
  // Hẹp hơn cả tấm bảng, chừa hai mép cho hai nhân vật đứng: khung trả lời kéo
  // hết bề ngang thì nó chèn lên chân họ, và tấm bảng thành một cái biểu mẫu
  // có hai cái ảnh dán bên cạnh.
  answerBox: { x: 500, y: 572, width: 780, height: 236, round: false, ink: '#f1f5f9' },
} as const;

export type DialogueBlockKey = keyof typeof DIALOGUE_BLOCKS;

/**
 * Khối CÓ CHỮ, tức có khung nội dung kéo thả được.
 *
 * Ba cái bong bóng. Hai khung mặt chỉ có một tấm ảnh — vẽ thêm một khung chữ
 * bên trong là dựng ra một cái hộp không gì đọc nó; còn `answerBox` thì bên
 * trong là cả một khung câu hỏi tương tác tự dàn lấy, không phải một dòng chữ
 * để căn.
 */
export const DIALOGUE_TEXT_KEYS = ['npcBubble', 'playerBubble', 'npcVerdict'] as const;

export function hasDialogueContent(key: DialogueBlockKey): boolean {
  return (DIALOGUE_TEXT_KEYS as readonly string[]).includes(key);
}

export const DIALOGUE_BLOCK_KEYS = Object.keys(DIALOGUE_BLOCKS) as DialogueBlockKey[];

/**
 * ẢNH NỀN của cả tấm bảng hội thoại — TUỲ CHỌN.
 *
 * Không có thì tấm bảng trong suốt và cảnh chơi thật hiện xuyên qua, đúng như
 * xưa nay. Có thì nó phủ lên cảnh: người dựng muốn cuộc trò chuyện diễn ra
 * trong một khung cảnh riêng — một gian phòng, một tấm rèm — chứ không phải
 * ngay giữa chỗ học sinh vừa đứng.
 *
 * Nằm TRONG `dialogue_json` chứ không phải một cột riêng, dưới một khoá không
 * trùng tên khối nào. Ba cái được ngay mà không phải viết thêm dòng nào:
 * nó thừa kế theo màn đầu world như cả bố cục, `block_urls()` tra URL cho nó
 * như tra cho mọi khối, và đề bài đóng băng nó như đóng băng mọi thứ khác.
 */
export const DIALOGUE_BACKGROUND = 'background';

/** Khoá của KHOẢNG NGHỈ giữa hai lượt nói, trong cùng `dialogue_json`. */
export const DIALOGUE_GAP_KEY = 'gapMs';

/** Khoá của BỘ ÁO tấm bảng, trong cùng `dialogue_json`. */
export const DIALOGUE_THEME_KEY = 'theme';

/** Cả bộ như nó nằm trong `stages.dialogue_json`. Thiếu khoá = dùng mặc định. */
export type DialogueSaved = Partial<Record<DialogueBlockKey, LobbySaved>> & {
  /** Ảnh nền cả bảng. Vắng mặt = trong suốt. Xem `DIALOGUE_BACKGROUND`. */
  background?: LobbySaved | null;
  /** Nghỉ bao lâu giữa hai lượt nói, mili giây. Vắng mặt = `DIALOGUE_GAP.default`. */
  gapMs?: number | null;
  /**
   * BỘ ÁO của tấm bảng — xem `dialogue-theme.ts`. Vắng mặt = `classic`.
   *
   * Ở đây chứ không ở một cột riêng, cùng lý lẽ với ảnh nền và nhịp nghỉ: nó
   * thừa kế theo màn đầu world như cả bố cục, và đề bài đóng băng nó như đóng
   * băng mọi thứ khác — giáo viên đổi theme giữa chừng thì lượt đang chơi vẫn
   * mặc đúng bộ áo nó bắt đầu.
   */
  theme?: string | null;
};

/**
 * Khung đang có hiệu lực của một khối: giá trị đã đặt, không thì mặc định.
 *
 * `x`/`y` là TÂM khối, cùng quy ước với khối phòng chờ và với vật thể nhiệm vụ.
 * Tâm chứ không phải góc trên trái: người dựng kéo một cái bong bóng thì họ kéo
 * *cả cái bong bóng*, và đổi cỡ nó phải nở đều quanh chỗ đang đứng chứ không
 * trôi sang phải.
 */
export function dialogueBox(key: DialogueBlockKey, saved: LobbySaved | undefined) {
  const spec = DIALOGUE_BLOCKS[key];
  return {
    x: saved?.x ?? spec.x,
    y: saved?.y ?? spec.y,
    width: saved?.w ?? spec.width,
    height: saved?.h ?? spec.height,
  };
}

/**
 * Khung nội dung bên trong một khối.
 *
 * Vị trí và cỡ đi qua `lobbyContentBox` — luật "toạ độ tính bằng phần trăm của
 * khối, mặc định kín khối chừa 4%" chỉ được viết ở một chỗ.
 *
 * MÀU CHỮ thì KHÔNG dùng chung mặc định. Khối phòng chờ mặc định chữ TRẮNG, vì
 * chúng nằm trên ảnh nền người dựng tải lên và không đoán trước được sáng tối.
 * Bong bóng hội thoại thì biết trước: giấy sáng cần mực đậm, bong bóng xanh của
 * học sinh cần chữ sáng. Lấy mặc định trắng cho cả hai là chữ trên giấy **biến
 * mất hoàn toàn** — đã gặp thật ngay lần chạy đầu.
 *
 * Người dựng đặt màu riêng thì màu đó thắng, không có gì đổi.
 */
export function dialogueContent(
  key: DialogueBlockKey,
  saved: LobbySaved['content'] | null | undefined,
) {
  const box = lobbyContentBox(saved);
  return { ...box, color: saved?.color ?? DIALOGUE_BLOCKS[key].ink };
}

/**
 * Đọc bố cục từ server, gạn bỏ khoá lạ.
 *
 * Cột là JSONB tự do và đề bài đóng băng giữ lại nguyên văn cái đã lưu, nên một
 * khối của phiên bản cũ — hoặc một khối đã bị gỡ khỏi sổ đăng ký — vẫn có thể
 * chui tới đây. Gạn ở MỘT chỗ, ngay cửa vào, đúng nếp `readAudio()`.
 */
export function readDialogue(raw: unknown): DialogueSaved {
  if (!raw || typeof raw !== 'object') return {};
  const source = raw as Record<string, unknown>;
  const out: DialogueSaved = {};
  for (const key of DIALOGUE_BLOCK_KEYS) {
    const block = source[key];
    if (block && typeof block === 'object') out[key] = block as LobbySaved;
  }
  // Ảnh nền không phải một khối — không kéo thả, không có khung chữ — nhưng nó
  // sống cùng chỗ với các khối, nên phải gạn qua cùng một cửa.
  const bg = source[DIALOGUE_BACKGROUND];
  if (bg && typeof bg === 'object') out.background = bg as LobbySaved;

  // Nhịp cũng không phải một khối, cũng sống cùng chỗ, cũng phải qua cửa này.
  const gap = source[DIALOGUE_GAP_KEY];
  if (typeof gap === 'number' && Number.isFinite(gap)) out.gapMs = gap;

  // Bộ áo cũng vậy. Gạn kiểu ở đây để một giá trị lạ trong database không lọt
  // xuống tận chỗ vẽ rồi mới hỏng.
  const theme = source[DIALOGUE_THEME_KEY];
  if (typeof theme === 'string' && theme) out.theme = theme;
  return out;
}

/**
 * KHOẢNG NGHỈ giữa hai lượt nói — chặn hai đầu, mili giây.
 *
 * Trần 5 giây: quá đó thì cuộc trò chuyện không còn là chậm rãi mà là đứng hình,
 * và người dựng gõ nhầm một số không sẽ không hiểu vì sao màn chơi treo.
 *
 * Sàn 0: có người dựng muốn lời khen và câu hỏi tiếp theo nối liền nhau, và đó
 * là một lựa chọn hợp lệ — chỉ là không phải mặc định.
 */
export const DIALOGUE_GAP = { default: 1000, min: 0, max: 5000 } as const;

/** Nhịp nghỉ đang có hiệu lực của một màn. Gõ bậy thì kẹp về trong khoảng. */
export function gapMs(saved: DialogueSaved): number {
  const raw = saved.gapMs;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return DIALOGUE_GAP.default;
  return Math.min(DIALOGUE_GAP.max, Math.max(DIALOGUE_GAP.min, Math.round(raw)));
}

/**
 * NĂM KHOẢNH KHẮC của một vòng hỏi–đáp, để xem trước.
 *
 * Trình thiết kế cần một cách nhìn thấy cả bảy tư thế mà không phải ngồi chơi
 * thật. Nhưng hai ô chọn tư thế rời — một cho người canh giữ, một cho học sinh
 * — thì ghép ra được những cặp không bao giờ xảy ra, và người dựng sẽ ngồi căn
 * cho một cảnh không có thật.
 *
 * Nên mỗi khoảnh khắc ở đây là một `DialogueState` — đúng bốn biến mà màn chơi
 * cầm trong tay — và tư thế thì để `dialoguePoses()` suy ra, cùng một hàm màn
 * chơi gọi. Không còn bảng cặp tư thế chép tay để mà lệch.
 *
 * Năm chứ không bốn: thiếu `answer` thì tư thế "đang đưa ra câu trả lời" không
 * có cách nào xem trước, và người dựng tải một tấm ảnh lên rồi không bao giờ
 * nhìn thấy nó cho tới lúc chơi thật.
 */
export const DIALOGUE_MOMENTS = {
  /** Người canh giữ đang đọc — ba chấm chạy, học sinh chưa động vào gì. */
  ask: { speaking: true, submitting: false, verdict: null, drafted: false },
  /** Học sinh đã chọn, đang cân nhắc. */
  think: { speaking: false, submitting: false, verdict: null, drafted: true },
  /** Vừa bấm Trả lời, đang chờ server chấm. */
  answer: { speaking: false, submitting: true, verdict: null, drafted: true },
  /** Lời khen đã hiện thành chữ. */
  right: { speaking: false, submitting: false, verdict: 'praise', drafted: true },
  /** Lời chê đã hiện thành chữ. */
  wrong: { speaking: false, submitting: false, verdict: 'wrong', drafted: true },
} as const satisfies Record<string, DialogueState>;

export type DialogueMoment = keyof typeof DIALOGUE_MOMENTS;

export const DIALOGUE_MOMENT_KEYS = Object.keys(DIALOGUE_MOMENTS) as DialogueMoment[];

/**
 * NHỊP của cuộc trò chuyện, mili giây. Một chỗ, để còn chỉnh được.
 *
 * Rải mấy con số này vào giữa `quest-panel.tsx` thì muốn cho bong bóng ở lại
 * lâu hơn một chút là phải đi tìm chúng trong bốn trăm dòng — mà đây đúng là
 * loại con số người dựng nội dung sẽ muốn nắn sau khi xem học sinh chơi thật.
 *
 * KHÔNG nằm trong `balance_json`: đó là chỗ cho luật CHƠI — điểm, lượt thử,
 * năng lượng — chứ không phải cho nhịp của một hoạt ảnh. Một world khác không
 * có lý do gì để hiện bong bóng lâu hơn world này.
 */
export const DIALOGUE_TIMING = {
  /**
   * Nhịp "đang gõ" trước mỗi câu người canh giữ nói.
   *
   * Theo độ dài câu, có TRẦN. Chờ ba giây cho một lời khen hai chữ thì không
   * còn là tự nhiên nữa, mà là chậm — và đây là thứ lặp lại sau mỗi câu trả lời.
   */
  typingBase: 380,
  typingPerChar: 9,
  typingMax: 1100,

  /**
   * Tốc độ ĐỌC khi câu đó không có tiếng, mili giây mỗi ký tự.
   *
   * Lời khen và lời chê hiện nay là chữ thuần. Khi nào chúng có tiếng thì thay
   * chỗ này bằng độ dài thật của đoạn tiếng — cùng một ý: bong bóng ở lại đúng
   * bằng thời gian người ta cần để nghe hết.
   */
  readPerChar: 55,
  readMin: 1800,
  readMax: 4000,

} as const;

/** Bao lâu thì người canh giữ "gõ xong" một câu. */
export function typingMs(text: string): number {
  const { typingBase, typingPerChar, typingMax } = DIALOGUE_TIMING;
  return Math.min(typingMax, typingBase + text.length * typingPerChar);
}

/**
 * Bong bóng LỜI PHÁN ở lại bao lâu rồi biến mất.
 *
 * Nó biến mất chứ không nằm mãi: một lời khen còn treo trên màn hình lúc học
 * sinh đã sang câu khác thì nó đang khen một việc không còn ai nhớ, và hai
 * bong bóng NPC cùng đứng im là một cuộc trò chuyện đã dừng lại.
 */
export function holdMs(text: string, gap: number = DIALOGUE_GAP.default): number {
  const { readPerChar, readMin, readMax } = DIALOGUE_TIMING;
  const reading = Math.min(readMax, Math.max(readMin, text.length * readPerChar));
  return reading + gap;
}

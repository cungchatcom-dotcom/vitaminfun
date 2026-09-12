/**
 * GIỌNG CỦA NGƯỜI CANH GIỮ — chọn lời, và đọc lại bài học sinh vừa nộp.
 *
 * Hai việc nhỏ nhưng phải ở chung một chỗ: cả hai đều biến dữ liệu thô của một
 * lần thử thành thứ đọc lên được trong bong bóng hội thoại.
 *
 * Xem `docs/GAME_DOMAIN.md` §3f và `docs/UI_META_SCREENS.md` §S5.
 */

import { parseTemplate } from '@/components/question/template';

import type { Option } from '@/components/question/types';

/**
 * Chọn một câu trong tập, theo HASH chứ không ngẫu nhiên.
 *
 * Đây là thứ làm cho việc vào lại giữa chừng dựng lại được đúng cuộc hội thoại
 * đã diễn ra. `Math.random()` thì mỗi lần mở lại người canh giữ nói một câu
 * khác cho cùng một lần thử — mà học sinh thì nhớ họ đã nói gì.
 *
 * Hạt giống là `(question_id, attempt_no)`: cùng một lần thử luôn cho cùng một
 * câu, hai lần thử khác nhau gần như chắc chắn cho hai câu khác nhau.
 *
 * FNV-1a: ngắn, không phụ thuộc thư viện nào, và phân bố đủ đều cho một danh
 * sách năm câu. Đây không phải mã hoá — đừng thay bằng thứ gì "an toàn hơn".
 */
export function pickLine(lines: readonly string[], seed: string): string {
  if (lines.length === 0) return '';
  return lines[hashOf(seed) % lines.length] ?? lines[0]!;
}

/** FNV-1a, trả về số dương. Tách ra vì `pickDistinct` cũng cần đúng phép này. */
export function hashOf(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/**
 * Chọn câu sao cho TRONG CÙNG MỘT NHIỆM VỤ không lặp lại — và MỖI LƯỢT một dãy
 * khác.
 *
 * Hai đòi hỏi kéo ngược chiều nhau:
 *
 *   1. **Tất định trong một lượt.** Vào lại giữa chừng phải nghe đúng câu đã
 *      nghe. `Math.random()` hỏng ngay ở đây: mở lại bảng là người canh giữ nói
 *      một câu khác cho cùng một lần thử, và học sinh thì nhớ họ đã nói gì.
 *   2. **Khác nhau giữa các lượt và giữa các người chơi.** Băm theo mỗi
 *      `quest.id` thì cả trường chơi một nhiệm vụ đều nghe y hệt một dãy, chơi
 *      lại lần thứ năm vẫn dãy ấy.
 *
 * Giải bằng cách đưa MÃ LƯỢT CHƠI và MÃ NGƯỜI CHƠI vào hạt giống (`seed`): cố
 * định suốt một lượt, đổi ở lượt sau, khác nhau giữa hai người.
 *
 * ## Vì sao có cả BƯỚC NHẢY, không chỉ điểm xuất phát
 *
 * Chỉ xoay điểm xuất phát thì mười biến thể cho đúng mười dãy — hai người chơi
 * vẫn có một phần mười khả năng nghe trùng dãy. Thêm bước nhảy (`stride`) nguyên
 * tố cùng nhau với số câu thì được `n × số bước hợp lệ` dãy: mười câu cho bốn
 * bước (1, 3, 7, 9), tức bốn mươi dãy.
 *
 * Nguyên tố cùng nhau là điều kiện BẮT BUỘC, không phải làm đẹp: bước nhảy ăn
 * ước chung với `n` thì dãy quay vòng sớm — bước 2 trên mười câu chỉ chạm được
 * năm câu rồi lặp, và lời hứa "không lặp trong một nhiệm vụ" gãy.
 */
export function pickDistinct(
  lines: readonly string[],
  seed: string,
  ordinal: number,
): string {
  const n = lines.length;
  if (n === 0) return '';
  const start = hashOf(seed) % n;
  return lines[(start + ordinal * strideFor(n, seed)) % n] ?? lines[0]!;
}

/** Bước nhảy nguyên tố cùng nhau với `n`, chọn tất định theo hạt giống. */
function strideFor(n: number, seed: string): number {
  if (n <= 2) return 1;
  let step = 1 + (hashOf(`${seed}#stride`) % (n - 1));
  // Đi tới cho tới khi nguyên tố cùng nhau. Luôn dừng: `1` bao giờ cũng hợp lệ.
  for (let guard = 0; guard < n && gcd(step, n) !== 1; guard += 1) {
    step = (step % (n - 1)) + 1;
  }
  return gcd(step, n) === 1 ? step : 1;
}

function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

/**
 * Bài học sinh vừa nộp, viết thành câu đọc được cho bong bóng bên phải.
 *
 * KHÔNG phải một bộ vẽ thứ hai cho từng dạng bài: nó chỉ dựng MỘT DÒNG CHỮ. Bốn
 * dạng bài lưu bài làm bốn kiểu khác nhau, và bong bóng thì chỉ biết hiện chữ.
 *
 * Nhận diện theo HÌNH DẠNG của bài làm chứ không theo `type`: cùng một hình
 * dạng thì dựng câu giống nhau, và thêm một dạng bài mới mà bài làm vẫn mang
 * một trong những hình dạng này thì chỗ đây không phải sửa.
 */
/**
 * TIẾNG ĐỌC của câu trả lời học sinh vừa chọn, nếu có bản thu.
 *
 * Chỉ có ở câu TRẮC NGHIỆM MỘT ĐÁP ÁN. Câu gõ chữ thì không ai thu trước được
 * thứ học sinh sắp gõ; câu nhiều đáp án thì phải nối mấy đoạn rời thành một câu,
 * mà nối tiếng ở máy học sinh là chuyện khác hẳn — xem `speak_parts` ở server.
 * Điền khuyết cũng vậy.
 *
 * `bo` là bộ thu của ĐÚNG một giọng — giọng của nhân vật em đang chơi. Chỗ gọi
 * chọn giọng, ở đây chỉ tra.
 */
export function answerAudio(
  type: string,
  value: unknown,
  bo: Record<string, string> | null | undefined,
): string | null {
  if (!bo || !value || typeof value !== 'object') return null;
  if (type !== 'MCQ_SINGLE') return null;
  const id = (value as Record<string, unknown>).selectedOptionId;
  if (typeof id !== 'string') return null;
  return bo[id] ?? null;
}

export function answerText(
  type: string,
  content: Record<string, unknown>,
  value: unknown,
): string {
  if (!value || typeof value !== 'object') return '';
  const data = value as Record<string, unknown>;

  // Gõ chữ: chính chữ họ gõ.
  if (typeof data.text === 'string') return data.text.trim();

  // Trắc nghiệm một đáp án.
  if (typeof data.selectedOptionId === 'string') {
    return optionText(content, data.selectedOptionId);
  }

  // Trắc nghiệm nhiều đáp án.
  if (Array.isArray(data.selectedOptionIds)) {
    return data.selectedOptionIds.map((id) => optionText(content, String(id))).join(', ');
  }

  // Điền khuyết: ghép bài làm VÀO CHÍNH câu đề, để bong bóng đọc lên thành một
  // câu hoàn chỉnh chứ không phải một dãy từ rời.
  if (data.gaps && typeof data.gaps === 'object') {
    const gaps = data.gaps as Record<string, string | null>;
    const template = (content.template as string | undefined) ?? '';
    return parseTemplate(template)
      .map((segment) => {
        if (segment.kind === 'text') return segment.value;
        const filled = gaps[segment.value];
        // Ô bỏ trống vẫn hiện thành một vệt: "Cậu trả lời gì" mà thiếu hẳn một
        // chỗ thì câu đọc lên nghe như học sinh đã điền đủ.
        return filled && filled.trim() ? filled.trim() : '___';
      })
      .join('')
      .trim();
  }

  return '';
}

/** Chữ của một phương án. Không tìm thấy thì trả về chính mã — thà thô còn hơn rỗng. */
function optionText(content: Record<string, unknown>, id: string): string {
  const options = content.options as Option[] | undefined;
  if (!Array.isArray(options)) return id;
  const found = options.find((option) => option?.id === id);
  return found?.text?.trim() || id;
}

/**
 * Đề bài dưới dạng MỘT chuỗi.
 *
 * `template` là đường lùi cho câu điền khuyết — dạng đó không có `prompt` riêng,
 * chính câu đang khuyết là lời đề.
 */
export function promptOf(content: Record<string, unknown>): string {
  return ((content.prompt as string | undefined) ??
    (content.template as string | undefined) ??
    '') as string;
}

/**
 * Bỏ đề bài ra khỏi nội dung truyền xuống bộ vẽ.
 *
 * Đề bài đã nằm trong bong bóng của người canh giữ; để nguyên thì nó hiện ở CẢ
 * HAI chỗ, và khung trả lời mọc thêm một lớp chữ mà màn chơi không cần.
 *
 * `template` thì GIỮ: với câu điền khuyết, chính nó là phần tương tác.
 */
export function stripPrompt(content: Record<string, unknown>): Record<string, unknown> {
  return { ...content, prompt: undefined };
}

/**
 * Xử lý ô trống trong câu — dùng chung cho `GAP_FILL` và `GAP_DROPDOWN`.
 *
 * Câu được lưu dưới dạng chuỗi có đánh dấu: `"hello {{1}}, my name is {{2}}"`.
 * Giáo viên không phải tự gõ `{{1}}` — nút "+ Ô trống" chèn hộ vào đúng chỗ con
 * trỏ đang đứng (xem `insertGap`).
 *
 * Vì sao lưu bằng chuỗi có đánh dấu thay vì mảng đoạn: câu hỏi rồi sẽ được xuất
 * ra Word, nhập từ file, gửi cho AI sinh đề. Một chuỗi thì làm mấy việc đó rất
 * dễ; một mảng lồng nhau thì lần nào cũng phải viết bộ chuyển đổi.
 */

const GAP_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

export interface Segment {
  kind: "text" | "gap";
  /** Chữ, hoặc số thứ tự của ô trống. */
  value: string;
}

/** Cắt câu thành các đoạn chữ xen kẽ ô trống, theo đúng thứ tự xuất hiện. */
export function parseTemplate(template: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;

  for (const match of template.matchAll(GAP_PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) {
      segments.push({ kind: "text", value: template.slice(last, start) });
    }
    segments.push({ kind: "gap", value: match[1]! });
    last = start + match[0].length;
  }

  if (last < template.length) {
    segments.push({ kind: "text", value: template.slice(last) });
  }
  return segments;
}

/** Số thứ tự của các ô trống, theo đúng thứ tự xuất hiện trong câu. */
export function gapKeys(template: string): string[] {
  return parseTemplate(template)
    .filter((segment) => segment.kind === "gap")
    .map((segment) => segment.value);
}

/**
 * Số thứ tự cho ô trống tiếp theo.
 *
 * Lấy số lớn nhất rồi cộng một, KHÔNG lấy "số lượng ô + 1": xoá ô số 2 rồi thêm
 * ô mới sẽ sinh ra ô số 2 thứ hai, và hai ô trùng số thì không biết chấm ô nào.
 */
export function nextGapKey(template: string): string {
  const numbers = gapKeys(template)
    .map((key) => Number.parseInt(key, 10))
    .filter((n) => Number.isFinite(n));
  return String(numbers.length ? Math.max(...numbers) + 1 : 1);
}

/** Chèn một ô trống vào vị trí con trỏ. Trả về câu mới và vị trí con trỏ mới. */
export function insertGap(
  template: string,
  caret: number,
): { template: string; caret: number; key: string } {
  const key = nextGapKey(template);
  const token = `{{${key}}}`;
  const at = Math.max(0, Math.min(caret, template.length));

  // Tự thêm khoảng trắng nếu thiếu — nếu không thì ra "hello{{1}}world" và câu
  // hiện lên dính liền vào ô trống.
  const before = template.slice(0, at);
  const after = template.slice(at);
  const needSpaceBefore = before.length > 0 && !/\s$/.test(before);
  // KHÔNG chèn khoảng trắng trước dấu câu: "hello ___ , my name" đọc rất sai.
  // Tiếng Anh (và cả tiếng Việt) không bao giờ có dấu cách trước dấu phẩy.
  const needSpaceAfter = after.length > 0 && !/^[\s,.!?;:)\]}]/.test(after);

  const inserted = `${needSpaceBefore ? " " : ""}${token}${needSpaceAfter ? " " : ""}`;
  return {
    template: before + inserted + after,
    caret: at + inserted.length,
    key,
  };
}

/**
 * Bỏ một ô trống khỏi câu.
 *
 * KHÔNG đánh số lại các ô còn lại: đánh số lại thì mọi đáp án đã nhập phải dịch
 * theo, và chỉ cần sót một chỗ là đáp án gắn nhầm ô. Số thứ tự chỉ là mã định
 * danh, không cần liên tục.
 */
export function removeGap(template: string, key: string): string {
  return template
    .replace(new RegExp(`\\s*\\{\\{\\s*${key}\\s*\\}\\}\\s*`), " ")
    .replace(/\s{2,}/g, " ");
}

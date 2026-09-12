/**
 * BỘ ÁO của bảng hội thoại — đổi da, không đổi luật.
 *
 * ## Cơ chế: BIẾN CSS, không phải nhánh `if`
 *
 * Mỗi theme là một bộ biến CSS đặt lên gốc tấm bảng. Mọi mảnh bên trong —
 * bong bóng, thanh tiêu đề, khối đáp án, nút Trả lời — đọc `var(--q-…, <giá trị
 * hôm nay>)`. Nghĩa là:
 *
 *   - Theme `classic` KHÔNG đặt biến nào cả. Không có biến thì mọi chỗ rơi về
 *     đúng giá trị đang chạy, nên nó không thể lệch đi dù chỉ một pixel.
 *   - Màn soạn câu hỏi của giáo viên dùng chung `renderers.tsx` nhưng không nằm
 *     trong tấm bảng, nên nó cũng không thấy biến nào và cũng không đổi.
 *   - Thêm một theme = thêm một object ở file này. Không đụng vào một dòng logic
 *     nào.
 *
 * Đó là lý do chọn biến CSS thay vì truyền `theme` xuống từng component: truyền
 * xuống thì mỗi mảnh phải nhận thêm một prop và phải nhớ dùng nó, và cái mảnh
 * quên dùng sẽ lệch tông mà không ai biết cho tới khi nhìn thấy.
 *
 * ## Giới hạn thành thật
 *
 * CSS vẽ được màu, chuyển sắc, viền, bóng đổ. CSS KHÔNG vẽ được vỏ sò chạm nổi
 * hay cụm tinh thể vẽ tay. Những chỗ ấy có `--q-frame-img`: đặt đường dẫn một
 * tấm PNG chín lát (`border-image`) vào là khung thật thay chỗ khung CSS, phần
 * còn lại của theme giữ nguyên.
 */

/** Tên các theme. Khoá này đi vào `dialogue_json.theme`. */
export const DIALOGUE_THEME_KEYS = ['classic', 'atlantis'] as const;

export type DialogueThemeKey = (typeof DIALOGUE_THEME_KEYS)[number];

/** Bộ biến CSS của một theme. Rỗng = dùng hết giá trị mặc định. */
export type ThemeVars = Record<string, string>;

/**
 * KÍNH MỜ — bản đang chạy. Không đặt biến nào.
 *
 * Giữ NGUYÊN, không sửa một dòng: nó là mốc để so, và là thứ mọi màn đang dùng.
 */
const classic: ThemeVars = {};

/**
 * ATLANTIS — khung vàng chạm, vùng đọc ngọc trai, nút gỗ sẫm viền vàng.
 *
 * Dựng theo tấm mockup: một tấm bảng gỗ-vàng nổi trên đáy biển, phần đọc chữ
 * sáng như xà cừ, các phương án là những thanh gỗ sẫm viền vàng, nút chốt màu
 * vàng đồng.
 *
 * Vùng đọc SÁNG nên chữ phải SẪM — đó là cú lật tông lớn nhất so với `classic`,
 * và là lý do mọi màu chữ đều nằm trong bộ biến này chứ không viết cứng ở đâu.
 */
const atlantis: ThemeVars = {
  // ── Khung ngoài: nẹp đá xanh xám, mép trên sáng hơn như ăn ánh nước ──
  '--q-frame-pad': '12px',
  '--q-frame-radius': '1.5rem',
  '--q-frame-bg':
    'linear-gradient(180deg, #4e7b88 0%, #33555f 14%, #294550 55%, #1d333c 100%)',
  '--q-frame-shadow':
    '0 28px 70px rgba(2,12,18,0.7), inset 0 1px 0 rgba(255,255,255,0.22)',

  // ── Lòng bảng ────────────────────────────────────────────────────────
  '--q-inner-radius': '1rem',
  '--q-inner-bg': 'linear-gradient(180deg, #24424e 0%, #16323c 100%)',
  '--q-inner-ring': 'rgba(0,0,0,0.45)',

  '--q-header-bg': 'linear-gradient(180deg, #3d6472 0%, #2a4b57 100%)',
  '--q-header-line': 'rgba(0,0,0,0.45)',
  '--q-header-ink': '#f2f7f8',

  // ── Vùng đọc: XÀ CỪ, viền vàng ───────────────────────────────────────
  //
  // Xà cừ không phải một màu mà là vài mảng sáng lệch nhau chồng lên. Bốn lớp
  // chuyển sắc: hồng, lam, ngà, rồi nền trắng ngả xám — đủ để mắt đọc ra "vỏ
  // sò" chứ không phải "một mảng trắng".
  // ẢNH THẬT, cắt ra từ chính tấm mockup: mảng xà cừ 320×320 sạch duy nhất
  // trong đó (không dính chữ rune, không dính bong bóng), phóng to và làm mịn.
  //
  // Không ghép gương thành hoạ tiết lặp: thử rồi, ra một hình kim cương đối
  // xứng mà mắt đọc ngay là "hoạ tiết", không còn là vỏ sò. Một tấm phủ kín
  // (`cover`) thì nhoè nhưng vẫn là vân thật.
  //
  // Phủ thêm một lớp chuyển sắc rất nhạt để mép trên sáng, mép dưới lặng —
  // không có nó thì mảng xà cừ phẳng lì như giấy dán.
  '--q-body-bg':
    'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(18,40,50,0.10) 100%),' +
    'url("/ui/quest-nacre.jpg") center/cover no-repeat',
  '--q-body-margin': '10px',
  '--q-body-radius': '0.9rem',
  '--q-body-border': '7px solid #ac8a3b',
  '--q-body-shadow':
    'inset 0 0 0 1px rgba(255,241,205,0.65), 0 0 0 2px rgba(10,26,32,0.55), 0 8px 24px rgba(4,16,22,0.45)',

  '--q-bar-bg': 'linear-gradient(180deg, #2d4b57 0%, #1b333d 100%)',
  '--q-bar-line': 'rgba(0,0,0,0.45)',

  // ── Bong bóng ────────────────────────────────────────────────────────
  // Nền SẪM trên vùng đọc sáng — ngược hẳn `classic`, và là cách duy nhất để
  // chữ còn đọc được trên xà cừ.
  '--q-bubble-radius': '1rem',
  '--q-in-bg': 'rgba(74,79,86,0.90)',
  '--q-in-ring': 'rgba(255,255,255,0.16)',
  '--q-in-ink': '#f3f4f6',
  '--q-out-bg': 'linear-gradient(180deg, #23596b, #17414f)',
  '--q-out-ring': 'rgba(224,185,92,0.6)',
  '--q-out-ink': '#f6f1e2',
  '--q-muted': 'rgba(243,244,246,0.7)',
  '--q-praise': '#7fe3b0',
  '--q-wrong': '#ff9aa5',

  // ── Khối đáp án: thanh gỗ sẫm viền vàng, chữ cái bọc vòng xanh ───────
  '--q-opt-bg': 'linear-gradient(180deg, #16212f 0%, #0f1925 100%)',
  '--q-opt-ring': '#a98b4a',
  '--q-opt-ink': '#eef2f5',
  '--q-opt-on-bg': 'linear-gradient(180deg, #1d3247 0%, #142639 100%)',
  '--q-opt-on-ring': '#e0b95c',
  '--q-badge-ring': '#4fc3f7',
  '--q-badge-ink': '#4fc3f7',
  '--q-badge-on-bg': '#4fc3f7',
  '--q-badge-on-ink': '#08222e',

  // ── Nút chốt: nền sẫm, vành vàng sáng, chữ vàng ─────────────────────
  '--q-cta-bg': 'linear-gradient(180deg, #1c3e4c 0%, #122c37 100%)',
  '--q-cta-ink': '#f0d98c',
  '--q-cta-ring': '#e0b95c',
};

export const DIALOGUE_THEMES: Record<DialogueThemeKey, ThemeVars> = {
  classic,
  atlantis,
};

/** Theme đang có hiệu lực. Khoá lạ hay thiếu thì về `classic`. */
export function themeVars(key: string | null | undefined): ThemeVars {
  return DIALOGUE_THEMES[(key ?? '') as DialogueThemeKey] ?? DIALOGUE_THEMES.classic;
}

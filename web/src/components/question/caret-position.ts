/**
 * Tính toạ độ pixel của con trỏ nhập trong một ô soạn thảo nhiều dòng.
 *
 * Trình duyệt KHÔNG cho hỏi thẳng "con trỏ đang ở đâu trên màn hình" đối với
 * `<textarea>` — chỉ cho biết nó nằm ở ký tự thứ mấy. Cách duy nhất chạy được ở
 * mọi trình duyệt là dựng một bản sao vô hình của ô nhập, đổ vào đó đúng đoạn
 * chữ đứng trước con trỏ, rồi đo xem điểm cuối rơi vào đâu.
 *
 * Nghe vòng vo nhưng đây là cách chuẩn mực; mọi thư viện gợi ý @tên (Slack,
 * GitHub, Notion) đều làm y hệt.
 */

/**
 * Những thuộc tính ảnh hưởng tới cách chữ xuống dòng và chiếm chỗ.
 *
 * Thiếu một cái là bản sao ngắt dòng khác ô thật, và con trỏ đo được sẽ lệch
 * hẳn một dòng — càng viết dài càng lệch xa.
 */
const LAYOUT_PROPS = [
  "boxSizing",
  "width",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "letterSpacing",
  "wordSpacing",
  "lineHeight",
  "textAlign",
  "textIndent",
  "textTransform",
  "tabSize",
  "direction",
] as const;

export interface CaretPoint {
  /** Toạ độ so với góc trên–trái của ô nhập, đã trừ phần đã cuộn. */
  left: number;
  top: number;
  /** Chiều cao một dòng — để đặt nút thẳng hàng với dòng chữ. */
  lineHeight: number;
}

export function getCaretPoint(textarea: HTMLTextAreaElement, caret: number): CaretPoint {
  const style = window.getComputedStyle(textarea);

  const mirror = document.createElement("div");
  for (const prop of LAYOUT_PROPS) {
    mirror.style[prop] = style[prop];
  }
  // Bắt buộc: giữ nguyên khoảng trắng và xuống dòng như textarea, và cắt từ dài
  // theo cùng một quy tắc.
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.top = "0";
  mirror.style.left = "0";
  mirror.style.height = "auto";

  mirror.textContent = textarea.value.slice(0, caret);

  // Ký tự rộng-0 làm mốc đo. Dùng chữ thường sẽ tự nó chiếm chỗ và làm sai kết quả.
  const marker = document.createElement("span");
  marker.textContent = "​";
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  const left = marker.offsetLeft;
  const top = marker.offsetTop;
  const lineHeight = marker.offsetHeight || Number.parseFloat(style.lineHeight) || 20;
  document.body.removeChild(mirror);

  return {
    left: left - textarea.scrollLeft,
    top: top - textarea.scrollTop,
    lineHeight,
  };
}

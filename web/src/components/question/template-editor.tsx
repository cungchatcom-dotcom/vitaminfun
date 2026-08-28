"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { getCaretPoint } from "./caret-position";
import { insertGap } from "./template";

/**
 * Ô soạn câu có ô trống, với nút **+ Ô trống** bám theo con trỏ.
 *
 * Theo đúng cách bản khảo sát làm: nút hiện ngay cạnh chỗ đang gõ, không nằm cố
 * định ở đáy khung. Khác biệt tưởng nhỏ nhưng rất lớn — giáo viên khoét ô ở giữa
 * câu thì mắt đang nhìn vào giữa câu; bắt họ rê chuột xuống cuối khung rồi quay
 * lại là mỗi ô trống thêm hai lần di chuyển mắt.
 *
 * **Quy tắc đặt nút**
 *   • Con trỏ ở CUỐI câu → nút nằm ngay **bên phải** con trỏ.
 *   • Con trỏ ở GIỮA câu → nút nhảy lên **phía trên** dòng đó, vì đặt bên phải
 *     sẽ che mất phần chữ còn lại — đúng phần giáo viên đang cần đọc để quyết
 *     định khoét ở đâu.
 *
 * Để nhánh "phía trên" luôn có chỗ (kể cả khi con trỏ đang ở dòng đầu tiên),
 * khung bao chừa sẵn một dải trống phía trên ô nhập và nhãn được đặt vào đúng
 * dải đó — không tốn thêm chiều cao so với bố cục thường, và quan trọng hơn là
 * nút không bao giờ nhảy chỗ bất ngờ.
 */

/** Chiều cao dải chừa phía trên ô nhập, đủ chứa nút và khoảng cách. */
const DAI_TREN = 34;
const CAO_NUT = 28;
const KHOANG_CACH = 6;

interface Spot {
  left: number;
  /** Toạ độ đỉnh dòng chứa con trỏ, tính theo khung bao (đã cộng dải chừa). */
  top: number;
  lineHeight: number;
  placement: "right" | "above";
}

export function TemplateEditor({
  template,
  onTemplateChange,
  onInsertGap,
}: {
  template: string;
  onTemplateChange: (next: string) => void;
  /**
   * Chèn ô trống: báo về CÙNG LÚC câu mới và số thứ tự của ô vừa thêm.
   *
   * ⚠️ Cố ý gộp làm một lời gọi. Trước đây tách thành hai và bên nhận gọi `emit`
   * hai lần trong cùng một nhịp — lần thứ hai dùng `template` cũ trong closure
   * nên ghi đè lại lần thứ nhất, kết quả là bấm nút không thấy gì xảy ra.
   */
  onInsertGap: (nextTemplate: string, key: string) => void;
}) {
  const t = useTranslations();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const [spot, setSpot] = useState<Spot | null>(null);
  /**
   * Chỗ cần đặt con trỏ SAU KHI câu mới đã được vẽ ra.
   *
   * Không đặt ngay lúc bấm được: giá trị ô nhập do component cha giữ, nên tới
   * lượt vẽ sau React mới ghi câu mới vào ô — và ghi xong thì trình duyệt đẩy
   * con trỏ về cuối. Đặt trước là bị đè, con trỏ nhảy xuống cuối câu.
   */
  const conTroChoDat = useRef<number | null>(null);

  const capNhatViTri = useCallback(() => {
    const area = areaRef.current;
    if (!area) return;

    const caret = area.selectionStart ?? area.value.length;
    const { left, top, lineHeight } = getCaretPoint(area, caret);

    // Còn chữ phía sau con trỏ thì đặt nút bên phải sẽ che mất chúng.
    const conChuPhiaSau = area.value.slice(caret).trim() !== "";

    setSpot({
      left,
      top: top + DAI_TREN,
      lineHeight,
      placement: conChuPhiaSau ? "above" : "right",
    });
  }, []);

  // Chạy SAU khi React đã ghi câu mới vào ô nhập: đây là thời điểm duy nhất đặt
  // con trỏ mà không bị đè, và cũng là lúc đo được vị trí đúng.
  useEffect(() => {
    const area = areaRef.current;
    if (area && conTroChoDat.current !== null) {
      area.focus();
      area.setSelectionRange(conTroChoDat.current, conTroChoDat.current);
      conTroChoDat.current = null;
    }
    if (focused) capNhatViTri();
  }, [template, focused, capNhatViTri]);

  // `selectionchange` bắt được mọi cách di chuyển con trỏ, kể cả những cách
  // không sinh ra sự kiện bàn phím hay chuột trên chính ô nhập: Ctrl+A, kéo
  // chọn rồi thả ra ngoài, hoàn tác, trình đọc màn hình.
  useEffect(() => {
    if (!focused) return;
    const handler = () => {
      if (document.activeElement === areaRef.current) capNhatViTri();
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [focused, capNhatViTri]);

  function chenOTrong() {
    const caret = areaRef.current?.selectionStart ?? template.length;
    const result = insertGap(template, caret);
    // Trả con trỏ về ngay sau ô vừa chèn để gõ tiếp được luôn.
    conTroChoDat.current = result.caret;
    onInsertGap(result.template, result.key);
  }

  return (
    <div className="flex flex-col">
      {/* Dải chừa phía trên ô nhập vừa là chỗ đặt nhãn, vừa là chỗ để nút nhảy
          lên khi con trỏ đứng giữa câu. */}
      <div className="relative" style={{ paddingTop: DAI_TREN }}>
        {/* Nhãn nằm trong dải chừa. Khi nút nhảy lên nó có thể che một phần
            nhãn — làm mờ nhãn đi để trông như một lớp nổi có chủ đích, thay vì
            hai thứ vô tình đè lên nhau. */}
        <label
          className="field-label absolute start-0 top-0 transition-opacity"
          htmlFor="question-template"
          style={{ opacity: focused && spot?.placement === "above" ? 0.3 : 1 }}
        >
          {t("question.builder.sentence")}
        </label>

        <textarea
          id="question-template"
          ref={areaRef}
          className="field-input"
          rows={3}
          placeholder={t("question.builder.sentencePlaceholder")}
          value={template}
          onChange={(event) => {
            onTemplateChange(event.target.value);
            capNhatViTri();
          }}
          onFocus={() => {
            setFocused(true);
            capNhatViTri();
          }}
          onBlur={() => setFocused(false)}
          onClick={capNhatViTri}
          onKeyUp={capNhatViTri}
          onScroll={capNhatViTri}
        />

        {focused && spot ? (
          <button
            type="button"
            className="blank-chip focus-ring"
            // Giữ con trỏ ở nguyên chỗ cũ: mặc định bấm ra ngoài ô nhập là mất
            // focus, mà mất focus là mất luôn vị trí cần chèn.
            onMouseDown={(event) => event.preventDefault()}
            onClick={chenOTrong}
            style={caretStyle(spot)}
          >
            + {t("question.builder.blank")}
          </button>
        ) : null}
      </div>

      <p className="mt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
        {t("question.builder.sentenceHint")}
      </p>
    </div>
  );
}

function caretStyle(spot: Spot): React.CSSProperties {
  if (spot.placement === "right") {
    // Căn giữa nút theo dòng chữ, không dính mép trên của dòng.
    return {
      left: spot.left + KHOANG_CACH,
      top: spot.top + (spot.lineHeight - CAO_NUT) / 2,
    };
  }
  // Lùi sang trái một chút để mũi nút chỉ đúng vào chỗ sẽ chèn.
  return {
    left: Math.max(0, spot.left - 8),
    top: spot.top - CAO_NUT - KHOANG_CACH,
  };
}

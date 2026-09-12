'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Kéo thả và đổi kích thước trên một khung thiết kế.
 *
 * Dùng chung cho trình thiết kế MÀN CHƠI (kéo vật thể nhiệm vụ) và trình thiết
 * kế BẢN ĐỒ THIÊN HÀ (kéo world). Hai màn hình đó vẽ thứ khác nhau nhưng cách
 * cầm chuột thì giống hệt, và hai bản sao của cùng một phép toán toạ độ sẽ lệch
 * nhau đúng vào lúc không ai kịp nhận ra.
 *
 * Ba điều khiến đoạn này không tầm thường như nó trông:
 *
 *   1. **Toạ độ lưu theo hệ THẾ GIỚI, không theo pixel màn hình.** Khung soạn
 *      co giãn theo bề rộng cửa sổ; lưu pixel màn hình là mở trên máy khác thì
 *      mọi thứ nằm chỗ khác.
 *
 *   2. **Nghe chuột trên `window`, không trên khung.** Kéo nhanh là con trỏ ra
 *      ngoài khung trước khi thả tay; nghe trên khung thì vật thể kẹt lại giữa
 *      đường và không có sự kiện nào báo là đã xong.
 *
 *   3. **Ghi xuống server khi THẢ TAY, và đọc vị trí cuối qua callback của
 *      `setState`.** Biến `ghost` bắt được trong closure của listener là giá trị
 *      lúc GẮN listener — tức luôn cũ một nhịp, và thứ được lưu sẽ là chỗ vật
 *      thể đứng trước cú kéo.
 */
export interface BoardTarget {
  id: string;
  /** Tâm vật thể, theo hệ toạ độ thế giới. */
  x: number;
  y: number;
  /** Bề rộng và chiều cao hiện tại, theo hệ toạ độ thế giới. */
  w: number;
  h: number;
  /**
   * Giới hạn cỡ RIÊNG của vật thể này. Bỏ trống = dùng giới hạn chung của bảng.
   *
   * Cần thiết vì không phải thứ nào trên bảng cũng cùng một thang. Khung nội
   * dung nằm BÊN TRONG một khối, mà khối thấp nhất chỉ cao 88 đơn vị thế giới —
   * áp sàn chung (bề rộng nhỏ nhất của một khung chữ) vào đó thì khung nội dung
   * không co lại nổi quá một nửa khối. Hạ sàn chung xuống cho vừa thì lại cho
   * phép kéo cả KHỐI nhỏ hơn mức server nhận, và cú kéo kết thúc bằng lỗi 422.
   */
  min?: number;
  max?: number;
}

/**
 * Tay cầm nào đang được kéo.
 *
 *   'x'    — chấm giữa cạnh PHẢI: chỉ đổi bề rộng
 *   'y'    — chấm giữa cạnh DƯỚI: chỉ đổi chiều cao
 *   'both' — chấm ở GÓC: đổi cả hai, kéo chéo
 *
 * Ba tay cầm chứ không một, vì một cái khung chữ nhật có hai chiều độc lập.
 * Chỉ có tay cầm góc thì muốn kéo dài một chiều là phải kéo chéo rồi sửa lại
 * chiều kia — hai thao tác cho một ý định.
 */
export type ResizeAxis = 'x' | 'y' | 'both';

export interface DesignBoard {
  boardRef: React.RefObject<HTMLDivElement | null>;
  /** Vị trí đang kéo, chỉ để vẽ. `null` = không ai đang bị kéo. */
  ghost: { id: string; x: number; y: number } | null;
  /** Kích thước đang kéo, chỉ để vẽ. */
  sizeDraft: { id: string; w: number; h: number } | null;
  startDrag: (event: React.PointerEvent, target: BoardTarget) => void;
  startResize: (event: React.PointerEvent, target: BoardTarget, axis: ResizeAxis) => void;
}

export function useDesignBoard({
  canvas,
  minSize,
  maxSize,
  onMove,
  onResize,
}: {
  canvas: { width: number; height: number };
  minSize: number;
  maxSize: number;
  onMove: (id: string, x: number, y: number) => void;
  /** `axis` nói tay cầm nào được kéo — chỗ gọi chỉ ghi lại chiều thực sự đổi. */
  onResize: (id: string, size: { w: number; h: number }, axis: ResizeAxis) => void;
}): DesignBoard {
  const boardRef = useRef<HTMLDivElement>(null);

  // Ở ref chứ không state: kéo chuột bắn hàng chục sự kiện mỗi giây, đặt vào
  // state là vẽ lại cả cây component từng lần.
  const dragging = useRef<{
    id: string;
    dx: number;
    dy: number;
    /** Chỗ vật thể đứng lúc đặt tay xuống — để biết cú này có DI CHUYỂN không. */
    x0: number;
    y0: number;
  } | null>(null);
  const resizing = useRef<{
    id: string;
    centerX: number;
    centerY: number;
    axis: ResizeAxis;
    w: number;
    h: number;
    min: number;
    max: number;
  } | null>(null);

  const [ghost, setGhost] = useState<{ id: string; x: number; y: number } | null>(null);
  const [sizeDraft, setSizeDraft] = useState<{ id: string; w: number; h: number } | null>(null);

  // Hai hàm lưu đi qua ref: listener gắn MỘT LẦN (mảng phụ thuộc rỗng), nên
  // nếu gọi thẳng thì nó mãi gọi bản `onMove` của lần dựng đầu tiên.
  const commit = useRef({ onMove, onResize });
  commit.current = { onMove, onResize };

  function toWorld(clientX: number, clientY: number) {
    const box = boardRef.current!.getBoundingClientRect();
    return {
      x: Math.round(((clientX - box.left) / box.width) * canvas.width),
      y: Math.round(((clientY - box.top) / box.height) * canvas.height),
    };
  }

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      if (!boardRef.current) return;

      const resize = resizing.current;
      if (resize) {
        const point = toWorld(event.clientX, event.clientY);
        // Khoảng cách tới TÂM × 2, tính riêng từng trục — không dùng đường chéo.
        // Giá trị lưu là bề rộng và chiều cao, nên mép khung phải bám đúng con
        // trỏ; dùng đường chéo thì vật thể phình nhanh hơn tay và cảm giác như
        // bị trượt.
        const clamp = (value: number) =>
          Math.round(Math.max(resize.min, Math.min(resize.max, value * 2)));
        setSizeDraft({
          id: resize.id,
          w: resize.axis === 'y' ? resize.w : clamp(Math.abs(point.x - resize.centerX)),
          h: resize.axis === 'x' ? resize.h : clamp(Math.abs(point.y - resize.centerY)),
        });
        return;
      }

      const drag = dragging.current;
      if (!drag) return;
      const point = toWorld(event.clientX, event.clientY);
      setGhost({
        id: drag.id,
        x: Math.max(0, Math.min(canvas.width, point.x - drag.dx)),
        y: Math.max(0, Math.min(canvas.height, point.y - drag.dy)),
      });
    }

    function onPointerUp() {
      const resize = resizing.current;
      resizing.current = null;
      if (resize) {
        setSizeDraft((last) => {
          // KHÔNG ghi nếu cỡ y nguyên. Bấm vào một tay cầm rồi thả ra mà không
          // rê là một cú BẤM, không phải một cú kéo — mà một lần ghi thừa
          // không phải lúc nào cũng vô hại: ở màn hội thoại, ghi là biến một
          // màn đang THỪA KẾ bố cục thành một màn có bố cục riêng.
          if (last && last.id === resize.id && (last.w !== resize.w || last.h !== resize.h)) {
            commit.current.onResize(resize.id, { w: last.w, h: last.h }, resize.axis);
          }
          return null;
        });
        return;
      }

      const drag = dragging.current;
      dragging.current = null;
      if (!drag) return;
      setGhost((last) => {
        // Cùng lý do: chọn một khối là bấm vào nó, và chọn thì không được ghi.
        if (last && last.id === drag.id && (last.x !== drag.x0 || last.y !== drag.y0)) {
          commit.current.onMove(drag.id, last.x, last.y);
        }
        return null;
      });
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    boardRef,
    ghost,
    sizeDraft,
    startDrag(event, target) {
      event.stopPropagation();
      const point = toWorld(event.clientX, event.clientY);
      dragging.current = {
        id: target.id,
        dx: point.x - target.x,
        dy: point.y - target.y,
        x0: target.x,
        y0: target.y,
      };
      setGhost({ id: target.id, x: target.x, y: target.y });
    },
    startResize(event, target, axis) {
      event.stopPropagation();
      resizing.current = {
        id: target.id,
        centerX: target.x,
        centerY: target.y,
        axis,
        w: target.w,
        h: target.h,
        min: target.min ?? minSize,
        max: target.max ?? maxSize,
      };
      setSizeDraft({ id: target.id, w: target.w, h: target.h });
    },
  };
}

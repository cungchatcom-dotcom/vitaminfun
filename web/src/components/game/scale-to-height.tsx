'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * Phóng/thu một cụm điều khiển cho VỪA CHIỀU CAO cái khối chứa nó.
 *
 * Dành cho mấy thứ dựng bằng lớp Tailwind cỡ `rem` cố định — nút "← Bản đồ
 * thiên hà", cụm loa và tài khoản. Người dựng kéo cái khối to lên thì cả cụm
 * phải to theo, mà đổi cỡ chữ của thẻ cha thì không làm chúng to lên được: chỉ
 * có `transform: scale()` mới kéo được cả cụm, kể cả viền và khoảng cách.
 *
 * ## Khác `FitScale` ở đâu
 *
 * `FitScale` chỉ THU (nội dung chữ chảy tự do, tràn thì co lại) và cắt phần
 * thừa. Ở đây thì phải cả PHÓNG lẫn THU, và TUYỆT ĐỐI không cắt: bảng thả
 * xuống của nút tài khoản mọc ra ngoài cái khối, cắt đi là bấm nút không thấy
 * gì.
 *
 * ## Theo chiều cao, không theo bề rộng
 *
 * Số nút trong cụm đổi theo máy — nút toàn màn hình chỉ có trên cảm ứng. Căn
 * theo bề rộng thì cùng một khối mà máy này nút to, máy kia nút nhỏ. Căn theo
 * chiều cao thì nút luôn cùng một cỡ; chỉ có hàng nút dài ra hay ngắn lại, và
 * `align` quyết nó dài ra về phía nào.
 *
 * Đo bằng `offsetWidth`/`offsetHeight` — cỡ LAYOUT, chưa qua phép biến đổi —
 * nên tấm phòng chờ có đang bị phóng phủ màn hay không cũng không ảnh hưởng.
 * Ghi thẳng vào `style`, không qua state: một vòng vẽ-lại-rồi-đo-lại là thứ chỉ
 * chờ ngày kẹt.
 */
export function ScaleToHeight({
  children,
  align = 'start',
}: {
  children: ReactNode;
  /** Mép neo khi hàng nút ngắn hơn khối: `start` = trái, `end` = phải. */
  align?: 'start' | 'end';
}) {
  const hop = useRef<HTMLDivElement>(null);
  const ruot = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = hop.current;
    const body = ruot.current;
    if (!box || !body) return;

    function vua() {
      if (!box || !body) return;
      const cao = box.offsetHeight;
      const tuNhien = body.offsetHeight;
      if (!cao || !tuNhien) return;
      body.style.transform = `translateY(-50%) scale(${cao / tuNhien})`;
    }

    vua();
    // Khối đổi cỡ (người dựng kéo tay cầm, cửa sổ đổi cỡ) VÀ nội dung đổi cỡ
    // (nút toàn màn hình hiện ra sau lần vẽ đầu) — cả hai đều phải đo lại.
    const theoDoi = new ResizeObserver(vua);
    theoDoi.observe(box);
    theoDoi.observe(body);
    return () => theoDoi.disconnect();
  });

  return (
    <div ref={hop} className="relative size-full">
      <div
        ref={ruot}
        className="absolute top-1/2 w-max"
        style={{
          [align === 'end' ? 'right' : 'left']: 0,
          // Neo phép phóng vào ĐÚNG mép đang neo: phóng quanh tâm thì cụm neo
          // phải sẽ nở tràn ra khỏi mép phải của khối.
          transformOrigin: `${align === 'end' ? 'right' : 'left'} center`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

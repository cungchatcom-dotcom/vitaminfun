'use client';

import { useEffect, useState } from 'react';

/**
 * Máy này CÓ CON TRỎ RÊ ĐƯỢC không — chuột, trackpad, bút có hover.
 *
 * `false` = cảm ứng. Và cảm ứng thì KHÔNG CÓ TRẠNG THÁI "đang rê tới": ngón tay
 * chỉ có chạm hoặc không. Mọi thứ giao diện đang giấu sau `:hover` — thanh âm
 * lượng trượt ra, cụm HUD mờ rõ lên, trình phát mở rộng — trên điện thoại là
 * giấu vĩnh viễn. Không có lỗi nào hiện ra, không có gì để bấm; người dùng chỉ
 * thấy một cái nút mờ và không biết là mình đang thiếu thứ gì.
 *
 * ## Vì sao hỏi bằng JS chứ không chỉ bằng CSS
 *
 * Chỗ nào chỉ đổi HÌNH THỨC thì `@media (hover: hover)` trong class là đủ và
 * rẻ hơn — không state, không vẽ lại. Hook này dành cho chỗ mà một cái CỜ
 * TRONG REACT phải đổi theo: ví dụ thanh âm lượng chỉ nằm trong luồng Tab khi
 * nó đang mở.
 *
 * Trả `false` ở lần vẽ đầu, kể cả trên điện thoại: trang được dựng sẵn ở server,
 * nơi không có `matchMedia`. Đoán "có hover" rồi sửa lại ngay trong effect thì
 * an toàn hơn chiều ngược lại — sai một nhịp về phía "hiện ít hơn" còn hơn một
 * nhịp nhấp nháy cả cụm điều khiển.
 */
export function useCoarsePointer(): boolean {
  const [tho, setTho] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(hover: none)');
    setTho(mq.matches);

    // Đổi được lúc đang chạy: cắm chuột vào máy tính bảng, hoặc rút bàn phím
    // rời của iPad ra.
    const doi = (e: MediaQueryListEvent) => setTho(e.matches);
    mq.addEventListener('change', doi);
    return () => mq.removeEventListener('change', doi);
  }, []);

  return tho;
}

/**
 * MÀN HÌNH ĐANG DỌC, và là màn hình điện thoại.
 *
 * Ba điều kiện, và chúng phải GIỐNG HỆT `.rotate-gate` trong `globals.css` —
 * đó là hai cách hỏi cùng một câu:
 *
 *   - `orientation: portrait` — chính cái cần xử.
 *   - `pointer: coarse` — cảm ứng. Không có nó thì một cửa sổ hẹp-và-cao trên
 *     máy tính cũng bị coi là điện thoại, mà ở đó người dùng kéo rộng cửa sổ
 *     chứ không xoay được cái màn hình nào.
 *   - `max-width: 600px` — điện thoại, không phải máy tính bảng. iPad dựng
 *     đứng rộng 768–1024px và tấm tranh co lại vẫn đọc được.
 *
 * Hai chỗ mà lệch nhau thì hỏng theo kiểu tệ nhất: lớp phủ "xoay ngang máy"
 * hiện đè lên chính cái bố cục dọc vừa được vẽ ra cho nó. **Sửa một chỗ thì
 * sửa cả chỗ kia.**
 *
 * Trả `false` ở lần vẽ đầu: trang dựng sẵn ở server, nơi không có `matchMedia`.
 * Đoán "ngang" rồi sửa lại ngay trong effect an toàn hơn chiều ngược lại — bản
 * ngang là bản luôn tồn tại, còn bản dọc thì có thể chưa ai thiết kế.
 */
export const PORTRAIT_SCREEN =
  '(orientation: portrait) and (pointer: coarse) and (max-width: 600px)';

export function usePortraitScreen(): boolean {
  const [doc, setDoc] = useState(false);

  useEffect(() => {
    /**
     * CÔNG TẮC THỬ: `?portrait=1` ép bản dọc, `?portrait=0` ép bản ngang.
     *
     * Máy tính không giả lập được `pointer: coarse`, nên không có cách nào mở
     * bố cục dọc ra mà xem trên màn hình lớn — mỗi lần kiểm một con số phải
     * cầm điện thoại lên. Công tắc này cắt vòng đó.
     *
     * Chỉ đổi thứ HIỂN THỊ, không đổi dữ liệu: nó chọn bố cục nào được vẽ,
     * đúng như cái media query vẫn làm. Ai gõ tay vào thanh địa chỉ thì thấy
     * đúng thứ học sinh cầm điện thoại thấy — và đó là toàn bộ mục đích.
     */
    const ep = new URLSearchParams(window.location.search).get('portrait');
    if (ep === '1' || ep === '0') {
      setDoc(ep === '1');
      return;
    }

    const mq = window.matchMedia(PORTRAIT_SCREEN);
    setDoc(mq.matches);
    const doi = (e: MediaQueryListEvent) => setDoc(e.matches);
    mq.addEventListener('change', doi);
    return () => mq.removeEventListener('change', doi);
  }, []);

  return doc;
}

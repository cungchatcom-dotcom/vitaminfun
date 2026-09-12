'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * Thu nội dung cho VỪA cái khung chứa nó — không thanh cuộn, không tràn.
 *
 * ## Vì sao phải ĐO, chứ không đếm ký tự
 *
 * `fitProseSize()` đếm ký tự rồi tra một bảng bậc thang, và với một đoạn văn
 * chảy tự do thì thế là đủ. Nhưng khối ở màn hội thoại có kích thước do GIÁO
 * VIÊN kéo — một bong bóng rộng 380 đơn vị và một bong bóng rộng 640 đơn vị
 * chứa vừa những lượng chữ khác hẳn nhau, mà cùng một câu thì đếm ra cùng một
 * con số. Đếm ký tự ở đây là đoán mò trên một cái khung không biết trước.
 *
 * Và nội dung không phải lúc nào cũng là chữ: khung trả lời chứa cả một khung
 * câu hỏi tương tác — nút chọn, ô nhập — dựng bằng lớp Tailwind cỡ `rem` cố
 * định. Đổi cỡ chữ của thẻ cha KHÔNG làm chúng nhỏ đi. Chỉ có `transform:
 * scale()` mới thu được cả cụm.
 *
 * ## Cách làm
 *
 * Đặt nội dung ở kích thước thật, đo chiều cao, rồi thu bằng `scale()`. Thu thì
 * bề ngang cũng hụt đi, nên bù lại bằng cách NỚI bề rộng của lớp trong theo
 * đúng tỉ lệ vừa thu — kết quả là nội dung phủ đúng bề ngang cái khung. Nới bề
 * rộng thì chữ xuống dòng khác đi, tức chiều cao đổi, nên phải đo lại: vòng lặp
 * ba lượt là hội tụ, và ba lượt trên một khối là không đáng kể.
 *
 * ## Không giữ state
 *
 * Toàn bộ phép đo ghi thẳng vào `style` của thẻ, không đi qua `useState`. State
 * ở đây là một vòng lặp vẽ-lại-rồi-đo-lại chỉ chờ ngày kẹt. `useLayoutEffect`
 * chạy TRƯỚC lượt sơn của trình duyệt, nên người xem không thấy nhịp nhảy cỡ.
 */
export function FitScale({
  children,
  className = '',
  /** Căn giữa theo chiều dọc khi nội dung thấp hơn khung. */
  center = false,
}: {
  children: ReactNode;
  className?: string;
  center?: boolean;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  // Không có mảng phụ thuộc: nội dung đổi là vẽ lại, vẽ lại là đo lại. Đó chính
  // là điều kiện cần — một câu hỏi khác, một câu trả lời dài hơn.
  useLayoutEffect(() => {
    const box = outer.current;
    const body = inner.current;
    if (!box || !body) return;

    function fit() {
      if (!box || !body) return;
      const width = box.clientWidth;
      const height = box.clientHeight;
      if (!width || !height) return;

      /** Thử một tỉ lệ: đặt bề rộng bù lại rồi xem chiều cao có lọt không. */
      function fits(scale: number): boolean {
        if (!body) return false;
        body.style.width = `${width / scale}px`;
        return body.scrollHeight * scale <= height;
      }

      // TÌM KIẾM NHỊ PHÂN, không phải lặp "đo rồi chỉnh".
      //
      // Bản trước chỉnh dần: đo chiều cao, suy ra tỉ lệ, nới bề rộng theo, đo
      // lại. Nó DAO ĐỘNG — ở bề rộng 709px ba phương án xuống thành hai hàng
      // (cao 236), ở 890px chúng gọn lại (cao 188), và mỗi lượt đo lại nhảy
      // sang bờ bên kia, mãi mãi. Vòng lặp cắt ở lượt thứ ba nên kết quả là
      // "bờ nào rơi vào lượt cuối", thường là tỉ lệ nhỏ hơn cần thiết — nội
      // dung teo lại giữa một khoảng trống.
      //
      // "Lọt hay không" thì lại là một câu hỏi ĐƠN ĐIỆU: tỉ lệ càng lớn, khung
      // càng hẹp, nội dung càng cao, càng khó lọt. Nên chia đôi mà tìm tỉ lệ
      // LỚN NHẤT còn lọt — mười lượt là đủ chính xác tới 0,1%.
      let scale = 1;
      if (!fits(1)) {
        // Sàn 0,35: dưới mức đó thì chữ nhỏ tới mức không đọc được nữa, và thu
        // thêm cũng chỉ để giấu một cái khối bị đặt quá bé — thà để nó tràn cho
        // người dựng nhìn thấy còn hơn.
        let low = 0.35;
        let high = 1;
        for (let step = 0; step < 10; step += 1) {
          const mid = (low + high) / 2;
          if (fits(mid)) low = mid;
          else high = mid;
        }
        scale = low;
        fits(scale);
      }

      body.style.transform = `scale(${scale})`;
      body.style.top = center
        ? `${Math.max(0, (height - body.scrollHeight * scale) / 2)}px`
        : '0px';
    }

    fit();

    // Khung co giãn theo cửa sổ, nên đo một lần là chưa đủ.
    const watch = new ResizeObserver(fit);
    watch.observe(box);
    return () => watch.disconnect();
  });

  return (
    <div ref={outer} className={`relative size-full overflow-hidden ${className}`}>
      <div ref={inner} className="absolute left-0 origin-top-left">
        {children}
      </div>
    </div>
  );
}

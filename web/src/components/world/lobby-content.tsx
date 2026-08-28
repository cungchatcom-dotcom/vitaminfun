'use client';

import type { ReactNode } from 'react';

import {
  hasContentFrame,
  LOBBY_CONTENT,
  LOBBY_ELEMENTS,
  lobbyContentBox,
  type LobbyContentSaved,
  type LobbyElementKey,
} from '@/game/world';

/**
 * Khung NỘI DUNG của một khối phòng chờ: chỗ thật sự vẽ chữ và số, đặt bên
 * trong tấm ảnh nền của khối.
 *
 * Trước đây nội dung trải kín cả khối với đúng 4% đệm mỗi bên. Nhưng ảnh nền
 * gần như bao giờ cũng là một tấm khung trang trí — cuộn giấy, biển gỗ, tấm
 * bảng có hoa văn chạy quanh viền — và chỗ viết được chỉ là một ô ở giữa nó,
 * chẳng bao giờ đúng tâm với đúng 4%. Kết quả là chữ đè lên hoa văn, mà không
 * có cách nào chỉnh ngoài việc sửa lại chính tấm ảnh.
 *
 * Trình thiết kế và màn học sinh dùng CHUNG component này. Nếu không thì giáo
 * viên căn khung ở một chỗ rồi học sinh thấy chữ ở chỗ khác — và cả cái việc
 * kéo thả kia trở thành vô nghĩa.
 *
 * **Cỡ chữ theo bề rộng KHUNG, không theo cỡ chữ trang.** Dùng `cqw`, cùng luật
 * với `GalaxyFrame`: kéo khung to ra là chữ to theo, đúng tỉ lệ, ở mọi cỡ màn
 * hình. Đặt `px` cố định thì cùng một world mở trên máy khác là chữ nằm khác
 * chỗ so với hoa văn. Cỡ nền lấy theo TỪNG KHỐI (`LOBBY_ELEMENTS[key].font`) vì
 * các khối rộng hẹp rất khác nhau; phần trăm giáo viên đặt chỉ dịch cái thang,
 * không thay nó.
 *
 * **Chữ trắng, viền đen.** Chữ trắng trên một tấm ảnh sáng thì biến mất, mà ảnh
 * thì do người dựng tải lên nên không đoán trước được sáng tối. `paint-order:
 * stroke fill` là phần bắt buộc: thiếu nó, viền vẽ ĐÈ LÊN ruột chữ và nét chữ
 * bị gặm mất một nửa ở cỡ nhỏ.
 *
 * Màu và cỡ chữ đặt ở ĐÂY, một chỗ, rồi mọi thứ bên trong thừa hưởng — nên chữ
 * con bên trong phải viết theo `em`, đừng viết `px`.
 *
 * Khối trong `LOBBY_PLAIN_KEYS` thì khung nội dung TRÙNG KHÍT với khối: nó
 * không có tấm ảnh khung nào để né hoa văn, nên hai cái hộp lồng nhau chỉ là
 * hai chỗ để kéo cho cùng một kết quả. Màu và cỡ chữ vẫn đọc từ `content` như
 * thường — chỉ bốn con số toạ độ là bỏ qua.
 */
export function LobbyContent({
  elementKey,
  saved,
  children,
}: {
  elementKey: LobbyElementKey;
  saved: LobbyContentSaved | null | undefined;
  children: ReactNode;
}) {
  const box = lobbyContentBox(saved);
  const framed = hasContentFrame(elementKey);

  return (
    <div
      className="absolute"
      style={{
        left: framed ? `${box.x}%` : '50%',
        top: framed ? `${box.y}%` : '50%',
        width: framed ? `${box.w}%` : '100%',
        height: framed ? `${box.h}%` : '100%',
        transform: 'translate(-50%, -50%)',
        // Bật đơn vị `cqw` cho mọi thứ bên trong. Phải ở thẻ NGOÀI: `cqw` đo
        // theo khung bao gần nhất, nên đặt cỡ chữ bằng `cqw` trên chính thẻ
        // vừa khai báo khung thì nó đo nhầm sang khung của cấp trên.
        containerType: 'inline-size',
      }}
    >
      <div
        className="relative flex size-full flex-col"
        style={{
          fontSize: `${(LOBBY_ELEMENTS[elementKey].font * box.font) / 100}cqw`,
          color: box.color,
          WebkitTextStroke: `${LOBBY_CONTENT.strokeWidth} ${LOBBY_CONTENT.stroke}`,
          paintOrder: 'stroke fill',
        }}
      >
        {children}
      </div>
    </div>
  );
}

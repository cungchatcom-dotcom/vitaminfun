'use client';

import type { CSSProperties, ReactNode } from 'react';

import { FRAME, FRAME_FONT, GALAXY } from '@/game/world';

/**
 * Khung tiêu đề / khung mô tả trên bản đồ thiên hà.
 *
 * Một tấm ảnh trang trí do giáo viên tải lên, và chữ vẽ đè lên giữa nó. Mặc
 * định mang tên và mô tả của thiên hà; rê chuột vào một world thì đổi sang tên
 * và mô tả của world đó — **cái khung đứng yên, chỉ chữ đổi**. Vẽ lại một bộ
 * khung cho từng world nghĩa là bản đồ nhấp nháy đổi hình mỗi lần con trỏ đi
 * ngang, mà con trỏ thì đi ngang liên tục.
 *
 * Chưa có ảnh thì vẫn vẽ, bằng một tấm nền trơn: màn hình phải chạy được trước
 * khi ai kịp tải ảnh trang trí lên.
 *
 * Khung TIÊU ĐỀ luôn vẽ đè lên khung mô tả (`FRAME[kind].z`) — hai tấm bảng
 * này thường chồng nhau, và dải băng tên là thứ phải nhìn thấy.
 *
 * **Cỡ chữ theo bề rộng KHUNG, không theo cỡ chữ trang.** Dùng `cqw` —
 * container query unit — nên kéo khung to ra là chữ to theo, đúng tỉ lệ, ở mọi
 * cỡ màn hình. Đặt `px` cố định thì khung nhỏ lại là chữ tràn ra ngoài viền,
 * còn khung to ra là chữ lọt thỏm giữa một tấm biển trống.
 *
 * Màu chữ và cỡ chữ do giáo viên đặt, nhưng đặt CHO CÁI KHUNG chứ không cho
 * từng world: chữ của thiên hà và chữ của mọi world đều hiện ra ở đúng chỗ
 * này, nên cấu hình riêng cho từng world nghĩa là rê chuột qua ba world là chữ
 * đổi màu ba lần. `fontScale` là phần trăm so với cỡ nền, không phải `px` —
 * xem `FRAME_FONT`.
 */
export function GalaxyFrame({
  imageUrl,
  x,
  y,
  width,
  height,
  kind,
  color,
  fontScale,
  children,
  wrapper,
}: {
  imageUrl: string | null | undefined;
  /** Tâm khung, hệ toạ độ 3200×1800. `null` = dùng chỗ mặc định. */
  x: number | null | undefined;
  y: number | null | undefined;
  /** Bề rộng, cùng hệ toạ độ. */
  width: number | null | undefined;
  /** Chiều cao. `null` = suy ra theo tỉ lệ gốc của ảnh, như trước. */
  height?: number | null;
  kind: 'title' | 'desc';
  /** Mã màu `#rrggbb`. `null` = màu mặc định của khung. */
  color: string | null | undefined;
  /** PHẦN TRĂM so với cỡ chữ mặc định. `null` = 100. */
  fontScale: number | null | undefined;
  children: ReactNode;
  /** Thẻ bọc ngoài, để trình thiết kế gắn thêm kéo thả và tay cầm. */
  wrapper?: (box: { style: CSSProperties }, content: ReactNode) => ReactNode;
}) {
  const spec = FRAME[kind];
  const box: CSSProperties = {
    left: `${((x ?? spec.x) / GALAXY.width) * 100}%`,
    top: `${((y ?? spec.y) / GALAXY.height) * 100}%`,
    width: `${((width ?? spec.width) / GALAXY.width) * 100}%`,
    // Chưa ai kéo cạnh dưới thì không đặt chiều cao — để ảnh giữ tỉ lệ gốc,
    // đúng như nếp cũ. Đặt rồi thì ảnh căng theo đúng cái khung đó.
    ...(height ? { height: `${(height / GALAXY.height) * 100}%` } : {}),
    transform: 'translate(-50%, -50%)',
    // Tiêu đề nằm TRÊN khung mô tả — xem ghi chú ở `FRAME`. Nói rõ thứ tự chứ
    // không dựa vào thứ tự viết JSX: đảo hai dòng lúc sửa là đảo luôn cái nào
    // che cái nào, mà không có gì trong đoạn mã báo rằng điều đó quan trọng.
    zIndex: spec.z,
  };

  const content = (
    <div
      className={height ? 'relative size-full' : 'relative w-full'}
      // `inline-size` bật đơn vị `cqw` cho mọi thứ bên trong.
      style={{ containerType: 'inline-size' }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className={height ? 'block size-full' : 'block w-full'}
          draggable={false}
        />
      ) : (
        // Chưa có ảnh: một tấm nền trơn giữ đúng tỉ lệ mà ảnh thật sẽ có, để
        // giáo viên căn chỗ ngay cả khi chưa kịp vẽ khung.
        <div
          className="w-full rounded-2xl border border-abyss-700 bg-abyss-950/80"
          style={{ aspectRatio: spec.ratio }}
        />
      )}

      {/* Chữ nằm ĐÈ LÊN ảnh, thụt vào để không đè lên hoa văn ở viền. */}
      <div
        className="absolute inset-0 flex items-center justify-center text-center"
        style={{ padding: `${spec.padding}cqw` }}
      >
        <span
          className="block w-full leading-tight font-bold"
          style={{
            // Cỡ nền × phần trăm giáo viên đặt. Vẫn là `cqw`, nên vẫn co giãn
            // theo bề rộng khung — phần trăm chỉ dịch cái thang, không thay nó.
            fontSize: `${(spec.font * (fontScale ?? FRAME_FONT.base)) / 100}cqw`,
            color: color ?? spec.color,
          }}
        >
          {children}
        </span>
      </div>
    </div>
  );

  if (wrapper) return wrapper({ style: box }, content);
  return (
    <div className="pointer-events-none absolute" style={box}>
      {content}
    </div>
  );
}

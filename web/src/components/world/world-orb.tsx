'use client';

import type { CSSProperties } from 'react';

import { resolvePulse } from '@/game/world';

/**
 * World trên bản đồ thiên hà.
 *
 * MẶC ĐỊNH: vẽ đúng cái ảnh, không hơn. Không nền, không khung, không ép vuông
 * — `icon_size` là BỀ RỘNG và chiều cao suy ra theo tỉ lệ gốc của ảnh, y hệt
 * ảnh vật thể nhiệm vụ trong màn chơi. Ranh giới của world chính là ranh giới
 * của FILE ẢNH — khung ôm sát nó, không chừa thêm gì.
 *
 * Lề trong suốt bên trong file thì KHÔNG cắt. Có thể cắt tự động bằng cách đọc
 * kênh alpha, nhưng chủ ý là không: đó là đoán ý người ta muốn thấy gì, và
 * người ra tấm ảnh mới là người biết đâu là mép. Ảnh nhìn có vẻ nhỏ hơn bề rộng
 * đã đặt thì lề nằm trong file, cắt file là xong.
 *
 * Trước đây ảnh nằm trong một đĩa tròn `bg-abyss-800`: ảnh nào không vuông thì
 * lòi ra một vành xanh đậm quanh mình, và giáo viên đặt bề rộng 380 lại thấy
 * một hình khác hẳn thứ họ tải lên.
 *
 * Bật `showRing` thì đổi hẳn cách vẽ: world thành một huy hiệu TRÒN — ảnh bị
 * mask tròn, và vành ngoài là thanh tiến độ, đầy dần theo số mảnh bản đồ đã gom
 * (10/30 màn là đầy một phần ba). Ép tròn ở đây không phải tuỳ tiện: một thanh
 * tiến độ hình vành khuyên thì phải có hình tròn để chạy quanh.
 *
 * Vành vẽ bằng SVG chứ không bằng `conic-gradient`: `stroke-dasharray` cho mép
 * sắc ở mọi kích thước và mọi tỉ lệ điểm ảnh, còn conic-gradient thì răng cưa
 * dọc theo cung khi vòng tròn to.
 *
 * KHÔNG bao giờ làm mờ ảnh. Bản trước hạ độ mờ cho world còn ở dạng nháp, và
 * hậu quả là mọi world vừa tạo đều xỉn màu — người dùng đọc ra "hỏng" chứ không
 * đọc ra "chưa phát hành". Trạng thái nói bằng biểu tượng: khoá thì có ổ khoá,
 * còn màu của bức tranh là màu giáo viên đã chọn.
 *
 * Component thuần hiển thị — không gọi API, không biết mình đang nằm trong
 * trình thiết kế hay trong màn chơi của học sinh.
 */
export function WorldOrb({
  coverUrl,
  progress,
  showRing,
  locked,
  pulsePercent,
  pulsePeriodMs,
}: {
  coverUrl: string | null | undefined;
  /** 0…1. Phần vành được tô sáng. Bỏ qua nếu `showRing` tắt. */
  progress: number;
  /** Đổi world thành huy hiệu tròn có thanh tiến độ. Mặc định tắt. */
  showRing?: boolean;
  locked?: boolean;
  pulsePercent: number | null | undefined;
  pulsePeriodMs: number | null | undefined;
}) {
  const pulse = resolvePulse(pulsePercent, pulsePeriodMs);

  const wrapper = {
    className: `relative w-full ${showRing ? 'aspect-square' : ''} ${
      pulse ? 'pulse-breathe' : ''
    }`,
    style: pulse
      ? ({
          animationDuration: `${pulse.halfCycleMs}ms`,
          '--pulse-max': pulse.maxScale,
        } as CSSProperties)
      : undefined,
  };

  // Chưa có ảnh thì vẫn phải có MỘT THỨ để nhìn và để kéo. Viền đứt nói rõ đây
  // là chỗ giữ chỗ chứ không phải khung của world — có ảnh là nó biến mất.
  const placeholder = (
    <span
      aria-hidden="true"
      className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-abyss-700 bg-abyss-900/60 text-3xl"
    >
      🌊
    </span>
  );

  const lock = locked && (
    <span className="absolute inset-0 flex items-center justify-center text-2xl drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
      🔒
    </span>
  );

  // ------------------------------------------------------------- ảnh trần
  if (!showRing) {
    return (
      <div {...wrapper}>
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            className="block w-full drop-shadow-lg"
            draggable={false}
            loading="lazy"
          />
        ) : (
          placeholder
        )}
        {lock}
      </div>
    );
  }

  // ------------------------------------------------------------- huy hiệu tròn
  // r = 46 trong hệ toạ độ 100×100, chừa chỗ cho nét vành dày 6.
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(1, progress)) * circumference;

  return (
    <div {...wrapper}>
      {/* Ảnh thụt vào đúng bằng bề dày vành cộng một chút hở — không thì vành
          đè lên mép ảnh và cả hai cùng trông bẩn. */}
      <div className="absolute inset-[8%] overflow-hidden rounded-full">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
            loading="lazy"
          />
        ) : (
          placeholder
        )}
      </div>

      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-abyss-700"
        />
        {filled > 0 && (
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            className="text-orichalcum-400"
          />
        )}
      </svg>

      {lock}
    </div>
  );
}

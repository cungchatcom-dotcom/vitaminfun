'use client';

import { useEffect, useRef } from 'react';

import type { BackgroundKind } from '@/lib/media';

/**
 * Lớp NỀN của một màn hình: ảnh tĩnh hoặc video.
 *
 * Một component cho cả năm chỗ đang vẽ nền — bản đồ thiên hà, phòng chờ world,
 * mặt màn trên minimap, và hai khung xem trước trong trình thiết kế. Trước đây
 * cả năm chỗ đều là cùng một thẻ `<img>` chép ra năm lần; thêm nhánh video vào
 * từng bản chép là năm chỗ để quên `playsInline`, và một trong số đó sẽ bung
 * toàn màn hình trên iPhone.
 *
 * Loại nền do SERVER trả xuống (`background_kind`), không đoán theo đuôi file
 * trong URL — xem `BackgroundKind` bên `api/app/modules/worlds/schemas.py`.
 *
 * ## Hình ảnh không phụ thuộc vào quyền phát âm thanh
 *
 * Video luôn khởi động ở trạng thái CÂM, nên khung hình chạy ngay khi vào màn.
 * Trình duyệt chỉ chặn âm thanh tự phát, không chặn video câm. Mở tiếng ngay từ
 * đầu là cú `play()` bị từ chối và người chơi mất luôn cái nền động, chứ không
 * chỉ mất tiếng — một cái giá quá đắt cho thứ họ có thể bật sau bằng một cú bấm.
 */
export function BackgroundLayer({
  url,
  kind,
  className,
  still = false,
  sound = null,
}: {
  url: string | null | undefined;
  kind: BackgroundKind | null | undefined;
  className?: string;
  /**
   * Ghim ở KHUNG HÌNH ĐẦU, không chạy.
   *
   * Dùng cho minimap: ở đó nhiều màn hiện cùng lúc, và cho tất cả chạy vòng lặp
   * là bắt máy học sinh nuôi N bộ giải mã video để vẽ mấy vòng tròn nhỏ.
   */
  still?: boolean;
  /**
   * Mở tiếng của video này làm nhạc nền. `null` = câm.
   *
   * `volume` đã nhân sẵn với âm lượng tổng của người chơi — chỗ này không biết
   * gì về tuỳ chọn nhạc, nó chỉ nhận một con số 0..1.
   */
  sound?: { on: boolean; volume: number } | null;
}) {
  const video = useRef<HTMLVideoElement>(null);

  // Tuỳ chọn MỚI NHẤT cho listener đọc lại — cùng lý do với `AmbientPlayer`:
  // cú bấm mở khoá có thể chạy rất lâu sau lúc gắn, và tới lúc đó người chơi có
  // thể đã đổi ý.
  const live = useRef(sound);
  live.current = sound;

  const on = sound?.on ?? false;
  const volume = sound?.volume ?? 0;

  useEffect(() => {
    const el = video.current;
    if (!el || kind !== 'video' || still) return;

    // Âm lượng đặt kể cả lúc đang câm, để lúc mở tiếng là đúng mức ngay chứ
    // không kêu to một nhịp rồi mới hạ xuống.
    el.volume = volume;

    if (!on) {
      el.muted = true;
      return;
    }

    let huy = false;
    const moTieng = () => {
      if (huy || !live.current?.on) return;
      el.muted = false;
      el.volume = live.current.volume;
      void el.play().catch(() => {
        // Trình duyệt từ chối phát KÈM TIẾNG vì chưa ai chạm vào trang. Nó dừng
        // luôn cả thẻ video, nên phải câm lại và cho chạy tiếp NGAY — mất tiếng
        // thì còn nhìn được, mất hình thì màn hình đứng hình.
        if (huy) return;
        el.muted = true;
        void el.play().catch(() => undefined);
        window.addEventListener('pointerdown', moTieng, { once: true });
        window.addEventListener('keydown', moTieng, { once: true });
      });
    };
    moTieng();

    return () => {
      huy = true;
      window.removeEventListener('pointerdown', moTieng);
      window.removeEventListener('keydown', moTieng);
    };
  }, [kind, still, on, volume]);

  if (!url) return null;

  if (kind === 'video') {
    return (
      <video
        ref={video}
        // `#t=0.1` là MẢNH THỜI GIAN của chuẩn media: trình duyệt nhảy tới giây
        // đó và vẽ ra, nên một thẻ không autoplay vẫn có hình thay vì một ô đen.
        // Rẻ hơn hẳn việc bắt người dựng tải thêm một tấm ảnh đại diện.
        src={still && !url.includes('#') ? `${url}#t=0.1` : url}
        className={className}
        // Câm từ đầu, LUÔN LUÔN. Effect ở trên mới là chỗ mở tiếng, và chỉ khi
        // được phép — xem chú thích đầu file.
        muted
        autoPlay={!still}
        loop={!still}
        // Thiếu cái này là iPhone bung video ra toàn màn hình ngay khi phát.
        playsInline
        preload={still ? 'metadata' : 'auto'}
        // Video nền không phải một trình phát: không thanh điều khiển, không
        // menu chuột phải, không nút hình-trong-hình.
        controls={false}
        disablePictureInPicture
        aria-hidden
      />
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={className} draggable={false} />;
}

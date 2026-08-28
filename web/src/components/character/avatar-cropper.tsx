'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

/**
 * Chọn vùng cắt TRÒN cho ảnh đại diện.
 *
 * Khung tròn ĐỨNG YÊN ở giữa; người dùng kéo và phóng to **tấm ảnh** phía sau
 * cho tới khi phần muốn giữ lọt vào khung. Đây là cách Facebook và gần như mọi
 * ứng dụng khác làm, và nó đúng hơn cách ngược lại: mắt người nhìn vào cái ảnh
 * chứ không nhìn vào cái khung, nên thứ nên di chuyển là cái ảnh.
 *
 * (Bản trước làm ngược — khung tròn kéo được, ảnh đứng yên. Nó khó dùng vì mỗi
 * lần muốn lấy một chi tiết ở góc ảnh thì phải vừa kéo khung vừa thu nhỏ khung,
 * và khung nhỏ lại thì độ phân giải ảnh cắt ra cũng nhỏ theo.)
 *
 * **Cắt rồi lưu thành ẢNH MỚI, không ghi đè ảnh gốc.** Ảnh gốc là thứ giáo
 * viên đưa cho ta; ghi đè nó là một quyết định không thể hoàn tác, và cùng tấm
 * đó có thể đang được nhân vật khác dùng.
 */

/** Đường kính khung tròn trên màn hình, pixel. Chỉ là cỡ HIỂN THỊ. */
const VIEW = 320;

/** Khoảng phóng to. 1 = ảnh vừa khít khung tròn. */
const ZOOM = { min: 1, max: 4, step: 0.01 };

/** Trần cạnh của ảnh xuất ra. Giữ file avatar ở cỡ hợp lý. */
const MAX_OUT = 1024;

export function AvatarCropper({
  sourceUrl,
  onCancel,
  onCropped,
}: {
  sourceUrl: string;
  onCancel: () => void;
  /** Ảnh đã cắt, dạng PNG vuông. Chỗ gọi lo việc tải lên. */
  onCropped: (file: File) => void;
}) {
  const t = useTranslations('character');

  /**
   * URL dùng trong hộp thoại này — CÓ thêm một tham số vô nghĩa `?cors=1`.
   *
   * Không phải để chống cache, mà để TÁCH cache. Ảnh này đã được thẻ `<img>`
   * ảnh đại diện trên trang nạp trước đó, KHÔNG kèm `crossOrigin`; trình duyệt
   * lưu bản đó lại. Khi ta nạp lại đúng URL ấy nhưng có `crossOrigin`, nó dùng
   * lại bản trong cache — bản không mang tiêu đề CORS — và cú nạp THẤT BẠI im
   * lặng: `onload` không bao giờ chạy, hộp thoại đứng ở dấu "…" mãi mãi.
   *
   * Đúng cái đã xảy ra khi thử lần đầu. Một tham số khác nhau là một mục cache
   * khác, được tải lại tử tế kèm CORS, và canvas không bị "nhiễm" nên
   * `toBlob()` chạy được.
   */
  const corsUrl = `${sourceUrl}${sourceUrl.includes('?') ? '&' : '?'}cors=1`;

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  //: Ảnh đã dời đi bao nhiêu so với tâm khung, tính bằng pixel MÀN HÌNH.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);

  //: Điểm bắt đầu của cú kéo. Ở ref chứ không state — kéo chuột bắn hàng chục
  //: sự kiện mỗi giây, đặt vào state là vẽ lại cả cây component từng lần.
  const dragFrom = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => setNatural({ w: image.naturalWidth, h: image.naturalHeight });
    image.src = corsUrl;
  }, [corsUrl]);

  // Tỉ lệ để ảnh VỪA KHÍT khung tròn ở mức phóng 1 — đúng phép `object-fit:
  // cover`. Nhờ vậy `scale = 1` luôn là "ảnh phủ kín khung", bất kể ảnh dọc hay
  // ngang, và người dùng không bao giờ kéo ra được một mảng trống.
  const cover = natural ? Math.max(VIEW / natural.w, VIEW / natural.h) : 1;
  const shownW = natural ? natural.w * cover * scale : 0;
  const shownH = natural ? natural.h * cover * scale : 0;

  /** Giữ ảnh luôn phủ kín khung: không cho kéo tới mức lộ mép. */
  function clamp(next: { x: number; y: number }) {
    const maxX = Math.max(0, (shownW - VIEW) / 2);
    const maxY = Math.max(0, (shownH - VIEW) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
  }

  // Phóng to xong thì kéo lại cho khỏi lộ mép: thu nhỏ về 1 trong khi ảnh đang
  // bị đẩy lệch sẽ để lộ một mảng trống nếu không nắn lại.
  useEffect(() => {
    setOffset((current) => clamp(current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, natural]);

  useEffect(() => {
    function move(event: PointerEvent) {
      const from = dragFrom.current;
      if (!from) return;
      setOffset(clamp({ x: from.x + event.clientX - from.px, y: from.y + event.clientY - from.py }));
    }
    function up() {
      dragFrom.current = null;
    }
    // Nghe trên `window`: kéo nhanh là con trỏ ra ngoài khung trước khi thả tay,
    // và nghe trên khung thì ảnh kẹt lại giữa đường.
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownW, shownH]);

  async function save() {
    if (!natural) return;
    setSaving(true);
    try {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = corsUrl;
      });

      // Đổi khung tròn trên màn hình về toạ độ ẢNH GỐC.
      //
      //   một pixel màn hình  =  1 / (cover × scale)  pixel ảnh gốc
      //
      // Tâm khung nằm ở giữa ảnh, dời đi `offset`; nên mép trái của khung, tính
      // trên ảnh đang hiển thị, là `shownW/2 − VIEW/2 − offset.x`.
      const perPixel = cover * scale;
      const srcSize = VIEW / perPixel;
      const srcX = (shownW / 2 - VIEW / 2 - offset.x) / perPixel;
      const srcY = (shownH / 2 - VIEW / 2 - offset.y) / perPixel;

      const out = Math.round(Math.min(srcSize, MAX_OUT));
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = out;
      const context = canvas.getContext('2d');
      if (!context) return;

      // Cắt ra tấm VUÔNG, không tự bo tròn: hình tròn là việc của CSS ở chỗ
      // hiển thị. Nướng sẵn nền trong suốt vào file thì tấm đó không dùng lại
      // được ở chỗ nào khác.
      context.drawImage(image, srcX, srcY, srcSize, srcSize, 0, 0, out, out);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      );
      if (blob) onCropped(new File([blob], 'avatar.png', { type: 'image/png' }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal label={t('cropTitle')} onClose={onCancel}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-abyss-700 bg-abyss-900 shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-abyss-800 px-5 py-3">
          <h2 className="font-semibold text-slate-100">{t('cropTitle')}</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t('cropCancel')}
            className="text-slate-400 hover:text-slate-100"
          >
            ✕
          </button>
        </header>

        <div className="p-5">
          <p className="mb-3 text-center text-xs text-slate-500">{t('cropHint')}</p>

          {natural ? (
            <>
              <div
                className="relative mx-auto touch-none overflow-hidden rounded-full ring-2 ring-lagoon-400 select-none"
                style={{ width: VIEW, height: VIEW, cursor: 'grab' }}
                onPointerDown={(event) => {
                  dragFrom.current = {
                    px: event.clientX,
                    py: event.clientY,
                    x: offset.x,
                    y: offset.y,
                  };
                }}
                // Lăn chuột để phóng — thói quen sẵn có, khỏi phải với xuống
                // thanh trượt cho một chỉnh sửa nhỏ.
                onWheel={(event) => {
                  const next = scale - Math.sign(event.deltaY) * 0.08;
                  setScale(Math.max(ZOOM.min, Math.min(ZOOM.max, next)));
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={corsUrl}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute max-w-none"
                  style={{
                    width: shownW,
                    height: shownH,
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  }}
                />
              </div>

              <label className="mt-4 flex items-center gap-3">
                <span className="text-xs text-slate-400">−</span>
                <input
                  type="range"
                  min={ZOOM.min}
                  max={ZOOM.max}
                  step={ZOOM.step}
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="flex-1 accent-lagoon-400"
                  aria-label={t('cropZoom')}
                />
                <span className="text-xs text-slate-400">+</span>
              </label>
            </>
          ) : (
            <p className="text-center text-sm text-slate-500">…</p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-abyss-800 px-5 py-3">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {t('cropCancel')}
          </Button>
          <Button variant="primary" size="sm" disabled={saving || !natural} onClick={() => void save()}>
            {t('cropSave')}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}

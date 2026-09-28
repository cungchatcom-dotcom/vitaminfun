'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { useCoarsePointer } from '@/game/pointer';

/**
 * TOÀN MÀN HÌNH — chỉ hiện trên điện thoại, và chỉ ở máy làm được.
 *
 * Xoay ngang xong vẫn chưa hết chật: thanh địa chỉ và thanh tab của trình duyệt
 * ăn khoảng một phần tư chiều cao, mà chiều cao là đúng thứ một tấm tranh 16:9
 * đang thiếu. Toàn màn hình lấy lại chỗ đó, và nó là cú thắng lớn nhất còn lại
 * sau khi máy đã nằm ngang.
 *
 * Kèm theo một lượt khoá hướng: đã toàn màn hình rồi thì giữ luôn cho khỏi lật
 * về dọc giữa chừng vì đặt máy xuống bàn. Khoá hỏng cũng không sao — phần toàn
 * màn hình vẫn giữ.
 *
 * CHỈ CẢM ỨNG. Trên máy tính, cửa sổ trình duyệt đã là cái người dùng tự chọn
 * cỡ, và F11 thì có sẵn; thêm một cái nút nữa vào HUD chỉ là thêm một thứ che
 * mất bức tranh.
 *
 * Safari trên iPhone không cho thẻ thường vào toàn màn hình (chỉ video), nên ở
 * đó nút không hiện. Xem `RotateAction` để biết vì sao thà không có nút.
 */
export function FullscreenButton({ className = '' }: { className?: string }) {
  const t = useTranslations('play.rotate');
  const cham = useCoarsePointer();

  const [lamDuoc, setLamDuoc] = useState(false);
  const [dangBat, setDangBat] = useState(false);

  useEffect(() => {
    setLamDuoc(document.fullscreenEnabled === true);

    // Người dùng thoát toàn màn hình bằng cử chỉ của hệ điều hành hay phím Esc
    // thì trình duyệt không báo qua cú bấm nào cả — chỉ có sự kiện này. Không
    // nghe thì cái nút kẹt ở trạng thái "đang bật" và nói dối.
    const doi = () => setDangBat(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', doi);
    return () => document.removeEventListener('fullscreenchange', doi);
  }, []);

  if (!cham || !lamDuoc) return null;

  async function bam() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await document.documentElement.requestFullscreen();
      const man = window.screen?.orientation as
        | (ScreenOrientation & { lock?: (h: 'landscape') => Promise<void> })
        | undefined;
      // Khoá hướng là món THÊM, không phải điều kiện: hỏng thì bỏ qua, phần
      // toàn màn hình vừa lấy được vẫn còn nguyên.
      await man?.lock?.('landscape').catch(() => {});
    } catch {
      // Trình duyệt từ chối. Không có gì để báo và cũng không có gì hỏng.
    }
  }

  const nhan = t(dangBat ? 'exitFullscreen' : 'fullscreen');

  return (
    <button
      type="button"
      onClick={bam}
      title={nhan}
      aria-label={nhan}
      className={`grid size-8 place-items-center rounded-full border border-white/25 bg-black/45 text-sm text-white/85 backdrop-blur transition active:bg-black/70 ${className}`}
    >
      <span aria-hidden>{dangBat ? '⤡' : '⛶'}</span>
    </button>
  );
}

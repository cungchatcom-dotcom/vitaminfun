'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Video không bắt đầu chạy trong ngần này mili giây thì coi như đã xong.
 *
 * Sáu giây: đủ dài cho một tệp đang tải trên mạng chậm, đủ ngắn để không ai
 * ngồi nhìn một màn hình đen mà không hiểu chuyện gì. Cái đáng sợ ở đây không
 * phải video hỏng — mà là video KHÔNG BAO GIỜ trả lời: không `playing`, không
 * `error`, chỉ im lặng.
 */
const BAT_DAU_TOI_DA = 6000;

/**
 * Trần tuyệt đối cho cả tấm màn, kể cả khi cảnh chưa dựng xong.
 *
 * Lối thoát cuối. Một tấm màn không mở ra được là cách khoá học sinh ngoài màn
 * chơi bằng chính thứ đáng ra làm nó mượt hơn — nên dù có hỏng thế nào, sau
 * ngần này là đi tiếp.
 */
const TONG_TOI_DA = 25000;

/**
 * VIDEO MỞ MÀN — tấm màn che đúng lúc màn chơi đang nạp.
 *
 * Không phải một đoạn phim gắn thêm vào game. Gói Phaser gần một megabyte, ảnh
 * nền có khi là video, spritesheet nhân vật bốn hướng: khoảng chờ đó có thật và
 * không bỏ đi được. Thứ bỏ đi được là **cái màn hình trống trong lúc chờ**.
 *
 * Nên trong khi đoạn này chạy ở trên, cảnh Phaser đang dựng Ở DƯỚI. Cửa mở khi
 * CẢ HAI xong: video hết VÀ `ready`. Video hết trước thì đứng ở khung hình cuối
 * và hiện một dòng chờ; cảnh xong trước thì im lặng đợi video — đó chính là
 * trường hợp mong muốn, và là lý do 5–10 giây là con số đúng.
 *
 * ## Ba đường thoát, vì một tấm màn kẹt là tệ hơn không có màn
 *
 * 1. **Nút Bỏ qua**, hiện suốt. Chơi lại lần thứ năm không phải xem lại lần thứ
 *    năm. Bỏ qua sớm mà cảnh chưa xong thì rơi về đúng màn hình chờ như trước
 *    khi có tính năng này — không tệ hơn hiện trạng, chỉ là không tốt hơn.
 * 2. **`onError`** — tệp hỏng hay 404 thì đi tiếp ngay.
 * 3. **Hai cái hẹn giờ**, cho trường hợp tệ hơn cả hỏng: tệp không bao giờ trả
 *    lời. `onError` không bắn, `ended` không bắn, và không có hẹn giờ thì học
 *    sinh ngồi trước một màn hình đen vĩnh viễn.
 *
 * ## Tiếng: thử bật, hỏng thì tắt tiếng và hiện nút
 *
 * Trình duyệt chỉ cho tự phát khi đã tắt tiếng, và cú bấm vào màn ở trang TRƯỚC
 * không tính cho trang này — quyền tự phát gắn với từng document. Nên: thử phát
 * có tiếng; bị từ chối thì tắt tiếng, phát lại, và hiện một nút 🔊.
 *
 * Không bao giờ có một đoạn phim câm không giải thích được. Cùng luật với
 * `CompactAudio`: cú `play()` bị từ chối luôn phải để lại một cái nút bấm được.
 */
export function StageIntro({
  src,
  ready,
  onDone,
}: {
  src: string;
  /** Cảnh Phaser đã dựng xong và nạp xong mọi tài sản (`STAGE_READY`). */
  ready: boolean;
  /** Kéo màn ra. Gọi đúng một lần — chỗ gọi gỡ hẳn component này. */
  onDone: () => void;
}) {
  const t = useTranslations('game.intro');
  const video = useRef<HTMLVideoElement>(null);

  const [xong, setXong] = useState(false);
  const [tatTieng, setTatTieng] = useState(false);

  // Cửa mở khi CẢ HAI xong. `onDone` giữ trong ref để effect này chỉ phụ thuộc
  // vào hai cái cờ — chỗ gọi truyền một hàm mới mỗi lần vẽ là chuyện thường, và
  // để nó vào mảng phụ thuộc thì effect chạy lại liên tục.
  const thoat = useRef(onDone);
  thoat.current = onDone;

  useEffect(() => {
    if (xong && ready) thoat.current();
  }, [xong, ready]);

  // Thử phát CÓ TIẾNG trước. Xem ghi chú đầu file.
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    void el.play().catch(() => {
      el.muted = true;
      setTatTieng(true);
      // Câm rồi mà vẫn bị từ chối thì không còn gì để thử. Đi tiếp.
      void el.play().catch(() => setXong(true));
    });
  }, [src]);

  // Hai cái hẹn giờ — lối thoát cho trường hợp tệp không bao giờ trả lời.
  useEffect(() => {
    const batDau = window.setTimeout(() => {
      // Đã chạy được rồi thì thôi: `ended` sẽ lo phần còn lại.
      if (video.current && !video.current.paused && video.current.currentTime > 0) return;
      setXong(true);
    }, BAT_DAU_TOI_DA);

    // Trần tuyệt đối: `onDone` thẳng, KHÔNG qua `setXong` — vì `setXong` còn
    // phải đợi `ready`, mà nhánh hỏng này là nhánh `ready` có thể không tới.
    const tong = window.setTimeout(() => thoat.current(), TONG_TOI_DA);

    return () => {
      window.clearTimeout(batDau);
      window.clearTimeout(tong);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black">
      <video
        ref={video}
        src={src}
        // `object-contain`: KHÔNG cắt cúp cái người dựng vừa tải lên. Tỉ lệ
        // khung hình của họ có thể là bất cứ gì, và một đoạn mở màn bị cắt mất
        // nửa dòng chữ thì thà để hai dải đen hai bên.
        className="size-full object-contain"
        playsInline
        preload="auto"
        aria-label={t('label')}
        onEnded={() => setXong(true)}
        // Hỏng thì đi tiếp NGAY, không đợi `ready`: tấm màn đã không còn che
        // được gì nữa, giữ nó lại chỉ là một màn hình đen thừa.
        onError={() => thoat.current()}
      />

      {/* Hàng nút dưới cùng bên phải — xa tầm mắt lúc đang xem, nhưng luôn ở
          đúng chỗ tay tìm tới khi muốn thoát. */}
      <div className="absolute right-4 bottom-4 flex items-center gap-2">
        {tatTieng && (
          <button
            type="button"
            onClick={() => {
              const el = video.current;
              if (!el) return;
              el.muted = false;
              setTatTieng(false);
              void el.play().catch(() => undefined);
            }}
            className="rounded-full border border-white/25 bg-black/50 px-3 py-1.5 text-xs text-white/85 backdrop-blur transition hover:bg-black/70 hover:text-white"
          >
            {t('unmute')}
          </button>
        )}

        <button
          type="button"
          onClick={() => thoat.current()}
          className="rounded-full border border-white/25 bg-black/50 px-3 py-1.5 text-xs text-white/85 backdrop-blur transition hover:bg-black/70 hover:text-white"
        >
          {t('skip')}
        </button>
      </div>

      {/* Video hết mà cảnh chưa xong: nói ra. Một khung hình đứng im không kèm
          lời nào thì người xem tưởng máy treo, và bấm loạn. */}
      {xong && !ready && (
        <p className="absolute bottom-4 left-4 text-xs text-white/60">{t('loading')}</p>
      )}
    </div>
  );
}

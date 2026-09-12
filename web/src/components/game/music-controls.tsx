'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  DEFAULT_MUSIC_PREFS,
  MUSIC_PREFS_EVENT,
  readMusicPrefs,
  writeMusicPrefs,
  type MusicPrefs,
} from '@/game/music-prefs';

/**
 * Đọc tuỳ chọn nhạc và theo dõi mọi thay đổi.
 *
 * Bắt đầu bằng MẶC ĐỊNH rồi mới đọc `localStorage` trong `useEffect`, không đọc
 * thẳng lúc dựng: trang này render sẵn ở server, nơi không có `localStorage`.
 * Đọc thẳng thì lần vẽ đầu ở server và lần vẽ đầu ở trình duyệt ra hai kết quả
 * khác nhau, và React kêu lỗi hydrate.
 *
 * Nghe hai nguồn: `MUSIC_PREFS_EVENT` cho các thành phần trong CÙNG một tab, và
 * `storage` cho các tab khác — học sinh mở hai tab thì vặn nhỏ ở tab này, tab
 * kia cũng nhỏ theo.
 */
export function useMusicPrefs(): [MusicPrefs, (next: MusicPrefs) => void] {
  const [prefs, setPrefs] = useState<MusicPrefs>(DEFAULT_MUSIC_PREFS);

  useEffect(() => {
    setPrefs(readMusicPrefs());

    const onLocal = (event: Event) => setPrefs((event as CustomEvent<MusicPrefs>).detail);
    const onOtherTab = () => setPrefs(readMusicPrefs());

    window.addEventListener(MUSIC_PREFS_EVENT, onLocal);
    window.addEventListener('storage', onOtherTab);
    return () => {
      window.removeEventListener(MUSIC_PREFS_EVENT, onLocal);
      window.removeEventListener('storage', onOtherTab);
    };
  }, []);

  const update = useCallback((next: MusicPrefs) => {
    // KHÔNG `setPrefs` ở đây: `writeMusicPrefs` phát sự kiện, và chính component
    // này đang nghe sự kiện đó. Đặt cả hai là đặt state hai lần cho một thay
    // đổi, và hai đường cập nhật thì sớm muộn cũng lệch nhau.
    writeMusicPrefs(next);
  }, []);

  return [prefs, update];
}

/**
 * Tiêu điểm này có phải do BÀN PHÍM đưa tới không.
 *
 * `:focus-visible` là câu trả lời sẵn có của trình duyệt cho đúng câu hỏi đó:
 * bấm chuột vào một cái nút thì nút VẪN nhận tiêu điểm, nhưng không khớp
 * `:focus-visible`. Phân biệt được hai thứ này là mấu chốt — xem `MusicControls`.
 */
function laTieuDiemBanPhim(el: EventTarget | null): boolean {
  try {
    return el instanceof Element && el.matches(':focus-visible');
  } catch {
    // Trình duyệt quá cũ, không hiểu bộ chọn. Coi như bàn phím: thà mở nhầm còn
    // hơn khoá người dùng bàn phím ra ngoài thanh trượt.
    return true;
  }
}

/**
 * Nút bật/tắt nhạc và thanh âm lượng, dùng chung cho mọi màn của học sinh.
 *
 * Thanh trượt NẤP ĐI cho tới khi rê chuột vào — một thanh trượt luôn hiện trên
 * bản đồ là một thứ chắn tầm nhìn suốt cả buổi để phục vụ một thao tác làm một
 * lần.
 *
 * ## Ba lý do khiến nó mở, và chỉ ba
 *
 * Bản trước để nó mở khi `open || !prefs.on`, cộng thêm `group-focus-within`
 * trong CSS. Cả hai đều làm nó kẹt mở sau khi bấm nút loa:
 *
 * - `!prefs.on` — tắt nhạc xong là thanh trượt hiện MÃI MÃI, vì tuỳ chọn có
 *   quay lại `true` đâu mà đóng.
 * - `group-focus-within` — bấm chuột vào cái nút CŨNG đặt tiêu điểm lên nó. Rê
 *   chuột ra thì `hover` mất, nhưng tiêu điểm vẫn nằm trong cụm, nên CSS giữ
 *   nguyên trạng thái mở cho tới khi người ta bấm đi chỗ khác.
 *
 * Giờ đúng ba điều kiện, và không điều kiện nào tồn tại sau khi việc xong:
 *
 * 1. `hover` — con trỏ đang ở trong cụm.
 * 2. `tieuDiemBanPhim` — người dùng Tab tới, nên chuột không có tiếng nói.
 *    Dùng `:focus-visible` chứ không dùng `:focus`, nên cú bấm chuột không tính.
 * 3. `dangKeo` — đang giữ chuột trên thanh trượt. Kéo mạnh tay ra khỏi cụm là
 *    `pointerleave` bắn ngay giữa chừng; không có điều kiện này thì thanh trượt
 *    co lại NGAY TRONG TAY người đang kéo nó.
 *
 * ## Thanh trượt LUÔN nằm trong luồng Tab
 *
 * Trông thì có vẻ nên gỡ nó ra khỏi luồng Tab lúc đang ẩn — Tab vào một thứ
 * không nhìn thấy là một cái bẫy. Nhưng `tabIndex={open ? 0 : -1}` tự cắn chính
 * nó: cú Tab rời cái nút cũng chính là cú `blur` đóng cụm lại, nên thanh trượt
 * mất tính bấm-tới ĐÚNG VÀO LÚC tiêu điểm định bước vào. Đo được: tiêu điểm
 * nhảy thẳng ra khỏi trang, `document.activeElement` thành `body`.
 *
 * Để nguyên trong luồng Tab thì không có bẫy nào cả, vì `onFocus` mở cụm ra:
 * thanh trượt không bao giờ vừa-được-focus vừa-vô-hình.
 */
export function MusicControls({ className = '' }: { className?: string }) {
  const t = useTranslations('game.music');
  const [prefs, setPrefs] = useMusicPrefs();

  const [hover, setHover] = useState(false);
  const [tieuDiemBanPhim, setTieuDiemBanPhim] = useState(false);
  const [dangKeo, setDangKeo] = useState(false);
  const open = hover || tieuDiemBanPhim || dangKeo;

  // Kết thúc cú kéo nghe ở WINDOW, không ở thanh trượt: nhả chuột ngoài cụm thì
  // thanh trượt chẳng bao giờ thấy `pointerup`, và cụm sẽ kẹt mở vĩnh viễn.
  useEffect(() => {
    if (!dangKeo) return;
    const xong = () => setDangKeo(false);
    window.addEventListener('pointerup', xong);
    window.addEventListener('pointercancel', xong);
    return () => {
      window.removeEventListener('pointerup', xong);
      window.removeEventListener('pointercancel', xong);
    };
  }, [dangKeo]);

  return (
    <div
      // Rê vào thì viền sáng lên theo, không chỉ nền đậm thêm: cụm này đứng
      // cạnh mấy nút tròn khác trong HUD, và nếu chỉ đổi nền thì rê trúng cái
      // nào cũng trông gần như nhau.
      className={`flex items-center gap-1 rounded-full border border-white/25 bg-black/45 px-1 py-1 backdrop-blur transition hover:border-lagoon-400 hover:bg-black/70 ${className}`}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={(event) => {
        if (laTieuDiemBanPhim(event.target)) setTieuDiemBanPhim(true);
      }}
      onBlur={(event) => {
        // Chỉ đóng khi tiêu điểm rời HẲN cụm này, không phải khi nó nhảy từ nút
        // sang thanh trượt bên trong.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setTieuDiemBanPhim(false);
        }
      }}
    >
      <button
        type="button"
        aria-pressed={prefs.on}
        title={prefs.on ? t('mute') : t('unmute')}
        onClick={() => setPrefs({ ...prefs, on: !prefs.on })}
        className="rounded-full px-2 py-0.5 text-sm text-white/85 transition hover:text-white"
      >
        <span aria-hidden>{prefs.on ? '🔊' : '🔇'}</span>
        <span className="sr-only">{prefs.on ? t('mute') : t('unmute')}</span>
      </button>

      <label
        className={`flex items-center overflow-hidden transition-[width,opacity] ${
          open ? 'w-24 opacity-100' : 'w-0 opacity-0'
        }`}
      >
        <span className="sr-only">{t('volume')}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(prefs.master * 100)}
          // `onChange` là đủ ở đây, không cần tách xem-trước/ghi-xuống như bảng
          // của giáo viên: chỗ này ghi vào `localStorage`, không gọi server.
          onChange={(event) =>
            setPrefs({ ...prefs, master: Number(event.currentTarget.value) / 100 })
          }
          onPointerDown={() => setDangKeo(true)}
          className="w-20 accent-lagoon-400"
        />
      </label>
    </div>
  );
}

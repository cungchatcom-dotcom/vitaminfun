'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

/** `95` → `"1:35"`. `NaN`/`Infinity` (chưa biết độ dài) → `"--:--"`. */
function dongHo(giay: number): string {
  if (!Number.isFinite(giay) || giay < 0) return '--:--';
  const phut = Math.floor(giay / 60);
  const le = Math.floor(giay % 60);
  return `${phut}:${le.toString().padStart(2, '0')}`;
}

/**
 * Trình phát âm thanh GỌN: một cái nút, và thanh tua chỉ hiện khi rê chuột vào.
 *
 * Thay cho `<audio controls>` của trình duyệt. Cái điều khiển mặc định cao gần
 * 54px, rộng hết khung, mang màu nền sáng của hệ điều hành và không nhận một
 * chút nào của giao diện xung quanh — đặt vào một tấm bảng tối giữa cảnh biển
 * thì nó là thứ đập vào mắt trước cả lời NPC.
 *
 * ## Ba điều kiện mở, y hệt `MusicControls`
 *
 * Không phải trùng hợp: đây cùng một bài toán — một thanh trượt nấp đi cho tới
 * khi cần. Ba điều kiện đó, và không cái nào còn tồn tại sau khi việc xong:
 *
 * 1. `hover` — con trỏ đang ở trong cụm.
 * 2. `tieuDiemBanPhim` — người dùng Tab tới. Dùng `:focus-visible` nên cú bấm
 *    chuột KHÔNG tính; nếu tính thì bấm nút phát xong là thanh tua kẹt mở.
 * 3. `dangKeo` — đang giữ chuột trên thanh tua. Kéo mạnh tay ra khỏi cụm là
 *    `pointerleave` bắn giữa chừng, và không có điều kiện này thì thanh tua co
 *    lại NGAY TRONG TAY người đang kéo nó.
 *
 * ## Vì sao nút là ▶/⏸ chứ không phải cái loa
 *
 * Đoạn tiếng này TỰ PHÁT. Một biểu tượng loa đứng im không nói được nó đang
 * chạy hay đã xong, mà đó lại là câu hỏi đầu tiên của người nghe. Hình ▶/⏸ vừa
 * là trạng thái vừa là chỗ bấm — một thứ, hai việc, không có gì để hiểu nhầm.
 */
export function CompactAudio({
  src,
  autoPlay = false,
  className = '',
}: {
  src: string;
  autoPlay?: boolean;
  className?: string;
}) {
  const t = useTranslations('question.player');
  const audio = useRef<HTMLAudioElement>(null);

  const [dangChay, setDangChay] = useState(false);
  const [tai, setTai] = useState(0);
  const [dai, setDai] = useState(Number.NaN);

  const [hover, setHover] = useState(false);
  const [tieuDiemBanPhim, setTieuDiemBanPhim] = useState(false);
  const [dangKeo, setDangKeo] = useState(false);
  const open = hover || tieuDiemBanPhim || dangKeo;

  // Đang kéo thì KHÔNG cho `timeupdate` ghi đè vị trí: thẻ audio vẫn phát và
  // vẫn bắn sự kiện trong lúc ngón tay đang ở trên thanh, và hai nguồn cùng ghi
  // một con số thì cái đầu trượt giật ngược lại dưới tay người kéo.
  const keo = useRef(false);
  keo.current = dangKeo;

  useEffect(() => {
    const el = audio.current;
    if (!el) return;

    const nhip = () => {
      if (!keo.current) setTai(el.currentTime);
    };
    const doDai = () => setDai(el.duration);
    const chay = () => setDangChay(true);
    const dung = () => setDangChay(false);

    el.addEventListener('timeupdate', nhip);
    el.addEventListener('loadedmetadata', doDai);
    el.addEventListener('durationchange', doDai);
    el.addEventListener('play', chay);
    el.addEventListener('pause', dung);
    el.addEventListener('ended', dung);
    return () => {
      el.removeEventListener('timeupdate', nhip);
      el.removeEventListener('loadedmetadata', doDai);
      el.removeEventListener('durationchange', doDai);
      el.removeEventListener('play', chay);
      el.removeEventListener('pause', dung);
      el.removeEventListener('ended', dung);
    };
  }, [src]);

  // Đổi đoạn tiếng là về đầu. Thẻ audio được DÙNG LẠI khi sang câu kế tiếp
  // (React giữ nguyên DOM, chỉ đổi `src`), nên không có dòng này thì con số
  // thời gian của câu trước còn nằm lại một nhịp.
  useEffect(() => {
    setTai(0);
    setDai(Number.NaN);
  }, [src]);

  useEffect(() => {
    const el = audio.current;
    if (!el || !autoPlay) return;
    // `catch` rỗng có chủ ý: bị trình duyệt từ chối thì cái nút ▶ vẫn nằm đó và
    // bấm một cái là chạy. Một dòng báo lỗi ở đây chỉ làm người nghe lo về một
    // thứ họ sửa được bằng cú bấm tiếp theo.
    void el.play().catch(() => undefined);
  }, [autoPlay, src]);

  function batTat() {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  }

  function tuaToi(giay: number) {
    const el = audio.current;
    setTai(giay);
    if (el) el.currentTime = giay;
  }

  const biet = Number.isFinite(dai) && dai > 0;

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/30 px-1 py-1 transition hover:bg-black/45 ${className}`}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={(event) => {
        // `:focus-visible` = tiêu điểm do BÀN PHÍM đưa tới. Bấm chuột cũng đặt
        // tiêu điểm lên nút, nhưng không khớp bộ chọn này — nhờ vậy bấm ▶ xong
        // rê chuột ra là cụm thu lại, thay vì kẹt mở tới lúc bấm chỗ khác.
        try {
          if ((event.target as Element).matches(':focus-visible')) setTieuDiemBanPhim(true);
        } catch {
          setTieuDiemBanPhim(true);
        }
      }}
      onBlur={(event) => {
        // Chỉ đóng khi tiêu điểm rời HẲN cụm, không phải khi nó nhảy từ nút
        // sang thanh tua bên trong.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setTieuDiemBanPhim(false);
        }
      }}
    >
      {/* Thẻ thật, KHÔNG `controls`. Vẫn nằm trong DOM vì nó mới là thứ phát
          tiếng — mọi thứ nhìn thấy ở trên chỉ là vỏ. */}
      <audio ref={audio} src={src} preload="metadata" className="hidden" />

      <button
        type="button"
        onClick={batTat}
        aria-label={dangChay ? t('pause') : t('play')}
        title={dangChay ? t('pause') : t('play')}
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-sm text-white/85 transition hover:bg-white/10 hover:text-white"
      >
        <span aria-hidden>{dangChay ? '❚❚' : '▶'}</span>
      </button>

      {/* Thanh tua + đồng hồ: nấp đi cho tới khi cần. `overflow-hidden` cộng
          `w-0` thay vì `hidden` để nó TRƯỢT ra chứ không nhảy ra, và để nó vẫn
          nằm trong luồng Tab lúc đang ẩn — xem ghi chú ở `MusicControls`: gỡ
          khỏi luồng Tab thì cú Tab định bước vào lại chính là cú làm nó biến mất. */}
      <div
        className={`flex items-center gap-1.5 overflow-hidden transition-[width,opacity] duration-200 ${
          open ? 'w-40 opacity-100' : 'w-0 opacity-0'
        }`}
      >
        <input
          type="range"
          min={0}
          max={biet ? dai : 0}
          step={0.1}
          value={Math.min(tai, biet ? dai : 0)}
          // Chưa biết độ dài thì không tua được — kéo trên một thang 0..0 chỉ
          // làm người dùng tưởng mình vừa tua về đầu.
          disabled={!biet}
          aria-label={t('seek')}
          onChange={(event) => tuaToi(Number(event.currentTarget.value))}
          onPointerDown={() => setDangKeo(true)}
          // Nhả chuột nghe ở chính thanh: khác `MusicControls` ở chỗ cụm này
          // không cần giữ mở sau khi nhả, nên `window` là thừa. Nhưng vẫn phải
          // có `pointercancel` — kéo rồi cuộn trang trên điện thoại thì trình
          // duyệt huỷ cú chạm mà không bao giờ bắn `pointerup`.
          onPointerUp={() => setDangKeo(false)}
          onPointerCancel={() => setDangKeo(false)}
          className="h-1 w-24 flex-1 accent-lagoon-400"
        />
        <span className="shrink-0 font-mono text-[10px] whitespace-nowrap text-white/70">
          {dongHo(tai)} / {dongHo(dai)}
        </span>
      </div>
    </div>
  );
}

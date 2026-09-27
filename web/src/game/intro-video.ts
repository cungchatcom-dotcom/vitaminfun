/**
 * THẺ VIDEO MỞ MÀN DÙNG CHUNG — mở khoá sẵn bằng cú chạm của người chơi.
 *
 * iOS cho một thẻ `<video>` phát CÓ TIẾNG chỉ khi CHÍNH THẺ ĐÓ từng được gọi
 * `play()` bên trong một cú chạm. Video mở màn thì luôn sinh ra MUỘN: bấm
 * "Chơi lại" → gọi server → server trả lời → lúc đó mới dựng `StageIntro`. Một
 * thẻ mới toanh lúc ấy không còn cú chạm nào để dựa, và iOS bắt nó câm.
 *
 * Nên chỉ có MỘT thẻ, sống suốt phiên. Cú chạm/bấm nào của người chơi (khi thẻ
 * đang rảnh) cũng phát thử một đoạn im lặng ngắn trên nó — người chơi không
 * nghe gì, nhưng từ đó thẻ đã "được phép". `StageIntro` mượn đúng thẻ này để
 * chiếu, rồi trả lại.
 *
 * Nạp module là tự gắn trình nghe; module này được import ở phòng chờ và màn
 * chơi — hai nơi có nút dẫn vào video mở màn.
 */

let the: HTMLVideoElement | null = null;
let busy = false;
let unlocked = false;
let silence: string | null = null;

/** Một tệp WAV im lặng 0,02 giây, dựng tại chỗ — không cần tải gì. */
function silentWav(): string {
  if (silence) return silence;
  const samples = 160;
  const rate = 8000;
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  text(0, 'RIFF');
  v.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, 'data');
  v.setUint32(40, samples * 2, true);
  silence = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  return silence;
}

function element(): HTMLVideoElement {
  if (!the) {
    the = document.createElement('video');
    the.playsInline = true;
    the.setAttribute('playsinline', '');
    the.preload = 'auto';
  }
  return the;
}

/** Chạy NGAY trong trình xử lý cú chạm — Safari chỉ tính `play()` gọi đồng bộ. */
function prime() {
  if (unlocked || busy) return;
  const el = element();
  el.muted = false;
  el.src = silentWav();
  void el.play().then(
    () => {
      // Có thể `StageIntro` đã mượn thẻ trong lúc chờ — đừng dừng hộ nó.
      if (busy) return;
      el.pause();
      unlocked = true;
    },
    () => undefined,
  );
}

if (typeof window !== 'undefined') {
  for (const type of ['touchend', 'click', 'keydown'] as const) {
    window.addEventListener(type, prime, true);
  }
}

/** Mượn thẻ để chiếu. Trả lại bằng `releaseIntroVideo`. */
export function borrowIntroVideo(): HTMLVideoElement {
  busy = true;
  return element();
}

export function releaseIntroVideo(el: HTMLVideoElement) {
  el.pause();
  el.removeAttribute('src');
  el.load();
  el.remove();
  busy = false;
}

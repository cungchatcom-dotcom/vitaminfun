/**
 * MỘT `AudioContext` DÙNG CHUNG cho mọi cảnh Phaser trong phiên.
 *
 * iOS bắt mỗi `AudioContext` mới sinh ra ở trạng thái `suspended` và chỉ cho
 * `resume()` bên trong một cú chạm. Mỗi lần "Chơi lại" là một game Phaser mới;
 * để Phaser tự tạo ngữ cảnh là mỗi lượt lại câm tới cú chạm đầu tiên — nhạc
 * nền vắng mặt đúng lúc lượt mới bắt đầu.
 *
 * Một ngữ cảnh duy nhất, mở khoá bằng cú chạm bất kỳ (kể cả ở phòng chờ, trước
 * khi vào màn): iOS nhớ ngữ cảnh đã được phép, nên các game sau `resume()` lại
 * được mà không cần chạm nữa. Phaser nhận nó qua `audio.context` và khi huỷ thì
 * chỉ `suspend()` chứ không `close()`.
 *
 * Nạp module là tự gắn trình nghe — import ở phòng chờ và ở `phaser-canvas`.
 */

let ctx: AudioContext | null = null;

type AudioContextCtor = typeof AudioContext;

function create(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    (window as unknown as { AudioContext?: AudioContextCtor }).AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

export function sharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  return create();
}

/** Chạy NGAY trong cú chạm — iOS chỉ tính `resume()` gọi đồng bộ trong cử chỉ. */
function wake() {
  const c = create();
  if (c && c.state !== 'running') void c.resume().catch(() => undefined);
}

if (typeof window !== 'undefined') {
  for (const type of ['touchend', 'pointerup', 'click', 'keydown'] as const) {
    window.addEventListener(type, wake, true);
  }
}

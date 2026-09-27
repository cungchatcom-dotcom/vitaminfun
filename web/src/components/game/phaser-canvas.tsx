'use client';

import { useEffect, useRef } from 'react';

import { StageScene, type StageSceneData } from '@/game/scenes/StageScene';

import { sharedAudioContext } from '@/game/shared-audio';

import { useMusicPrefs } from './music-controls';

/** Những cú chạm iOS coi là "người dùng cho phép phát tiếng". */
const WAKE_EVENTS = ['touchend', 'pointerup', 'click', 'keydown'] as const;

/**
 * Ranh giới React ↔ Phaser.
 *
 * React dựng một thẻ `<div>` rồi giao hẳn cho Phaser; từ đó trở đi React KHÔNG
 * đụng vào bên trong nữa. Hai bên nói chuyện qua `EventBus`.
 *
 * Component này phải nạp bằng `dynamic(ssr: false)` — Phaser cần `window` ngay
 * lúc import, nên chạy nó lúc render phía server là vỡ.
 */
export function PhaserCanvas({
  sceneData,
  typing,
  locked,
  ducked,
}: {
  sceneData: StageSceneData;
  /** True khi con trỏ đang ở trong ô nhập — cảnh phải ngừng nhận phím WASD. */
  typing: boolean;
  /** True khi bảng câu hỏi đang mở — cảnh ngừng nhận CẢ chuột lẫn bàn phím. */
  locked: boolean;
  /**
   * True khi bảng đang mở CÓ TIẾNG — cảnh hạ mọi tiếng của mình xuống.
   *
   * Tách khỏi `locked`, dù hai cờ thường bật cùng lúc: `locked` bật với MỌI
   * bảng, còn cái này chỉ bật khi có gì để nghe. Gộp làm một thì mở một câu
   * trắc nghiệm chữ cũng làm nhạc nền tụt xuống mà không ai hiểu vì sao.
   */
  ducked: boolean;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const scene = useRef<StageScene | null>(null);

  // Dữ liệu cảnh giữ trong ref: đổi nó KHÔNG được dựng lại cả game. Đặt nó vào
  // mảng phụ thuộc của useEffect là mỗi lần nộp bài lại nạp lại toàn bộ Phaser.
  const latest = useRef(sceneData);
  latest.current = sceneData;

  // Ba cờ này cũng giữ trong ref: Phaser nạp bất đồng bộ, nên chúng có thể đổi
  // TRƯỚC khi cảnh tồn tại. Chỉ đặt trong `useEffect` thì lần đổi đầu tiên rơi
  // vào khoảng trống đó và mất hẳn.
  const flags = useRef({ typing, locked, ducked });
  flags.current = { typing, locked, ducked };

  // Tuỳ chọn nhạc của người chơi, dùng chung với bản đồ thiên hà và phòng chờ:
  // tắt ở đó thì vào đây vẫn tắt. Cũng giữ trong ref, cùng lý do với hai cờ
  // trên — nó có thể đổi trước khi cảnh kịp tồn tại.
  const [music] = useMusicPrefs();
  const musicRef = useRef(music);
  musicRef.current = music;

  useEffect(() => {
    if (!holder.current || game.current) return;

    let cancelled = false;
    let observer: ResizeObserver | null = null;
    let unwake: (() => void) | null = null;

    // import động: Phaser đụng `window` ngay lúc nạp module.
    void import('phaser').then((PhaserModule) => {
      if (cancelled || !holder.current) return;
      const Phaser = PhaserModule.default;

      // Màn hình mật độ cao (điện thoại DPR 2–3): canvas phải có ĐỦ điểm ảnh
      // thật, không thì trình duyệt phóng một canvas cỡ CSS lên gấp 2–3 lần và
      // chữ nhòe hẳn. RESIZE của Phaser bỏ qua `zoom`, nên ở đây tự đo khung:
      // game rộng CSS×dpr, `zoom = 1/dpr` thu thẻ canvas về đúng cỡ CSS.
      // DPR 1 (máy bàn) đi đường cũ y nguyên.
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const sharp = dpr > 1;
      const box = holder.current;
      const scale = sharp
        ? {
            mode: Phaser.Scale.NONE,
            width: Math.max(1, Math.round(box.clientWidth * dpr)),
            height: Math.max(1, Math.round(box.clientHeight * dpr)),
            zoom: 1 / dpr,
            autoCenter: Phaser.Scale.CENTER_BOTH,
          }
        : {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH,
          };

      const instance = new Phaser.Game({
        type: Phaser.AUTO,
        parent: holder.current,
        backgroundColor: '#04121f',
        scale,
        // Ngữ cảnh âm thanh DÙNG CHUNG giữa các lượt — xem `game/shared-audio`.
        // Để Phaser tự tạo thì mỗi lần Chơi lại là một ngữ cảnh mới, và iOS bắt
        // nó câm tới cú chạm đầu tiên.
        audio: { context: sharedAudioContext() ?? undefined },
        // Không dùng physics: di chuyển là tween và kiểm tra đa giác bằng tay.
        // Bật Arcade chỉ để đó là thêm một vòng lặp chạy mỗi khung hình.
        scene: [StageScene],
        callbacks: {
          // Chỉ ở ĐÂY mới cầm được cảnh.
          //
          // `scene.getScene()` gọi ngay sau `new Phaser.Game()` trả về `null`:
          // Phaser dựng cảnh trong bước boot, xảy ra sau. Bản trước tôi gọi thẳng
          // `scene.current.setTypingGuard(...)` ở đó và nó ném TypeError mỗi lần
          // vào màn — lỗi lọt vào `.then()` nên thành unhandled rejection, cảnh
          // vẫn chạy, và tôi không thấy gì cho tới khi mở console.
          postBoot: (booted) => {
            const ready = booted.scene.getScene(StageScene.KEY) as unknown as StageScene | null;
            if (!ready) return;
            scene.current = ready;
            // Bắt kịp trạng thái hiện tại: nó có thể đã đổi lúc Phaser còn nạp.
            ready.setTypingGuard(flags.current.typing);
            ready.setInputLocked(flags.current.locked);
            ready.setMusicDucked(flags.current.ducked);
            ready.setMusicPrefs(musicRef.current);
          },
        },
      });

      game.current = instance;
      instance.scene.start(StageScene.KEY, latest.current);

      // Tiếng trên điện thoại. Hai cái bẫy của iOS:
      //
      // 1. Công tắc im lặng tắt Web Audio (Phaser dùng) nhưng KHÔNG tắt thẻ
      //    `<audio>` (phòng chờ dùng) — nên phòng chờ có nhạc, vào màn thì câm.
      //    `audioSession.type = 'playback'` (Safari 16.4+) xếp trang vào loại
      //    "phát nhạc" như thẻ `<audio>`.
      // 2. Phaser mở khoá ngay ở `touchstart`; iOS chưa coi đó là cú chạm hợp
      //    lệ, `resume()` hỏng, và Phaser gỡ LUÔN mọi trình nghe — không bao giờ
      //    thử lại. Ở đây thử lại ở mỗi cú chạm tới khi ngữ cảnh chạy thật.
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      try {
        if (nav.audioSession) nav.audioSession.type = 'playback';
      } catch {
        // Trình duyệt không cho đặt — bỏ qua, vẫn còn bước 2.
      }
      const sound = instance.sound as unknown as {
        locked: boolean;
        context?: AudioContext;
        unlocked: boolean;
      };
      const wake = () => {
        const ctx = sound.context;
        if (!ctx) return;
        if (ctx.state === 'running') {
          if (sound.locked) sound.unlocked = true;
          return;
        }
        void ctx.resume().then(
          () => {
            if (sound.locked) sound.unlocked = true;
          },
          () => undefined,
        );
      };
      for (const type of WAKE_EVENTS) window.addEventListener(type, wake, true);
      // Thử NGAY một lần, không đợi chạm: ngữ cảnh dùng chung đã được mở khoá
      // ở lượt trước (hay ở phòng chờ) thì `resume()` lúc này được chấp nhận,
      // và nhạc nền vào luôn cùng lượt mới.
      wake();
      unwake = () => {
        for (const type of WAKE_EVENTS) window.removeEventListener(type, wake, true);
      };

      if (sharp) {
        // Chế độ NONE không tự theo khung cha — đo lại mỗi khi khung đổi cỡ.
        observer = new ResizeObserver(() => {
          const w = Math.max(1, Math.round(box.clientWidth * dpr));
          const h = Math.max(1, Math.round(box.clientHeight * dpr));
          if (w !== instance.scale.width || h !== instance.scale.height) {
            instance.scale.resize(w, h);
          }
        });
        observer.observe(box);
      }
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      unwake?.();
      // `true` = phá luôn thẻ canvas. Không dọn thì rời màn rồi quay lại là có
      // hai vòng lặp game cùng chạy, và cái cũ vẫn nghe EventBus.
      game.current?.destroy(true);
      game.current = null;
      scene.current = null;
    };
  }, []);

  // Báo xuống cảnh khi người dùng đang gõ. Cảnh không tự đọc `document` nữa.
  useEffect(() => {
    scene.current?.setTypingGuard(typing);
  }, [typing]);

  // Bảng câu hỏi mở/đóng — khoá hoặc mở lại việc di chuyển.
  useEffect(() => {
    scene.current?.setInputLocked(locked);
  }, [locked]);

  // Bảng có tiếng mở/đóng — hạ tiếng của màn xuống rồi trả lại.
  useEffect(() => {
    scene.current?.setMusicDucked(ducked);
  }, [ducked]);

  // Người chơi bật/tắt nhạc hoặc kéo âm lượng — kể cả ở một tab khác.
  useEffect(() => {
    scene.current?.setMusicPrefs(music);
  }, [music]);

  return <div ref={holder} className="size-full" aria-hidden />;
}

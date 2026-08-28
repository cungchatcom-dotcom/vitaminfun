'use client';

import { useEffect, useRef } from 'react';

import { StageScene, type StageSceneData } from '@/game/scenes/StageScene';

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
}: {
  sceneData: StageSceneData;
  /** True khi con trỏ đang ở trong ô nhập — cảnh phải ngừng nhận phím WASD. */
  typing: boolean;
  /** True khi bảng câu hỏi đang mở — cảnh ngừng nhận CẢ chuột lẫn bàn phím. */
  locked: boolean;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const scene = useRef<StageScene | null>(null);

  // Dữ liệu cảnh giữ trong ref: đổi nó KHÔNG được dựng lại cả game. Đặt nó vào
  // mảng phụ thuộc của useEffect là mỗi lần nộp bài lại nạp lại toàn bộ Phaser.
  const latest = useRef(sceneData);
  latest.current = sceneData;

  // Hai cờ này cũng giữ trong ref: Phaser nạp bất đồng bộ, nên chúng có thể đổi
  // TRƯỚC khi cảnh tồn tại. Chỉ đặt trong `useEffect` thì lần đổi đầu tiên rơi
  // vào khoảng trống đó và mất hẳn.
  const flags = useRef({ typing, locked });
  flags.current = { typing, locked };

  useEffect(() => {
    if (!holder.current || game.current) return;

    let cancelled = false;

    // import động: Phaser đụng `window` ngay lúc nạp module.
    void import('phaser').then((PhaserModule) => {
      if (cancelled || !holder.current) return;
      const Phaser = PhaserModule.default;

      const instance = new Phaser.Game({
        type: Phaser.AUTO,
        parent: holder.current,
        backgroundColor: '#04121f',
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
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
          },
        },
      });

      game.current = instance;
      instance.scene.start(StageScene.KEY, latest.current);
    });

    return () => {
      cancelled = true;
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

  return <div ref={holder} className="size-full" aria-hidden />;
}

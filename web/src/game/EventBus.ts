/**
 * Cầu nối sự kiện hai chiều giữa canvas Phaser và giao diện React.
 *
 * Phaser vẽ vào `<canvas>`, React vẽ phần còn lại — hai bên không đụng vào DOM
 * của nhau, chỉ nói chuyện qua đây. Nhờ vậy đổi HUD không phải đụng vào cảnh,
 * và đổi cảnh không phải đụng vào HUD.
 *
 * Chuyển gần nguyên vẹn từ bản prototype, chỉ thêm kiểu.
 */

type Listener = (...args: never[]) => void;

class EventEmitter {
  private events: Record<string, Listener[]> = {};

  on(event: string, listener: Listener): () => void {
    (this.events[event] ??= []).push(listener);
    // Trả về hàm huỷ đăng ký: React `useEffect` cần đúng thứ này để dọn khi
    // component bị gỡ, nếu không listener tích lại sau mỗi lần vào màn.
    return () => this.off(event, listener);
  }

  off(event: string, listener: Listener): void {
    const list = this.events[event];
    if (!list) return;
    this.events[event] = list.filter((l) => l !== listener);
  }

  emit(event: string, ...args: unknown[]): void {
    for (const listener of this.events[event] ?? []) {
      (listener as (...a: unknown[]) => void)(...args);
    }
  }

  /** Gỡ sạch. Gọi khi rời màn chơi — cảnh Phaser cũ không được nói với HUD mới. */
  clear(): void {
    this.events = {};
  }
}

export const EventBus = new EventEmitter();

export const GAME_EVENTS = {
  /**
   * Phaser: nhân vật vừa ĐI VÀO phạm vi một nhiệm vụ. payload: { questId }
   *
   * Không phải "vừa bấm chuột vào". Bấm chỉ ra lệnh đi tới; câu hỏi mở khi
   * nhân vật thật sự đứng trong phạm vi — không thì nhân vật và cảnh chơi
   * chỉ là trang trí.
   */
  QUEST_ZONE_ENTERED: 'QUEST_ZONE_ENTERED',
  /** Phaser: nhân vật vừa RỜI phạm vi nhiệm vụ. payload: { questId } */
  QUEST_ZONE_LEFT: 'QUEST_ZONE_LEFT',
  /** React: một nhiệm vụ vừa hoàn thành. payload: { questId } */
  QUEST_COMPLETED: 'QUEST_COMPLETED',
  /**
   * React: vừa qua được nhiệm vụ NPC, các nhiệm vụ còn lại mở khoá.
   *
   * Sự kiện riêng chứ không suy ra từ `QUEST_COMPLETED`: cảnh Phaser không biết
   * nhiệm vụ nào là NPC, và cũng không nên biết — nó chỉ vẽ, còn luật mở khoá
   * thì server quyết và React chuyển lời.
   */
  QUESTS_UNLOCKED: 'QUESTS_UNLOCKED',
  /** React: cả màn đã thắng. */
  STAGE_WON: 'STAGE_WON',
  /** Phaser: vị trí người chơi đổi. payload: { x, y } */
  PLAYER_MOVED: 'PLAYER_MOVED',
  /**
   * Phaser: cảnh đã dựng xong và MỌI tài sản đã nạp — ảnh nền, biểu tượng
   * nhiệm vụ, spritesheet nhân vật, tiếng.
   *
   * Bắn ở cuối `create()`, tức là sau khi `preload()` đã kéo về hết. Video mở
   * màn đợi đúng sự kiện này để biết lúc nào kéo màn ra: hết video mà cảnh chưa
   * xong thì tấm màn ở lại thêm một nhịp, còn hơn kéo ra để lộ một khung hình
   * trống — đó chính là cái nó sinh ra để che.
   *
   * Không payload: chỉ có một cảnh trên màn hình, và "cảnh nào" là câu hỏi
   * không tồn tại.
   */
  STAGE_READY: 'STAGE_READY',
} as const;

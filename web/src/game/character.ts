/**
 * Nhân vật người chơi: spritesheet và cách phát nó.
 *
 * File này KHÔNG import Phaser — màn quản trị cần đúng những con số này để xem
 * trước, nhưng không cần engine.
 */

/**
 * Tên hành động gợi ý.
 *
 * Chỉ là GỢI Ý, không phải danh sách đóng: `action_key` là chuỗi tự do, và thêm
 * một hành động mới là việc của người dựng nội dung, không phải của một
 * migration. Nhưng để mỗi nhân vật một bộ tên riêng thì cảnh chơi không biết
 * gọi hành động nào — nên đây là bộ tên chuẩn để mọi người cùng dùng.
 */
export const ACTION_SUGGESTIONS = ['idle', 'walk', 'run', 'jump', 'talk', 'win', 'lose'] as const;

/** Hành động mặc định khi cảnh chơi chưa yêu cầu gì. */
export const DEFAULT_ACTION = 'idle';

/**
 * Chỗ đặt CHÂN nhân vật so với ĐIỂM VA CHẠM, theo hệ toạ độ thế giới.
 *
 * Điểm va chạm — thứ `canWalk()` xét — nằm CAO HƠN gót chân chừng này. Trong
 * cảnh chơi, nó là gốc của container, còn tấm sprite vẽ ở `y = +22` với gốc
 * giữa-dưới; nên mép dưới tấm ảnh thấp hơn điểm va chạm đúng 22 đơn vị.
 *
 * Con số này ra khỏi `StageScene` vì **trình thiết kế cũng phải biết nó**. Người
 * dựng ướm nhân vật lên vùng vừa vẽ mà đo bằng TÂM tấm ảnh thì lệch gần một nửa
 * chiều cao nhân vật — vẽ tường thấy đúng, vào chơi thấy sai, và không có gì
 * trên màn hình giải thích tại sao.
 */
export const HERO_FOOT_Y = 22;

/**
 * Tốc độ đi của nhân vật, đơn vị thế giới mỗi giây.
 *
 * Dùng chung với chế độ ĐI THỬ của trình thiết kế, và đó là cả lý do nó nằm ở
 * đây. Người dựng thử lách qua một khe hẹp bằng một tốc độ khác tốc độ thật thì
 * cái họ vừa kiểm không phải là cái học sinh sẽ gặp.
 */
export const HERO_SPEED = 280;

export interface SpriteSheet {
  media_url?: string | null;
  frames: number;
  frame_width?: number | null;
  frame_height?: number | null;
  frame_rate: number;
}

/**
 * Thông số vẽ MỘT spritesheet bằng CSS, để xem trước không cần Phaser.
 *
 * Nguyên lý giống hệt thứ Phaser làm: một tấm ảnh dài chứa `frames` khung xếp
 * ngang, và mỗi khung hình là dịch nền sang đúng một khung. `steps(n)` của CSS
 * làm việc dịch giật từng nấc đó; `linear` sẽ trượt mượt qua giữa hai khung và
 * cho ra một con mờ nhoè.
 *
 * `background-size` đặt theo BỀ RỘNG TỔNG: khung rộng `w` × `frames` khung.
 */
export function spriteFrame(
  sheet: SpriteSheet,
  /**
   * Trần kích thước hiển thị, pixel. Khung THẬT có thể rất to — một tấm dải
   * 8 khung của ảnh 5128px thì mỗi khung rộng 641px, tràn khỏi thẻ ngay. Thu
   * nhỏ bằng `transform: scale()` chứ không đổi `width`: đổi `width` là phải
   * đổi luôn `background-size` và mọi con số bên trong, còn `scale` thu cả cụm
   * đúng tỉ lệ mà phép tính khung không suy suyển.
   */
  fit?: { w: number; h: number },
): { style: React.CSSProperties; wrapperStyle: React.CSSProperties } {
  const width = sheet.frame_width ?? 64;
  const height = sheet.frame_height ?? 64;
  const frames = Math.max(1, sheet.frames);

  const zoom = fit ? Math.min(1, fit.w / width, fit.h / height) : 1;

  return {
    wrapperStyle: { width: width * zoom, height: height * zoom, overflow: 'hidden' },
    style: {
      width,
      height,
      transform: zoom < 1 ? `scale(${zoom})` : undefined,
      transformOrigin: 'top left',
      backgroundImage: sheet.media_url ? `url(${sheet.media_url})` : undefined,
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${width * frames}px ${height}px`,
      // Ảnh pixel-art phóng to phải giữ nét vuông; làm mịn là hỏng cả phong cách.
      imageRendering: 'pixelated',
      // Một khung thì không có gì để chạy — và một `animation` với `steps(1)`
      // chỉ tốn một luồng hoạt hình cho một hình đứng yên.
      ...(frames > 1 && {
        animationName: 'sprite-play',
        animationDuration: `${frames / sheet.frame_rate}s`,
        // `steps(n)` cho ra đúng n vị trí rời rạc: 0, −w, …, −(n−1)w. Vì vậy
        // quãng dịch là n × w chứ không phải (n−1) × w.
        animationTimingFunction: `steps(${frames})`,
        animationIterationCount: 'infinite',
        '--sprite-travel': `${-frames * width}px`,
      }),
      // Ép kiểu vì `CSSProperties` không biết tới biến CSS tự đặt.
    } as React.CSSProperties,
  };
}

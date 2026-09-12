'use client';

/**
 * TUỲ CHỌN NHẠC CỦA NGƯỜI CHƠI — bật/tắt và âm lượng tổng.
 *
 * Một bộ duy nhất cho CẢ BA màn: bản đồ thiên hà, phòng chờ world, và màn chơi.
 * Tắt nhạc ở bản đồ rồi vào world là vẫn tắt; bật ở phòng chờ rồi vào màn chơi
 * là vẫn bật. Không có nó thì mỗi màn một cái công tắc riêng, và người chơi
 * phải tắt lại ở từng chỗ — ba lần cho một ý định.
 *
 * ## Nó theo TÀI KHOẢN, không theo trình duyệt
 *
 * Con số thật nằm ở `users.audio_prefs_json`. `localStorage` vẫn còn, nhưng chỉ
 * là BẢN SAO để vẽ ngay lúc mở trang — Phaser và mấy component cần đọc tuỳ chọn
 * một cách đồng bộ, trước cả khi có lượt gọi mạng nào.
 *
 * Trước đây con số thật nằm ở `localStorage`, với lý do "nó thuộc về cái máy
 * đang ngồi". Lý do ấy ngược với phòng máy của một lớp: em tắt nhạc ở máy hôm
 * thứ Hai, thứ Tư ngồi máy khác thì nhạc bật lại — lựa chọn ở lại với cái bàn
 * chứ không đi theo người. Và cùng một cái máy thì trao tuỳ chọn của em trước
 * cho em sau.
 *
 * Đăng nhập là bản của tài khoản GHI ĐÈ bản sao ở máy: máy chỉ nhớ hộ, không
 * quyết.
 *
 * ## Âm lượng tổng NHÂN vào, không thay thế
 *
 * Giáo viên đã cân bằng giữa các khối — nhạc nền 45%, tiếng bước chân 70%. Nếu
 * thanh trượt của người chơi ghi đè lên con số đó thì mọi khối kêu bằng nhau và
 * cái cân bằng ấy mất sạch. Nhân vào thì giữ nguyên tỉ lệ: người chơi vặn to
 * nhỏ CẢ BẢN PHỐI, không vặn từng nhạc cụ.
 */

const KEY = 'vitaminfun.music';

/** Sự kiện phát ra khi tuỳ chọn đổi, để mọi màn đang mở cùng nghe theo. */
export const MUSIC_PREFS_EVENT = 'vitaminfun:music-prefs';

export interface MusicPrefs {
  /** Người chơi có muốn nghe nhạc không. */
  on: boolean;
  /** Âm lượng TỔNG, 0..1. Nhân vào âm lượng từng khối của giáo viên. */
  master: number;
}

/**
 * Mặc định: BẬT, âm lượng đầy.
 *
 * Bật sẵn vì bản nhạc là thứ giáo viên đã chủ động chọn và tải lên — vào màn mà
 * im lặng thì công đó thành công cốc. Ai không muốn nghe thì tắt một lần, và
 * lựa chọn đó theo họ sang mọi màn khác.
 */
export const DEFAULT_MUSIC_PREFS: MusicPrefs = { on: true, master: 1 };

export function readMusicPrefs(): MusicPrefs {
  // `localStorage` ném lỗi ở chế độ ẩn danh của một số trình duyệt, và không
  // tồn tại lúc dựng trang trên server. Hỏng thì lùi về mặc định — mất một tuỳ
  // chọn thì phiền, còn một màn hình trắng thì hỏng hẳn.
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_MUSIC_PREFS;
    const saved = JSON.parse(raw) as Partial<MusicPrefs>;
    return {
      on: typeof saved.on === 'boolean' ? saved.on : DEFAULT_MUSIC_PREFS.on,
      master:
        typeof saved.master === 'number' ? Math.min(1, Math.max(0, saved.master)) : 1,
    };
  } catch {
    return DEFAULT_MUSIC_PREFS;
  }
}

/**
 * Ghi BẢN SAO ở máy và báo cho mọi thứ đang mở. KHÔNG chạm tới server.
 *
 * Dùng khi nguồn tin là chính server — lúc đăng nhập xong, tài khoản nói tuỳ
 * chọn của nó là gì. Gọi `writeMusicPrefs` ở đó sẽ gửi ngược giá trị vừa nhận
 * về lại server: một lượt ghi thừa cho một thứ không đổi.
 */
export function cacheMusicPrefs(prefs: MusicPrefs): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Không ghi được thì tuỳ chọn chỉ sống trong phiên này. Vẫn phát sự kiện
    // bên dưới, nên mọi thứ đang mở vẫn đổi theo ngay.
  }
  window.dispatchEvent(new CustomEvent<MusicPrefs>(MUSIC_PREFS_EVENT, { detail: prefs }));
}

/**
 * NGƯỜI CHƠI vừa vặn cái nút: ghi bản sao, báo cho màn hình, rồi gửi lên tài
 * khoản.
 *
 * Không chờ server: cái nút phải nhảy ngay dưới tay, còn việc lưu thì đi sau.
 * Hỏng thì tuỳ chọn vẫn đúng trong phiên này và lần bấm sau sẽ gửi lại — không
 * có gì để báo lỗi, và một hộp thoại "không lưu được âm lượng" thì phiền hơn
 * chính cái nó báo.
 *
 * Khách chưa đăng nhập (màn thiết kế của giáo viên gọi tới đây) thì server trả
 * 401 và ta bỏ qua: bản sao ở máy vẫn làm đúng việc của nó.
 */
export function writeMusicPrefs(prefs: MusicPrefs): void {
  cacheMusicPrefs(prefs);
  void fetch('/api/be/auth/me/audio-prefs', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  }).catch(() => {});
}

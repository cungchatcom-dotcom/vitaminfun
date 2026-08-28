/**
 * Hằng số hệ toạ độ thế giới.
 *
 * File này KHÔNG import Phaser, và đó là mục đích của nó: giao diện thiết kế
 * màn chơi cần đúng những con số này để quy đổi toạ độ, nhưng không cần engine.
 * Để chúng trong `StageScene.ts` thì mỗi màn hình soạn thảo kéo theo 1.4 MB
 * Phaser mà không dùng tới.
 */

/** Kích thước thế giới của cảnh chơi, tính bằng pixel. */
export const WORLD = { width: 3200, height: 1800 } as const;

/** Bán kính phạm vi kích hoạt khi nhiệm vụ chưa đặt riêng. */
export const DEFAULT_QUEST_RADIUS = 165;

/** Bề rộng ảnh vật thể khi nhiệm vụ chưa đặt riêng, theo pixel thế giới. */
export const DEFAULT_ICON_SIZE = 120;

/**
 * Khung BẢN ĐỒ THIÊN HÀ — màn chọn world.
 *
 * Cùng MỘT giá trị với `WORLD`, không phải một bản sao: hai khung thiết kế dùng
 * chung hệ toạ độ thì `useDesignBoard()` và mọi phép quy đổi phần trăm chạy y
 * hệt nhau ở cả hai nơi. Tên riêng để chỗ gọi đọc ra đang nói về màn nào.
 */
export const GALAXY = WORLD;

/** Đường kính vòng tròn world khi chưa đặt riêng, theo pixel hệ toạ độ trên. */
export const DEFAULT_WORLD_SIZE = 360;

/** Khoảng đường kính chỉnh được — khớp `CHECK` trong DB và `Field()` Pydantic. */
export const WORLD_SIZE = { min: 40, max: 1200 } as const;

/**
 * Khung TIÊU ĐỀ và khung MÔ TẢ trên bản đồ thiên hà.
 *
 * `x`/`y`/`width` là chỗ đứng mặc định khi giáo viên chưa kéo: giữa bản đồ,
 * phía dưới — chỗ mắt tìm tới sau khi đã nhìn xong các world, và chỗ không đè
 * lên bất cứ world nào ở giữa màn.
 *
 * `ratio` chỉ dùng khi CHƯA có ảnh, để tấm nền trơn giữ đúng dáng mà ảnh thật
 * sẽ có. Có ảnh rồi thì chiều cao lấy theo tỉ lệ gốc của ảnh.
 *
 * `font` và `padding` tính bằng `cqw` — phần trăm bề rộng CỦA KHUNG. Nhờ vậy
 * kéo khung to nhỏ thì chữ và lề co giãn theo đúng tỉ lệ, ở mọi cỡ màn hình.
 * Tiêu đề là một dòng ngắn nên chữ to; mô tả là vài dòng nên chữ nhỏ và lề
 * rộng hơn để không đè lên hoa văn ở viền.
 *
 * `z` — **tiêu đề LUÔN nằm trên khung mô tả.** Hai tấm bảng này gần như chắc
 * chắn chồng lên nhau: dáng thường gặp là một dải băng tên gác lên mép trên
 * của tấm bảng lớn. Không nói rõ thứ tự thì cái nào vẽ sau nằm trên, tức là
 * tấm bảng mô tả nuốt mất dải băng tên — và người kéo sẽ tưởng mình làm mất
 * cái khung.
 *
 * Chỗ mặc định đặt sẵn theo dáng đó: dải băng tên gác lên mép trên tấm bảng.
 * Ảnh thật có tỉ lệ khác thì độ chồng khác đi, nhưng thứ tự trên/dưới thì
 * không phụ thuộc vào ảnh.
 */
export const FRAME = {
  title: {
    x: 1600, y: 1160, width: 900, ratio: '6 / 1',
    font: 7, padding: 6, z: 20, color: '#04121f',
  },
  desc: {
    x: 1600, y: 1440, width: 1100, ratio: '16 / 9',
    font: 4.4, padding: 9, z: 10, color: '#04121f',
  },
} as const;

/**
 * Khoảng chỉnh cỡ chữ, tính bằng PHẦN TRĂM so với `FRAME[kind].font`.
 *
 * Phần trăm chứ không phải số tuyệt đối: cỡ chữ thật tính theo bề rộng của
 * khung, nên một con số `px` lưu trong database sẽ sai ngay khi ai đó kéo cái
 * khung to ra. Giáo viên chỉnh "to hơn / nhỏ hơn", còn cỡ nền thì ta giữ.
 */
export const FRAME_FONT = { min: 40, max: 250, base: 100 } as const;

export type FrameKind = keyof typeof FRAME;

/** Khoảng bề rộng chỉnh được cho khung — khớp `CHECK` trong DB và Pydantic. */
export const FRAME_WIDTH = { min: 80, max: 3200 } as const;

/**
 * SỔ ĐĂNG KÝ các khối kéo thả được của PHÒNG CHỜ world.
 *
 * Thêm một khối mới cho phòng chờ = thêm MỘT DÒNG ở đây, cộng một khoá chữ
 * trong `messages/`. Không migration, không sửa trình thiết kế, không sửa màn
 * học sinh — cả hai bên đều duyệt qua sổ này. Đó là toàn bộ lý do bố cục nằm
 * trong một cột JSONB thay vì hai chục cột riêng.
 *
 * `x`/`y`/`width`/`height` là khung mặc định, hệ toạ độ 3200×1800 — CÙNG hệ với
 * bản đồ thiên hà và với cảnh chơi.
 *
 * Khối có CHIỀU CAO THẬT chứ không suy ra theo tỉ lệ ảnh: bên trong chúng là
 * nội dung (dãy chỉ số, danh sách xếp hạng, hàng chương), và nội dung thì cần
 * một cái hộp có kích thước, không phải một tấm ảnh có tỉ lệ.
 *
 * Chỗ mặc định đặt theo bản thiết kế: thành tích cột trái, xếp hạng cột phải,
 * hàng chương ở giữa, ba nút dồn về góc dưới bên phải.
 *
 * `font` là CỠ CHỮ NỀN của khối, tính bằng `cqw` — phần trăm bề rộng KHUNG NỘI
 * DUNG. Mỗi khối một con số riêng vì các khối rộng hẹp rất khác nhau: hàng
 * chương rộng 1600, ô nhân vật rộng 420, nên một cỡ chữ chung sẽ hoặc bé li ti
 * ở khối này hoặc tràn ra khỏi khối kia. Con số đặt sao cho ở kích thước mặc
 * định, chữ ra đúng bằng cỡ px mà màn hình vẫn đang vẽ.
 */
export const LOBBY_ELEMENTS = {
  // Khối `stats` giờ CHỈ LÀ CÁI KHUNG — tấm ảnh nền. Năm con số bên trong nó là
  // năm khối riêng, mỗi cái kéo và chỉnh được một mình. Ảnh khung thường vẽ sẵn
  // năm cái ô ngang kèm biểu tượng, mà năm dòng chữ xếp cứng theo một công thức
  // thì không bao giờ rơi đúng vào năm cái ô đó.
  stats: { x: 330, y: 1160, width: 560, height: 750, font: 5.6 },
  ranking: { x: 2830, y: 830, width: 600, height: 450, font: 5.3 },
  chapters: { x: 1600, y: 1090, width: 1600, height: 320, font: 1.6 },
  play: { x: 2830, y: 1420, width: 560, height: 112, font: 6.2 },
  createRoom: { x: 2830, y: 1600, width: 520, height: 88, font: 6.7 },
  joinRoom: { x: 2830, y: 1740, width: 520, height: 88, font: 6.7 },
  // Nhân vật tách làm HAI khối: cái ảnh, và dòng mô tả. Người dựng đặt tấm
  // ảnh nhân vật ở một chỗ trong tranh nền còn dòng chữ ở chỗ khác — mà một
  // khối thì chỉ có một chỗ đứng và một cỡ. Tách ra là mỗi thứ có khung riêng,
  // ảnh nền riêng, khung nội dung riêng, màu và cỡ chữ riêng.
  //
  // Giữ tên khoá `character` cho khối ẢNH chứ không đổi thành `characterAvatar`:
  // world nào đã đặt chỗ và tải ảnh khung cho ô nhân vật thì dữ liệu đang nằm
  // dưới khoá đó, đổi tên là mất sạch.
  character: { x: 330, y: 480, width: 420, height: 520, font: 9 },
  // Đặt đè lên phần dưới của khối ảnh — đúng chỗ dòng mô tả vẫn đứng từ trước,
  // nên world chưa ai kéo lại vẫn trông y như cũ.
  characterInfo: { x: 330, y: 690, width: 420, height: 90, font: 7.6 },

  // Năm con số của bảng thành tích, xếp sẵn thành một cột trong khung `stats`.
  // Chỗ mặc định chia đều chiều cao khung: người dựng kéo lại cho khớp hoa văn
  // của chính tấm ảnh họ tải lên, còn ở đây thì phải rơi vào một chỗ hợp lý
  // trước đã.
  statPower: { x: 330, y: 860, width: 400, height: 100, font: 10 },
  statShards: { x: 330, y: 1010, width: 400, height: 100, font: 10 },
  statStars: { x: 330, y: 1160, width: 400, height: 100, font: 10 },
  statLevel: { x: 330, y: 1310, width: 400, height: 100, font: 10 },
  statProgress: { x: 330, y: 1460, width: 400, height: 100, font: 10 },
} as const;

export type LobbyElementKey = keyof typeof LOBBY_ELEMENTS;

/**
 * Những khối là NÚT BẤM — thứ duy nhất có chữ đặt được.
 *
 * Khối khác đã có nội dung riêng (dãy chỉ số, bảng xếp hạng, hàng chương); một
 * dòng chữ đè lên trên chúng chẳng để làm gì. Danh sách nằm ở đây, cạnh sổ đăng
 * ký, để thêm một cái nút mới là sửa đúng một chỗ.
 */
export const LOBBY_ACTION_KEYS = ['play', 'createRoom', 'joinRoom'] as const;

export function isLobbyAction(key: LobbyElementKey): boolean {
  return (LOBBY_ACTION_KEYS as readonly string[]).includes(key);
}

/**
 * Năm con số của BẢNG THÀNH TÍCH, theo đúng thứ tự chúng xếp trong khung.
 *
 * Danh sách nằm ở đây, cạnh sổ đăng ký, để thêm một chỉ số mới là sửa đúng một
 * chỗ — cùng nếp với `LOBBY_ACTION_KEYS`.
 */
export const LOBBY_STAT_KEYS = [
  'statPower',
  'statShards',
  'statStars',
  'statLevel',
  'statProgress',
] as const;

/**
 * Số hàng của khối XẾP HẠNG — cũng là số người server trả về.
 *
 * Chia chiều cao khối thành đúng bấy nhiêu hàng, kể cả khi world mới có ba
 * người chơi. Để hàng tự giãn theo số người thì world có ba người sẽ hiện ba
 * cái ảnh đại diện to bằng nắm tay, rồi người thứ tư vào là cả bảng co lại —
 * bố cục người dựng vừa căn xong tự đổi sau lưng họ.
 */
export const LOBBY_RANK_ROWS = 10;

export function isLobbyStat(key: LobbyElementKey): boolean {
  return (LOBBY_STAT_KEYS as readonly string[]).includes(key);
}

/**
 * Khối KHÔNG có khung nội dung riêng — khung của KHỐI chính là khung chữ.
 *
 * Khung nội dung sinh ra để né hoa văn ở viền một tấm ảnh khung trang trí. Khối
 * mô tả nhân vật thì chỉ có đúng một đoạn chữ và không có tấm khung nào để né,
 * nên hai cái hộp lồng nhau chỉ là hai chỗ để kéo cho cùng một kết quả. Kéo cái
 * gì thì chữ nằm đúng trong cái đó.
 *
 * Màu chữ và cỡ chữ vẫn đặt được — chúng nằm ở `content` như mọi khối khác,
 * chỉ có bốn con số toạ độ là không dùng tới.
 */
export const LOBBY_PLAIN_KEYS = [
  'characterInfo',
  ...LOBBY_STAT_KEYS,
] as const;

export function hasContentFrame(key: LobbyElementKey): boolean {
  return !(LOBBY_PLAIN_KEYS as readonly string[]).includes(key);
}

/**
 * Chiều cao một dòng chữ, tính theo bội số cỡ chữ. Bằng `leading-snug` của
 * Tailwind — con số này và cái lớp CSS kia phải bằng nhau, nếu không thì số
 * dòng tính ra sẽ lệch với số dòng vẽ ra.
 */
export const LOBBY_LINE_HEIGHT = 1.375;

/**
 * SỐ DÒNG chữ lọt vào một khối — để cắt đoạn chữ dài bằng dấu ba chấm.
 *
 * Tính chứ không đo: `-webkit-line-clamp` cần một số nguyên, mà đo DOM thì phải
 * dựng xong mới biết, tức là vẽ một lần sai rồi sửa — và trên server thì không
 * có DOM để mà đo. Ở đây mọi thứ đều suy được từ dữ liệu: cỡ chữ là phần trăm
 * BỀ RỘNG khung, chiều cao khung thì đã biết, nên số dòng là một con số cố
 * định, giống nhau ở mọi cỡ màn hình.
 */
export function lobbyTextLines(key: LobbyElementKey, saved: LobbySaved | undefined): number {
  const box = lobbyBox(key, saved);
  const content = lobbyContentBox(saved?.content);
  const framed = hasContentFrame(key);
  const width = framed ? (box.width * content.w) / 100 : box.width;
  const height = framed ? (box.height * content.h) / 100 : box.height;
  const fontSize = ((LOBBY_ELEMENTS[key].font * content.font) / 10_000) * width;
  return Math.max(1, Math.floor(height / (fontSize * LOBBY_LINE_HEIGHT)));
}

export const LOBBY_ELEMENT_KEYS = Object.keys(LOBBY_ELEMENTS) as LobbyElementKey[];

/**
 * KHUNG NỘI DUNG bên trong một khối — chỗ thật sự vẽ chữ và số.
 *
 * Ảnh nền của khối gần như bao giờ cũng là một tấm khung trang trí: cuộn giấy,
 * biển gỗ, tấm bảng có hoa văn chạy quanh viền. Chỗ VIẾT ĐƯỢC chỉ là một ô ở
 * giữa nó, và ô đó chẳng bao giờ nằm đúng tâm với đúng 4% đệm mỗi bên — thứ mà
 * màn hình vẫn đang giả định. Kết quả là chữ đè lên hoa văn, mà không có cách
 * nào chỉnh ngoài việc sửa lại tấm ảnh.
 *
 * **Toạ độ tính bằng PHẦN TRĂM CỦA KHỐI, không phải hệ 3200×1800.** Ảnh nền
 * căng theo khối (`inset-0 size-full`), nên kéo khối to ra là hoa văn to theo;
 * khung nội dung phải to theo cùng nhịp. Lưu theo hệ thế giới thì mỗi lần đổi
 * cỡ khối là phải căn lại chữ từ đầu.
 */
export interface LobbyContentSaved {
  /** Tâm khung, phần trăm bề rộng/chiều cao KHỐI. */
  x?: number | null;
  y?: number | null;
  /** Bề rộng và chiều cao, cũng theo phần trăm khối. */
  w?: number | null;
  h?: number | null;
  /** Mã màu `#rrggbb` của chữ. */
  color?: string | null;
  /** PHẦN TRĂM so với cỡ chữ nền của khối. */
  font?: number | null;
}

/**
 * Mặc định của khung nội dung: KÍN KHỐI, chừa 4% mỗi bên.
 *
 * Đúng bằng nếp cũ (`p-[4%]`), nên world nào chưa ai đụng tới vẫn hiện y như
 * trước. Chữ trắng viền đen: chữ trắng trên một tấm ảnh sáng thì biến mất, và
 * viền đen giữ nó đọc được trên bất kỳ tấm ảnh nào người dựng tải lên.
 */
export const LOBBY_CONTENT = {
  x: 50,
  y: 50,
  w: 92,
  h: 92,
  color: '#ffffff',
  stroke: '#000000',
  /** Bề dày viền chữ, theo `em` để dày mỏng đi cùng cỡ chữ. */
  strokeWidth: '0.07em',
} as const;

/** Khung nội dung đang có hiệu lực: giá trị đã đặt, không thì mặc định. */
export function lobbyContentBox(saved: LobbyContentSaved | null | undefined) {
  return {
    x: saved?.x ?? LOBBY_CONTENT.x,
    y: saved?.y ?? LOBBY_CONTENT.y,
    w: saved?.w ?? LOBBY_CONTENT.w,
    h: saved?.h ?? LOBBY_CONTENT.h,
    color: saved?.color ?? LOBBY_CONTENT.color,
    font: saved?.font ?? FRAME_FONT.base,
  };
}

/** Một khối như nó được lưu trong `worlds.lobby_json`. Thiếu khoá = dùng mặc định. */
export interface LobbySaved {
  x?: number | null;
  y?: number | null;
  w?: number | null;
  h?: number | null;
  media_id?: string | null;
  /**
   * Chữ in đè lên khối. Chỉ ba cái nút dùng tới, và MẶC ĐỊNH RỖNG — ảnh nút
   * thường đã vẽ sẵn chữ trong đó, in thêm một dòng nữa là hai lớp chồng nhau.
   */
  text_i18n?: Record<string, string> | null;
  /** Khung nội dung — xem `LobbyContentSaved`. */
  content?: LobbyContentSaved | null;
}

/** Khung đang có hiệu lực của một khối: giá trị đã đặt, không thì mặc định. */
export function lobbyBox(key: LobbyElementKey, saved: LobbySaved | undefined) {
  const spec = LOBBY_ELEMENTS[key];
  return {
    x: saved?.x ?? spec.x,
    y: saved?.y ?? spec.y,
    width: saved?.w ?? spec.width,
    height: saved?.h ?? spec.height,
  };
}

/**
 * Chỗ đứng cho world CHƯA đặt toạ độ: rải đều thành một hàng ngang giữa bản đồ.
 *
 * Dồn hết vào tâm thì hai world mới tạo chồng khít lên nhau, nhãn đè lên nhau
 * thành một mớ chữ không đọc được, và cái nằm dưới thì không kéo ra được vì
 * không bấm tới được. Trình thiết kế và màn của học sinh dùng CHUNG hàm này,
 * nếu không thì giáo viên kéo một world ở chỗ này rồi học sinh thấy nó ở chỗ
 * khác — trước cả khi ai đặt toạ độ nào.
 */
export function defaultWorldSpot(index: number, total: number): { x: number; y: number } {
  return { x: ((index + 1) / (total + 1)) * GALAXY.width, y: GALAXY.height / 2 };
}

// ---------------------------------------------------------------- nhịp thở

/**
 * Nhịp thở của ảnh vật thể: phóng to thu nhỏ liên tục để người chơi nhận ra
 * "cái này bấm được".
 *
 * BẬT SẴN, nhẹ thôi. Một cảnh mà mọi thứ đều đứng im thì người chơi không biết
 * vật nào là đồ trang trí trên nền, vật nào là nhiệm vụ — và cách duy nhất để
 * biết là bấm thử từng cái. Giáo viên kéo về 0 để tắt từng vật thể một.
 */
export const DEFAULT_PULSE_PERCENT = 8;

/** Một nhịp đầy đủ — to RỒI nhỏ — tính bằng mili giây. */
export const DEFAULT_PULSE_PERIOD_MS = 1600;

/**
 * Khoảng chỉnh được, GIỐNG HỆT `CHECK` trong database và `Field()` của Pydantic.
 *
 * Trên 50% thì ảnh phình gấp rưỡi, nhìn như hỏng chứ không như thở. Dưới 400ms
 * (2,5 nhịp/giây) thì thành nhấp nháy tần số cao — thứ gây khó chịu và, với một
 * số người, co giật.
 */
export const PULSE = {
  percentMin: 0,
  percentMax: 50,
  periodMinMs: 400,
  periodMaxMs: 4000,
} as const;

export interface PulseSpec {
  /** Tỉ lệ ở ĐỈNH nhịp. 1.08 = phình lên 108% rồi về 100%. */
  maxScale: number;
  /** Thời gian của NỬA nhịp — xem ghi chú trong `resolvePulse()`. */
  halfCycleMs: number;
}

/**
 * Quy đổi hai con số của giáo viên thành thông số vẽ. `null` = không nhấp nháy.
 *
 * Một hàm dùng chung cho CẢ HAI nơi vẽ — khung soạn (CSS) và cảnh chơi (tween
 * Phaser). Nếu mỗi bên tự quy đổi thì sớm muộn cũng lệch nhau, và giáo viên
 * chỉnh trong trình thiết kế xong vào chơi thấy khác.
 *
 * `percent = 0` KHÁC `percent = null`: 0 là "tắt hẳn", null là "chưa đặt, lấy
 * mặc định". Đó là lý do cột trong database để nullable thay vì mặc định 0.
 *
 * KHÔNG kiểm `prefers-reduced-motion`, và đây là một quyết định có cân nhắc.
 * Cài đặt đó dùng để chặn chuyển động TRANG TRÍ. Nhịp thở ở đây không trang
 * trí: nó là thứ duy nhất phân biệt vật thể bấm được với hình vẽ trên nền. Tắt
 * nó theo cài đặt của từng máy nghĩa là hai đứa trẻ ngồi cạnh nhau, chơi chung
 * một màn, mà một đứa thấy gợi ý còn đứa kia phải bấm mò từng thứ — trong một
 * trò chơi nhiều người thì đó không phải là dễ tiếp cận hơn.
 *
 * Nút tắt vẫn có, nhưng nằm ở tay GIÁO VIÊN: kéo độ phồng về 0. Tắt cho cả
 * lớp, cùng lúc, nhìn thấy được trong trình thiết kế.
 */
export function resolvePulse(
  percent: number | null | undefined,
  periodMs: number | null | undefined,
): PulseSpec | null {
  const amount = percent ?? DEFAULT_PULSE_PERCENT;
  if (amount <= 0) return null;

  const period = clamp(periodMs ?? DEFAULT_PULSE_PERIOD_MS, PULSE.periodMinMs, PULSE.periodMaxMs);

  return {
    maxScale: 1 + clamp(amount, PULSE.percentMin, PULSE.percentMax) / 100,
    // CHIA ĐÔI ở đây, một chỗ duy nhất. Cả `animation-direction: alternate` của
    // CSS lẫn `yoyo: true` của Phaser đều chạy MỘT LƯỢT ĐI trong khoảng thời
    // gian được cho, rồi mới quay lại — nên "một nhịp đầy đủ" của giáo viên
    // bằng hai lượt.
    halfCycleMs: period / 2,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

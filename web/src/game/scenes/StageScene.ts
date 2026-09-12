import Phaser from 'phaser';

import { EventBus, GAME_EVENTS } from '../EventBus';
import {
  AUDIO_SLOT_KEYS,
  DUCK_VOLUME,
  ambientFromVideo,
  readAudio,
  resolveAudio,
  type AudioMap,
  type AudioSlot,
} from '../audio';
import { DEFAULT_ACTION, HERO_FOOT_Y, HERO_SPEED } from '../character';
import {
  bakeGrid,
  canWalkAt,
  findPath,
  nearestWalkable,
  readCollision,
  type CollisionMap,
  type WalkGrid,
} from '../collision';
import { DEFAULT_ICON_SIZE, WORLD, resolvePulse, resolveSpawn } from '../world';

/**
 * Cảnh 2.5D isometric của một màn chơi.
 *
 * Chuyển từ bản prototype Vite. Phần Phaser thuần — nền, thời tiết, di chuyển,
 * camera — giữ gần như nguyên vẹn.
 *
 * Ba chỗ đổi hẳn:
 *
 *   1. **Vật thể nhiệm vụ đọc từ dữ liệu**, không viết cứng. Bản cũ nhét sẵn
 *      bốn vật thể với toạ độ và chữ tiếng Việt trong code; giờ chúng đến từ
 *      `snapshot.quests` của API.
 *   2. **Không đụng vào DOM.** Bản cũ đọc `document.activeElement` để biết người
 *      dùng đang gõ. Giờ React báo xuống qua `setTypingGuard()`.
 *   3. **Mở câu hỏi theo ĐÍCH ĐẾN, không theo cú bấm.** Bấm vào một vật thể chỉ
 *      ra lệnh đi tới nó; bảng câu hỏi mở khi nhân vật **chạm khung ảnh** của vật
 *      thể. Bấm phát mở luôn thì nhân vật, bản đồ và cả cảnh chơi chỉ còn là
 *      trang trí.
 *
 *      Quyết định nằm ở ĐÍCH, không ở đường đi. Đích rơi vào trong khung thì nhân
 *      vật đi tới **mép khung rồi dừng** và mở nhiệm vụ. Đích nằm ngoài mọi khung
 *      thì đi thẳng tới đó, **đi xuyên qua** vật thể nào trên đường cũng không mở.
 *      Mở nhiệm vụ là việc có chủ ý, không phải tai nạn dọc đường.
 *
 *      Vùng kích hoạt là KHUNG ẢNH chứ không phải một vòng tròn quanh nó: cái
 *      người chơi nhìn thấy chính là cái họ phải bước vào. Vòng tròn vô hình
 *      rộng hơn hình vẽ là thứ khiến người chơi tưởng mình đã tới mà chưa, hoặc
 *      ngược lại.
 */

export interface SceneQuest {
  id: string;
  order_index: number;
  phase: 'advisor' | 'main';
  quest_object_key: string;
  label: string;
  scene_x: number | null;
  scene_y: number | null;
  /**
   * Bán kính phạm vi — TẠM THỜI KHÔNG DÙNG.
   *
   * Vùng kích hoạt giờ là khung ảnh. Cột vẫn còn ở database và vẫn đi qua API
   * để bật lại được mà không phải migration; xoá đi rồi cần lại thì đắt hơn
   * nhiều so với việc để nó nằm im.
   */
  trigger_radius: number | null;
  /** Ảnh tĩnh hoặc GIF. Null = vẽ vòng sáng mặc định. */
  icon_url: string | null;
  /** Bề rộng ảnh theo pixel thế giới. Null = `DEFAULT_ICON_SIZE`. */
  icon_size: number | null;
  /** Nhịp thở: to thêm bao nhiêu %. Null = mặc định, 0 = tắt. */
  pulse_percent: number | null;
  /** Một nhịp đầy đủ, mili giây. Null = mặc định. */
  pulse_period_ms: number | null;
}

/** Một tấm spritesheet, đúng thứ `load.spritesheet()` cần. */
export interface SceneSprite {
  action_key: string;
  url: string;
  frames: number;
  frame_width: number;
  frame_height: number;
  frame_rate: number;
}

/** Nhân vật người chơi đã chọn cho world này. */
export interface SceneCharacter {
  id: string;
  sprites: SceneSprite[];
}

/**
 * Khoá của video nền trong kho của Phaser.
 *
 * Khác hẳn khoá `'stage_bg'` của ảnh: ảnh nằm ở kho texture, video nằm ở kho
 * video, và `create()` hỏi đúng một trong hai kho để biết nền là loại nào.
 */
const BG_VIDEO_KEY = 'stage_bg_video';

export interface StageSceneData {
  /** URL ảnh nền. Rỗng = chưa có ảnh, cảnh dùng nền biển mặc định. */
  backgroundUrl: string;
  /**
   * Ảnh nền là ảnh TĨNH hay VIDEO — server trả xuống, đã đóng băng vào đề bài.
   *
   * Không đoán theo đuôi file trong URL: cảnh này nạp bằng hai đường khác hẳn
   * nhau (`load.image` và `load.video`), và đoán sai một lần là cả màn mất nền.
   */
  backgroundKind?: 'image' | 'video' | null;
  quests: SceneQuest[];
  advisorLabel: string | null | undefined;
  completedQuestIds: string[];
  /**
   * Nhiệm vụ đang KHOÁ vì người chơi chưa qua được NPC.
   *
   * Danh sách chứ không phải một cờ "đã qua NPC chưa": cảnh chỉ vẽ theo những
   * gì được bảo, còn ai khoá ai mở là việc của server. Cảnh mà tự suy ra luật
   * thì sẽ có ngày nó suy khác server, và người chơi thấy một vật thể sáng rực
   * mà bấm vào thì bị từ chối.
   */
  lockedQuestIds: string[];
  /**
   * Chiều CAO của nhân vật trong cảnh này, hệ toạ độ thế giới.
   *
   * Đến từ đề bài đã đóng băng, và server đã giải xong chuỗi kế thừa (số của
   * chính màn này, hay của màn đầu world, hay hằng số mặc định). Cảnh không tự
   * suy — suy ở hai nơi thì hai nơi sẽ có ngày lệch nhau.
   */
  characterHeight?: number;
  /**
   * Chỗ nhân vật đang đứng, lấy từ lượt chơi. `null` = chưa đi đâu.
   *
   * Cảnh chỉ ĐẶT nhân vật vào đây lúc dựng, rồi thôi. Nó không tự nhớ và cũng
   * không tự lưu — mỗi bước đi phát `PLAYER_MOVED`, còn việc ghi xuống server
   * là của React. Cảnh biết vẽ, không biết mạng.
   */
  startPos?: { x: number; y: number } | null;
  /**
   * CHỖ XUẤT PHÁT do giáo viên đặt cho màn này, lấy từ đề bài đã đóng băng.
   *
   * Khác `startPos` ở chỗ ai quyết: `startPos` là chỗ NGƯỜI CHƠI đi tới lần
   * trước, còn đây là chỗ NGƯỜI DỰNG chọn — nên `startPos` thắng khi có cả
   * hai. Người vào lại một lượt đang dở phải đứng đúng chỗ họ rời đi; nếu
   * không thì thoát ra vào lại là một cách quay về vạch xuất phát.
   *
   * `null` (cả hai trục) = chưa đặt, dùng `DEFAULT_SPAWN`.
   */
  spawnPos?: { x: number | null; y: number | null } | null;
  /**
   * Nhân vật người chơi đã chọn ở phòng chờ world.
   *
   * `null` = chưa chọn, hoặc nhân vật không có tấm nào tải được — cảnh vẫn chơi
   * bình thường với ký hiệu tròn mặc định. Không có nhân vật KHÔNG phải là lý
   * do để một màn chơi không mở được.
   */
  character: SceneCharacter | null;
  /**
   * Vùng đi được do giáo viên vẽ, lấy từ đề bài đã đóng băng.
   *
   * `null`/bỏ trống = chưa vẽ, và khi đó nhân vật đi được trên CẢ bản đồ, chừa
   * một lề quanh mép. Đó là mặc định trung thực duy nhất khi ảnh nền là tuỳ ý:
   * cảnh không biết chỗ nào trong ảnh của giáo viên là "sàn" và chỗ nào là
   * "tường". Đoán hộ họ bằng một hình viết cứng thì luôn luôn sai.
   */
  collision?: unknown;
  /**
   * Âm thanh của màn, lấy từ đề bài đã đóng băng.
   *
   * Bỏ trống = màn không có tiếng nào, và đó là mặc định: một màn tự bật nhạc
   * mà người dựng không chủ động chọn là thứ cả lớp phải chịu cùng lúc.
   */
  audio?: unknown;
  /** URL từng khối tiếng, khoá theo tên khối. */
  audioUrls?: Record<string, string>;
}

/**
 * Dấu gắn vào CUỐI nhãn nhiệm vụ đã xong. Có dấu cách ở đầu.
 *
 * Cuối chứ không đầu: đầu nhãn đã có `⚓` của NPC và `🔒` của nhiệm vụ đang
 * khoá, nên nhét thêm dấu thứ ba vào đó là đẩy cái TÊN — thứ người chơi thật sự
 * đọc — lùi mãi sang phải.
 */
const DONE_SUFFIX = ' ✓';

/** Ổ khoá gắn trước nhãn nhiệm vụ đang khoá. Có dấu cách ở cuối. */
const LOCK_PREFIX = '🔒 ';

const WORLD_WIDTH = WORLD.width;
const WORLD_HEIGHT = WORLD.height;
// Tốc độ đi ở `character.ts`: chế độ đi thử của trình thiết kế phải chạy đúng
// cùng con số, nếu không thì thứ người dựng vừa kiểm không phải thứ học sinh gặp.
const MOVE_SPEED = HERO_SPEED;

/**
 * Lề quanh mép bản đồ mà nhân vật không bước vào.
 *
 * Để nhân vật đứng đúng mép thì nửa người nằm ngoài khung hình. Chừa một lề
 * bằng cỡ nhân vật là đủ.
 */
const WALK_MARGIN = 60;

/**
 * Chiều cao nhân vật, tính bằng pixel THẾ GIỚI (khung 3200×1800).
 *
 * Đặt theo chiều CAO chứ không theo chiều rộng: spritesheet của mỗi nhân vật
 * một khổ khác nhau, nhưng cái người chơi so sánh là "cao bằng chừng nào so với
 * vật thể quanh mình". Ghim chiều rộng thì một nhân vật gầy sẽ cao vống lên còn
 * một nhân vật mập thì lùn tịt.
 *
 * 160 so với `DEFAULT_ICON_SIZE = 120` của vật thể nhiệm vụ: cao hơn vật thể
 * một chút, đúng tỉ lệ người đứng cạnh đồ vật.
 */
const HERO_HEIGHT = 160;

// `HERO_FOOT_Y` ở `character.ts`: trình thiết kế cũng phải biết nó để ướm nhân
// vật lên vùng vừa vẽ, mà nó thì không được kéo theo Phaser.

/** Ngưỡng coi là "đang đi", pixel mỗi khung hình. */
const MOVING_EPSILON = 0.5;

/**
 * Số khung hình phải đứng yên LIÊN TIẾP thì mới đổi về `idle`.
 *
 * Sang `walk` thì đổi ngay từ khung đầu tiên — người chơi phải thấy nhân vật
 * nhấc chân đúng lúc họ bấm. Chiều ngược lại mới cần chờ, vì một khung hình
 * "đứng yên" không phải lúc nào cũng có nghĩa là đã tới nơi: máy khựng một
 * nhịp thì Phaser bù lại bằng vài khung hình delta gần bằng 0, nhân vật đang
 * đi giữa đường mà chớp về tư thế đứng rồi lại chạy tiếp.
 *
 * Ba khung ở 60fps là 50ms — không ai thấy nhân vật dừng chậm, nhưng đủ để
 * nuốt trọn mọi cú khựng một nhịp.
 */
const IDLE_AFTER_STILL_FRAMES = 3;

/**
 * Nhãn tên vật thể — ba con số phải đi với nhau.
 *
 * `FONT` là cỡ VẼ RA texture: to để chữ nét khi thu nhỏ lại.
 * `SCREEN` là cỡ NGƯỜI DÙNG THẤY, phải khớp `text-[11px]` bên trình thiết kế.
 * `GAP` là khoảng hở tới mép ảnh, cũng tính bằng pixel màn hình.
 *
 * Vẽ 40px rồi hiện ở 11px là thu nhỏ — chữ nét. Làm ngược lại (vẽ 11 hiện 40)
 * là phóng to một texture nhỏ, và chữ nhoè.
 *
 * `STROKE` là bề dày nét viền đen, tính theo CỠ VẼ nên nó thu nhỏ cùng chữ.
 * Một phần năm cỡ chữ: 40 → 8, hiện ra khoảng 2,2px trên màn hình, nửa trong
 * nửa ngoài glyph. Trình thiết kế dùng đúng tỉ lệ đó trên cỡ 11px.
 */
const LABEL = { FONT: 40, SCREEN: 11, GAP: 8, STROKE: 8 } as const;


interface QuestNode {
  id: string;
  x: number;
  y: number;
  /** Khung va chạm, tính theo hệ toạ độ thế giới. */
  box: Phaser.Geom.Rectangle;
  /**
   * Vùng bấm, đúng bằng khung ảnh. KHÔNG VẼ GÌ CẢ.
   *
   * Không viền lúc bình thường, cũng không viền lúc nhân vật bước vào. Dấu hiệu
   * "đã tới" giờ là chính bảng câu hỏi mở ra — vẽ thêm một ô vuông sáng phía sau
   * nó là thừa.
   */
  hitArea: Phaser.GameObjects.Rectangle;
  /** Nhãn tên. Giữ lại để chỉnh cỡ chữ mỗi khi camera đổi zoom. */
  label: Phaser.GameObjects.Text;
  /**
   * Thùng bọc quanh nhãn, CHỈ để nhấp nháy.
   *
   * Hai hệ cùng muốn ghi vào `scale` của nhãn và chúng sẽ đánh nhau:
   * `rescaleLabels()` đặt lại tỉ lệ sau MỖI lần camera thu phóng để cỡ chữ trên
   * màn hình không đổi, còn nhịp thở thì tween chính thuộc tính đó. Tween thẳng
   * lên nhãn là chữ giật giữa hai giá trị mỗi khi đổi cỡ cửa sổ.
   *
   * Tách ra thì mỗi hệ có một thuộc tính của riêng mình: nhãn giữ `scale` cho
   * cỡ chữ, thùng bọc giữ `scale` cho nhịp thở, và tích của hai cái là thứ hiện
   * ra. Thùng đặt ĐÚNG chỗ neo nhãn nên nó phình ra tại chỗ, không bị nhấc lên
   * hạ xuống theo nhịp.
   */
  labelWrap: Phaser.GameObjects.Container;
  /** Nửa chiều cao khung ảnh, dùng để đặt nhãn ngay trên đầu ảnh. */
  halfHeight: number;
  container: Phaser.GameObjects.Container;
  completed: boolean;
  /** Đang khoá vì chưa qua NPC. */
  locked: boolean;
}

export class StageScene extends Phaser.Scene {
  static readonly KEY = 'StageScene';

  private player!: Phaser.GameObjects.Container;
  /**
   * Vùng nhân vật đi lại được.
   *
   * TRƯỚC ĐÂY đây là một đa giác hình boong tàu viết cứng, sao chép từ bản demo
   * Vite — nó vừa khít **một ảnh nền cụ thể của bản demo đó**. Nền giờ do giáo
   * viên tải lên và vật thể kéo thả tự do trên cả khung 3200×1800, nên cái đa
   * giác ấy chỉ còn là một bức tường vô hình chắn 80% bản đồ, không dính dáng
   * gì tới thứ đang hiện trên màn.
   *
   * Hai lỗi nó gây ra: bấm vào phần lớn bản đồ thì nhân vật gần như không nhúc
   * nhích, và bấm vào một vật thể nằm ngoài đa giác là nhân vật ra khỏi vùng
   * hợp lệ rồi **kẹt cứng** — không cú bấm hay phím nào ăn nữa.
   */
  private walkArea!: Phaser.Geom.Rectangle;
  /**
   * Bản vẽ của giáo viên. `null` = chưa vẽ, và khi đó `walkArea` là tất cả.
   *
   * Đọc qua `readCollision()` chứ không nhận thẳng: đề bài đóng băng lưu lại
   * nguyên văn cái đã lưu từ trước, nên một bản vẽ của phiên bản cũ vẫn có thể
   * chui tới đây, và một hình thiếu số đo sẽ thành một bức tường vô hình.
   */
  /** Những tai nghe đã gắn lên `EventBus`, giữ lại để còn gỡ ra. */
  private nghe: [string, (...args: never[]) => void][] = [];

  private collision: CollisionMap | null = null;
  /**
   * Lưới tìm đường, nướng MỘT LẦN lúc vào màn.
   *
   * `null` = màn không có vật cản nào, và khi đó mọi đường thẳng đều thông nên
   * chẳng có gì để tìm.
   */
  private grid: WalkGrid | null = null;

  /** Cấu hình tiếng của màn, đã gạn sạch. */
  private audio: AudioMap = {};

  /**
   * Video nền, nếu nền là video. Giữ tham chiếu vì nó vừa là HÌNH vừa có thể là
   * TIẾNG: `setMusicPrefs` phải với tới được để tắt mở và chỉnh âm lượng.
   */
  private bgVideo: Phaser.GameObjects.Video | null = null;

  /** Nhạc nền đang lấy từ tiếng của video nền. Chốt một lần trong `preload`. */
  private ambientFromVideo = false;

  /**
   * Khổ texture của video nền ở lần căng khung gần nhất.
   *
   * Không phải để tối ưu: nó là ĐIỀU KIỆN để biết đã căng đúng chưa. Xem
   * `fitBgVideo()`.
   */
  private bgVideoSize = { w: 0, h: 0 };
  /** Đã thử tải lại tấm nền chưa. Đúng một lần — xem `retryBackground()`. */
  private bgRetried = false;
  /** Các bản đã nạp được, khoá theo tên khối. Thiếu = file hỏng hoặc chưa có. */
  private sounds = new Map<AudioSlot, Phaser.Sound.BaseSound>();
  /**
   * Khối tiếng CHUYỂN ĐỘNG đang phát. `null` = chưa phát gì.
   *
   * Giữ riêng một biến thay vì hỏi lại `sounds` mỗi khung hình: `update()` chạy
   * 60 lần một giây, và đổi bài hát 60 lần một giây thì không nghe ra tiếng gì
   * ngoài tiếng lụp bụp.
   */
  private motionSlot: 'walk' | 'idle' | null = null;
  /**
   * Tuỳ chọn nhạc CỦA NGƯỜI CHƠI — bật/tắt và âm lượng tổng.
   *
   * React đẩy vào qua `setMusicPrefs()`, không đọc `localStorage` ở đây: cảnh
   * biết vẽ, không biết chỗ lưu tuỳ chọn. Đọc ở hai nơi thì hai nơi phải cùng
   * biết khoá lưu tên gì, và cùng phải nghe sự kiện đổi.
   */
  private musicPrefs = { on: true, master: 1 };
  /**
   * Bảng câu hỏi CÓ TIẾNG đang mở → hạ mọi tiếng của màn xuống.
   *
   * Hạ CẢ nhạc nền lẫn tiếng đứng/đi, không riêng nhạc nền: cái phải nghe rõ là
   * đoạn ghi âm trong bảng, và một vòng lặp tiếng thở nền vẫn chồng lên nó đúng
   * như bản nhạc. Cùng một mục đích thì cùng một cái van.
   *
   * Nhân vào âm lượng đang có chứ không thay nó: người chơi vặn nhỏ rồi thì lúc
   * hạ phải nhỏ hơn nữa, không phải nhảy lên mức của người khác.
   */
  private ducked = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;

  private nodes: QuestNode[] = [];
  /** Nhiệm vụ nhân vật đã DỪNG LẠI trong phạm vi. Đổi giá trị là phát sự kiện. */
  private nearId: string | null = null;
  /** Đang đi bằng bàn phím. Nhả hết phím = tới nơi. */
  private keyMoving = false;

  /** Ảnh nhân vật. `null` = chưa chọn nhân vật, cảnh vẽ ký hiệu tròn mặc định. */
  private hero: Phaser.GameObjects.Sprite | null = null;
  /** Hành động đang chạy. Đổi giá trị mới đổi hoạt ảnh. */
  private heroAction = '';
  /** Vị trí ở khung hình trước, để biết nhân vật có đang nhúc nhích hay không. */
  private lastPos = { x: 0, y: 0 };
  /** Số khung hình đứng yên liên tiếp. Xem `IDLE_AFTER_STILL_FRAMES`. */
  private stillFrames = 0;

  // KHÔNG đặt tên `data`: `Phaser.Scene` đã có sẵn một `data` là DataManager,
  // đè lên nó thì mất luôn API của Phaser và TypeScript báo lỗi kiểu.
  private sceneData!: StageSceneData;

  /** React bật cờ này khi con trỏ đang ở trong ô nhập — cảnh ngừng nhận WASD. */
  private typing = false;

  /**
   * Bảng câu hỏi đang mở — khoá cả chuột lẫn bàn phím.
   *
   * Khác `typing` ở chỗ `typing` chỉ chặn bàn phím (để gõ đáp án không làm nhân
   * vật chạy). Cái này chặn cả hai: đang trả lời câu hỏi mà nhân vật vẫn đi được
   * là họ tự đi ra khỏi phạm vi và bảng tự đóng giữa chừng.
   */
  private inputLocked = false;

  constructor() {
    super(StageScene.KEY);
  }

  init(data: StageSceneData) {
    this.sceneData = data;
  }

  setTypingGuard(typing: boolean) {
    this.typing = typing;
  }

  setInputLocked(locked: boolean) {
    this.inputLocked = locked;
    // Đang đi dở mà bảng mở ra thì dừng ngay, không trôi tiếp tới đích cũ.
    if (locked && this.player) this.tweens.killTweensOf(this.player);
  }

  preload() {
    // Đặt crossOrigin TRƯỚC mọi lệnh tải. Ảnh đến từ API (khác origin lúc dev);
    // đặt sau thì ảnh đã xếp hàng trước đó tải không kèm CORS và hỏng lặng lẽ —
    // đúng lỗi "chơi thử không thấy ảnh nền".
    this.load.crossOrigin = 'anonymous';

    // Đọc bộ nhạc TRƯỚC khi xếp hàng tải nền: nếu nhạc nền lấy từ tiếng video
    // thì tấm nền phải được nạp kèm đường tiếng, và đó là một tham số của chính
    // lệnh tải.
    this.audio = readAudio(this.sceneData.audio);
    this.ambientFromVideo = ambientFromVideo(this.audio, this.sceneData.backgroundKind);

    if (this.sceneData.backgroundUrl) {
      if (this.sceneData.backgroundKind === 'video') {
        // `noAudio: true` cho Phaser biết video không cần mở khoá âm thanh, nên
        // nó tự chạy được ngay. Đặt sai thành `false` khi màn không dùng tiếng
        // video là tự trói HÌNH vào một quyền mà màn này không cần xin.
        this.load.video(BG_VIDEO_KEY, this.sceneData.backgroundUrl, !this.ambientFromVideo);
      } else {
        this.load.image('stage_bg', this.sceneData.backgroundUrl);
      }
    }
    for (const quest of this.sceneData.quests) {
      if (quest.icon_url) this.load.image(`quest_icon_${quest.id}`, quest.icon_url);
    }

    // Spritesheet của nhân vật: một tấm dài chứa `frames` khung xếp NGANG. Khổ
    // khung do server tính sẵn — cắt sai một pixel là cả hoạt ảnh trượt khung.
    for (const sheet of this.sceneData.character?.sprites ?? []) {
      this.load.spritesheet(this.heroKey(sheet.action_key), sheet.url, {
        frameWidth: sheet.frame_width,
        frameHeight: sheet.frame_height,
      });
    }

    // Tiếng: nạp theo URL đã đóng băng trong đề bài. Khối nào chưa có file thì
    // không có gì để nạp, và cảnh vẫn chơi bình thường trong im lặng.
    for (const slot of AUDIO_SLOT_KEYS) {
      // Nhạc nền đến từ video thì file nhạc tải riêng KHÔNG được nạp. Nạp rồi
      // không phát cũng được, nhưng đó là bắt máy học sinh tải một file có thể
      // vài megabyte để rồi vứt đi.
      if (slot === 'ambient' && this.ambientFromVideo) continue;
      const url = this.sceneData.audioUrls?.[slot];
      if (url && this.audio[slot]?.media_id) this.load.audio(this.audioKey(slot), url);
    }

    // File hỏng thì bỏ qua, không để cả cảnh chết theo. Cảnh vẫn chơi được với
    // nền biển mặc định, và giáo viên vẫn thấy vật thể để sửa.
    //
    // Riêng TẤM NỀN còn được thử lại một lần ở `create()` — mất nền là mất cả
    // màn hình, không giống mất một cái icon.
    this.load.on('loaderror', (file: { key: string }) => {
      console.warn('[StageScene] không tải được:', file.key);
    });
  }

  create() {
    const centerX = WORLD_WIDTH / 2;
    const centerY = WORLD_HEIGHT / 2;

    // KHÔNG đặt `setBounds`: camera luôn hiện trọn thế giới, nên giới hạn cuộn
    // là thừa — và khi khung nhìn rộng hơn giới hạn, Phaser kẹp toạ độ cuộn lại
    // khiến cảnh bị lệch và trông như bị cắt mép.

    const ocean = this.add.graphics().setDepth(-2);
    ocean.fillGradientStyle(0x020b10, 0x020b10, 0x071e28, 0x071e28, 1);
    ocean.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Đi lại được trên CẢ bản đồ, chừa một lề quanh mép.
    //
    // Đây là mặc định trung thực duy nhất khi ảnh nền là tuỳ ý: cảnh không biết
    // chỗ nào trong ảnh của giáo viên là "sàn" và chỗ nào là "tường". Muốn có
    // vùng cấm thật thì phải để giáo viên vẽ nó trong trình thiết kế — đoán hộ
    // họ bằng một hình viết cứng thì luôn luôn sai.
    this.walkArea = new Phaser.Geom.Rectangle(
      WALK_MARGIN,
      WALK_MARGIN,
      WORLD_WIDTH - WALK_MARGIN * 2,
      WORLD_HEIGHT - WALK_MARGIN * 2,
    );

    this.collision = readCollision(this.sceneData.collision);
    // Nướng lưới NGAY sau khi có bản vẽ, không nướng lười lúc bấm lần đầu: một
    // mili giây lúc vào màn thì không ai thấy, còn một mili giây chen vào giữa
    // cú bấm đầu tiên thì thành một khựng nhẹ đúng lúc người chơi đang nhìn.
    this.grid = this.collision
      ? bakeGrid((x, y) => this.canWalk(x, y), { width: WORLD_WIDTH, height: WORLD_HEIGHT })
      : null;

    // Dựng nền; không dựng được thì thử tải lại MỘT lần — xem `retryBackground()`.
    if (!this.createBackground(centerX, centerY)) this.retryBackground(centerX, centerY);

    this.createStorm();
    this.createQuestProps(centerX, centerY);
    // Đứng lại đúng chỗ lần trước, nếu lượt chơi có ghi. Không có thì chỗ
    // XUẤT PHÁT giáo viên đặt cho màn này, và không có nữa thì chỗ mặc định.
    //
    // Thứ tự đó có lý do: `startPos` là chỗ người chơi đi tới, `spawnPos` là
    // chỗ người dựng chọn. Đảo lại thì thoát ra vào lại là một cách quay về
    // vạch xuất phát, và một lượt chơi dở dang mất hết chỗ đứng của cả đội.
    //
    // Chỗ ĐỨNG BAN ĐẦU đi qua cứu hộ trước khi đặt: `startPos` là chỗ lần
    // trước, mà giáo viên có thể đã vẽ lại vùng đi được kể từ đó — và cả chỗ
    // xuất phát lẫn chỗ mặc định đều chẳng có gì bảo đảm nằm trong bản vẽ của
    // họ. Đặt bừa vào rồi mới phát hiện là nhốt người chơi ngay từ giây đầu.
    const spawn = resolveSpawn(this.sceneData.spawnPos?.x, this.sceneData.spawnPos?.y);
    const start = this.rescueToWalkable(
      this.sceneData.startPos?.x ?? spawn.x,
      this.sceneData.startPos?.y ?? spawn.y,
    );
    this.createPlayer(start.x, start.y);

    // Camera hiện TOÀN BỘ thế giới, không bám theo nhân vật.
    //
    // Trước đây camera bám nhân vật ở zoom 1, tức nhìn qua một ô cửa sổ nhỏ vào
    // thế giới 3200×1800 — mọi thứ trông to gấp nhiều lần so với lúc thiết kế,
    // và giáo viên căn xong không nhận ra cảnh của mình.
    //
    // Fit toàn cảnh thì thứ căn trong trình thiết kế đúng bằng thứ hiện ra khi
    // chơi. Đó là điều kiện để "thiết kế" có nghĩa.
    this.fitCameraToWorld();
    this.scale.on('resize', () => this.fitCameraToWorld());
    // Lúc `create()` chạy, thẻ bọc có thể chưa có kích thước cuối cùng. Tính lại
    // ở khung hình sau để không phải khi nào cũng đúng nhờ may.
    this.time.delayedCall(0, () => this.fitCameraToWorld());

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      down: Phaser.Input.Keyboard.KeyCodes.X,
    }) as typeof this.keys;
    this.input.keyboard!.clearCaptures();

    this.input.on(
      'pointerdown',
      (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        // CHỈ nhận cú bấm rơi đúng vào thẻ canvas.
        //
        // Phaser nghe `pointerdown` ở `window`, nên nó thấy cả những cú bấm lên
        // HUD của React — nút ✕ đóng bảng, nút "?", nút rời màn. Bấm ✕ là nhân
        // vật nhảy luôn tới chỗ cái nút đó.
        //
        // Cờ `inputLocked` KHÔNG chặn được: Phaser xếp sự kiện DOM vào hàng đợi
        // rồi xử lý ở khung hình sau, mà React đã kịp mở khoá trong lúc đó.
        // Chặn theo NƠI CÚ BẤM RƠI XUỐNG thì không có cuộc đua nào cả.
        if (pointer.event.target !== this.game.canvas) return;
        if (this.inputLocked) return;
        // Bấm trúng vật thể thì handler của nó lo — nó ra lệnh đi tới đó.
        if (over.length > 0) return;

        // Bấm ra ngoài vùng KHÔNG bị bỏ qua: nhân vật đi theo hướng đó tới khi
        // chạm mép rồi dừng. Lờ cú bấm đi thì màn hình không phản hồi gì cả,
        // và người chơi tưởng game đơ chứ không nghĩ là mình bấm ra ngoài.
        this.goTo(pointer.worldX, pointer.worldY);
      },
    );

    // Khoá TRƯỚC rồi mới đánh dấu đã xong: một nhiệm vụ vừa khoá vừa xong là
    // chuyện không xảy ra, nhưng nếu có thì dấu ✓ phải là cái thắng.
    this.startAudio();

    for (const questId of this.sceneData.lockedQuestIds) this.markLocked(questId);
    for (const questId of this.sceneData.completedQuestIds) this.markCompleted(questId);

    // GẮN rồi phải GỠ. `EventBus` là một singleton của module, sống lâu hơn cả
    // Phaser: nó còn nguyên khi cảnh bị huỷ và một cảnh mới dựng lên.
    //
    // Không gỡ thì mỗi lần dựng lại cảnh — bấm "Chơi lại" giữa trận chẳng hạn —
    // để lại một bộ tai nghe trỏ vào một cảnh ĐÃ CHẾT. Lần nộp bài sau đó phát
    // `QUEST_COMPLETED`, tai nghe cũ chạy `markCompleted` trên những đối tượng
    // đã bị huỷ và NÉM LỖI; `emit` gọi tai nghe đồng bộ nên lỗi ấy bắn ngược
    // vào chỗ nộp bài, và người canh giữ im bặt giữa cuộc trò chuyện.
    //
    // Đã gặp thật, và đó đúng là cái người chơi gọi là "trả lời xong thì treo".
    this.nghe = [
      [
        GAME_EVENTS.QUEST_COMPLETED,
        (payload: { questId: string }) => {
          this.markCompleted(payload.questId);
          this.flashAt(payload.questId);
        },
      ],
      [GAME_EVENTS.QUESTS_UNLOCKED, () => this.unlockAll()],
      [GAME_EVENTS.STAGE_WON, () => this.showShardVfx()],
    ];
    for (const [ten, fn] of this.nghe) EventBus.on(ten, fn as never);

    // `shutdown` bắn khi cảnh dừng, `destroy` khi cả game bị gỡ. Nghe cả hai:
    // đường React gỡ `PhaserCanvas` đi qua `game.destroy()`, không qua
    // `scene.stop()`.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.thoiNghe());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.thoiNghe());

    // Có thể đã đứng sẵn trong một phạm vi ngay lúc vào màn.
    this.settleZone();

    // DÒNG CUỐI của `create()`, có chủ ý: `preload()` đã kéo xong mọi tài sản
    // và mọi thứ trên đã dựng xong, nên từ đây trở đi màn chơi chạy được thật.
    // Bắn sớm hơn một dòng là hứa một thứ chưa có.
    EventBus.emit(GAME_EVENTS.STAGE_READY);
  }

  /** Gỡ hết tai nghe khỏi `EventBus`. Gọi hai lần cũng không sao. */
  private thoiNghe() {
    for (const [ten, fn] of this.nghe) EventBus.off(ten, fn as never);
    this.nghe = [];
  }

  update(_time: number, delta: number) {
    // TRƯỚC mọi cửa chặn bên dưới: tấm nền phải đúng khổ kể cả lúc bảng câu hỏi
    // đang mở hay nhân vật chưa dựng xong.
    this.fitBgVideo();

    if (!this.player) return;

    // Chọn hoạt ảnh TRƯỚC các cửa chặn bên dưới: bảng câu hỏi mở ra là nhân vật
    // đứng yên, và lúc đó nó phải trở về `idle` chứ không đứng chôn chân giữa
    // một bước chạy.
    this.updateHeroMotion();

    if (this.typing || this.inputLocked) return;

    let vx = 0;
    let vy = 0;
    if (this.keys.up.isDown || this.cursors.up.isDown) vy -= 1;
    if (this.keys.down.isDown || this.cursors.down.isDown) vy += 1;
    if (this.keys.left.isDown || this.cursors.left.isDown) vx -= 1;
    if (this.keys.right.isDown || this.cursors.right.isDown) vx += 1;

    if (vx === 0 && vy === 0) {
      // Nhả hết phím = đã tới nơi. Đây là "điểm đích" của bàn phím, tương đương
      // lúc tween bấm chuột chạy xong.
      if (this.keyMoving) {
        this.keyMoving = false;
        this.settleZone();
      }
      return;
    }
    this.keyMoving = true;

    this.tweens.killTweensOf(this.player);

    const len = Math.hypot(vx, vy);
    const step = (MOVE_SPEED * delta) / 1000;
    const targetX = this.player.x + (vx / len) * step;
    const targetY = this.player.y + (vy / len) * step;

    // Chạm mép thì trượt dọc theo trục còn đi được, thay vì dừng khựng.
    if (this.canWalk(targetX, targetY)) {
      this.player.setPosition(targetX, targetY);
    } else if (this.canWalk(targetX, this.player.y)) {
      this.player.x = targetX;
    } else if (this.canWalk(this.player.x, targetY)) {
      this.player.y = targetY;
    }

    this.afterMove();

    // Bàn phím không có "điểm đích", nên luật tương đương là: CHẠM vào khung thì
    // dừng và mở luôn, không đợi nhả phím. Cùng một quy tắc với chuột — chạm
    // khung là vào nhiệm vụ.
    if (this.nodeAtPoint(this.player.x, this.player.y)) {
      this.keyMoving = false;
      this.settleZone();
    }
  }

  // ------------------------------------------------------------------ camera

  /**
   * Đặt zoom sao cho vừa trọn thế giới trong khung hình hiện tại.
   *
   * `Math.min` chứ không phải `max`: lấy chiều chật hơn làm chuẩn thì toàn cảnh
   * lọt vào trong, lấy chiều rộng hơn thì mép bị cắt.
   */
  private fitCameraToWorld() {
    const camera = this.cameras.main;
    if (camera.width === 0 || camera.height === 0) return;

    const zoom = Math.min(camera.width / WORLD_WIDTH, camera.height / WORLD_HEIGHT);
    camera.setZoom(zoom);
    camera.centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.rescaleLabels(zoom);
  }

  /**
   * Giữ cỡ chữ KHÔNG ĐỔI trên màn hình, bất kể camera thu phóng bao nhiêu.
   *
   * Trình thiết kế vẽ nhãn bằng CSS cỡ cố định, không co theo khung. Muốn "chơi
   * y như lúc thiết kế" thì nhãn ở đây cũng phải cư xử như vậy — để nó co theo
   * cảnh là thu cả thế giới cho vừa khung xong chữ nhỏ tới mức không đọc nổi.
   */
  private rescaleLabels(zoom: number) {
    if (zoom <= 0) return;

    // Cỡ trên màn hình = FONT × scale × zoom. Muốn nó bằng LABEL.SCREEN thì:
    //
    //     scale = SCREEN / (FONT × zoom)
    //
    // Lần trước tôi đặt scale = 1/zoom, tức cỡ màn hình bằng đúng FONT (40px) —
    // to gần bốn lần so với 11px bên trình thiết kế.
    const scale = LABEL.SCREEN / (LABEL.FONT * zoom);
    const gapWorld = LABEL.GAP / zoom;

    for (const node of this.nodes) {
      node.label.setScale(scale);
      // Y đặt lên THÙNG BỌC: nhãn phải nằm ở gốc (0,0) của thùng thì nhịp thở
      // mới phình ra tại chỗ. Để nhãn lệch khỏi gốc là mỗi nhịp phóng to lại
      // đẩy nó ra xa thêm, và cái tên nhấp nhô lên xuống thay vì to nhỏ.
      node.labelWrap.setY(-node.halfHeight - gapWorld);
    }
  }

  // ------------------------------------------------------------------ di chuyển

  private canWalk(x: number, y: number): boolean {
    // Có bản vẽ thì lề quanh mép KHÔNG áp dụng nữa. Giáo viên đã nói bằng tay
    // chỗ nào đi được; một cái lề vô hình đè lên trên là công cụ nói dối chính
    // người vừa dùng nó.
    if (this.collision) return canWalkAt(this.collision, x, y);
    return Phaser.Geom.Rectangle.Contains(this.walkArea, x, y);
  }

  /**
   * Điểm xa nhất trên đường từ nhân vật tới `(x, y)` mà vẫn còn trong vùng đi lại.
   *
   * Đích nằm trong vùng thì trả lại chính nó. Nằm ngoài thì trả về chỗ đường đi
   * chạm mép — nhân vật đi đúng hướng người chơi chỉ, rồi dừng ở đó.
   *
   * Hai bước, không phải một: **dò tiến** từng đoạn ngắn để tìm lần RA KHỎI ĐẦU
   * TIÊN, rồi mới **chia đôi** trong đoạn hẹp đó. Với hình chữ nhật thì chia đôi
   * thẳng từ đầu cũng đúng, nhưng cách này không phụ thuộc vào HÌNH DẠNG của
   * vùng: khi nào giáo viên vẽ được vùng cấm riêng — có thể lõm — thì "trong hay
   * ngoài" thôi đơn điệu theo quãng đường, và chia đôi sẽ vớ phải lần cắt sau,
   * tức cho nhân vật xuyên tường.
   */
  private clampToWalkArea(x: number, y: number): { x: number; y: number } {
    if (this.canWalk(x, y)) return { x, y };

    // Nhân vật đã ở ngoài vùng (lượt chơi cũ, hoặc giáo viên vừa vẽ lại): kéo
    // thẳng về trong. Trả `null` như trước là để họ kẹt vĩnh viễn — không cú
    // bấm nào cứu được, phải tải lại trang.
    if (!this.canWalk(this.player.x, this.player.y)) return this.rescueToWalkable(x, y);

    return this.furthestAlong(x, y);
  }

  /**
   * Điểm XA NHẤT trên đoạn thẳng từ nhân vật tới `(x, y)` mà vẫn đi được.
   *
   * Đường lui khi không tìm được lối đi nào tới đích: nhân vật vẫn nhích đúng
   * hướng người chơi chỉ rồi dừng ở tường, thay vì đứng im như bấm hụt.
   */
  private furthestAlong(x: number, y: number): { x: number; y: number } {
    const fromX = this.player.x;
    const fromY = this.player.y;
    const at = (t: number) => ({ x: fromX + (x - fromX) * t, y: fromY + (y - fromY) * t });

    // Bước dò ~8px thế giới: đủ mịn để không nhảy qua một mũi nhô hẹp.
    const distance = Math.hypot(x - fromX, y - fromY);
    const steps = Math.max(16, Math.ceil(distance / 8));

    let lastInside = 0;
    let firstOutside = 1;
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const point = at(t);
      if (this.canWalk(point.x, point.y)) {
        lastInside = t;
      } else {
        firstOutside = t;
        break;
      }
    }

    // Chia đôi trong đoạn đã biết chắc là trong → ngoài.
    for (let i = 0; i < 24; i += 1) {
      const mid = (lastInside + firstOutside) / 2;
      const point = at(mid);
      if (this.canWalk(point.x, point.y)) lastInside = mid;
      else firstOutside = mid;
    }

    // Lùi lại vài pixel khỏi mép: dừng đúng trên đường biên thì sai số dấu phẩy
    // động có thể đẩy nhân vật ra ngoài, và bước tiếp theo không đi được nữa.
    const backoff = distance > 0 ? Math.min(4, distance * lastInside) / distance : 0;
    return at(Math.max(0, lastInside - backoff));
  }

  /**
   * Chỗ đi được GẦN `(x, y)` nhất. Trả lại chính nó nếu đã đi được.
   *
   * Đây là cái phao, không phải một tính năng — nhưng thiếu nó thì có một cách
   * chắc chắn để hỏng: giáo viên vẽ lại vùng đi được, một lượt chơi cũ ghi chỗ
   * đứng nằm ngoài bản vẽ mới, và người chơi vào màn là **kẹt cứng** — không cú
   * bấm hay phím nào ăn nữa, phải tải lại trang, mà tải lại cũng vẫn thế.
   *
   * Phép quét ở `collision.ts`, dùng chung với chế độ đi thử của trình thiết
   * kế. Truyền vào `canWalk` CỦA CẢNH chứ không phải bản vẽ trần: cảnh còn cộng
   * cái lề quanh mép khi chưa ai vẽ gì.
   */
  private rescueToWalkable(x: number, y: number): { x: number; y: number } {
    return (
      nearestWalkable((px, py) => this.canWalk(px, py), x, y, WORLD) ?? { x, y }
    );
  }

  /**
   * Gọi sau MỖI bước di chuyển, kể cả giữa đường.
   *
   * Cố ý KHÔNG mở nhiệm vụ ở đây — xem `settleZone()`.
   */
  private afterMove() {
    EventBus.emit(GAME_EVENTS.PLAYER_MOVED, { x: this.player.x, y: this.player.y });

    // RỜI phạm vi thì báo ngay giữa đường, không đợi tới đích: đi ra là bảng
    // phải đóng. Vào thì ngược lại — phải dừng hẳn mới tính.
    if (this.nearId && !this.nodeContaining(this.nearId)) {
      EventBus.emit(GAME_EVENTS.QUEST_ZONE_LEFT, { questId: this.nearId });
      this.nearId = null;
    }
  }

  /**
   * Đi theo một chuỗi chặng, mỗi chặng một tween nối đuôi nhau.
   *
   * `ease: 'Linear'` chứ không phải `Power1`, và đó là bắt buộc khi có nhiều
   * chặng: `Power1` giảm tốc ở cuối MỖI tween, nên một con đường vòng qua vật
   * cản sẽ thành đi-khựng-đi-khựng ở mỗi khúc cua.
   *
   * Sàn 250ms chỉ áp cho chặng CUỐI. Áp cho mọi chặng thì một khúc cua dài 30
   * đơn vị cũng ngốn một phần tư giây, và đường vòng ba khúc đi chậm hơn hẳn
   * đường thẳng cùng độ dài.
   */
  private movePlayerAlong(path: { x: number; y: number }[]) {
    this.tweens.killTweensOf(this.player);
    if (path.length === 0) return;

    const walkLeg = (index: number) => {
      const leg = path[index];
      if (!leg) {
        // Hết chặng: TỚI NƠI. Chỉ ở đây mới xét việc mở nhiệm vụ.
        this.settleZone();
        return;
      }
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        leg.x,
        leg.y,
      );
      const span = (distance / MOVE_SPEED) * 1000;
      this.tweens.add({
        targets: this.player,
        x: leg.x,
        y: leg.y,
        duration: index === path.length - 1 ? Math.max(250, span) : Math.max(16, span),
        ease: 'Linear',
        // Giữa đường chỉ cập nhật viền và xét việc RỜI phạm vi.
        onUpdate: () => this.afterMove(),
        // Tween bị huỷ giữa chừng thì Phaser không gọi `onComplete`, nên bấm
        // sang chỗ khác là cả chuỗi chặng còn lại cũng dừng theo.
        onComplete: () => walkLeg(index + 1),
      });
    };

    walkLeg(0);
  }

  /**
   * Đường đi tới `(x, y)`: thẳng nếu thông, vòng nếu vướng, tới sát tường nếu
   * chỗ đó không có đường nào tới được.
   */
  private pathTo(x: number, y: number): { x: number; y: number }[] {
    if (!this.grid) return [{ x, y }];
    const walkable = (px: number, py: number) => this.canWalk(px, py);
    const from = { x: this.player.x, y: this.player.y };
    return (
      findPath(this.grid, walkable, from, { x, y }) ?? [this.furthestAlong(x, y)]
    );
  }

  /**
   * Điểm CHẠM đầu tiên vào khung của nhiệm vụ chứa `(toX, toY)`.
   *
   * Đích nằm ngoài mọi khung thì trả lại nguyên đích — đó là đường "đi xuyên
   * qua", giữ nguyên như cũ.
   *
   * Đích nằm TRONG một khung thì dừng ngay ở mép, không đi tiếp vào tâm. Đi vào
   * tâm nghĩa là nhân vật lọt hẳn vào giữa ảnh của vật thể rồi bảng mới mở —
   * trông như nhân vật chui vào trong cái rương chứ không phải đứng cạnh nó.
   *
   * Tìm t NHỎ NHẤT mà điểm đã nằm trong khung (ngược với `clampToWalkArea`, vốn
   * tìm t lớn nhất còn nằm ngoài vùng cấm).
   */
  private stopAtQuestEdge(
    node: QuestNode,
    from: { x: number; y: number },
    toX: number,
    toY: number,
  ): { x: number; y: number } {
    const fromX = from.x;
    const fromY = from.y;
    // Đã đứng sẵn trong khung thì không phải đi đâu cả.
    if (Phaser.Geom.Rectangle.Contains(node.box, fromX, fromY)) return { x: fromX, y: fromY };

    const distance = Math.hypot(toX - fromX, toY - fromY);
    if (distance === 0) return { x: toX, y: toY };

    const at = (t: number) => ({ x: fromX + (toX - fromX) * t, y: fromY + (toY - fromY) * t });
    const inBox = (t: number) => {
      const point = at(t);
      return Phaser.Geom.Rectangle.Contains(node.box, point.x, point.y);
    };

    const steps = Math.max(16, Math.ceil(distance / 8));
    let lastOutside = 0;
    let firstInside = 1; // đích chắc chắn nằm trong khung, nên t = 1 luôn đúng
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      if (inBox(t)) {
        firstInside = t;
        break;
      }
      lastOutside = t;
    }

    for (let i = 0; i < 24; i += 1) {
      const mid = (lastOutside + firstInside) / 2;
      if (inBox(mid)) firstInside = mid;
      else lastOutside = mid;
    }

    // Nhích thêm vài pixel VÀO TRONG: dừng đúng trên đường biên thì sai số dấu
    // phẩy động có thể làm `Contains` trả false, và bảng không mở.
    return at(Math.min(1, firstInside + 4 / distance));
  }

  /**
   * Đi tới một vật thể nhiệm vụ.
   *
   * Đi vào TÂM khung ảnh, vì khung ảnh chính là vùng kích hoạt — dừng ở mép thì
   * chỉ cần lệch một pixel là không vào được, và người chơi không hiểu vì sao.
   */
  private walkToQuest(node: QuestNode) {
    // Nhắm vào TÂM khung: `goTo()` sẽ tự rút lại về mép, hoặc mở luôn nếu nhân
    // vật đã đứng sẵn trong đó.
    this.goTo(node.x, node.y);
  }

  /**
   * Cửa duy nhất cho mọi lệnh "đi tới đây" — bấm nền hay bấm vật thể đều qua đây.
   *
   * Ba nhánh, theo đúng thứ tự:
   *
   *   1. Đích rơi vào khung một nhiệm vụ mà nhân vật **đã đứng sẵn trong đó** →
   *      mở bảng ngay, không đi đâu cả. Trước đây nhánh này rơi vào một tween
   *      dài 250ms tới chính chỗ đang đứng, rồi `settleZone()` thấy phạm vi
   *      không đổi nên im lặng — bấm mãi không có gì xảy ra.
   *   2. Đích rơi vào khung một nhiệm vụ khác → đi tới **mép khung** rồi dừng.
   *   3. Đích ngoài mọi khung → đi thẳng tới đó, xuyên qua vật thể nào cũng không mở.
   */
  private goTo(worldX: number, worldY: number) {
    const walk = this.clampToWalkArea(worldX, worldY);
    const node = this.nodeAtPoint(walk.x, walk.y);

    if (node && Phaser.Geom.Rectangle.Contains(node.box, this.player.x, this.player.y)) {
      this.enterZone(node, true);
      return;
    }

    const path = this.pathTo(walk.x, walk.y);

    // Cắt chặng CUỐI lại ở mép khung nhiệm vụ, và đo từ chặng ÁP CHÓT chứ không
    // từ chỗ nhân vật đang đứng: đường vòng qua vật cản có thể tới cái rương từ
    // một hướng hoàn toàn khác hướng nhìn thẳng, và đo nhầm gốc thì điểm dừng
    // rơi ra ngoài khung.
    const last = path.length - 1;
    const end = path[last];
    if (node && end) {
      const approach = last > 0 ? path[last - 1]! : { x: this.player.x, y: this.player.y };
      path[last] = this.stopAtQuestEdge(node, approach, end.x, end.y);
    }

    this.movePlayerAlong(path);
  }

  /**
   * Báo "vào phạm vi nhiệm vụ này".
   *
   * `force` dùng khi người chơi bấm lại vào chính khung họ đang đứng trong: phạm
   * vi không đổi nên bình thường sẽ không phát gì, nhưng ý định của họ rõ ràng
   * là muốn mở lại bảng.
   */
  private enterZone(node: QuestNode, force = false) {
    if (this.nearId === node.id) {
      if (force) EventBus.emit(GAME_EVENTS.QUEST_ZONE_ENTERED, { questId: node.id });
      return;
    }
    if (this.nearId) EventBus.emit(GAME_EVENTS.QUEST_ZONE_LEFT, { questId: this.nearId });
    this.nearId = node.id;
    EventBus.emit(GAME_EVENTS.QUEST_ZONE_ENTERED, { questId: node.id });
  }

  /** Nhiệm vụ có khung chứa điểm này. Chồng nhau thì lấy cái có tâm gần nhất. */
  private nodeAtPoint(x: number, y: number): QuestNode | null {
    let nearest: QuestNode | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const node of this.nodes) {
      if (!Phaser.Geom.Rectangle.Contains(node.box, x, y)) continue;
      const distance = Phaser.Math.Distance.Between(x, y, node.x, node.y);
      if (distance < best) {
        best = distance;
        nearest = node;
      }
    }
    return nearest;
  }

  /** Nhân vật có còn trong khung của nhiệm vụ này không. */
  private nodeContaining(questId: string): boolean {
    const node = this.nodes.find((n) => n.id === questId);
    return !!node && Phaser.Geom.Rectangle.Contains(node.box, this.player.x, this.player.y);
  }

  /**
   * Đã DỪNG LẠI — xét xem có mở nhiệm vụ không.
   *
   * Đây là chỗ khác hẳn bản trước. Bản trước xét phạm vi ở MỖI khung hình khi
   * đang đi, nên đi ngang qua một vật thể trên đường tới chỗ khác là bảng câu hỏi
   * bật lên giữa chừng — người chơi không hề định vào đó.
   *
   * Giờ mở nhiệm vụ là việc CÓ CHỦ Ý: chỉ tính khi điểm dừng nằm trong khung.
   * Bấm chuột vào giữa khung, hoặc bấm thẳng vào vật thể, hoặc gõ phím tới đó rồi
   * nhả tay — cả ba đều là "tôi muốn vào đây". Đi xuyên qua thì không.
   */
  private settleZone() {
    const nearest = this.nodeAtPoint(this.player.x, this.player.y);

    if (!nearest) {
      if (this.nearId) EventBus.emit(GAME_EVENTS.QUEST_ZONE_LEFT, { questId: this.nearId });
      this.nearId = null;
      return;
    }
    this.enterZone(nearest);
  }

  // ------------------------------------------------------------------ dựng cảnh

  /**
   * Dựng tấm nền từ thứ ĐÃ NẰM TRONG KHO của Phaser.
   *
   * Trả về `false` khi kho chưa có gì — hoặc màn này vốn không có nền, hoặc
   * file tải hỏng. Chỗ gọi phân biệt hai trường hợp đó bằng `backgroundUrl`.
   *
   * Tách thành hàm riêng vì nó được gọi ở HAI thời điểm: lúc dựng cảnh, và lần
   * nữa sau khi tải lại. Chiều sâu 0 đứng sau mọi thứ khác (bão ở 4, vật thể ở
   * 10, nhân vật ở 20), nên thêm muộn vẫn nằm đúng dưới đáy — Phaser xếp lớp
   * theo `depth`, không theo thứ tự thêm vào.
   */
  private createBackground(centerX: number, centerY: number): boolean {
    if (this.cache.video.exists(BG_VIDEO_KEY)) {
      // Quên khổ của lần dựng TRƯỚC. Cảnh này dựng lại khi đổi màn hay đổi cỡ
      // cửa sổ, mà trường này sống lâu hơn thẻ video: giữ lại số cũ thì
      // `fitBgVideo()` thấy "khổ không đổi" và bỏ qua, trong khi thẻ video mới
      // đang ở tỉ lệ 1. Cùng một cái bẫy với `this.heroAction = ''` bên
      // `createPlayer()`.
      this.bgVideoSize = { w: 0, h: 0 };
      const bg = this.add.video(centerX, centerY, BG_VIDEO_KEY);
      bg.setOrigin(0.5).setDepth(0);
      bg.setLoop(true);
      // CÂM trước, phát sau. Trình duyệt chỉ chặn tiếng tự phát chứ không chặn
      // video câm, nên khung hình chạy ngay kể cả khi chưa ai chạm vào trang.
      // `applyVideoSound()` mới là chỗ mở tiếng, và chỉ khi được phép.
      bg.setMute(true);

      // Khổ khung KHÔNG đặt ở đây — xem `fitBgVideo()` và chú thích của nó.
      bg.play(true);

      this.bgVideo = bg;
      this.applyVideoSound();
      return true;
    }

    if (this.textures.exists('stage_bg')) {
      const bg = this.add.image(centerX, centerY, 'stage_bg');
      bg.setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT);
      bg.setOrigin(0.5).setDepth(0);
      return true;
    }

    return false;
  }

  /**
   * Tải lại tấm nền MỘT lần nữa, sau khi lần đầu hỏng.
   *
   * Vì sao đáng làm: nền là một file có thể vài megabyte, và một lượt tải trượt
   * — mạng trường học chập chờn, server vừa khởi động lại — thì học sinh chơi
   * hết cả màn trên một khung hình đen. Không có nút nào để thử lại, và không
   * có gì trên màn hình nói cho họ biết chuyện gì vừa xảy ra. Trước đây chỗ này
   * chỉ ghi một dòng vào console rồi thôi.
   *
   * Đúng MỘT lần, không phải vòng lặp: nếu file thật sự hỏng hoặc đã bị xoá thì
   * thử mãi cũng thế, mà mỗi lần thử là thêm vài megabyte trên đường truyền vốn
   * đã yếu. Hỏng lần hai thì cảnh chơi tiếp với nền biển tự vẽ — mất tấm nền
   * vẫn còn chơi được, đó là cả lý do cảnh có nền dự phòng.
   */
  private retryBackground(centerX: number, centerY: number) {
    const url = this.sceneData.backgroundUrl;
    if (!url || this.bgRetried) return;
    this.bgRetried = true;

    if (this.sceneData.backgroundKind === 'video') {
      this.load.video(BG_VIDEO_KEY, url, !this.ambientFromVideo);
    } else {
      this.load.image('stage_bg', url);
    }

    // `once`, và gỡ luôn sau một lần: cảnh này còn tải thêm thứ khác về sau
    // (spritesheet của nhân vật khi người chơi đổi), mà mỗi lần tải xong lại
    // dựng thêm một tấm nền nữa là chồng nhiều lớp lên nhau.
    this.load.once('complete', () => {
      // Cảnh có thể đã bị đóng trong lúc chờ — đổi màn, thoát ra. Dựng thêm
      // một đối tượng vào một cảnh đã chết là một lỗi khó lần ra.
      if (!this.scene.isActive()) return;
      this.createBackground(centerX, centerY);
    });
    this.load.start();
  }

  private createStorm() {
    for (let i = 0; i < 90; i += 1) {
      const rx = Phaser.Math.Between(50, WORLD_WIDTH - 50);
      const ry = Phaser.Math.Between(50, WORLD_HEIGHT - 50);
      const drop = this.add.line(0, 0, rx, ry, rx - 18, ry + 36, 0x9be8ff, 0.35).setDepth(4);
      this.tweens.add({
        targets: drop,
        x: '-=180',
        y: '+=360',
        alpha: { from: 0.45, to: 0.05 },
        duration: Phaser.Math.Between(450, 750),
        repeat: -1,
        delay: Phaser.Math.Between(0, 1000),
      });
    }

    const flash = this.add
      .rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 0xffffff, 0)
      .setDepth(5);
    this.time.addEvent({
      delay: 5000,
      loop: true,
      callback: () => {
        if (Phaser.Math.Between(1, 10) > 4) {
          this.tweens.add({
            targets: flash,
            alpha: { from: 0, to: 0.3 },
            duration: 90,
            yoyo: true,
            repeat: 1,
          });
        }
      },
    });
  }

  /**
   * Dựng vật thể nhiệm vụ TỪ DỮ LIỆU, mỗi cái kèm một vòng phạm vi.
   *
   * Nhiệm vụ nào không có toạ độ thì rải đều theo vòng tròn quanh tâm boong —
   * giáo viên dựng màn chưa cần biết Phaser cũng có một cảnh chơi được.
   */
  private createQuestProps(centerX: number, centerY: number) {
    const total = this.sceneData.quests.length || 1;

    this.nodes = this.sceneData.quests.map((quest, index) => {
      const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
      const x = quest.scene_x ?? centerX + Math.cos(angle) * 520;
      const y = quest.scene_y ?? centerY + Math.sin(angle) * 300;

      const isAdvisor = quest.phase === 'advisor';

      const container = this.add.container(x, y).setDepth(isAdvisor ? 15 : 10);

      /**
       * Ảnh của vật thể — hoặc KHÔNG CÓ GÌ CẢ.
       *
       * Chưa tải ảnh thì chỗ này để trống hẳn: chỉ còn cái tên nổi trên nền, và
       * vùng va chạm vô hình vẫn bấm được, vẫn chặn bước chân như thường.
       *
       * Trước đây chỗ này vẽ một vòng sáng màu thay thế. Nó có vẻ hữu ích —
       * "phải thấy cái gì đó chứ" — nhưng đó là một vật thể MÀ KHÔNG AI CHỌN
       * ĐẶT VÀO CẢNH: người dựng nền vẽ một cái rương lên boong tàu rồi đặt
       * vùng va chạm chồng lên đúng cái rương ấy sẽ thấy một quả bóng tím lơ
       * lửng đè lên nó. Không vẽ gì là câu trả lời đúng cho "chưa có ảnh", vì
       * ảnh có thể đã nằm sẵn trong nền rồi.
       */
      const iconKey = `quest_icon_${quest.id}`;
      const artwork: Phaser.GameObjects.Image | null =
        quest.icon_url && this.textures.exists(iconKey)
          ? (() => {
              const image = this.add.image(0, 0, iconKey);
              // Đặt theo BỀ RỘNG và giữ tỉ lệ gốc: ép cả hai chiều là ảnh của
              // giáo viên bị bóp méo, và họ không hiểu vì sao.
              const width = quest.icon_size ?? DEFAULT_ICON_SIZE;
              image.setDisplaySize(width, width * (image.height / image.width));
              return image;
            })()
          : null;

      // Cỡ chữ gốc lớn, rồi thu lại ở `rescaleLabels()` cho đúng cỡ màn hình.
      //
      // Chữ trắng viền đen, KHÔNG có khung nền. Bốn cái hộp đen nổi trên boong
      // tàu che mất chính cái cảnh mà chúng đang chú thích; nét viền đọc được
      // trên nền sáng lẫn nền tối mà không lấy đi một mảng hình nào.
      //
      // Phaser vẽ `strokeText` TRƯỚC rồi `fillText` đè lên, nên nửa trong của
      // nét viền bị chữ trắng phủ lại — viền nằm gọn bên ngoài, không ăn mỏng
      // glyph. Đây cũng chính là `paint-order: stroke fill` bên CSS.
      const label = this.add
        .text(0, 0, (isAdvisor ? '⚓ ' : '') + quest.label, {
          fontSize: `${LABEL.FONT}px`,
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: LABEL.STROKE,
          // Đệm vừa đủ chỗ cho nét viền tràn ra ngoài glyph. Không có nền nên
          // nó vô hình; bỏ hẳn thì Phaser cắt cụt viền ở mép texture.
          padding: { x: LABEL.STROKE, y: LABEL.STROKE },
        })
        // Neo ĐÁY nhãn: đặt y = mép trên ảnh là nhãn nằm gọn phía trên, không
        // đè lên hình.
        .setOrigin(0.5, 1);

      // Thùng bọc để nhịp thở có chỗ ghi `scale` của riêng nó — xem `QuestNode`.
      // Nhãn nằm ở GỐC của thùng; chỗ đứng do thùng mang, `rescaleLabels()` đặt.
      const labelWrap = this.add.container(0, 0, [label]);

      // Kích thước khung lấy từ ẢNH THẬT: bề rộng do giáo viên đặt, chiều cao
      // suy ra theo tỉ lệ gốc. Nhờ vậy vùng va chạm luôn khớp cái nhìn thấy.
      const boxWidth = quest.icon_size ?? DEFAULT_ICON_SIZE;
      // Không có ảnh thì khung VUÔNG theo bề rộng — đúng bằng ô người dựng kéo
      // trong trình thiết kế, nơi chỗ giữ chỗ cũng là một ô vuông.
      const boxHeight = artwork ? artwork.displayHeight : boxWidth;

      const box = new Phaser.Geom.Rectangle(
        x - boxWidth / 2,
        y - boxHeight / 2,
        boxWidth,
        boxHeight,
      );

      // Chỉ là vùng bấm. Hình chữ nhật không tô nền và không viền vẫn nhận được
      // cú bấm trong phạm vi của nó, nên nó vô hình mà vẫn làm đúng việc.
      const hitArea = this.add.rectangle(x, y, boxWidth, boxHeight).setDepth(2);

      const node: QuestNode = {
        id: quest.id,
        x,
        y,
        box,
        hitArea,
        label,
        labelWrap,
        halfHeight: boxHeight / 2,
        container,
        completed: false,
        locked: false,
      };

      // Bấm vào vật thể = RA LỆNH ĐI TỚI, không phải mở câu hỏi.
      // Cả ảnh lẫn nhãn đều bấm được — đích bấm nhỏ là thứ khó chịu nhất trên
      // màn hình cảm ứng. Không có ảnh thì `hitArea` gánh cả phần đó: nó là một
      // hình chữ nhật KHÔNG tô nền, vô hình mà vẫn nhận cú bấm trong phạm vi
      // của mình, nên vật thể "tàng hình" vẫn bấm được đúng chỗ nhìn thấy tên.
      for (const target of artwork ? [artwork, label, hitArea] : [label, hitArea]) {
        target.setInteractive({ useHandCursor: true });
        target.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          (pointer.event as Event).stopPropagation();
          if (this.inputLocked) return;
          this.walkToQuest(node);
        });
      }

      // NHỊP THỞ — phóng to thu nhỏ liên tục, theo hai con số giáo viên đặt.
      //
      // Nhân với tỉ lệ ĐANG CÓ chứ không đặt tỉ lệ tuyệt đối: `setDisplaySize()`
      // ở trên đã để lại `scaleX` cỡ 0,3 cho một ảnh 400px thu về 120px. Tween
      // thẳng tới `1.08` sẽ phóng ảnh lên gấp ba rồi giữ nguyên ở đó.
      //
      // Chỉ đổi CÁCH VẼ. `box` và `hitArea` giữ nguyên kích thước gốc — cho
      // vùng bấm phập phồng theo là để đích bấm chạy dưới tay người chơi, và
      // chỗ nhân vật dừng lại đổi theo từng khoảnh khắc.
      //
      // ẢNH **VÀ** NHÃN cùng thở, một nhịp chung. Nhãn phải thở vì nó có thể là
      // thứ DUY NHẤT nhìn thấy: vật thể không có ảnh thì chỉ còn cái tên, và
      // một cái tên đứng im giữa cảnh trông như chữ chú thích chứ không như một
      // chỗ bấm được.
      //
      // Nhãn thở qua `labelWrap` chứ không thở trực tiếp — xem `QuestNode`, chỗ
      // giải thích vì sao hai hệ không được dùng chung một `scale`.
      const pulse = resolvePulse(quest.pulse_percent, quest.pulse_period_ms);
      if (pulse) {
        // MỘT tween cho cả hai, không phải hai tween song song: hai tween rời
        // bắt đầu cùng lúc nhưng trôi dần khỏi nhau, và tới một lúc nào đó ảnh
        // đang phình thì chữ đang co.
        const targets = artwork ? [artwork, labelWrap] : [labelWrap];
        this.tweens.add({
          targets,
          // Nhân với tỉ lệ ĐANG CÓ của từng đích: ảnh có thể đang ở scale 0,3
          // sau `setDisplaySize()`, còn thùng bọc thì luôn ở 1. Hàm nhận đích
          // làm tham số nên mỗi cái tự nhân với số của mình.
          scaleX: (t: Phaser.GameObjects.Components.Transform) => t.scaleX * pulse.maxScale,
          scaleY: (t: Phaser.GameObjects.Components.Transform) => t.scaleY * pulse.maxScale,
          duration: pulse.halfCycleMs,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1,
        });
      }

      container.add(artwork ? [artwork, labelWrap] : [labelWrap]);
      // Nhãn vẽ sau ảnh nên luôn nằm trên, không bị hình che.
      container.bringToTop(labelWrap);
      return node;
    });
  }

  private createPlayer(x: number, y: number) {
    this.player = this.add.container(x, y).setDepth(20);
    this.lastPos = { x, y };

    // Xoá hành động cũ TRƯỚC khi dựng: cảnh dựng lại (đổi màn, đổi kích thước
    // cửa sổ) mà cờ này còn giữ 'walk' thì `playHeroAction` tưởng không có gì
    // đổi, bỏ qua luôn cả bước chuẩn hoá cỡ, và nhân vật hiện ra to bằng cả màn.
    this.heroAction = '';
    this.hero = this.createHero();

    // Vòng sáng dưới chân rộng theo cỡ NHÂN VẬT đang đứng trên nó. Một cái bóng
    // 60px dưới chân một nhân vật cao 160px trông như nó đang lơ lửng.
    const auraWidth = this.hero ? this.hero.displayWidth * 0.6 : 60;
    const aura = this.add.ellipse(0, HERO_FOOT_Y, auraWidth, auraWidth / 2, 0x00f0ff, 0.4);
    aura.setStrokeStyle(2.5, 0x00f0ff, 0.95);

    if (this.hero) {
      this.player.add([aura, this.hero]);
    } else {
      // Chưa chọn nhân vật thì vẫn phải có gì đó để nhìn thấy mình đang ở đâu.
      const body = this.add.circle(0, 0, 22, 0x00f0ff);
      body.setStrokeStyle(3, 0xffffff);
      const icon = this.add.text(0, 0, '👑', { fontSize: '20px' }).setOrigin(0.5);
      this.player.add([aura, body, icon]);
    }

    this.tweens.add({
      targets: aura,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
  }

  /** Khoá texture của một hành động. Kèm ID nhân vật: đổi nhân vật là đổi ảnh,
   * mà Phaser giữ texture theo khoá trong suốt vòng đời của game. */
  private heroKey(action: string) {
    return `hero_${this.sceneData.character?.id ?? 'none'}_${action}`;
  }

  /**
   * Dựng ảnh nhân vật và đăng ký hoạt ảnh cho MỌI hành động tải được.
   *
   * Đăng ký hết một lượt ở đây, không đăng ký lúc cần: `anims.create()` giữa lúc
   * chơi là một cú khựng, mà lúc cần chính là lúc người chơi vừa bấm đi.
   *
   * `frames = 1` là hợp lệ — ảnh một khung, vẽ như hình tĩnh, không có hoạt ảnh
   * nào để tạo.
   */
  private createHero(): Phaser.GameObjects.Sprite | null {
    // Chỉ những tấm THỰC SỰ tải được. Một hành động hỏng ảnh mà vẫn dựng thì
    // nhân vật biến mất đúng lúc chuyển sang hành động đó.
    const ready = (this.sceneData.character?.sprites ?? []).filter((sheet) =>
      this.textures.exists(this.heroKey(sheet.action_key)),
    );
    // Ưu tiên `idle`; nhân vật chưa có `idle` thì lấy tấm đầu tiên — đứng hình
    // bằng ảnh `walk` vẫn hơn là không có nhân vật.
    const first = ready.find((sheet) => sheet.action_key === DEFAULT_ACTION) ?? ready[0];
    if (!first) return null;

    for (const sheet of ready) {
      const key = this.heroKey(sheet.action_key);
      if (sheet.frames < 2 || this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(key, { start: 0, end: sheet.frames - 1 }),
        frameRate: sheet.frame_rate,
        repeat: -1,
      });
    }

    // Gốc toạ độ ở GIỮA-DƯỚI: nhân vật đứng trên cái bóng, và đổi sang một tấm
    // khổ khác thì chân vẫn ở nguyên chỗ cũ thay vì trồi lên thụt xuống.
    const hero = this.add.sprite(0, HERO_FOOT_Y, this.heroKey(first.action_key));
    hero.setOrigin(0.5, 1);
    this.hero = hero;
    this.playHeroAction(first.action_key);
    return hero;
  }

  /**
   * Đổi hành động — `idle` lúc đứng, `walk` lúc đi.
   *
   * Nhân vật KHÔNG có tấm cho hành động này thì giữ nguyên tấm đang chạy, chứ
   * không về ảnh trống: một nhân vật chỉ có mỗi `idle` vẫn đi lại được, chỉ là
   * không có bước chân.
   */
  private playHeroAction(action: string) {
    if (!this.hero || this.heroAction === action) return;
    const key = this.heroKey(action);
    if (!this.textures.exists(key)) return;

    this.heroAction = action;
    if (this.anims.exists(key)) {
      this.hero.play(key, true);
    } else {
      this.hero.stop();
      this.hero.setTexture(key);
    }

    // Chuẩn hoá lại cỡ sau MỖI lần đổi tấm: `walk` và `idle` không bắt buộc
    // cùng khổ khung, mà `scale` thì giữ nguyên qua lần đổi texture.
    this.hero.setScale(this.heroHeight() / this.hero.height);
  }

  /**
   * Chiều cao nhân vật của màn này.
   *
   * `HERO_HEIGHT` giờ chỉ còn là đường lùi cho những lượt chơi ĐÃ ĐÓNG BĂNG
   * trước khi trường này ra đời — đề bài của chúng không có nó, và đóng cửa với
   * người đang chơi dở là chuyện không làm.
   */
  private heroHeight(): number {
    return this.sceneData.characterHeight ?? HERO_HEIGHT;
  }

  /**
   * Đi hay đứng — suy từ chính vị trí, không từ nơi ra lệnh.
   *
   * Có ba đường làm nhân vật dịch chuyển: tween của cú bấm, phím WASD, và cú
   * huỷ tween giữa chừng. Gắn `walk`/`idle` vào từng đường là ba chỗ phải nhớ
   * đồng bộ, và chỗ nào quên thì nhân vật kẹt trong bước chạy giữa lúc đứng im.
   * So vị trí hai khung hình liên tiếp thì chỉ có MỘT luật, đúng cho cả ba.
   */
  private updateHeroMotion() {
    const dx = this.player.x - this.lastPos.x;
    const dy = this.player.y - this.lastPos.y;
    this.lastPos = { x: this.player.x, y: this.player.y };

    // Ngưỡng nửa pixel: toạ độ tween là số thực, so bằng 0 tuyệt đối thì một
    // khung hình đứng yên vì làm tròn cũng bị tính là đang đi.
    const moving = Math.abs(dx) > MOVING_EPSILON || Math.abs(dy) > MOVING_EPSILON;
    if (this.hero && Math.abs(dx) > MOVING_EPSILON) this.hero.setFlipX(dx < 0);

    // Đi thì đổi NGAY, đứng thì đợi đủ mấy khung mới đổi — xem
    // `IDLE_AFTER_STILL_FRAMES`.
    this.stillFrames = moving ? 0 : this.stillFrames + 1;
    if (moving) this.playHeroAction('walk');
    else if (this.stillFrames >= IDLE_AFTER_STILL_FRAMES) this.playHeroAction(DEFAULT_ACTION);

    // Tiếng đi theo ĐÚNG cái ngưỡng đã tính cho hoạt ảnh, không tính lại một
    // ngưỡng riêng: hình chuyển sang bước mà tiếng còn im — hoặc ngược lại —
    // thì hai thứ lệch nhau và người chơi nghe ra ngay.
    if (moving) this.setMotionSound('walk');
    else if (this.stillFrames >= IDLE_AFTER_STILL_FRAMES) this.setMotionSound('idle');
  }


  // ------------------------------------------------------------------ âm thanh

  private audioKey(slot: AudioSlot): string {
    return `stage_audio_${slot}`;
  }

  /**
   * Bật tiếng của màn.
   *
   * **Trình duyệt CHẶN âm thanh tự chạy** khi người dùng chưa chạm vào trang.
   * Phaser gói việc đó lại thành `sound.locked`: mọi lệnh `play()` trước cú
   * chạm đầu tiên đều rơi vào im lặng, không báo lỗi. Nên ở đây chỉ dựng sẵn
   * các bản rồi ĐỢI — cú bấm đầu tiên của người chơi (bấm để đi, hoặc bấm vào
   * một vật thể) sẽ mở khoá, và lúc đó nhạc mới vào.
   *
   * Không tự ý hạ nhạc xuống 0 rồi "mở dần" để lách: cách đó chỉ lách được ở
   * một số trình duyệt, và ở những chỗ nó không lách được thì kết quả là một
   * bản nhạc chạy câm suốt màn.
   */
  private startAudio() {
    for (const slot of AUDIO_SLOT_KEYS) {
      if (!this.cache.audio.exists(this.audioKey(slot))) continue;
      const spec = resolveAudio(slot, this.audio[slot]);
      this.sounds.set(
        slot,
        this.sound.add(this.audioKey(slot), {
          volume: this.mixVolume(slot),
          rate: spec.rate,
          loop: spec.loop,
        }),
      );
    }

    if (this.sounds.size === 0) return;

    const begin = () => {
      // Người chơi đã tắt nhạc ở bản đồ hay phòng chờ thì vào đây vẫn tắt.
      if (!this.musicPrefs.on) return;
      this.sounds.get('ambient')?.play();
      // Vào màn là đang đứng, nên tiếng đứng vào trước — nếu màn có đặt.
      this.setMotionSound('idle');
    };

    if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, begin);
    else begin();

    // DỪNG HẾT khi rời cảnh. Thiếu dòng này thì nhạc nền của màn chơi vẫn chạy
    // sau khi người chơi đã bấm "Rời màn" và đang đứng ở bản đồ thiên hà — và
    // không có nút nào tắt được nó ngoài việc tải lại trang.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const sound of this.sounds.values()) sound.destroy();
      this.sounds.clear();
      this.motionSlot = null;
    });
  }

  /**
   * Nhận tuỳ chọn nhạc mới từ React. Gọi lúc vào màn và mỗi lần người chơi
   * chỉnh — kể cả khi họ chỉnh ở một tab khác.
   */
  setMusicPrefs(prefs: { on: boolean; master: number }) {
    const wasOn = this.musicPrefs.on;
    this.musicPrefs = prefs;
    this.applyVolumes();

    if (wasOn === prefs.on) return;
    if (!prefs.on) {
      for (const sound of this.sounds.values()) sound.stop();
      // Quên khối chuyển động đang phát, để lúc bật lại nó vào lại từ đầu thay
      // vì tưởng mình vẫn đang kêu.
      this.motionSlot = null;
      return;
    }
    this.sounds.get('ambient')?.play();
    this.setMotionSound('idle');
  }

  /**
   * Âm lượng THẬT của một khối tiếng, sau cả ba tầng nhân.
   *
   * Ba con số, ba người quyết, và chúng nhân vào nhau chứ không đè lên nhau:
   *
   *   1. `spec.volume` — giáo viên cân bản phối của màn.
   *   2. `musicPrefs.master` — người chơi vặn to nhỏ TẤT CẢ.
   *   3. `DUCK_VOLUME` — bảng câu hỏi có tiếng đang mở, lùi cả màn ra sau.
   *
   * Nhân thì mỗi tầng giữ được ý của tầng dưới: người chơi vặn nhỏ rồi mà mở
   * câu hỏi nghe thì nhỏ hơn nữa, chứ không nhảy về một mức cố định của ai đó.
   *
   * MỘT hàm cho cả ba chỗ đặt âm lượng (`startAudio`, `applyVolumes`,
   * `applyVideoSound`), vì ba bản chép của cùng một phép nhân sẽ lệch đúng vào
   * lúc thêm tầng thứ tư — và đây chính là lần thêm tầng thứ ba.
   */
  private mixVolume(slot: AudioSlot): number {
    const spec = resolveAudio(slot, this.audio[slot]);
    return spec.volume * this.musicPrefs.master * (this.ducked ? DUCK_VOLUME : 1);
  }

  /** Áp âm lượng hiện tại lên mọi thứ đang kêu. Không đụng tới bật/tắt. */
  private applyVolumes() {
    // Video nền TRƯỚC: nó có thể ĐANG LÀ nhạc nền, và lúc đó `this.sounds`
    // không có khối `ambient` nào để vòng lặp bên dưới chạm tới.
    this.applyVideoSound();

    for (const [slot, sound] of this.sounds) {
      // `setVolume` chứ không dựng lại: đổi âm lượng giữa chừng phải mượt, dựng
      // lại là bản nhạc nhảy về đầu mỗi lần kéo thanh trượt một nấc.
      //
      // `BaseSound` không khai báo `setVolume` — nó nằm ở `WebAudioSound` và
      // `HTML5AudioSound`, tức là ở cả hai bản cài đặt thật. Ép kiểu hẹp đúng
      // một hàm, thay vì ép cả `sound` thành `any` rồi mất luôn phần còn lại.
      (sound as unknown as { setVolume?: (v: number) => void }).setVolume?.(this.mixVolume(slot));
    }
  }

  /**
   * Bảng câu hỏi CÓ TIẾNG mở ra / đóng lại.
   *
   * Chỉ hạ âm lượng, KHÔNG dừng gì cả: dừng rồi phát lại là bản nhạc nền nhảy
   * về đầu mỗi lần học sinh mở một câu hỏi nghe, và một màn có sáu câu nghe thì
   * họ nghe đúng tám giây đầu của bản nhạc sáu lần.
   *
   * React quyết định KHI NÀO — cảnh Phaser không biết bảng nào đang mở, cũng
   * không biết câu hỏi nào có tiếng. Nó chỉ biết vặn cái van.
   */
  setMusicDucked(on: boolean) {
    if (this.ducked === on) return;
    this.ducked = on;
    this.applyVolumes();
  }

  /**
   * Căng video nền cho vừa thế giới — và căng LẠI mỗi khi khổ texture đổi.
   *
   * ## Vì sao không đặt một lần trong `create()`
   *
   * `setDisplaySize(w, h)` KHÔNG lưu `w` và `h`. Nó tính `scale = w / width`
   * ngay lúc gọi rồi chỉ giữ lại cái tỉ lệ ấy. Một thẻ Video vừa dựng thì chưa
   * có khung hình nào, nên Phaser cho nó mượn tấm texture `__MISSING` 256×256 —
   * và tỉ lệ tính ra là 3200 / 256 = **12,5**. Đến khi khung hình thật về,
   * Phaser thay texture bằng khổ thật (1920 chẳng hạn) nhưng GIỮ NGUYÊN 12,5,
   * nên tấm nền hiện ra rộng 24000 đơn vị trên một thế giới rộng 3200 — phóng
   * to gấp 7,5 lần. Đây là con số đo được, không phải suy đoán.
   *
   * Ảnh tĩnh không dính lỗi này: `load.image` nạp xong texture trước khi
   * `create()` chạy, nên `width` đã là khổ thật ngay từ đầu.
   *
   * ## Vì sao canh theo KHỔ chứ không nghe sự kiện
   *
   * Phaser có `textureready` cho đúng việc này, nhưng đo trên máy thật thì nó
   * KHÔNG bắn — cả `play` và `playing` cũng không. Treo một bản sửa lên một sự
   * kiện chưa từng thấy chạy là đổi một lỗi chắc chắn lấy một lỗi tuỳ lúc.
   *
   * So khổ thì không cần tin ai cả: khổ đổi thì căng lại, đúng một lần cho mỗi
   * lần đổi. Nó cũng tự đúng với video có khổ đổi giữa chừng, và với cả trường
   * hợp texture sẵn sàng ngay từ khung hình đầu — thứ đã che lỗi này trong lần
   * thử trước, khi tôi dùng một video nhỏ đã nằm sẵn trong bộ nhớ đệm.
   */
  private fitBgVideo() {
    const video = this.bgVideo;
    if (!video) return;
    if (video.width === this.bgVideoSize.w && video.height === this.bgVideoSize.h) return;
    video.setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT);
    this.bgVideoSize = { w: video.width, h: video.height };
  }

  /**
   * Đặt tiếng cho VIDEO NỀN theo tuỳ chọn hiện tại của người chơi.
   *
   * Tách khỏi `startAudio()` vì nó phải chạy ngay cả khi màn KHÔNG có khối tiếng
   * nào — trường hợp rất bình thường khi giáo viên bật "dùng tiếng của video":
   * `this.sounds` rỗng, và `startAudio()` thoát sớm.
   *
   * Nền là ảnh tĩnh, hoặc giáo viên không bật cờ, thì video (nếu có) im lặng —
   * `setMute(true)` chứ không bỏ qua, vì một video có đường tiếng mà không ai
   * tắt sẽ tự kêu.
   */
  private applyVideoSound() {
    const video = this.bgVideo;
    if (!video) return;
    if (!this.ambientFromVideo) {
      video.setMute(true);
      return;
    }
    video.setVolume(this.mixVolume('ambient'));
    video.setMute(!this.musicPrefs.on);
  }

  /**
   * Đổi giữa tiếng ĐI và tiếng ĐỨNG. Gọi mỗi khung hình, nên phải rẻ và im lặng
   * khi không có gì đổi.
   *
   * Hai khối loại trừ nhau: phát chồng lên nhau thì người chơi nghe thấy tiếng
   * bước chân và tiếng thở cùng lúc ở mỗi lần dừng lại.
   */
  private setMotionSound(slot: 'walk' | 'idle') {
    if (!this.musicPrefs.on) return;
    if (this.motionSlot === slot) return;
    if (this.motionSlot) this.sounds.get(this.motionSlot)?.stop();
    this.motionSlot = slot;
    this.sounds.get(slot)?.play();
  }

  // ------------------------------------------------------------------ hiệu ứng

  /**
   * Đóng ổ khoá lên một nhiệm vụ chưa mở.
   *
   * CHỈ gắn ổ khoá vào nhãn — không làm mờ hình.
   *
   * Làm mờ là cách nói mơ hồ: một vật thể mờ còn đọc được là "đã xong", là "ở
   * xa", hay chỉ là ảnh giáo viên tải lên vốn đã nhạt. Cái ổ khoá thì nói đúng
   * một điều và không nói gì khác, nên nó là đủ. Bỏ lớp mờ đi thì tấm ảnh nền
   * và mấy ảnh vật thể cũng giữ nguyên được cái nhìn mà người dựng đã căn.
   *
   * Ổ khoá nằm TRONG nhãn, không phải một ảnh riêng đặt phía trên. Nhãn đã có
   * sẵn cơ chế giữ cỡ chữ không đổi theo mức thu phóng của camera
   * (`rescaleLabels`); một ảnh riêng thì không, nên ở mức thu nhỏ nó co lại
   * thành một chấm.
   *
   * Vật thể vẫn BẤM ĐƯỢC. Người chơi đi tới, bảng mở ra và nói phải gặp NPC
   * trước — chứ không phải bấm mãi mà màn hình im lặng.
   */
  private markLocked(questId: string) {
    const node = this.nodes.find((n) => n.id === questId);
    if (!node || node.locked) return;

    node.locked = true;
    node.label.setText(LOCK_PREFIX + node.label.text);
  }

  /**
   * Qua NPC rồi — mở hết một lượt.
   *
   * Mở HẾT chứ không mở từng cái theo sự kiện riêng: cổng chỉ có một, và qua
   * được nó thì mọi thứ phía sau mở cùng lúc.
   */
  private unlockAll() {
    for (const node of this.nodes) {
      if (!node.locked) continue;
      node.locked = false;

      // `replace` chứ không `startsWith` + `slice`: một nhiệm vụ vừa xong vừa
      // khoá là chuyện không xảy ra, nhưng nếu có thì dấu ✓ đứng trước và phép
      // cắt theo vị trí đầu chuỗi sẽ trượt, để lại cái ổ khoá vĩnh viễn.
      node.label.setText(node.label.text.replace(LOCK_PREFIX, ''));
    }
  }

  /** Đánh dấu một nhiệm vụ đã xong. Tra theo ID, không theo chỉ số mảng. */
  private markCompleted(questId: string) {
    const node = this.nodes.find((n) => n.id === questId);
    if (!node || node.completed) return;

    node.completed = true;
    // KHÔNG làm mờ ảnh. Người dựng tải tấm ảnh đó lên và căn nó vào cảnh; hạ
    // xuống một nửa độ sáng là sửa tác phẩm của họ để nói một điều mà cái dấu ✓
    // đã nói rõ hơn. Làm mờ cũng là cách nói mơ hồ — mờ còn đọc được là "đang
    // khoá", là "ở xa", hay chỉ là tấm ảnh vốn đã nhạt.
    //
    // Dấu ✓ nằm TRONG nhãn, không phải một chữ riêng đặt lên ảnh. Bản trước đặt
    // nó thành một `text` 22px trong hệ toạ độ thế giới, mà camera thu về cỡ
    // 0,3 lần — ra chưa tới bảy điểm ảnh trên màn hình, tức gần như vô hình.
    // Nhãn thì đã có sẵn cơ chế giữ cỡ chữ không đổi theo mức thu phóng
    // (`rescaleLabels`). Cùng một lối với ổ khoá, xem `markLocked`.
    //
    // ⚠️ Đây là chuyện của RIÊNG người đang ngồi trước màn hình. Danh sách
    // `completedQuestIds` dựng từ `run.my_progress`, mà server tính nó chỉ từ
    // bài làm của chính người gọi (`_run_out`: `mine = [... if a.user_id ==
    // user.id]`). Bốn người cùng một phòng thì mỗi máy thấy đúng dấu ✓ của mình
    // — luật "kết quả từng người là độc lập" (GAME_DOMAIN §1.5) hiện ra ở đây.
    // Ai xong nhiệm vụ nào của ĐỒNG ĐỘI là dữ liệu khác (`run.team`), và nó
    // không được vẽ lên cảnh.
    node.label.setText(node.label.text + DONE_SUFFIX);
  }

  private flashAt(questId: string) {
    const node = this.nodes.find((n) => n.id === questId);
    if (!node) return;
    const flash = this.add.circle(node.x, node.y, 55, 0x4ade80, 0.85).setDepth(30);
    this.tweens.add({
      targets: flash,
      scale: 2.8,
      alpha: 0,
      duration: 900,
      onComplete: () => flash.destroy(),
    });
  }

  private showShardVfx() {
    const text = this.add
      .text(this.player.x, this.player.y - 90, '✨', { fontSize: '48px' })
      .setOrigin(0.5)
      .setDepth(50);

    this.tweens.add({
      targets: text,
      scale: { from: 0.5, to: 1.6 },
      alpha: { from: 1, to: 0 },
      duration: 1400,
      onComplete: () => text.destroy(),
    });
  }
}

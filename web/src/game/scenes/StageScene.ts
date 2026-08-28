import Phaser from 'phaser';

import { EventBus, GAME_EVENTS } from '../EventBus';
import { DEFAULT_ACTION } from '../character';
import { DEFAULT_ICON_SIZE, WORLD, resolvePulse } from '../world';

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

export interface StageSceneData {
  /** URL ảnh nền. Rỗng = chưa có ảnh, cảnh dùng nền biển mặc định. */
  backgroundUrl: string;
  quests: SceneQuest[];
  advisorLabel: string | null | undefined;
  completedQuestIds: string[];
  /**
   * Nhân vật người chơi đã chọn ở phòng chờ world.
   *
   * `null` = chưa chọn, hoặc nhân vật không có tấm nào tải được — cảnh vẫn chơi
   * bình thường với ký hiệu tròn mặc định. Không có nhân vật KHÔNG phải là lý
   * do để một màn chơi không mở được.
   */
  character: SceneCharacter | null;
}

const WORLD_WIDTH = WORLD.width;
const WORLD_HEIGHT = WORLD.height;
const MOVE_SPEED = 280;

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

/**
 * Chỗ đặt CHÂN nhân vật so với tâm container.
 *
 * Giữ nguyên con số của cái bóng ở bản cũ, nên nhân vật đứng đúng chỗ ký hiệu
 * tròn từng đứng — mọi phép tính phạm vi nhiệm vụ không phải sửa gì.
 */
const HERO_FOOT_Y = 22;

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

/** Màu xoay vòng cho vật thể nhiệm vụ — số nhiệm vụ mỗi màn không cố định. */
const PROP_COLORS = [0xd4af37, 0xff7b00, 0x00f0ff, 0x9b51e0, 0x4ade80, 0xf43f5e];


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
  /** Nửa chiều cao khung ảnh, dùng để đặt nhãn ngay trên đầu ảnh. */
  halfHeight: number;
  container: Phaser.GameObjects.Container;
  completed: boolean;
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

    if (this.sceneData.backgroundUrl) {
      this.load.image('stage_bg', this.sceneData.backgroundUrl);
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

    // Ảnh hỏng thì bỏ qua, không để cả cảnh chết theo. Cảnh vẫn chơi được với
    // nền biển mặc định, và giáo viên vẫn thấy vật thể để sửa.
    this.load.on('loaderror', (file: { key: string }) => {
      console.warn('[StageScene] không tải được ảnh:', file.key);
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

    if (this.textures.exists('stage_bg')) {
      const bg = this.add.image(centerX, centerY, 'stage_bg');
      bg.setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT);
      bg.setOrigin(0.5).setDepth(0);
    }

    this.createStorm();
    this.createQuestProps(centerX, centerY);
    this.createPlayer(centerX - 100, centerY + 120);

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

    for (const questId of this.sceneData.completedQuestIds) this.markCompleted(questId);

    EventBus.on(GAME_EVENTS.QUEST_COMPLETED, ((payload: { questId: string }) => {
      this.markCompleted(payload.questId);
      this.flashAt(payload.questId);
    }) as never);

    EventBus.on(GAME_EVENTS.STAGE_WON, (() => this.showShardVfx()) as never);

    // Có thể đã đứng sẵn trong một phạm vi ngay lúc vào màn.
    this.settleZone();
  }

  update(_time: number, delta: number) {
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
      node.label.setY(-node.halfHeight - gapWorld);
    }
  }

  // ------------------------------------------------------------------ di chuyển

  private canWalk(x: number, y: number): boolean {
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

    const fromX = this.player.x;
    const fromY = this.player.y;

    // Nhân vật đã ở ngoài vùng (lượt chơi cũ, hoặc vật thể đặt sát mép): kéo
    // thẳng về trong. Trả `null` như trước là để họ kẹt vĩnh viễn — không cú
    // bấm nào cứu được, phải tải lại trang.
    if (!this.canWalk(fromX, fromY)) {
      return {
        x: Phaser.Math.Clamp(x, this.walkArea.left, this.walkArea.right),
        y: Phaser.Math.Clamp(y, this.walkArea.top, this.walkArea.bottom),
      };
    }

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

  private movePlayerTo(x: number, y: number) {
    this.tweens.killTweensOf(this.player);
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
    this.tweens.add({
      targets: this.player,
      x,
      y,
      duration: Math.max(250, (distance / MOVE_SPEED) * 1000),
      ease: 'Power1',
      // Giữa đường chỉ cập nhật viền và xét việc RỜI phạm vi.
      onUpdate: () => this.afterMove(),
      // Tới đích mới xét việc MỞ nhiệm vụ. Tween bị huỷ giữa chừng thì Phaser
      // không gọi `onComplete`, nên bấm sang chỗ khác không mở nhầm.
      onComplete: () => this.settleZone(),
    });
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
  private stopAtQuestEdge(toX: number, toY: number): { x: number; y: number } {
    const node = this.nodeAtPoint(toX, toY);
    if (!node) return { x: toX, y: toY };

    const fromX = this.player.x;
    const fromY = this.player.y;
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

    const target = this.stopAtQuestEdge(walk.x, walk.y);
    this.movePlayerTo(target.x, target.y);
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
      const color = isAdvisor ? 0xd4af37 : PROP_COLORS[index % PROP_COLORS.length]!;

      const container = this.add.container(x, y).setDepth(isAdvisor ? 15 : 10);

      // Có ảnh thì dùng ảnh; không thì vòng sáng mặc định. Ảnh do giáo viên tải
      // lên ở giao diện thiết kế màn chơi.
      const iconKey = `quest_icon_${quest.id}`;
      const artwork: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse =
        quest.icon_url && this.textures.exists(iconKey)
          ? (() => {
              const image = this.add.image(0, 0, iconKey);
              // Đặt theo BỀ RỘNG và giữ tỉ lệ gốc: ép cả hai chiều là ảnh của
              // giáo viên bị bóp méo, và họ không hiểu vì sao.
              const width = quest.icon_size ?? DEFAULT_ICON_SIZE;
              image.setDisplaySize(width, width * (image.height / image.width));
              return image;
            })()
          : (() => {
              const halo = this.add.ellipse(
                0,
                18,
                isAdvisor ? 90 : 75,
                isAdvisor ? 48 : 38,
                color,
                0.32,
              );
              halo.setStrokeStyle(2, color, 0.9);
              return halo;
            })();

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

      // Kích thước khung lấy từ ẢNH THẬT: bề rộng do giáo viên đặt, chiều cao
      // suy ra theo tỉ lệ gốc. Nhờ vậy vùng va chạm luôn khớp cái nhìn thấy.
      const boxWidth = quest.icon_size ?? DEFAULT_ICON_SIZE;
      const boxHeight =
        artwork instanceof Phaser.GameObjects.Image
          ? artwork.displayHeight
          : boxWidth;

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
        halfHeight: boxHeight / 2,
        container,
        completed: false,
      };

      // Bấm vào vật thể = RA LỆNH ĐI TỚI, không phải mở câu hỏi.
      // Cả vòng sáng lẫn nhãn đều bấm được — đích bấm nhỏ là thứ khó chịu nhất
      // trên màn hình cảm ứng.
      for (const target of [artwork, label, hitArea]) {
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
      const pulse = resolvePulse(quest.pulse_percent, quest.pulse_period_ms);
      if (pulse) {
        this.tweens.add({
          targets: artwork,
          scaleX: artwork.scaleX * pulse.maxScale,
          scaleY: artwork.scaleY * pulse.maxScale,
          duration: pulse.halfCycleMs,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1,
        });
      }

      container.add([artwork, label]);
      // Nhãn vẽ sau ảnh nên luôn nằm trên, không bị hình che.
      container.bringToTop(label);
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
    this.hero.setScale(HERO_HEIGHT / this.hero.height);
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
  }

  // ------------------------------------------------------------------ hiệu ứng

  /** Đánh dấu một nhiệm vụ đã xong. Tra theo ID, không theo chỉ số mảng. */
  private markCompleted(questId: string) {
    const node = this.nodes.find((n) => n.id === questId);
    if (!node || node.completed) return;

    node.completed = true;
    node.container.setAlpha(0.5);

    const check = this.add
      .text(0, -46, '✓', { fontSize: '22px', color: '#4ade80', fontStyle: 'bold' })
      .setOrigin(0.5);
    node.container.add(check);
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

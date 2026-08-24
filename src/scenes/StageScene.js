import Phaser from 'phaser';
import { EventBus, GAME_EVENTS } from '../core/EventBus.js';

// Import trực tiếp qua Vite
import shipDeckBgUrl from '../assets/backgrounds/stage_01_ship_deck.jpg';
import leoPortraitUrl from '../assets/portraits/leo.jpg';
import mayaPortraitUrl from '../assets/portraits/maya.jpg';
import samPortraitUrl from '../assets/portraits/sam.jpg';
import jadePortraitUrl from '../assets/portraits/jade.jpg';
import captainPortraitUrl from '../assets/portraits/captain.jpg';

export class StageScene extends Phaser.Scene {
  constructor() {
    super('StageScene');
    this.player = null;
    this.interactiveObjects = [];
    this.advisorObject = null;
    this.teammates = [];
    this.cursors = null;
    this.keys = null;
    this.currentZoom = 1;
    this.moveSpeed = 280;
    this.worldWidth = 3200;
    this.worldHeight = 1800;
    this.shipDeckPolygon = null;
  }

  preload() {
    this.load.image('ship_deck_bg', shipDeckBgUrl);
    this.load.image('leo_portrait', leoPortraitUrl);
    this.load.image('maya_portrait', mayaPortraitUrl);
    this.load.image('sam_portrait', samPortraitUrl);
    this.load.image('jade_portrait', jadePortraitUrl);
    this.load.image('captain_portrait', captainPortraitUrl);
  }

  create() {
    const { worldWidth, worldHeight } = this;
    const centerX = worldWidth / 2;
    const centerY = worldHeight / 2;

    // 1. THIẾT LẬP WORLD BOUNDS & CAMERA
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    // 2. VẼ NỀN ĐẠI DƯƠNG DỰ PHÒNG
    const oceanBg = this.add.graphics();
    oceanBg.setDepth(-2);
    oceanBg.fillGradientStyle(0x020b10, 0x020b10, 0x071e28, 0x071e28, 1);
    oceanBg.fillRect(0, 0, worldWidth, worldHeight);

    // 3. KHỞI TẠO VÙNG KHÔNG GIAN SÀN BOONG TÀU (SHIP DECK WALKABLE POLYGON) VỚI PLAIN OBJECTS {x, y}
    this.shipDeckPolygon = new Phaser.Geom.Polygon([
      { x: centerX - 820, y: centerY + 390 }, // Mũi tàu (Bow)
      { x: centerX - 580, y: centerY + 530 }, // Mạn trái phía trước
      { x: centerX + 80,  y: centerY + 430 }, // Mạn trái giữa tàu
      { x: centerX + 680, y: centerY + 190 }, // Mạn trái phía sau
      { x: centerX + 880, y: centerY - 210 }, // Đuôi tàu góc phải
      { x: centerX + 780, y: centerY - 480 }, // Boong đuôi trên cùng (Đài chỉ huy)
      { x: centerX + 350, y: centerY - 520 }, // Mạn phải phía sau
      { x: centerX - 180, y: centerY - 320 }, // Mạn phải giữa tàu
      { x: centerX - 620, y: centerY - 20 }   // Mạn phải phía trước
    ]);

    // 4. VẼ BACKGROUND BOONG TÀU 2.5D ISOMETRIC
    const bg = this.add.image(centerX, centerY, 'ship_deck_bg');
    bg.setDisplaySize(worldWidth, worldHeight);
    bg.setOrigin(0.5, 0.5);
    bg.setDepth(0);

    // 5. HIỆU ỨNG THỜI TIẾT MƯA BÃO & SẤM CHỚP
    this.createStormAtmosphere(worldWidth, worldHeight);

    // 6. TẠO NPC CỐ VẤN CHÍNH: THUYỀN TRƯỞNG DRAKE (Đài chỉ huy boong đuôi tàu)
    this.createAdvisorNPC(centerX + 520, centerY - 380);

    // 7. TẠO CÁC ĐỒNG ĐỘI (MAYA, SAM, JADE) TRÊN BOONG TÀU
    this.createTeammates(centerX, centerY);

    // 8. CÁC ĐỐI TƯỢNG NHIỆM VỤ PHÂN BỔ HỢP LÝ TRÊN BOONG TÀU
    this.createInteractiveObjects(centerX, centerY);

    // 9. TẠO NHÂN VẬT LEO (TÔI - Ở KHU VỰC TRUNG TÂM BOONG TÀU)
    this.createPlayer(centerX - 100, centerY + 120);

    // Camera bám theo Leo
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    // 10. BẮT PHÍM DI CHUYỂN (W-A-D-X VÀ PHÍM MŨI TÊN)
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      down: Phaser.Input.Keyboard.KeyCodes.X
    });
    this.input.keyboard.clearCaptures();

    // 11. BẮT SỰ KIỆN CLICK CHUỘT (CHỈ DI CHUYỂN TRONG PHẠM VI BOONG TÀU)
    this.input.on('pointerdown', (pointer, currentlyOver) => {
      if (pointer.y < 65) return;

      // Nếu click trúng bất kỳ NPC hoặc vật thể tương tác nào -> Dừng di chuyển ngay, giữ nguyên vị trí
      if (currentlyOver && currentlyOver.length > 0) {
        if (this.player) this.tweens.killTweensOf(this.player);
        return;
      }

      const worldX = pointer.worldX;
      const worldY = pointer.worldY;

      // Kiểm tra nếu click ngoài phạm vi con tàu -> Bỏ qua, không cho bơi ra biển
      if (!this.isInsideShipDeck(worldX, worldY)) {
        return;
      }

      EventBus.emit('TARGET_DESELECTED');
      this.movePlayerTo(worldX, worldY);
    });

    // 12. ZOOM IN / OUT KHI GIỮ PHÍM CTRL + CUỘN CHUỘT
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (pointer.event.ctrlKey) {
        pointer.event.preventDefault();
        const zoomDelta = deltaY > 0 ? -0.1 : 0.1;
        this.currentZoom = Phaser.Math.Clamp(this.currentZoom + zoomDelta, 0.55, 1.5);
        this.cameras.main.setZoom(this.currentZoom);
      }
    });

    // 13. PHÁT VỊ TRÍ BAN ĐẦU CHO MINIMAP
    this.emitMapPositions();

    // 14. SỰ KIỆN EVENT BUS
    EventBus.on('ADVISOR_SELECTED', () => {
      if (this.player) this.tweens.killTweensOf(this.player);
    });

    EventBus.on('QUEST_TARGET_SELECTED', () => {
      if (this.player) this.tweens.killTweensOf(this.player);
    });

    EventBus.on(GAME_EVENTS.TASK_COMPLETED, ({ taskIndex }) => {
      this.handleTaskCompletedEffect(taskIndex);
    });

    EventBus.on(GAME_EVENTS.MAP_SHARD_COLLECTED, () => {
      this.showShardCollectionVFX();
    });

    EventBus.on('ADVISOR_UNLOCKED', () => {
      this.showAdvisorUnlockedVFX();
    });
  }

  isInsideShipDeck(x, y) {
    if (!this.shipDeckPolygon) return true;
    return Phaser.Geom.Polygon.Contains(this.shipDeckPolygon, x, y);
  }

  update(time, delta) {
    if (!this.player) return;

    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

    if (isTyping) return;

    let vx = 0;
    let vy = 0;

    if (this.keys.up.isDown || this.cursors.up.isDown) vy -= 1;
    if (this.keys.down.isDown || this.cursors.down.isDown) vy += 1;
    if (this.keys.left.isDown || this.cursors.left.isDown) vx -= 1;
    if (this.keys.right.isDown || this.cursors.right.isDown) vx += 1;

    if (vx !== 0 || vy !== 0) {
      this.tweens.killTweensOf(this.player);

      const len = Math.sqrt(vx * vx + vy * vy);
      const speed = (this.moveSpeed * delta) / 1000;

      const stepX = (vx / len) * speed;
      const stepY = (vy / len) * speed;

      const targetX = this.player.x + stepX;
      const targetY = this.player.y + stepY;

      // 1. Thử đi cả 2 hướng (X và Y)
      if (this.isInsideShipDeck(targetX, targetY)) {
        this.player.x = targetX;
        this.player.y = targetY;
      } 
      // 2. Nếu chạm mép tàu, trượt mượt dọc theo trục X
      else if (this.isInsideShipDeck(targetX, this.player.y)) {
        this.player.x = targetX;
      } 
      // 3. Nếu chạm mép tàu, trượt mượt dọc theo trục Y
      else if (this.isInsideShipDeck(this.player.x, targetY)) {
        this.player.y = targetY;
      }

      // Cập nhật vị trí realtime lên Minimap
      EventBus.emit('PLAYER_REALTIME_POSITION', { x: this.player.x, y: this.player.y });
    }
  }

  movePlayerTo(x, y) {
    if (!this.player) return;

    this.tweens.killTweensOf(this.player);

    const targetX = x;
    const targetY = y;

    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, targetX, targetY);
    const duration = (distance / this.moveSpeed) * 1000;

    this.tweens.add({
      targets: this.player,
      x: targetX,
      y: targetY,
      duration: Math.max(250, duration),
      ease: 'Power1',
      onUpdate: () => {
        EventBus.emit('PLAYER_REALTIME_POSITION', { x: this.player.x, y: this.player.y });
      }
    });
  }

  // HIỆU ỨNG THỜI TIẾT MƯA BÃO & SẤM CHỚP
  createStormAtmosphere(width, height) {
    for (let i = 0; i < 90; i++) {
      const rx = Phaser.Math.Between(50, width - 50);
      const ry = Phaser.Math.Between(50, height - 50);
      const drop = this.add.line(0, 0, rx, ry, rx - 18, ry + 36, 0x9be8ff, 0.35);
      drop.setDepth(4);

      this.tweens.add({
        targets: drop,
        x: '-=180',
        y: '+=360',
        alpha: { from: 0.45, to: 0.05 },
        duration: Phaser.Math.Between(450, 750),
        repeat: -1,
        delay: Phaser.Math.Between(0, 1000)
      });
    }

    const flashOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 0);
    flashOverlay.setDepth(5);

    this.time.addEvent({
      delay: 5000,
      loop: true,
      callback: () => {
        if (Phaser.Math.Between(1, 10) > 4) {
          this.tweens.add({
            targets: flashOverlay,
            alpha: { from: 0, to: 0.3 },
            duration: 90,
            yoyo: true,
            repeat: 1
          });
        }
      }
    });
  }

  // 1. NPC CỐ VẤN: THUYỀN TRƯỞNG DRAKE (Đài chỉ huy boong đuôi tàu)
  createAdvisorNPC(x, y) {
    const container = this.add.container(x, y);
    container.setDepth(15);

    const aura = this.add.ellipse(0, 24, 90, 48, 0xd4af37, 0.45);
    aura.setStrokeStyle(3, 0xffd700, 0.95);

    const bodyBg = this.add.circle(0, 0, 24, 0xd4af37);
    bodyBg.setStrokeStyle(3, 0x00f0ff);

    const icon = this.add.text(0, 0, '⚓', {
      fontSize: '22px'
    }).setOrigin(0.5);

    const label = this.add.text(0, -42, '⚓ THUYỀN TRƯỞNG DRAKE\n(NPC Cố vấn)', {
      fontSize: '13px',
      fontStyle: 'bold',
      align: 'center',
      color: '#ffd166',
      backgroundColor: '#071318ee',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5);

    label.setInteractive({ useHandCursor: true });
    label.on('pointerdown', (pointer) => {
      pointer.event.stopPropagation();
      if (this.player) this.tweens.killTweensOf(this.player);
      EventBus.emit('ADVISOR_SELECTED');
    });

    bodyBg.setInteractive({ useHandCursor: true });
    bodyBg.on('pointerdown', (pointer) => {
      pointer.event.stopPropagation();
      if (this.player) this.tweens.killTweensOf(this.player);
      EventBus.emit('ADVISOR_SELECTED');
    });

    this.tweens.add({
      targets: aura,
      scaleX: 1.25,
      scaleY: 1.25,
      alpha: 0.75,
      duration: 900,
      yoyo: true,
      repeat: -1
    });

    container.add([aura, bodyBg, icon, label]);
    this.advisorObject = container;
  }

  // 2. ĐỒNG ĐỘI (MAYA, SAM, JADE) TRÊN BOONG TÀU
  createTeammates(centerX, centerY) {
    const teammatesData = [
      { id: 'maya', name: 'Maya (Khảo cổ)', iconText: '📜', color: 0x9b51e0, x: centerX - 280, y: centerY + 60 },
      { id: 'sam', name: 'Sam (Kỹ sư)', iconText: '🔧', color: 0xff7b00, x: centerX + 120, y: centerY + 160 },
      { id: 'jade', name: 'Jade (Tiên phong)', iconText: '🗡️', color: 0x27ae60, x: centerX - 20, y: centerY - 140 }
    ];

    this.teammates = teammatesData.map(t => {
      const c = this.add.container(t.x, t.y);
      c.setDepth(12);

      const aura = this.add.ellipse(0, 18, 55, 28, t.color, 0.35);
      aura.setStrokeStyle(2, t.color, 0.85);

      const bodyBg = this.add.circle(0, 0, 18, t.color);
      bodyBg.setStrokeStyle(2.5, 0xffffff);

      const icon = this.add.text(0, 0, t.iconText, {
        fontSize: '16px'
      }).setOrigin(0.5);

      const label = this.add.text(0, -32, t.name, {
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#071318cc',
        padding: { x: 6, y: 3 }
      }).setOrigin(0.5);

      label.setInteractive({ useHandCursor: true });
      label.on('pointerdown', (pointer) => {
        pointer.event.stopPropagation();
        if (this.player) this.tweens.killTweensOf(this.player);
      });

      bodyBg.setInteractive({ useHandCursor: true });
      bodyBg.on('pointerdown', (pointer) => {
        pointer.event.stopPropagation();
        if (this.player) this.tweens.killTweensOf(this.player);
      });

      c.add([aura, bodyBg, icon, label]);
      return { ...t, container: c };
    });
  }

  // 3. CÁC ĐỐI TƯỢNG NHIỆM VỤ TRÊN BOONG TÀU
  createInteractiveObjects(centerX, centerY) {
    const sail = this.createProp(centerX + 260, centerY - 200, '⛵ Cột Buồm Chính', 0xd4af37, {
      taskId: 1,
      name: 'Cột Buồm Chính',
      role: 'Khu vực điều khiển tời buồm đón bão',
      desc: 'Dây kéo buồm đang căng đứt! Hãy dùng khẩu lệnh Thuyền trưởng để hạ buồm an toàn.',
      portrait: './assets/portraits/leo.jpg'
    });

    const hull = this.createProp(centerX + 450, centerY + 60, '🔨 Thân Tàu Rạn Nứt', 0xff7b00, {
      taskId: 2,
      name: 'Thân Tàu Rạn Nứt',
      role: 'Khoang kỹ thuật bị nứt vỡ rò rỉ nước',
      desc: 'Nước biển tràn vào! Hãy chọn đúng công cụ kỹ thuật để gia cố thân tàu.',
      portrait: './assets/portraits/sam.jpg'
    });

    const beacon = this.createProp(centerX - 480, centerY + 240, '🚨 Đèn Phao Cứu Sinh', 0x00f0ff, {
      taskId: 3,
      name: 'Đèn Phao Cứu Sinh Radar',
      role: 'Hệ thống radar định vị khẩn cấp',
      desc: 'Tín hiệu sonar nhấp nháy! Hãy xác định chính xác phương hướng của phao cứu sinh.',
      portrait: './assets/portraits/maya.jpg'
    });

    const chest = this.createProp(centerX - 700, centerY + 380, '🗝️ Hòm Báu Cổ Atlantis', 0x9b51e0, {
      taskId: 4,
      name: 'Hòm Báu Cổ Atlantis',
      role: 'Nơi cất giữ Mảnh bản đồ số 1',
      desc: 'Khóa cổ tự Atlantis! Hãy nhập đúng mật mã kim loại thần thoại để giải phóng Mảnh bản đồ.',
      portrait: './assets/portraits/jade.jpg'
    });

    this.interactiveObjects = [sail, hull, beacon, chest];
  }

  createProp(x, y, label, color, targetInfo) {
    const container = this.add.container(x, y);
    container.setDepth(10);

    const baseCircle = this.add.ellipse(0, 18, 75, 38, color, 0.3);
    baseCircle.setStrokeStyle(2, color, 0.9);

    const textObj = this.add.text(0, -14, label, {
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#071318ee',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5);

    textObj.setInteractive({ useHandCursor: true });
    textObj.on('pointerdown', (pointer) => {
      pointer.event.stopPropagation();
      if (this.player) this.tweens.killTweensOf(this.player);
      EventBus.emit('QUEST_TARGET_SELECTED', targetInfo);
    });

    baseCircle.setInteractive({ useHandCursor: true });
    baseCircle.on('pointerdown', (pointer) => {
      pointer.event.stopPropagation();
      if (this.player) this.tweens.killTweensOf(this.player);
      EventBus.emit('QUEST_TARGET_SELECTED', targetInfo);
    });

    this.tweens.add({
      targets: baseCircle,
      scaleX: 1.2,
      scaleY: 1.2,
      alpha: 0.6,
      duration: 1400,
      yoyo: true,
      repeat: -1
    });

    container.add([baseCircle, textObj]);
    return container;
  }

  // 4. NHÂN VẬT LEO (TÔI - NGƯỜI CHƠI)
  createPlayer(x, y) {
    this.player = this.add.container(x, y);
    this.player.setDepth(20);

    const aura = this.add.ellipse(0, 22, 60, 30, 0x00f0ff, 0.4);
    aura.setStrokeStyle(2.5, 0x00f0ff, 0.95);

    const bodyBg = this.add.circle(0, 0, 22, 0x00f0ff);
    bodyBg.setStrokeStyle(3, 0xffffff);

    const icon = this.add.text(0, 0, '👑', {
      fontSize: '20px'
    }).setOrigin(0.5);

    const nameTag = this.add.text(0, -36, '👑 LEO (Tôi)', {
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#00f0ff',
      backgroundColor: '#071318ee',
      padding: { x: 8, y: 3 }
    }).setOrigin(0.5);

    this.player.add([aura, bodyBg, icon, nameTag]);

    this.tweens.add({
      targets: aura,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 800,
      yoyo: true,
      repeat: -1
    });
  }

  emitMapPositions() {
    const centerX = this.worldWidth / 2;
    const centerY = this.worldHeight / 2;

    EventBus.emit('MAP_INITIAL_POSITIONS', {
      worldWidth: this.worldWidth,
      worldHeight: this.worldHeight,
      player: { id: 'leo', name: 'Leo (Tôi)', x: centerX - 100, y: centerY + 120 },
      advisor: { id: 'drake', name: 'Thuyền trưởng Drake', x: centerX + 520, y: centerY - 380 },
      teammates: [
        { id: 'maya', name: 'Maya', x: centerX - 280, y: centerY + 60, color: '#9b51e0' },
        { id: 'sam', name: 'Sam', x: centerX + 120, y: centerY + 160, color: '#ff7b00' },
        { id: 'jade', name: 'Jade', x: centerX - 20, y: centerY - 140, color: '#27ae60' }
      ],
      props: [
        { id: 'sail', name: 'Cột buồm', x: centerX + 260, y: centerY - 200 },
        { id: 'hull', name: 'Thân tàu', x: centerX + 450, y: centerY + 60 },
        { id: 'beacon', name: 'Phao radar', x: centerX - 480, y: centerY + 240 },
        { id: 'chest', name: 'Hòm báu', x: centerX - 700, y: centerY + 380 }
      ]
    });
  }

  showAdvisorUnlockedVFX() {
    const shardText = this.add.text(this.player.x, this.player.y - 80, '📜 ĐÃ MỞ KHÓA BÍ QUYẾT THUYỀN TRƯỞNG! 📜', {
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffd166',
      stroke: '#000000',
      strokeThickness: 5,
      backgroundColor: '#071318ee',
      padding: { x: 16, y: 8 }
    }).setOrigin(0.5);
    shardText.setDepth(50);

    this.tweens.add({
      targets: shardText,
      scale: { from: 0.6, to: 1.15 },
      alpha: { from: 0, to: 1 },
      duration: 600,
      yoyo: true,
      hold: 2200,
      onComplete: () => shardText.destroy()
    });
  }

  handleTaskCompletedEffect(taskIndex) {
    if (this.interactiveObjects[taskIndex]) {
      const obj = this.interactiveObjects[taskIndex];
      const flash = this.add.circle(obj.x, obj.y, 55, 0x4ade80, 0.85);
      flash.setDepth(30);
      this.tweens.add({
        targets: flash,
        scale: 2.8,
        alpha: 0,
        duration: 900,
        onComplete: () => flash.destroy()
      });
    }
  }

  showShardCollectionVFX() {
    const shardText = this.add.text(this.player.x, this.player.y - 90, '✨ ĐÃ THU THẬP MẢNH BẢN ĐỒ 1 / 30! ✨', {
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 5,
      backgroundColor: '#071318ee',
      padding: { x: 18, y: 10 }
    }).setOrigin(0.5);
    shardText.setDepth(50);

    this.tweens.add({
      targets: shardText,
      scale: { from: 0.5, to: 1.25 },
      alpha: { from: 0, to: 1 },
      duration: 700,
      yoyo: true,
      hold: 2500,
      onComplete: () => shardText.destroy()
    });
  }
}

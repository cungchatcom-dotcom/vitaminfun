import Phaser from 'phaser';
import { EventBus, GAME_EVENTS } from '../core/EventBus.js';

export class StageScene extends Phaser.Scene {
  constructor() {
    super('StageScene');
    this.player = null;
    this.targetPos = null;
    this.interactiveObjects = [];
  }

  preload() {
    // Tải assets nếu cần
  }

  create() {
    const { width, height } = this.scale;

    // 1. NỀN BIỂN SÂU 2.5D ISOMETRIC VÀ HIỆU ỨNG NƯỚC
    this.drawOceanicGrid(width, height);
    this.createBubbleParticles(width, height);

    // 2. CÁC VẬT THỂ TƯƠNG TÁC THEO 4 NHIỆM VỤ CỦA MÀN 1
    this.createInteractiveObjects();

    // 3. TẠO NHÂN VẬT LEO (VỚI VÒNG SÁNG MA THUẬT DƯỚI CHÂN)
    this.createPlayer(width / 2, height / 2 + 30);

    // 4. BẮT SỰ KIỆN CLICK CHUỘT ĐỂ DI CHUYỂN (CLICK-TO-MOVE)
    this.input.on('pointerdown', (pointer) => {
      // Chỉ nhận click nếu không click vào các phần tử HTML UI
      if (pointer.y < 70 || pointer.y > height - 190) return;
      this.movePlayerTo(pointer.x, pointer.y);
    });

    // 5. LẮNG NGHE SỰ KIỆN TỪ EVENT BUS
    EventBus.on(GAME_EVENTS.TASK_COMPLETED, ({ taskIndex }) => {
      this.handleTaskCompletedEffect(taskIndex);
    });

    EventBus.on(GAME_EVENTS.MAP_SHARD_COLLECTED, () => {
      this.showShardCollectionVFX();
    });
  }

  drawOceanicGrid(width, height) {
    const graphics = this.add.graphics();
    
    // Gradient nền biển sâu
    graphics.fillGradientStyle(0x040d12, 0x040d12, 0x0a1e28, 0x0a1e28, 1);
    graphics.fillRect(0, 0, width, height);

    // Lưới Isometric mô phỏng boong tàu thám hiểm / tàn tích ngập nước
    graphics.lineStyle(1, 0x00f0ff, 0.15);
    const tileW = 100;
    const tileH = 50;
    const originX = width / 2;
    const originY = height / 2 - 40;

    for (let x = -8; x <= 8; x++) {
      for (let y = -8; y <= 8; y++) {
        const screenX = originX + (x - y) * (tileW / 2);
        const screenY = originY + (x + y) * (tileH / 2);

        // Vẽ từng ô gạch 2.5D Isometric
        graphics.beginPath();
        graphics.moveTo(screenX, screenY - tileH / 2);
        graphics.lineTo(screenX + tileW / 2, screenY);
        graphics.lineTo(screenX, screenY + tileH / 2);
        graphics.lineTo(screenX - tileW / 2, screenY);
        graphics.closePath();
        graphics.strokePath();
      }
    }
  }

  createBubbleParticles(width, height) {
    // Hạt bọt khí nước biển bay lơ lửng
    for (let i = 0; i < 25; i++) {
      const x = Phaser.Math.Between(50, width - 50);
      const y = Phaser.Math.Between(80, height - 200);
      const size = Phaser.Math.Between(2, 6);
      const bubble = this.add.circle(x, y, size, 0x00f0ff, 0.4);

      this.tweens.add({
        targets: bubble,
        y: y - Phaser.Math.Between(100, 250),
        alpha: { from: 0.5, to: 0 },
        duration: Phaser.Math.Between(3000, 6000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 3000),
        onRepeat: () => {
          bubble.y = height - 190;
          bubble.x = Phaser.Math.Between(50, width - 50);
          bubble.alpha = 0.5;
        }
      });
    }
  }

  createInteractiveObjects() {
    const { width, height } = this.scale;

    // 1. Buồm tàu (Task 1: Lower the sails)
    const sail = this.createProp(width / 2 - 200, height / 2 - 80, '⛵ Cột Buồm Chính', 0xd4af37, () => {
      EventBus.emit(GAME_EVENTS.NPC_DIALOGUE_TRIGGERED, {
        npc: 'Captain Golem',
        text: 'Storm incoming! Lower the sails immediately!'
      });
    });

    // 2. Vết nứt thân tàu (Task 2: Use wrench)
    const hull = this.createProp(width / 2 + 200, height / 2 - 50, '🔨 Thân Tàu Rạn Nứt', 0xff7b00, () => {
      EventBus.emit(GAME_EVENTS.NPC_DIALOGUE_TRIGGERED, {
        npc: 'Sam (The Fixer)',
        text: 'The hull is cracking! Tell me which tool to use: [wrench / hammer]!'
      });
    });

    // 3. Phao cứu sinh (Task 3: Left side)
    const beacon = this.createProp(width / 2 - 250, height / 2 + 80, '🚨 Đèn Phao Cứu Sinh', 0x00f0ff, () => {
      EventBus.emit(GAME_EVENTS.NPC_DIALOGUE_TRIGGERED, {
        npc: 'Maya (The Scholar)',
        text: 'Radar ping detected! Which side is the beacon on? Left or right?'
      });
    });

    // 4. Hòm cứu nạn cổ Atlantis (Task 4: Orichalcum -> Shard 1)
    const chest = this.createProp(width / 2 + 220, height / 2 + 90, '🗝️ Hòm Báu Cổ Atlantis', 0x9b51e0, () => {
      EventBus.emit(GAME_EVENTS.NPC_DIALOGUE_TRIGGERED, {
        npc: 'Ancient Chest Spirit',
        text: 'Speak the sacred ancient metal of Atlantis to unlock this chest: O_I_H_L_U_?'
      });
    });

    this.interactiveObjects = [sail, hull, beacon, chest];
  }

  createProp(x, y, label, color, onClick) {
    const container = this.add.container(x, y);

    // Vòng sáng đế vật thể
    const baseCircle = this.add.ellipse(0, 15, 60, 30, color, 0.25);
    baseCircle.setStrokeStyle(1.5, color, 0.8);

    // Biểu tượng & Text
    const textObj = this.add.text(0, -10, label, {
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#071318cc',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5);

    textObj.setInteractive({ useHandCursor: true });
    textObj.on('pointerdown', (pointer) => {
      pointer.event.stopPropagation();
      onClick();
      this.movePlayerTo(x, y + 25);
    });

    // Hiệu ứng phát sáng bập bùng
    this.tweens.add({
      targets: baseCircle,
      scaleX: 1.15,
      scaleY: 1.15,
      alpha: 0.5,
      duration: 1500,
      yoyo: true,
      repeat: -1
    });

    container.add([baseCircle, textObj]);
    return container;
  }

  createPlayer(x, y) {
    this.player = this.add.container(x, y);

    // Vòng ma thuật màu xanh dương (#00F0FF) của Leo
    const aura = this.add.ellipse(0, 20, 50, 25, 0x00f0ff, 0.3);
    aura.setStrokeStyle(2, 0x00f0ff, 0.9);

    // Thân nhân vật Leo (Hình họa đại diện với trang phục vàng/cyan)
    const body = this.add.circle(0, 0, 18, 0xd4af37);
    body.setStrokeStyle(2, 0x00f0ff);

    // Tên nhân vật
    const nameTag = this.add.text(0, -32, '👑 LEO (Team Leader)', {
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#00f0ff',
      backgroundColor: '#071318dd',
      padding: { x: 6, y: 2 }
    }).setOrigin(0.5);

    this.player.add([aura, body, nameTag]);

    // Tween thở (Idle animation)
    this.tweens.add({
      targets: body,
      scaleY: 1.08,
      duration: 800,
      yoyo: true,
      repeat: -1
    });
  }

  movePlayerTo(x, y) {
    if (!this.player) return;

    // Tween di chuyển mượt mà tới tọa độ đích
    this.tweens.killTweensOf(this.player);
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
    const duration = (distance / 250) * 1000;

    this.tweens.add({
      targets: this.player,
      x: x,
      y: y,
      duration: Math.max(300, duration),
      ease: 'Power1'
    });
  }

  handleTaskCompletedEffect(taskIndex) {
    // Hiệu ứng pháo hoa tia sáng ma thuật khi xong nhiệm vụ
    if (this.interactiveObjects[taskIndex]) {
      const obj = this.interactiveObjects[taskIndex];
      
      const flash = this.add.circle(obj.x, obj.y, 40, 0x4ade80, 0.8);
      this.tweens.add({
        targets: flash,
        scale: 2.5,
        alpha: 0,
        duration: 800,
        onComplete: () => flash.destroy()
      });
    }
  }

  showShardCollectionVFX() {
    const { width, height } = this.scale;
    const shardText = this.add.text(width / 2, height / 2 - 80, '✨ ĐÃ THU THẬP MẢNH BẢN ĐỒ 1 / 30! ✨', {
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 5,
      backgroundColor: '#071318ee',
      padding: { x: 16, y: 10 }
    }).setOrigin(0.5);

    this.tweens.add({
      targets: shardText,
      scale: { from: 0.5, to: 1.2 },
      alpha: { from: 0, to: 1 },
      duration: 600,
      yoyo: true,
      hold: 2500,
      onComplete: () => shardText.destroy()
    });
  }
}

// GameState: Quản lý toàn bộ tiến trình màn chơi, hội thoại Chat với NPC, Voice Player & Polls
import { EventBus, GAME_EVENTS } from './EventBus.js';

export class GameState {
  constructor() {
    this.stageData = null;
    this.currentTaskIndex = 0;
    this.skillPts = 450;
    this.combatPower = 350; // Điểm chiến lực cá nhân (hỗ trợ unlock & level jump)
    this.collectedShards = [1]; // Danh sách các ID mảnh bản đồ đã thu thập
    this.clearedStages = { 1: { stars: 3, score: 950 } }; // Màn 1 đã hoàn thành mẫu
    this.shardsCollected = this.collectedShards.length;
    this.selectedMode = 'single'; // 'single' hoặc 'multi'
    this.timeRemaining = 300;
    this.timerInterval = null;
    this.myHeroId = 'leo';

    this.advisorUnlocked = false;
    this.advisorStep = 0;

    // Mỗi nhân vật được phát 10 điểm năng lượng ban đầu (Tổng team = 40)
    this.heroes = {
      leo: {
        id: 'leo',
        name: 'Leo Harrison',
        role: 'The Guardian (Đội trưởng)',
        personality: 'Quyết đoán, dũng cảm và bảo vệ đồng đội. Chuyên gia thể lực và cận chiến.',
        portrait: './assets/portraits/leo.jpg',
        world: 'World 1: Lost in Atlantis',
        energy: 10,
        skillPts: 450,
        shards: '0 / 30 Mảnh'
      },
      maya: {
        id: 'maya',
        name: 'Maya Sterling',
        role: 'The Scholar (Nhà khảo cổ)',
        personality: 'Thông minh, điềm tĩnh, am hiểu ngôn ngữ cổ và các cơ quan mật mã Atlantis.',
        portrait: './assets/portraits/maya.jpg',
        world: 'World 1: Lost in Atlantis',
        energy: 10,
        skillPts: 420,
        shards: '0 / 30 Mảnh'
      },
      sam: {
        id: 'sam',
        name: 'Sam Miller',
        role: 'The Fixer (Thiên tài công nghệ)',
        personality: 'Lém lỉnh, am hiểu máy móc, hack hệ thống năng lượng Orichalcum.',
        portrait: './assets/portraits/sam.jpg',
        world: 'World 1: Lost in Atlantis',
        energy: 10,
        skillPts: 400,
        shards: '0 / 30 Mảnh'
      },
      jade: {
        id: 'jade',
        name: 'Jade Nguyen',
        role: 'The Wraith (Tiên phong thám thính)',
        personality: 'Nhanh nhẹn, dẻo dai, chuyên gia Parkour vượt địa hình hiểm trở đáy biển.',
        portrait: './assets/portraits/jade.jpg',
        world: 'World 1: Lost in Atlantis',
        energy: 10,
        skillPts: 430,
        shards: '0 / 30 Mảnh'
      }
    };

    this.selectedTarget = null;
    this.speechEngine = null;
  }

  setSpeechEngine(engine) {
    this.speechEngine = engine;
  }

  async loadStage(stageFile = './data/stages/stage_01.json') {
    try {
      const response = await fetch(stageFile);
      this.stageData = await response.json();
      this.timeRemaining = this.stageData.timeLimitSeconds || 300;
      this.currentTaskIndex = 0;
      this.advisorUnlocked = false;
      this.advisorStep = 0;

      // Đặt năng lượng mỗi người là 10
      ['leo', 'maya', 'sam', 'jade'].forEach(id => {
        this.heroes[id].energy = 10;
        const badge = document.getElementById(`energy-badge-${id}`);
        if (badge) badge.textContent = `⚡10`;
      });

      this.startTimer();
      this.renderUI();
      this.renderAdvisorStatus();
      this.selectAdvisorTarget();
      EventBus.emit(GAME_EVENTS.STAGE_LOADED, this.stageData);
    } catch (err) {
      console.error('[GameState] Lỗi tải stage:', err);
    }
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.timeRemaining > 0) {
        this.timeRemaining--;
        this.updateTimerDisplay();
        EventBus.emit(GAME_EVENTS.TIMER_TICK, this.timeRemaining);
      } else {
        clearInterval(this.timerInterval);
        this.handleTimeOut();
      }
    }, 1000);
  }

  updateTimerDisplay() {
    const timerText = document.getElementById('timer-text');
    const timerBox = document.getElementById('timer-box');
    if (!timerText) return;

    const mins = Math.floor(this.timeRemaining / 60);
    const secs = this.timeRemaining % 60;
    timerText.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (this.timeRemaining <= 60) {
      timerBox?.classList.add('warning');
    } else {
      timerBox?.classList.remove('warning');
    }
  }

  // TRỪ ĐIỂM NĂNG LƯỢNG: CHỈ TRỪ CHO NHÂN VẬT HIỆN TẠI (LEO - TÔI)
  consumeMyEnergy(amount) {
    const myHero = this.heroes[this.myHeroId];
    myHero.energy = Math.max(0, myHero.energy - amount);

    // Cập nhật badge của Leo
    const myBadge = document.getElementById(`energy-badge-${this.myHeroId}`);
    if (myBadge) myBadge.textContent = `⚡${myHero.energy}`;

    // Cập nhật tổng năng lượng nhóm (Tổng 40 điểm)
    this.updateTeamEnergyDisplay();

    EventBus.emit(GAME_EVENTS.ENERGY_CHANGED, myHero.energy);

    if (myHero.energy <= 0) {
      this.handleGameOver("Bạn (Leo) đã cạn kiệt điểm Năng Lượng cá nhân!");
    }
  }

  updateTeamEnergyDisplay() {
    const energyText = document.getElementById('energy-text');
    const energyFill = document.getElementById('energy-fill');
    if (!energyText || !energyFill) return;

    const totalTeamEnergy = this.heroes.leo.energy + this.heroes.maya.energy + this.heroes.sam.energy + this.heroes.jade.energy;
    energyText.textContent = `${totalTeamEnergy}/40`;

    const percent = Math.min(100, (totalTeamEnergy / 40) * 100);
    energyFill.style.width = `${percent}%`;

    if (totalTeamEnergy <= 10) {
      energyFill.classList.add('low');
    } else {
      energyFill.classList.remove('low');
    }
  }

  // 1. CHỌN NPC CỐ VẤN (THUYỀN TRƯỞNG DRAKE)
  selectAdvisorTarget() {
    if (!this.stageData?.advisor) return;
    const adv = this.stageData.advisor;
    this.selectedTarget = {
      type: 'advisor',
      id: adv.id,
      name: adv.name,
      role: adv.role,
      portrait: adv.portrait
    };

    this.updateTargetInfoTab({
      badge: '⚓ NPC CỐ VẤN CHÍNH',
      name: adv.name,
      role: adv.role,
      portrait: adv.portrait,
      desc: this.advisorUnlocked ? adv.cluebook.summary : 'Chỉ huy tàu thám hiểm. Hãy chat với ông ấy để nhận Sổ tay bí quyết vượt bão.'
    });

    if (!this.advisorUnlocked) {
      const stepData = adv.dialogueSteps[this.advisorStep];
      if (stepData) {
        this.postNPCChatMessage({
          senderName: adv.name,
          portrait: adv.portrait,
          text: stepData.npcPrompt,
          voiceText: stepData.npcPrompt,
          subtitleText: `Sub: "${stepData.npcPrompt}"`,
          vietnameseTranslation: stepData.vietnameseTranslation || 'Chào nhóc tỳ! Ngươi là ai và đến con tàu này để làm gì trong bão?',
          options: stepData.options,
          onSelectOption: (chosenOpt) => {
            this.handleAdvisorAnswer(chosenOpt);
          }
        });
      }
    } else {
      this.postNPCChatMessage({
        senderName: adv.name,
        portrait: adv.portrait,
        text: `📜 Sổ tay Bí quyết của ta: ${adv.cluebook.summary}. Hãy đến các khu vực trên boong để xử lý!`,
        voiceText: adv.cluebook.summary,
        subtitleText: `Sub: "${adv.cluebook.summary}"`,
        vietnameseTranslation: 'Ta đã trao sổ tay bí quyết cho con, hãy đi cứu tàu ngay!'
      });
    }
  }

  handleAdvisorAnswer(chosenOpt) {
    const adv = this.stageData.advisor;
    const stepData = adv.dialogueSteps[this.advisorStep];

    this.postPlayerChatMessage(chosenOpt.text);

    if (chosenOpt.isCorrect) {
      this.skillPts += 30;
      this.advisorStep++;

      if (this.advisorStep < adv.dialogueSteps.length) {
        setTimeout(() => {
          const nextStep = adv.dialogueSteps[this.advisorStep];
          this.postNPCChatMessage({
            senderName: adv.name,
            portrait: adv.portrait,
            text: `👍 Khá lắm chàng trai! Tiếp theo: ${nextStep.npcPrompt}`,
            voiceText: nextStep.npcPrompt,
            subtitleText: `Sub: "${nextStep.npcPrompt}"`,
            vietnameseTranslation: nextStep.vietnameseTranslation || 'Mục đích của con đến đây để xin hỗ trợ điều gì?',
            options: nextStep.options,
            onSelectOption: (opt) => this.handleAdvisorAnswer(opt)
          });
        }, 500);
      } else {
        this.advisorUnlocked = true;
        this.renderAdvisorStatus();
        setTimeout(() => {
          const finalVoice = "Great job! I give you the storm survival secrets. Go save the ship!";
          this.postNPCChatMessage({
            senderName: adv.name,
            portrait: adv.portrait,
            text: `🌟 TUYỆT VỜI! Ta chính thức trao Sổ tay Bí quyết: 1. Hô 'Lower the sails immediately' | 2. Dùng 'wrench' | 3. Phao ở 'left side' | 4. Mật mã là 'Orichalcum'! Hãy cứu lấy con tàu!`,
            voiceText: finalVoice,
            subtitleText: `Sub: "${finalVoice}"`,
            vietnameseTranslation: 'Tuyệt vời! Ta trao cho con bí quyết vượt bão. Hãy đi cứu lấy con tàu!'
          });
          EventBus.emit('ADVISOR_UNLOCKED', adv.cluebook);
        }, 500);
      }
    } else {
      this.consumeMyEnergy(2);
      setTimeout(() => {
        const errVoice = "That is not correct. Please try again with respect!";
        this.postNPCChatMessage({
          senderName: adv.name,
          portrait: adv.portrait,
          text: `❌ Chưa đúng tác phong người thám hiểm! (-2 Năng lượng). Hãy chọn câu trả lời lịch sự và đúng vai trò của mình.`,
          voiceText: errVoice,
          subtitleText: `Sub: "${errVoice}"`,
          vietnameseTranslation: 'Câu trả lời chưa phù hợp, hãy thử lại.'
        });
      }, 400);
    }
  }

  // 2. CHỌN ĐỐI TƯỢNG NHIỆM VỤ
  setQuestTarget(targetData) {
    this.selectedTarget = targetData;

    this.updateTargetInfoTab({
      badge: '🎯 ĐỐI TƯỢNG NHIỆM VỤ',
      name: targetData.name,
      role: targetData.role,
      portrait: targetData.portrait,
      desc: targetData.desc || 'Khu vực thử thách của màn chơi.'
    });

    if (!this.advisorUnlocked) {
      const lockVoice = "Locked! You must speak with Captain Drake first to get the secrets!";
      this.postNPCChatMessage({
        senderName: targetData.name,
        portrait: targetData.portrait,
        text: `🔒 KHÓA: Bạn chưa nhận được bí quyết từ Thuyền trưởng Drake. Hãy đến gặp Thuyền trưởng ở boong chỉ huy trước!`,
        voiceText: lockVoice,
        subtitleText: `Sub: "${lockVoice}"`,
        vietnameseTranslation: 'Chưa thể xử lý! Bạn phải gặp Thuyền trưởng để xin bí quyết trước.'
      });
      return;
    }

    const task = this.stageData.tasks.find(t => t.id === targetData.taskId) || this.stageData.tasks[this.currentTaskIndex];
    if (task) {
      if (task.completed) {
        const doneVoice = `Great, ${task.desc} is already completed!`;
        this.postNPCChatMessage({
          senderName: targetData.name,
          portrait: targetData.portrait,
          text: `✔ "${task.desc}" đã được hoàn thành xuất sắc!`,
          voiceText: doneVoice,
          subtitleText: `Sub: "${doneVoice}"`,
          vietnameseTranslation: 'Nhiệm vụ này đã được giải quyết xong.'
        });
      } else {
        this.postNPCChatMessage({
          senderName: targetData.name,
          portrait: targetData.portrait,
          text: `${task.npcDialogue} (Vận dụng bí quyết Thuyền trưởng để xử lý)`,
          voiceText: task.npcDialogue,
          subtitleText: `Sub: "${task.npcDialogue}"`,
          vietnameseTranslation: task.vietnameseHint || 'Hãy chọn đáp án đúng để vượt qua thử thách này.',
          options: task.options,
          onSelectOption: (opt) => this.handleTaskAnswer(task, opt)
        });
      }
    }
  }

  handleTaskAnswer(task, chosenOpt) {
    this.postPlayerChatMessage(chosenOpt.text);

    if (chosenOpt.isCorrect) {
      this.validateCommand(chosenOpt.text);
    } else {
      this.consumeMyEnergy(2);
      const hintVoice = `Incorrect. Remember the Captain's secret: ${task.hint}`;
      setTimeout(() => {
        this.postNPCChatMessage({
          senderName: this.selectedTarget?.name || 'Hệ thống',
          portrait: this.selectedTarget?.portrait || './assets/portraits/captain.jpg',
          text: `❌ Chưa chính xác! (-2 Năng lượng). Hãy xem lại bí quyết của Thuyền trưởng: ${task.hint}`,
          voiceText: hintVoice,
          subtitleText: `Sub: "${hintVoice}"`,
          vietnameseTranslation: `Gợi ý: ${task.hint}`
        });
      }, 400);
    }
  }

  // 3. XỬ LÝ LỆNH GÕ HOẶC NÓI TỪ INPUT BAR
  validateCommand(input) {
    if (!this.stageData) return;

    if (!this.advisorUnlocked && this.selectedTarget?.type === 'advisor') {
      const stepData = this.stageData.advisor.dialogueSteps[this.advisorStep];
      if (stepData) {
        const cleanInput = input.toLowerCase().trim();
        const isMatched = stepData.targetKeywords.some(kw => cleanInput.includes(kw.toLowerCase()));
        this.handleAdvisorAnswer({ text: input, isCorrect: isMatched });
        return;
      }
    }

    if (!this.advisorUnlocked) {
      const firstVoice = "Please speak with me first to receive the storm survival secrets!";
      this.postNPCChatMessage({
        senderName: 'Captain Drake',
        portrait: './assets/portraits/captain.jpg',
        text: `⚠️ Hãy nói chuyện với ta trước để nhận bí quyết vượt bão!`,
        voiceText: firstVoice,
        subtitleText: `Sub: "${firstVoice}"`,
        vietnameseTranslation: 'Hãy trao đổi với Thuyền trưởng trước.'
      });
      return;
    }

    const task = this.stageData.tasks[this.currentTaskIndex];
    if (!task || task.completed) return;

    const cleanInput = input.toLowerCase().trim();
    const isMatched = task.targetKeywords.some(kw => cleanInput.includes(kw.toLowerCase()));

    if (isMatched) {
      task.completed = true;
      this.skillPts += 50;
      this.heroes.leo.skillPts = this.skillPts;

      const successVoice = `Excellent! Mission completed: ${task.desc}!`;
      setTimeout(() => {
        this.postNPCChatMessage({
          senderName: this.selectedTarget?.name || 'Hệ thống',
          portrait: this.selectedTarget?.portrait || './assets/portraits/leo.jpg',
          text: `🎉 CHÍNH XÁC! Đã hoàn thành nhiệm vụ: "${task.desc}" (+50 Điểm chiến lực)`,
          voiceText: successVoice,
          subtitleText: `Sub: "${successVoice}"`,
          vietnameseTranslation: 'Chúc mừng bạn đã hoàn thành nhiệm vụ!'
        });
      }, 300);

      if (task.reward === 'map_shard_01') {
        this.shardsCollected = 1;
        document.getElementById('shard-count').textContent = `${this.shardsCollected} / 30 🧩`;
        this.heroes.leo.shards = `${this.shardsCollected} / 30 Mảnh`;
        EventBus.emit(GAME_EVENTS.MAP_SHARD_COLLECTED, 1);
      }

      EventBus.emit(GAME_EVENTS.TASK_COMPLETED, { taskIndex: this.currentTaskIndex, task });

      if (this.currentTaskIndex < this.stageData.tasks.length - 1) {
        this.currentTaskIndex++;
      } else {
        this.handleStageVictory();
      }

      this.renderTaskList();
    } else {
      this.consumeMyEnergy(2);
      const wrongVoice = `Incorrect command. Hint: ${task.hint}`;
      setTimeout(() => {
        this.postNPCChatMessage({
          senderName: this.selectedTarget?.name || 'Hệ thống',
          portrait: this.selectedTarget?.portrait || './assets/portraits/captain.jpg',
          text: `❌ Chưa đúng khẩu lệnh! (-2 Năng lượng). Bí quyết: ${task.hint}`,
          voiceText: wrongVoice,
          subtitleText: `Sub: "${wrongVoice}"`,
          vietnameseTranslation: `Gợi ý: ${task.hint}`
        });
      }, 400);
    }
  }

  // 4. RENDER CHAT STREAM VỚI 3 NÚT: NGHE LẠI (-1) | PHỤ ĐỀ (-3) | DỊCH (-5)
  postNPCChatMessage({ senderName, portrait, text, voiceText, subtitleText, vietnameseTranslation, options, onSelectOption }) {
    const chatBody = document.getElementById('main-chat-body');
    if (!chatBody) return;

    const row = document.createElement('div');
    row.className = 'chat-msg-row npc';

    let voicePlayerHtml = '';
    if (voiceText) {
      voicePlayerHtml = `
        <div class="voice-player-widget">
          <div class="voice-player-main-row">
            <button class="btn-voice-play" title="Phát âm thanh câu này">▶</button>
            <div class="waveform-bars-wrap">
              <div class="waveform-bar"></div>
              <div class="waveform-bar"></div>
              <div class="waveform-bar"></div>
              <div class="waveform-bar"></div>
              <div class="waveform-bar"></div>
              <div class="waveform-bar"></div>
            </div>
            <span class="voice-duration-label">0:04</span>
          </div>
          <div class="voice-actions-subrow">
            <button class="btn-voice-subaction btn-replay-audio" title="Nghe lại đoạn voice vừa nói (-1 Năng lượng)">
              <span>🔊</span>
              <span>Nghe lại (-1⚡)</span>
            </button>
            <button class="btn-voice-subaction btn-subtitle-msg" title="Xem phụ đề tiếng Anh (-3 Năng lượng)">
              <span>💬</span>
              <span>Phụ đề (-3⚡)</span>
            </button>
            <button class="btn-voice-subaction btn-translate-msg" title="Dịch nghĩa tiếng Việt (-5 Năng lượng)">
              <span>🌐</span>
              <span>Dịch (-5⚡)</span>
            </button>
          </div>
          <div class="voice-subtitle-text">${subtitleText || voiceText}</div>
          <div class="voice-translation-text">${vietnameseTranslation || 'Bản dịch tiếng Việt'}</div>
        </div>
      `;
    }

    let pollHtml = '';
    if (options && options.length > 0) {
      pollHtml = `
        <div class="chat-poll-card">
          ${options.map((opt, idx) => `
            <button class="btn-poll-option" data-idx="${idx}">
              <span class="opt-k">[${opt.key}]</span>
              <span>${opt.text}</span>
            </button>
          `).join('')}
        </div>
      `;
    }

    row.innerHTML = `
      <img src="${portrait || './assets/portraits/captain.jpg'}" class="chat-msg-avatar" alt="NPC">
      <div class="chat-msg-content-wrap">
        <span class="chat-msg-sender-name">${senderName}</span>
        <div class="chat-bubble-card">
          <div>${text}</div>
          ${voicePlayerHtml}
          ${pollHtml}
        </div>
      </div>
    `;

    chatBody.appendChild(row);
    chatBody.scrollTop = chatBody.scrollHeight;

    // Gán sự kiện cho Voice Player của chính tin nhắn này
    if (voiceText) {
      const playBtn = row.querySelector('.btn-voice-play');
      const waveWrap = row.querySelector('.waveform-bars-wrap');
      const replayBtn = row.querySelector('.btn-replay-audio');
      const subtitleBtn = row.querySelector('.btn-subtitle-msg');
      const transBtn = row.querySelector('.btn-translate-msg');
      const subText = row.querySelector('.voice-subtitle-text');
      const transText = row.querySelector('.voice-translation-text');

      const playThisAudio = () => {
        if (this.speechEngine) {
          waveWrap?.classList.add('playing');
          this.speechEngine.speak(voiceText);
          setTimeout(() => waveWrap?.classList.remove('playing'), 3000);
        }
      };

      playThisAudio();

      playBtn?.addEventListener('click', playThisAudio);

      // Nút Nghe lại (-1 Năng lượng của Leo)
      replayBtn?.addEventListener('click', () => {
        this.consumeMyEnergy(1);
        playThisAudio();
      });

      // Nút Phụ đề (-3 Năng lượng của Leo)
      subtitleBtn?.addEventListener('click', () => {
        this.consumeMyEnergy(3);
        if (subText) subText.style.display = 'block';
      });

      // Nút Dịch (-5 Năng lượng của Leo)
      transBtn?.addEventListener('click', () => {
        this.consumeMyEnergy(5);
        if (transText) transText.style.display = 'block';
      });
    }

    // Gán sự kiện cho Poll Options
    if (options && options.length > 0 && onSelectOption) {
      row.querySelectorAll('.btn-poll-option').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-idx'), 10);
          const chosen = options[idx];
          onSelectOption(chosen);
        });
      });
    }
  }

  postPlayerChatMessage(text) {
    const chatBody = document.getElementById('main-chat-body');
    if (!chatBody) return;

    const row = document.createElement('div');
    row.className = 'chat-msg-row player';
    row.innerHTML = `
      <img src="./assets/portraits/leo.jpg" class="chat-msg-avatar" alt="Leo">
      <div class="chat-msg-content-wrap">
        <span class="chat-msg-sender-name">Leo (Tôi)</span>
        <div class="chat-bubble-card">
          ${text}
        </div>
      </div>
    `;
    chatBody.appendChild(row);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  updateTargetInfoTab({ badge, name, role, portrait, desc }) {
    const badgeEl = document.getElementById('target-info-badge');
    const nameEl = document.getElementById('target-info-name');
    const roleEl = document.getElementById('target-info-role');
    const avatarEl = document.getElementById('target-info-avatar');
    const descEl = document.getElementById('target-info-desc');
    const tabTitle = document.getElementById('btn-target-tab-title');

    if (badgeEl) badgeEl.textContent = badge;
    if (nameEl) nameEl.textContent = name;
    if (roleEl) roleEl.textContent = role;
    if (avatarEl) avatarEl.src = portrait;
    if (descEl) descEl.textContent = `"${desc}"`;
    if (tabTitle) tabTitle.textContent = name.split(' ')[0] || 'Thông Tin';
  }

  renderAdvisorStatus() {
    const box = document.getElementById('advisor-status-box');
    const text = document.getElementById('advisor-status-text');
    if (!box || !text) return;

    if (this.advisorUnlocked) {
      box.className = 'advisor-status-box unlocked';
      text.textContent = '✔ Đã có Sổ tay Bí quyết của Thuyền trưởng Drake';
    } else {
      box.className = 'advisor-status-box';
      text.textContent = '⚓ Bước 1: Gặp Thuyền trưởng Drake để lấy bí quyết';
    }
  }

  resetTargetToPlayer() {
    this.selectedTarget = null;
    const me = this.heroes[this.myHeroId];
    this.updateTargetInfoTab({
      badge: 'NGƯỜI CHƠI (TÔI)',
      name: me.name,
      role: me.role,
      portrait: me.portrait,
      desc: this.advisorUnlocked 
        ? 'Hãy tiếp tục di chuyển đến Cột Buồm, Thân Tàu, Phao Cứu Sinh hoặc Hòm Báu để xử lý.'
        : 'Hãy di chuyển đến gặp Thuyền trưởng Drake và chat trong ô CHAT bên phải để xin bí quyết.'
    });
  }

  renderUI() {
    if (!this.stageData) return;
    document.getElementById('stage-title').textContent = this.stageData.title;
    this.updateTeamEnergyDisplay();
    this.updateTimerDisplay();
    this.renderTaskList();
  }

  renderTaskList() {
    const listEl = document.getElementById('task-list');
    if (!listEl || !this.stageData) return;

    listEl.innerHTML = this.stageData.tasks.map((t, idx) => {
      const isActive = idx === this.currentTaskIndex && !t.completed;
      const isDone = t.completed;
      return `
        <li class="task-item ${isActive ? 'active' : ''} ${isDone ? 'completed' : ''}">
          <span class="task-checkbox">${isDone ? '✔' : (idx + 1)}</span>
          <span>${t.desc}</span>
        </li>
      `;
    }).join('');
  }

  handleTimeOut() {
    this.handleGameOver("Đã hết thời gian 5 phút cho màn chơi!");
  }

  handleGameOver(reason) {
    alert(`THUA CUỘC: ${reason}\nNhấn OK để thử lại màn chơi.`);
    window.location.reload();
  }

  handleStageVictory() {
    this.addCombatPower(200);
    if (!this.collectedShards.includes(1)) {
      this.collectedShards.push(1);
      this.shardsCollected = this.collectedShards.length;
    }
    this.clearedStages[1] = { stars: 3, score: 1000 };
    setTimeout(() => {
      alert(`🏆 CHIẾN THẮNG MÀN 1!\nChúc mừng bạn đã giải cứu tàu thám hiểm và thu thập Mảnh bản đồ 1/30!\nĐiểm chiến lực: +200 Pts (Tổng: ${this.combatPower})`);
      EventBus.emit('RETURN_TO_STAGE_SELECT');
    }, 500);
  }

  // ===================== STAGE SELECTION & COMBAT POWER HELPERS =====================
  getCombatPower() {
    return this.combatPower;
  }

  addCombatPower(pts) {
    this.combatPower += pts;
    EventBus.emit('COMBAT_POWER_CHANGED', this.combatPower);
  }

  isStageCleared(stageId) {
    return !!this.clearedStages[stageId];
  }

  hasShard(stageId) {
    return this.collectedShards.includes(stageId);
  }

  isStageUnlocked(stage) {
    if (stage.id === 1) return true;
    // Đã vượt qua màn trước đó hoặc đủ điểm chiến lực
    const prevStageCleared = !!this.clearedStages[stage.id - 1];
    const enoughCombatPower = this.combatPower >= stage.minCombatPower;
    return prevStageCleared || enoughCombatPower;
  }

  canJumpToStage(stage) {
    if (stage.id === 1) return false;
    const prevStageCleared = !!this.clearedStages[stage.id - 1];
    // Nhảy bậc: Màn trước chưa hoàn thành nhưng đã đủ điểm chiến lực yêu cầu
    return !prevStageCleared && this.combatPower >= stage.minCombatPower;
  }

  setSelectedMode(mode) {
    this.selectedMode = mode; // 'single' hoặc 'multi'
    EventBus.emit('MODE_CHANGED', mode);
  }

  getTimePortalStatus() {
    const totalRequired = 30;
    const currentCollected = this.collectedShards.length;
    const isReady = currentCollected >= totalRequired;
    const missingShards = [];
    for (let i = 1; i <= totalRequired; i++) {
      if (!this.collectedShards.includes(i)) {
        missingShards.push(i);
      }
    }
    return {
      isReady,
      currentCollected,
      totalRequired,
      missingShards
    };
  }
}

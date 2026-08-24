// GameState: Quản lý trạng thái toàn bộ màn chơi, năng lượng, thời gian và nhiệm vụ
import { EventBus, GAME_EVENTS } from './EventBus.js';

export class GameState {
  constructor() {
    this.stageData = null;
    this.currentTaskIndex = 0;
    this.energy = 100;
    this.skillPts = 450;
    this.shardsCollected = 0;
    this.timeRemaining = 300; // 5 phút
    this.timerInterval = null;
    this.activeHeroId = 'leo';
  }

  async loadStage(stageFile = './data/stages/stage_01.json') {
    try {
      const response = await fetch(stageFile);
      this.stageData = await response.json();
      this.energy = this.stageData.initialEnergy || 100;
      this.timeRemaining = this.stageData.timeLimitSeconds || 300;
      this.currentTaskIndex = 0;
      this.startTimer();
      this.renderUI();
      EventBus.emit(GAME_EVENTS.STAGE_LOADED, this.stageData);
    } catch (err) {
      console.error('[GameState] Không tải được dữ liệu stage:', err);
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

  consumeEnergy(amount) {
    this.energy = Math.max(0, this.energy - amount);
    this.updateEnergyDisplay();
    EventBus.emit(GAME_EVENTS.ENERGY_CHANGED, this.energy);

    if (this.energy <= 0) {
      this.handleGameOver("Bạn đã cạn kiệt điểm Năng Lượng toàn đội!");
    }
  }

  updateEnergyDisplay() {
    const energyText = document.getElementById('energy-text');
    const energyFill = document.getElementById('energy-fill');
    if (!energyText || !energyFill) return;

    energyText.textContent = `${this.energy}/100`;
    energyFill.style.width = `${this.energy}%`;

    if (this.energy <= 25) {
      energyFill.classList.add('low');
    } else {
      energyFill.classList.remove('low');
    }
  }

  validateCommand(input) {
    if (!this.stageData) return;
    const task = this.stageData.tasks[this.currentTaskIndex];
    if (!task || task.completed) return;

    const cleanInput = input.toLowerCase().trim();
    console.log('[GameState] Đang kiểm tra câu lệnh:', cleanInput, 'đối với task:', task.id);

    // Kiểm tra từ khóa hoặc cụm từ mục tiêu
    const isMatched = task.targetKeywords.some(keyword => cleanInput.includes(keyword.toLowerCase()));

    const feedbackEl = document.getElementById('console-feedback');

    if (isMatched) {
      task.completed = true;
      this.skillPts += 50;
      document.getElementById('skill-pts-text').textContent = `${this.skillPts} Pts`;

      if (feedbackEl) {
        feedbackEl.className = 'console-feedback-msg success';
        feedbackEl.textContent = `🎉 CHÍNH XÁC! Hoàn thành: "${task.desc}"`;
      }

      if (task.reward === 'map_shard_01') {
        this.shardsCollected = 1;
        document.getElementById('shard-count').textContent = `${this.shardsCollected} / 30 🧩`;
        EventBus.emit(GAME_EVENTS.MAP_SHARD_COLLECTED, 1);
      }

      EventBus.emit(GAME_EVENTS.TASK_COMPLETED, { taskIndex: this.currentTaskIndex, task });

      // Chuyển sang task tiếp theo
      if (this.currentTaskIndex < this.stageData.tasks.length - 1) {
        this.currentTaskIndex++;
        this.updateNPCDialogueForCurrentTask();
      } else {
        this.handleStageVictory();
      }

      this.renderTaskList();
    } else {
      // Trả lời sai: trừ 5 năng lượng
      this.consumeEnergy(5);
      if (feedbackEl) {
        feedbackEl.className = 'console-feedback-msg error';
        feedbackEl.textContent = `❌ Chưa đúng! -5 Năng lượng. Gợi ý: ${task.hint}`;
      }
    }
  }

  updateNPCDialogueForCurrentTask() {
    const task = this.stageData.tasks[this.currentTaskIndex];
    if (!task) return;

    const nameEl = document.getElementById('portrait-name');
    const dialogueEl = document.getElementById('npc-dialogue');
    if (nameEl) nameEl.textContent = task.npc;
    if (dialogueEl) dialogueEl.textContent = `"${task.npcDialogue}"`;
  }

  getCurrentTask() {
    if (!this.stageData) return null;
    return this.stageData.tasks[this.currentTaskIndex];
  }

  renderUI() {
    if (!this.stageData) return;
    document.getElementById('stage-title').textContent = this.stageData.title;
    document.getElementById('grammar-hint').textContent = this.stageData.grammarHint;
    this.updateEnergyDisplay();
    this.updateTimerDisplay();
    this.renderTaskList();
    this.updateNPCDialogueForCurrentTask();
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

  handleGameOver(reason) {
    alert(`THUA CUỘC: ${reason}\nNhấn OK để thử lại màn chơi.`);
    window.location.reload();
  }

  handleStageVictory() {
    setTimeout(() => {
      alert(`🏆 CHIẾN THẮNG MÀN 1!\nChúc mừng bạn đã giải cứu tàu thám hiểm và thu thập Mảnh bản đồ 1/30!\nĐiểm chiến lực: +200 Pts`);
    }, 500);
  }
}

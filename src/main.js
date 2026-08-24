import Phaser from 'phaser';
import { StageScene } from './scenes/StageScene.js';
import { GameState } from './core/GameState.js';
import { SpeechEngine } from './english/SpeechEngine.js';
import { EventBus, GAME_EVENTS } from './core/EventBus.js';

// 1. CẤU HÌNH PHASER 4 GAME
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#040d12',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [StageScene]
};

const game = new Phaser.Game(config);

// 2. KHỞI TẠO GAME STATE & SPEECH ENGINE
const gameState = new GameState();
const speechEngine = new SpeechEngine();

// Tải dữ liệu Màn 1
gameState.loadStage('./data/stages/stage_01.json');

// 3. GẮN KẾT SỰ KIỆN GIAO DIỆN DASHBOARD

// A. Ô nhập câu lệnh tiếng Anh (Input & Enter)
const commandInput = document.getElementById('command-input');
commandInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const text = commandInput.value.trim();
    if (text) {
      gameState.validateCommand(text);
      commandInput.value = '';
    }
  }
});

// B. Nhận kết quả từ Speech Recognition (Micro)
EventBus.on(GAME_EVENTS.VOICE_OR_TEXT_SUBMITTED, (spokenText) => {
  if (commandInput) commandInput.value = spokenText;
  gameState.validateCommand(spokenText);
});

// C. Nút "Nghe" (Listen / TTS)
const btnListen = document.getElementById('btn-listen');
btnListen?.addEventListener('click', () => {
  const currentTask = gameState.getCurrentTask();
  if (currentTask) {
    // Trừ 2 điểm năng lượng khi nghe lại
    gameState.consumeEnergy(2);
    speechEngine.speak(currentTask.npcDialogue);
    const feedback = document.getElementById('console-feedback');
    if (feedback) {
      feedback.className = 'console-feedback-msg';
      feedback.textContent = `🔊 Đang phát âm câu thoại của ${currentTask.npc}... (-2 Năng lượng)`;
    }
  }
});

// D. Nút "Giữ để nói" (Hold to Speak / STT)
const btnSpeak = document.getElementById('btn-speak');
if (btnSpeak) {
  btnSpeak.addEventListener('mousedown', () => speechEngine.startRecording());
  btnSpeak.addEventListener('mouseup', () => speechEngine.stopRecording());
  btnSpeak.addEventListener('mouseleave', () => speechEngine.stopRecording());
  
  // Touch support for mobile
  btnSpeak.addEventListener('touchstart', (e) => { e.preventDefault(); speechEngine.startRecording(); });
  btnSpeak.addEventListener('touchend', (e) => { e.preventDefault(); speechEngine.stopRecording(); });
}

// Giữ phím Spacebar để nói (nếu không đang gõ text)
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.activeElement !== commandInput) {
    e.preventDefault();
    speechEngine.startRecording();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && document.activeElement !== commandInput) {
    speechEngine.stopRecording();
  }
});

// E. Phím Tab ẩn/hiện Mission Tracker
const missionTracker = document.getElementById('mission-tracker');
window.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    missionTracker?.classList.toggle('hidden');
  }
});

// F. Chuyển đổi Hero qua thẻ Skill Q-W-E-R
const HERO_DATA = {
  leo: { name: 'Leo Harrison', role: 'The Guardian (Đội trưởng)', portrait: './assets/portraits/leo.jpg', color: '#00f0ff' },
  maya: { name: 'Maya Sterling', role: 'The Scholar (Nhà khảo cổ)', portrait: './assets/portraits/maya.jpg', color: '#9b51e0' },
  sam: { name: 'Sam Miller', role: 'The Fixer (Kỹ sư máy)', portrait: './assets/portraits/sam.jpg', color: '#f2c94c' },
  jade: { name: 'Jade Nguyen', role: 'The Wraith (Tiên phong)', portrait: './assets/portraits/jade.jpg', color: '#27ae60' }
};

function switchHero(heroKey) {
  const hero = HERO_DATA[heroKey];
  if (!hero) return;

  document.querySelectorAll('.skill-card').forEach(card => card.classList.remove('active-hero'));
  document.getElementById(`skill-${heroKey === 'leo' ? 'q' : heroKey === 'maya' ? 'w' : heroKey === 'sam' ? 'e' : 'r'}`)?.classList.add('active-hero');

  const avatarEl = document.getElementById('portrait-avatar');
  const nameEl = document.getElementById('portrait-name');
  const roleEl = document.getElementById('portrait-role');

  if (avatarEl) avatarEl.src = hero.portrait;
  if (nameEl) nameEl.textContent = hero.name;
  if (roleEl) roleEl.textContent = hero.role;
}

document.getElementById('skill-q')?.addEventListener('click', () => switchHero('leo'));
document.getElementById('skill-w')?.addEventListener('click', () => switchHero('maya'));
document.getElementById('skill-e')?.addEventListener('click', () => switchHero('sam'));
document.getElementById('skill-r')?.addEventListener('click', () => switchHero('jade'));

window.addEventListener('keydown', (e) => {
  if (document.activeElement === commandInput) return;
  if (e.key === 'q' || e.key === 'Q') switchHero('leo');
  if (e.key === 'w' || e.key === 'W') switchHero('maya');
  if (e.key === 'e' || e.key === 'E') switchHero('sam');
  if (e.key === 'r' || e.key === 'R') switchHero('jade');
});

// G. Lắng nghe khi click vào các vật thể trong Phaser Scene
EventBus.on(GAME_EVENTS.NPC_DIALOGUE_TRIGGERED, ({ npc, text }) => {
  const dialogueEl = document.getElementById('npc-dialogue');
  const nameEl = document.getElementById('portrait-name');
  if (dialogueEl) dialogueEl.textContent = `"${text}"`;
  if (nameEl) nameEl.textContent = npc;
});

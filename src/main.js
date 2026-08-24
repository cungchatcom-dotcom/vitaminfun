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
  backgroundColor: '#030a0d',
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
gameState.setSpeechEngine(speechEngine);

// Tải dữ liệu Màn 1
gameState.loadStage('./data/stages/stage_01.json');

// 3. BÊN TRÁI: FLOATING DRAWER (3 TABS: NHIỆM VỤ, BẢN ĐỒ, THÔNG TIN & NÚT ĐÓNG NGOÀI)
const btnTabMissions = document.getElementById('btn-tab-missions');
const btnTabMap = document.getElementById('btn-tab-map');
const btnTabTarget = document.getElementById('btn-tab-target');
const leftDrawerPanel = document.getElementById('left-drawer-panel');
const btnDrawerClose = document.getElementById('btn-drawer-close');

const missionsTabContent = document.getElementById('missions-tab-content');
const mapTabContent = document.getElementById('map-tab-content');
const targetTabContent = document.getElementById('target-tab-content');

let currentActiveDrawerTab = 'missions';

function setDrawerTab(tab) {
  if (currentActiveDrawerTab === tab && leftDrawerPanel?.classList.contains('open')) {
    closeDrawer();
    return;
  }

  currentActiveDrawerTab = tab;
  leftDrawerPanel?.classList.add('open');

  [btnTabMissions, btnTabMap, btnTabTarget].forEach(btn => btn?.classList.remove('active'));
  if (missionsTabContent) missionsTabContent.style.display = 'none';
  if (mapTabContent) mapTabContent.style.display = 'none';
  if (targetTabContent) targetTabContent.style.display = 'none';

  if (tab === 'missions') {
    btnTabMissions?.classList.add('active');
    if (missionsTabContent) missionsTabContent.style.display = 'block';
  } else if (tab === 'map') {
    btnTabMap?.classList.add('active');
    if (mapTabContent) mapTabContent.style.display = 'block';
  } else if (tab === 'target') {
    btnTabTarget?.classList.add('active');
    if (targetTabContent) targetTabContent.style.display = 'block';
  }
}

function closeDrawer() {
  leftDrawerPanel?.classList.remove('open');
  [btnTabMissions, btnTabMap, btnTabTarget].forEach(btn => btn?.classList.remove('active'));
}

btnTabMissions?.addEventListener('click', () => setDrawerTab('missions'));
btnTabMap?.addEventListener('click', () => setDrawerTab('map'));
btnTabTarget?.addEventListener('click', () => setDrawerTab('target'));
btnDrawerClose?.addEventListener('click', closeDrawer);

// 4. BẢN ĐỒ NHỎ (MINIMAP) REALTIME VÀ NPC NHẤP NHÁY
const minimapBox = document.getElementById('minimap-canvas-box');
let minimapWorldWidth = 3200;
let minimapWorldHeight = 2200;
let playerMarkerEl = null;

EventBus.on('MAP_INITIAL_POSITIONS', (data) => {
  if (!minimapBox) return;

  minimapWorldWidth = data.worldWidth;
  minimapWorldHeight = data.worldHeight;

  minimapBox.querySelectorAll('.map-marker').forEach(m => m.remove());

  // 1. Marker Thuyền trưởng Drake (NPC nhấp nháy nổi bật)
  const advMarker = document.createElement('div');
  advMarker.className = 'map-marker npc-advisor';
  advMarker.title = '⚓ Thuyền trưởng Drake (Cố vấn)';
  advMarker.textContent = '⚓';
  const advPercentX = (data.advisor.x / minimapWorldWidth) * 100;
  const advPercentY = (data.advisor.y / minimapWorldHeight) * 100;
  advMarker.style.left = `${advPercentX}%`;
  advMarker.style.top = `${advPercentY}%`;
  minimapBox.appendChild(advMarker);

  // 2. Marker các vị trí nhiệm vụ
  data.props.forEach(prop => {
    const propMarker = document.createElement('div');
    propMarker.className = 'map-marker quest-prop';
    propMarker.title = prop.name;
    propMarker.style.left = `${(prop.x / minimapWorldWidth) * 100}%`;
    propMarker.style.top = `${(prop.y / minimapWorldHeight) * 100}%`;
    minimapBox.appendChild(propMarker);
  });

  // 3. Marker Đồng đội (Maya, Sam, Jade)
  data.teammates.forEach(mate => {
    const mateMarker = document.createElement('div');
    mateMarker.className = 'map-marker teammate';
    mateMarker.title = mate.name;
    mateMarker.style.background = mate.color;
    mateMarker.style.left = `${(mate.x / minimapWorldWidth) * 100}%`;
    mateMarker.style.top = `${(mate.y / minimapWorldHeight) * 100}%`;
    minimapBox.appendChild(mateMarker);
  });

  // 4. Marker Người chơi (Leo - Tôi)
  playerMarkerEl = document.createElement('div');
  playerMarkerEl.className = 'map-marker player-me';
  playerMarkerEl.title = 'Leo (Tôi)';
  playerMarkerEl.style.left = `${(data.player.x / minimapWorldWidth) * 100}%`;
  playerMarkerEl.style.top = `${(data.player.y / minimapWorldHeight) * 100}%`;
  minimapBox.appendChild(playerMarkerEl);
});

// Cập nhật vị trí realtime của Leo trên Minimap
EventBus.on('PLAYER_REALTIME_POSITION', ({ x, y }) => {
  if (playerMarkerEl) {
    const percentX = (x / minimapWorldWidth) * 100;
    const percentY = (y / minimapWorldHeight) * 100;
    playerMarkerEl.style.left = `${percentX}%`;
    playerMarkerEl.style.top = `${percentY}%`;
  }
});

// 5. BÊN PHẢI: KHU VỰC CHAT
const mainChatWindow = document.getElementById('main-chat-window');
const btnChatFullscreen = document.getElementById('btn-chat-fullscreen');
const btnChatMinimize = document.getElementById('btn-chat-minimize');
const chatTextInput = document.getElementById('chat-text-input');
const btnChatSend = document.getElementById('btn-chat-send');
const btnChatVoice = document.getElementById('btn-chat-voice');

// Tự động mở thanh chat nếu nó đang đóng
function ensureChatOpen() {
  if (mainChatWindow?.classList.contains('minimized')) {
    mainChatWindow.classList.remove('minimized');
    if (btnChatMinimize) btnChatMinimize.textContent = '➖';
  }
}

// Phóng to / Thu nhỏ Fullscreen 80% màn hình
btnChatFullscreen?.addEventListener('click', () => {
  if (mainChatWindow?.classList.contains('minimized')) {
    mainChatWindow.classList.remove('minimized');
    if (btnChatMinimize) btnChatMinimize.textContent = '➖';
  }

  mainChatWindow?.classList.toggle('fullscreen');
  const isFull = mainChatWindow?.classList.contains('fullscreen');
  btnChatFullscreen.textContent = isFull ? '🗗' : '⛶';
  btnChatFullscreen.title = isFull ? 'Thu nhỏ lại kích thước chuẩn' : 'Phóng to 80% màn hình';
});

// Thu nhỏ / Mở rộng chiều cao chat
btnChatMinimize?.addEventListener('click', () => {
  if (mainChatWindow?.classList.contains('fullscreen')) {
    mainChatWindow.classList.remove('fullscreen');
    if (btnChatFullscreen) {
      btnChatFullscreen.textContent = '⛶';
      btnChatFullscreen.title = 'Phóng to 80% màn hình';
    }
  }

  mainChatWindow?.classList.toggle('minimized');
  const isMin = mainChatWindow?.classList.contains('minimized');
  btnChatMinimize.textContent = isMin ? '➕' : '➖';
});

// Gửi tin nhắn text
function submitChatMessage() {
  const text = chatTextInput?.value.trim();
  if (!text) return;

  gameState.postPlayerChatMessage(text);
  gameState.validateCommand(text);

  if (chatTextInput) chatTextInput.value = '';
}

btnChatSend?.addEventListener('click', submitChatMessage);

chatTextInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    submitChatMessage();
  }
});

// Vô hiệu phím game khi đang gõ text
document.querySelectorAll('input, textarea').forEach(input => {
  input.addEventListener('focus', () => {
    if (game.input?.keyboard) game.input.keyboard.enabled = false;
  });
  input.addEventListener('blur', () => {
    if (game.input?.keyboard) game.input.keyboard.enabled = true;
  });
});

// Ghi âm Voice từ nút "Giữ để Nói"
if (btnChatVoice) {
  btnChatVoice.addEventListener('mousedown', () => speechEngine.startRecording());
  btnChatVoice.addEventListener('mouseup', () => speechEngine.stopRecording());
  btnChatVoice.addEventListener('mouseleave', () => speechEngine.stopRecording());
  btnChatVoice.addEventListener('touchstart', (e) => { e.preventDefault(); speechEngine.startRecording(); });
  btnChatVoice.addEventListener('touchend', (e) => { e.preventDefault(); speechEngine.stopRecording(); });
}

window.addEventListener('keydown', (e) => {
  const activeEl = document.activeElement;
  const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

  if (e.code === 'Space' && !isTyping) {
    e.preventDefault();
    speechEngine.startRecording();
    btnChatVoice?.classList.add('recording');
  }
});
window.addEventListener('keyup', (e) => {
  const activeEl = document.activeElement;
  const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

  if (e.code === 'Space' && !isTyping) {
    speechEngine.stopRecording();
    btnChatVoice?.classList.remove('recording');
  }
});

// Khi nhận giọng nói đã nhận diện
EventBus.on(GAME_EVENTS.VOICE_OR_TEXT_SUBMITTED, (spokenText) => {
  btnChatVoice?.classList.remove('recording');
  gameState.postPlayerChatMessage(`🎤 "${spokenText}"`);
  gameState.validateCommand(spokenText);
});

// 6. TOP BAR: AVATAR PROFILE MODAL
const profileModal = document.getElementById('profile-modal');
const modalClose = document.getElementById('btn-modal-close');
const modalAvatar = document.getElementById('modal-avatar');
const modalName = document.getElementById('modal-name');
const modalRole = document.getElementById('modal-role');
const modalDesc = document.getElementById('modal-desc');
const modalWorld = document.getElementById('modal-world');
const modalSkillPts = document.getElementById('modal-skill-pts');
const modalEnergy = document.getElementById('modal-energy');
const modalShards = document.getElementById('modal-shards');
const btnModalChat = document.getElementById('btn-modal-chat');
const btnModalChatText = document.getElementById('btn-modal-chat-text');

let currentViewedHero = null;

function openHeroProfile(heroId) {
  const hero = gameState.heroes[heroId];
  if (!hero) return;

  currentViewedHero = hero;
  if (modalAvatar) modalAvatar.src = hero.portrait;
  if (modalName) modalName.textContent = hero.name;
  if (modalRole) modalRole.textContent = hero.role;
  if (modalDesc) modalDesc.textContent = hero.personality;
  if (modalWorld) modalWorld.textContent = hero.world;
  if (modalSkillPts) modalSkillPts.textContent = `${hero.skillPts} Pts`;
  if (modalEnergy) modalEnergy.textContent = `${hero.energy} / 10`;
  if (modalShards) modalShards.textContent = hero.shards;
  if (btnModalChatText) btnModalChatText.textContent = `Nhắn tin với ${hero.name.split(' ')[0]}`;

  profileModal?.classList.add('open');
}

document.querySelectorAll('.hero-avatar-item').forEach(item => {
  item.addEventListener('click', () => {
    const heroId = item.getAttribute('data-hero');
    openHeroProfile(heroId);
  });
});

modalClose?.addEventListener('click', () => {
  profileModal?.classList.remove('open');
});

profileModal?.addEventListener('click', (e) => {
  if (e.target === profileModal) {
    profileModal.classList.remove('open');
  }
});

btnModalChat?.addEventListener('click', () => {
  if (currentViewedHero) {
    profileModal?.classList.remove('open');
    ensureChatOpen();
    const heroShortName = currentViewedHero.name.split(' ')[0];
    if (chatTextInput) {
      chatTextInput.value = `@${heroShortName} `;
      chatTextInput.focus();
    }
  }
});

// 7. TOP BAR: SETTINGS MODAL POPUP
const settingsModal = document.getElementById('settings-modal');
const btnSettingsToggle = document.getElementById('btn-settings-toggle');
const btnSettingsClose = document.getElementById('btn-settings-close');
const btnExitStage = document.getElementById('btn-exit-stage');
const sliderBgm = document.getElementById('slider-bgm');
const sliderSfx = document.getElementById('slider-sfx');
const bgmVal = document.getElementById('bgm-val');
const sfxVal = document.getElementById('sfx-val');

btnSettingsToggle?.addEventListener('click', () => {
  settingsModal?.classList.add('open');
});

btnSettingsClose?.addEventListener('click', () => {
  settingsModal?.classList.remove('open');
});

settingsModal?.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.remove('open');
  }
});

sliderBgm?.addEventListener('input', (e) => {
  if (bgmVal) bgmVal.textContent = `${e.target.value}%`;
});

sliderSfx?.addEventListener('input', (e) => {
  if (sfxVal) sfxVal.textContent = `${e.target.value}%`;
});

btnExitStage?.addEventListener('click', () => {
  if (confirm('Bạn có chắc chắn muốn rời khỏi màn chơi hiện tại không?')) {
    window.location.reload();
  }
});

// 8. LẮNG NGHE SỰ KIỆN TƯƠNG TÁC TỪ STAGESCENE
EventBus.on('ADVISOR_SELECTED', () => {
  ensureChatOpen();
  setDrawerTab('target');
  gameState.selectAdvisorTarget();
});

EventBus.on('QUEST_TARGET_SELECTED', (targetInfo) => {
  ensureChatOpen();
  setDrawerTab('target');
  gameState.setQuestTarget(targetInfo);
});

EventBus.on('TARGET_DESELECTED', () => {
  gameState.resetTargetToPlayer();
});

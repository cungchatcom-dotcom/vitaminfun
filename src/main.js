import Phaser from 'phaser';
import { StageScene } from './scenes/StageScene.js';
import { GameState } from './core/GameState.js';
import { SpeechEngine } from './english/SpeechEngine.js';
import { EventBus, GAME_EVENTS } from './core/EventBus.js';
import { CHAPTERS_DATA, STAGES_CATALOG } from './core/stages_catalog.js';

// =========================================================================
// 1. CẤU HÌNH PHASER GAME
// =========================================================================
let phaserGame = null;

function initPhaserGame() {
  if (phaserGame) return;
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
  phaserGame = new Phaser.Game(config);
}

// =========================================================================
// 2. KHỞI TẠO GAME STATE & SPEECH ENGINE
// =========================================================================
const gameState = new GameState();
const speechEngine = new SpeechEngine();
gameState.setSpeechEngine(speechEngine);

// =========================================================================
// 3. QUẢN LÝ VIEW SCREENS (HẢI ĐỒ CHỌN MÀN VS MÀN CHƠI GAMEPLAY)
// =========================================================================
const stageSelectScreen = document.getElementById('stage-select-screen');
const stageGameplayScreen = document.getElementById('stage-gameplay-screen');
let currentScreen = 'stage-select-screen'; // Mặc định mở Hải Đồ chọn màn chơi

function switchScreen(screenId) {
  currentScreen = screenId;
  document.querySelectorAll('.view-screen').forEach(scr => scr.classList.remove('active'));

  if (screenId === 'stage-select-screen') {
    stageSelectScreen?.classList.add('active');
    updateMapHeaderStats();
    renderStageWaypoints();
    updateTimePortalUI();
  } else if (screenId === 'stage-gameplay-screen') {
    stageGameplayScreen?.classList.add('active');
    if (!phaserGame) {
      initPhaserGame();
    }
  }
}

// =========================================================================
// 4. HẢI ĐỒ THÁM HIỂM ATLANTIS (INTERACTIVE NAUTICAL CHART MAP CONTROLLER)
// =========================================================================
const chapterNavBar = document.getElementById('chapter-nav-bar');
const nauticalChartViewport = document.getElementById('nautical-chart-viewport');
const chartCanvasWorld = document.getElementById('chart-canvas-world');
const chartWaypointsLayer = document.getElementById('chart-waypoints-layer');
const svgPathsGroup = document.getElementById('svg-paths-group');
const stageInspectorPanel = document.getElementById('stage-inspector-panel');
const btnInspectorClose = document.getElementById('btn-inspector-close');
const btnStartStage = document.getElementById('btn-start-stage');

let currentActiveChapter = 1;
let selectedStageData = STAGES_CATALOG[0];

// Tọa độ tính toán cho 30 màn chơi trên bản đồ dọc uốn lượn (Winding Vertical Roadmap cao 8400px)
// Màn 1 ở dưới đáy (Y = 7800px) -> Màn 30 ở đỉnh (Y = 600px) -> Cánh Cổng Thời Gian (Y = 220px)
function getStageCoordinates(stage) {
  const y = 7800 - (stage.id - 1) * 245;
  // So le trái - phải quanh trục giữa (Khung rộng 1200px)
  const isLeft = stage.id % 2 === 1;
  const x = isLeft ? 320 : 880;
  return { x, y };
}

// 4.1 RENDER THANH CHỌN 5 CHƯƠNG (CHAPTER SELECTOR)
function renderChapterNavBar() {
  if (!chapterNavBar) return;

  chapterNavBar.innerHTML = CHAPTERS_DATA.map(ch => {
    const isAct = ch.id === currentActiveChapter;
    const shardsInChapter = STAGES_CATALOG.filter(st => st.chapterId === ch.id && gameState.hasShard(st.id)).length;
    return `
      <button class="chapter-nav-tab ${isAct ? 'active' : ''}" data-chapter="${ch.id}">
        <span class="chapter-tab-icon">${ch.icon}</span>
        <span class="chapter-tab-title">${ch.number}: ${ch.title}</span>
        <span class="chapter-tab-badge">${shardsInChapter}/6 🧩</span>
      </button>
    `;
  }).join('');

  chapterNavBar.querySelectorAll('.chapter-nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const chId = parseInt(btn.dataset.chapter, 10);
      scrollToChapter(chId);
    });
  });
}

function scrollToChapter(chapterId) {
  currentActiveChapter = chapterId;
  renderChapterNavBar();

  // Tính vị trí Y tương ứng với từng chương trên bản đồ dọc
  const chapterYMap = {
    1: 7800,
    2: 6300,
    3: 4800,
    4: 3300,
    5: 1800
  };

  const targetY = chapterYMap[chapterId] || 7800;
  if (nauticalChartViewport) {
    nauticalChartViewport.scrollTo({
      top: Math.max(0, targetY - 300),
      behavior: 'smooth'
    });
  }
}

// 4.2 RENDER TẤT CẢ 30 THẺ MÀN CHƠI LỚN & CÁNH CỔNG THỜI GIAN TRÊN HẢI ĐỒ DỌC
function renderStageWaypoints() {
  if (!chartWaypointsLayer || !svgPathsGroup) return;

  chartWaypointsLayer.innerHTML = '';
  svgPathsGroup.innerHTML = '';

  // 1. Render các Banner Phân Khu 5 Chương (Chapter Zone Dividers)
  const chapterBannerPositions = {
    1: 8120,
    2: 6540,
    3: 5040,
    4: 3540,
    5: 2040
  };

  CHAPTERS_DATA.forEach(ch => {
    const bannerY = chapterBannerPositions[ch.id] || 8100;
    const bannerEl = document.createElement('div');
    bannerEl.className = 'chapter-zone-banner';
    bannerEl.style.top = `${bannerY}px`;
    bannerEl.innerHTML = `
      <div class="chapter-banner-info">
        <div class="chapter-zone-tag">${ch.icon} ${ch.number} • KHU VỰC THỬ THÁCH</div>
        <div class="chapter-zone-title">${ch.title}</div>
        <div class="chapter-zone-desc">${ch.description}</div>
      </div>
      <img src="${ch.bannerImage}" alt="${ch.title}" class="chapter-banner-thumb">
    `;
    chartWaypointsLayer.appendChild(bannerEl);
  });

  // 2. Render SVG Energy Path Lines nối tuần tự các màn từ Màn 1 lên Màn 30
  for (let i = 0; i < STAGES_CATALOG.length - 1; i++) {
    const curr = STAGES_CATALOG[i];
    const next = STAGES_CATALOG[i + 1];
    const pt1 = getStageCoordinates(curr);
    const pt2 = getStageCoordinates(next);

    const isPathCleared = gameState.isStageCleared(curr.id) && gameState.isStageCleared(next.id);
    const isPathActive = gameState.isStageCleared(curr.id) && !gameState.isStageCleared(next.id);

    // Đường cong chữ S uốn lượn mềm mại giữa 2 bên
    const cpX1 = pt1.x;
    const cpY1 = (pt1.y + pt2.y) / 2;
    const cpX2 = pt2.x;
    const cpY2 = (pt1.y + pt2.y) / 2;
    const d = `M ${pt1.x} ${pt1.y} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${pt2.x} ${pt2.y}`;

    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', d);
    pathEl.setAttribute('class', `chart-path-line ${isPathCleared ? 'cleared' : (isPathActive ? 'active-pulse' : '')}`);
    svgPathsGroup.appendChild(pathEl);
  }

  // Nối đường từ Màn 30 lên Cánh cổng Thời gian ở đỉnh (Y = 220px, X = 600px)
  const stage30 = STAGES_CATALOG[29];
  const pt30 = getStageCoordinates(stage30);
  const portalPt = { x: 600, y: 340 };
  const portalPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  portalPath.setAttribute('d', `M ${pt30.x} ${pt30.y} C ${pt30.x} ${(pt30.y + portalPt.y)/2}, ${portalPt.x} ${(pt30.y + portalPt.y)/2}, ${portalPt.x} ${portalPt.y}`);
  portalPath.setAttribute('class', `chart-path-line ${gameState.collectedShards.length >= 30 ? 'cleared' : 'active-pulse'}`);
  svgPathsGroup.appendChild(portalPath);

  // 3. Render 30 Thẻ Màn Chơi Lớn (Large Stage Cards)
  const skillIcons = { "Nghe": "🎧 Nghe", "Nói": "🗣️ Nói", "Đọc": "📖 Đọc", "Viết": "✍️ Viết" };

  STAGES_CATALOG.forEach(st => {
    const pos = getStageCoordinates(st);
    const isCleared = gameState.isStageCleared(st.id);
    const isUnlocked = gameState.isStageUnlocked(st);
    const isJumpable = gameState.canJumpToStage(st);
    const hasShard = gameState.hasShard(st.id);
    const isSelected = selectedStageData && selectedStageData.id === st.id;
    const myCombatPower = gameState.getCombatPower();
    const hasEnoughCombatPower = myCombatPower >= st.minCombatPower;

    let cardStateClass = 'locked';
    if (isCleared) cardStateClass = 'cleared';
    else if (isJumpable) cardStateClass = 'jumpable';
    else if (isUnlocked) cardStateClass = 'unlocked';
    if (isSelected) cardStateClass += ' selected';

    const cardEl = document.createElement('div');
    cardEl.className = `stage-card-large ${cardStateClass}`;
    cardEl.style.left = `${pos.x}px`;
    cardEl.style.top = `${pos.y}px`;
    cardEl.dataset.stageId = st.id;

    const bannerImg = `./assets/backgrounds/chapter_${st.chapterId}.jpg`;
    const formattedNum = st.id < 10 ? `0${st.id}` : st.id;

    cardEl.innerHTML = `
      ${isJumpable ? `<div class="stage-card-jump-tag">⚡ Có thể Nhảy bậc!</div>` : ''}
      <div class="stage-card-banner">
        <img src="${bannerImg}" alt="${st.title}">
        <div class="stage-banner-overlay"></div>
        <div class="stage-card-num-badge">MÀN ${formattedNum}</div>
        <div class="stage-card-diff-badge meta-badge difficulty-${st.difficulty.toLowerCase().includes('easy') ? 'easy' : (st.difficulty.toLowerCase().includes('medium') ? 'medium' : 'hard')}">
          ${st.difficulty}
        </div>
        ${isCleared ? `<div class="stage-card-stars-badge">★★★</div>` : ''}
        ${hasShard ? `<div class="stage-card-shard-badge">🧩 Mảnh ${st.id}</div>` : ''}
        ${!isUnlocked && !isJumpable ? `
          <div class="stage-card-locked-badge">
            <span>🔒</span>
            <span>Cần ${st.minCombatPower} Pts</span>
          </div>
        ` : ''}
      </div>

      <div class="stage-card-body">
        <div class="stage-card-title">${st.title}</div>
        <div class="stage-card-story">${st.story}</div>
        
        <div class="stage-card-skills-row">
          ${st.skills.map(s => `<span class="stage-skill-pill">${skillIcons[s] || s}</span>`).join('')}
        </div>

        <div class="stage-card-footer">
          <div class="stage-combat-req ${hasEnoughCombatPower ? '' : 'unmet'}">
            ⚔️ ${st.minCombatPower} Pts Chiến Lực
          </div>
          <div class="stage-card-actions">
            <button class="btn-card-inspect" title="Xem chi tiết 4 nhiệm vụ">🔍 Chi Tiết</button>
            <button class="btn-card-play" title="Bắt đầu chơi màn này">
              ${isJumpable ? '⚡ Nhảy bậc' : (isUnlocked ? '⚔️ Vào Chơi' : '🔒 Khóa')}
            </button>
          </div>
        </div>
      </div>
    `;

    // Click vào thẻ để mở Inspector
    cardEl.addEventListener('click', (e) => {
      if (e.target.closest('.btn-card-play')) {
        // Nút play trực tiếp
        openStageInspector(st);
        btnStartStage?.click();
      } else {
        openStageInspector(st);
      }
    });

    chartWaypointsLayer.appendChild(cardEl);
  });

  // 4. Render Cánh Cổng Thời Gian (Chronos Time Portal Giant Card) ở đỉnh cao nhất
  const portalCard = document.createElement('div');
  portalCard.className = 'time-portal-giant-card';
  portalCard.style.top = '220px';
  portalCard.innerHTML = `
    <div class="portal-giant-banner">
      <img src="./assets/backgrounds/chapter_5.jpg" alt="Cánh Cổng Thời Gian">
    </div>
    <div class="portal-badge">✨ ĐÍCH ĐẾN CUỐI CÙNG WORLD 1</div>
    <div class="portal-giant-title">CÁNH CỔNG THỜI GIAN (CHRONOS PORTAL)</div>
    <div class="portal-giant-desc">
      Sưu tầm đủ 30 Mảnh Bản Đồ cổ đại từ 30 màn chơi để kích hoạt cánh cổng không gian, đưa nhóm bạn thoát khỏi Atlantis trở về nhà.
    </div>
    <button class="portal-giant-btn" id="btn-portal-giant-action">
      <span>🌀</span>
      <span>KIỂM TRA TIẾN ĐỘ & MỞ CỔNG (${gameState.collectedShards.length}/30 Mảnh)</span>
    </button>
  `;

  portalCard.addEventListener('click', openTimePortalModal);
  chartWaypointsLayer.appendChild(portalCard);
}

// 4.3 SLIDE-OUT STAGE DETAIL INSPECTOR (BẢNG KHẢO SÁT CHI TIẾT MÀN)
function openStageInspector(stage, shouldOpenDrawer = true) {
  selectedStageData = stage;
  if (!stageInspectorPanel) return;

  // Cập nhật thẻ hiển thị
  const inspChapterTag = document.getElementById('insp-chapter-tag');
  const inspStageTitle = document.getElementById('insp-stage-title');
  const inspStageStory = document.getElementById('insp-stage-story');
  const inspDifficulty = document.getElementById('insp-difficulty');
  const inspCombatReq = document.getElementById('insp-combat-req');
  const inspShardReward = document.getElementById('insp-shard-reward');
  const inspSkillsTags = document.getElementById('insp-skills-tags');

  const inspAdvisorAvatar = document.getElementById('insp-advisor-avatar');
  const inspAdvisorName = document.getElementById('insp-advisor-name');
  const inspAdvisorRole = document.getElementById('insp-advisor-role');
  const inspAdvisorQuote = document.getElementById('insp-advisor-quote');
  const inspTasksList = document.getElementById('insp-tasks-list');

  const chapterInfo = CHAPTERS_DATA.find(c => c.id === stage.chapterId);
  if (inspChapterTag) inspChapterTag.textContent = `${chapterInfo ? chapterInfo.number : 'CHƯƠNG'} • MÀN ${stage.stageNumber}`;
  if (inspStageTitle) inspStageTitle.textContent = stage.title;
  if (inspStageStory) inspStageStory.textContent = stage.story;

  if (inspDifficulty) {
    inspDifficulty.textContent = stage.difficulty;
    inspDifficulty.className = `meta-badge difficulty-${stage.difficulty.toLowerCase().includes('easy') ? 'easy' : (stage.difficulty.toLowerCase().includes('medium') ? 'medium' : 'hard')}`;
  }

  const isUnlocked = gameState.isStageUnlocked(stage);
  const isJumpable = gameState.canJumpToStage(stage);
  const myCombatPower = gameState.getCombatPower();

  if (inspCombatReq) {
    inspCombatReq.textContent = `⚔️ ${stage.minCombatPower} Pts`;
    if (myCombatPower >= stage.minCombatPower) {
      inspCombatReq.style.color = '#ffd166';
      inspCombatReq.style.borderColor = '#ffd166';
    } else {
      inspCombatReq.style.color = '#ff8888';
      inspCombatReq.style.borderColor = '#ff3b30';
    }
  }

  if (inspShardReward) {
    const hasShard = gameState.hasShard(stage.id);
    inspShardReward.textContent = hasShard ? `🧩 Đã có Mảnh ${stage.id}` : `🧩 Mảnh ${stage.id}`;
  }

  if (inspSkillsTags) {
    const skillIcons = { "Nghe": "🎧 Nghe", "Nói": "🗣️ Nói", "Đọc": "📖 Đọc", "Viết": "✍️ Viết" };
    inspSkillsTags.innerHTML = stage.skills.map(s => `<span class="skill-tag">${skillIcons[s] || s}</span>`).join('');
  }

  if (inspAdvisorAvatar) inspAdvisorAvatar.src = stage.advisor.avatar;
  if (inspAdvisorName) inspAdvisorName.textContent = stage.advisor.name;
  if (inspAdvisorRole) inspAdvisorRole.textContent = stage.advisor.role;
  if (inspAdvisorQuote) inspAdvisorQuote.textContent = `"${stage.advisor.advice}"`;

  if (inspTasksList) {
    inspTasksList.innerHTML = stage.tasks.map((task, idx) => `
      <div class="insp-task-item">
        <span class="insp-task-num">${idx + 1}</span>
        <div class="insp-task-content">
          <div class="insp-task-name">${task.title}</div>
          <div class="insp-task-skill">Kỹ năng: ${task.skill}</div>
          <div class="insp-task-desc">${task.desc}</div>
        </div>
      </div>
    `).join('');
  }

  // Nút bắt đầu
  if (btnStartStage) {
    if (isUnlocked || isJumpable) {
      btnStartStage.className = 'btn-start-stage';
      btnStartStage.innerHTML = isJumpable 
        ? `<span>⚡</span><span>NHẢY BẬC VÀO MÀN ${stage.id}</span>` 
        : `<span>⚔️</span><span>BẮT ĐẦU VƯỢT ẢI MÀN ${stage.id}</span>`;
      btnStartStage.disabled = false;
    } else {
      btnStartStage.className = 'btn-start-stage locked-btn';
      btnStartStage.innerHTML = `<span>🔒</span><span>CẦN ${stage.minCombatPower} ĐIỂM CHIẾN LỰC</span>`;
      btnStartStage.disabled = true;
    }
  }

  if (shouldOpenDrawer) {
    stageInspectorPanel.classList.add('open');
  }
}

btnInspectorClose?.addEventListener('click', () => {
  stageInspectorPanel?.classList.remove('open');
});

// Chuyển đổi Single vs Multi mode
const modeCardSingle = document.getElementById('mode-card-single');
const modeCardMulti = document.getElementById('mode-card-multi');

modeCardSingle?.addEventListener('click', () => {
  modeCardSingle.classList.add('active');
  modeCardMulti?.classList.remove('active');
  gameState.setSelectedMode('single');
});

modeCardMulti?.addEventListener('click', () => {
  modeCardMulti.classList.add('active');
  modeCardSingle?.classList.remove('active');
  gameState.setSelectedMode('multi');
});

// Bấm nút "BẮT ĐẦU VƯỢT ẢI"
btnStartStage?.addEventListener('click', () => {
  if (!selectedStageData) return;

  const isUnlocked = gameState.isStageUnlocked(selectedStageData);
  const isJumpable = gameState.canJumpToStage(selectedStageData);

  if (!isUnlocked && !isJumpable) {
    alert(`⚠️ Màn ${selectedStageData.id} chưa mở khóa!\nBạn cần tối thiểu ${selectedStageData.minCombatPower} Điểm chiến lực.`);
    return;
  }

  stageInspectorPanel?.classList.remove('open');

  if (selectedStageData.id === 1) {
    // Vào chơi trực tiếp Màn 1
    switchScreen('stage-gameplay-screen');
    gameState.loadStage('./data/stages/world_01/stage_01.json');
  } else {
    // Demo chuyển màn
    const modeName = gameState.selectedMode === 'multi' ? 'Chơi Đội 4 Người (Ghép Bot tự động)' : 'Chơi Đơn';
    alert(`🚀 Đang khởi tạo Màn ${selectedStageData.id}: "${selectedStageData.title}"\n• Chế độ: ${modeName}\n• NPC Cố vấn: ${selectedStageData.advisor.name}\n\n(Hệ thống đang mở màn chơi 1 làm sân khấu chính, bạn có thể trải nghiệm toàn bộ cơ chế voice/chat tại Màn 1!)`);
    switchScreen('stage-gameplay-screen');
    gameState.loadStage('./data/stages/world_01/stage_01.json');
  }
});

// 4.4 MODAL CÁNH CỔNG THỜI GIAN (TIME PORTAL HUB)
const timePortalModal = document.getElementById('time-portal-modal');
const btnOpenTimePortal = document.getElementById('btn-open-time-portal');
const btnPortalModalClose = document.getElementById('btn-portal-modal-close');
const portalShardsRadialGrid = document.getElementById('portal-shards-radial-grid');
const portalWheelCount = document.getElementById('portal-wheel-count');
const portalProgressFill = document.getElementById('portal-progress-fill');
const portalStatText = document.getElementById('portal-stat-text');
const missingChipsList = document.getElementById('missing-chips-list');
const btnActivatePortal = document.getElementById('btn-activate-portal');
const topPortalStatus = document.getElementById('top-portal-status');

function openTimePortalModal() {
  updateTimePortalUI();
  timePortalModal?.classList.add('open');
}

function updateTimePortalUI() {
  const status = gameState.getTimePortalStatus();

  if (topPortalStatus) {
    topPortalStatus.textContent = `${status.currentCollected}/30 Mảnh Cổ`;
  }
  if (portalWheelCount) {
    portalWheelCount.textContent = `${status.currentCollected}/30`;
  }
  if (portalProgressFill) {
    const pct = Math.round((status.currentCollected / 30) * 100);
    portalProgressFill.style.width = `${pct}%`;
  }
  if (portalStatText) {
    const pct = Math.round((status.currentCollected / 30) * 100);
    portalStatText.textContent = `${status.currentCollected} / 30 Mảnh bản đồ cổ (${pct}%)`;
  }

  // Render 30 Slots rãnh mảnh bản đồ xếp tròn
  if (portalShardsRadialGrid) {
    portalShardsRadialGrid.innerHTML = '';
    const radius = 105;
    const centerX = 130;
    const centerY = 130;

    for (let i = 1; i <= 30; i++) {
      const angle = ((i - 1) / 30) * 2 * Math.PI - Math.PI / 2;
      const slotX = centerX + radius * Math.cos(angle);
      const slotY = centerY + radius * Math.sin(angle);
      const hasCollected = gameState.hasShard(i);

      const slotEl = document.createElement('div');
      slotEl.className = `portal-shard-slot ${hasCollected ? 'collected' : ''}`;
      slotEl.style.left = `${slotX}px`;
      slotEl.style.top = `${slotY}px`;
      slotEl.textContent = i;
      slotEl.title = hasCollected ? `Mảnh ${i} (Đã có)` : `Mảnh ${i} (Chưa có)`;

      portalShardsRadialGrid.appendChild(slotEl);
    }
  }

  // Render danh sách các màn còn thiếu
  if (missingChipsList) {
    missingChipsList.innerHTML = status.missingShards.map(shardId => {
      const st = STAGES_CATALOG.find(s => s.id === shardId);
      return `<button class="missing-chip" data-stage="${shardId}">Màn ${shardId}: ${st ? st.title : ''}</button>`;
    }).join('');

    missingChipsList.querySelectorAll('.missing-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const sId = parseInt(chip.dataset.stage, 10);
        const stage = STAGES_CATALOG.find(s => s.id === sId);
        if (stage) {
          timePortalModal?.classList.remove('open');
          openStageInspector(stage);
          const targetX = getStageCoordinates(stage).x;
          nauticalChartViewport?.scrollTo({ left: Math.max(0, targetX - 400), behavior: 'smooth' });
        }
      });
    });
  }

  // Trạng thái nút mở cổng
  if (btnActivatePortal) {
    if (status.isReady) {
      btnActivatePortal.className = 'btn-activate-portal';
      btnActivatePortal.innerHTML = '<span>🌀</span><span>KÍCH HOẠT MỞ CỔNG THỜI GIAN (VỀ NHÀ)</span>';
      btnActivatePortal.onclick = () => {
        alert('🎉 CHÚC MỪNG BẠN ĐÃ MỞ CÁNH CỔNG THỜI GIAN THÀNH CÔNG!\nNhóm bạn đã vượt qua tất cả 30 thử thách của Atlantis và trở về thế giới hiện đại!');
      };
    } else {
      btnActivatePortal.className = 'btn-activate-portal disabled';
      btnActivatePortal.innerHTML = '<span>⚠️</span><span>CHƯA ĐỦ 30 MẢNH BẢN ĐỒ CỔ</span>';
      btnActivatePortal.onclick = null;
    }
  }
}

btnOpenTimePortal?.addEventListener('click', openTimePortalModal);
btnPortalModalClose?.addEventListener('click', () => {
  timePortalModal?.classList.remove('open');
});
timePortalModal?.addEventListener('click', (e) => {
  if (e.target === timePortalModal) timePortalModal.classList.remove('open');
});

// 4.5 CẬP NHẬT HEADER CHỈ SỐ HẢI ĐỒ
function updateMapHeaderStats() {
  const mapCombatPower = document.getElementById('map-combat-power');
  const mapShardsCount = document.getElementById('map-shards-count');
  const modalSkillPts = document.getElementById('modal-skill-pts');
  const modalShards = document.getElementById('modal-shards');

  const cp = gameState.getCombatPower();
  const shards = `${gameState.collectedShards.length} / 30`;

  if (mapCombatPower) mapCombatPower.textContent = `${cp} Pts`;
  if (mapShardsCount) mapShardsCount.textContent = shards;
  if (modalSkillPts) modalSkillPts.textContent = `${cp} Pts`;
  if (modalShards) modalShards.textContent = `${shards} Mảnh`;
}

EventBus.on('COMBAT_POWER_CHANGED', updateMapHeaderStats);
EventBus.on('RETURN_TO_STAGE_SELECT', () => {
  switchScreen('stage-select-screen');
});

// 4.6 KÉO CHUỘT ĐỂ CUỘN HẢI ĐỒ (PANNING SUPPORT)
let isPanning = false;
let startX = 0;
let scrollLeftStart = 0;

nauticalChartViewport?.addEventListener('mousedown', (e) => {
  if (e.target.closest('.waypoint-node') || e.target.closest('.stage-inspector-panel')) return;
  isPanning = true;
  startX = e.pageX - nauticalChartViewport.offsetLeft;
  scrollLeftStart = nauticalChartViewport.scrollLeft;
});

window.addEventListener('mouseup', () => {
  isPanning = false;
});

window.addEventListener('mousemove', (e) => {
  if (!isPanning || !nauticalChartViewport) return;
  e.preventDefault();
  const x = e.pageX - nauticalChartViewport.offsetLeft;
  const walk = (x - startX) * 1.5;
  nauticalChartViewport.scrollLeft = scrollLeftStart - walk;
});

// =========================================================================
// 5. TOP BAR GAMEPLAY & ĐIỀU HƯỚNG QUAY LẠI HẢI ĐỒ
// =========================================================================
const btnBackToMap = document.getElementById('btn-back-to-map');
btnBackToMap?.addEventListener('click', () => {
  switchScreen('stage-select-screen');
});

// 6. BÊN TRÁI: FLOATING DRAWER (3 TABS: NHIỆM VỤ, BẢN ĐỒ, THÔNG TIN & NÚT ĐÓNG NGOÀI)
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

// 7. BẢN ĐỒ NHỎ (MINIMAP) REALTIME VÀ NPC NHẤP NHÁY
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

  // 2. Marker các Bot đồng đội
  data.bots.forEach(bot => {
    const bMarker = document.createElement('div');
    bMarker.className = 'map-marker bot-marker';
    bMarker.id = `minimap-bot-${bot.id}`;
    bMarker.title = bot.name;
    const bx = (bot.x / minimapWorldWidth) * 100;
    const by = (bot.y / minimapWorldHeight) * 100;
    bMarker.style.left = `${bx}%`;
    bMarker.style.top = `${by}%`;
    if (bot.id === 'maya') bMarker.style.background = '#9b51e0';
    if (bot.id === 'sam') bMarker.style.background = '#ff7b00';
    if (bot.id === 'jade') bMarker.style.background = '#27ae60';
    minimapBox.appendChild(bMarker);
  });

  // 3. Marker các Đối tượng nhiệm vụ
  data.targets.forEach(tgt => {
    const tMarker = document.createElement('div');
    tMarker.className = 'map-marker quest-target';
    tMarker.title = tgt.name;
    tMarker.textContent = tgt.icon || '📍';
    const tx = (tgt.x / minimapWorldWidth) * 100;
    const ty = (tgt.y / minimapWorldHeight) * 100;
    tMarker.style.left = `${tx}%`;
    tMarker.style.top = `${ty}%`;
    minimapBox.appendChild(tMarker);
  });

  // 4. Marker Người chơi (Leo)
  playerMarkerEl = document.createElement('div');
  playerMarkerEl.className = 'map-marker player-marker';
  playerMarkerEl.title = 'Leo (Tôi)';
  const px = (data.player.x / minimapWorldWidth) * 100;
  const py = (data.player.y / minimapWorldHeight) * 100;
  playerMarkerEl.style.left = `${px}%`;
  playerMarkerEl.style.top = `${py}%`;
  minimapBox.appendChild(playerMarkerEl);
});

EventBus.on('PLAYER_MOVED', (pos) => {
  if (playerMarkerEl && minimapWorldWidth && minimapWorldHeight) {
    const px = (pos.x / minimapWorldWidth) * 100;
    const py = (pos.y / minimapWorldHeight) * 100;
    playerMarkerEl.style.left = `${px}%`;
    playerMarkerEl.style.top = `${py}%`;
  }
});

// 8. KHU VỰC CHAT REALTIME
const mainChatWindow = document.getElementById('main-chat-window');
const mainChatBody = document.getElementById('main-chat-body');
const chatTextInput = document.getElementById('chat-text-input');
const btnChatSend = document.getElementById('btn-chat-send');
const btnChatVoice = document.getElementById('btn-chat-voice');
const btnChatFullscreen = document.getElementById('btn-chat-fullscreen');
const btnChatMinimize = document.getElementById('btn-chat-minimize');

let isChatMinimized = false;
let isChatFullscreen = false;

function ensureChatOpen() {
  if (isChatMinimized) {
    isChatMinimized = false;
    mainChatWindow?.classList.remove('minimized');
  }
}

btnChatMinimize?.addEventListener('click', () => {
  isChatMinimized = !isChatMinimized;
  if (isChatMinimized) {
    mainChatWindow?.classList.add('minimized');
    if (isChatFullscreen) {
      isChatFullscreen = false;
      mainChatWindow?.classList.remove('fullscreen-chat');
    }
  } else {
    mainChatWindow?.classList.remove('minimized');
  }
});

btnChatFullscreen?.addEventListener('click', () => {
  isChatFullscreen = !isChatFullscreen;
  if (isChatFullscreen) {
    isChatMinimized = false;
    mainChatWindow?.classList.remove('minimized');
    mainChatWindow?.classList.add('fullscreen-chat');
  } else {
    mainChatWindow?.classList.remove('fullscreen-chat');
  }
});

function appendChatMessage(msg) {
  if (!mainChatBody) return;
  const row = document.createElement('div');
  row.className = `chat-msg-row ${msg.sender === 'user' ? 'player' : (msg.sender === 'npc' ? 'npc' : (msg.sender === 'system' ? 'system' : 'bot'))}`;

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble-card';

  if (msg.sender === 'user') {
    bubble.innerHTML = `
      <div class="chat-msg-author">Leo (Tôi)</div>
      <div class="chat-msg-text">${escapeHtml(msg.text)}</div>
    `;
  } else if (msg.sender === 'npc') {
    bubble.innerHTML = `
      <div class="chat-msg-author" style="color: var(--gold-orichalcum);">⚓ ${escapeHtml(msg.author || 'Thuyền trưởng Drake')}</div>
      <div class="chat-msg-text">${escapeHtml(msg.text)}</div>
      <div class="chat-msg-trans" style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 4px;">
        <em>${escapeHtml(msg.trans || '')}</em>
      </div>
    `;
  } else if (msg.sender === 'system') {
    bubble.innerHTML = `<div class="chat-msg-text">🌟 ${escapeHtml(msg.text)}</div>`;
  } else {
    bubble.innerHTML = `
      <div class="chat-msg-author">${escapeHtml(msg.author || 'Đồng đội')}</div>
      <div class="chat-msg-text">${escapeHtml(msg.text)}</div>
    `;
  }

  row.appendChild(bubble);
  mainChatBody.appendChild(row);
  mainChatBody.scrollTop = mainChatBody.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function handleSendUserMessage() {
  const text = chatTextInput?.value.trim();
  if (!text) return;
  chatTextInput.value = '';
  gameState.handlePlayerInput(text);
}

btnChatSend?.addEventListener('click', handleSendUserMessage);
chatTextInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSendUserMessage();
});

// VOICE HOLD TO SPEAK
let isRecording = false;
btnChatVoice?.addEventListener('mousedown', () => {
  isRecording = true;
  btnChatVoice.classList.add('recording');
  speechEngine.startListening((transcript) => {
    if (chatTextInput) chatTextInput.value = transcript;
    gameState.handlePlayerInput(transcript);
  });
});

window.addEventListener('mouseup', () => {
  if (isRecording) {
    isRecording = false;
    btnChatVoice?.classList.remove('recording');
    speechEngine.stopListening();
  }
});

EventBus.on('NEW_CHAT_MESSAGE', (msg) => {
  appendChatMessage(msg);
});

// 9. PROFILE MODAL POPUP
const profileModal = document.getElementById('profile-modal');
const btnModalClose = document.getElementById('btn-modal-close');
const btnModalChat = document.getElementById('btn-modal-chat');
const btnPlayerProfile = document.getElementById('btn-player-profile');

let currentViewedHero = null;

function openProfileModal(heroId) {
  const hero = gameState.heroes[heroId];
  if (!hero) return;
  currentViewedHero = hero;

  document.getElementById('modal-avatar').src = hero.portrait;
  document.getElementById('modal-name').textContent = hero.name;
  document.getElementById('modal-role').textContent = hero.role;
  document.getElementById('modal-desc').textContent = hero.personality;
  document.getElementById('modal-world').textContent = hero.world;
  document.getElementById('modal-skill-pts').textContent = `${gameState.getCombatPower()} Pts`;
  document.getElementById('modal-energy').textContent = `${hero.energy} / 10`;
  document.getElementById('modal-shards').textContent = `${gameState.collectedShards.length} / 30 Mảnh`;

  document.getElementById('btn-modal-chat-text').textContent = `Nhắn tin với ${hero.name.split(' ')[0]}`;
  profileModal?.classList.add('open');
}

document.querySelectorAll('.hero-avatar-item').forEach(item => {
  item.addEventListener('click', () => {
    const heroId = item.dataset.hero;
    openProfileModal(heroId);
  });
});

btnPlayerProfile?.addEventListener('click', () => {
  openProfileModal('leo');
});

btnModalClose?.addEventListener('click', () => {
  profileModal?.classList.remove('open');
});

profileModal?.addEventListener('click', (e) => {
  if (e.target === profileModal) profileModal.classList.remove('open');
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

// 10. SETTINGS MODAL POPUP
const settingsModal = document.getElementById('settings-modal');
const btnSettingsToggle = document.getElementById('btn-settings-toggle');
const btnMapSettingsToggle = document.getElementById('btn-map-settings-toggle');
const btnSettingsClose = document.getElementById('btn-settings-close');
const btnExitStage = document.getElementById('btn-exit-stage');
const sliderBgm = document.getElementById('slider-bgm');
const sliderSfx = document.getElementById('slider-sfx');
const bgmVal = document.getElementById('bgm-val');
const sfxVal = document.getElementById('sfx-val');

[btnSettingsToggle, btnMapSettingsToggle].forEach(btn => {
  btn?.addEventListener('click', () => settingsModal?.classList.add('open'));
});

btnSettingsClose?.addEventListener('click', () => {
  settingsModal?.classList.remove('open');
});

settingsModal?.addEventListener('click', (e) => {
  if (e.target === settingsModal) settingsModal.classList.remove('open');
});

sliderBgm?.addEventListener('input', (e) => {
  if (bgmVal) bgmVal.textContent = `${e.target.value}%`;
});

sliderSfx?.addEventListener('input', (e) => {
  if (sfxVal) sfxVal.textContent = `${e.target.value}%`;
});

btnExitStage?.addEventListener('click', () => {
  settingsModal?.classList.remove('open');
  switchScreen('stage-select-screen');
});

// 11. LẮNG NGHE SỰ KIỆN TƯƠNG TÁC TỪ STAGESCENE
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

// 11.1 NÚT CUỘN NHANH LÊN CỔNG THỜI GIAN HOẶC VỀ MÀN 1
const btnScrollToPortal = document.getElementById('btn-scroll-to-portal');
const btnScrollToStart = document.getElementById('btn-scroll-to-start');

btnScrollToPortal?.addEventListener('click', () => {
  nauticalChartViewport?.scrollTo({ top: 0, behavior: 'smooth' });
});

btnScrollToStart?.addEventListener('click', () => {
  if (nauticalChartViewport) {
    nauticalChartViewport.scrollTo({ top: nauticalChartViewport.scrollHeight, behavior: 'smooth' });
  }
});

function scrollToInitialStage1() {
  setTimeout(() => {
    if (nauticalChartViewport) {
      nauticalChartViewport.scrollTop = nauticalChartViewport.scrollHeight;
    }
  }, 100);
}

// 12. KHỞI TẠO BAN ĐẦU
window.addEventListener('DOMContentLoaded', () => {
  renderChapterNavBar();
  renderStageWaypoints();
  updateMapHeaderStats();
  updateTimePortalUI();
  openStageInspector(STAGES_CATALOG[0], false);
  scrollToInitialStage1();
});

// Auto-init right away in case DOMContentLoaded has already fired
renderChapterNavBar();
renderStageWaypoints();
updateMapHeaderStats();
updateTimePortalUI();
openStageInspector(STAGES_CATALOG[0], false);
scrollToInitialStage1();

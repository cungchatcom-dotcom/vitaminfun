# VITAMINFUN — MASTER SYSTEM SPECIFICATIONS & ARCHITECTURE

**Tài liệu:** Master Specifications (PRD + TDD + Game Economy & Unit Economics)  
**Phiên bản:** 1.1.0  
**Ngày tạo:** 2026-08-18  
**Role:** Senior Software Architect & EdTech Product Lead  
**Trạng thái:** Approved Baseline (Single Source of Truth - SSOT)

---

## MỤC LỤC
1. [TỔNG QUAN DỰ ÁN & PRODUCT REQUIREMENTS (PRD)](#1-tổng-quan-dự-án--product-requirements-prd)
2. [HỆ THỐNG GAMEPLAY & KHUNG NĂNG LỰC STEALTH LEARNING](#2-hệ-thống-gameplay--khung-năng-lực-stealth-learning)
3. [KIẾN TRÚC KỸ THUẬT TOÀN HỆ THỐNG (SYSTEM & TECHNICAL ARCHITECTURE)](#3-kiến-trúc-kỹ-thuật-toàn-hệ-thống-system--technical-architecture)
4. [PIPELINE AI NPC & VOICE REAL-TIME (CORE ENGINE)](#4-pipeline-ai-npc--voice-real-time-core-engine)
5. [CƠ SỞ DỮ LIỆU & DATA SCHEMAS (ERD & JSON SPECS)](#5-cơ-sở-dữ-liệu--data-schemas-erd--json-specs)
6. [MÔ HÌNH KINH TẾ (GAME ECONOMY, TOKENOMICS & O2O VOUCHERS)](#6-mô-hình-kinh-tế-game-economy-tokenomics--o2o-vouchers)
7. [PHÂN TÍCH CHI PHÍ AI, COGS, UNIT ECONOMICS & BỘ PHÒNG VỆ CHI PHÍ](#7-phân-tích-chi-phí-ai-cogs-unit-economics--bộ-phòng-vệ-chi-phí)
8. [NỀN TẢNG UGC & CREATOR MARKETPLACE (VIBE CODING PLATFORM)](#8-nền-tảng-ugc--creator-marketplace-vibe-coding-platform)
9. [LỘ TRÌNH TRIỂN KHAI (ROADMAP) & TIÊU CHUẨN ĐO LƯỜNG (KPIS)](#9-lộ-trình-triển-khai-roadmap--tiêu-chuẩn-đo-lường-kpis)

## Game architecture

┌───────────────────────────────┐
│         Unreal Engine         │
│                               │
│  World / Character / NPC      │
│  Animation / UI / Gameplay    │
└───────────────┬───────────────┘
                │
┌───────────────▼───────────────┐
│       Game Domain Layer       │
│                               │
│ Quest / Dialogue / Mission    │
│ Inventory / Progression       │
└───────────────┬───────────────┘
                │
┌───────────────▼───────────────┐
│       Learning Engine         │
│                               │
│ CEFR / Skill / Assessment     │
│ Adaptive Difficulty            │
└───────────────┬───────────────┘
                │
┌───────────────▼───────────────┐
│          AI Layer             │
│                               │
│ LLM / STT / TTS / Evaluation  │
└───────────────┬───────────────┘
                │
┌───────────────▼───────────────┐
│          Backend              │
│                               │
│ NestJS / PostgreSQL / Redis   │
└───────────────────────────────┘

---

# 1. TỔNG QUAN DỰ ÁN & PRODUCT REQUIREMENTS (PRD)

```text
┌────────────────────────────────────────────────────────────────────────┐
│                       VITAMINFUN PRODUCT VISION                        │
├────────────────────────────────────────────────────────────────────────┤
│ "Biến việc học ngoại ngữ thành một tựa game nhập vai thực thụ,         │
│ nơi tiếng Anh/tiếng Trung là công cụ sinh tồn và vượt ải,              │
│ còn yếu tố học thuật được ẩn giấu hoàn toàn sau trải nghiệm."          │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.1. Mục tiêu & Định vị
* **Tên dự án:** Vitaminfun.
* **Đối tượng mục tiêu:** Học sinh, sinh viên, người trẻ từ 12 – 25 tuổi (Gen Z & Gen Alpha).
* **Vấn đề cốt lõi của thị trường:** Các ứng dụng học tiếng Anh hiện tại (Duolingo, Elsa, v.v.) thiên về học thuật và "sách vở", khiến người học nhanh nản sau 14–30 ngày. Người học thiếu môi trường giao tiếp thực tế không áp lực.
* **Giải pháp đột phá:** Game nhập vai thế giới mở chia theo Map/Stage. Học viên điều khiển nhân vật làm nhiệm vụ, tương tác bằng giọng nói thời gian thực với AI NPC. Hoàn thành nhiệm vụ nhận điểm đổi quà thật (Voucher sách tại Fahasa, Phương Nam).

### 1.2. Chân dung Người dùng (User Personas)
* **Learner / Gamer (12–25 tuổi):** Muốn cải thiện khả năng phản xạ nghe-nói tự nhiên, yêu thích cốt truyện sinh tồn/khám phá, thích cày rank và săn phần thưởng.
* **Vibe Coder / Content Creator (18–30 tuổi):** Lập trình viên, giáo viên tiếng Anh hoặc người sáng tạo nội dung muốn tạo map/nhiệm vụ bằng AI prompt để kiếm tiền chia sẻ doanh thu từ Marketplace.

---

# 2. HỆ THỐNG GAMEPLAY & KHUNG NĂNG LỰC STEALTH LEARNING

### 2.1. Cấu trúc Thế giới Game (World Hierarchy)
$$\text{Ngôn ngữ (Language)} \longrightarrow \text{Map (Chủ đề lớn)} \longrightarrow \text{Stage (Màn chơi)} \longrightarrow \text{Quests (Nhiệm vụ cụ thể)}$$

* **Map Mẫu 01: "Sinh tồn trong rừng" (Forest Survival)**
  * **Stage 1:** Đi tiệm tạp hóa mua đồ picnic (Mua diêm, nước uống, đồ hộp).
  * **Stage 2:** Bắt chuyến xe bus cuối cùng về vùng núi Redwood.
  * **Stage 3:** Bị lạc trong rừng lúc chập tối (Đọc la bàn, quan sát dấu chân).
  * **Stage 4:** Chạm trán thú dữ (Dùng tiếng Anh ra lệnh, gây tiếng động hoặc thương lượng).
  * **Stage 5:** Tìm vị trí an toàn và dựng lều.
  * **Stage 6:** Tìm củi nhóm lửa, lọc nước uống.
  * **Stage 7:** Tìm đường thoát hiểm qua liên lạc radio SOS.
  * **Stage 8:** Gặp đội cứu hộ và trở về an toàn.

### 2.2. Tích hợp 4 Kỹ năng (4-Skill Stealth Integration)
* **1. Speaking (Nói):** Bật Mic đàm thoại với NPC: Mua sắm, hỏi đường, phát tín hiệu radio SOS, trả giá, thuyết phục.
* **2. Listening (Nghe):** Nghe NPC giao tiếp với âm thanh môi trường nền (tiếng động rừng, tiếng loa bến xe, tiếng mưa).
* **3. Reading (Đọc):** Đọc nhãn bao bì sinh tồn, biển chỉ dẫn, bản đồ địa hình, nhật ký của người đi rừng để lại.
* **4. Writing (Viết):** Soạn tin nhắn văn bản SOS, ghi chép nhật trình, điền mẫu đơn đăng ký vào khu bảo tồn.

### 2.3. Khung Đánh giá Năng lực (Rubric & Scoring Engine)
Mỗi tương tác được chấm điểm tự động từ 0 đến 100 theo 4 tiêu chuẩn:

| Tiêu chí | Trọng số | Mô tả |
| :--- | :---: | :--- |
| **Task Completion** | **40%** | Hoàn thành mục tiêu giao tiếp (NPC hiểu và đồng ý). |
| **Fluency & Pronunciation** | **30%** | Độ trôi chảy, đúng ngữ điệu và phát âm từ khóa. |
| **Grammar Accuracy** | **15%** | Đúng cấu trúc câu theo ngữ cảnh. |
| **Vocabulary & Relevance** | **15%** | Đúng từ vựng chủ đề và súc tích, không lan man. |

* **Quy chuẩn qua màn:**
  * **Điểm $\ge$ 70/100:** Đạt yêu cầu $\rightarrow$ Qua màn.
  * **Điểm $<$ 70/100:** Không đạt $\rightarrow$ NPC từ chối, học viên phải thử lại.

---

# 3. KIẾN TRÚC KỸ THUẬT TOÀN HỆ THỐNG (SYSTEM & TECHNICAL ARCHITECTURE)

* **Client Layer:** Flutter + Flame / 2D Canvas (Phaser.js / PixiJS) + Smart VAD.
* **API Gateway:** Envoy / NGINX / Cloudflare + Redis Token Bucket Rate Limiter.
* **Quest Engine:** NestJS / Go State Machine quản lý tiến trình màn chơi.
* **AI Orchestration Pipeline:** WebSocket streaming kết nối Deepgram STT $\rightarrow$ Gemini 2.0 Flash $\rightarrow$ Kokoro/Azure TTS.
* **Economy & Commerce:** Microservice quản lý Ví Xu, Subscription và Cổng Voucher O2O.
* **Data Storage:** PostgreSQL (Core Data) + Redis Cluster (Live Sessions) + S3 (Assets/Audio).

---

# 4. PIPELINE AI NPC & VOICE REAL-TIME (CORE ENGINE)

> **Quy chuẩn SLA:** Thời gian phản hồi $\le$ 1.2 giây từ khi người chơi dứt lời đến khi NPC cất tiếng nói.

### 4.1. Single-Call AI Optimization (Gộp Dialogue + Assessment)
```json
{
  "npc_dialogue": "Good choice! Two bottles of water and a box of matches will be 5 dollars. Anything else?",
  "assessment": {
    "task_completed": true,
    "score": 85,
    "fluency_score": 80,
    "grammar_score": 90,
    "feedback": "Phát âm từ 'matches' rất chuẩn. Cần chú ý âm đuôi của từ 'bottles'.",
    "detected_errors": []
  },
  "quest_progress": {
    "bought_water": true,
    "bought_matches": true
  },
  "next_state": "CHECKOUT"
}
```

---

# 5. CƠ SỞ DỮ LIỆU & DATA SCHEMAS (ERD & JSON SPECS)

### 5.1. Sơ đồ Quan hệ Thực thể (Entity Relationship Diagram - ERD)

```text
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    users     │1     *│ user_wallets │       │     maps     │
├──────────────┤───────├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │       │ id (PK)      │
│ email        │       │ user_id (FK) │       │ title        │
│ username     │       │ xu_balance   │       │ language_code│
│ role         │       │ point_balance│       │ creator_id   │
└──────┬───────┘       └──────────────┘       └──────┬───────┘
       │1                                            │1
       │                                             │
       │*                                            │*
┌──────▼───────┐                              ┌──────▼───────┐
│ quest_logs   │                              │    stages    │
├──────────────┤                              ├──────────────┤
│ id (PK)      │                              │ id (PK)      │
│ user_id (FK) │                              │ map_id (FK)  │
│ stage_id (FK)│*                            1│ stage_order  │
│ score        │──────────────────────────────│ goal_rubric  │
│ status       │                              │ npc_persona  │
└──────────────┘                              └──────────────┘
```

### 5.2. Stage Spec JSON (Cấu hình Màn chơi Tổng quát)
```json
{
  "stage_id": "FOREST_01_TOWN",
  "npc_config": {
    "greeting": "Hey there! You look like you're ready for an adventure. What brings you to our town?",
    "task_prompt": "The user needs to buy 2 bottles of water and a box of matches.",
    "target_vocabulary": [
      "water",
      "matches",
      "dollars",
      "buy",
      "please",
      "check",
      "credit card",
      "cash"
    ],
    "difficulty": "A2"
  },
  "quest_rules": {
    "required_items": [
      "water",
      "matches"
    ],
    "min_items": 1,
    "pass_threshold": 70,
    "timeout_seconds": 180,
    "max_attempts": 5
  },
  "reward": {
    "XP": 150,
    "coins": 200,
    "item": "compass",
    "voucher_tier": "bronze"
  },
  "physics_gravity": "2D_Topdown"
}
```

### 5.3. JSON Schema Chi tiết Màn chơi Mẫu (Sample Stage Spec)
```json
{
  "stage_id": "forest_01_grocery",
  "map_id": "forest_survival",
  "title": "Mua đồ chuẩn bị sinh tồn",
  "target_cefr": "A2",
  "max_voice_time_sec": 12,
  "npc": {
    "name": "Uncle Bob",
    "role": "Grocery Store Owner",
    "avatar_url": "assets/npcs/bob.png",
    "voice_id": "en-US-Bob-Warm",
    "system_prompt": "You are Uncle Bob, a friendly grocery store owner in a small rural town. The player wants to buy supplies for solo camping. Be conversational, require polite requests."
  },
  "quest_goals": [
    {
      "id": "buy_matches",
      "description": "Mua ít nhất 1 hộp diêm hoặc bật lửa",
      "required_keywords": ["matches", "lighter", "fire"]
    },
    {
      "id": "buy_water",
      "description": "Mua ít nhất 2 chai nước",
      "required_keywords": ["water", "bottles"]
    }
  ],
  "pass_score": 70
}
```

---

# 6. MÔ HÌNH KINH TẾ (GAME ECONOMY, TOKENOMICS & O2O VOUCHERS)

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        DUAL-CURRENCY TOKENOMICS                        │
├───────────────────────────────────┬────────────────────────────────────┤
│ ⚡ XU NĂNG LƯỢNG (Action Points)   │ ⭐ ĐIỂM THÀNH TỰU (V-Points)        │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Tiêu hao: 10 Xu / 1 câu thoại AI│ • Nhận khi vượt màn điểm cao (>=80)│
│ • Free Tier: Nạp sẵn 100 Xu/ngày  │ • Thưởng khi duy trì chuỗi Streak  │
│ • VIP Tier: Cấp 400 Xu/ngày       │ • Đổi Voucher Fahasa / Phương Nam  │
│ • Mua thêm: IAP nạp Xu tức thì    │ • Đổi trang phục / Skin nhân vật   │
└───────────────────────────────────┴────────────────────────────────────┘
```

### 6.1. Chi tiết Phân loại Tiền tệ
* **Xu Năng Lượng (Energy Currency):**
  * **Cơ chế tiêu thụ:** Tiêu hao `10 Xu / 1 câu thoại AI`.
  * **Free User:** Cấp `100 Xu / ngày` (tương đương ~10 turns AI).
  * **VIP User:** Cấp `400 Xu / ngày` (tương đương ~40 turns AI).
* **Điểm Thành Tựu (V-Points):**
  * Thưởng khi vượt ải đạt điểm cao ($\ge 80/100$) và giữ Streak đăng nhập.
  * Dùng đổi Voucher quà tặng sách thật tại chuỗi nhà sách đối tác (Fahasa / Phương Nam) hoặc vật phẩm thời trang trong game.

---

# 7. PHÂN TÍCH CHI PHÍ AI, COGS, UNIT ECONOMICS & BỘ PHÒNG VỆ CHI PHÍ

### 7.1. Bóc tách Chi phí 1 Turn đối thoại

| Thành phần | Công nghệ | Thời lượng / Kích thước | Chi phí (USD) |
| :--- | :--- | :--- | :--- |
| **STT** | Deepgram Nova-2 | 5s audio | $0.000360 |
| **LLM** | Gemini 2.0 Flash | 800 tokens in / 80 tokens out | $0.000112 |
| **TTS** | Kokoro / Azure | 30 ký tự | $0.000030 |
| **TỔNG CỘNG / 1 TURN** | | | **~ $0.000502 USD (~ 13 VNĐ)** |

* **Chi phí cho 1 Màn chơi (trung bình 6 turns):** $\approx 78\text{ VNĐ}$.

### 7.2. Monthly Unit Economics (VIP Pass 99.000 VNĐ / tháng)

```text
┌────────────────────────────────────────────────────────────────────────────────┐
│  REVENUE (DOANH THU): 99.000 VNĐ ($3.90)                                       │
├────────────────────────────────────────────────────────────────────────────────┤
│  - Phí App Store / Google Play (15%):           14.850 VNĐ ($0.58)             │
│  - AI COGS (60 màn/tháng ~ 360 turns):           4.680 VNĐ ($0.18)             │
│  - Hạ tầng Server & CDN (Postgres/Redis):        2.500 VNĐ ($0.10)             │
│  - Quỹ dự phòng Voucher đổi quà sách (10%):     10.000 VNĐ ($0.39)             │
├────────────────────────────────────────────────────────────────────────────────┤
│  GROSS PROFIT (LỢI NHUẬN GỘP):                  66.970 VNĐ ($2.65)             │
│  GROSS MARGIN:                                  ~ 67.6%                        │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

### 7.3. Bộ Phòng Vệ Chi Phí (Cost Safeguards & Risk Defense)

#### 7.3.1. Kịch bản 1: User học quá nhiều (Bingeing / Power Users)
Trong ngành Game (như Genshin Impact, Candy Crush) và EdTech (Duolingo), không bao giờ có khái niệm "gọi tài nguyên máy chủ vô hạn". Vitaminfun áp dụng 3 lớp rào chắn:

```text
[ User Chơi Game ]
       │
       ▼
[ Tiêu hao XU NĂNG LƯỢNG ] (10 Xu / 1 câu thoại AI)
       │
   ┌───┴───────────────────────────────────────────────┐
   │                                                   │
[ HẾT XU ]                                       [ CÒN XU ]
   │                                                   │
   ├──► 1. Chơi Màn "Non-AI Gameplay" (Chi phí = 0đ)   └──► Tiếp tục gọi AI
   │       (Reading, Mini-game giải đố, Listening)
   │
   ├──► 2. Mua thêm Gói Xu / Bình Năng Lượng (IAP) ────► (TĂNG DOANH THU ĐỘT BIẾN)
   │
   └──► 3. Nghỉ ngơi chờ hồi Xu ngày mai ──────────────► (Tối ưu Spaced Repetition)
```

1. **Luật Game — Cơ chế "Bình Năng Lượng" (Energy/Stamina System):**
   * Mỗi gói thuê bao (kể cả VIP 99k/tháng) cấp hạn mức Xu Năng Lượng mỗi ngày thay vì cho phép gọi AI không giới hạn.
   * **Về mặt sư phạm (Pedagogy):** Giới hạn thời gian học 45 phút/ngày là chuẩn vàng của phương pháp *Spaced Repetition* (Lặp lại ngắt quãng), giúp não bộ tiếp thu tốt và không bị bão hòa.
2. **Biến "Kẻ cày game" thành "Cá voi doanh thu" (IAP Upsell):**
   * Nếu học viên muốn chơi tiếp các màn AI sau khi hết hạn mức ngày, họ có thể mua thêm gói Xu qua In-App Purchase:
     * **Gói 500 Xu:** 29.000 VNĐ (~50 turns đối thoại).
     * **Gói 2.000 Xu:** 99.000 VNĐ (~200 turns đối thoại).
   * **Bài toán kinh tế IAP:**
     * Chi phí AI cho 500 Xu (50 turns): $\approx 650\text{ VNĐ}$ ($0.025 USD).
     * Doanh thu thu về: $29.000\text{ VNĐ}$.
     * **Gross Margin lượt chơi thêm:** $> 85\%$ (sau khi trừ phí App Store 15%).
3. **Cơ chế Non-AI Gameplay (Màn chơi chi phí 0đ):**
   * Khi hết Xu thoại AI, game mở các màn chơi tĩnh không tốn API:
     * **Reading & Logic Quest:** Đọc manh mối bản đồ, ghép chữ, giải mật mã rương kho báu (chạy 100% logic trên Client, chi phí API = 0đ).
     * **Listening Quest (Pre-recorded):** Nghe đoạn audio tĩnh có sẵn từ CDN để làm trắc nghiệm (chi phí API = 0đ).

---

#### 7.3.2. Kịch bản 2: User nói quá dài / Nói lan man / Spam Mic
Nếu học viên bấm mic nói một tràng 45 giây hoặc để mic thu tạp âm, chi phí STT và Input Token sẽ tăng vọt. Hệ thống khống chế bằng Game Lore kết hợp Technical Guardrails:

```text
                                  [ USER BẤM MIC NÓI ]
                                           │
          ┌────────────────────────────────┴────────────────────────────────┐
          ▼                                                                 ▼
[ 1. NARRATIVE / GAME LORE ]                                     [ 2. TECHNICAL GUARDRAILS ]
"Bộ đàm sắp hết pin / Quái vật đến gần!"                         - Max Record Time: 12 giây
-> Đồng hồ đếm ngược 12s trên màn hình                          - Client VAD ngắt khi im lặng 1.5s
                                                                 - Max STT Input: Cắt cứng ở 40 từ
```

* **Max Record Time:** Client tự động cắt cứng Audio ở giây thứ 12.
* **Smart Client VAD:** Tự động hủy gửi packet nếu im lặng $\ge 1.5\text{s}$.
* **STT Token Truncation:** Giới hạn dữ liệu đầu vào LLM tối đa 40 từ.
* **Scoring Rubric:** Phạt điểm nặng nếu học viên nói dài dòng hoặc lạc đề.

---

#### 7.3.3. Stress-Test Kịch bản Tồi tệ Nhất (Worst-Case Scenario)
Mô phỏng trường hợp **Super Power User** (ngày nào cũng chơi tối đa hạn mức VIP 40 turns và luôn nói chạm trần 12 giây):

```text
┌────────────────────────────────────────────────────────────────────────┐
│             STRESS-TEST CHO 1 SUPER POWER USER (THÁNG 30 NGÀY)         │
├───────────────────────────────────┬────────────────────────────────────┤
│ THÔNG SỐ VẬN HÀNH                 │ GIÁ TRỊ GIẢ ĐỊNH                   │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Thời gian chơi mỗi ngày:        │ 60 phút / ngày (Mức tối đa VIP)    │
│ • Số lượt đối thoại AI (Turns):   │ 40 turns / ngày = 1.200 turns/tháng│
│ • Độ dài mỗi câu nói:             │ Luôn chạm trần 12 giây (cực dài)   │
│ • Chi phí STT (Deepgram):         │ 1.200 × (12/60) × $0.0043 = $1.03  │
│ • Chi phí LLM (Gemini 2.0 Flash): │ 1.200 × (1.000 tok in/out) = $0.20 │
│ • Chi phí TTS (Kokoro/Azure):     │ 1.200 × 50 chars = $0.06           │
├───────────────────────────────────┼────────────────────────────────────┤
│ TỔNG CHI PHÍ AI THỰC TẾ (COGS)    │ $1.29 USD / tháng (~ 32.800 VNĐ)   │
│ DOANH THU THU VỀ TỪ USER NÀY      │ 99.000 VNĐ / tháng                 │
├───────────────────────────────────┼────────────────────────────────────┤
│ LỢI NHUẬN GỘP (GROSS PROFIT)      │ 66.200 VNĐ (Biên lợi nhuận 66.8%)  │
└───────────────────────────────────┴────────────────────────────────────┘
```

---

#### 7.3.4. Ma trận Tổng kết Bảo vệ Chi phí

| Nguy cơ | Giải pháp Game hóa | Giải pháp Công nghệ | Kết quả tài chính |
| :--- | :--- | :--- | :--- |
| **User học quá nhiều** | Hệ thống Xu Năng Lượng / Daily Energy Cap | Giới hạn lượt gọi AI theo Tier ví; mở game Non-AI khi hết Xu | Không bị âm vốn; bán thêm IAP với biên lợi nhuận $> 85\%$. |
| **User nói quá dài** | Cốt truyện ép thời gian (Bộ đàm hết pin, tình huống nguy cấp) | Client cắt cứng audio tại giây thứ 12; VAD hủy request rác | Chi phí STT và LLM Input luôn bị chặn trần cố định. |

> **Kết luận Bảo đảm Tài chính:** Dù người dùng có hành vi sử dụng cực đoan đến đâu, hệ thống vẫn duy trì **Gross Margin $\ge 65\%$**.

---

# 8. NỀN TẢNG UGC & CREATOR MARKETPLACE (VIBE CODING PLATFORM)

* **Creator Studio:** Cung cấp công cụ thiết kế Map/Stage nhanh thông qua giao thức Prompt-to-Quest hoặc Visual Node Graph.
* **Automated AI Sandbox:** Sử dụng Bot AI tự động đóng vai người chơi ở các trình độ A1 & C1 để kiểm tra độ cân bằng (balance), độ khó và logic của màn chơi trước khi phát hành.
* **Safety & Moderation:** Quét và lọc nội dung độc hại, vi phạm thuần phong mỹ tục thông qua Llama Guard.
* **Revenue Share:** Cơ chế phân chia doanh thu: **70% cho Creator** và **30% cho nền tảng Vitaminfun**.

---

# 9. LỘ TRÌNH TRIỂN KHAI (ROADMAP) & TIÊU CHUẨN ĐO LƯỜNG (KPIS)

```text
[ Phase 1: MVP & Voice Engine ] ──► [ Phase 2: Retention & Economy ] ──► [ Phase 3: UGC & Multi-language ]
         (Tháng 1 - 2)                       (Tháng 3 - 4)                         (Tháng 5 - 6)
```

### 9.1. Phase 1 (Tháng 1 – 2): Foundation & Core MVP
* Xây dựng 1 Map mẫu hoàn chỉnh: "Sinh tồn trong rừng" (Forest Survival).
* Hoàn thiện Voice Pipeline với độ trễ (latency) $\le 1.2\text{s}$.
* Thử nghiệm khép kín (Closed Beta) với 100 học viên đầu tiên.

### 9.2. Phase 2 (Tháng 3 – 4): Economy & O2O Voucher Expansion
* Tích hợp toàn diện Game Economy: Hệ thống Ví Xu, Điểm V-Points.
* Triển khai cổng đổi Voucher quà tặng sách thật tại đối tác Fahasa / Phương Nam.
* Phát hành thêm 3 Map chủ đề mới.

### 9.3. Phase 3 (Tháng 5 – 6): UGC Platform & Multi-language Scaling
* Ra mắt Creator Studio cho cộng đồng Vibe Coders và giáo viên.
* Triển khai Creator Marketplace với mô hình chia sẻ doanh thu 70/30.
* Mở rộng thêm hệ thống màn chơi Tiếng Trung (chuẩn HSK).
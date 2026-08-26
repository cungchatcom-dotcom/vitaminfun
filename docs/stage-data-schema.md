# Chuẩn cấu trúc Data JSON: World → Chapter → Stage → Task

Mục tiêu: chuẩn hóa data theo đúng 4 tầng phân cấp mà tài liệu thiết kế mô tả (`docs/LOST IN ATLANTIS_...md`, mục World/Rules), để 1 bộ schema áp dụng được cho **mọi World** (World 1 Lost in Atlantis đang triển khai, World 2 MAYA / World 3 Xuyên Việt sau này), không chỉ riêng 30 màn hiện tại.

```
World (world_01.json)                — "Lost in Atlantis" — layer to nhất, gói toàn bộ game 1 chủ đề
 └─ Chapter (embedded trong World)    — 5 chương, mỗi chương 1 khoảng stage liên tiếp
     └─ Stage (stage_XX.json)        — 1 màn chơi, 30 màn / world
         └─ Task (embedded trong Stage) — tối thiểu 4 nhiệm vụ / màn
```

Quy tắc từ tài liệu thiết kế cần schema phản ánh đúng:
- 1 World gồm nhiều Chapter; hoàn thành hết Chapter mới hoàn thành World.
- 1 Chapter gồm nhiều Stage liên tiếp (World 1: 5 chapter × 6 stage = 30 stage).
- Hoàn thành đủ N mảnh vật phẩm chính (Mảnh bản đồ, N = tổng số Stage) mới mở được **Cổng cuối World** (Cánh cổng Thời gian).
- World có thuộc tính riêng: ngôn ngữ học, kỹ năng học, độ khó, lứa tuổi phù hợp, giá bán — đây là field ở tầng World, không lặp lại ở từng Stage.

---

## 0. Vị trí file & convention

| Tầng | File | Ghi chú |
|---|---|---|
| World | `public/data/worlds/world_01.json` | 1 file / world |
| Chapter | *(không có file riêng)* | Embedded trong `world_XX.json.chapters[]` — chapter là metadata nhẹ, không cần tách file |
| Stage | `public/data/stages/stage_01.json` … `stage_30.json` | 1 file / màn, giữ nguyên convention hiện tại |
| Task | *(không có file riêng)* | Embedded trong `stage_XX.json.tasks[]` |

> Ghi chú tương thích ngược: field in đậm là **field mới**, cần bổ sung logic đọc ở `GameState.js` / `StageScene.js` / `main.js`. Field còn lại đã được engine đọc trực tiếp — giữ nguyên tên để không phải sửa code hiện có.

---

## 1. World — layer bao trùm toàn bộ (file mới)

```json
{
  "id": "world_01",
  "code": "lost_in_atlantis",
  "name": "Lost in Atlantis: Lạc vào vương quốc huyền thoại",
  "status": "active",
  "order": 1,

  "story": "Một nhóm bạn vô tình lạc vào thế giới huyền thoại Atlantis. Vượt qua các thử thách để sưu tầm 30 Mảnh bản đồ, khi ghép lại cánh cổng thời gian sẽ hiện ra để trở về nhà.",

  "attributes": {
    "language": "Tiếng Anh",
    "skills": ["Nghe", "Nói", "Đọc", "Viết"],
    "ageRange": "16-25",
    "price": 0,
    "difficultyLevels": {
      "Easy": "be/have got; present simple/continuous; can/must; imperatives; there is/are; past simple; going to; comparatives; question forms",
      "Medium": "question forms; narrative tenses; modals of deduction; reported speech; passive; conditionals; relative clauses; comparison; linking and persuasion",
      "Hard": "hedging; advanced reporting; nominalisation; inversion; clefts; advanced concession; mixed conditionals; cohesion; counterargument"
    }
  },

  "mainCollectible": {
    "id": "map_shard",
    "name": "Mảnh bản đồ",
    "totalRequired": 30
  },

  "endGate": {
    "id": "time_portal",
    "name": "Cánh cổng Thời gian",
    "unlockCondition": "collectAllShards",
    "successMessage": "Kích hoạt mở cổng và được trở về nhà (hoàn thành World).",
    "failMessage": "Hiển thị cảnh báo và liệt kê danh sách các màn chơi / nhiệm vụ còn thiếu."
  },

  "totalChapters": 5,
  "totalStages": 30,

  "chapters": [
    {
      "id": 1,
      "number": "Chương 1",
      "title": "Sự cố dưới đáy biển",
      "subtitle": "Hang động biển sâu & Lối vào Atlantis",
      "description": "Nhóm bạn bị đắm tàu, rơi vào hang động biển sâu và phát hiện ra lối vào Atlantis.",
      "icon": "🌊",
      "stageRange": [1, 6],
      "themeColor": "#00f0ff",
      "bannerImage": "./assets/backgrounds/chapter_1.jpg"
    }
  ],

  "characters": [
    {
      "id": "leo",
      "name": "Leo Harrison",
      "codename": "The Guardian",
      "role": "Đội trưởng — chuyên gia thể lực & cận chiến",
      "personality": "Quyết đoán, dũng cảm nhưng đôi khi hơi bảo thủ.",
      "skillTags": ["Đẩy vật nặng", "Phá rào chắn", "Bảo vệ đồng đội"],
      "portrait": "./assets/portraits/leo.jpg"
    }
  ],

  "theme": {
    "setting": "Thế giới Atlantis, huyền thoại, kì bí, cổ kính",
    "bgm": "./assets/audio/world_01_theme.mp3",
    "colorPalette": ["#00f0ff", "#d4af37", "#071318"]
  }
}
```

| Field | Kiểu | Nguồn hiện tại | Ghi chú |
|---|---|---|---|
| `id` | string | *mới* | Trùng tên file `world_01.json` |
| `code` | string | *mới* | Slug ổn định, dùng làm route/key khi chọn World ở màn hình ngoài cùng |
| `name` | string | tài liệu thiết kế (`### World 1 — ...`) | |
| `status` | `"active"\|"coming_soon"` | tài liệu (World 2, 3 đánh dấu *chưa triển khai*) | Dùng để ẩn/khóa World chưa ra mắt ở màn hình chọn World |
| `order` | number | *mới* | Thứ tự hiển thị danh sách World |
| `story` | string | tài liệu | Cốt truyện tổng của World |
| `attributes.language` | string | tài liệu (mục "Học ngôn ngữ") | |
| `attributes.skills` | string[] | tài liệu (mục "Học kĩ năng") | |
| `attributes.ageRange` | string | tài liệu (mục "Lứa tuổi phù hợp") | |
| `attributes.price` | number | tài liệu (mục "Giá bán") | 0 = miễn phí |
| `attributes.difficultyLevels` | object | tài liệu (mục "Độ khó") | Bảng tra cứu ngữ pháp Easy/Medium/Hard — dùng làm **legend tham chiếu**, còn `stage.grammarHint` là điểm ngữ pháp cụ thể của từng màn |
| `mainCollectible` | object | tài liệu (mục "Assets — Vật phẩm") | Generic hóa "Mảnh bản đồ" để World khác dùng vật phẩm khác (VD World 2 có thể là "Mảnh bích họa") |
| `endGate` | object | tài liệu (mục "End-game Flow") | Generic hóa "Cánh cổng Thời gian" |
| `totalChapters`, `totalStages` | number | suy ra từ `chapters` | Cache sẵn để UI không phải tự đếm |
| `chapters[]` | array | `CHAPTERS_DATA` trong `stages_catalog.js` | Chuyển nguyên vào đây — xem mục 4 (Việc cần làm) |
| `characters[]` | array | tài liệu (mục "Characters") + `GameState.js.heroes` | Nhân vật chơi được, đặc thù riêng theo World |
| `theme` | object | tài liệu (mục "UI") | Optional, phục vụ theming toàn cục (nhạc nền, màu chủ đạo) |

**Stage tham chiếu ngược lên World:** mỗi `stage_XX.json` cần thêm 1 field mới ở tầng metadata:

```json
"worldId": "world_01"
```

để load đúng world context (energy pool, mainCollectible, v.v.) mà không phải suy luận gián tiếp qua `chapterId`.

---

## 2. Chapter — embedded trong `world.chapters[]`

Không tách file riêng vì Chapter chỉ là nhóm hiển thị + khoảng stage, không có logic riêng. Field giữ nguyên như `CHAPTERS_DATA` hiện tại: `id`, `number`, `title`, `subtitle`, `description`, `icon`, `stageRange`, `themeColor`, `bannerImage`.

---

## 3. Stage — `stage_XX.json`

```json
{
  "id": "stage_01",
  "worldId": "world_01",
  "stageNumber": 1,
  "chapterId": 1,
  "chapterName": "Sự cố dưới đáy biển",
  "title": "Cơn bão bất ngờ",
  "story": "Nhóm bạn điều khiển thuyền vượt qua giông bão...",
  "difficulty": "Easy",
  "grammarHint": "Imperatives & Present Simple (Khẩu lệnh & Thì hiện tại đơn)",

  "minCombatPower": 0,
  "rewardCombatPower": 200,
  "timeLimitSeconds": 300,
  "initialEnergy": 10,
  "shardRewardId": 1,

  "scene": { "...": "xem mục 3.1" },
  "advisor": { "...": "xem mục 3.2" },
  "tasks": [ "...xem mục 3.3..." ]
}
```

| Field | Kiểu | Nguồn hiện tại | Ghi chú |
|---|---|---|---|
| `id` | string | `stage_01.json.id` | Trùng tên file, dùng làm key unique |
| **`worldId`** | string | *mới* | Khóa ngược lên World — xem mục 1 |
| `stageNumber` | number | `stages_catalog.js.id` | Số thứ tự 1–30, dùng cho unlock/jump-level |
| `chapterId` | number | `stages_catalog.js.chapterId` | Map với `world.chapters[]` |
| `chapterName` | string | `stage_01.json.chapterName` | Denormalized để hiển thị nhanh, không cần join |
| `title` | string | cả 2 nguồn | |
| `story` | string | cả 2 nguồn | Intro khi vào màn |
| `difficulty` | `"Easy"\|"Medium"\|"Hard"` | `stages_catalog.js.difficulty` | Dùng render badge màu ở Inspector |
| `grammarHint` | string | `stage_01.json.grammarHint` | Trọng tâm ngữ pháp cụ thể của màn (nằm trong phạm vi `world.attributes.difficultyLevels[difficulty]`) |
| `minCombatPower` | number | `stages_catalog.js.minCombatPower` | Ngưỡng mở khóa / nhảy bậc |
| **`rewardCombatPower`** | number | *mới* | Hiện hard-code `+200` trong `GameState.handleStageVictory()` |
| `timeLimitSeconds` | number | `stage_01.json` | |
| `initialEnergy` | number | `stage_01.json` (đang hard-code `10` trong `GameState.loadStage`) | Năng lượng mỗi thành viên; tổng team = `initialEnergy * 4` |
| `shardRewardId` | number | `stages_catalog.js` | = `stageNumber`, mảnh vật phẩm chính (`world.mainCollectible`) nhận khi hoàn thành màn |

### 3.1 `scene` — Dữ liệu render Phaser (field mới, thay cho hard-code trong `StageScene.js`)

```json
"scene": {
  "background": "./assets/backgrounds/stage_01_ship_deck.jpg",
  "walkableArea": [
    { "x": -820, "y": 390 },
    { "x": -580, "y": 530 }
  ],
  "player": { "spawn": { "x": -100, "y": 120 } },
  "advisorSpawn": { "x": 520, "y": -380 },
  "teammates": [
    { "id": "maya", "name": "Maya (Khảo cổ)", "icon": "📜", "color": "#9b51e0", "x": -280, "y": 60 },
    { "id": "sam",  "name": "Sam (Kỹ sư)",   "icon": "🔧", "color": "#ff7b00", "x": 120,  "y": 160 },
    { "id": "jade", "name": "Jade (Tiên phong)", "icon": "🗡️", "color": "#27ae60", "x": -20, "y": -140 }
  ],
  "questObjects": [
    {
      "taskId": 1,
      "name": "Cột Buồm Chính",
      "icon": "⛵",
      "color": "#d4af37",
      "x": 260, "y": -200,
      "role": "Khu vực điều khiển tời buồm đón bão",
      "portrait": "./assets/portraits/leo.jpg"
    }
  ]
}
```

- Toạ độ `x`/`y` là offset tương đối so với tâm world map (`worldWidth/2`, `worldHeight/2`), khớp cách tính hiện tại trong `createInteractiveObjects()`.
- `questObjects[].taskId` liên kết 1-1 với `tasks[].id` — bấm vào object nào thì mở đúng task đó (thay cho việc `StageScene.js` tự gán `taskId` cứng trong code).
- `walkableArea` optional — nếu thiếu, scene fallback full-map thay vì bắt buộc polygon 9 điểm như hiện tại.
- `teammates[].id` nên khớp `world.characters[].id` để lấy portrait/personality gốc thay vì lặp dữ liệu.

### 3.2 `advisor` — NPC cố vấn chính (giữ nguyên schema `stage_01.json`, bổ sung 1 field)

```json
"advisor": {
  "id": "captain",
  "name": "Captain Drake (Thuyền trưởng)",
  "role": "NPC Cố vấn trưởng Màn 1",
  "portrait": "./assets/portraits/captain.jpg",
  "dialogueSteps": [
    {
      "step": 1,
      "title": "1. Chào hỏi & Giới thiệu bản thân (Greeting & Intro)",
      "npcPrompt": "Ahoy! The tempest is raging! Who are you and what is your role in this expedition?",
      "vietnameseTranslation": "Chào nhóc tỳ! Ngươi là ai và đến con tàu này để làm gì trong bão?",
      "options": [
        { "key": "A", "text": "Hello Captain Drake! I am Leo, the Guardian leader of this expedition.", "isCorrect": true },
        { "key": "B", "text": "I am just a passenger looking for snacks.", "isCorrect": false }
      ],
      "targetKeywords": ["i am leo", "guardian leader", "hello captain"]
    }
  ],
  "cluebook": {
    "title": "📜 SỔ TAY BÍ QUYẾT CỦA THUYỀN TRƯỞNG DRAKE",
    "summary": "1. Cột buồm: Hô to 'Lower the sails immediately!' | ..."
  }
}
```

- **`dialogueSteps[].vietnameseTranslation`**: field mới. Hiện `stage_01.json` không có field này nên `GameState.js` phải fallback bằng 1 câu dịch hard-code chung cho mọi step (`selectAdvisorTarget()` dòng ~199) — sai nghĩa nếu áp dụng cho các step khác. Thêm field này để nút "Dịch (-5⚡)" luôn dịch đúng câu đang hỏi.
- 2 giai đoạn Chào hỏi / Trình bày mục đích theo đúng Rule trong tài liệu thiết kế → tối thiểu 2 `dialogueSteps`, có thể nhiều hơn nếu màn khó hơn.

### 3.3 `tasks` — Danh sách nhiệm vụ (tối thiểu 4/màn theo Rule)

```json
"tasks": [
  {
    "id": 1,
    "title": "Hạ buồm đón gió",
    "skill": "Nghe & Nói (Listen & Speak)",
    "npc": "Cột Buồm Chính",
    "npcDialogue": "Gió bão đang giật đứt dây kéo buồm! Cần khẩu lệnh chuẩn tiếng Anh để hạ buồm!",
    "vietnameseHint": "Hãy chọn đáp án đúng để hạ buồm an toàn.",
    "targetPhrase": "Lower the sails immediately",
    "targetKeywords": ["lower the sails", "lower sails", "lower the sails immediately"],
    "options": [
      { "key": "A", "text": "Lower the sails immediately!", "isCorrect": true },
      { "key": "B", "text": "Raise all sails to the top!", "isCorrect": false },
      { "key": "C", "text": "Cut the anchor rope!", "isCorrect": false }
    ],
    "hint": "Bí quyết Thuyền trưởng: Lower the sails immediately!",
    "energyPenalty": 2,
    "rewardSkillPts": 50,
    "reward": null,
    "completed": false
  }
]
```

| Field | Bắt buộc | Ghi chú |
|---|---|---|
| `id` | ✔ | Số thứ tự task trong màn (1..n), khớp `scene.questObjects[].taskId` |
| `title` | ✔ | Tên ngắn hiển thị ở Roadmap/Task list (hiện `stages_catalog.js` gọi là vậy, `stage_01.json` không có — hợp nhất lại) |
| `skill` | ✔ | Nhãn kỹ năng hiển thị, giữ dạng chuỗi như hiện tại (`"Nghe & Nói (Listen & Speak)"`) để không phải sửa UI |
| `npc` | ✔ | Tên hiển thị người gửi trong khung chat khi tương tác object này |
| `npcDialogue` | ✔ | Câu thách đố NPC đưa ra |
| **`vietnameseHint`** | khuyến nghị | Field mới — bản dịch câu `npcDialogue`, hiện fallback chung chung trong `GameState.setQuestTarget()` |
| `targetPhrase` | ✔ | Câu đáp án chuẩn tiếng Anh (hiển thị tham khảo) |
| `targetKeywords` | ✔ | Mảng từ khóa dùng match input Voice/Text (không phân biệt hoa thường, so khớp "chứa") |
| `options` | ✔ | Trắc nghiệm A/B/C, đúng 1 `isCorrect: true` |
| `hint` | ✔ | Gợi ý hiện khi trả lời sai (trừ năng lượng) |
| **`energyPenalty`** | khuyến nghị | Field mới, mặc định `2` — hiện hard-code `consumeMyEnergy(2)` trong `GameState.js` |
| **`rewardSkillPts`** | khuyến nghị | Field mới, mặc định `50` — hiện hard-code `this.skillPts += 50` |
| `reward` | ✔ (null trừ task cuối) | Chỉ task cuối cùng của màn có giá trị, dạng `"map_shard_XX"`, khớp `world.mainCollectible.id` + `shardRewardId` |
| `completed` | ✔ | **Luôn để `false`** trong file gốc — đây là runtime state, engine ghi đè khi chơi, không phải trạng thái lưu trữ vĩnh viễn |

---

## 4. Việc cần làm nếu áp dụng schema này

1. **World**: Tạo `public/data/worlds/world_01.json` — chuyển `CHAPTERS_DATA` từ `stages_catalog.js` vào `world.chapters[]`, chuyển `heroes` từ `GameState.js` vào `world.characters[]`.
2. **Stage data**: Sinh 30 file `stage_02.json` … `stage_30.json` theo schema mục 3, nội dung nhiệm vụ lấy từ `docs/LOST IN ATLANTIS_...md` (đã có sẵn desc + skill cho từng task, chỉ thiếu `options`/`targetKeywords`/`hint`/toạ độ scene — cần soạn thêm). Mỗi file thêm `worldId: "world_01"`.
3. **Engine**: Sửa `GameState.js`:
   - Load `world_01.json` trước, dùng `world.mainCollectible`/`world.endGate` thay vì hard-code "Mảnh bản đồ" / "Cánh cổng Thời gian" rải rác trong code.
   - Đọc `rewardCombatPower`, `initialEnergy`, `energyPenalty`, `rewardSkillPts` từ Stage data thay vì hard-code.
   - Đọc `dialogueSteps[].vietnameseTranslation` và `tasks[].vietnameseHint` thay vì fallback cứng.
4. **Scene**: Sửa `StageScene.js` để dựng `advisorSpawn`, `teammates`, `questObjects`, `walkableArea` từ `stage.scene` thay vì hard-code riêng cho Màn 1.
5. **Catalog**: `stages_catalog.js` (`STAGES_CATALOG`, `CHAPTERS_DATA`) có thể **generate tự động** từ `world_01.json` + 30 file stage lúc build/runtime thay vì duy trì song song nhiều nguồn dữ liệu dễ lệch nhau.
6. **Nhiều World**: Khi triển khai World 2/3, chỉ cần thêm `world_02.json`, `world_03.json` (status `"coming_soon"` cho tới khi triển khai) + thư mục `stages/` riêng — không cần sửa schema.

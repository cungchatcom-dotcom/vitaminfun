# Chuẩn cấu trúc dữ liệu JSON (Data Schema): World → Chapter → Stage → Task

Tài liệu này định nghĩa chuẩn cấu trúc dữ liệu JSON cho toàn bộ dự án **VitaminFun**, được thiết kế tổng quát hóa để áp dụng đồng nhất cho **mọi Thế giới (World)**, mọi Chương (Chapter), Màn chơi (Stage) và Nhiệm vụ (Task).

Tài liệu được xây dựng dựa trên nguyên tắc thiết kế từ [`PROJECT OVERVIEW.md`](file:///c:/vitaminfun/docs/PROJECT%20OVERVIEW.md) và kịch bản mẫu [`LOST IN ATLANTIS_Lạc vào vương quốc huyền thoại.md`](file:///c:/vitaminfun/docs/LOST%20IN%20ATLANTIS_L%E1%BA%A1c%20v%C3%A0o%20v%C6%B0%C6%A1ng%20qu%E1%BB%91c%20huy%E1%BB%81n%20tho%E1%BA%A1i.md).

---

## 1. Cấu trúc phân cấp tổng thể (Hierarchical Architecture)

```
World (world_XX.json)
 ├── Cấu hình chung, cốt truyện, thuộc tính học tập (Ngôn ngữ / Kỹ năng)
 ├── Hệ thống điểm & Tùy biến kinh nghiệm (Exp / Energy)
 ├── Vật phẩm chính & Điều kiện kết thúc (Main Collectible & End Gate)
 ├── Danh sách nhân vật chơi được (Playable Characters / Roles)
 └── Chapters[] (Danh sách chương)
      └── Stage (stage_YY.json)
           ├── Metadata màn chơi (Độ khó, Ngữ pháp/Kỹ năng, Giới hạn thời gian, Năng lượng)
           ├── Scene (Dữ liệu render map, tọa độ spawn, NPC, đồng đội, vật thể tương tác)
           ├── Advisor (NPC Cố vấn — Giai đoạn 1: Chào hỏi, phỏng vấn, trao Cluebook/Mật khẩu)
           └── Tasks[] (Danh sách nhiệm vụ — Giai đoạn 2: Tối thiểu 4 nhiệm vụ / màn)
                ├── Hình thức tương tác (Nghe, Nói, Đọc, Viết, Trắc nghiệm)
                ├── Target Phrase / Keywords / Options
                └── Thưởng điểm, hình phạt năng lượng, vật phẩm mảnh thu được
```

---

## 2. Quy ước đường dẫn & lưu trữ file (Directory & File Conventions)

```
public/data/
 ├── worlds/
 │    ├── world_01.json           # World 1: Lost in Atlantis
 │    ├── world_02.json           # World 2: MAYA (khi triển khai)
 │    └── world_03.json           # World 3: Xuyên Việt (khi triển khai)
 └── stages/
      ├── world_01/               # (Khuyến nghị phân thư mục theo World)
      │    ├── stage_01.json
      │    ├── stage_02.json
      │    └── ...
      └── world_02/
           └── ...
```

> **Nguyên tắc phân tầng dữ liệu:**
> - `World` tách thành file riêng: chứa thiết lập vĩ mô, danh mục Chapter và các Character của World đó.
> - `Chapter` là metadata nhẹ: được nhúng trực tiếp trong mảng `chapters[]` của file World.
> - `Stage` tách thành từng file JSON riêng: chứa toàn bộ kịch bản, tọa độ render màn chơi và danh sách nhiệm vụ.
> - `Task` được nhúng trực tiếp trong mảng `tasks[]` của từng file Stage.

---

## 3. Tầng 1: World Schema (`world_XX.json`)

File cấu hình cấp cao nhất, đại diện cho một chủ đề hoặc một khóa học Play-to-Learn hoàn chỉnh.

### 3.1. Cấu trúc JSON mẫu (`world_01.json`)

```json
{
  "id": "world_01",
  "code": "lost_in_atlantis",
  "name": "Lost in Atlantis: Lạc vào vương quốc huyền thoại",
  "status": "active",
  "order": 1,
  "unlockPrice": {
    "currency": "Xu",
    "amount": 0
  },

  "learning": {
    "type": "language",
    "targetLanguage": "English",
    "systemLanguage": "vi",
    "skills": ["Nghe", "Nói", "Đọc", "Viết"],
    "targetAge": "16-25",
    "difficultyLevels": {
      "Easy": "be/have got; present simple/continuous; can/must; imperatives; there is/are; past simple; going to; comparatives; question forms",
      "Medium": "question forms; narrative tenses; modals of deduction; reported speech; passive; conditionals; relative clauses; comparison; linking and persuasion",
      "Hard": "hedging; advanced reporting; nominalisation; inversion; clefts; advanced concession; mixed conditionals; cohesion; counterargument"
    }
  },

  "story": "Một nhóm bạn vô tình lạc vào thế giới huyền thoại Atlantis. Vượt qua các thử thách để sưu tầm 30 Mảnh bản đồ, khi ghép lại cánh cổng thời gian sẽ hiện ra để trở về nhà.",

  "pointSystem": {
    "expPoint": {
      "id": "combat_power",
      "name": "Điểm chiến lực",
      "icon": "⚡",
      "description": "Điểm kinh nghiệm tích lũy cá nhân, dùng để mở khóa màn chơi và nhảy bậc."
    },
    "energyPoint": {
      "id": "energy",
      "name": "Điểm năng lượng",
      "icon": "🔋",
      "description": "Điểm hỗ trợ cá nhân cấp mỗi màn, dùng cho các hành động dịch, nghe lại, xem gợi ý."
    },
    "expFormulaConstants": {
      "taskBaseScore": 50,
      "maxTimeBonus": 50,
      "maxEnergyBonus": 50,
      "difficultyMultipliers": {
        "Easy": 1.0,
        "Medium": 2.0,
        "Hard": 3.0
      }
    }
  },

  "mainCollectible": {
    "id": "map_shard",
    "name": "Mảnh bản đồ",
    "totalRequired": 30,
    "description": "Thu thập đủ 30 mảnh bản đồ khác nhau qua 30 màn chơi để ghép thành Bản đồ Atlantis hoàn chỉnh."
  },

  "endGate": {
    "id": "time_portal",
    "name": "Cánh cổng Thời gian",
    "unlockCondition": "collectAllShards",
    "successMessage": "Kích hoạt mở cổng thành công! Cả nhóm an toàn trở về thế giới hiện đại.",
    "failMessage": "Chưa đủ 30 mảnh bản đồ! Cổng thời gian đang bị phong ấn. Hãy hoàn thành các màn chơi còn thiếu."
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
      "portrait": "./assets/portraits/leo.jpg",
      "spriteKey": "char_leo"
    },
    {
      "id": "maya",
      "name": "Maya Sterling",
      "codename": "The Scholar",
      "role": "Nhà thông thái khảo cổ — giải đố & ngôn ngữ cổ",
      "personality": "Điềm tĩnh, tò mò và cực kỳ chi tiết.",
      "skillTags": ["Giải mã ký tự", "Phát hiện bẫy ngầm", "Mở lối đi bí mật"],
      "portrait": "./assets/portraits/maya.jpg",
      "spriteKey": "char_maya"
    },
    {
      "id": "sam",
      "name": "Sam Miller",
      "codename": "The Fixer",
      "role": "Thiên tài công nghệ — kỹ sư hệ thống & cơ khí",
      "personality": "Lém lỉnh, hay cằn nhằn nhưng rất trung thành.",
      "skillTags": ["Sửa chữa máy móc", "Hack năng lượng", "Chế tạo thiết bị"],
      "portrait": "./assets/portraits/sam.jpg",
      "spriteKey": "char_sam"
    },
    {
      "id": "jade",
      "name": "Jade Nguyen",
      "codename": "The Wraith",
      "role": "Tiên phong — chuyên gia di chuyển & thám thính",
      "personality": "Lạc quan, ưa mạo hiểm, bản năng sinh tồn cực mạnh.",
      "skillTags": ["Leo trèo Parkour", "Nhảy vực thẳm", "Nín thở lặn sâu"],
      "portrait": "./assets/portraits/jade.jpg",
      "spriteKey": "char_jade"
    }
  ],

  "theme": {
    "setting": "Thế giới Atlantis, huyền thoại, kì bí, cổ kính",
    "bgm": "./assets/audio/world_01_theme.mp3",
    "colorPalette": ["#00f0ff", "#d4af37", "#071318"]
  }
}
```

### 3.2. Bảng giải thích trường dữ liệu World

| Trường (Field) | Kiểu dữ liệu | Mô tả & Quy tắc vận hành |
|---|---|---|
| `id` | `string` | ID định danh duy nhất của World (vd: `world_01`). |
| `code` | `string` | Slug định danh (vd: `lost_in_atlantis`, `maya_civilization`). |
| `status` | `string` | Trạng thái: `"active"` (đang mở) hoặc `"coming_soon"` (sắp ra mắt). |
| `unlockPrice` | `object` | Chi phí Xu để mở khóa World (`amount: 0` = miễn phí). |
| `learning.type` | `string` | Loại kiến thức: `"language"` (Học ngoại ngữ) hoặc `"knowledge_skills"` (Kỹ năng sống, Nấu ăn, Âm nhạc,...). |
| `learning.targetLanguage` | `string` | Ngôn ngữ học trong trò chơi (vd: `English`, `Chinese`). |
| `learning.systemLanguage` | `string` | Ngôn ngữ giao diện của người chơi (mặc định `vi`). |
| `learning.difficultyLevels` | `object` | Bảng tra cứu phạm vi kiến thức ngữ pháp/kỹ năng theo 3 cấp `Easy`, `Medium`, `Hard`. |
| `pointSystem` | `object` | Cấu hình tên gọi, icon và hằng số tính điểm Exp / Energy cho toàn World. |
| `mainCollectible` | `object` | Định nghĩa Vật phẩm chính của World (số lượng mảnh, tên gọi). |
| `endGate` | `object` | Điều kiện và thông điệp Cổng đích hoàn thành World. |
| `chapters[]` | `array` | Danh sách các Chương thuộc World. |
| `characters[]` | `array` | Danh sách tối đa 4 nhân vật có sẵn để người chơi chọn nhập vai trước khi vào phòng. |

---

## 4. Tầng 2: Chapter Schema (Embedded trong `world.chapters[]`)

Mỗi Chương là một chặng câu chuyện liên kết một dải các Màn chơi liên tiếp.

```json
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
```

---

## 5. Tầng 3: Stage Schema (`stage_XX.json`)

Mỗi file Stage mô tả chi tiết toàn bộ logic, tọa độ không gian 2D, NPC Cố vấn và danh sách nhiệm vụ của 1 màn chơi.

### 5.1. Cấu trúc tổng thể của `stage_XX.json`

```json
{
  "id": "stage_01",
  "worldId": "world_01",
  "stageNumber": 1,
  "chapterId": 1,
  "chapterName": "Sự cố dưới đáy biển",
  "title": "Cơn bão bất ngờ",
  "story": "Nhóm bạn điều khiển thuyền vượt qua giông bão, tàu bị lật và rơi xuống đáy biển.",
  "difficulty": "Easy",
  "grammarHint": "Imperatives & Present Simple (Khẩu lệnh & Thì hiện tại đơn)",

  "minCombatPower": 0,
  "timeLimitSeconds": 300,
  "initialEnergy": 10,
  "shardRewardId": 1,

  "scene": {
    "background": "./assets/backgrounds/stage_01_ship_deck.jpg",
    "mapSize": { "width": 1920, "height": 1080 },
    "walkableArea": [
      { "x": -820, "y": 390 },
      { "x": -580, "y": 530 },
      { "x": 760, "y": 510 },
      { "x": 860, "y": 250 },
      { "x": 640, "y": -220 },
      { "x": 480, "y": -480 },
      { "x": -260, "y": -490 },
      { "x": -590, "y": -260 },
      { "x": -830, "y": 60 }
    ],
    "player": {
      "spawn": { "x": -100, "y": 120 }
    },
    "advisorSpawn": {
      "x": 520,
      "y": -380
    },
    "teammates": [
      {
        "id": "maya",
        "name": "Maya (Khảo cổ)",
        "icon": "📜",
        "color": "#9b51e0",
        "x": -280,
        "y": 60
      },
      {
        "id": "sam",
        "name": "Sam (Kỹ sư)",
        "icon": "🔧",
        "color": "#ff7b00",
        "x": 120,
        "y": 160
      },
      {
        "id": "jade",
        "name": "Jade (Tiên phong)",
        "icon": "🗡️",
        "color": "#27ae60",
        "x": -20,
        "y": -140
      }
    ],
    "questObjects": [
      {
        "taskId": 1,
        "name": "Cột Buồm Chính",
        "icon": "⛵",
        "color": "#d4af37",
        "x": 260,
        "y": -200,
        "role": "Khu vực điều khiển tời buồm đón bão",
        "portrait": "./assets/portraits/leo.jpg"
      },
      {
        "taskId": 2,
        "name": "Thân Tàu Bị Nứt",
        "icon": "🪵",
        "color": "#e67e22",
        "x": -450,
        "y": 280,
        "role": "Khu vực gia cố khoang chứa đồ",
        "portrait": "./assets/portraits/sam.jpg"
      },
      {
        "taskId": 3,
        "name": "Đèn Phao Cứu Sinh",
        "icon": "🚨",
        "color": "#e74c3c",
        "x": 480,
        "y": 220,
        "role": "Vị trí định vị tín hiệu khẩn cấp",
        "portrait": "./assets/portraits/jade.jpg"
      },
      {
        "taskId": 4,
        "name": "Hòm Cứu Nạn",
        "icon": "📦",
        "color": "#3498db",
        "x": -300,
        "y": -260,
        "role": "Hòm bí mật chứa Mảnh bản đồ 1",
        "portrait": "./assets/portraits/maya.jpg"
      }
    ]
  },

  "advisor": {
    "id": "captain",
    "name": "Captain Drake (Thuyền trưởng)",
    "role": "NPC Cố vấn trưởng Màn 1",
    "portrait": "./assets/portraits/captain.jpg",
    "voiceAudio": "./assets/audio/voice/stage_01_advisor.mp3",
    "dialogueSteps": [
      {
        "step": 1,
        "question_type": "text",
        "answer_type": "select",
        "title": "Greeting & Intro",
        "question_text": "Ahoy! The tempest is raging! Who are you and what is your role in this expedition?",
        "text_translation": "Chào nhóc tỳ! Giông bão đang nổi lên dữ dội! Ngươi là ai và đảm nhận vai trò gì trong chuyến hải trình này?",
        "audio": "",
        "audio_transcript": "",
        "audio_transcript_translation": "",
        "options": [
          {
            "key": "A",
            "text": "Hello Captain Drake! I am Leo, the Guardian leader of this expedition.",
            "isCorrect": true
          },
          {
            "key": "B",
            "text": "I am just a passenger looking for snacks.",
            "isCorrect": false
          },
          {
            "key": "C",
            "text": "Who are you? Stop shouting at me!",
            "isCorrect": false
          }
        ],
        "wrong_answer_message": "That is incorrect. Please try again to continue the conversation"
      },
      {
        "step": 2,
        "question_type": "text",
        "answer_type": "select",
        "title": "Purpose & Request",
        "question_text": "Welcome aboard, Leo! What brings you to my helm in this deadly storm?",
        "text_translation": "Tốt lắm! Con tàu đang mất lái! Cậu cần ta giúp đỡ điều gì để giữ cho tàu không bị chìm?",
        "audio": "",
        "audio_transcript": "",
        "audio_transcript_translation": "",
        "options": [
          {
            "key": "A",
            "text": "We are trapped in the tempest and need your guidance and secrets to survive!",
            "isCorrect": true
          },
          {
            "key": "B",
            "text": "I want to watch the lightning from up here.",
            "isCorrect": false
          },
          {
            "key": "C",
            "text": "Give me all the treasure right now!",
            "isCorrect": false
          }
        ],
        "wrong_answer_message": "That is incorrect. Please try again to continue the conversation"
      },
      {
        "step": 3,
        "question_type": "text",
        "answer_type": "",
        "question_text": "Now, press onward with your journey and receive this handbook. Use its secrets wisely to navigate the perilous challenges ahead—good luck, travelers!",
        "text_translation": "Giờ thì tiếp tục hành trình đi và nhận lấy cuốn sổ tay này. Hãy dùng những bí quyết trong đó cho khôn ngoan để vượt qua hiểm nguy phía trước — chúc may mắn, các nhà thám hiểm!",
        "item": "cluebook"
      }
    ],
    "cluebook": {
      "title": "📜 CAPTAIN DRAKE'S SECRET HANDBOOK",
      "content": "First, make your way to the Main Mast and shout out loud, Lower the sails immediately! to catch the wind. Next, inspect the Cracked Hull and instruct the mechanic to use a wrench to tighten the loose bolts inside the cargo storage compartment. Once the vessel is secured, check the Lifebuoy Light by locating the radar positioned on the left side (port side). Finally, approach the Ancient Atlantean Treasure Chest and enter the secret passcode of the mythical metal—Orichalcum—to unlock its hidden riches."
    }
  },

  "tasks": [
    {
      "id": 1,
      "title": "Main Mast",
      "skill": "Listen & Speak",
      "questions": [
        {
          "question_type": "text",
          "answer_type": "select",
          "question_text": "The storm winds are snapping the halyards! We need the exact English command to lower the sails!",
          "text_translation": "Hãy hô khẩu lệnh tiếng Anh để hạ buồm lập tức.",
          "hint": "Captain Drake's secret: Lower the sails immediately!",
          "options": [
            {
              "key": "A",
              "text": "Lower the sails immediately!",
              "isCorrect": true
            },
            {
              "key": "B",
              "text": "Raise all sails to the top!",
              "isCorrect": false
            },
            {
              "key": "C",
              "text": "Cut the anchor rope!",
              "isCorrect": false
            }
          ],
          "energy_penalty": 2,
          "score": 10
        },
        {
          "question_type": "text",
          "answer_type": "text",
          "question_text": "Type the command in English to lower the sails right now!",
          "text_translation": "Gõ khẩu lệnh tiếng Anh để hạ buồm ngay lập tức.",
          "hint": "Captain Drake's secret: Lower the sails immediately!",
          "options": [
            "lower the sails immediately",
            "lower the sails",
            "lower sails"
          ],
          "energy_penalty": 2,
          "score": 10
        },
        {
          "question_type": "text",
          "answer_type": "select",
          "question_text": "While the sails come down, the Captain tests your seamanship: which rope raises and lowers a sail?",
          "text_translation": "Dây nào dùng để kéo buồm lên và hạ buồm xuống?",
          "hint": "A halyard is the rope that hauls a sail up and down.",
          "options": [
            {
              "key": "A",
              "text": "The halyard",
              "isCorrect": true
            },
            {
              "key": "B",
              "text": "The anchor",
              "isCorrect": false
            },
            {
              "key": "C",
              "text": "The rudder",
              "isCorrect": false
            }
          ],
          "energy_penalty": 2,
          "score": 10
        }
      ],
      "pass_score": 30
    }
  ]
}
```

---

## 6. Chi tiết các thành phần con trong Stage Schema

### 6.1. Thuộc tính Màn chơi & Giới hạn (Stage Metadata)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `id` | `string` | ✔ | Khóa chính của Stage (vd: `stage_01`). |
| `worldId` | `string` | ✔ | Tham chiếu ngược về World sở tại (`world_01`). |
| `stageNumber` | `number` | ✔ | Số thứ tự màn chơi (1 đến 30). |
| `chapterId` | `number` | ✔ | Thuộc Chương số mấy (1 đến 5). |
| `chapterName` | `string` | ✔ | Tên Chương hiển thị nhanh trên Header. |
| `title` | `string` | ✔ | Tên màn chơi. |
| `story` | `string` | ✔ | Tóm tắt tình huống cốt truyện khi bắt đầu màn. |
| `difficulty` | `string` | ✔ | Độ khó: `"Easy"`, `"Medium"`, hoặc `"Hard"`. |
| `grammarHint` | `string` | ✔ | Điểm kiến thức/ngữ pháp trọng tâm của màn. |
| `minCombatPower` | `number` | ✔ | Điểm kinh nghiệm/chiến lực tối thiểu của cá nhân để mở màn chơi (cơ chế nhảy bậc). |
| `timeLimitSeconds` | `number` | ✔ | **Giới hạn thời gian (giây)**: Điều kiện tiên quyết. Hết giờ mà chưa xong = Thua. |
| `initialEnergy` | `number` | ✔ | Điểm năng lượng cấp cho mỗi cá nhân khi bắt đầu màn (dùng trợ giúp: Dịch, gợi ý...). |
| `shardRewardId` | `number` | ✔ | Số thứ tự Mảnh vật phẩm chính nhận được khi thắng (1..30). |

---

### 6.2. Không gian render Phaser (`scene`)

Toàn bộ tọa độ được tính theo hệ tọa độ phẳng 2D có gốc `(0, 0)` tại tâm bản đồ (`mapSize.width / 2`, `mapSize.height / 2`).

```json
"scene": {
  "background": "./assets/backgrounds/stage_01_ship_deck.jpg",
  "mapSize": { "width": 1920, "height": 1080 },
  "walkableArea": [
    { "x": -820, "y": 390 },
    { "x": -580, "y": 530 }
  ],
  "player": {
    "spawn": { "x": -100, "y": 120 }
  },
  "advisorSpawn": {
    "x": 520,
    "y": -380
  },
  "teammates": [
    { "id": "maya", "name": "Maya", "icon": "📜", "color": "#9b51e0", "x": -280, "y": 60 }
  ],
  "questObjects": [
    {
      "taskId": 1,
      "name": "Cột Buồm Chính",
      "icon": "⛵",
      "color": "#d4af37",
      "x": 260,
      "y": -200,
      "role": "Khu vực điều khiển tời buồm đón bão",
      "portrait": "./assets/portraits/leo.jpg"
    }
  ]
}
```

- `questObjects[].taskId` liên kết 1-1 với `tasks[].id`. Khi người chơi bấm vào vật thể tương tác trên map, hệ thống sẽ mở đúng Task tương ứng trên thanh Chat.
- `teammates[]`: Vị trí đứng của các đồng đội trong phòng (Single Player thì hiển thị dạng Bot hỗ trợ).

---

### 6.3. NPC Cố vấn (`advisor`) — Giai đoạn 1 của Gameplay

Mỗi màn chơi có **1 NPC Cố vấn chính**. Người chơi phải tiếp cận NPC này trước để hoàn thành chuỗi giao tiếp (Chào hỏi, giới thiệu bản thân, trình bày lý do xin trợ giúp) để nhận **Sổ tay bí quyết (`cluebook`)** hoặc Mật khẩu.

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id`, `name`, `role` | `string` | Thông tin định danh của NPC Cố vấn. |
| `portrait` | `string` | Đường dẫn ảnh chân dung NPC hiển thị trên chat. |
| `voiceAudio` | `string` | *(Tùy chọn)* File âm thanh phát khi NPC cất tiếng chào. |
| `dialogueSteps[]` | `array` | Chuỗi các BƯỚC. Mỗi bước là **một câu hỏi**, phải trả lời đúng mới sang bước sau. |
| `cluebook.title` | `string` | Tên sổ tay, hiện ở đầu bảng khi người chơi mở nó ra. → `stages.cluebook_title_i18n` |
| `cluebook.content` | `string` | Toàn văn bí quyết (tiếng Anh) — đây là thứ hiện ra khi bấm vào biểu tượng sổ tay. |

> **Sổ tay chỉ có hai trường đó.** Khuôn cũ tách bí quyết thành `summary` (tóm
> tắt tiếng Việt) và `items[]` (lời khuyên gắn theo từng `taskId`) — cả hai đã bỏ,
> nội dung gộp hết vào `content`. Người chơi mở sổ tay ra để *đọc*, nên nó là một
> đoạn văn liền mạch; còn `items[]` gắn cứng theo `taskId` thì mỗi lần đổi thứ tự
> nhiệm vụ là sổ tay chỉ sai chỗ.

#### Một bước hội thoại

Bước tự mô tả mình bằng **hai trục**: hỏi bằng gì, và trả lời bằng gì. Tách hai
trục thay vì một trường `interactionType` gộp, vì chúng độc lập thật — nghe rồi
gõ, đọc rồi chọn, đều là những cặp có thật.

| Trường | Kiểu | Mô tả |
|---|---|---|
| `step` | `number` | Thứ tự, bắt đầu từ 1. |
| `title` | `string` | Tên ngắn của bước, ví dụ `"Greeting & Intro"`. Bước không hỏi thì bỏ trống. |
| `question_type` | `"text"` \| `"audio"` | **Đề bài ra bằng gì.** `text` → đọc `question_text`. `audio` → phát `audio`. |
| `question_text` | `string` | Lời NPC nói, tiếng Anh. Dùng khi `question_type = "text"`. |
| `text_translation` | `string` | Bản dịch tiếng Việt của `question_text`, hiện khi người chơi **xin gợi ý dịch** (−2⚡). |
| `audio` | `string` | Đường dẫn file tiếng. Dùng khi `question_type = "audio"`. |
| `audio_transcript` | `string` | Lời tiếng Anh của đoạn tiếng đó. |
| `audio_transcript_translation` | `string` | Bản dịch tiếng Việt của `audio_transcript`. |
| `answer_type` | `"select"` \| `"text"` \| `"audio"` \| `""` | **Trả lời bằng gì.** Rỗng = bước này không hỏi gì cả. |
| `options` | `array` | Xem bảng dưới — cấu trúc đổi theo `answer_type`. |
| `wrong_answer_message` | `string` | Hiện khi trả lời sai. Màn hình **giữ nguyên** để chọn lại; đúng mới sang bước sau. |
| `item` | `string` | Bước không hỏi gì thì có thể trao một vật phẩm. Hiện chỉ có `"cluebook"`. |

> **Bước `answer_type: ""` đi vào `stages.advisor_outro_i18n`** — `question_text`
> thành khoá `en`, `text_translation` thành khoá `vi`. Nó KHÔNG là một câu hỏi
> trong database, mà là lời NPC hiện trên màn Claim.
>
> **Bước đó vẫn có `text_translation`, nhưng KHÔNG hiện nút dịch.**
> Gợi ý là thứ trả bằng năng lượng để vượt một câu hỏi; bước này không hỏi gì nên
> không có gì để mua. Vẫn giữ bản dịch trong dữ liệu vì lời NPC ở đây là lời trao
> vật phẩm — chỗ khác cần đọc nó (đọc màn hình, phụ đề, bản tiếng Việt của màn
> chơi) thì đã có sẵn, khỏi phải dịch lại sau.

`options` đổi hình theo `answer_type`:

| `answer_type` | `options` | Người chơi làm gì |
|---|---|---|
| `"select"` | `[{ key, text, isCorrect }]` | Chọn A/B/C/D |
| `"text"` | `["hello", "hi"]` — mảng chuỗi ĐÚNG | Gõ câu trả lời, so với danh sách này |
| `"audio"` | — | Ghi âm *(chưa làm)* |
| `""` | — | Không trả lời. Nếu có `item` thì hiện nút **Claim** |

> **Trả lời sai thì thử lại, không có trần lượt.** Khác với nhiệm vụ ở Giai đoạn
> 2 (3 lượt/câu): chuỗi hội thoại với NPC là **cửa vào màn chơi**, không phải bài
> kiểm tra. Chặn người chơi ở ngay cửa nghĩa là họ không vào chơi được nữa.

> **Bấm Claim mới nhận sổ tay.** Không tự trao khi xong bước cuối: cái bấm tay
> là lúc người chơi biết mình vừa được cho cái gì, và biểu tượng sổ tay ở góc màn
> chơi từ đó có nghĩa. Trao lặng lẽ thì nó chỉ là một biểu tượng mới mọc ra.

---

### 6.4. Danh sách Nhiệm vụ (`tasks[]`) — Giai đoạn 2 của Gameplay

Mỗi màn chơi có **tối thiểu 4 nhiệm vụ**. Người chơi vận dụng bí quyết từ NPC Cố vấn để tương tác và giải quyết các Đối tượng nhiệm vụ trong màn.

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | `number` | Số thứ tự nhiệm vụ trong màn (1, 2, 3, 4...). |
| `title` | `string` | **Tên đối tượng nhiệm vụ**, tiếng Anh — cũng là tên quest hiện trên bản đồ. |
| `skill` | `string` | Nhãn kỹ năng: `"Listen & Speak"`, `"Read & Write"`, `"Read & Speak"`, `"Speak & Listen"`. |
| `questions[]` | `array` | Các câu hỏi của quest — hiện mỗi quest có **2 hoặc 3 câu**, luôn có **cả `select` lẫn `text`**. |
| `pass_score` | `number` | Điểm tối thiểu để qua quest. **Không được lớn hơn tổng `score`** của các câu, không thì không ai qua nổi. |

Tên quest lấy đúng tên đối tượng mà sổ tay của NPC cố vấn nhắc tới — sổ tay viết
*"make your way to the **Main Mast**"* thì trên bản đồ phải có quest tên **Main
Mast**. Đó là cách người chơi dùng sổ tay: đọc rồi đi tìm đúng cái tên đó.

#### Một câu hỏi trong `questions[]`

Dùng chung khuôn với bước hội thoại của NPC cố vấn (mục 6.3) — cùng cặp
`question_type` / `answer_type`, cùng `options` đổi hình theo `answer_type`.

| Trường | Kiểu | Mô tả |
|---|---|---|
| `question_type` | `"text"` \| `"audio"` | Đề bài ra bằng gì. |
| `answer_type` | `"select"` \| `"text"` \| `"audio"` | Trả lời bằng gì. |
| `question_text` | `string` | Lời thách đố của đối tượng nhiệm vụ, **tiếng Anh**. |
| `text_translation` | `string` | Bản dịch tiếng Việt, hiện khi người chơi mua gợi ý dịch. **Chỗ tiếng Việt duy nhất trong dữ liệu.** |
| `hint` | `string` | Gợi ý, tiếng Anh. Mua bằng năng lượng — xem `docs/GAME_DOMAIN.md`. |
| `options` | `array` | `select` → `[{key, text, isCorrect}]`; `text` → mảng chuỗi đúng. |
| `energy_penalty` | `number` | Năng lượng bị trừ khi trả lời sai (mặc định `2`). |
| `score` | `number` | Điểm của riêng câu này (mặc định `10`). |

Một quest trộn cả hai kiểu trả lời là cố ý: câu `select` cho người chơi **nhận ra**
câu tiếng Anh đúng, câu `text` bắt họ **tự nhớ ra và gõ lại**. Nhận ra thì dễ hơn
nhớ ra nhiều, nên đi từ chọn sang gõ trong cùng một quest là đi từ dễ sang khó
trên đúng một mẫu câu.

---

## 7. Quy tắc Hệ thống Điểm & Công thức tính toán chuẩn (Point System)

Theo chuẩn [`PROJECT OVERVIEW.md`](file:///c:/vitaminfun/docs/PROJECT%20OVERVIEW.md):

### 7.1. Điểm Năng lượng (Energy Point)
- Cấp vào đầu màn chơi cho từng cá nhân (mặc định 10⚡).
- Dùng cho các quyền trợ giúp: Dịch câu thoại (`-5⚡`), Nghe lại (`-2⚡`), Xem gợi ý/Cluebook (`-3⚡`), Trả lời sai (`-2⚡`).
- **Quy tắc an toàn:** Dùng hết năng lượng **không** làm thua màn chơi; người chơi chỉ mất quyền dùng trợ giúp và phải tự lực hoàn thành các nhiệm vụ còn lại.

### 7.2. Điểm Kinh nghiệm / Điểm Chiến lực (Experience / Combat Power)
- Chỉ cộng **khi chiến thắng màn chơi** (hoàn thành mọi nhiệm vụ trong thời gian quy định).
- Tính riêng cho từng người chơi theo hiệu suất cá nhân:

$$\text{Exp} = (\text{Số task cá nhân hoàn thành} \times \text{BaseScore} \times \text{Hệ số độ khó}) + (\text{Tỉ lệ thời gian còn lại} \times \text{MaxTimeBonus}) + (\text{Tỉ lệ năng lượng còn lại} \times \text{MaxEnergyBonus})$$

Trong đó:
- $\text{Tỉ lệ thời gian còn lại} = \frac{\text{Giới hạn thời gian} - \text{Thời gian đã dùng}}{\text{Giới hạn thời gian}}$ (tính đến lúc hoàn thành task cuối).
- $\text{Tỉ lệ năng lượng còn lại} = \frac{\text{Năng lượng còn lại}}{\text{Năng lượng ban đầu cấp}}$.
- Hệ số độ khó: `Easy = 1.0`, `Medium = 2.0`, `Hard = 3.0`.
- Điểm kinh nghiệm chỉ tăng, không giảm; dùng làm điều kiện mở khóa màn chơi và nhảy bậc (Level Jump).

---

## 8. Túi đồ (Inventory)

Túi đồ người chơi gồm 2 ngăn được cập nhật tự động qua dữ liệu JSON:

1. **Ngăn Vật phẩm (Item Tab):**
   - Thu nhận `reward` (Mảnh vật phẩm) khi hoàn thành Task cuối của màn.
   - Khi thu thập đủ `mainCollectible.totalRequired`, cho phép tương tác với `endGate` để hoàn thành World.
2. **Ngăn Kiến thức (Knowledge Tab):**
   - Thu nhận `cluebook` (`title` + `content`) từ NPC Cố vấn sau khi bấm **Claim** ở bước cuối.
   - Thu nhận câu trả lời đúng của các Task đã hoàn thành — lấy từ `options` (phương án `isCorrect`, hoặc chuỗi đầu tiên nếu `answer_type` là `text`) — để người chơi mở ra ôn luyện lại bất cứ lúc nào.

---

## 9. Hướng dẫn áp dụng mở rộng cho các World mới (Multi-World Extension)

Khi mở rộng thêm World mới (vd: World 2 "MAYA", World 3 "Xuyên Việt"):

1. Tạo file `public/data/worlds/world_02.json`:
   - Thiết lập `learning.type` ("language" hoặc "knowledge_skills").
   - Đặt `mainCollectible` (vd: "Mảnh bích họa Maya").
   - Đặt `endGate` (vd: "Kim tự tháp Mặt Trời").
   - Định nghĩa danh sách 4 nhân vật nhập vai của World 2.
2. Tạo thư mục `public/data/stages/world_02/`:
   - Tạo các file `stage_01.json` ... `stage_30.json` tuân thủ đúng 100% schema tại mục 5 và mục 6.
   - Gán `worldId: "world_02"`.
3. Toàn bộ Game Engine (`GameState`, `StageScene`, `ChatController`, `InventoryUI`) tự động tương thích và vận hành trơn tru mà không cần viết lại mã nguồn!

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
    "id": "captain_drake",
    "name": "Captain Drake (Thuyền trưởng)",
    "role": "NPC Cố vấn Màn 1",
    "portrait": "./assets/portraits/captain.jpg",
    "voiceAudio": "./assets/audio/voice/stage_01_advisor.mp3",
    "dialogueSteps": [
      {
        "step": 1,
        "title": "1. Chào hỏi & Giới thiệu bản thân",
        "npcPrompt": "Ahoy! The tempest is raging! Who are you and what is your role in this expedition?",
        "vietnameseTranslation": "Chào nhóc tỳ! Giông bão đang nổi lên dữ dội! Ngươi là ai và đảm nhận vai trò gì trong chuyến hải trình này?",
        "options": [
          {
            "key": "A",
            "text": "Hello Captain Drake! I am Leo, the Guardian leader of this expedition.",
            "isCorrect": true
          },
          {
            "key": "B",
            "text": "I am just a passenger looking for snacks in the kitchen.",
            "isCorrect": false
          },
          {
            "key": "C",
            "text": "Goodbye Captain, see you tomorrow morning!",
            "isCorrect": false
          }
        ],
        "targetKeywords": ["hello captain", "i am leo", "guardian leader", "expedition"],
        "targetPhrase": "Hello Captain Drake! I am Leo, the Guardian leader of this expedition."
      },
      {
        "step": 2,
        "title": "2. Trình bày mục đích xin hỗ trợ",
        "npcPrompt": "Good to know! We are losing control of the helm! What do you need from me to keep this ship afloat?",
        "vietnameseTranslation": "Tốt lắm! Con tàu đang mất lái! Cậu cần ta giúp đỡ điều gì để giữ cho tàu không bị chìm?",
        "options": [
          {
            "key": "A",
            "text": "Captain Drake, please give us the emergency guidebook and instructions to secure the ship!",
            "isCorrect": true
          },
          {
            "key": "B",
            "text": "Can you sing us a sea shanty to calm the waves?",
            "isCorrect": false
          },
          {
            "key": "C",
            "text": "We want to abandon ship and swim back to the shore right now!",
            "isCorrect": false
          }
        ],
        "targetKeywords": ["give us", "emergency guidebook", "instructions", "secure the ship"],
        "targetPhrase": "Captain Drake, please give us the emergency guidebook and instructions to secure the ship!"
      }
    ],
    "cluebook": {
      "title": "📜 SỔ TAY BÍ QUYẾT CỦA THUYỀN TRƯỞNG DRAKE",
      "summary": "1. Cột buồm: Hô khẩu lệnh 'Lower the sails immediately!'.\n2. Thân tàu: Yêu cầu 'Hand me the iron wrench and wooden planks'.\n3. Phao cứu sinh: Báo cáo 'The red beacon is flashing at two o'clock'.\n4. Hòm cứu nạn: Giải mật khẩu 'SURVIVAL' (S-U-R-V-I-V-A-L).",
      "items": [
        {
          "targetTaskId": 1,
          "objectName": "Cột Buồm Chính",
          "clue": "Hô to 'Lower the sails immediately!' để hạ buồm đón gió."
        },
        {
          "targetTaskId": 2,
          "objectName": "Thân Tàu Bị Nứt",
          "clue": "Yêu cầu thợ máy: 'Hand me the iron wrench and wooden planks'."
        },
        {
          "targetTaskId": 3,
          "objectName": "Đèn Phao Cứu Sinh",
          "clue": "Định vị radar: 'The red beacon is flashing at two o'clock'."
        },
        {
          "targetTaskId": 4,
          "objectName": "Hòm Cứu Nạn",
          "clue": "Mật mã mở khóa chữ cái: 'SURVIVAL'."
        }
      ]
    }
  },

  "tasks": [
    {
      "id": 1,
      "title": "Hạ buồm đón gió",
      "skill": "Nghe & Nói (Listen & Speak)",
      "interactionType": "speak",
      "npc": "Cột Buồm Chính",
      "npcDialogue": "Gió bão đang giật đứt dây tời buồm! Cần khẩu lệnh chuẩn tiếng Anh để hạ buồm khẩn cấp!",
      "vietnameseHint": "Hãy hô khẩu lệnh tiếng Anh để hạ buồm lập tức.",
      "targetPhrase": "Lower the sails immediately!",
      "targetKeywords": ["lower the sails", "lower sails", "lower the sails immediately", "immediately"],
      "options": [
        {
          "key": "A",
          "text": "Lower the sails immediately!",
          "isCorrect": true
        },
        {
          "key": "B",
          "text": "Raise all sails to the highest point!",
          "isCorrect": false
        },
        {
          "key": "C",
          "text": "Cut the anchor chain right now!",
          "isCorrect": false
        }
      ],
      "hint": "Bí quyết Thuyền trưởng: Lower the sails immediately!",
      "energyPenalty": 2,
      "rewardExp": 50,
      "reward": null,
      "completed": false
    },
    {
      "id": 2,
      "title": "Gia cố thân tàu nứt",
      "skill": "Đọc & Viết (Read & Write)",
      "interactionType": "write",
      "npc": "Thân Tàu Bị Nứt",
      "npcDialogue": "Nước biển đang tràn vào qua khe nứt! Hãy đọc sổ tay và viết tên công cụ cần chuyền cho thợ máy!",
      "vietnameseHint": "Gõ tên dụng cụ cần thiết theo hướng dẫn trong sổ tay.",
      "targetPhrase": "Hand me the iron wrench and wooden planks",
      "targetKeywords": ["iron wrench", "wooden planks", "wrench and wooden planks"],
      "options": [
        {
          "key": "A",
          "text": "Hand me the iron wrench and wooden planks.",
          "isCorrect": true
        },
        {
          "key": "B",
          "text": "Bring me a cup of hot coffee and tea.",
          "isCorrect": false
        },
        {
          "key": "C",
          "text": "Throw the hammer into the deep sea.",
          "isCorrect": false
        }
      ],
      "hint": "Bí quyết Thuyền trưởng: Hand me the iron wrench and wooden planks.",
      "energyPenalty": 2,
      "rewardExp": 50,
      "reward": null,
      "completed": false
    },
    {
      "id": 3,
      "title": "Định vị phao cứu sinh",
      "skill": "Nghe & Nói (Listen & Speak)",
      "interactionType": "speak",
      "npc": "Đèn Phao Cứu Sinh",
      "npcDialogue": "Tín hiệu radar nhấp nháy trong sương mù! Hãy mô tả hướng phát sáng của đèn phao cứu sinh!",
      "vietnameseHint": "Mô tả vị trí phát sáng đèn phao (hướng 2 giờ).",
      "targetPhrase": "The red beacon is flashing at two o'clock",
      "targetKeywords": ["red beacon", "flashing", "two o'clock", "two o clock"],
      "options": [
        {
          "key": "A",
          "text": "The red beacon is flashing at two o'clock.",
          "isCorrect": true
        },
        {
          "key": "B",
          "text": "The green light is completely turned off.",
          "isCorrect": false
        },
        {
          "key": "C",
          "text": "Look at the dark clouds on the left side.",
          "isCorrect": false
        }
      ],
      "hint": "Bí quyết Thuyền trưởng: The red beacon is flashing at two o'clock.",
      "energyPenalty": 2,
      "rewardExp": 50,
      "reward": null,
      "completed": false
    },
    {
      "id": 4,
      "title": "Thu thập Mảnh bản đồ 1",
      "skill": "Đọc & Viết (Read & Write)",
      "interactionType": "write",
      "npc": "Hòm Cứu Nạn",
      "npcDialogue": "Hòm cứu nạn chứa Mảnh bản đồ 1 đang bị khóa mã bảo mật. Hãy nhập mật từ giải mã!",
      "vietnameseHint": "Nhập từ khóa sinh tồn mà Thuyền trưởng đã chỉ dẫn.",
      "targetPhrase": "SURVIVAL",
      "targetKeywords": ["survival", "s-u-r-v-i-v-a-l"],
      "options": [
        {
          "key": "A",
          "text": "SURVIVAL",
          "isCorrect": true
        },
        {
          "key": "B",
          "text": "TREASURE",
          "isCorrect": false
        },
        {
          "key": "C",
          "text": "ATLANTIS",
          "isCorrect": false
        }
      ],
      "hint": "Bí quyết Thuyền trưởng: Từ khóa mở hòm là 'SURVIVAL'.",
      "energyPenalty": 2,
      "rewardExp": 50,
      "reward": "map_shard_01",
      "completed": false
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
| `dialogueSteps[]` | `array` | Chuỗi câu hỏi giao tiếp (tối thiểu 2 bước: 1. Chào hỏi/Giới thiệu; 2. Trình bày mục đích). |
| `dialogueSteps[].vietnameseTranslation` | `string` | Bản dịch tiếng Việt hỗ trợ khi người chơi bấm nút **Dịch (-5⚡)**. |
| `cluebook.summary` | `string` | Toàn văn sổ tay bí quyết được lưu vào **Ngăn Kiến thức** trong Túi đồ sau khi hoàn thành Giai đoạn 1. |
| `cluebook.items[]` | `array` | Mảng chi tiết từng lời khuyên tương ứng với từng `taskId`. |

---

### 6.4. Danh sách Nhiệm vụ (`tasks[]`) — Giai đoạn 2 của Gameplay

Mỗi màn chơi có **tối thiểu 4 nhiệm vụ**. Người chơi vận dụng bí quyết từ NPC Cố vấn để tương tác và giải quyết các Đối tượng nhiệm vụ trong màn.

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | `number` | Số thứ tự nhiệm vụ trong màn (1, 2, 3, 4...). |
| `title` | `string` | Tên tóm tắt nhiệm vụ (hiển thị trên danh sách quest UI). |
| `skill` | `string` | Nhãn kỹ năng (vd: `"Nghe & Nói (Listen & Speak)"`, `"Đọc & Viết (Read & Write)"`). |
| `interactionType` | `string` | Kiểu tương tác chính: `"speak"` (Nói mic), `"write"` (Gõ text), `"choose"` (Trắc nghiệm), `"listen"` (Nghe âm thanh). |
| `npc` | `string` | Tên hiển thị của đối tượng nhiệm vụ gửi tin nhắn trên chat. |
| `npcDialogue` | `string` | Lời thoại thách đố của đối tượng nhiệm vụ. |
| `vietnameseHint` | `string` | Bản dịch tiếng Việt của lời thách đố khi bấm nút Dịch. |
| `targetPhrase` | `string` | Mẫu câu tiếng Anh chuẩn (hiển thị mẫu và lưu vào Túi đồ). |
| `targetKeywords` | `string[]` | Danh sách từ khóa để bộ máy Speech-to-Text / Text Matcher chấm điểm đúng. |
| `options[]` | `array` | 3 lựa chọn trắc nghiệm A/B/C với đúng 1 phương án `isCorrect: true`. |
| `hint` | `string` | Gợi ý hiển thị khi người chơi trả lời sai. |
| `energyPenalty` | `number` | Số điểm năng lượng bị trừ nếu người chơi trả lời sai (mặc định: `2`). |
| `rewardExp` | `number` | Điểm kinh nghiệm đóng góp của nhiệm vụ này (mặc định: `50`). |
| `reward` | `string \| null` | `null` cho các nhiệm vụ thường; nhiệm vụ cuối cùng của màn chứa mã Mảnh vật phẩm (vd: `"map_shard_01"`). |
| `completed` | `boolean` | **Luôn khởi tạo `false`**. Trạng thái hoàn thành được cập nhật theo phiên chơi trong bộ nhớ runtime. |

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
   - Thu nhận toàn bộ `cluebook.summary` từ NPC Cố vấn sau Giai đoạn 1.
   - Thu nhận toàn bộ `targetPhrase` và từ vựng từ các Task đã hoàn thành để người chơi mở ra ôn luyện lại bất cứ lúc nào.

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

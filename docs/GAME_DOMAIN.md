# GAME DOMAIN — Mô hình dữ liệu

> **SSOT về mô hình dữ liệu.** Sửa file này **trước**, rồi mới sửa code.
> **Đọc trước:** [ARCHITECTURE.md](./ARCHITECTURE.md) (kiến trúc tổng) · [LOST IN ATLANTIS_...md](./LOST%20IN%20ATLANTIS_Lạc%20vào%20vương%20quốc%20huyền%20thoại.md) (luật chơi) · [UI_META_SCREENS.md](./UI_META_SCREENS.md) (bố cục màn hình)
> **Hợp đồng câu hỏi:** `docs/question-schemas.md` — copy từ LMS EDUPLAY ở Bước 2.
> Cập nhật: 2026-08-25

---

## 0. Sáu quyết định đã chốt

| # | Quyết định | Hệ quả |
|---|---|---|
| 1 | Vitaminfun **đứng một mình**: `api/` (FastAPI) + `web/` (Next.js). LMS EDUPLAY chỉ là kho tham khảo chỉ đọc | Code được copy sang và tổ chức lại, không phụ thuộc LMS lúc chạy |
| 2 | **Không có `tenant_id`.** Ba vai trò cố định trên `users.role`: admin · teacher · student | Bỏ RBAC động 4 mức phạm vi của LMS. Xem [ARCHITECTURE §7](./ARCHITECTURE.md) |
| 3 | Nhiệm vụ **LÀ** câu hỏi của kho câu hỏi. Màn chơi **không** dùng lại bảng `exams` | Một trình soạn duy nhất, một bản grader duy nhất |
| 4 | Không hardcode: chữ qua `messages/` và `*_i18n` JSONB · số cân bằng qua `worlds.balance_json` · media qua `media_assets` | Vận hành chỉnh được mà không cần dev, không deploy lại |
| 5 | **Kết quả từng người chơi là độc lập.** Mỗi người tự nộp từng nhiệm vụ, server chấm ngay, cộng điểm ngay | `UNIQUE(stage_run_id, user_id, quest_id)`. Xem §1.5 |
| 6 | **Giáo viên và admin chơi thử bằng chính giao diện học sinh**, đánh dấu `is_trial` | `/play/*` mở cho cả ba vai trò; phạm vi dữ liệu mới khác. Xem [ARCHITECTURE §4](./ARCHITECTURE.md) |

---

## 1. Nguyên tắc nền tảng

### 1.1. Nhiệm vụ **LÀ** câu hỏi — không phát minh lại

Một nhiệm vụ trong game = **một `Question` của kho câu hỏi** + một lớp metadata game mỏng.

Đây là lý do chính của việc tái sử dụng LMS:

- Giáo viên soạn nhiệm vụ bằng **một trình soạn duy nhất** (Question Builder copy từ LMS), không cần công cụ thứ hai
- Chấm điểm dùng **đúng một bản grader Python đã có test** (copy 100% từ LMS) — không có bản JS thứ hai
- 16 dạng câu hỏi trong `question-schemas.md` áp dụng được ngay cho game
- `Question.level` (CEFR) → độ khó màn · `Question.tags` → `grammarHint`

> **Luật:** không bao giờ tạo bảng `game_questions` riêng. Nhiệm vụ khác câu hỏi ở chỗ **nó gắn vào cái gì trong cảnh** và **tốn bao nhiêu năng lượng**, chứ không khác ở nội dung học thuật.

### 1.2. Màn chơi **KHÔNG** phải đề thi

Ngược lại, `Stage` **không** tái sử dụng bảng `exams`. Lý do: màn chơi mang một tập thuộc tính mà đề thi không bao giờ có (world, chương, mảnh bản đồ, năng lượng đội, NPC cố vấn, toạ độ vật thể trong cảnh, điểm chiến lực yêu cầu). Nhồi chúng vào một bảng `exams` chung sẽ khiến mọi truy vấn đề thi từ nay phải nhớ loại trừ màn chơi.

Quan hệ đúng là: **`stages` là bảng riêng, `quests` trỏ tới `questions`** — y hệt cách `exam_questions` trỏ tới `questions`.

### 1.3. Đóng băng màn chơi lúc bắt đầu — bắt buộc

Kế thừa nguyên mẫu `Attempt` của LMS, nhưng ở cấp **phòng** thay vì cấp **học sinh**:

```
stage_runs.snapshot_json    → đề bài đã đóng băng, an toàn gửi xuống cả 4 máy
stage_runs.answer_key_json  → đáp án, KHÔNG BAO GIỜ rời server khi đang chơi
```

Lý do ở đây còn mạnh hơn ở một LMS thông thường: 4 người chơi phải nhìn thấy **cùng một bản đề**. Nếu đọc trực tiếp từ `questions` mà giữa chừng có người sửa câu hỏi, hai máy trong cùng phòng sẽ hiển thị hai đề khác nhau.

### 1.4. Chấm điểm luôn ở server, tầng realtime không quyết đúng/sai

Tầng WebSocket chỉ **chuyển tiếp** kết quả đã chấm. Nhờ vậy nó là relay không nghiệp vụ và có thể thay bằng Go/Elixir sau này mà không đụng luật chơi. Xem `ARCHITECTURE_REALTIME.md` (sẽ viết ở Bước 7).

### 1.5. Kết quả từng người là độc lập — nộp riêng, chấm riêng, cộng điểm riêng

Bốn người chơi chung một màn, nhưng **bài làm là của từng người**. Điểm chiến lực là điểm cá nhân, nên không thể có chuyện cả phòng dùng chung một bài nộp.

```
Người chơi giải xong 1 nhiệm vụ
        │
        ▼  bấm nút "Nộp bài" trên máy mình
POST /play/runs/{run_id}/quests/{quest_id}/answer
        │
        ├─► chấm ngay ở server (grade)
        ├─► ghi 1 dòng quest_answers cho CHÍNH user đó (nhật ký, không ghi đè)
        ├─► nếu ĐÚNG lần đầu: cộng điểm chiến lực cơ bản vào world_progress
        ├─► nếu SAI: trừ năng lượng ĐỘI
        │
        ├─► trả về NGƯỜI NỘP:  { completed: true|false, attempts_left, team_energy }
        │                       CHỈ CÓ THẾ — không điểm, không giải thích, không đáp án
        └─► phát cho CẢ PHÒNG: { user_id, quest_id, completed, team_energy_remaining }
                                KHÔNG kèm response_json, KHÔNG kèm đáp án
```

### 1.5b. Một nhiệm vụ = một vật thể + NHIỀU câu hỏi

Bấm vào cột buồm không nhất thiết chỉ hỏi một câu. Một nhiệm vụ là **một cụm câu
hỏi** gắn vào một vật thể trong cảnh:

```
Nhiệm vụ "npc" (phase = advisor)          Nhiệm vụ "mast" (phase = main)
  1. Chào thuyền trưởng        10 điểm      1. Dụng cụ nào để hạ buồm?   10 điểm
  2. Giới thiệu tên và kỹ năng 10 điểm      2. Hạ buồm nói thế nào?      10 điểm
  3. Nói mục đích đến đây      10 điểm
  pass_score = 30 (mặc định)                pass_score = 20 (mặc định)
```

Đây là điều tài liệu thiết kế Atlantis mô tả ngay từ đầu — *"trả lời một **chuỗi**
câu hỏi giao tiếp"* — mà mô hình một-câu-một-nhiệm-vụ không diễn đạt được.

**Hoàn thành nhiệm vụ** = tổng điểm các câu trả lời đúng của người đó trong
nhiệm vụ ≥ `pass_score`. Không phải "đúng hết mọi câu", trừ khi để `pass_score`
mặc định.

### 1.5c. Mảnh bản đồ thuộc về MÀN, không thuộc về nhiệm vụ

```
Hoàn thành TẤT CẢ nhiệm vụ của màn  →  màn hoàn thành
                                    →  cả đội nhận Mảnh bản đồ số stages.map_shard_index
Hoàn thành đủ 30 màn                →  đủ 30 mảnh khác nhau  →  mở Cánh cổng Thời gian
```

**Không có cờ `grants_map_shard` trên nhiệm vụ.** Mỗi màn trao đúng một mảnh, và
số hiệu mảnh đã nằm sẵn ở `stages.map_shard_index` — gắn thêm cờ trên một nhiệm
vụ nào đó là tạo ra một nguồn sự thật thứ hai cho cùng một luật, và hai nguồn thì
sẽ có ngày nói khác nhau.

> Đây là **sửa lỗi thiết kế**: bản trước cho phép đánh dấu một nhiệm vụ "trao
> mảnh", tức là hoàn thành riêng nhiệm vụ đó đã lấy được mảnh — trái với luật
> "hoàn thành màn mới được mảnh" của tài liệu thiết kế.

### 1.6. Trong trận chỉ nói xong / chưa xong — chi tiết để dành đến hết màn

Đây là **hai tầng thông tin tách bạch**, và ranh giới giữa chúng là lúc màn chơi kết thúc.

| | Trong trận | Sau khi màn kết thúc |
|---|---|---|
| Nhiệm vụ xong chưa | ✓ | ✓ |
| Còn mấy lượt thử | ✓ | — |
| Năng lượng đội | ✓ | ✓ |
| **Điểm từng nhiệm vụ** | ✗ | ✓ |
| **Đáp án đúng** | ✗ | ✓ |
| **Giải thích** | ✗ | ✓ |
| **Điểm chiến lực nhận được** | ✗ | ✓ |
| Bài làm của người khác | ✗ | ✗ **không bao giờ** |

Trong trận, người chơi chỉ thấy `MISSION COMPLETE` hoặc `CHƯA HOÀN THÀNH — [THỬ LẠI]`. Xem lại chi tiết ở `GET /play/runs/{run_id}/review`, chỉ mở khi `stage_runs.status != "playing"`, và **chỉ trả bài của chính người gọi**.

Ba lý do bố trí như vậy:

1. **Giữ nhịp chơi.** Một bảng điểm bung ra giữa trận cắt đứt mạch trò chơi. Đang chạy trốn quái thú thì không phải lúc đọc giải thích ngữ pháp.
2. **Không rò đáp án.** Trả giải thích ngay khi sai là đưa thẳng đáp án cho người còn 2 lượt thử — và cho cả ba đồng đội đang ngồi cạnh chưa làm nhiệm vụ đó.
3. **Ôn tập đúng lúc.** Hết màn, đầu óc rảnh, xem một lượt cả bốn nhiệm vụ thì học được nhiều hơn là đọc vụn từng mẩu giữa trận.

> Màn xem lại mở cả khi **thua**, không chỉ khi thắng. Thua là lúc cần xem mình sai ở đâu nhất.

### 1.7. Thử lại được — nhưng có giá và có trần

Sai thì hiện nút **THỬ LẠI**, không phải khoá nhiệm vụ. Mỗi lần nộp ghi thêm **một dòng** `quest_answers`; bảng này là **nhật ký các lần thử**, không phải một dòng bị ghi đè.

Ba thứ chặn không cho biến nó thành trò đoán mò:

| Chặn bằng | Cụ thể |
|---|---|
| **Năng lượng đội** | Mỗi lần sai trừ `energyCost.wrongAnswer` khỏi quỹ chung. Đoán bừa là làm hại đồng đội |
| **Trần số lần thử** | `balance_json.maxAttemptsPerQuestion`, mặc định `2` — tính theo TỪNG CÂU. Hết lượt thì người canh giữ chuyển sang câu khác, câu đó 0 điểm; nhiệm vụ vẫn qua được nếu các câu khác đủ điểm (§3f) |
| **Điểm giảm dần** | `balance_json.attemptPenalty = [1.0, 0.6]` — đúng ngay lần đầu ăn đủ điểm, đúng ở lần hai còn 60%. Mảng này phải dài đúng bằng `maxAttemptsPerQuestion`: một phần tử thứ ba không bao giờ tới lượt chỉ làm người đọc tưởng còn lần thử thứ ba |

Không có ba thứ này thì một câu trắc nghiệm 3 lựa chọn luôn được giải sau tối đa 3 lần bấm, và điểm chiến lực mất hết ý nghĩa — nó sẽ đo độ kiên nhẫn chứ không đo trình độ tiếng Anh.

**Đúng rồi thì dừng.** Một người chỉ được ăn điểm một lần cho một nhiệm vụ; database cưỡng chế bằng partial unique index ở §3.4, không phải bằng câu `if` trong service.

> ⚠️ **Đoạn dưới đã LỖI THỜI.** Năng lượng giờ là quỹ **riêng từng người**, cấp
> sau khi qua NPC, chỉ tiêu cho hành động trợ giúp; trả lời sai không trừ gì và
> hết cũng không thua. Xem [TASKS.md → Bước 6v](./TASKS.md). Giữ lại đoạn cũ vì
> phần lý lẽ về "bài làm cá nhân ảnh hưởng cả nhóm" còn dùng được khi cân bằng.

**Cái duy nhất dùng chung là quỹ năng lượng.** Trả lời sai trừ vào quỹ của cả đội. Đây là chỗ trò chơi vẫn còn tính hợp tác dù bài làm riêng: bạn cùng đội đoán bừa thì cả đội chịu.

> ⚠️ **Hệ quả phải theo dõi khi cân bằng:** bốn người cùng làm cả bốn nhiệm vụ nghĩa là số lần trả lời sai có thể gấp ~4 lần so với mô hình "mỗi người một nhiệm vụ". Với `energyCost.wrongAnswer = 2` và quỹ 100, đội yếu sẽ cạn năng lượng rất nhanh. Con số này nằm trong `balance_json`, chỉnh được sau buổi test đầu tiên mà không cần deploy — nhưng phải nhớ mà chỉnh.

**Vì sao không nộp theo phòng:** nếu một bài nộp tính cho cả bốn người thì người ngồi im vẫn có điểm chiến lực bằng người làm hết. Điểm chiến lực dùng để mở khoá màn, nên nó sẽ mở khoá cho người chưa học được gì.

---

## 2. Phân cấp miền

```
Universe (Vũ trụ)
 └── Galaxy (Dải thiên hà)
      └── World (Hành tinh)          ← đơn vị BÁN, đơn vị tính Điểm chiến lực
           └── Chapter (Chương)
                └── Stage (Màn chơi) ← đơn vị CHƠI, trao 1 Mảnh bản đồ
                     └── Quest (Nhiệm vụ) ──→ Question (kho câu hỏi dùng chung)
```

**Đơn vị nào chịu trách nhiệm gì:**

| Tầng | Nắm giữ |
|---|---|
| World | Điểm chiến lực (theo từng người, theo từng world) · bộ Mảnh bản đồ · giá bán · Cánh cổng Thời gian |
| Stage | Quỹ năng lượng đội · giới hạn thời gian · điểm chiến lực yêu cầu để mở · 1 mảnh bản đồ |
| Quest | Gắn với vật thể nào trong cảnh · chi phí năng lượng · thuộc giai đoạn NPC hay giai đoạn chính |
| Question | Toàn bộ nội dung học thuật: đề, đáp án, cách chấm, CEFR, tags |

---

## 3. Bảng mới cần tạo

Ký hiệu: `⭐` = tái sử dụng bảng đã có của EDUPLAY, không tạo mới.

### 3.1. Nội dung (content)

```
universes         id, name_i18n, description_i18n, position, status
galaxies          id, universe_id, name_i18n, description_i18n, position, status
worlds            id, galaxy_id, name_i18n, story_i18n, position,
                  cover_media_id → media_assets,
                  difficulty ("easy"|"medium"|"hard"), age_min, age_max,
                  price_amount, price_currency,
                  shard_total (30), status ("draft"|"published"),
                  unlock_requires_world_id → worlds (null = mở sẵn),
                  scene_x, scene_y,            ← chỗ đứng trên bản đồ thiên hà
                  icon_size (null = mặc định), ← đường kính vòng tròn
                  pulse_percent, pulse_period_ms,
                  is_locked (world mới = true),
                  show_ring (mặc định false),
                  lobby_media_id → media_assets,        ← nền phòng chờ
                  title_media_id, title_x/y/width/color/font,
                  desc_media_id,  desc_x/y/width/color/font,
                  lobby_json (bố cục mọi khối kéo thả của phòng chờ)
galaxies          id, universe_id, name_i18n, description_i18n, position,
                  background_media_id → media_assets,   ← ảnh nền màn chọn world
                  audio_json (nhạc nền màn chọn world; xem §Nền động)
                  title_media_id → media_assets,        ← khung tiêu đề
                  title_x, title_y, title_width,
                  title_color (#rrggbb), title_font (% so với cỡ nền),
                  desc_media_id → media_assets,         ← khung mô tả
                  desc_x, desc_y, desc_width,
                  desc_color, desc_font,
                  status ("draft"|"published")
chapters          id, world_id, order_index, name_i18n, synopsis_i18n
stages            id, chapter_id, order_index, name_i18n, synopsis_i18n,
                  scene_key ("ship_deck_01"),
                  background_media_id → media_assets,
                  time_limit_seconds (300),
                  initial_team_energy (100),
                  required_skill_pts (0),
                  skill_pts_max (80),
                  map_shard_index (1..30),
                  min_players (1), max_players (4),
                  advisor_npc_key, advisor_portrait_media_id → media_assets,
                  cluebook_i18n,
                  status ("draft"|"published")
quests            id, stage_id, order_index,
                  phase ("advisor"|"main"),
                  quest_object_key ("mast"|"hull"|"buoy"|"chest"|"npc"),
                  name_i18n,
                  scene_x, scene_y,            ← hệ toạ độ thế giới 3200×1800
                  trigger_radius (null = mặc định cảnh),
                  icon_media_id → media_assets,
                  icon_size (null = mặc định cảnh),
                  pulse_percent (0..50, null = mặc định cảnh, 0 = tắt),
                  pulse_period_ms (400..4000, null = mặc định cảnh),
                  energy_cost (0),
                  pass_score (null = tổng điểm mọi câu hỏi trong nhiệm vụ)
                  UNIQUE (stage_id, order_index)
                  UNIQUE (stage_id, quest_object_key)

quest_questions   id, quest_id, question_id → ⭐questions (RESTRICT),
                  order_index, points (10)
                  UNIQUE (quest_id, question_id)   ← không lắp trùng câu
                  UNIQUE (quest_id, order_index)   ← thứ tự rõ ràng
```

**Ghi chú thiết kế:**

- **Một nhiệm vụ chứa NHIỀU câu hỏi.** `quest_questions` là bảng nối, đúng khuôn `exam_questions` của LMS: có `order_index` và `points`, FK `RESTRICT` tới `questions` để không xoá được câu hỏi đang nằm trong màn chơi.
- `points` nằm trên **bảng nối** chứ không trên `questions`: cùng một câu hỏi lắp vào hai nhiệm vụ khác nhau có thể đáng số điểm khác nhau. Mặc định `10`.
- `pass_score` là điểm tối thiểu để **hoàn thành nhiệm vụ**. `null` = phải đúng hết, tức bằng tổng `points` của mọi câu trong nhiệm vụ. Đặt số nhỏ hơn để cho phép sai một vài câu mà vẫn qua.
- `phase` gộp **cả hội thoại NPC lẫn nhiệm vụ chính vào một bảng**. Chuỗi câu hỏi giao tiếp với Captain Drake bản chất là `MCQ_SINGLE` — không cần bảng `advisor_steps` riêng, và giờ chúng là **nhiều câu hỏi trong cùng một nhiệm vụ `npc`**, đúng như tài liệu thiết kế mô tả (chào hỏi → giới thiệu → nói mục đích).
- `name_i18n` / `story_i18n` là JSONB `{"vi": "...", "en": "..."}` — theo đúng mẫu `ExamPart.title_i18n` của LMS.
- Không có cột `image_url`. Mọi ảnh đi qua `media_assets`.
- **Bản đồ thiên hà dùng CHUNG hệ toạ độ 3200×1800 với cảnh chơi.** `worlds.scene_x/scene_y/icon_size` mang đúng ý nghĩa như `quests.*` — cùng một phép quy đổi phần trăm, cùng một bộ kéo thả (`useDesignBoard()`). Một hệ toạ độ thì không có hai chỗ để lệch nhau.
- **`worlds.icon_size` là BỀ RỘNG ảnh world, không phải đường kính một cái đĩa.** Chiều cao suy ra theo tỉ lệ gốc của ảnh — đúng luật của `quests.icon_size`, và ranh giới của world chính là ranh giới của ảnh. Không nền, không khung, không ép vuông: ảnh nào không vuông mà nằm trong một đĩa tròn thì lòi ra một vành thừa quanh mình, và giáo viên đặt bề rộng 380 lại thấy một hình khác hẳn thứ họ tải lên.
- **`worlds.show_ring` đổi hẳn CÁCH VẼ, không chỉ thêm một cái vành.** Bật thì world thành huy hiệu TRÒN: ảnh bị mask tròn và vành ngoài là thanh tiến độ (đầy dần theo `my_shards / shard_total`; 10/30 màn là đầy một phần ba). Ép tròn ở chế độ này không tuỳ tiện — một thanh tiến độ hình vành khuyên thì phải có hình tròn để chạy quanh. **Mặc định `false`**, kể cả cho world đã có: bật sẵn một thứ trang trí cho mọi người rồi bắt họ đi tìm chỗ tắt là làm ngược.
- Phần trăm tiến độ vẫn hiện thành chữ cạnh world, độc lập với `show_ring` — tắt vành không làm mất thông tin nào.
- **`worlds.lobby_json` giữ bố cục MỌI khối kéo thả của phòng chờ trong MỘT cột.** `{"stats": {"x","y","w","media_id"}, "ranking": …, "chapters": …, "play": …, "createRoom": …, "joinRoom": …}`. Sáu khối × bốn thuộc tính = 24 cột nếu làm bằng cột riêng, và mỗi khối thêm sau này lại là một migration nữa.
  - **Thêm khối mới = thêm một dòng trong `LOBBY_ELEMENTS` (`web/src/game/world.ts`) + một khoá chữ.** Không migration, không sửa trình thiết kế, không sửa màn học sinh — cả hai bên đều duyệt qua sổ đăng ký đó.
  - Đổi lại: database không kiểm được giá trị bên trong JSONB, nên `LobbyElement` của Pydantic là chỗ kiểm DUY NHẤT (`extra="forbid"`, chặn khoảng giá trị).
  - `PATCH` **gộp ở mức KHỐI**: gửi `{"stats": {...}}` chỉ đụng tới `stats`. Chỗ gọi luôn gửi trọn một khối; gộp sâu hơn thì không ai đoán được `media_id: null` nghĩa là "gỡ ảnh" hay "không gửi".
  - `title`/`desc` KHÔNG nằm trong đây: hai khung đó mang CHỮ và thừa cấu hình từ thiên hà, khác hẳn sáu khối này. Gộp chung chỉ để đếm số cột cho gọn.
- **Nhân vật ở phòng chờ là HAI khối riêng**: `character` (cái mặt, bấm vào để
  mở bảng chọn) và `characterInfo` (một dòng `Tên - giới thiệu`, cắt bằng dấu ba
  chấm khi quá khung, thuần hiển thị). Hai thứ đó nằm hai chỗ khác nhau trong
  tranh nền tuỳ người dựng vẽ, mà một khối chỉ có một chỗ đứng và một cỡ. Không
  có nút "Đổi" riêng. Màu và cỡ chữ của dòng mô tả lấy từ cấu hình của chính
  khối đó.
- **`characterInfo` là khối PHẲNG (`LOBBY_PLAIN_KEYS`): khung của khối chính là
  khung chữ**, không có khung nội dung riêng — nó không có tấm ảnh khung nào để
  né hoa văn, nên hai hộp lồng nhau chỉ là hai chỗ để kéo cho cùng một kết quả.
  Chữ xuống dòng cho vừa khung rồi cắt bằng dấu ba chấm; SỐ DÒNG tính ra từ
  khung và cỡ chữ chứ không đo DOM — xem `lobbyTextLines()`.
- **Bảng xếp hạng là TOP 10, mỗi hàng gồm ảnh đại diện + tên (trái) và điểm
  chiến lực (phải).** Không tiêu đề, không số thứ tự viết ngoài — thứ tự nằm
  trong cái vòng tròn đang giữ chỗ cho ảnh đại diện. Chiều cao hàng chia theo
  `LOBBY_RANK_ROWS`, không theo số người đang có: nếu không thì world có ba
  người sẽ hiện ba hàng to bằng nắm tay, và người thứ tư vào là bố cục tự đổi.
- **Năng lượng là của TỪNG NGƯỜI, cấp SAU khi họ qua nhiệm vụ NPC.** Số lượng
  do giáo viên đặt ở `stages.energy_per_player`; quỹ nằm ở `stage_run_players`,
  không còn con số nào cho cả đội. Chỉ tiêu cho các hành động TRỢ GIÚP — trả lời
  sai không trừ gì, và hết năng lượng KHÔNG làm thua màn (`lost_energy` đã bị gỡ
  khỏi ràng buộc CHECK; hết giờ là cách thua duy nhất).
- **Chấm điểm theo CẢ NHIỆM VỤ, không theo từng câu.** Chọn đáp án là lưu
  `quest_drafts` (bảng nháp, không có điểm); bấm Nộp bài mới chấm cả cụm. Quay
  lại sửa câu nào cũng được cho tới lúc nộp. Một lần nộp = một lượt thử cho mỗi
  câu CHƯA đúng; câu đã đúng và câu chưa chọn đều không bị chấm.
- **`duration_seconds` là THỜI GIAN LÀM BÀI, đã chặn trần bằng giới hạn giờ của
  màn** — không phải khoảng cách từ lúc bắt đầu tới lúc chốt. Hai thứ ấy chỉ
  bằng nhau khi lượt được chốt đúng lúc đồng hồ cạn, mà nhánh hết giờ thì hầu
  như không bao giờ: lời chốt đến từ request kế tiếp của người chơi, hoặc từ
  vòng quét dọn — cả hai đều đến muộn. Chậm mười tám giây thì một màn 5 phút
  ghi "5:18"; một tab bị bỏ quên ghi mười bảy ngày.
  - Trần đọc từ **đề bài đã đóng băng** của chính lượt ấy
    (`snapshot_json.stage.time_limit_seconds`), cùng nguồn với
    `seconds_remaining()` — người dựng sửa giới hạn giờ giữa chừng thì lượt đang
    chơi vẫn được chấm theo luật nó đã bắt đầu.
  - `ended_at` đi theo (`started_at + duration_seconds`), không để lệch: hai
    trường cùng nói một việc mà trừ nhau ra số thứ ba thì mọi chỗ đọc hiệu của
    chúng đều mâu thuẫn với cột kia.
  - Luật nằm ở `play/service.py::thoi_luong_choi()` — MỘT chỗ. Báo cáo đọc
    thẳng cột, không chặn trần lần thứ hai bằng `stages.time_limit_seconds`
    hiện tại: đó sẽ là một luật thứ hai đọc một nguồn khác, và hạ giới hạn giờ
    của màn sẽ làm mọi lượt chơi cũ tự nhiên ngắn lại trong báo cáo.
  - Dữ liệu ghi trước bản vá được nắn lại một lần bằng
    `scripts/fix_run_durations.py` (chạy được nhiều lần, có sao lưu).
- **Nhiệm vụ đang khoá thì KHÔNG lưu nháp — chặn ở phía giao diện, trước khi gửi.**
  Server đã từ chối bằng `ADVISOR_LOCKED` (đúng: nháp cũng là ghi vào lượt chơi),
  nhưng bảng "đang khoá" vẫn có hẹn giờ tự lưu 800ms chạy trước cái `return` sớm
  của nó — hook thì React không cho bỏ qua. Kết quả: cứ bấm vào một vật đang khoá
  là bắn một request chắc chắn hỏng, và lời từ chối rơi ra thành unhandled
  rejection. **Chặn** chứ không bọc `try/catch` cho im: nuốt lỗi ở đây thì giấu
  luôn những lần lưu nháp hỏng thật, mà lưu nháp hỏng thật là mất bài người chơi.
- **CÂU KHOÁ soạn được cho TỪNG nhiệm vụ** (`quests.locked_message_i18n`, JSONB,
  mặc định `{}`). Để trống thì bảng "đang khoá" dùng câu tự sinh trong
  `messages/` như cũ; có chữ thì đọc đúng chữ ấy. Ba mươi sáu cánh cửa dùng
  chung một câu thì tới cánh thứ ba người gác cửa không còn là một nhân vật nữa
  — mà mọi câu vẫn phải **gọi đúng tên nhiệm vụ gác cửa** ("clear *Lyra's
  Warning* first"), vì đó là thông tin người chơi cần, không phải lời từ chối.
  Bộ câu mẫu nằm ở `scripts/seed_locked_messages.py`: nó đọc tên cánh cửa từ
  chính cơ sở dữ liệu và xoay vòng sáu khuôn câu, nên đổi tên nhiệm vụ gác cửa
  là chạy lại script, không phải sửa tay.
  - **Người NÓI câu ấy là NGƯỜI GÁC CỬA của màn** (nhiệm vụ `phase='advisor'`),
    nên tiếng cũng thu bằng giọng của người ấy — `POST /quests/{id}/locked-audio`
    tự tra `giong_gac`, giao diện không truyền giọng vào. Không có cột audio
    riêng: bản thu nằm ở `voice_lines` khoá theo `(voice_id, sha256(text))` như
    mọi câu khác, nên sửa chữ là tự khắc cần thu lại, và hai nhiệm vụ trùng chữ
    thì dùng chung một file.
  - `QuestOut` dựng TAY từng trường ở `_quests_out`, nên thêm cột ở model là
    CHƯA đủ: thiếu một dòng ở đó thì ô "Câu khoá" của trình dựng luôn mở ra
    trống dù cơ sở dữ liệu có chữ.
- **NHIỆM VỤ NPC đi theo luật riêng: từng câu một, và KHÔNG có trần lượt thử.**
  Nó là một cuộc hội thoại, không phải một bài tập — bảng không có nút Nộp bài,
  chỉ có **Tiếp**, bấm là chấm ngay câu đang nói. Sai thì hiện
  `content_json.wrong_answer_message` và người chơi trả lời lại, bao nhiêu lần
  cũng được. Bỏ trần `maxAttemptsPerQuestion` ở đây là bắt buộc chứ không phải
  ưu ái: cạn lượt ở một nhiệm vụ thường thì mất điểm câu đó rồi đi tiếp, còn cạn
  lượt ở CỔNG VÀO thì không có "đi tiếp" nào cả — mọi nhiệm vụ khác vẫn khoá,
  không nhiệm vụ nào hoàn thành được, và cả màn hỏng hẳn tới lúc hết giờ.
- **Xong hội thoại NPC là hiện nút CLAIM để nhận sổ tay**, bấm xong đóng bảng.
  Màn Claim hiện đúng lời NPC nói lúc trao (`stages.advisor_outro_i18n` — chính
  là bước cuối của `dialogueSteps`), rồi mới tới nút nhận. Sổ tay gồm TÊN
  (`stages.cluebook_title_i18n`) và NỘI DUNG (`stages.cluebook_i18n`), mở được
  bằng biểu tượng 📖 ở góc màn;
  trước đó biểu tượng vẫn hiện nhưng khoá, để người chơi biết có thứ để lấy.
  Không tự trao lặng lẽ: cú bấm tay là lúc người chơi BIẾT mình vừa được cho cái
  gì, còn một biểu tượng tự mọc ra ở góc màn thì chẳng ai buồn bấm vào.
- **Nút Chơi ngay ở phòng chờ ưu tiên màn ĐANG DỞ** (`resume_stage_id`), không
  có thì mới về màn mở cao nhất. Chỉ tính lượt còn giờ.
- **Chỗ đứng của nhân vật lưu ở `stage_run_players.pos_x/pos_y`** — theo LƯỢT
  CHƠI, nên tự khắc là riêng từng người ở từng màn, và tự reset khi mở lượt mới.
  Ghi theo nhịp 2 giây, không ghi mỗi bước.
- **Vào lại màn mà lượt cũ còn giờ thì CHƠI TIẾP**, khôi phục nguyên trạng (đề,
  bài đã chấm, bài đang dở, năng lượng, đồng hồ). Hết giờ thì chốt lượt cũ thành
  `lost_time` rồi mở lượt mới. Màn đã thắng vẫn chơi lại được, và đó là lượt mới.
- **Đồng hồ: server giữ MỐC, giao diện đọc HIỆU SỐ tới cái mốc đó — tuyệt đối
  không đếm lùi từng nhịp.** Thời gian còn lại luôn tính từ `started_at`
  (`seconds_remaining()`); tin đồng hồ máy người chơi thì đổi giờ hệ thống là
  chơi được vô hạn. Phía giao diện, nhận `seconds_remaining` thì quy ngay ra một
  mốc `Date.now() + n * 1000` rồi mỗi nhịp đọc hiệu số — **không** viết
  `setClock(s => s - 1)`.

  Vì sao: trình duyệt **bóp `setInterval` của tab chạy nền**. Đo thật trên Chrome
  — tab ẩn 219 giây, hàm 1 giây chỉ chạy **73 lần**, và có một quãng đứt **trọn
  60 giây**. Trừ dần theo số lần hàm chạy nghĩa là đi vắng ba phút chỉ trừ hơn
  một phút. Hậu quả nặng hơn một con số xấu: người chơi quay lại thấy còn 01:37,
  chơi tiếp, rồi server báo thua vì thật ra đã hết giờ từ lâu — cái đồng hồ đã
  nói dối họ. Đọc hiệu số thì hàm chạy thưa bao nhiêu cũng chỉ làm con số **cập
  nhật chậm**, không làm nó **sai**.

  Kèm theo một listener `visibilitychange` đọc lại ngay khi quay về tab: nhịp kế
  tiếp có thể còn cách cả phút, đúng lúc người chơi cần biết mình còn bao nhiêu
  thời gian nhất.
- **Cỡ nhân vật đặt theo TỪNG MÀN, kế thừa từ màn đầu world.**
  `stages.character_height` lưu chiều CAO (không phải bề rộng — mỗi nhân vật một
  khổ spritesheet, thứ so sánh được là chiều cao). `NULL` = kế thừa: lấy số của
  màn đầu tiên trong world, không có thì lấy 160. Đọc lúc cần chứ không sao chép
  xuống từng màn, để sửa màn 1 vẫn lan xuống.
- **CHỖ XUẤT PHÁT đặt riêng cho từng màn** (`stages.spawn_x/spawn_y`), bằng cách
  KÉO chính hình nhân vật trong trình thiết kế. `NULL` = chỗ mặc định của cảnh
  (`DEFAULT_SPAWN`), không phải một cặp số điền sẵn — trình thiết kế đọc chính
  cái `NULL` đó để biết có nên hiện nút gỡ, đúng nếp với `character_height`.

  Toạ độ là **ĐIỂM VA CHẠM** — cùng thứ `canWalk()` xét, cao hơn gót chân
  `HERO_FOOT_Y` — chứ không phải tâm tấm ảnh nhân vật. Cú kéo cũng neo vào điểm
  đó, nên trên cả đường từ ngón tay xuống cột database không có phép quy đổi nào
  để lệch. Hai chỗ đó cách nhau gần nửa chiều cao nhân vật; lưu nhầm là người
  dựng căn nhân vật vào vùng vừa vẽ thấy đúng, vào chơi thấy sai.

  **Thứ tự khi vào màn: `stage_run_players.pos_x/pos_y` → `spawn_x/spawn_y` →
  mặc định.** Chỗ người chơi đi tới thắng chỗ người dựng chọn: đảo lại thì thoát
  ra vào lại là một cách quay về vạch xuất phát. Đóng băng vào `snapshot_json`
  như vùng đi được và cỡ nhân vật, rồi vẫn đi qua `rescueToWalkable()` — chỗ
  xuất phát không có gì bảo đảm nằm trong bản vẽ vùng đi được, và thả người chơi
  vào một chỗ không có đường ra là nhốt họ ngay từ giây đầu. Trình thiết kế
  cảnh báo trước khi điều đó xảy ra thay vì để phát hiện lúc đang chơi.
- **Trong PATCH, `null` mặc định nghĩa là "KHÔNG GỬI", và xoá phải nói riêng.**
  `_apply()` bỏ qua mọi `None` — đúng cho gần hết các trường, vì giao diện vá
  từng mẩu payload một. Trường nào người dùng phải xoá được thì đi đường khác:
  `_apply_optional()` (phân biệt bằng `model_fields_set`, dùng cho mã định danh
  và ảnh vật thể) hoặc một cờ `clear_*` riêng (`clear_spawn`,
  `clear_character_height`, `clear_pass_score`, `clear_collision`).

  Chọn nhầm thì **không có lỗi nào cả**: server trả 200 kèm bản ghi y như cũ, và
  người dùng bấm một cái nút không làm gì — lặp đi lặp lại. Đó là điều đã xảy ra
  với nút "Gỡ ảnh" của nhiệm vụ, và là lý do hai danh sách trường
  (`QUEST_KEEP_FIELDS`, `QUEST_CLEARABLE_FIELDS`) giờ nằm cạnh nhau ở mức module
  với một test chốt rằng chúng không giao nhau.
- **Nhiệm vụ NPC là CỔNG VÀO của mọi màn chơi.** Mỗi màn có đúng một nhiệm vụ
  `phase = 'advisor'`, tạo tự động cùng màn, không xoá và không hạ xuống thường
  được. Mọi nhiệm vụ khác KHOÁ cho tới khi người chơi qua nó — khoá theo TỪNG
  NGƯỜI, không theo đội. Nhờ vậy điều kiện "mỗi thành viên hoàn thành ít nhất
  một nhiệm vụ mới được chia mảnh bản đồ" thành hệ quả chứ không còn là chuyện
  may rủi. Chốt ở `submit_answer` (`ADVISOR_LOCKED`), không chỉ ở giao diện.
- **Bảng thành tích là MỘT khung cộng NĂM khối con.** `stats` chỉ còn tấm ảnh
  nền; năm con số (`LOBBY_STAT_KEYS`) là năm khối riêng, kéo và chỉnh được một
  mình, và chỉ hiện CON SỐ vì tấm khung đã vẽ sẵn biểu tượng cho từng dòng.
- **`worlds.level_i18n` tách khỏi `difficulty`.** `difficulty` là ba giá trị cố
  định mà hệ thống dựa vào để lọc và xếp world; `level_i18n` là nhãn tự do chỉ
  để hiện ("Easy", "C2", "3"). Rỗng thì phòng chờ hiện nhãn của `difficulty`.
- **Sao: `stages.star_max` là số sao một màn trao, `star_score_pcts` là ngưỡng
  điểm tính bằng PHẦN TRĂM điểm tối đa của màn** (thêm câu hỏi thì điểm tối đa
  đổi, ngưỡng tuyệt đối sẽ bỗng dưng dễ đi). `stage_progress.best_stars` giữ số
  sao CAO NHẤT từng đạt — không phải lần gần nhất, và không cộng dồn.
- **Tiến độ world = nhiệm vụ ĐÃ ĐỘNG TỚI / tổng nhiệm vụ của màn ĐÃ PHÁT HÀNH.**
  Đã động tới chứ không phải đã làm đúng: đây là thanh "đi được bao xa". Mẫu số
  bỏ màn nháp, nếu không thì tạo thêm một màn nháp là tiến độ của mọi người tụt.
- **Khối phòng chờ đi theo NHÓM** (`LOBBY_GROUPS`): `character` kéo theo dòng mô
  tả, `stats` kéo theo năm con số. Rê chuột vào một khối là cả nhóm phóng, cùng
  tỉ lệ, mỗi khối nở ĐỀU quanh tâm của chính nó; kéo khối cha là các con dời
  theo đúng bấy nhiêu. Đổi kích thước thì không — khung to ra, con số vẫn ở chỗ
  đã căn.
- **Phòng chờ học sinh chỉ còn giao diện đồ hoạ.** Không còn danh sách chương và
  màn chơi dạng chữ bên dưới: tấm khung đã vẽ hết những thứ đó. Vào màn chơi qua
  hàng chương → bản đồ chương.
- **Mỗi khối phòng chờ có một KHUNG NỘI DUNG riêng** — chỗ thật sự vẽ chữ, bên
  trong tấm ảnh nền. Lưu ở `lobby_json.<khối>.content`, toạ độ tính bằng PHẦN
  TRĂM CỦA KHỐI (không phải hệ 3200×1800): ảnh nền căng theo khối, nên đổi cỡ
  khối thì khung nội dung phải đi theo cùng nhịp. Mặc định kín khối chừa 4% mỗi
  bên — đúng nếp cũ, nên world chưa ai đụng tới vẫn hiện y như trước.
- **Chữ trong phòng chờ mặc định TRẮNG, viền ĐEN.** Ảnh nền do người dựng tải
  lên nên không đoán trước được sáng tối, và chữ trắng trên nền sáng thì biến
  mất. Cỡ chữ đo bằng `cqw` — phần trăm bề rộng khung — nên kéo khung to ra là
  chữ to theo; cỡ nền riêng cho từng khối vì các khối rộng hẹp rất khác nhau.
- **Ô chương ở phòng chờ CHỈ CÓ ẢNH, không có tên viết dưới.** Ảnh chương là
  tranh vẽ riêng cho chương đó và thường đã mang chữ trong tranh; một dòng tên
  in thêm bên dưới vừa lặp lại vừa ăn mất chiều cao của chính tấm ảnh. Tên đọc
  được bằng cách rê chuột, và nằm ngay đầu minimap khi bấm vào.
- **Chữ trên ba cái nút của phòng chờ là của NGƯỜI DỰNG, mặc định RỖNG.** Lưu ở
  `lobby_json.<khối>.text_i18n`, và rỗng nghĩa là học sinh chỉ thấy tấm ảnh —
  ảnh nút hầu như bao giờ cũng đã vẽ sẵn chữ trong tranh, nên một dòng chữ của
  hệ thống in đè lên chỉ tạo ra hai lớp chữ chồng nhau. Chỉ khối trong
  `LOBBY_ACTION_KEYS` mới có ô chữ; khối khác đã có nội dung riêng.
- **`chapters.minimap_media_id` là cột RIÊNG, tách khỏi `cover_media_id`.** Hai ảnh phục vụ hai chỗ có khuôn hình khác hẳn nhau: `cover` là ô nhỏ trên hàng chương ở phòng chờ, `minimap` là cả cái nền trải rộng phía sau danh sách màn chơi mở ra khi bấm vào chương. Dùng chung một ảnh thì hoặc ô nhỏ bị méo, hoặc cái nền vỡ hạt. `SET NULL` khi ảnh bị xoá — chương vẫn mở ra bình thường với nền trơn.
- **Chưa có ảnh minimap thì MƯỢN ảnh chương (`cover`).** Hai cột vẫn tách, và tải riêng vẫn cho ra kết quả đẹp hơn vì hai khuôn hình khác nhau; nhưng một tấm ảnh hơi bị kéo giãn vẫn hơn hẳn một mảng đen trống, và ảnh chương thì luôn nói đúng về chương này. Chỉ giao diện lùi bậc — cột trong database vẫn là `NULL`, nên ô tải ảnh của người dựng vẫn hiện đúng "chưa có", không giả vờ đã có.
- **Bấm vào một chương đã mở là mở MINIMAP của chương, không phải nhảy thẳng vào một màn.** Các màn xếp một hàng ngang theo thứ tự vì đây là một con đường, không phải một cái kho. Màn có tên thì tên nằm giữa vòng tròn, chưa có tên thì số thứ tự — chỗ nào cũng phải bấm được, kể cả màn người dựng chưa kịp đặt tên.
- **Mặt của mỗi vòng tròn màn chơi là ẢNH NỀN CỦA CHÍNH MÀN ĐÓ** (`stages.background_media_id`, gửi xuống qua `PlayStageOut.background_url`). Minimap nhờ vậy là một lời hứa xem trước được: cái hang xanh trên bản đồ chính là cái hang xanh lát nữa bước vào. Không thêm cột "ảnh đại diện màn" riêng — nơi sắp đến TRÔNG NHƯ THẾ NÀO thì đã có sẵn một câu trả lời đúng, thêm cột nữa chỉ tạo cơ hội cho hai ảnh nói hai điều khác nhau. Màn khoá vẫn đeo ảnh nhưng **xám và tối hơn**: thấy nơi mình sắp tới là một phần của động lực đi tiếp, còn xám thì nói rõ "chưa phải bây giờ" mà không cần thêm chữ nào.
- **`world_progress.character_id` là nhân vật người này đã chọn cho world này.** Cột trên `world_progress` chứ không phải bảng mới: lựa chọn khoá theo đúng cặp (world, user) mà bảng đó đã khoá sẵn, và nó là một phần của "tiến trình của tôi trong world này". `SET NULL` khi nhân vật bị xoá — học sinh thấy ô trống và chọn lại, không mất tiến trình. **Đổi được bất cứ lúc nào**: một đứa trẻ chọn nhầm ở giây thứ ba mà phải chơi hết học kỳ với nhân vật đó là một hình phạt vô cớ.
- **Spritesheet của nhân vật đi theo `RunOut`, không vào `snapshot_json`.** Snapshot là đề bài đóng băng; nhân vật là lựa chọn của người chơi và đổi được giữa hai lượt, nên nó phải đọc mới mỗi lần. Chỉ những hành động **có ảnh và đo được khổ khung** mới gửi xuống — khổ khung để trống thì server suy `ảnh ÷ frames`, vì cắt lệch một pixel là cả hoạt ảnh trượt khung và chỉ server mới có `media_assets.width/height`. Chưa chọn nhân vật → `character: null`, cảnh chơi vẽ ký hiệu mặc định: **một màn chơi không được đứng hình vì một lựa chọn cũ hết hiệu lực.**
- **Trong màn chơi, `idle` lúc đứng và `walk` lúc đi — suy từ chính vị trí nhân vật, không từ nơi ra lệnh.** Có ba đường làm nhân vật dịch chuyển (tween của cú bấm, phím WASD, cú huỷ tween giữa chừng); so vị trí hai khung hình liên tiếp là MỘT luật đúng cho cả ba, thay vì ba chỗ phải nhớ đồng bộ. Nhân vật thiếu tấm cho hành động đang cần thì giữ nguyên tấm đang chạy — chỉ có mỗi `idle` vẫn đi lại được, chỉ là không có bước chân.
- **Đổi sang `walk` thì tức thì, đổi về `idle` thì đợi 3 khung đứng yên.** Độ trễ một chiều, cố ý: người chơi phải thấy nhân vật nhấc chân đúng lúc họ bấm, còn một khung hình "không nhúc nhích" chưa chắc là đã tới nơi — máy khựng một nhịp là Phaser bù lại bằng vài khung `delta` gần bằng 0, và nhân vật chớp về tư thế đứng giữa lúc đang đi.
- **Nút Play của phòng chờ đi tới màn mở CUỐI CÙNG.** Nó nghĩa là "chơi tiếp", và mép tiến độ là chỗ người chơi đang đứng. Bấm vào một CHƯƠNG thì khác — đó là chọn chương đó, nên đi tới màn mở đầu tiên trong chương ấy.
- **Phòng chờ của world (`worlds.lobby_*` / `title_*` / `desc_*`) dùng CÙNG bộ thiết lập với bản đồ thiên hà, và MỌI cột đều `null` được — `null` nghĩa là THỪA CỦA THIÊN HÀ.** Một world vừa tạo đã có sẵn giao diện đúng tông với cả bản đồ; giáo viên chỉ động vào chỗ họ thực sự muốn khác. Chép sẵn giá trị của thiên hà xuống lúc tạo thì đổi nền thiên hà sau này không lan xuống được world nào nữa.
- **`galaxies.title_*` / `galaxies.desc_*` là hai tấm bảng trang trí trên bản đồ.** Ảnh do giáo viên tải lên; `x`/`y`/`width` cùng hệ toạ độ 3200×1800 với world, chiều cao suy ra theo tỉ lệ gốc của ảnh. Mặc định (NULL) là giữa bản đồ, phía dưới.
  - Chúng mang tên và mô tả **THIÊN HÀ** lúc nghỉ; rê chuột vào một world thì đổi sang tên và mô tả của world đó. **Cái khung đứng yên, chỉ chữ đổi** — vẽ lại khung cho từng world nghĩa là bản đồ nhấp nháy đổi hình mỗi lần con trỏ đi ngang, mà con trỏ thì đi ngang liên tục.
  - **Rời một world là VỀ LẠI thiên hà ngay, kể cả khi con trỏ vẫn còn trong bản đồ.** Chuyện xoá là của TỪNG world (`pointerleave` trên mỗi world), không phải của cả tấm bản đồ; chỉ đặt trên tấm bản đồ thì rê chuột ra khoảng trống giữa các world là hai khung chữ kẹt lại ở world vừa đi qua, và người chơi không còn cách nào đọc lại mô tả thiên hà ngoài việc tải lại trang. Tấm bản đồ vẫn giữ một `pointerleave` làm lưới an toàn, cho lúc con trỏ phóng thẳng ra khỏi cửa sổ.
  - **Xoá có ĐIỀU KIỆN: chỉ xoá nếu world đang hiện đúng là world vừa rời.** Đi thẳng từ world này sang world kia, trình duyệt bắn `pointerleave` của cái cũ **sau** `pointerenter` của cái mới; xoá vô điều kiện là cái vừa trỏ tới bị chính cái vừa rời khỏi thổi bay.
  - Chưa có ảnh thì vẫn vẽ, bằng một tấm nền trơn: màn hình phải chạy được trước khi ai kịp vẽ khung.
  - Cỡ chữ tính bằng `cqw` (phần trăm bề rộng CỦA KHUNG), không bằng `px`. Kéo khung to nhỏ thì chữ co giãn theo đúng tỉ lệ; đặt `px` cố định thì khung nhỏ lại là chữ tràn qua viền, khung to ra là chữ lọt thỏm.
  - **`*_color` và `*_font` đặt cho CÁI KHUNG, không cho từng world.** Chữ của thiên hà và chữ của mọi world đều hiện ra ở đúng chỗ đó, nên cấu hình riêng từng world nghĩa là rê chuột qua ba world là chữ đổi màu ba lần. `*_font` là **phần trăm** so với cỡ nền (100 = giữ nguyên, 40…250) — lưu một con số `px` sẽ sai ngay khi ai đó kéo cái khung to ra.
  - Mã màu kiểm ở CẢ Pydantic lẫn `CHECK` của Postgres. Chỉ có `CHECK` thì một chuỗi rác trả về 500 thay vì 422 kèm chỗ sai.
- **`worlds.is_locked` là cột RIÊNG, không suy ra từ số màn đã xuất bản.** Giáo viên phải khoá được một world đã có nội dung — đang sửa dở, để dành học kỳ sau — và điều đó không suy ra từ đâu được. World mới tạo mặc định `true`: lúc đó nó chưa có chương hay màn nào.
- **Khoá HIỂN THỊ ≠ cột `is_locked`.** Trên bản đồ thiên hà, một world hiện ổ khoá khi `is_locked` **HOẶC** chưa có màn nào phát hành. Vế thứ hai phải đếm màn nên chỉ server tính được; `PlayWorldOut.is_locked` trả về giá trị ĐÃ TÍNH, không phải cột thô.
- **`PlayWorldOut.can_enter` tách khỏi `is_locked`** vì hai câu hỏi khác nhau: ổ khoá là thứ VẼ RA cho mọi người thấy, còn vào được hay không thì giáo viên chơi thử khác học sinh. Trộn hai thứ vào một cờ là hoặc giáo viên không xem trước được, hoặc học sinh đi thẳng vào world chưa phát hành.
- **Rê chuột vào một world thì nó PHÓNG TO một chút, KHÔNG vẽ khung.** Một cái khung của trình duyệt úp lên tấm ảnh người dựng vẽ là nói "đây là ô bấm được" bằng giọng lạc lõng, giữa một bản đồ không có ô nào cả; phóng to thì nói đúng điều đó bằng chính tấm ảnh — vật lại gần thì to lên. Cái đang phóng to phải kèm `hover:z-10`, vì các world đều là `absolute` không z-index nên chúng xếp lớp theo thứ tự DOM và world vẽ sau sẽ cắt ngang mép nó. **Nhưng `focus-visible` thì VẪN vẽ khung**: người dùng bàn phím không có con trỏ để nhìn theo, và 5% to hơn là thứ không thấy nổi khi mắt đang ở chỗ khác. Đừng "dọn cho nhất quán" bằng cách gỡ nốt cái khung đó.
- **Bản đồ hiện MỌI world, kể cả world khoá.** Giấu hẳn thì bản đồ thủng lỗ chỗ và học sinh không biết còn gì đang được dựng — mà bản đồ là chỗ để nhìn thấy cả hành trình, không chỉ chặng đang mở. Cái chặn nằm ở `GET /play/worlds/{id}` (404 khi `can_enter` sai), không nằm ở danh sách: chặn ở danh sách nghĩa là ai gõ thẳng URL vẫn vào được.
- **Ảnh nền và nhạc nền thuộc về `galaxies`, không thuộc từng world.** Đó là cái nền mà mọi world nằm lên trên. Nhạc KHÔNG tự phát: trình duyệt chặn âm thanh tự chạy trước khi người dùng chạm vào trang, nên `autoplay` chỉ đem lại một thẻ audio im lặng và một cảnh báo trong console.

- **`stages.intro_video_media_id` là TẤM MÀN che lúc nạp, không phải một đoạn phim gắn thêm.** `NULL` = màn chơi chạy y như trước, và đó là mặc định. Đoạn video chạy trong lúc gói Phaser, ảnh nền và spritesheet đang tải ngầm; nó KHÔNG vào `snapshot_json` vì nó chạy trước khi lượt chơi tồn tại. Xem §3e.

### Nền động — video làm ảnh nền

**Ba màn được phép, và chỉ ba:** bản đồ thiên hà (`galaxies.background_media_id`), phòng chờ world (`worlds.lobby_media_id`), màn chơi (`stages.background_media_id`). Mọi chỗ khác — ảnh bìa chương, mặt màn trên minimap, khung tiêu đề, ảnh vật thể — vẫn là **ảnh tĩnh**. Ba màn kia là những chỗ người chơi ĐỨNG LẠI và nhìn; một cái bìa chương 120px đang chạy vòng lặp thì không ai xem, chỉ tốn một bộ giải mã.

- **Không thêm cột nào.** `media_assets.kind` đã biết file là `image` hay `video` (server suy ra từ đuôi file lúc tải lên). Thứ duy nhất phải thêm là **trả cái loại đó xuống client** cạnh URL đã có: `background_kind` / `lobby_kind`. Thêm một cột "video nền" riêng chỉ tạo ra một câu hỏi mới cho giáo viên — đặt cả hai thì cái nào thắng.
- **Minimap chương vẫn nhận URL video** (mặt của mỗi màn chính là ảnh nền màn đó). Ở đó video được ghim ở **khung hình đầu**, không `autoplay`, không `loop`: minimap vẽ nhiều màn cùng lúc, cho tất cả chạy là bắt máy học sinh giải mã N luồng video để hiển thị mấy vòng tròn nhỏ.
- **Video được CĂNG cho vừa thế giới 3200×1800, và phải căng lại khi có khung hình đầu.** `setDisplaySize()` của Phaser không lưu bề rộng mong muốn — nó tính ra một TỈ LỆ ngay lúc gọi. Thẻ video vừa dựng thì chưa có khung hình nào và đang mượn tấm texture `__MISSING` 256×256, nên tỉ lệ tính ra là 3200/256 = **12,5**; khi khung hình thật về, tỉ lệ đó vẫn còn và một video 1280×720 hiện ra rộng 16000 đơn vị, tức phóng to gấp 5 lần. `StageScene.fitBgVideo()` canh theo KHỔ TEXTURE mỗi khung hình chứ không nghe sự kiện `textureready` — đo trên máy thật thì sự kiện đó không bắn. Lỗi này chỉ lộ ra với video **nạp chậm**: một video nhỏ đã nằm trong bộ nhớ đệm kịp có texture trước `create()` và trông vẫn đúng, nên đừng thử bằng file nhỏ.
  - Hệ quả: tỉ lệ khung hình của video **nên là 16:9**. Cả ảnh tĩnh lẫn video đều bị ép đúng 3200×1800; một file 4:3 sẽ bị kéo giãn, không phải cắt cúp.
- **Hình ảnh KHÔNG phụ thuộc vào quyền phát âm thanh.** Video nền luôn khởi động ở trạng thái **câm**, nên khung hình chạy ngay khi vào màn. Tiếng chỉ được mở sau đó, và chỉ khi có yêu cầu — xem dưới. Làm ngược lại (mở tiếng ngay từ đầu) là trình duyệt chặn cả cú `play()`, và người chơi mất luôn cái nền động chứ không chỉ mất tiếng.

**Tiếng của video làm nhạc nền.** Mặc định là **tắt tiếng**. Giáo viên bật bằng cờ `audio_json.ambient.from_video`:

- Cờ này chỉ có nghĩa ở khối `ambient`. Đặt nó lên `walk`/`idle` là lỗi 422 — hai khối đó gắn với hành động của nhân vật, không có "tiếng video" tương ứng nào.
- **Nhạc tải riêng thắng, trừ khi giáo viên nói khác.** Đã tải file cho `ambient` thì file đó được dùng. Bật `from_video` là một lựa chọn CÓ Ý THỨC, và giao diện bắt xác nhận: tiếng video sẽ thay chỗ, file đã tải **vẫn nằm nguyên đó** nhưng không phát.
- **Bỏ chọn là quay lại file cũ ngay**, không phải tải lên lần nữa. Đó là lý do cờ nằm CẠNH `media_id` chứ không thay thế nó.
- Cờ chỉ có tác dụng khi ảnh nền THẬT SỰ là video. Đổi nền sang ảnh tĩnh thì cờ nằm im và nhạc tải riêng phát như thường — đổi ngược lại thì cờ sống lại. Không có trạng thái nào bị mất, và không có màn nào im lặng vì một cờ mồ côi.
- Âm lượng vẫn theo `ambient.volume`, nhân với âm lượng tổng của người chơi như mọi tiếng khác. **Tốc độ (`rate`) và lặp (`loop`) thì không**: đổi tốc độ phát là đổi tốc độ cả HÌNH, còn video nền thì vốn đã lặp.
- **`pulse_percent` / `pulse_period_ms` — nhịp thở của vật thể.** Ảnh **và tên** cùng phóng to thu nhỏ liên tục, MỘT nhịp chung, để người chơi nhận ra "cái này bấm được". Tên phải thở vì nó có thể là thứ DUY NHẤT nhìn thấy — xem mục ngay dưới. `pulse_percent` là **to thêm bao nhiêu phần trăm** ở đỉnh nhịp (8 = phình lên 108% rồi về 100%); `pulse_period_ms` là **một nhịp đầy đủ**, to rồi nhỏ.
  - `null` = lấy mặc định của cảnh (`web/src/game/world.ts`), **`0` = tắt hẳn**. Phân biệt được hai thứ đó là lý do cột để `nullable` thay vì mặc định `0`.
  - Chỉ ĐỔI CÁCH VẼ. Khung va chạm — vùng bấm và chỗ nhân vật dừng lại — vẫn tính theo `icon_size` gốc. Cho khung phập phồng theo thì đích bấm chạy dưới tay người chơi.
  - Sàn `pulse_period_ms` là 400ms (2,5 nhịp/giây). Dưới ngưỡng đó thành nhấp nháy tần số cao, thứ có thể gây khó chịu và co giật.
  - **Ba tầng — CHECK constraint, Pydantic và thanh trượt — dùng CHUNG một khoảng.** Cho API rộng hơn giao diện là tạo ra một vùng giá trị hợp lệ mà không nút bấm nào chạm tới được, và người đọc tài liệu sẽ hỏi vì sao.
  - **KHÔNG kiểm `prefers-reduced-motion`** — quyết định có cân nhắc. Cài đặt đó chặn chuyển động *trang trí*, còn nhịp thở ở đây là thứ duy nhất phân biệt vật thể bấm được với hình vẽ trên nền. Trong một trò chơi nhiều người, tắt nó theo cài đặt từng máy nghĩa là hai đứa trẻ chơi chung một màn mà một đứa thấy gợi ý, đứa kia phải bấm mò. Nút tắt nằm ở tay giáo viên (`pulse_percent = 0`), tắt cho cả lớp cùng lúc.
- **Ảnh vật thể để trống là một LỰA CHỌN hợp lệ, không phải một thiếu sót.** Rất nhiều vật thể đã được vẽ sẵn ngay trong ảnh nền — cái rương, cột buồm, thùng gỗ. Việc của người dựng khi đó chỉ là khoanh vùng va chạm chồng lên đúng chỗ ấy.
  - **Trong trình thiết kế**: một ô NÉT ĐỨT, rỗng ruột. Vẫn kéo được, vẫn đổi cỡ được, vẫn là vùng va chạm thật. Nét trắng kèm viền ngoài đen, cùng lối với nhãn nhiệm vụ — nền là tranh vẽ tay, nên một nét mỏng một màu sẽ biến mất ở nửa số chỗ.
  - **Khi chơi**: KHÔNG VẼ GÌ CẢ. Chỉ còn cái tên (vẫn thở), còn vùng va chạm thì vô hình mà vẫn chặn bước chân và vẫn bấm được. Trước đây chỗ này vẽ một vòng sáng màu thay thế; nó là một vật thể MÀ KHÔNG AI CHỌN ĐẶT VÀO CẢNH, và nó nổi lù lù đè lên chính cái rương mà người dựng vừa khoanh.
  - Ô nét đứt của trình thiết kế **cố ý** không giống thứ học sinh thấy. Đó là chỗ khác nhau duy nhất giữa hai bên, và nó được nói thẳng bằng chữ ngay dưới ô chọn ảnh.

### 3.2. Tiến trình người chơi (progress)

```
world_progress    id, world_id, user_id,
                  skill_pts (0),                    ← Điểm chiến lực, RIÊNG theo world
                  stages_completed (0),
                  first_played_at, last_played_at,
                  completed_at (null),
                  gate_opened_at (null)
                  UNIQUE (world_id, user_id)

map_shards_owned  id, world_id, user_id, shard_index (1..30),
                  stage_run_id → stage_runs,
                  earned_at
                  UNIQUE (world_id, user_id, shard_index)

stage_progress    id, stage_id, user_id,
                  best_score, best_quests_completed, times_played,
                  first_completed_at
                  UNIQUE (stage_id, user_id)
```

`map_shards_owned` có `UNIQUE(world_id, user_id, shard_index)` — đây là chỗ **luật "đủ 30 mảnh KHÁC NHAU"** được cưỡng chế bởi database chứ không bởi code. Chơi lại màn 13 mười lần vẫn chỉ có một mảnh #13.

### 3.3. Phòng chơi (room)

```
rooms             id, code (ATL-A12, unique), stage_id,
                  host_user_id → users,
                  mode ("single"|"multi"),
                  status ("waiting"|"starting"|"playing"|"finished"|"abandoned"),
                  auto_start_at,           ← đếm ngược 30s
                  created_at, started_at, finished_at

room_members      id, room_id, user_id (null nếu là Bot),
                  hero_key ("leo"|"maya"|"sam"|"jade"),
                  is_bot, is_ready, joined_at, left_at
                  UNIQUE (room_id, hero_key)   ← 4 người không trùng nhân vật
```

`UNIQUE(room_id, hero_key)` cưỡng chế luật "mỗi người một nhân vật" ở tầng database.

### 3.4. Lượt chơi & kết quả (run)

Đây là phần **mô phỏng `Attempt`/`AnswerRecord`, nhưng ở cấp phòng**:

```
stage_runs        id, stage_id, room_id,
                  snapshot_json,           ⭐ mẫu Attempt — đề đã đóng băng
                  answer_key_json,         ⭐ mẫu Attempt — đáp án, server-only
                  team_energy_initial, team_energy_remaining,
                  status ("playing"|"won"|"lost_energy"|"lost_time"|"abandoned"),
                  started_at, ended_at, duration_seconds,
                  is_trial (bool)          ⭐ mẫu Attempt — giáo viên/admin chơi thử
                                           tự đặt = true khi chủ phòng không phải học sinh;
                                           mọi báo cáo lọc bỏ. Xem ARCHITECTURE §4

stage_run_players id, stage_run_id, user_id (null nếu Bot), hero_key, is_bot,
                  quests_completed, score, max_score,
                  skill_pts_earned, got_map_shard (bool)
                  UNIQUE (stage_run_id, hero_key)

quest_answers     id, stage_run_id, user_id, quest_id, question_id,
                  attempt_no (1,2,3...),   ← NHẬT KÝ: mỗi lần thử là 1 dòng mới
                  response_json, score, max_score, is_correct, detail_json,
                  skill_pts_awarded,       ← chỉ khác 0 ở dòng đúng đầu tiên
                  energy_spent, answered_at

                  UNIQUE (stage_run_id, user_id, quest_id, question_id, attempt_no)
                        ← chặn nộp trùng do bấm hai lần / mạng lặp gói

                  UNIQUE (stage_run_id, user_id, quest_id, question_id) WHERE is_correct
                        ← partial index: MỖI NGƯỜI chỉ ĂN ĐIỂM 1 LẦN / câu hỏi
```

**Vì sao `stage_runs` ở cấp phòng chứ không cấp người chơi (khác `Attempt`):**
quỹ năng lượng là **của cả đội**, thắng/thua là **của cả đội**, và đề phải là **một bản duy nhất** cho cả 4 máy. Nếu tách thành 4 `Attempt` riêng thì ba thứ đó trở thành ba nguồn có thể mâu thuẫn với nhau.

**Hai ràng buộc UNIQUE ở đây là chỗ luật §1.5 và §1.7 được cưỡng chế.**

Cả hai đều có `user_id`. Thiếu nó thì người thứ hai nộp cùng nhiệm vụ sẽ bị database từ chối, và toàn bộ mô hình điểm cá nhân sụp.

Cả hai ràng buộc đều tính tới `question_id` vì một nhiệm vụ chứa nhiều câu hỏi (§1.5b) — người chơi trả lời từng câu một.

`UNIQUE (..., attempt_no)` chặn nộp trùng — người chơi bấm hai lần, hoặc gói tin gửi lại khi mạng chập chờn, thì không thành hai lần thử và không trừ năng lượng hai lần.

`UNIQUE (...) WHERE is_correct` là **partial index của PostgreSQL**: cho phép nhiều dòng sai, nhưng nhiều nhất **một** dòng đúng cho mỗi (lượt chơi, người, nhiệm vụ). Đây là chỗ luật "đúng rồi thì thôi, không ăn điểm hai lần" được database bảo đảm. Viết nó thành `if await already_correct(...)` trong service thì có ngày hai request đến cùng lúc lọt qua cả hai lần kiểm tra và cộng điểm hai lần — kiểu lỗi chỉ xuất hiện khi đông người chơi và gần như không tái hiện được.

**Trạng thái một nhiệm vụ suy ra từ nhật ký, không lưu riêng:** có dòng `is_correct` → xong · đủ `maxAttemptsPerQuestion` dòng sai → hết lượt câu đó · còn lại → đang làm. Một nguồn sự thật, không có gì để lệch nhau.

`quest_answers.user_id` cũng là dữ liệu để cưỡng chế luật *"mọi thành viên phải hoàn thành ≥1 nhiệm vụ thì màn mới tính hoàn thành"* — đếm nhóm theo `user_id`, lọc `is_correct`.

`stage_run_players` là **bản cộng dồn** của `quest_answers` theo từng người, cập nhật mỗi lần nộp. Nó dư thừa về mặt lý thuyết nhưng cần cho màn hình kết thúc và bảng điểm trực tiếp trong trận — không muốn quét lại toàn bộ `quest_answers` mỗi lần vẽ HUD.

**Chi phí ghi:** một lượt chơi 4 người × 4 nhiệm vụ = tối đa 16 lần ghi, chứ không phải ghi theo nhịp khung hình. Không cần gom lô ở giai đoạn này.

---

## 3b. MÃ ĐỊNH DANH và nhập câu hỏi từ file .xlsx

Bộ phận nội dung soạn cả một world trong **một bảng tính**, và trong đó mọi thứ được gọi bằng **mã** chứ không bằng UUID: `W1`, `W1-S1`, `W1-S1-Quest-01`. Mã do người đặt, ổn định qua nhiều lần xuất file, và là thứ duy nhất nối một dòng Excel với một bản ghi trong database.

Bốn bảng mang mã: `worlds.world_code`, `stages.stage_code`, `quests.quest_code` là **địa chỉ của chính bản ghi**; còn `questions.world_code / stage_code / quest_code` là **địa chỉ nơi câu hỏi thuộc về**, chép từ file lúc nhập.

- **Tất cả đều NULL được, và duy nhất khi khác NULL.** Dữ liệu dựng tay không bắt buộc có mã. Nhưng đã có mã thì mã đó là của riêng nó: hai nhiệm vụ cùng mang `W1-S1-Quest-01` thì lúc nhập không biết lắp câu hỏi vào cái nào, và nó sẽ chọn bừa. Vì thế unique index có điều kiện `WHERE ... IS NOT NULL`.
- **Câu hỏi giữ MÃ chứ không chỉ giữ khoá ngoại tới `quests`**, vì ba lý do: (1) lúc nhập, nhiệm vụ mang mã đó có thể **chưa tồn tại**; (2) nhập lại cùng một file không được sinh bản sao, và cặp (`quest_code`, `question_order`) chính là danh tính của một dòng; (3) mở một màn thì hiện được ngay mọi câu cùng `stage_code`, kể cả câu chưa lắp vào nhiệm vụ nào.
- **`world_code` hôm nay luôn để trống.** File hiện tại chưa có cột đó. KHÔNG suy ra từ tiền tố `W1-S1`: suy ra thì đúng với nếp đặt tên hôm nay và sai lặng lẽ vào ngày ai đó đổi nếp.

### Trình nhập làm gì, và cố ý KHÔNG làm gì

`POST /questions/import` đọc sheet `Questions` (bắt buộc) và sheet `Stage-Quests` (không bắt buộc, chỉ để tra `quest_code` thuộc `stage_code` nào).

- **Không tạo màn chơi hay nhiệm vụ.** Bố cục cảnh — vật thể nằm ở đâu, to bao nhiêu, vùng đi được thế nào — là việc của trình thiết kế, và một dòng trong bảng tính không nói được điều đó. Giáo viên dựng cảnh bằng tay rồi **điền mã** vào ô `stage_code` / `quest_code`; đó mới là chỗ quyết định.
- **Khớp mã thì tự lắp, không khớp thì nằm lại trong kho** và giữ nguyên mã. Danh sách mã chưa có nhiệm vụ được trả về như một việc-cần-làm: điền mã rồi nhập lại là chúng tự lắp vào.
- **Câu nhập vào nối vào CUỐI nhiệm vụ**, không chiếm chỗ theo `question_order` của file. `quest_questions` có ràng buộc duy nhất `(quest_id, order_index)`, nên lắp bằng số của file là đâm vào chỗ đã có người ngồi và cả lần nhập gãy giữa chừng — lỗi này đo được, không phải giả định. Đẩy cái đang ngồi đó ra thì tệ hơn: giáo viên có thể đã tự sắp lại thứ tự, và một lần nhập không được xoá công đó. Thứ tự tương đối giữa các câu vừa nhập vẫn đúng như trong file.
- **Dòng hỏng thì bỏ qua, không kéo đổ cả file.** Một file nghìn dòng mà chết vì dòng 997 là người dùng phải sửa rồi nhập lại từ đầu, nhiều lần. Nhập phần lành, rồi nói rõ phần hỏng kèm số dòng.
- **Trạng thái là `published`.** Đây là nội dung đã soạn xong, không phải bản nháp. Để `draft` thì bộ chọn câu hỏi lọc mất chúng, và người dùng phải bấm xuất bản hai mươi sáu lần trước khi làm được việc mình định làm.

### Chọn câu hỏi theo mã, ở màn hình lắp nhiệm vụ

Nhập xong thì việc tiếp theo là **lắp câu vào nhiệm vụ**, và cả hai màn hình làm việc đó (`stage-builder`, và hộp thoại nhiệm vụ trong trình thiết kế) đều dùng chung `QuestionPicker`.

- **Hai ô chọn mã LUÔN hiện: mã màn, rồi mã nhiệm vụ.** Trước đây chỗ này là một ô tích chỉ xuất hiện khi màn ĐANG MỞ đã có `stage_code` — tức là nó vắng mặt đúng vào lúc cần nhất: vừa nhập file xong, chưa màn nào mang mã nào, nên không có gì để tích và không có đường nào lọc.
- **Danh sách mã đọc từ KHO CÂU HỎI** (`GET /questions/codes`), không từ bảng `stages`/`quests`. Hai bên lệch nhau theo đúng cái chiều làm người dùng bí: ngay sau một lần nhập, kho đã có `W1-S1` mà chưa màn nào mang mã đó. Dựng ô chọn từ bảng `stages` thì nó rỗng đúng lúc nó cần đầy. Mã của màn đang mở luôn có mặt trong danh sách kể cả khi kho chưa có câu nào mang mã đó, nếu không thì ô chọn im lặng nhảy về "tất cả".
- **Mã nhiệm vụ thu hẹp theo mã màn đang chọn.** Một world nhiều màn có hàng trăm mã nhiệm vụ, và một danh sách dài như thế thì không chọn được bằng mắt.
- **Mỗi dòng hiện `quest_code` kèm `question_order`.** Khi đã lọc về một màn, đó là thứ duy nhất phân biệt hai mươi sáu câu trông na ná nhau. Mã màn chỉ hiện khi KHÔNG lọc theo màn — đang lọc rồi thì mọi dòng cùng một mã, và một cột giống hệt nhau chỉ ăn chỗ.
- **Đã lọc theo mã thì thứ tự là thứ tự TRONG ĐỀ** (`quest_code`, rồi `question_order`), không phải mới-nhất-trước như kho chung — xem `service.list_questions()`.

### Một trường khai báo mà quên điền thì KHÔNG có lỗi nào

`QuestionOut` khai báo `world_code / stage_code / quest_code / question_order` với mặc định `None`, và `to_out()` — chỗ duy nhất biến bản ghi thành phản hồi API — quên điền cả bốn. Pydantic dùng mặc định, FastAPI trả 200, OpenAPI sinh đúng kiểu, TypeScript biên dịch sạch. Cái duy nhất sai là dữ liệu: `null` cho mọi câu, kể cả câu vừa nhập từ file. Nhìn từ ngoài thì giống hệt như bộ nhập khẩu đã không ghi gì.

Chốt bằng một test đối chiếu `QuestionOut.model_fields` với `model_fields_set` của kết quả `to_out()`, nên một trường mới thêm vào schema mà quên điền sẽ đổ ngay — không cần ai nhớ ra để viết thêm test.

### Ánh xạ cột sang dạng câu hỏi

File có **hai** cột kiểu, và chúng trả lời hai câu hỏi khác hẳn nhau:

| cột | câu hỏi nó trả lời | đi vào |
|---|---|---|
| `answer_type` | học sinh **trả lời bằng cách nào** — chọn phương án, hay gõ chữ | `questions.type` (`MCQ_SINGLE`, `SHORT_ANSWER`…) |
| `question_type` | đề bài **đến với học sinh bằng cách nào** — đọc, hay nghe | `questions.prompt_kind` (`text`, `audio`) |

Hai trục **vuông góc** nhau, và đó là lý do chúng là hai cột chứ không phải một danh sách ghép. Một câu nghe rồi chọn phương án và một câu nghe rồi gõ chữ là cùng một cách ra đề với hai cách trả lời; nhồi thành `LISTEN_MCQ` / `LISTEN_SHORT` là nhân đôi số dạng mỗi lần thêm một cách ra đề, và mọi hàm chấm phải học thuộc gấp đôi số tên.

| `answer_type` | dạng | `content_json` | `answer_json` |
|---|---|---|---|
| `select` | `MCQ_SINGLE` | `prompt`, `options` (mã `"1"`..`"4"` theo **số cột**) | `correctOptionId` |
| `text` | `SHORT_ANSWER` | `prompt` | `accepted` (tách theo dấu phẩy) |

**`question_type` lạ thì BỎ QUA cả dòng**, không lặng lẽ hạ về `text`. Hạ xuống thì một bài nghe do người soạn cố ý viết ra sẽ thành một bài đọc, cả lớp làm xong mà không ai biết mình vừa làm sai đề. Bỏ qua kèm lý do thì sửa đúng một ô rồi nhập lại.

Mã lựa chọn giữ đúng **số cột** chứ không đánh lại theo thứ tự các ô có chữ: cột `accepted_answers` ghi số đó, nên một ô trống ở giữa mà đánh số lại sẽ làm mọi đáp án lệch một bậc mà không có gì báo.

### Xin giúp: một giá, trả một lần

`POST /play/runs/{run}/questions/{question}/hints/{kind}` trả đoạn chữ và trừ
`balance.energyCost.hint` năng lượng. Hai loại, MỘT giá:

- `translation` — bản dịch, nằm trong `answer_json`;
- `transcript` — lời thoại của câu nghe, tức `content.prompt`.

**Lời thoại bị GẠN KHỎI đề bài** trước khi gửi xuống máy học sinh: đã thu tiền
thì không được gửi kèm, không thì mở tab mạng của trình duyệt là đọc được miễn
phí. `build_snapshot` đặt `content.prompt = None` cho câu nghe — trừ khi giáo
viên đã bật `show_transcript`, vì khi đó chính họ quyết định câu này hiện chữ
sẵn và không còn gì để bán. `answer_key_json` thì giữ nguyên cả `content`, và đó
là chỗ endpoint đi lấy. Đọc từ `stage_runs.answer_key_json` — đề
bài đã đóng băng — chứ không hỏi lại bảng `questions`: giáo viên sửa bản dịch
giữa chừng thì lượt đang chơi vẫn đọc đúng cái nó bắt đầu, cùng luật với ảnh
nền, tiếng và bố cục hội thoại.

**Nhiệm vụ NPC thì miễn phí** (`_phase_of() == advisor`). Đó là màn khởi động,
và `_grant_energy()` chỉ chạy SAU KHI qua nó — nên ở đó học sinh luôn có 0 năng
lượng. Tính tiền là khoá gợi ý đúng chỗ họ cần nhất mà không cho đường nào kiếm
ra tiền để mở.

**Trả một lần, xem mãi.** `stage_run_players.hints_json` nhớ ai đã mua gì trong
lượt đó (`{"<question_id>": ["translation"]}`). Học sinh đóng bảng câu hỏi rồi
mở lại mà bị trừ tiếp là một cái bẫy, và cái duy nhất họ học được từ nó là đừng
bao giờ xin giúp nữa — tức đúng ngược cái mà năng lượng sinh ra để khuyến khích.

Một cột JSONB trên chính người chơi trong lượt đó, không phải một bảng riêng: nó
chỉ có nghĩa trong phạm vi một lượt, chết theo lượt, và không ai truy vấn ngược
nó bao giờ.

`POST` chứ không `GET`: nó TIÊU một thứ, mà một đường `GET` thì trình duyệt,
proxy hay một cú tải lại trang đều có quyền gọi lại mà không hỏi ai.

Đề bài mang `has_translation: bool` — chỉ cái CÓ hay KHÔNG, không mang chữ nào.
Giao diện cần nó để biết có nên vẽ cái nút Dịch: một cái nút bấm vào rồi báo
"câu này không có bản dịch" là đã tiêu mất một nhịp chú ý của người đang bí.

**`question_content_translation` đi vào `answer_json`, không vào `content_json`.** Cùng luật với `hint`: content bị đóng băng vào đề bài rồi gửi thẳng xuống máy học sinh, nên mọi thứ phải TRẢ BẰNG NĂNG LƯỢNG mới được xem đều không được nằm ở đó. Gửi kèm là phát không, và mở tab mạng của trình duyệt là thấy.

---

## 3c. CÂU HỎI NGHE — `prompt_kind` và transcript

Cách ra đề (`questions.prompt_kind`) nói **đề bài đến với học sinh bằng cách nào**, tách hẳn khỏi `questions.type` vốn nói **học sinh trả lời bằng cách nào** — xem bảng ở §3b.

- **`text`** (mặc định) — đề bài là chữ, y như trước khi có cột này. Mọi câu đang có đều rơi vào nhánh này, nên không câu nào đổi.
- **`audio`** — học sinh **nghe**. Trình phát hiện lên trên cùng câu hỏi, và **đoạn chữ của đề bị giấu sau nút "Transcript"**.

### Ba luật của transcript

1. **Transcript CHÍNH LÀ `content.prompt`.** Không có trường thứ hai. Một bản chép lời riêng là một bản sao có thể lệch với thứ đang phát, và không có gì bắt hai bên khớp nhau. Câu nhập từ file vì thế đã có sẵn transcript — chính là `question_content`.
2. **Nút Transcript LUÔN có; `show_transcript` chỉ quyết định nó MỞ SẴN hay không.** Mặc định đóng: nghe trước là cả điểm của bài nghe. Nhưng không khoá hẳn — một học sinh không nghe ra thì cần đường đọc lại, và một câu hỏi không giải mã nổi thì không đo được gì cả.
3. **Chỉ giấu ĐOẠN CHỮ CỦA ĐỀ, không bao giờ giấu phần tương tác.** Phương án trắc nghiệm, ô trống, ô nhập vẫn hiện nguyên. Giấu cái ô phải điền thì câu hỏi thành không làm được, chứ không thành khó hơn.

### Không có audio thì transcript hiện ra, bất kể `show_transcript`

`prompt_kind = 'audio'` + chưa tải audio + `show_transcript = false` = học sinh nhìn vào **một khoảng trống**. Server không chặn trạng thái đó — giáo viên phải đặt được cách ra đề trước rồi mới tải file lên, chứ không thì không có thứ tự thao tác nào hợp lệ. Nên chặn ở chỗ VẼ: không có audio thì đoạn chữ hiện ra như một câu `text` bình thường. Một câu hỏi thiếu file vẫn phải làm được.

Luật này nằm ở **một hàm dùng chung** (`resolvePrompt()`), không viết lại ở khung xem trước và ở màn học sinh — hai bản của cùng một luật thì có ngày giáo viên xem trước thấy một đằng, học sinh thấy một nẻo.

### Tự phát khi mở tới câu

Đến câu nghe thì audio **tự chạy**, không bắt bấm. Học sinh đã bấm rất nhiều lần trước đó (đi tới vật thể, mở bảng nhiệm vụ), nên trang đã có "user activation" và trình duyệt cho phát kèm tiếng.

Vẫn phải bắt lỗi `play()` bị từ chối: thanh điều khiển hiện sẵn nên bấm tay được, và **không có gì kẹt lại**. Cùng bài học với video nền (§3.1) — chỉ khác ở chỗ với audio thì không có "hình" để cứu, nên khi bị từ chối thì thứ phải còn lại là **cái nút bấm được**.

`questions.audio_max_plays` (số lần nghe lại, trừ năng lượng đội) đã có cột từ bản LMS nhưng **chưa nối vào đâu** — lần tự phát này không đếm, vì chưa có gì đếm.

### Bảng có tiếng mở ra thì cả màn chơi LÙI RA SAU

Nhạc nền của màn và đoạn ghi âm của câu hỏi phát ra cùng lúc, cùng cỡ âm lượng, và học sinh phải nghe ra một câu tiếng Anh giữa hai thứ đó. Nên khi mở một bảng **có tiếng**, mọi tiếng của màn hạ xuống còn **20%** (`DUCK_VOLUME`), và trả lại nguyên khi đóng bảng.

- **Hạ, không TẮT.** Cắt phăng nhạc nền mỗi lần mở câu hỏi thì cái im lặng đột ngột còn dễ nhận ra hơn cả bản nhạc, và học sinh tưởng game vừa đứng. Dừng rồi phát lại còn tệ hơn: bản nhạc nhảy về đầu mỗi lần, nên một màn sáu câu nghe là nghe đúng tám giây đầu sáu lần.
- **Hạ CẢ tiếng đứng/đi, không riêng nhạc nền.** Cái phải nghe rõ là đoạn ghi âm; một vòng lặp tiếng thở nền chồng lên nó đúng như bản nhạc chồng lên. Cùng mục đích thì cùng một cái van.
- **NHÂN vào âm lượng đang có, không thay nó.** Người chơi vặn nhỏ rồi thì lúc hạ phải nhỏ hơn nữa, chứ không nhảy lên mức của người khác. Ba tầng nhân vào nhau — giáo viên cân bản phối, người chơi vặn tổng, bảng câu hỏi lùi cả màn — và cả ba đi qua đúng một hàm (`StageScene.mixVolume`).
- **Chỉ bảng CÓ TIẾNG mới hạ.** Một câu trắc nghiệm chữ thì không có gì để ưu tiên, và hạ nhạc ở đó chỉ làm bản nhạc lên xuống suốt màn mà không ai hiểu vì sao. "Có tiếng" = nhiệm vụ có câu hỏi nghe, **hoặc** là nhiệm vụ NPC của một màn có ghi âm lời chia tay (§3d) — vế thứ hai dễ quên nhất, mà nó đúng là cái bảng có giọng người đang nói.
- **React quyết KHI NÀO, Phaser chỉ vặn van.** Cảnh không biết bảng nào đang mở, cũng không nên biết — cùng ranh giới với `QUEST_ZONE_ENTERED`.

---

## 3d. LỜI CHIA TAY CỦA NPC và SỔ TAY BÍ QUYẾT

Ba trường, một khoảnh khắc: học sinh trả lời xong câu cuối của nhiệm vụ NPC, và bảng hội thoại chuyển sang bước cuối — bước **không hỏi gì cả**.

| trường | hiện ở đâu | bỏ trống thì sao |
|---|---|---|
| `stages.advisor_outro_i18n` | lời NPC nói trên bảng Claim | bảng chỉ còn biểu tượng và cái nút |
| `stages.cluebook_title_i18n` | dòng đầu khi mở sổ tay | lùi về nhãn dịch chung ("Sổ tay bí quyết") |
| `stages.cluebook_i18n` | nội dung sổ tay | **biểu tượng 📖 không hiện ra** — nút bấm vào không bao giờ có gì thì tệ hơn là không có nút |

Đó là ba hậu quả KHÁC NHAU, và trình thiết kế nói thẳng từng cái ra thay vì để người dựng đoán từ một ô trống.

### Vì sao ba cột chứ không một

Lời chia tay là thứ NPC nói **một lần** lúc trao; sổ tay là thứ người chơi **mở ra đọc lại suốt màn**. Gộp làm một thì mỗi lần mở sổ tay lại phải đọc lại câu chia tay của thuyền trưởng. Tên sổ tay tách khỏi nội dung vì nó nói sổ tay này **của ai** — "CAPTAIN DRAKE'S SECRET HANDBOOK" thì mỗi màn một khác, còn "Sổ tay bí quyết" thì màn nào cũng giống màn nào.

### Lời chia tay có TIẾNG, và mặc định hiện CẢ HAI

`stages.advisor_outro_audio_media_id` — đoạn ghi âm NPC nói. Tự phát khi bảng hiện ra, đúng cơ chế của câu hỏi nghe (§3c) và dùng chung đúng một component.

**Mặc định `advisor_outro_show_transcript = true`, ngược với câu hỏi nghe.** Sự khác nhau đó có lý do, không phải một chỗ quên đồng bộ:

- Câu hỏi **nghe** giấu chữ vì đọc được đề thì bài nghe không còn đo gì nữa. Chữ ở đó là **đáp án của chính bài tập**.
- Lời NPC không phải bài tập. Nó là một nhân vật đang nói, và học sinh vừa nghe vừa đọc theo là cách học từ mới nhanh nhất. Giấu chữ đi chỉ để "cho giống câu hỏi" là bắt một đứa trẻ nghe hết ba câu tiếng Anh rồi tự đoán mình vừa được cho cái gì.

Nút thu gọn vẫn còn — người dựng nào muốn bắt nghe thuần thì tắt được, nhưng phải chủ động tắt.

---

## 3e. VIDEO MỞ MÀN — che lúc nạp, không phải một đoạn phim

`stages.intro_video_media_id` — `NULL` = **không có gì thay đổi so với trước**. Đó là mặc định, và nó phải là mặc định: 30 màn đã dựng không được tự dưng mọc thêm một bước bấm.

### Vì sao có nó

Bấm vào một màn rồi phải nhìn chữ "Đang tải…" là chỗ trải nghiệm gãy. Thời gian đó có thật và không bỏ đi được — gói Phaser gần một megabyte, ảnh nền có khi là video, spritesheet nhân vật bốn hướng, tiếng bước chân. Thứ bỏ đi được là **cái màn hình trống trong lúc chờ**.

Nên video mở màn không phải một tính năng kể chuyện gắn thêm. Nó là **tấm màn che đúng khoảng thời gian đó**, và mọi quyết định dưới đây đi theo đúng một câu ấy.

### Nạp NGAY, không đợi video xong

Lúc video bắt đầu chạy, ba việc chạy song song phía sau:

1. `import('phaser')` — chunk lớn nhất, và **không cần server trả lời gì** mới bắt đầu được.
2. `POST /play/stages/{id}/start` — lấy đề bài đóng băng.
3. Đề bài về tới nơi thì `StageScene` dựng luôn **ở dưới tấm màn**, `preload()` kéo ảnh nền, biểu tượng, spritesheet, tiếng.

Cảnh báo xong thì bắn `STAGE_READY`. Cửa vào màn mở khi **cả hai** đã xong: video hết VÀ cảnh sẵn sàng. Video hết trước thì đứng ở khung hình cuối và hiện một dòng chờ; cảnh xong trước thì im lặng đợi video — đó chính là trường hợp mong muốn, và là lý do 5–10 giây là con số đúng.

### Đồng hồ màn chơi CHẠY trong lúc xem

`stage_runs.started_at` đóng ở bước 2, tức là học sinh mất đúng số giây của video. Nói thẳng ra vì đây là một cái giá, không phải một chỗ quên:

Không hoãn được. Một lượt chơi là của **cả phòng** tối đa bốn người, `started_at` là một cột dùng chung — người thứ hai vào phòng mà xem intro rồi mới tính giờ thì họ vừa lùi đồng hồ của ba người kia. Còn nếu đợi video xong mới `start` thì mất sạch cái đang mua: đúng khoảnh khắc video tắt là lúc bắt đầu chờ mạng, tức là chuyển cái gãy sang chỗ khác chứ không sửa.

Vậy nên: video **ngắn**. 5–10 giây trên trần 300 giây là 2–3%. Người dựng đặt một đoạn 60 giây thì đó là lựa chọn của họ, và trình thiết kế nói trước con số đó.

### ĐANG CHƠI DỞ thì không chiếu

Vào lại một màn còn dở là **chơi tiếp**: bài đang làm còn nguyên, đồng hồ vẫn chạy từ `started_at` cũ. Chiếu lại đoạn mở màn ở đó là kể lại phần mở đầu cho người đã đi được nửa đường — và tệ hơn, nó ăn thêm giây của chính cái đồng hồ đang chạy, lần này chẳng đổi lấy gì cả (cảnh đã nạp một lần rồi, và các tệp còn trong bộ nhớ đệm).

Quyết ở **server**, trong chính `GET /play/stages/{id}/intro`: trả `null` khi người này có lượt còn dở. Nhờ vậy trình duyệt không tải một đoạn video rồi mới phát hiện ra mình không cần nó, và không có khung hình nào loé lên.

Dùng chung đúng một hàm với `start_run` — `resumable_run()`. Hai bản chép của luật "vào lại có chơi tiếp không" sẽ lệch nhau ở đúng trường hợp khó thấy nhất, lượt **vừa hết giờ**: bản này bảo còn dở nên không chiếu, bản kia thấy hết giờ nên mở lượt mới — và học sinh vào một lượt hoàn toàn mới mà không có gì mở màn.

### Luôn có đường thoát

- **Nút Bỏ qua** hiện suốt. Học sinh chơi lại lần thứ năm không phải xem lại lần thứ năm. Bỏ qua sớm mà cảnh chưa xong thì rơi về đúng màn hình chờ như trước khi có tính năng này — tức là không tệ hơn hiện trạng, chỉ là không tốt hơn.
- **Video hỏng thì đi tiếp ngay.** `onError`, và một mốc chờ tối đa cho trường hợp tệ hơn: file không bao giờ trả metadata. Một tấm màn không mở ra được là cách khoá học sinh ngoài màn chơi bằng chính thứ đáng ra làm nó mượt hơn.
- **Tiếng: thử bật, hỏng thì tắt tiếng và hiện nút.** Trình duyệt chỉ cho tự phát khi đã tắt tiếng, và cú bấm vào màn ở trang TRƯỚC không tính cho trang này. Nên luôn có một nút 🔊 chứ không bao giờ có một đoạn phim câm không giải thích được. Cùng luật với `CompactAudio` (§3c).

### KHÔNG nằm trong snapshot

Mọi thứ màn chơi vẽ đều lấy từ `stage_runs.snapshot_json` (§1.3). Video mở màn thì không, và đó là chủ ý: nó chạy **trước khi lượt chơi tồn tại** — phải biết URL để phát ngay, chứ không thể đợi chính cái request tạo ra snapshot.

Nó cũng không phải đề bài. Đóng băng đề bài là để giữa chừng người dựng sửa nội dung thì bài đang làm không đổi. Đoạn mở màn đã chạy xong trước khi có gì để đổi.

Nên nó đi đường riêng: `GET /play/stages/{id}/intro`, gọi lúc **render trang phía server**, song song với `/play/context` — không tốn thêm một nhịp chờ nào, và thẻ `<video>` đã nằm sẵn trong HTML của lần vẽ đầu tiên.

---

## 3f. HỘI THOẠI VỚI NGƯỜI CANH GIỮ — dữ liệu của màn S5

Mỗi nhiệm vụ là một cuộc nói chuyện, không phải một tờ bài tập. Phần nhìn thấy được mô tả ở [UI_META_SCREENS §S5](./UI_META_SCREENS.md); ở đây là dữ liệu đứng sau nó.

### Phần lớn cơ chế ĐÃ CHẠY

Trước khi thêm gì, ghi lại cho rõ những thứ không cần làm lại:

| Đã có | Ở đâu |
|---|---|
| Vòng hỏi–đáp từng câu, sai thì đứng lại, đúng thì sang câu chưa xong | `quest-panel.tsx` → `nextStep()`, đang chạy cho `phase = advisor` |
| Lời chê riêng cho từng câu | `content.wrong_answer_message`, đã có trong lược đồ câu hỏi |
| Miễn trần số lần thử cho nhiệm vụ NPC | `_grade_one` → `not is_gate` |
| Cộng điểm từng câu rồi so `pass_score` ở cuối nhiệm vụ | `submit_quest` |
| Nhật ký từng lần thử để dựng lại hội thoại | `quest_answers` (`attempt_no`, `response_json`, `is_correct`) |
| Câu đang gõ dở | `quest_drafts` |
| Ảnh đại diện nhân vật người chơi | `characters.avatar_media_id`, có sẵn ô tải kèm cropper |
| Khối kéo–thả–đổi-cỡ có ảnh nền và khung nội dung | `LobbySaved` trong `web/src/game/world.ts` |

Việc thật là **mở vòng của nhiệm vụ NPC ra cho mọi nhiệm vụ**, cộng ba mẩu dữ liệu dưới đây.

### Luật số lần thử — chỉnh số, không sửa code

```
balance_json.maxAttemptsPerQuestion   3  ->  2
balance_json.attemptPenalty     [1.0, 0.6, 0.3]  ->  [1.0, 0.6]
```

Nghĩa là: sai **một** lần được làm lại; sai lần thứ hai thì người canh giữ chuyển sang câu khác, câu đó 0 điểm. Đúng ngay lần đầu ăn đủ điểm, đúng ở lần hai còn 60%.

Nhiệm vụ NPC không chịu trần này — không qua nó thì cả màn đứng lại.

**Sai đến hết lượt vẫn KHÔNG lộ đáp án.** Đây là chỗ dễ bị "cho tử tế một chút" nhất, nên viết ra: ba người ngồi cạnh có thể chưa làm tới câu đó, và một đáp án đọc được là một lần chơi lại mất nghĩa. Cùng lý lẽ với §1.6 và với việc hoãn màn xem lại bài.

### `stages.dialogue_json` — bố cục, một bộ cho cả màn

Cùng hình dạng với `worlds.lobby_json`, sáu khối:

```
npcAvatar · npcBubble · playerBubble · npcVerdict · playerAvatar · answerBox
```

Người canh giữ có tối đa **hai** bong bóng — câu hỏi (`npcBubble`) và lời phán đúng/sai (`npcVerdict`, đứng ngay dưới bong bóng của học sinh) — còn học sinh có **một**. Vì sao tách làm hai: xem [UI_META_SCREENS §S5b](./UI_META_SCREENS.md).

Mỗi khối là một `LobbySaved`: `x`, `y`, `w`, `h`, `media_id` (ảnh nền của khối), và `content` — khối con thật sự vẽ chữ, mang `x`, `y`, `w`, `h` **tính bằng phần trăm của khối cha**, cộng `color` và `font`.

Phần trăm chứ không phải pixel, vì kéo bong bóng to ra thì chữ phải to theo cùng nhịp; lưu pixel là mỗi lần đổi cỡ khối phải căn lại chữ. Lý lẽ đầy đủ ở chú thích `LobbyContentSaved`.

**`NULL` = kế thừa bố cục của màn ĐẦU TIÊN trong world** — đúng nếp `character_height`. Căn một lần ở màn 1, cả world theo, và sửa lại màn 1 sau đó vẫn lan xuống. Không sao chép giá trị xuống từng màn lúc tạo: sao chép là mất đúng cái đó.

Cột khai báo `JSONB(none_as_null=True)`, không để mặc định. Mặc định của SQLAlchemy biến `None` của Python thành JSON `null` — một GIÁ TRỊ nằm trong ô, không phải một ô rỗng. Đọc thì vẫn ra `None` nên không ai thấy gì, cho tới ngày có người viết `WHERE dialogue_json IS NULL` và câu đó trả về sai. Cùng lý do cho `collision_json`.

**URL ảnh nền của từng khối đi RIÊNG**, trong `dialogue_urls`, cùng nếp `audio_urls`: khối lưu `media_id` chứ không lưu URL — id thì bền, URL thì đổi khi kho ảnh đổi — nên server tra một lượt cho cả sáu khối (`worlds/service.py::block_urls`, dùng chung với khối phòng chờ). Trong đề bài đóng băng thì URL cũng đóng băng, vì đổi file giữa chừng thì hai máy đang chơi cùng màn sẽ thấy hai thứ khác nhau.

Lưu ở MÀN chứ không ở nhiệm vụ vì một màn có một bộ mặt. Năm nhiệm vụ nhân ba mươi màn là 150 lần căn tay cho một world — sẽ không ai làm hết, và world sẽ có 150 màn hội thoại lệch nhau.

### `characters.voice_id` — giọng đọc của nhân vật

Trỏ vào `voices`, một **bản sao danh mục** giọng lấy về từ nhà cung cấp. Một cột
cho CẢ HAI vai: nhân vật học sinh và người canh giữ đều là một dòng `characters`,
nên cả hai gán giọng bằng cùng một chỗ.

Bản sao chứ không gọi thẳng: nếu mỗi lần mở ô chọn giọng lại phải gọi ra
ElevenLabs thì màn hình đứng chờ vài giây, và một sự cố mạng bên họ là không ai
đặt được giọng cho nhân vật nào. Đồng bộ bằng tay qua `POST /voices/sync` — danh
mục giọng gần như không đổi, và một tác vụ nền âm thầm gọi API tính tiền là thứ
không ai nhớ mình đã bật.

Đồng bộ là CẬP NHẬT theo khoá `(provider, external_id)`, không xoá-rồi-nạp-lại:
nhân vật đang trỏ vào những dòng đó, và thay `id` của một giọng là gỡ giọng khỏi
mọi nhân vật đang dùng nó. Giọng nhà cung cấp đã bỏ thì Ở LẠI trong kho — nhân
vật đang dùng vẫn nói được bằng chính mã đó.

`provider` là chuỗi TỰ DO, không phải enum. Thêm minimax hay gemini-tts là thêm
một lớp trong `modules/voices/providers.py` cộng một dòng trong `PROVIDERS` —
không migration, không sửa giao diện, vì danh sách dịch vụ đi xuống client qua
`GET /voices/providers`.

Chỉ đồng bộ giọng **tiếng Anh** (`labels.language == "en"`). Tài khoản có cả
giọng tiếng Việt, mà game này dạy tiếng Anh — kéo hết về là bắt người dựng cuộn
qua ba mươi giọng họ không bao giờ dùng.

`preview_url` trỏ THẲNG sang nhà cung cấp, không qua kho media: nó là tài sản
của họ, đổi khi họ đổi, và tải về là giữ một bản sao sẽ cũ đi.

### `question_audios` — tiếng đọc, khoá theo GIỌNG

Một dòng là `(câu hỏi, giọng, chỗ cần đọc)`. Hai chỗ được đọc:

| `target` | đọc gì | giọng của ai |
|---|---|---|
| `prompt` | đề bài | NGƯỜI CANH GIỮ của nhiệm vụ |
| `option` | một phương án trả lời | NHÂN VẬT HỌC SINH người dựng chọn |

**Khoá theo giọng, không theo màn chơi.** Cùng một câu hỏi lắp vào world khác,
màn khác, người canh giữ khác — nếu cùng giọng thì bản thu cũ dùng lại được
ngay, không tốn thêm một lượt gọi API nào. Giọng khác thì coi như chưa có, vì
đúng là chưa có: một câu đọc bằng giọng nam trung niên không thay được cho giọng
nữ trẻ. Khoá theo màn thì mỗi màn một bản sao của cùng một file, và tiền trả cho
nhà cung cấp nhân lên theo số màn dùng lại câu hỏi đó.

**Nhiều giọng cho PHƯƠNG ÁN.** Phương án là thứ học sinh nói ra, mà học sinh nào
cũng vào màn bằng nhân vật của mình. Sinh cho một giọng rồi thì em chọn nhân vật
khác sẽ gặp một khoảng im — nên người dựng chọn TRƯỚC những nhân vật cần phủ, và
mỗi giọng một bản.

Chỉ câu **có phương án để chọn** mới sinh phần đáp án. Câu gõ chữ thì thứ học
sinh nói ra là thứ họ tự nghĩ, không đọc sẵn được.

#### Ô trống đọc thành một tiếng BÍP

Để nguyên `{{1}}` thì máy đọc ra "dấu ngoặc nhọn một". Thay bằng chữ `blank` thì
lời đề mọc thêm một từ tiếng Anh học sinh phải học cách bỏ qua. Cả hai đều dạy
nhầm, nên chỗ khuyết **không** đi qua máy đọc chữ nữa:

1. Cắt lời đề tại mỗi ô trống — `"The gate is made of {{1}} and {{2}}."` ra
   `["The gate is made of", ␣, "and", ␣]`. Khúc chỉ có dấu câu thì bỏ; gửi một
   dấu chấm sang nhà cung cấp là trả tiền cho một tiếng thở.
2. Đọc các khúc chữ **cùng một lượt**, xin về **PCM thô** thay vì mp3.
3. Chèn tiếng bíp — 880 Hz, 500 ms, có vuốt hai đầu và khoảng lặng hai bên — rồi
   gói tất cả thành **WAV**.

**Ô trống viết bằng hai cách, và phải nhận cả hai.** `{{1}}` là mã ô của câu
`GAP_FILL` do trình soạn sinh ra; `___` là thứ người soạn gõ tay thẳng vào lời đề
của câu trắc nghiệm — và trong kho hiện tại cách thứ hai ĐÔNG HƠN (11 câu so với
2). Bỏ sót một cách thì không có lỗi nào ném ra: câu vẫn sinh được audio, chỉ là
máy đọc nguyên mấy cái gạch dưới. Gạch dưới GIỮA TỪ (`text_file`) không tính —
phải từ hai gạch liền trở lên.

**Các khúc đi cả loạt xuống nhà cung cấp, không phải từng cái một.** Đọc rời thì
`"The team"` bị hạ giọng ở cuối như đã hết câu và `"Orion yet."` mở đầu như vừa
hít vào — ghép lại nghe rời rạc. ElevenLabs có sẵn ba tham số cho đúng bệnh này:
`previous_text` / `next_text` (chữ đứng trước và sau, KHÔNG đọc ra, chỉ để biết
câu đang đi tới đâu) và `previous_request_ids` (tối đa ba mã lượt gần nhất, để
nối đúng hơi và cao độ của tiếng vừa sinh chứ không chỉ đoán từ chữ). Vì thế
`speak_parts()` nhận cả danh sách khúc, chứ không phải `speak()` gọi nhiều lần.

Xin PCM vì nối hai file mp3 bằng cách dán byte thì mối nối không rơi đúng biên
khung: lúc chạy, lúc ra tiếng lụp bụp, tuỳ trình duyệt. PCM thì mỗi mẫu là một
con số, và `wave` của thư viện chuẩn gói lại — không thêm ffmpeg, không thêm gói
ngoài. Đổi lại WAV nặng hơn mp3 chừng mười lần, chấp nhận được vì **chỉ câu điền
khuyết** đi đường này; câu thường vẫn một lần gọi, vẫn ra mp3.

Độ to của bíp **bám theo giọng vừa đọc**, không phải một con số cố định: đo trên
hai giọng thật của cùng nhà cung cấp cho ra 1800 và 5000 RMS — gần ba lần. Một
mức tuyệt đối thì hoặc chìm dưới giọng này, hoặc quát vào tai người nghe giọng
kia. Câu chỉ có mỗi ô trống thì không gọi nhà cung cấp lần nào: chẳng có chữ nào
để đọc, và tiếng bíp là của ta.

Trên màn hình người dựng, ô trống hiện thành một vệt `▁▁▁` — không phải chữ, nên
không phải dịch.

#### Gọi nhà cung cấp: HỒ BƠI LUỒNG, và giữ phần làm được

ElevenLabs **không có API gộp lô** — mỗi câu một request. Tám mươi câu gọi nối
đuôi nhau là tám mươi lượt đi về, mỗi lượt một hai giây: vài phút chờ, và đủ lâu
để proxy cắt request giữa chừng.

Nên phần gọi mạng chạy song song, chặn bởi `ELEVENLABS_CONCURRENCY` (mặc định
**5**). Là một **hồ bơi luồng**, không phải từng đợt: luồng nào xong nhận câu
tiếp ngay. Chia đợt mười câu rồi chờ đủ mới sang đợt sau thì cả đợt đứng chờ câu
chậm nhất — một câu dài kéo chín câu ngắn đứng im.

Năm vì trần số request đồng thời của nhà cung cấp thấp hơn người ta tưởng và
thay đổi theo hạng tài khoản. Đặt quá tay không vỡ mẻ: gặp `429` thì lùi theo cấp
số nhân, tôn trọng `Retry-After`, thử tối đa bốn lần — cái giá chỉ là chậm.

Chỉ phần GỌI MẠNG song song. Lưu file và ghi database vẫn tuần tự: một phiên
SQLAlchemy không dùng được từ nhiều tác vụ cùng lúc.

**`return_exceptions=True` là phần bắt buộc.** Không có nó thì câu thứ bốn mươi
hỏng là `gather` huỷ cả mẻ — ba mươi chín câu đã đọc xong, đã trả tiền, chưa kịp
lưu, mất sạch. Có nó thì giữ được bao nhiêu lưu bấy nhiêu rồi báo số hỏng; bấm
lại lần sau thì `existing_lines` thấy phần đã lưu và bỏ qua, tức **chỉ chạy lại
phần hỏng** — không cần một nút riêng nào cho việc đó.

`GET /voices/health` kiểm tra dịch vụ mà **không tốn một ký tự nào**: chỉ hỏi
thông tin tài khoản. Phân biệt được ba thứ trước đây hiện ra y hệt nhau — chưa
đặt khoá, khoá sai, mạng không tới — và kèm số ký tự **còn lại**, thứ đáng biết
trước khi bấm sinh cả mẻ.

#### LỜI PHÁN — chữ của WORLD, tiếng của từng NGƯỜI CANH GIỮ

`worlds.verdict_json` có **TÁM nhóm**, xếp theo đúng thứ tự chúng xảy ra:

| nhóm | khoảnh khắc | trước đây |
|---|---|---|
| `greet` | học sinh vừa tới, trước đề bài đầu | **im lặng** |
| `praise` | trả lời đúng | có |
| `wrong` | sai, còn lượt | có |
| `moveOn` | hết lượt, bỏ câu | có |
| `next` | đúng rồi, nối sang câu sau | **im lặng** |
| `passed` | hết câu và ĐẠT điểm sàn | chung một câu |
| `failed` | hết câu nhưng KHÔNG đạt | chung một câu |
| `revisit` | đi ngang nhiệm vụ đã xong | có |

Bốn ô "im lặng"/"chung một câu" là chỗ cuộc trò chuyện hụt hơi: khen xong thì đề
bài mới hiện ra không một lời nối, và làm xong cả nhiệm vụ thì người đạt lẫn
người trượt nghe **đúng cùng một câu**.

`VERDICT_GROUPS` bên `tts.py` phải khớp `FALLBACK` bên `quest-panel.tsx`: thiếu
một nhóm ở danh sách kia là nhóm ấy không bao giờ được sinh tiếng, và màn chơi im
lặng đúng vào lúc đó mà không báo gì.

#### Không lặp câu TRONG CÙNG một nhiệm vụ

`pickLine` băm theo từng câu hỏi, nên hai câu liền nhau vẫn có thể rơi trúng cùng
một chỉ số. Đo trên mười câu hỏi với mười biến thể: chỉ ra **7 câu riêng biệt**,
tức ba lần nghe lại câu vừa nghe.

`pickDistinct` lấy một **điểm xuất phát** và một **bước nhảy**, cả hai băm từ
hạt giống, rồi đi tới theo thứ tự câu hỏi.

Hạt giống là `run.id : user.id : quest.id : nhóm`. Ba đòi hỏi kéo ngược chiều
nhau, và ba mảnh này giải đúng từng cái:

| đòi hỏi | mảnh giải |
|---|---|
| vào lại giữa chừng nghe đúng câu đã nghe | cố định suốt một lượt |
| chơi lại nghe dãy khác | `run.id` đổi mỗi lượt |
| hai bạn cùng lớp nghe khác nhau | `user.id` |
| không lặp trong một nhiệm vụ | bước nhảy **nguyên tố cùng nhau** với `n` |

Nguyên tố cùng nhau là điều kiện BẮT BUỘC, không phải làm đẹp: bước 2 trên mười
câu chỉ chạm được năm câu rồi quay vòng, và lời hứa "không lặp" gãy.

Đo trên mười biến thể: **40 dãy khác nhau** (10 điểm xuất phát × 4 bước hợp lệ:
1, 3, 7, 9). Sáu lượt chơi lại ra sáu dãy khác nhau; gọi lại ba lần trong cùng
một lượt ra y hệt nhau.

`Math.random()` hỏng ngay ở đòi hỏi thứ nhất: mở lại bảng là người canh giữ nói
một câu khác cho cùng một lần thử, mà học sinh thì nhớ họ đã nói gì.

Câu chê cộng thêm số lần thử, nên sai hai lần cùng một câu cũng nghe hai câu chê
khác nhau.


`worlds.verdict_json` = `{"praise": [...], "wrong": [...], "moveOn": [...]}`.
Rỗng = dùng bộ 12 câu mặc định trong `messages/`, tức mọi world đang chạy không
đổi gì.

**Chữ ở world** vì đây là giọng điệu của cả thế giới ấy, không phải phản hồi cho
một bài cụ thể. Đặt ở từng câu hỏi thì một world trăm câu là trăm chỗ phải gõ
cùng một giọng điệu. Câu chê CHỈ hợp với một bài thì đã có
`content_json.wrong_answer_message` — nó thắng bộ của world.

**Tiếng theo từng nhiệm vụ** vì mỗi nhiệm vụ một người canh giữ, mỗi người một
giọng. Nhưng bản thu khoá theo `(voice_id, băm của đoạn chữ)` trong bảng
`voice_lines`, nên:

- Hai nhiệm vụ khác nhau, hai người canh giữ khác nhau, **cùng một giọng** → bản
  thu dùng lại, bấm sinh chỉ báo "đã có sẵn", không tốn một xu.
- Sửa chữ một câu → băm đổi → chỉ câu ấy cần thu lại. Bản thu cũ tự khắc không
  còn khớp với câu nào, không cần ai đi dọn.

Khoá theo `(world, vị trí trong danh sách)` thì mất cả hai tính chất: đổi chữ mà
bản thu cũ vẫn được phát, và người canh giữ nói một câu không còn trên màn hình.

Đề bài đóng băng mang theo **cả ba nhóm** (`snapshot.quests[].verdict`) chứ không
gộp phẳng — màn chơi chọn câu theo nhóm. Kèm `verdict_audio` là bảng
`câu chữ → URL`, đã tra sẵn theo giọng của chính người canh giữ ấy.

**Có tiếng thì chờ nghe hết mới sang bong bóng sau.** Không chờ thì câu tiếp
theo hiện đè lên tiếng đang nói. Có trần 12 giây: trình duyệt chặn tự phát hay
tệp hỏng thì cuộc trò chuyện vẫn phải đi tiếp — im lặng đứng mãi là hỏng nặng
hơn chồng tiếng.

#### Lời chia tay sinh giọng ở NHIỆM VỤ NPC

`stages.advisor_outro_audio_media_id` là tiếng của **màn**, nhưng nút sinh nó nằm
ở panel giọng đọc của **nhiệm vụ NPC** — `POST /quests/{id}/outro-audio`.

Vì hai lẽ. Thứ nhất, giọng đọc nằm ở người canh giữ, mà người canh giữ nằm ở
nhiệm vụ: bắt màn tự đi tìm "nhiệm vụ nào có NPC" là chép lại một luật đã có chỗ
của nó. Thứ hai, đó đúng là khoảnh khắc lời chia tay vang lên — qua được nhiệm vụ
NPC, nghe lời chia tay, rồi nhận sổ tay. Cùng một người nói cả đề bài lẫn lời
chia tay, nên hai nút ở cùng một chỗ.

Chỉ nhiệm vụ NPC. Nhiệm vụ thường cũng gán được người canh giữ, nhưng lời chia
tay chỉ vang lên đúng một lần trong màn, ở cổng vào — hiện nút ở mọi nhiệm vụ thì
cùng một đoạn tiếng xuất hiện bảy lần trong một màn bảy nhiệm vụ.

**Không** vào `question_audios`: đây không phải một câu hỏi, và cũng không cần
kho tái dùng theo giọng — mỗi màn một lời chia tay riêng, không có chuyện lắp lời
này sang màn khác. Nó đi qua đúng `speak()` như mọi đoạn chữ khác, nên một ô
trống trong đó cũng ra tiếng bíp, và file rơi vào `stage-outro` — cùng thư mục
với tệp người dựng tự tải lên ở bảng sổ tay.

Đọc bản **tiếng Anh** của `advisor_outro_i18n`. Người canh giữ nói tiếng Anh kể
cả khi học sinh xem giao diện tiếng Việt; chữ tiếng Việt cạnh trình phát là bản
dịch để đọc theo, không phải lời thoại.

#### Một câu, MỘT tiếng đọc đang dùng

`questions.audio_media_id` là bản thu **đang dùng** — thứ ô tệp nghe hiện và thứ
học sinh nghe. `question_audios` **không** phải một danh sách song song để chọn
giữa: nó là cái KHO, nhớ lại "câu này từng được thu bằng những giọng nào", để
lắp câu vào màn khác với cùng giọng thì không phải thu lại.

Hai vai này từng bị lẫn, và hậu quả nhìn thấy được: một câu đã có tệp giáo viên
tự tải lên, rồi sinh thêm tiếng máy đọc, thì popup hiện HAI trình phát với HAI
nội dung khác nhau và không cái nào nói nó là cái đang dùng. Người dựng nghe thử
cái này, học sinh nghe cái kia.

Nên:

- Sinh xong → bản vừa sinh thành bản đang dùng.
- Bấm sinh mà **đã có sẵn** bản thu đúng giọng đó → không gọi nhà cung cấp,
  không tốn một xu, nhưng vẫn trỏ `audio_media_id` sang nó. "Sinh tiếng đọc" với
  người dựng nghĩa là *cho câu này nói bằng giọng ấy*; bấm xong không có gì đổi
  thì họ chỉ biết là nút hỏng.
- Giao diện chỉ có MỘT trình phát. Danh sách giọng đã thu là những cái **chip**
  đánh dấu cái đang dùng, bấm là đổi — đổi thì miễn phí, vì bản thu đã có sẵn.

#### Sinh giọng CŨNG LÀ tải file lên

Tiếng **đề bài** vừa sinh được gắn thẳng vào `questions.audio_media_id` — chính
cột mà ô tải tệp nghe đọc, và chính cột mà đường chơi phát cho học sinh.

Với người dựng, "tải lên một file mp3" và "bấm nút sinh giọng" là cùng một việc:
sau cả hai, câu này phải CÓ tiếng để học sinh nghe. Không nối hai chỗ lại thì
file nằm trong kho `question_audios` mà ô tải lên vẫn kêu *"chưa có tệp nghe"*,
còn học sinh thì vẫn chỉ đọc chữ — hai kho tiếng cho cùng một câu, và không cái
nào nói cho ai biết cái kia tồn tại.

Chỉ đề bài. Phương án không có cột nào tương ứng trên câu hỏi, và cũng không nên
có: chúng thuộc về từng phương án, không thuộc về cả câu.

**KHÔNG nhét vào `content_json`.** Cột đó bị đóng băng vào đề bài rồi gửi thẳng
xuống máy học sinh; audio thì sinh sau, sinh dần, và sinh lại được — nhét vào đó
là mỗi lần sinh một file lại phải sửa nội dung câu hỏi mà giáo viên đang soạn.

Ba mức sinh — `/questions/{id}/audio`, `/quests/{id}/audio`, `/stages/{id}/audio`
— mỗi mức có `GET` xem tình trạng và `POST` để sinh. `GET` là phần bắt buộc:
giao diện phải biết trước "đã có tiếng chưa" để còn hỏi *"tạo lại không?"*, mà
hỏi sau khi đã gọi API là hỏi sau khi đã tiêu tiền. Mức MÀN bỏ qua nhiệm vụ chưa
có giọng và kể tên ra; mức NHIỆM VỤ thì báo lỗi — bấm vào đúng một nhiệm vụ mà
nó im lặng không làm gì là tệ hơn.

### Người canh giữ là một NHÂN VẬT, không phải một tấm ảnh

`quests.npc_character_id` → `characters`. `NULL` = chưa gán ai; hội thoại vẫn chạy với khung avatar trống.

Ban đầu chỗ này là một cột ảnh chân dung tĩnh. Nhưng người canh giữ cần **nhiều tư thế** — một lúc đang nói, một lúc đang chờ học sinh trả lời — và nhân vật của học sinh còn nhiều hơn. Bảy tấm, tất cả đều là spritesheet để chạy được hoạt ảnh.

Đó đúng là thứ `character_actions` đã làm từ lâu, và chú thích trong model đã nói trước:

> `action_key` là chuỗi **TỰ DO** ("idle", "walk", "run", "jump", "talk"…), không phải enum: thêm một hành động mới là việc của người dựng nội dung, **không phải của một migration**.

Nên bảy tư thế là bảy `action_key` mới — không tốn cột nào, không tốn migration nào, và dùng lại nguyên ô tải spritesheet của màn quản lý nhân vật.

| vai | tư thế |
|---|---|
| `npc` | `say` · `wait` |
| `player` | `listen` · `think` · `answer` · `right` · `wrong` |

Tên nằm ở `DIALOGUE_POSES` trong `web/src/game/character.ts`, cạnh `ACTION_SUGGESTIONS` — cùng một loại thứ, cùng một chỗ.

**Ba nấc lùi khi thiếu ảnh**, dừng ở nấc đầu tiên có: tư thế đang cần → tư thế NGHỈ của vai đó (`wait` / `listen`) → `characters.avatar_media_id`. Người dựng tải đúng **một** tấm cũng đã có hội thoại chạy được, và tải thêm tấm nào thì tấm đó tự nhận việc. `frames = 1` vốn đã hợp lệ, nên một ảnh tĩnh chỉ là spritesheet một khung.

### `characters.kind` — một bảng, hai vai trò

`'player'` (mặc định) hoặc `'npc'`.

Không tách bảng `npcs` riêng: cả hai vai dùng **chung toàn bộ** bộ máy spritesheet — tải ảnh, cắt khung, xem trước, đổi `frame_rate`. Tách ra là chép cả bộ đó lần thứ hai, rồi hai bản lệch nhau ở đúng chỗ ai đó sửa một bên.

Cái giá: mọi chỗ liệt kê nhân vật cho học sinh **chọn** phải lọc `kind = 'player'`. Trong mã nguồn hiện có đúng bốn chỗ gọi `select(Character)`, và chỉ một trong số đó là danh sách để chọn (`/worlds/{id}/characters`) — nên cái giá đó đếm được, và nó nhỏ.

`stages.advisor_portrait_media_id` giữ nguyên, nhưng từ đây nó là di sản: nhiệm vụ NPC cũng gán người canh giữ qua `npc_character_id` như mọi nhiệm vụ khác.

Ảnh nền của cuộc hội thoại **không có cột mới**: mặc định là `stages.background_media_id`. Cuộc nói chuyện diễn ra đúng chỗ học sinh đang đứng, và không ai phải tải thêm ảnh.

Tấm nền của CẢNH CHƠI thì Phaser tự nạp, và nạp hỏng thì **thử lại đúng một lần** (`retryBackground()`). Nền là một file có thể vài megabyte; một lượt tải trượt — mạng trường học chập chờn, server vừa khởi động lại — thì học sinh chơi hết cả màn trên một khung hình đen, không có nút nào để thử lại và không có gì nói cho họ biết chuyện gì vừa xảy ra. Một lần chứ không phải vòng lặp: file hỏng thật thì thử mãi cũng thế, mà mỗi lần là thêm vài megabyte trên đường truyền vốn đã yếu.

Màn HỘI THOẠI thì **không vẽ ảnh nền nào cả**: nó là một tấm bảng trong suốt phủ lên chính cảnh Phaser đang chạy. Vẽ thêm một tấm nền nữa lên trên cảnh là che mất đúng chỗ học sinh đang đứng — mà cả màn hội thoại dựng lên là để cuộc trò chuyện diễn ra TRONG cảnh đó.

Hệ quả cho trình thiết kế: nó không có cảnh Phaser nào phía sau, nên nó tự vẽ ảnh nền của màn DƯỚI tấm bảng (`BackgroundLayer`, ghim khung hình đầu). Không có nó thì giáo viên căn bong bóng trên một khoảng đen và không biết chữ của mình sẽ nằm đè lên cái gì.

### Lời của NPC chọn theo HASH, không phải ngẫu nhiên

Ba tập câu ở `messages/` — chào, khen, chê — cộng đường ghi đè `content.wrong_answer_message` cho từng câu.

Chọn câu nào thì tính từ `hash(question_id, attempt_no)`, **không** `Math.random()`. Hệ quả: học sinh thoát ra vào lại thấy đúng cuộc hội thoại đã diễn ra, chứ không phải một bản khác mang cùng nội dung.

Để làm được thế, `QuestionProgress` mang thêm **`attempts_used`** — số dòng `quest_answers` của chính người này cho câu đó. Không suy được từ `attempts_left`: trường đó là `null` ở nhiệm vụ NPC, mà nhiệm vụ NPC lại đúng là chỗ người ta thử nhiều lần nhất.

Đó cũng là lý do **không cần lưu transcript**. `quest_answers` đã giữ đủ để dựng lại từng lượt hỏi–đáp kể cả những lần sai; lưu thêm khung chat nghĩa là một lượt ghi database cho mỗi tin nhắn, để đổi lấy một kết quả y hệt.

### `RunOut.character` phải gửi thêm `avatar_url`

Hiện chỉ có `id`, `name_i18n`, `sprites`. Bong bóng bên phải cần khuôn mặt, mà `characters.avatar_media_id` thì đã có sẵn từ lâu — chỉ chưa ai đưa nó xuống đường này.

---

## 4. Bảng và code copy từ LMS

`⭐` = copy sang `api/`, không viết lại từ đầu. Chi tiết mức độ copy: [ARCHITECTURE §5](./ARCHITECTURE.md).

| Nguồn | Dùng làm gì trong game | Cần sửa gì |
|---|---|---|
| ⭐ bảng `questions` | Nội dung mọi nhiệm vụ và mọi bước hội thoại NPC | Bỏ `tenant_id`. Mở rộng `QuestionType.ALL` khi thêm dạng mới |
| ⭐ bảng `media_assets` | Background màn, chân dung NPC, audio NPC, ảnh hành tinh | Bỏ `tenant_id` |
| ⭐ `grading/graders.py` | Chấm từng nhiệm vụ | **Copy 100%** — không import gì ngoài stdlib. Thêm grader đợt 2 sau |
| ⭐ `grading/normalize.py` | Chuẩn hoá text tiếng Anh học sinh gõ/nói | **Copy 100%** — thay thẳng cho `String.includes()` hiện tại |
| ⭐ `questions/schemas.py` | Kiểm tra hợp lệ content/answer/response từng dạng | ~90% |
| ⭐ `questions/service.py` | Che đáp án khi trả về client | Giữ logic che đáp án, thay `apply_scope()` bằng `require_role()` |
| ⭐ `attempts/scoring.py` | Cộng dồn điểm một lượt chơi → Điểm chiến lực | Hàm thuần trên `(answer_key, responses)`, sửa ít |

**Bảng `users`:** viết mới, đơn giản — `id, email, password_hash, display_name, role, avatar_media_id, status`. Không copy hệ RBAC động của LMS.

---

## 5. Ánh xạ luật chơi → nơi cưỡng chế

Mỗi luật trong tài liệu thiết kế phải có **đúng một chỗ** chịu trách nhiệm:

| Luật | Cưỡng chế ở đâu |
|---|---|
| Tối thiểu 4 nhiệm vụ / màn | Kiểm tra lúc `publish` stage (service), không phải lúc chơi |
| Mọi thành viên hoàn thành ≥1 nhiệm vụ mới xong màn | Service kết thúc màn, đọc `quest_answers` nhóm theo `user_id` |
| Mỗi người nộp riêng, chấm riêng | `UNIQUE (stage_run_id, user_id, quest_id)` ở database |
| Sai thì được thử lại | Ghi thêm dòng `quest_answers` với `attempt_no` tăng dần |
| Đúng rồi thì không ăn điểm lần hai | `UNIQUE (stage_run_id, user_id, quest_id) WHERE is_correct` |
| Không nộp trùng do bấm hai lần | `UNIQUE (stage_run_id, user_id, quest_id, attempt_no)` |
| Trần số lần thử mỗi CÂU | Service đếm dòng, so với `balance_json.maxAttemptsPerQuestion` |
| Trong trận không lộ điểm/đáp án/giải thích | Schema phản hồi của endpoint nộp bài **không có** các trường đó |
| Xem chi tiết chỉ khi màn đã kết thúc | `GET /play/runs/{id}/review` chặn nếu `status == "playing"` |
| Không xem được bài của người khác | `review` lọc `quest_answers.user_id == current_user.id` |
| Bài làm không lộ sang máy khác | Bản tin WebSocket chỉ mang `completed`, không mang `response_json` |
| Giáo viên chơi thử không làm bẩn số liệu | `stage_runs.is_trial = true` + mọi báo cáo lọc `users.role = 'student'` |
| Học sinh không vào nhầm phòng thử | Danh sách phòng công khai lọc bỏ phòng có `is_trial` |
| Học sinh không thấy world/màn nháp | `visible_worlds(user)` — một chỗ duy nhất, xem [ARCHITECTURE §7](./ARCHITECTURE.md) |
| Mảnh bản đồ trao khi **hoàn thành TẤT CẢ nhiệm vụ** của màn, cho **tất cả** thành viên | Service kết thúc màn → ghi `map_shards_owned` cho từng người |
| Mảnh nào thuộc màn nào | `stages.map_shard_index` — **không** có cờ trên nhiệm vụ |
| 30 mảnh phải **khác nhau** | `UNIQUE (world_id, user_id, shard_index)` ở database |
| Năng lượng dùng chung cả đội | `stage_runs.team_energy_remaining` — **một** con số duy nhất |
| Hết năng lượng = cả đội thua | Service trừ năng lượng, khi `<= 0` thì đặt `status = "lost_energy"` |
| Điểm chiến lực riêng theo world, bắt đầu 0 | `world_progress.skill_pts`, mặc định 0 |
| Đủ điểm chiến lực mới mở màn | Service kiểm tra `world_progress.skill_pts >= stages.required_skill_pts` khi tạo phòng |
| Nhảy bậc | Hệ quả tự nhiên của luật trên — không cần code riêng |
| Chơi lại để cày điểm | Cho phép tạo `stage_run` mới; `map_shards_owned` chặn trùng mảnh |
| Mở Cánh cổng Thời gian | Đếm `map_shards_owned` của world = `worlds.shard_total` |
| Tối đa 4 người, mỗi người 1 nhân vật | `UNIQUE (room_id, hero_key)` + kiểm tra `max_players` |

---

## 6. Công thức Điểm chiến lực — cần chốt

> **Luật tuyệt đối: không hằng số cân bằng nào được nằm trong code.** Toàn bộ số dưới đây
> đọc từ `worlds.balance_json`, có giá trị mặc định ở seed. Chỉnh cân bằng game là việc
> của người vận hành, không được yêu cầu lập trình viên và không được deploy lại.
> Đây là luật vàng số 5 của EDUPLAY áp dụng cho phần game.

Tài liệu thiết kế nói *"dựa trên các nhiệm vụ đã hoàn thành, kết hợp độ khó, thời gian hoàn thành, số năng lượng đã dùng"*. Cụ thể hoá:

```
skill_pts = round(
    base_quest_pts                    # tổng điểm nhiệm vụ cá nhân giải được (từ questions.points)
  * difficulty_multiplier[difficulty] # ← balance_json
  * (1 + time_bonus)                  # ← balance_json, theo % thời gian còn lại
  * (1 + energy_bonus)                # ← balance_json, theo % năng lượng đội còn lại
)
giới hạn ở stages.skill_pts_max
```

### `worlds.balance_json` — toàn bộ số có thể chỉnh

```jsonc
{
  "skillPtsStep": 50,                 // required_skill_pts(màn N) = skillPtsStep × (N−1)
  "difficultyMultiplier": { "easy": 1.0, "medium": 1.3, "hard": 1.6 },
  "timeBonus":   [ { "minRemainingPct": 50, "bonus": 0.2 },
                   { "minRemainingPct": 25, "bonus": 0.1 } ],
  "energyBonus": [ { "minRemainingPct": 50, "bonus": 0.2 },
                   { "minRemainingPct": 25, "bonus": 0.1 } ],
  "maxAttemptsPerQuestion": 2,        // sai 1 lần được làm lại; lần 2 thì NPC chuyển câu (§3f)
  "attemptPenalty": [1.0, 0.6],       // hệ số điểm theo lần thử thứ 1, 2
  "replayRatio": 1.0,                 // chơi lại được bao nhiêu phần điểm. 1.0 = cộng đủ mỗi lần
  "replayCapMultiplier": null,        // trần tích luỹ mỗi màn (bội số của skill_pts_max). null = không trần
  "lobbyCountdownSeconds": 30,        // chờ đủ người rồi tự bắt đầu
  "energyCost": {                     // các hành động tiêu hao năng lượng đội
    "wrongAnswer": 2, "replayAudio": 1, "showSubtitle": 3, "translate": 5
  }
}
```

### Cộng điểm lúc nào — hai nhịp

Công thức trên có hai thừa số chỉ biết được **khi màn kết thúc** (thời gian còn lại, năng lượng đội còn lại), trong khi §1.5 yêu cầu cộng điểm **ngay lúc nộp**. Giải quyết bằng cách tách làm hai nhịp:

```
Nhịp 1 — ngay khi nộp ĐÚNG một nhiệm vụ  (âm thầm, người chơi chưa thấy con số)
    điểm cơ bản = points × difficultyMultiplier[difficulty]
                        × attemptPenalty[attempt_no − 1]
    → cộng thẳng vào world_progress.skill_pts, ghi vào quest_answers.skill_pts_awarded
    → GIỮ NGUYÊN dù sau đó cả đội thua

Nhịp 2 — khi màn kết thúc THẮNG
    thưởng = (đã cộng ở nhịp 1) × ((1 + time_bonus) × (1 + energy_bonus) − 1)
    → cộng nốt phần chênh, tổng vẫn đúng bằng công thức gốc
    → giới hạn tổng của màn ở stages.skill_pts_max
```

"Âm thầm" ở nhịp 1 nghĩa là ghi vào database ngay nhưng **không hiện lên màn hình** cho tới khi màn kết thúc (§1.6). Ghi ngay để không mất khi mất kết nối; hiện muộn để không cắt mạch chơi và không rò manh mối.

> ⚠️ **Luật này đã đổi sau khi merge `main`.** `docs/PROJECT OVERVIEW.md` quy
> định công thức Exp **chỉ áp dụng khi thắng màn**. Lý lẽ dưới đây giữ lại để
> lần cân bằng sau biết vì sao từng chọn ngược lại — xem
> [TASKS.md → Bước 8b](./TASKS.md).

**Thua thì vẫn giữ điểm cơ bản đã kiếm được.** Đây là quyết định có chủ ý và đi thẳng từ nguyên tắc "kết quả từng người là độc lập": học sinh trả lời đúng ba câu tiếng Anh thì đã học được cái gì đó, kể cả khi đồng đội tiêu hết năng lượng. Nếu xoá sạch điểm khi thua, người chơi giỏi bị phạt vì đồng đội kém — và sẽ tránh chơi cùng bạn yếu, đúng thứ trò chơi hợp tác này muốn tránh.

Ngược lại, **Mảnh bản đồ vẫn chỉ trao khi cả đội thắng** và mọi thành viên hoàn thành ≥1 nhiệm vụ. Đó là phần thưởng tập thể, giữ nguyên theo tài liệu thiết kế. Hai loại phần thưởng, hai điều kiện — cá nhân thì theo nỗ lực cá nhân, tập thể thì theo kết quả tập thể.

`energyCost` nằm ở đây thay vì trong `GameState` như bản prototype hiện tại — bốn con số 2/1/3/5 đang hardcode trong code là thứ đầu tiên người vận hành sẽ muốn chỉnh sau buổi test đầu tiên.

Giá trị theo từng màn (`time_limit_seconds`, `initial_team_energy`, `skill_pts_max`, `required_skill_pts`) vẫn là **cột riêng trên `stages`** — vì chúng khác nhau từng màn, còn `balance_json` là quy tắc chung của cả world.

**Chơi lại — ĐÃ CHỐT: cộng đủ điểm mỗi lần, không giảm dần, không trần.**

```
lần đầu hoàn thành màn : cộng đủ điểm tính được
mỗi lần chơi lại       : cộng đủ điểm tính được   (chơi lại 10 lần = cộng 10 lần)
```

Đúng như tài liệu thiết kế mô tả: *"Có thể chơi 1 màn nhiều lần để tăng điểm chiến lực, để nhảy bậc màn chơi"*. Giữ đơn giản ở giai đoạn này.

**Hệ quả đã biết và chấp nhận:** cày lại một màn dễ có thể rẻ hơn là đi tiếp, nên một số người chơi sẽ farm màn 1 để mở màn xa. Chấp nhận được vì (a) đây là game hợp tác, không có bảng xếp hạng cạnh tranh ở giai đoạn này, và (b) farm vẫn phải trả lời tiếng Anh đúng mới có điểm — tức là vẫn đang học.

Quan trọng hơn: **quyết định này đảo ngược được bằng cấu hình, không cần sửa code.** Hai núm `replayRatio` và `replayCapMultiplier` vẫn tồn tại trong `balance_json`, chỉ là đặt mặc định `1.0` và `null`. Nếu sau vài tuần vận hành thấy farm gây hại, đổi thành `0.3` và `2.0` là xong — không migration, không deploy.

Cột `stage_progress.skill_pts_earned_total` vẫn tạo ngay từ đầu dù hiện chưa dùng để chặn: thêm cột vào bảng đã có dữ liệu thật thì phải backfill, còn tạo sẵn lúc này thì miễn phí.

### Bảng `required_skill_pts` đề xuất

```
required_skill_pts(màn N) = 50 × (N − 1)
```

| Màn | 1 | 2 | 3 | 6 | 12 | 18 | 24 | 30 |
|---|---|---|---|---|---|---|---|---|
| Yêu cầu | 0 | 50 | 100 | 250 | 550 | 850 | 1150 | 1450 |

Kiểm chứng nhanh với `skill_pts_max = 80`, người chơi trung bình đạt ~65 điểm/màn:

- Chơi tuần tự hết màn 1–5 → ~325 điểm → mở được tới màn 7 (bỏ qua màn 6). Nhảy bậc **có tác dụng ngay mà không cần cày**.
- Muốn nhảy xa hơn thì phải cày lại, và trần khiến cày mãi cũng chỉ nhảy thêm được 1–2 bậc.

Con số `50` là `balance_json.skillPtsStep`, **không hardcode**. Bảng trên chỉ là hệ quả của công thức — không lưu 30 dòng cấu hình. Nếu một màn cần yêu cầu khác quy luật chung thì đặt `stages.required_skill_pts` khác `null` để ghi đè.

> ✅ **§6 đã được duyệt ngày 2026-08-25.** Chơi lại cộng đủ điểm mỗi lần, không giảm dần, không trần.

---

## 7. Việc KHÔNG làm ở giai đoạn này

Ghi ra để không bị mở rộng phạm vi giữa chừng:

- Không tạo bảng `game_questions` riêng — nhiệm vụ dùng `questions`
- Không tái sử dụng `exams` / `attempts` cho màn chơi
- Không đưa logic chấm điểm vào tầng realtime
- Không làm Bot AI thông minh — Bot giai đoạn đầu chỉ đứng yên và không giải nhiệm vụ
- Không làm kinh tế (Xu / V-Points / voucher) — chưa thuộc phạm vi
- Không tối ưu cho >5.000 CCU

---

## 8. Danh sách kiểm tra trước khi sang Bước 1

- [x] Duyệt công thức Điểm chiến lực (§6) — chốt 2026-08-25: chơi lại cộng đủ điểm mỗi lần
- [x] Duyệt bảng `required_skill_pts` — suy ra từ balance_json.skillPtsStep, không lưu 30 dòng
- [x] Bỏ multi-tenant — thay bằng `users.role` (quyết định #2)
- [ ] Copy `question-schemas.md` từ LMS sang `docs/`, bổ sung các dạng game cần ở đợt 2 (`SHORT_ANSWER`, `MATCHING`, `REORDER`, `READ_ALOUD`)
- [x] ~~Chốt `scene_key` → cách `web/src/game/` nạp cảnh Phaser tương ứng~~ — **bỏ**. Cả trò chơi chạy trên MỘT lớp cảnh dựng từ dữ liệu: ảnh nền lấy từ
      `background_media_id`, vật thể lấy từ bảng `quests`. Cột `scene_key` giữ lại
      nhưng không điều khiển gì và thôi là ô bắt buộc — xem TASKS.md → Bước 6w.
- [x] Kết quả từng người độc lập, nộp từng nhiệm vụ (§1.5) — chốt 2026-08-25
- [x] Giáo viên/admin chơi thử bằng giao diện học sinh — chốt 2026-08-25
- [x] Trong trận chỉ báo xong/chưa xong, chi tiết để dành đến hết màn (§1.6) — chốt 2026-08-25
- [x] Sai thì thử lại được, có trần và có phạt điểm (§1.7) — chốt 2026-08-25
- [ ] Cân bằng lại `energyCost.wrongAnswer`, `maxAttemptsPerQuestion`, `attemptPenalty` sau buổi test đầu

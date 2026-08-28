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
| **Trần số lần thử** | `balance_json.maxAttemptsPerQuest`, mặc định `3`. Hết lượt thì nhiệm vụ khoá lại trong lượt chơi đó |
| **Điểm giảm dần** | `balance_json.attemptPenalty = [1.0, 0.6, 0.3]` — đúng ngay lần đầu ăn đủ điểm, lần hai còn 60%, lần ba còn 30% |

Không có ba thứ này thì một câu trắc nghiệm 3 lựa chọn luôn được giải sau tối đa 3 lần bấm, và điểm chiến lực mất hết ý nghĩa — nó sẽ đo độ kiên nhẫn chứ không đo trình độ tiếng Anh.

**Đúng rồi thì dừng.** Một người chỉ được ăn điểm một lần cho một nhiệm vụ; database cưỡng chế bằng partial unique index ở §3.4, không phải bằng câu `if` trong service.

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
                  music_media_id → media_assets,        ← nhạc nền màn chọn world
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
- **Bấm vào một chương đã mở là mở MINIMAP của chương, không phải nhảy thẳng vào một màn.** Các màn xếp một hàng ngang theo thứ tự vì đây là một con đường, không phải một cái kho. Màn có tên thì tên nằm giữa vòng tròn, chưa có tên thì số thứ tự — chỗ nào cũng phải bấm được, kể cả màn người dựng chưa kịp đặt tên.
- **`world_progress.character_id` là nhân vật người này đã chọn cho world này.** Cột trên `world_progress` chứ không phải bảng mới: lựa chọn khoá theo đúng cặp (world, user) mà bảng đó đã khoá sẵn, và nó là một phần của "tiến trình của tôi trong world này". `SET NULL` khi nhân vật bị xoá — học sinh thấy ô trống và chọn lại, không mất tiến trình. **Đổi được bất cứ lúc nào**: một đứa trẻ chọn nhầm ở giây thứ ba mà phải chơi hết học kỳ với nhân vật đó là một hình phạt vô cớ.
- **Spritesheet của nhân vật đi theo `RunOut`, không vào `snapshot_json`.** Snapshot là đề bài đóng băng; nhân vật là lựa chọn của người chơi và đổi được giữa hai lượt, nên nó phải đọc mới mỗi lần. Chỉ những hành động **có ảnh và đo được khổ khung** mới gửi xuống — khổ khung để trống thì server suy `ảnh ÷ frames`, vì cắt lệch một pixel là cả hoạt ảnh trượt khung và chỉ server mới có `media_assets.width/height`. Chưa chọn nhân vật → `character: null`, cảnh chơi vẽ ký hiệu mặc định: **một màn chơi không được đứng hình vì một lựa chọn cũ hết hiệu lực.**
- **Trong màn chơi, `idle` lúc đứng và `walk` lúc đi — suy từ chính vị trí nhân vật, không từ nơi ra lệnh.** Có ba đường làm nhân vật dịch chuyển (tween của cú bấm, phím WASD, cú huỷ tween giữa chừng); so vị trí hai khung hình liên tiếp là MỘT luật đúng cho cả ba, thay vì ba chỗ phải nhớ đồng bộ. Nhân vật thiếu tấm cho hành động đang cần thì giữ nguyên tấm đang chạy — chỉ có mỗi `idle` vẫn đi lại được, chỉ là không có bước chân.
- **Đổi sang `walk` thì tức thì, đổi về `idle` thì đợi 3 khung đứng yên.** Độ trễ một chiều, cố ý: người chơi phải thấy nhân vật nhấc chân đúng lúc họ bấm, còn một khung hình "không nhúc nhích" chưa chắc là đã tới nơi — máy khựng một nhịp là Phaser bù lại bằng vài khung `delta` gần bằng 0, và nhân vật chớp về tư thế đứng giữa lúc đang đi.
- **Nút Play của phòng chờ đi tới màn mở CUỐI CÙNG.** Nó nghĩa là "chơi tiếp", và mép tiến độ là chỗ người chơi đang đứng. Bấm vào một CHƯƠNG thì khác — đó là chọn chương đó, nên đi tới màn mở đầu tiên trong chương ấy.
- **Phòng chờ của world (`worlds.lobby_*` / `title_*` / `desc_*`) dùng CÙNG bộ thiết lập với bản đồ thiên hà, và MỌI cột đều `null` được — `null` nghĩa là THỪA CỦA THIÊN HÀ.** Một world vừa tạo đã có sẵn giao diện đúng tông với cả bản đồ; giáo viên chỉ động vào chỗ họ thực sự muốn khác. Chép sẵn giá trị của thiên hà xuống lúc tạo thì đổi nền thiên hà sau này không lan xuống được world nào nữa.
- **`galaxies.title_*` / `galaxies.desc_*` là hai tấm bảng trang trí trên bản đồ.** Ảnh do giáo viên tải lên; `x`/`y`/`width` cùng hệ toạ độ 3200×1800 với world, chiều cao suy ra theo tỉ lệ gốc của ảnh. Mặc định (NULL) là giữa bản đồ, phía dưới.
  - Chúng mang tên và mô tả **THIÊN HÀ** lúc nghỉ; rê chuột vào một world thì đổi sang tên và mô tả của world đó. **Cái khung đứng yên, chỉ chữ đổi** — vẽ lại khung cho từng world nghĩa là bản đồ nhấp nháy đổi hình mỗi lần con trỏ đi ngang, mà con trỏ thì đi ngang liên tục.
  - Chưa có ảnh thì vẫn vẽ, bằng một tấm nền trơn: màn hình phải chạy được trước khi ai kịp vẽ khung.
  - Cỡ chữ tính bằng `cqw` (phần trăm bề rộng CỦA KHUNG), không bằng `px`. Kéo khung to nhỏ thì chữ co giãn theo đúng tỉ lệ; đặt `px` cố định thì khung nhỏ lại là chữ tràn qua viền, khung to ra là chữ lọt thỏm.
  - **`*_color` và `*_font` đặt cho CÁI KHUNG, không cho từng world.** Chữ của thiên hà và chữ của mọi world đều hiện ra ở đúng chỗ đó, nên cấu hình riêng từng world nghĩa là rê chuột qua ba world là chữ đổi màu ba lần. `*_font` là **phần trăm** so với cỡ nền (100 = giữ nguyên, 40…250) — lưu một con số `px` sẽ sai ngay khi ai đó kéo cái khung to ra.
  - Mã màu kiểm ở CẢ Pydantic lẫn `CHECK` của Postgres. Chỉ có `CHECK` thì một chuỗi rác trả về 500 thay vì 422 kèm chỗ sai.
- **`worlds.is_locked` là cột RIÊNG, không suy ra từ số màn đã xuất bản.** Giáo viên phải khoá được một world đã có nội dung — đang sửa dở, để dành học kỳ sau — và điều đó không suy ra từ đâu được. World mới tạo mặc định `true`: lúc đó nó chưa có chương hay màn nào.
- **Khoá HIỂN THỊ ≠ cột `is_locked`.** Trên bản đồ thiên hà, một world hiện ổ khoá khi `is_locked` **HOẶC** chưa có màn nào phát hành. Vế thứ hai phải đếm màn nên chỉ server tính được; `PlayWorldOut.is_locked` trả về giá trị ĐÃ TÍNH, không phải cột thô.
- **`PlayWorldOut.can_enter` tách khỏi `is_locked`** vì hai câu hỏi khác nhau: ổ khoá là thứ VẼ RA cho mọi người thấy, còn vào được hay không thì giáo viên chơi thử khác học sinh. Trộn hai thứ vào một cờ là hoặc giáo viên không xem trước được, hoặc học sinh đi thẳng vào world chưa phát hành.
- **Bản đồ hiện MỌI world, kể cả world khoá.** Giấu hẳn thì bản đồ thủng lỗ chỗ và học sinh không biết còn gì đang được dựng — mà bản đồ là chỗ để nhìn thấy cả hành trình, không chỉ chặng đang mở. Cái chặn nằm ở `GET /play/worlds/{id}` (404 khi `can_enter` sai), không nằm ở danh sách: chặn ở danh sách nghĩa là ai gõ thẳng URL vẫn vào được.
- **Ảnh nền và nhạc nền thuộc về `galaxies`, không thuộc từng world.** Đó là cái nền mà mọi world nằm lên trên. Nhạc KHÔNG tự phát: trình duyệt chặn âm thanh tự chạy trước khi người dùng chạm vào trang, nên `autoplay` chỉ đem lại một thẻ audio im lặng và một cảnh báo trong console.
- **`pulse_percent` / `pulse_period_ms` — nhịp thở của ảnh vật thể.** Ảnh phóng to thu nhỏ liên tục để người chơi nhận ra "cái này bấm được". `pulse_percent` là **to thêm bao nhiêu phần trăm** ở đỉnh nhịp (8 = phình lên 108% rồi về 100%); `pulse_period_ms` là **một nhịp đầy đủ**, to rồi nhỏ.
  - `null` = lấy mặc định của cảnh (`web/src/game/world.ts`), **`0` = tắt hẳn**. Phân biệt được hai thứ đó là lý do cột để `nullable` thay vì mặc định `0`.
  - Chỉ ĐỔI CÁCH VẼ. Khung va chạm — vùng bấm và chỗ nhân vật dừng lại — vẫn tính theo `icon_size` gốc. Cho khung phập phồng theo thì đích bấm chạy dưới tay người chơi.
  - Sàn `pulse_period_ms` là 400ms (2,5 nhịp/giây). Dưới ngưỡng đó thành nhấp nháy tần số cao, thứ có thể gây khó chịu và co giật.
  - **Ba tầng — CHECK constraint, Pydantic và thanh trượt — dùng CHUNG một khoảng.** Cho API rộng hơn giao diện là tạo ra một vùng giá trị hợp lệ mà không nút bấm nào chạm tới được, và người đọc tài liệu sẽ hỏi vì sao.
  - **KHÔNG kiểm `prefers-reduced-motion`** — quyết định có cân nhắc. Cài đặt đó chặn chuyển động *trang trí*, còn nhịp thở ở đây là thứ duy nhất phân biệt vật thể bấm được với hình vẽ trên nền. Trong một trò chơi nhiều người, tắt nó theo cài đặt từng máy nghĩa là hai đứa trẻ chơi chung một màn mà một đứa thấy gợi ý, đứa kia phải bấm mò. Nút tắt nằm ở tay giáo viên (`pulse_percent = 0`), tắt cho cả lớp cùng lúc.

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

**Trạng thái một nhiệm vụ suy ra từ nhật ký, không lưu riêng:** có dòng `is_correct` → xong · đủ `maxAttemptsPerQuest` dòng sai → khoá · còn lại → đang làm. Một nguồn sự thật, không có gì để lệch nhau.

`quest_answers.user_id` cũng là dữ liệu để cưỡng chế luật *"mọi thành viên phải hoàn thành ≥1 nhiệm vụ thì màn mới tính hoàn thành"* — đếm nhóm theo `user_id`, lọc `is_correct`.

`stage_run_players` là **bản cộng dồn** của `quest_answers` theo từng người, cập nhật mỗi lần nộp. Nó dư thừa về mặt lý thuyết nhưng cần cho màn hình kết thúc và bảng điểm trực tiếp trong trận — không muốn quét lại toàn bộ `quest_answers` mỗi lần vẽ HUD.

**Chi phí ghi:** một lượt chơi 4 người × 4 nhiệm vụ = tối đa 16 lần ghi, chứ không phải ghi theo nhịp khung hình. Không cần gom lô ở giai đoạn này.

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
| Trần số lần thử mỗi nhiệm vụ | Service đếm dòng, so với `balance_json.maxAttemptsPerQuest` |
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
  "maxAttemptsPerQuest": 3,           // hết lượt thì nhiệm vụ khoá trong lượt chơi đó
  "attemptPenalty": [1.0, 0.6, 0.3],  // hệ số điểm theo lần thử thứ 1, 2, 3
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
- [ ] Chốt `scene_key` → cách `web/src/game/` nạp cảnh Phaser tương ứng
- [x] Kết quả từng người độc lập, nộp từng nhiệm vụ (§1.5) — chốt 2026-08-25
- [x] Giáo viên/admin chơi thử bằng giao diện học sinh — chốt 2026-08-25
- [x] Trong trận chỉ báo xong/chưa xong, chi tiết để dành đến hết màn (§1.6) — chốt 2026-08-25
- [x] Sai thì thử lại được, có trần và có phạt điểm (§1.7) — chốt 2026-08-25
- [ ] Cân bằng lại `energyCost.wrongAnswer`, `maxAttemptsPerQuest`, `attemptPenalty` sau buổi test đầu

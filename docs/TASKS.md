# TASK LIST — Vitaminfun / Lost in Atlantis

> Cập nhật: 2026-08-25 · Branch: `dev_thuan`
> **Hướng đã chốt:** Vitaminfun đứng một mình (`api/` FastAPI + `web/` Next.js). LMS EDUPLAY là **kho tham khảo chỉ đọc** — copy code sang và tổ chức lại, không sửa gì bên đó.
> Đọc trước: [ARCHITECTURE.md](./ARCHITECTURE.md) · [GAME_DOMAIN.md](./GAME_DOMAIN.md) · [UI_META_SCREENS.md](./UI_META_SCREENS.md) · [DEPLOY.md](./DEPLOY.md)
> Ký hiệu: `[ ]` chưa làm · `[~]` đang làm · `[x]` xong

---

## 0. Quyết định nền tảng

| # | Quyết định |
|---|---|
| 1 | Vitaminfun đứng một mình. LMS chỉ để tham khảo, **không đụng vào** |
| 2 | BE: FastAPI + PostgreSQL · FE: Next.js 15 + React + Tailwind · Game: Phaser 4 |
| 3 | Không monorepo tooling — chỉ `api/` và `web/`, mỗi bên 1 lệnh deploy |
| 4 | **Không có `tenant_id`**, ba vai trò cố định: admin · teacher · student |
| 5 | Nhiệm vụ = `Question` của kho câu hỏi. Màn chơi không dùng lại `exams` |
| 6 | Chấm điểm chỉ một bản, viết bằng Python, chạy ở server |
| 7 | Không hardcode: chữ → `messages/` · số cân bằng → `worlds.balance_json` · cấu hình → `.env` |
| 8 | Deploy Ubuntu, giai đoạn đầu chạy lệnh trực tiếp; Docker sau |
| 9 | Ưu tiên nền tảng vững hơn tốc độ |
| 10 | SSOT nội dung là tài liệu **Atlantis**. Bỏ qua `MASTER_SPECS.md` và `MASTER_SYSTEM_SPECIFICATIONS_V2.0.md` |
| 11 | **Kết quả từng người độc lập** — mỗi người tự nộp từng nhiệm vụ, server chấm ngay, cộng điểm chiến lực ngay |
| 13 | **Trong trận chỉ báo xong / chưa xong.** Sai thì có nút Thử lại. Điểm, đáp án, giải thích để dành đến màn xem lại sau khi hết màn |
| 12 | **Giáo viên/admin chơi thử bằng chính giao diện học sinh** (`/play/*`), lượt chơi đánh dấu `is_trial` |

---

## 1. Mục tiêu cuối

Một link duy nhất:
- Đăng nhập **giáo viên** → soạn câu hỏi, dựng world/màn, **gán câu hỏi vào từng nhiệm vụ**
- Đăng nhập **học sinh** → chọn world → vào world → tạo phòng → chơi các màn

---

## 2. Lộ trình

### Bước 0 — Tài liệu ✅ XONG

- [x] `ARCHITECTURE.md` — kiến trúc tổng, cấu trúc thư mục, điều hướng theo vai trò, bảng tái sử dụng
- [x] `GAME_DOMAIN.md` — mô hình dữ liệu, ánh xạ luật chơi → nơi cưỡng chế
- [x] `UI_META_SCREENS.md` — bố cục màn hình học sinh S0–S7
- [x] `DEPLOY.md` — Ubuntu, tập lệnh chạy tay
- [x] Cấu trúc Vũ trụ → Thiên hà → Hành tinh vào tài liệu thiết kế
- [x] Công thức Điểm chiến lực — chơi lại cộng đủ điểm mỗi lần
- [x] Chốt SSOT nội dung: tài liệu Atlantis
- [x] Bổ sung bố cục màn hình **giáo viên** (T0–T3) vào `UI_META_SCREENS.md`
- [x] Chốt: kết quả từng người độc lập, nộp bài từng nhiệm vụ (`GAME_DOMAIN §1.5`)
- [x] Chốt: giáo viên/admin chơi thử bằng giao diện học sinh (`ARCHITECTURE §4`)
- [x] Chốt: trong trận chỉ báo xong/chưa xong, thử lại có trần, chi tiết xem sau màn (`GAME_DOMAIN §1.6`, `§1.7`)

### Bước 1 — Dựng khung 2 app + đăng nhập theo vai trò ✅ XONG

- [x] `api/`: khung FastAPI, copy `core/` (config · security · deps · errors · logging) từ LMS, cắt phần tenant
- [x] `api/`: `db/base.py`, `session.py`, alembic (migration đầu viết tay, không autogenerate)
- [x] Model `users` (id, email, password_hash, display_name, role, avatar_media_id, status)
      + `CHECK` cưỡng chế đúng 3 vai trò ở database
- [x] Module `auth`: đăng nhập, JWT, `require_role()`
- [x] `web/`: khung Next.js 15 + Tailwind 4 + next-intl, `messages/vi.json` + `en.json`
- [x] `web/`: `lib/api-client.ts`, `lib/session.ts`, `components/auth-context.tsx`
- [x] Middleware điều hướng theo vai trò — **bất đối xứng**: học sinh bị chặn khỏi `/teacher/*`, nhưng giáo viên/admin **được** vào `/play/*`
- [x] Seed 3 tài khoản mẫu: admin / teacher / student (email + mật khẩu đọc từ `.env`)
- [x] Sinh kiểu TS từ OpenAPI → `web/src/lib/api-types.ts`, `role` là union 3 giá trị
- [x] Thanh cảnh báo chơi thử + `GET /play/context` quyết định chế độ ở backend
- [x] `.gitignore` chặn `.env` (trước đó **không** chặn — đã sửa)
- [x] **Nghiệm thu: đăng nhập 2 tài khoản khác nhau ra 2 giao diện khác nhau** — đạt 2026-08-25

**Đã kiểm chứng (chưa cần database):**

| Kiểm tra | Kết quả |
|---|---|
| `GET /health` | `degraded`, `db: error` — đúng, vì DB chưa tạo |
| `GET /auth/me` không token | `401 AUTH_REQUIRED` |
| `/` chưa đăng nhập | `307 → /login` |
| `/teacher`, `/play`, `/admin` chưa đăng nhập | `307 → /login?next=...` |
| `/en/teacher` | `307 → /en/login?next=/en/teacher` — giữ tiền tố ngôn ngữ |
| `/login` vi / en | ra đúng hai thứ tiếng |
| `alembic upgrade head --sql` | render đúng, chạy được offline |
| `pnpm build` + `pnpm typecheck` | sạch |
| Trang theo từng người | không nằm trong `prerender-manifest` |

### Bước 2 — Question Engine ✅ XONG

- [x] Copy `docs/question-schemas.md` từ LMS — **0 dòng sửa**
- [x] Copy **100%** `grading/graders.py` + `grading/normalize.py` — **0 dòng sửa**, chỉ import stdlib
- [x] Copy 3 file test của LMS — **0 dòng sửa**, 95 test xanh
- [x] Copy `questions/schemas.py` — 0 dòng sửa lúc copy; sau đó siết `type`/`status` thành `Literal` và mô hình hoá `GradeDetail` để kiểu TS sinh ra chặt hơn
- [x] Viết lại `questions/service.py` + `router.py`: bỏ `apply_scope()`/`ScopeFilter`/`audit`, thay bằng `require_role(TEACHER, ADMIN)`
- [x] Model `questions` + `media_assets` (bỏ `tenant_id`) + migration `0002_media_and_questions`
- [x] Gắn khoá ngoại `users.avatar_media_id` đã để trống từ migration 0001
- [x] Module `media`: upload theo danh sách trắng đuôi file, tên file do server đặt, trần 32MB
- [x] Copy `components/question/*` (1.762 dòng) sang `web/` — sửa 1 dòng import
- [x] Viết phần keo dính: `browser-api.ts`, proxy `/api/be/*`, `lib/questions.ts`, `routes.ts`, 4 UI primitive
- [x] Nhập 143 khoá dịch từ LMS sang `messages/vi.json` + `en.json`
- [x] Màn `/teacher/questions`, `/teacher/questions/new`, `/new/[type]`, `/[id]`
- [x] **Nghiệm thu: giáo viên soạn câu hỏi, chấm thử ra đúng/sai** — đạt 2026-08-25

**Đã kiểm chứng:**

| Kiểm tra | Kết quả |
|---|---|
| 95 test (grading · normalize · validate_payload) | xanh |
| Học sinh gọi `/questions`, `/media` | `403 ROLE_REQUIRED` |
| Học sinh gõ `/teacher/questions` | `307 → /play` |
| Danh sách câu hỏi | `answer=null`, `explanation=null` — không rò rỉ |
| Câu hỏi thiếu đáp án đúng | `422 QUESTION_NO_CORRECT_ANSWER` |
| `PATCH` gửi `content` mà thiếu `answer` | `422` |
| Chấm thử đúng / sai / bỏ trống | `1.0` / `0.0` / `0.0` |
| Xoá mềm rồi đọc lại | `404` |
| `/teacher/questions/new/READ_ALOUD` (dạng chưa chấm được) | `404` |
| 4 màn giáo viên | render đủ nội dung |

### Bước 3 — Model game + migration ✅ XONG

- [x] Nội dung: `universes`, `galaxies`, `worlds`, `chapters`, `stages`, `quests`
- [x] Tiến trình: `world_progress`, `map_shards_owned`, `stage_progress`
- [x] Phòng: `rooms`, `room_members`
- [x] Lượt chơi: `stage_runs`, `stage_run_players`, `quest_answers`
- [x] Ràng buộc UNIQUE cưỡng chế luật chơi: mảnh khác nhau · 1 nhân vật/phòng
- [x] `quest_answers` là **nhật ký lần thử**: `attempt_no` + `UNIQUE (run, user, quest, attempt_no)`
- [x] **Partial index** `UNIQUE (run, user, quest) WHERE is_correct` — đúng rồi không ăn điểm lần hai
- [x] `visible_worlds(user)` / `visible_stages(user)` — một chỗ duy nhất lọc `draft`
- [x] `worlds.balance_json` + `read_balance()` bù khoá thiếu · seed world Atlantis + 5 chương
- [x] Module `worlds`: 14 endpoint CRUD cho giáo viên, gồm cả gán câu hỏi vào nhiệm vụ
- [x] `publish_blockers()` — 6 điều kiện xuất bản màn, kiểm ở service
- [x] **Chặn xoá câu hỏi đang nằm trong màn chơi** (`QUESTION_IN_USE`) — lỗ hổng phát hiện lúc thử
- [x] **Nghiệm thu: `alembic upgrade head` sạch, rollback được** — đã thử lên/xuống/lên

**17 bảng, migration `0003_game_model` tạo 14 bảng mới.**

Điều kiện xuất bản màn (`STAGE_*`), kiểm ở service chứ không ở giao diện:

| Mã | Ý nghĩa |
|---|---|
| `STAGE_TOO_FEW_QUESTS` | dưới 4 nhiệm vụ |
| `STAGE_QUEST_QUESTION_DRAFT` | có nhiệm vụ trỏ tới câu hỏi còn nháp hoặc đã xoá |
| `STAGE_NO_SHARD_QUEST` | không nhiệm vụ nào trao mảnh bản đồ |
| `STAGE_MULTIPLE_SHARD_QUESTS` | nhiều hơn một nhiệm vụ trao mảnh |
| `STAGE_NO_ADVISOR` | có khai báo NPC nhưng không có bước hội thoại nào |
| `STAGE_SHARD_INDEX_TAKEN` | màn khác trong world đã trao mảnh cùng số |

**Đã kiểm chứng:**

| Kiểm tra | Kết quả |
|---|---|
| `alembic upgrade → downgrade → upgrade` | sạch |
| Seed chạy hai lần | lần hai không tạo gì |
| Học sinh gọi `/worlds` | `403` |
| Màn mới tạo | 3 lý do chưa xuất bản được |
| Xuất bản khi chưa đủ điều kiện | `422` kèm danh sách lý do |
| Gán hai nhiệm vụ vào cùng một vật thể | `409` |
| Đánh dấu 2 nhiệm vụ trao mảnh | `STAGE_MULTIPLE_SHARD_QUESTS` |
| Chuyển câu hỏi về nháp | `STAGE_QUEST_QUESTION_DRAFT` |
| Xoá câu hỏi đang dùng | `409 QUESTION_IN_USE` kèm tên màn |
| Xoá câu hỏi tự do | `204` |
| `PATCH balance_json` một khoá | các khoá khác giữ nguyên |
| Sơ đồ màn trả về | không kèm đáp án |
| 95 test + `pnpm typecheck` | xanh |

### Bước 4 — ⭐ Giao diện giáo viên gán câu hỏi vào nhiệm vụ ✅ XONG

> Đây là mong muốn cốt lõi. Ưu tiên cao, đến trước phần chơi.

- [x] `/teacher/worlds` — danh sách world
- [x] `/teacher/worlds/[id]` — chương & màn chơi, thêm màn ngay tại chỗ
- [x] `/teacher/worlds/[id]/stages/[sid]` — **màn T3**: sơ đồ màn + bộ chọn câu hỏi
- [x] Bộ chọn câu hỏi — giữ phần lọc/tìm của LMS, đổi sang **chọn một** cho hợp luồng gán
- [x] Gán câu hỏi vào vật thể nhiệm vụ, đánh dấu nhiệm vụ trao mảnh bản đồ
- [x] Chuyển nhiệm vụ sang `phase = "advisor"` cho hội thoại NPC
- [x] Điều kiện xuất bản màn hiện trực tiếp, do **server** trả về (không tính lại ở giao diện)
- [x] Nút **🧪 Chơi thử màn này** mở tab mới sang `/play/stage/[id]`
- [x] **Nghiệm thu: dựng trọn một màn từ giao diện, không đụng database** — đạt 2026-08-25

**Nghiệm thu chạy qua đúng proxy `/api/be/*` mà trình duyệt dùng**, mô phỏng từng
nút bấm: tạo màn (chỉ 4 trường, server điền phần còn lại) → chọn 4 câu hỏi từ kho
→ gán vào `npc`/`coral`/`lamp`/`chest` → đặt hội thoại NPC → đặt trao mảnh bản đồ
→ sửa cấu hình màn → xuất bản. Kết quả: `published`, 4 nhiệm vụ, blockers rỗng.

| Kiểm tra | Kết quả |
|---|---|
| Tạo màn chỉ với 4 trường bắt buộc | server điền `time=300s`, `energy=100`, `skill_max=80`, `1–4 người` |
| Bộ chọn câu hỏi | `answer=null` — không lộ đáp án |
| Sơ đồ màn | không kèm đáp án |
| Điều kiện xuất bản | 2 lý do lúc đầu → rỗng sau khi gán đủ |
| Học sinh gọi `/api/be/worlds` | `403` |
| 3 trang giáo viên | render `200` |
| 95 test + `typecheck` + `build` | xanh |

**Bổ sung sau nghiệm thu** (theo phản hồi khi dùng thật):

- [x] Breadcrumb + lối quay lại trên cả 5 màn giáo viên — trước đó vào một màn là kẹt
- [x] Tạo / sửa / xoá **chương** ngay trên giao diện
- [x] Sửa tên · cảnh Phaser · NPC · số thứ tự của **màn chơi**
- [x] **Rút màn về nháp** và **xoá màn**
- [x] **Phát hành / rút world** — cần cho Bước 6, học sinh chỉ thấy world đã phát hành
- [x] `DELETE /worlds/{id}` — chặn nếu world còn chương (`WORLD_HAS_CHAPTERS`); nút chỉ hiện khi world đã rỗng
- [x] `DELETE /chapters/{id}` — chặn nếu chương còn màn (`CHAPTER_HAS_STAGES`)
- [x] `DELETE /stages/{id}` — chặn nếu màn đã có lượt chơi (`STAGE_HAS_RUNS`)
- [x] Tách `question_deleted` khỏi `question_status` — câu hỏi xoá mềm vẫn mang
      `status = published`, nên sơ đồ T3 hiện nó bình thường trong khi điều kiện
      xuất bản lại chặn. Hai chỗ nói khác nhau là lỗi; giờ sơ đồ chỉ đúng nhiệm vụ hỏng

**Sửa mô hình sau khi dùng thật** (migration `0004_quest_multi_question`):

- [x] **Một nhiệm vụ mang NHIỀU câu hỏi** — bảng nối `quest_questions` có `points` (mặc định 10) và `order_index`
- [x] `pass_score` — điểm tối thiểu để hoàn thành nhiệm vụ, mặc định = tổng điểm mọi câu
- [x] Bộ chọn câu hỏi đổi sang **checkbox chọn nhiều**; câu đã lắp hiện mờ, không tích lại được
- [x] **Bỏ `grants_map_shard`** — sửa lỗi logic: mảnh bản đồ thuộc về **màn**, trao khi hoàn thành *tất cả* nhiệm vụ, số hiệu đã nằm ở `stages.map_shard_index`
- [x] `quest_answers` thêm `question_id` vào cả hai ràng buộc UNIQUE
- [x] Hai mã chặn mới: `STAGE_QUEST_EMPTY`, `STAGE_QUEST_PASS_SCORE_TOO_HIGH`; bỏ hai mã về mảnh bản đồ
- [x] Migration **có chuyển dữ liệu**, thử lên/xuống/lên không mất dòng nào

Việc này cũng giải quyết luôn thiếu sót đã ghi nhận: **hội thoại NPC nhiều bước**
giờ là nhiều câu hỏi trong cùng nhiệm vụ `npc`, đúng như tài liệu thiết kế mô tả.

**Lỗi phát hiện lúc nghiệm thu:** cookie phiên đặt cờ `Secure` theo `NODE_ENV`,
mà `pnpm start` luôn là production — nên chạy qua `http://` thì trình duyệt
không gửi cookie lại. Đăng nhập báo thành công rồi bị đá về `/login` vòng vòng,
không có thông báo lỗi nào. Đã sửa: `secure` căn theo **giao thức thật của
request** (`web/src/lib/secure-cookie.ts`), và nginx phải đặt `X-Forwarded-Proto`
— đã bổ sung vào [DEPLOY §7](./DEPLOY.md).

### Bước 5 — Đưa game vào `web/`  `[~]` ĐANG LÀM

**Nửa backend đã xong** — module `play`, 7 endpoint:

- [x] `POST /play/stages/{id}/start` — tạo phòng đơn + `stage_run`, đóng băng đề
- [x] `GET /play/runs/{id}` — trạng thái, tiến độ của mình, tiến độ đội
- [x] `POST /play/runs/{id}/quests/{qid}/questions/{qqid}/answer` — chấm ngay
- [x] `POST /play/runs/{id}/abandon` · `GET .../result` · `GET .../review`
- [x] Đóng băng đề tách làm hai cục: `snapshot_json` (an toàn) và `answer_key_json` (server-only)
- [x] Thời gian tính từ **server**, đồng hồ máy người chơi chỉ để đếm cho mượt
- [x] Đổi `maxAttemptsPerQuest` → `maxAttemptsPerQuestion` (có tương thích ngược)

| Kiểm chứng | Kết quả |
|---|---|
| Đề bài gửi xuống | **không khoá nào** tên `answer`/`correctOptionId`/`accepted` (kiểm theo cấu trúc) |
| Phản hồi nộp bài | **đúng 4 trường**: `completed`, `quest_completed`, `attempts_left`, `team_energy` |
| Trả lời sai | trừ 2 năng lượng đội |
| Nộp lại câu đã đúng | không lỗi, không trừ thêm |
| `review` / `result` khi đang chơi | `409 RUN_STILL_PLAYING` |
| Hoàn thành 4 nhiệm vụ | `won`, mảnh #1, chiến lực +66 |
| Xem lại sau khi hết màn | **giờ mới có** đáp án + toàn bộ lần thử |
| Chơi lại | mảnh vẫn là 1, chiến lực 66 → 138 (đúng luật §6) |
| Học sinh đọc lượt chơi người khác | `404` |

**Nửa Phaser — đã chuyển:**

- [x] `EventBus.ts`, `SpeechEngine.ts` — chuyển sang TS, **bỏ hết `document.*`**
- [x] `StageScene.ts` — phần Phaser thuần giữ nguyên; vật thể nhiệm vụ giờ **đọc từ `snapshot.quests`** thay vì viết cứng
- [x] `PhaserCanvas.tsx` — `dynamic(ssr:false)`, dọn `game.destroy(true)` khi rời màn
- [x] HUD React thay 290 dòng HTML + 41 lệnh `document.*`
- [x] `QuestPanel` — nộp bài từng câu, phản hồi **đúng hai trạng thái**
- [x] **Bỏ `String.includes()`** — chấm ở server bằng `grade()`
- [x] **Sửa bug `currentTaskIndex`** — tra theo `questId`, không theo chỉ số mảng
- [x] Năng lượng là **một quỹ chung**, do server giữ
- [x] Chữ tiếng Việt sang `messages/`; asset đổi tên `a-z0-9_`
- [x] `quests.name_i18n` — tên hiển thị cho người chơi (migration `0005`)
- [ ] **Nghiệm thu: chơi Màn 1 trong trình duyệt** — chưa tự kiểm được, cần chạy thật

| Kiểm chứng | Kết quả |
|---|---|
| `pnpm build` với Phaser | xanh |
| Phaser tách khối riêng | 1.4 MB, **không** nằm trong bundle chung |
| `/play/stage/[id]` First Load JS | 136 kB |
| `scene_key` → asset | `ship_deck_01` → `/game/scenes/ship_deck_01.jpg` |
| Snapshot có tên hiển thị | "Cột buồm chính" thay vì `mast` |
| 95 test + typecheck | xanh |

**Chưa làm (đẩy sang bước sau):** ô nói/gõ bằng micro chưa nối vào `QuestPanel`
(engine đã port nhưng chưa có nút), NPC và đồng đội chưa vẽ trong cảnh, minimap
chưa có, `energy_cost` của nhiệm vụ chưa trừ khi mở.

**Ba chỗ sửa sau khi chơi thử:**

- [x] **Bỏ ô vuông mờ quanh mỗi vật thể.** Viền để `alpha 0` lúc bình thường,
      chỉ sáng lên đúng khi nhân vật đứng trong khung. Hình chữ nhật không tô nền
      vẫn nhận cú bấm, nên bỏ viền không làm mất đích bấm. Nhiệm vụ đã xong cũng
      không vẽ viền xanh nữa — ảnh mờ đi cộng dấu ✓ là đủ.
- [x] **Hướng dẫn chơi thu vào biểu tượng `?` ở góc phải dưới.** Dòng chữ
      "dùng W A D X" cũ nằm giữa cảnh: hữu ích ở giây đầu, rồi che mất chính cái
      cảnh mà nó hướng dẫn cách đi. Chữ nằm ở `game.help.*`, khoá `game.walkHint`
      đã bỏ.
- [x] **Chỉ đóng mở bằng cú bấm, không nghe rê chuột.** Bản đầu mở bằng cả `hover`
      lẫn bấm; rê chuột làm bảng tự bật lên mỗi lần con trỏ đi ngang góc màn, ngay
      giữa lúc đang chơi. Trên màn hình cảm ứng thì `hover` chẳng giúp được gì vì
      không có trạng thái "đang rê". Một cú bấm để mở, một cú nữa để tắt — giống
      nhau ở mọi thiết bị. Bỏ luôn hai state `hovered`/`pinned`, còn một `open`.

      Đã kiểm trong trình duyệt: rê chuột qua nút → không mở; bấm lần 1 → mở
      (`aria-expanded="true"`, 6 dòng hướng dẫn); bấm lần 2 → tắt; mở rồi rời chuột
      đi → vẫn mở.
- [x] **Đang mở mà làm việc gì khác thì tự tắt** — bấm ra ngoài, hay gõ phím.
      Hướng dẫn là thứ liếc một cái rồi quay lại chơi, không phải ô cửa sổ phải
      nhớ đi đóng.

      Nghe `pointerdown` ở giai đoạn **bắt (capture)**, không phải `click`: bảng
      phải biến mất TRƯỚC khi Phaser xử lý cú bấm, không thì có một khoảnh khắc
      nhân vật đã chạy còn hướng dẫn vẫn nằm đè lên cảnh. Bấm vào chính nút `?`
      thì bỏ qua — `onClick` của nó lo việc đóng, để cả hai cùng chạy là đóng rồi
      mở lại ngay trong một cú bấm. Gắn listener trong `useEffect` nên cú bấm mở
      bảng đã dispatch xong trước đó, không có chuyện vừa mở đã tự đóng.

      Đã kiểm 8 nhánh: bấm ra canvas → đóng; bấm lên thanh HUD → đóng; gõ W →
      đóng; bấm **bên trong** bảng → vẫn mở; bấm lại nút `?` → đóng gọn một lần.
- [x] **Bấm ra ngoài vùng: đi theo hướng đó tới khi chạm mép rồi dừng.**
      Trước đây cú bấm bị lờ hoàn toàn — màn hình không phản hồi gì, và người chơi
      tưởng game đơ chứ không nghĩ là mình bấm ra ngoài.

`clampToDeck()` làm **hai bước, không phải một**: dò tiến từng đoạn ~8px để tìm
lần ra khỏi boong ĐẦU TIÊN, rồi mới chia đôi trong đoạn hẹp đó. Chia đôi thẳng từ
đầu sẽ sai — boong là đa giác **lõm**, nên "trong hay ngoài" không đơn điệu theo
quãng đường: một đường thẳng có thể ra khỏi boong rồi vào lại. Chia đôi vớ phải
lần cắt sau là nhân vật xuyên qua thành tàu.

Đã kiểm bằng số trên đúng đa giác boong, 8 hướng bấm (bốn phía, hai góc chéo, sát
mũi tàu, và một điểm trong boong). Mỗi kết quả đều thoả bốn điều kiện: nằm trong
boong, nằm trên tia từ nhân vật tới điểm bấm, đúng chiều, và nhích thêm 12px nữa
là ra ngoài — tức đúng là điểm xa nhất đi được.

**Lỗi nặng phát hiện khi chơi thử tiếp: "bấm mà nhân vật không đi".**

Vùng đi lại được là **một đa giác hình boong tàu viết cứng**, sao chép từ bản demo
Vite — nó vừa khít *một ảnh nền cụ thể của bản demo đó*. Nền giờ do giáo viên tải
lên, vật thể kéo thả tự do trên cả khung 3200×1800, còn đa giác ấy vẫn nằm nguyên,
vô hình, chắn **80,5% bản đồ**. Đo trên dữ liệu thật: 3 trong 4 nhiệm vụ của màn
"Cơn bão bất ngờ" nằm NGOÀI nó.

Hai lỗi chồng lên nhau, không phải một:

1. Bấm vào 80,5% bản đồ thì "đi tới sát thành" chính là chỗ đang đứng — trông y
   như cú bấm không ăn.
2. `walkToQuest()` đi thẳng tới tâm vật thể **không kiểm tra vùng**, nên bấm vào
   một trong ba nhiệm vụ ngoài boong là nhân vật ra khỏi vùng hợp lệ rồi **kẹt
   cứng**: `clampToDeck()` trả `null` cho mọi cú bấm sau đó và cả W A D X cũng
   chết, phải tải lại trang.

Ba chỗ sửa:

- [x] Vùng đi lại = **cả bản đồ**, chừa lề 60px. Đây là mặc định trung thực duy
      nhất khi ảnh nền là tuỳ ý: cảnh không biết chỗ nào trong ảnh của giáo viên
      là sàn, chỗ nào là tường. 19,5% → **89,8%** bản đồ.
- [x] `walkToQuest()` đi qua `clampToWalkArea()`, không bao giờ đặt nhân vật ra
      ngoài vùng.
- [x] Nhân vật lỡ ở ngoài vùng thì **kéo về**, thay vì trả `null` để họ kẹt vĩnh viễn.

Giữ nguyên thuật toán dò-tiến-rồi-chia-đôi dù vùng giờ là hình chữ nhật: nó không
phụ thuộc hình dạng, nên khi nào giáo viên vẽ được vùng cấm riêng — có thể lõm —
thì không phải viết lại.

**Còn hở:** chưa có cách để giáo viên vẽ vùng cấm riêng cho từng màn. Cho tới lúc
đó, nhân vật đi được khắp ảnh nền.

**Hai chỗ sửa tiếp sau khi chơi thử:**

- [x] **Mở nhiệm vụ theo ĐIỂM DỪNG, không theo lúc chạm khung.** Bản trước xét
      phạm vi ở *mỗi khung hình khi đang đi*, nên đi ngang qua một vật thể trên
      đường tới chỗ khác là bảng câu hỏi bật lên giữa chừng — người chơi không hề
      định vào đó. Giờ `settleZone()` chỉ chạy khi đã dừng: tween `onComplete`
      (bấm chuột), hoặc nhả hết phím (bàn phím). Tween bị huỷ giữa chừng thì
      Phaser không gọi `onComplete`, nên bấm sang chỗ khác không mở nhầm.
- [x] **Khoá di chuyển khi bảng câu hỏi đang mở** — cả chuột lẫn bàn phím.
      `setInputLocked()` khác `setTypingGuard()`: `typing` chỉ chặn bàn phím để gõ
      đáp án không làm nhân vật chạy, còn cái này chặn cả hai. Đang trả lời mà
      nhân vật vẫn đi được thì họ tự đi ra khỏi phạm vi và bảng đóng ngang.

**Vào và ra không đối xứng, và đó là cố ý.** RỜI phạm vi báo ngay giữa đường (đi
ra thì bảng phải đóng); VÀO phạm vi phải dừng hẳn mới tính. Nếu bắt cả hai đều
"phải dừng hẳn" thì đi xuyên qua rồi dừng ở xa vẫn giữ nhiệm vụ cũ đang mở.

`PhaserCanvas` giữ hai cờ trong `useRef` và đặt lại ngay sau khi cảnh dựng xong:
Phaser nạp bất đồng bộ, nên cờ có thể đổi TRƯỚC khi cảnh tồn tại, và lần đổi đầu
tiên sẽ rơi vào khoảng trống đó rồi mất hẳn nếu chỉ đặt trong `useEffect`.

Đã mô phỏng máy trạng thái trên đúng bốn quest thật của màn "Cơn bão bất ngờ"
(toạ độ và `icon_size` lấy từ DB), 5 kịch bản: đi xuyên qua khung `hull` để tới
chỗ khác → không mở; bấm giữa khung → mở; bấm mép trong khung `chest` → mở; đang
mở bảng mà bấm chỗ khác → nhân vật đứng yên; đóng bảng rồi đi → phát `LEFT` và đi
được tiếp.

**Sửa tiếp: dừng khi CHẠM khung, không đi tới đích.**

- [x] Đích rơi vào trong khung một nhiệm vụ → nhân vật đi tới **mép khung rồi
      dừng** và mở nhiệm vụ. Trước đó nó đi hẳn vào tâm, trông như nhân vật chui
      vào trong cái rương chứ không phải đứng cạnh nó. Đo trên bốn quest thật:
      dừng cách mép 3,5–4,0px, tức cách tâm 111–264px tuỳ cỡ ảnh.
- [x] Đích nằm ngoài mọi khung → **giữ nguyên**: đi thẳng tới đó, xuyên qua vật
      thể nào trên đường cũng không mở.
- [x] Bàn phím không có "điểm đích", nên luật tương đương là **chạm khung thì
      dừng và mở luôn**, không đợi nhả phím. Cùng một quy tắc với chuột.
- [x] **Bỏ hẳn hiệu ứng viền sáng** khi nhân vật vào khung. Dấu hiệu "đã tới" là
      chính bảng câu hỏi mở ra; vẽ thêm một ô vuông sáng phía sau nó là thừa.
      `outline` đổi tên thành `hitArea` cho đúng việc nó làm — hình chữ nhật
      không tô nền, không viền vẫn nhận cú bấm, nên nó vô hình mà vẫn là đích bấm.

`stopAtQuestEdge()` tìm t **nhỏ nhất** mà điểm đã nằm trong khung — ngược với
`clampToWalkArea()` vốn tìm t lớn nhất còn nằm trong vùng đi lại. Rồi nhích thêm
4px vào trong: dừng đúng trên đường biên thì sai số dấu phẩy động có thể làm
`Contains` trả false và bảng không mở.

Quyết định nằm ở **ĐÍCH, không ở đường đi**. Đó là chỗ phân biệt "vào nhiệm vụ"
với "đi ngang qua", và nó nằm gọn trong một hàm.

**Hai lỗi tìm ra khi cuối cùng cũng chạy được cảnh trong trình duyệt thật:**

- [x] **Bấm lên HUD làm nhân vật nhảy tới đó.** Phaser nghe `pointerdown` ở
      `window`, nên nó thấy cả cú bấm lên nút ✕ đóng bảng, nút `?`, nút rời màn.
      Bấm ✕ là nhân vật dịch chuyển tới góc phải trên.

      Cờ `inputLocked` KHÔNG chặn được: Phaser xếp sự kiện DOM vào hàng đợi rồi
      xử lý ở khung hình sau, mà React đã kịp mở khoá trong lúc đó. Sửa bằng cách
      chặn theo **nơi cú bấm rơi xuống** — `pointer.event.target !== game.canvas`
      thì bỏ qua. Không còn cuộc đua nào, và nó bao luôn mọi nút HUD sau này.

- [x] **`getScene()` trả `null` ngay sau `scene.start()`.** Phaser dựng cảnh
      trong bước boot, xảy ra sau. Đoạn "bắt kịp trạng thái cờ" thêm ở lượt trước
      gọi thẳng `scene.current.setTypingGuard(...)` nên ném `TypeError` **mỗi lần
      vào màn**. Lỗi rơi vào trong `.then()` của `import()` nên thành unhandled
      rejection: cảnh vẫn chạy, không ai thấy gì, chỉ có huy hiệu "1 Issue" của
      Next ở góc màn. Chuyển sang `callbacks.postBoot` — chỗ duy nhất chắc chắn
      cầm được cảnh.

**Nghiệm thu bằng mắt trong Chrome** (tài khoản học sinh, màn "Cơn bão bất ngờ"):
ảnh nền và bốn vật thể hiện đúng, nhãn nhỏ nằm trên đầu ảnh, không còn ô vuông
mờ nào; bấm vào rương → nhân vật dừng **ở mép rương** rồi bảng mở; bấm ra chỗ
khác lúc bảng đang mở → đứng yên; bấm ✕ → bảng đóng, nhân vật **không** nhảy đi;
bấm một điểm phía sau cột buồm → đi xuyên qua, không mở nhiệm vụ nào. Console
sạch.

**Bàn phím chết câm và biểu tượng hướng dẫn biến mất — hai nguyên nhân khác nhau:**

- [x] **Cờ `typing` kẹt ở `true`.** `QuestPanel` bật cờ bằng `onFocusCapture` và
      tắt bằng `onBlurCapture`. Nhưng **gỡ một phần tử đang giữ focus khỏi DOM
      KHÔNG sinh sự kiện `blur`** — focus lặng lẽ rơi về `<body>`. Nên chỉ cần
      bấm vào một ô nhập rồi đóng bảng là cờ kẹt vĩnh viễn: `update()` thoát ngay
      ở dòng đầu, chuột vẫn đi được còn W A D X thì chết tới khi tải lại trang.
      Sửa bằng effect dọn dẹp lúc unmount, cộng một chốt thứ hai ở `StagePlay`
      khi `activeQuestId` về `null` — hỏng lặng lẽ kiểu này đáng để chốt hai chỗ.
- [x] **Biểu tượng `?` gắn điều kiện `run.status === 'playing'`.** Nên đúng lúc
      người chơi lúng túng nhất — vừa thua, đang muốn đọc lại luật — thì nó biến
      mất. Bỏ điều kiện: một trang trợ giúp mà tự ẩn khi có sự cố thì để làm gì.
- [x] Sửa hai câu hướng dẫn đã lạc hậu: `enterZone` nói "bước vào khung" (giờ là
      "chạm rồi dừng"), `boundary` nói "chỉ đi được trong khoang tàu" (giờ đi được
      cả bản đồ).

**Một bài học về cách đo.** Lần đầu tôi đo trong một tab Chrome **không được vẽ**
(cửa sổ bị che). Trình duyệt tiết lưu `requestAnimationFrame`, nên vòng lặp Phaser
đứng: `update()` không chạy, `camera.getWorldPoint()` trả về ma trận đơn vị, và
`Page.captureScreenshot` treo. Tôi suýt kết luận rằng guard mới chặn nhầm mọi cú
bấm. Kiểm lại trong tab có vẽ thật (`game.loop.frame` tăng, `getWorldPoint(tâm)`
trả đúng `(1600,900)`) thì mọi thứ bình thường. **Trước khi tin số đo từ trình
duyệt, phải xác nhận trang đang thật sự được vẽ.**

**Bỏ nút "Mở nhiệm vụ" giữa màn hình.**

- [x] Đóng bảng rồi muốn mở lại thì **bấm lại vào chính vật thể đó**. Nhân vật
      đang đứng sẵn trong khung nên bảng bật lên ngay, không phải đi ra rồi đi vào.
      Một cái nút to giữa cảnh để làm việc mà cú bấm vào vật thể đã làm được thì
      chỉ tổ che mất cảnh.
- [x] Mọi lệnh "đi tới đây" gom về một cửa duy nhất, `goTo()` — bấm nền hay bấm
      vật thể đều qua đó. Ba nhánh: **đã đứng sẵn trong khung** → mở luôn, không
      đi đâu cả; đích trong khung khác → đi tới mép rồi dừng; đích ngoài mọi
      khung → đi thẳng, xuyên qua không mở.
- [x] Bỏ hẳn state `dismissedQuestId` và `nearQuestId`, cùng khoá `game.openQuest`.
      Chúng có từ thời `checkZones()` chạy mỗi khung hình và bảng tự bật lại ngay
      sau khi đóng. Giờ cảnh chỉ phát sự kiện khi người chơi **thật sự muốn vào**,
      nên cái cờ "vừa đóng" không còn việc gì để làm.

Nhánh 1 trước đây rơi vào một tween dài 250ms tới **chính chỗ đang đứng**, rồi
`settleZone()` thấy phạm vi không đổi nên im lặng — bấm mãi không có gì xảy ra.
`enterZone(node, force)` giải quyết: phạm vi không đổi thì bình thường không phát
gì, nhưng khi người chơi bấm lại vào khung họ đang đứng trong thì ý định đã rõ.

_(mục cũ)_

### Bước 5 cũ — Đưa game vào `web/`

- [ ] Chuyển `src/game/` (EventBus, GameState, StageScene, SpeechEngine) sang TypeScript
- [ ] `PhaserCanvas.tsx` — vòng đời Phaser ↔ React, `dynamic(ssr: false)`
- [ ] HUD React: top bar, mission tracker, English console, chat
- [ ] Nạp màn chơi từ API thật (`snapshot_json`), **bỏ `String.includes()`**, gọi API chấm
- [ ] Nút **Nộp bài** từng nhiệm vụ: gọi `POST /play/runs/{id}/quests/{qid}/answer`
- [ ] Phản hồi chỉ hai trạng thái: `MISSION COMPLETE` / `CHƯA HOÀN THÀNH + [THỬ LẠI]`
- [ ] Đếm lượt thử `x/maxAttemptsPerQuest`, hết lượt thì khoá nhiệm vụ trong lượt chơi
- [ ] **Schema phản hồi không được có** `score`, `detail_json`, `answer`, `skill_pts`
- [ ] Bảng tiến độ đội trong trận (ai xong nhiệm vụ nào) — chưa cần realtime ở bước này
- [ ] Sửa bug đáp án bám `currentTaskIndex` — kiểm tra theo vật thể đang chọn
- [ ] Năng lượng thành **một quỹ chung của đội**
- [ ] Chữ tiếng Việt sang `messages/`; màu theo token; asset qua `media_assets`
- [ ] Đổi tên asset về `a-z0-9-_`, gỡ trùng lặp `src/assets` ↔ `public/assets`
- [ ] **Nghiệm thu: chơi lại được Màn 1 như bản Vite, nhưng dữ liệu từ API**

### Bước 6 — Giao diện học sinh

- [x] `GET /play/worlds` + `GET /play/worlds/{id}` — đường đọc nội dung cho học sinh
- [x] `/play` — bản đồ thiên hà (S0)
- [x] `/play/world/[id]` — chi tiết world, chương/màn, tiến độ (S1, S2)
- [ ] `/play/world/[id]/stage/[sid]` — chi tiết màn (S3)
- [x] Logic unlock theo `required_skill_pts` + nhảy bậc
- [x] **Chế độ chơi thử**: thanh cảnh báo, thấy `draft`, bỏ qua khoá
- [ ] Xoá tiến độ của lượt chơi thử
- [ ] Phòng `is_trial` không hiện ở danh sách phòng công khai
- [x] **Nghiệm thu phụ: tài khoản giáo viên chơi thử được Màn 1 khi màn còn `draft`**
- [ ] **Nghiệm thu: đi từ `/play` chọn world, chọn màn, vào chơi được** — đường API
      đã thử chạy thật, còn phải bấm bằng tay trong trình duyệt

**Vì sao học sinh không thấy gì dù world đã phát hành.** Hai chỗ thiếu, không
phải một: trang `/play` vẫn là chỗ giữ chỗ của Bước 1, **và** học sinh không có
endpoint nào để đọc danh sách world — `/worlds` gắn
`require_role(TEACHER, ADMIN)`. Nút "Phát hành" vẫn chạy đúng suốt thời gian đó;
chỉ là chưa có gì đọc kết quả của nó.

**Khoá màn kiểm ở backend, không chỉ ở giao diện.** `POST /play/stages/{id}/start`
tự so `world_progress.skill_pts` với `required_skill_pts` và trả `STAGE_LOCKED`
(409). Một cái nút bị làm mờ chỉ ngăn được người bấm chuột, không ngăn được người
gõ thẳng URL. Giáo viên và admin đi qua `UserRole.CAN_PREVIEW` nên không bị chặn.

**`pickText()` chuyển từ `stage-builder.tsx` sang `lib/i18n-text.ts`.**
`stage-builder.tsx` có `'use client'`, nên mọi Server Component muốn hiện một cái
tên đa ngữ đều phải kéo cả trình dựng màn chơi vào gói tải về.

**Còn hở:** `PATCH /stages/{id}` không đặt lại `required_skill_pts` về `null`
được — gửi `null` bị hiểu là "không gửi trường này", nên một khi đã đặt số thì
không quay về "thừa kế từ `balance_json`" bằng giao diện. Phát hiện lúc kiểm thử
đường khoá màn.

### Bước 6b — Ngôn ngữ: mặc định tiếng Anh, đổi được bằng một cú bấm

- [x] `DEFAULT_LOCALE = 'en'` — tiếng Anh không tiền tố, tiếng Việt là `/vi/...`
- [x] `localeDetection: false` — không dò `Accept-Language`
- [x] `web/src/i18n/locales.ts` — một nguồn cho danh sách ngôn ngữ
- [x] `LocaleSwitcher` ở thanh trên cùng **và** ở màn đăng nhập
- [x] Cookie `vf_locale` nhớ lựa chọn cho những URL không có tiền tố
- [x] `pickText()` / `ownText()` — tách chữ ĐỂ HIỆN khỏi chữ ĐỂ SỬA

**Trước đó mặc định là tiếng Việt và không có lối đổi ngôn ngữ nào** ngoài việc
tự gõ `/en/...` vào thanh địa chỉ. Hai file dịch đều đủ 365 khoá từ đầu — thiếu
là đường vào, không phải bản dịch.

**Vì sao tắt dò theo trình duyệt.** `localeDetection: true` cho next-intl đọc
`Accept-Language`; gần như mọi máy ở đây cài tiếng Việt, nên người dùng bị đá
sang `/vi` ngay lần vào đầu tiên và "mặc định tiếng Anh" chỉ đúng trên giấy.

**Vì sao cookie tên `vf_locale` chứ không phải `NEXT_LOCALE`.** Hồi mặc định còn
là tiếng Việt, next-intl ĐÃ ghi `NEXT_LOCALE=vi` vào máy mọi người từng mở
trang. Đọc lại tên cũ thì đúng những người đã dùng sản phẩm lại là những người
không bao giờ thấy được mặc định mới. Phát hiện lúc mở thử trong Chrome: trang
`/login` bị đẩy thẳng sang `/vi/teacher` vì cookie cũ còn nằm đó. Tên mới bắt
đầu từ con số không, và vì chỉ bộ chọn ghi nó nên nó tồn tại đồng nghĩa với
"người dùng đã tự tay chọn".

**Lỗi tìm thấy nhân tiện: ô nhập tên mượn bản dịch của ngôn ngữ khác.** Bốn chỗ
(`stage-designer`, `stage-builder`, `world-detail`, `quest-editor-dialog`) đổ
`name_i18n?.[locale] ?? name_i18n?.vi` vào `defaultValue` rồi ghi ngược lại
`{ ...name_i18n, [locale]: giá_trị }`. Màn chơi đặt tên tiếng Việt, mở dưới giao
diện tiếng Anh, người soạn chỉ cần rời chuột là tên tiếng Việt bị lưu thành tên
tiếng Anh — không ai gõ chữ nào. Lỗi có sẵn từ trước, nhưng đổi mặc định sang
tiếng Anh biến nó từ hiếm thành thường: từ giờ mọi thứ soạn mới đều mang nhãn
`en`. Sửa bằng cách tách `ownText()` (ô nhập, không mượn) khỏi `pickText()`
(chỗ hiện, mượn được), và đưa bản mượn xuống `placeholder`.

**`pickText()` trả về chuỗi rỗng, không phải `'—'`.** Cái `'—'` cũ là một quyết
định hiển thị nằm nhầm trong một hàm dữ liệu: nó là chuỗi "đúng", nên
`pickText(...) || quest.quest_object_key` ở hai chỗ trong `stage-designer` không
bao giờ chạy tới vế sau — nhiệm vụ chưa đặt tên hiện `—` thay vì `chest`.

**Nghiệm thu.** Middleware, 5 nhánh chuyển hướng bằng `curl`:

| Vào | Cookie | Ra |
|---|---|---|
| `/` | — | `/login` |
| `/` | `NEXT_LOCALE=vi` (cũ) | `/login` — bỏ qua, đúng ý |
| `/` | `vf_locale=vi` | `/vi/login` |
| `/` | `vf_locale=zz` | `/login` |
| `/teacher` | `vf_locale=vi` | `/vi/login?next=/vi/teacher` |

`Accept-Language: vi-VN` vào `/` vẫn ra `/login`.

Trong Chrome: bấm một cái ở `/vi/teacher/questions?type=mcq` sang `English` →
`/teacher/questions?type=mcq`, cả giao diện đổi, **query giữ nguyên**. Ô tên màn
"Rung tao phat quang" (chỉ có bản `vi`) dưới giao diện `en` → ô TRỐNG, placeholder
là tên tiếng Việt; dưới `vi` → đúng giá trị thật.

**Còn hở:** `users.locale` trong DB không ai đọc. Ngôn ngữ hiện nhớ theo trình
duyệt, không theo tài khoản — đăng nhập ở máy khác là về lại tiếng Anh. Muốn nhớ
theo người thì cần một endpoint ghi `users.locale` và cho middleware đọc từ
phiên; chưa làm.

### Bước 6c — Nhịp thở cho ảnh vật thể nhiệm vụ

- [x] `quests.pulse_percent` (0..50) + `quests.pulse_period_ms` (400..4000) — migration `0008`
- [x] Chạy suốt: model → schema → router → **snapshot** → cảnh Phaser
- [x] Hai thanh trượt trong trình thiết kế, **xem trước ngay trên khung soạn**
- [x] `resolvePulse()` trong `game/world.ts` — một hàm cho cả CSS lẫn Phaser

**Một nguồn quy đổi cho hai cách vẽ.** Khung soạn dùng CSS animation, cảnh chơi
dùng tween Phaser — hai công nghệ khác hẳn nhau, nhưng cùng gọi `resolvePulse()`.
Nếu mỗi bên tự quy đổi thì sớm muộn cũng lệch, và giáo viên chỉnh xong vào chơi
thấy khác. Chỗ dễ lệch nhất là **chia đôi chu kỳ**: cả `animation-direction:
alternate` lẫn `yoyo: true` đều chạy một lượt ĐI trong khoảng thời gian được
cho rồi mới quay lại, nên "một nhịp đầy đủ" của giáo viên bằng hai lượt.

**Nhân với tỉ lệ đang có, không đặt tỉ lệ tuyệt đối.** Tween cũ của vòng sáng
đặt thẳng `scaleX: 1.2` — đúng với hình ellipse vì nó đang ở tỉ lệ 1. Ảnh thì
khác: `setDisplaySize()` đã để lại `scaleX` cỡ 0,3 cho một ảnh 400px thu về
120px, nên tween tới `1.08` sẽ phóng ảnh lên gấp ba rồi giữ nguyên ở đó.

**Chỉ đổi cách vẽ, không đổi vùng va chạm.** `box` và `hitArea` giữ nguyên kích
thước theo `icon_size`. Cho khung phập phồng theo ảnh là để đích bấm chạy dưới
tay người chơi, và chỗ nhân vật dừng lại đổi theo từng khoảnh khắc.

**`null` khác `0`.** `null` = "chưa đặt, lấy mặc định của cảnh", `0` = "tắt hẳn".
Đó là lý do hai cột để `nullable` thay vì mặc định `0`.

**Ba tầng dùng chung một khoảng.** CHECK constraint, `Field()` của Pydantic và
thanh trượt đều là 0..50 và 400..4000. Cho API rộng hơn giao diện là tạo ra một
vùng giá trị hợp lệ mà không nút bấm nào chạm tới được.

**Bỏ chốt `prefers-reduced-motion` — quyết định có cân nhắc, không phải bỏ sót.**
Bản đầu tôi có kiểm, và phát hiện máy đang dùng bật sẵn "giảm chuyển động"
(`MinAnimate = 0` trong registry Windows) nên hiệu ứng tắt câm. Nghĩ lại thì
chốt đó sai chỗ: cài đặt kia dùng để chặn chuyển động TRANG TRÍ, còn nhịp thở ở
đây là thứ duy nhất phân biệt vật thể bấm được với hình vẽ trên nền. Trong một
trò chơi nhiều người, tắt nó theo cài đặt từng máy nghĩa là hai đứa trẻ chơi
chung một màn mà một đứa thấy gợi ý, đứa kia phải bấm mò. Nút tắt vẫn có, nhưng
nằm ở tay giáo viên và tắt cho cả lớp cùng lúc.

**Thanh trượt chứ không phải ô số, và ghi xuống server khi THẢ TAY.** Thứ đang
chỉnh là một cảm giác — cách duy nhất để biết 8% có phải 8% mình muốn là nhìn nó
thở trong lúc kéo. Kéo một nhịp bắn ra hàng chục sự kiện; gửi từng cái là hàng
chục lượt `PATCH` cho một lần chỉnh, nên bản nháp giữ ở client và chỉ lưu lúc
nhả chuột. So với **giá trị đã quy về mặc định** chứ không so với cột trong DB:
cột `null` mà so thẳng thì bấm một cái vào thanh trượt (không kéo) cũng thành
"khác `null`" và ghi xuống đúng con số mặc định vừa thay thế.

**Nghiệm thu.** Trong Chrome, màn "The Sudden Storm":

| Việc | Kết quả |
|---|---|
| Mở trình thiết kế | 4/4 ảnh chạy `quest-pulse`, `1.08` / `0.8s` — đúng mặc định |
| Kéo độ phồng lên 35% | chỉ ảnh ĐANG CHỌN đổi `--quest-pulse-max` sang `1.35` |
| Thả tay | `PATCH` một lần, DB `hull: 35/1600` |
| Kéo nhịp về 800ms | CSS `animation-duration: 0.4s` (nửa nhịp), DB `35/800` |
| Kéo độ phồng về 0 | chữ đổi thành "off", thanh nhịp mờ đi, ảnh rời khỏi `.quest-pulse` |
| Vào chơi thật (50% / 400ms) | ba lần chụp cùng một khung → ba kích thước rương khác nhau |

Snapshot dựng lại ở mỗi lượt chơi mới, nên đổi thông số là vào chơi thấy ngay,
không phải phát hành lại màn.

**Còn hở:** `PATCH /quests/{id}` không đặt lại `pulse_percent`/`pulse_period_ms`
về `null` được — cùng đúng một lỗi với `pass_score` và `required_skill_pts`: gửi
`null` bị hiểu là "không gửi trường này". Ở đây hậu quả nhẹ (đặt tay đúng 8/1600
cho ra hình ảnh y hệt mặc định), nhưng đây là lần thứ BA gặp lại nó — đáng làm
một cờ `clear_*` dùng chung, hoặc đổi `_apply` sang đọc `model_fields_set`.

### Bước 6d — Tên nhiệm vụ: bỏ khung nền, chữ trắng viền đen

- [x] Cảnh Phaser: `stroke: '#000000'` + `strokeThickness: LABEL.STROKE`, bỏ `backgroundColor`
- [x] Trình thiết kế: `-webkit-text-stroke` + `paint-order: stroke fill`, bỏ `bg-abyss-950/85`

**Vì sao bỏ khung.** Bốn cái hộp đen nổi trên boong tàu che mất chính cái cảnh
mà chúng đang chú thích. Nét viền đọc được trên cả nền sáng lẫn nền tối mà không
lấy đi một mảng hình nào — đây là cách phụ đề trong game vẫn làm.

**Bề dày viền = 1/5 cỡ chữ, ở CẢ HAI bên.** Cảnh chơi vẽ ở 40px nên viền 8px;
trình thiết kế hiện ở 11px nên viền 2,2px. Cùng một tỉ lệ, nên thiết kế thấy sao
thì chơi thấy vậy. Bề dày ở cảnh chơi tính theo cỡ VẼ nên nó thu nhỏ cùng chữ
trong `rescaleLabels()`, không phải chỉnh thêm.

**`paint-order: stroke fill` là phần bắt buộc bên CSS**, không phải trang trí.
`-webkit-text-stroke` vẽ nét CHÍNH GIỮA đường viền glyph; thiếu `paint-order`
thì nửa trong của nét ăn vào thân chữ và chữ 11px gầy đi thấy rõ. Phaser không
cần khai báo gì tương ứng vì `Text.js` gọi `strokeText()` rồi mới `fillText()`
đè lên — đọc `node_modules/phaser/src/gameobjects/text/Text.js:1439-1477`.

**Đệm giữ lại, dù không còn nền.** `padding: { x: STROKE, y: STROKE }` giờ vô
hình; bỏ hẳn thì Phaser cắt cụt nét viền ở mép texture.

**Nhân tiện khớp lại `font-weight`.** Trình thiết kế đang `font-medium` còn cảnh
chơi `fontStyle: 'bold'` — lệch có sẵn từ trước. Đổi trình thiết kế sang
`font-bold`.

**Nghiệm thu.** Computed style của nhãn trong trình thiết kế: nền
`rgba(0,0,0,0)`, chữ `rgb(255,255,255)`, viền `2.2px rgb(0,0,0)`, `paint-order`
được Chrome nhận (trả về `stroke`), `font-weight: 700`, `font-size: 11px`.

**Chưa nhìn tận mắt được phía cảnh chơi:** tab Chrome ở trạng thái `hidden` suốt
lượt này nên `Page.captureScreenshot` hết giờ — cùng đúng cái bẫy đã ghi ở Bước
5. Phần đổi là một cú thay `TextStyle`, và thứ tự vẽ stroke-rồi-fill đã kiểm
trong mã nguồn Phaser; nhưng bề dày nhìn thực tế thì chưa ai xác nhận.

### Bước 6e — Lối thoát đúng chỗ, và chương rỗng không hiện

- [x] `RunOut.world_id` — dữ liệu điều hướng, KHÔNG nhét vào `snapshot`
- [x] Nút **Leave** và nút **Về world** ở màn kết thúc → `/play/world/{id}`
- [x] `GET /play/worlds/{id}` bỏ qua chương không có màn nào hiện được

**`world_id` đặt ở `RunOut`, không ở `snapshot`.** Snapshot là ĐỀ BÀI đóng băng;
đây là dữ liệu điều hướng và nó không bao giờ đổi theo thời gian. Để trong
snapshot thì mọi lượt chơi cũ đều thiếu trường, đổi lấy đúng con số không lợi
ích. `_run_out()` vốn đã nạp `world` để đọc `balance_json`, nên thêm trường này
không tốn thêm truy vấn nào.

**Nút "Về world" ở màn kết thúc vẫn luôn mang đúng cái tên đó** (`game.backToWorld`)
— chỉ có đích là sai, nó trỏ về bản đồ thiên hà. Sửa cùng lúc với Leave.

Lối thoát ở màn BÁO LỖI thì vẫn về `/play`: lúc đó chưa nạp được lượt chơi nào
nên không có `world_id` để mà về đúng chỗ.

**Chương rỗng lọc ở SERVER, không ở giao diện.** Một tiêu đề chương kèm dòng
"chưa có màn chơi nào" là lời nhắn cho giáo viên, hiện nhầm chỗ: học sinh không
làm được gì với nó ngoài việc tưởng trò chơi hỏng. Lọc theo `out_stages` chứ
không theo "chương có màn nào không" — với học sinh `visible_stages()` chỉ trả
màn đã xuất bản, nên chương toàn bản nháp cũng rỗng y như chương chưa có gì; còn
giáo viên chơi thử thì bản nháp vẫn tính nên họ vẫn thấy. Màn soạn
`/teacher/worlds/{id}` vẫn hiện đủ mọi chương — đó mới là nơi tin "chương này
đang rỗng" có ích.

Nhánh `chapter.stages.length === 0` bên `world-stages.tsx` và khoá dịch
`play.noStagesInChapter` xoá theo: giữ một nhánh không bao giờ chạy là giữ một
lời hứa sai về những gì màn hình đó có thể hiện.

**Nghiệm thu.** World "Lost in Atlantis" có 5 chương, 2 chương có màn:
`GET /play/worlds/{id}` trả đúng 2 chương, trang chỉ vẽ 2 tiêu đề (trước là 5,
ba cái kèm dòng "chưa có màn chơi nào"). Nút Leave trong DOM:
`/play/world/01a0373c-…`.

**Chưa nhìn tận mắt được nút "Về world" ở màn kết thúc.** Muốn tới đó phải để
hết giờ; tab Chrome ở trạng thái `hidden` nên Chrome đóng băng hẳn `setInterval`
— rút `time_limit_seconds` xuống 12 giây thì đồng hồ vẫn đứng ở 00:06. Đã trả
`time_limit_seconds` về 300. Nút này nhận `worldId={run.world_id}` và dùng đúng
biểu thức `localizedPath` như nút Leave cách đó vài dòng, `tsc` kiểm kiểu prop.

### Bước 6f — Trình thiết kế bản đồ thiên hà (màn chọn world)

- [x] Migration `0009`: `galaxies.background/music_media_id`; `worlds.scene_x/scene_y/icon_size/pulse_*/is_locked`
- [x] `GET /galaxies` · `PATCH /galaxies/{id}` · `GET /play/galaxy`
- [x] `/teacher/worlds/design` — ảnh nền, nhạc nền, thêm world, kéo thả, đổi cỡ, khoá, nhịp thở, lời giới thiệu
- [x] Màn học sinh vẽ lại theo toạ độ, kèm popup trồi lên khi rê chuột
- [x] Tách `useDesignBoard()`, `PulseFields`, `WorldOrb` — dùng chung với trình thiết kế màn chơi

**Vòng tròn làm ba việc, nên nó là MỘT hình chứ không phải hai.** Bản thiết kế
ban đầu tách "khung ảnh" khỏi "vòng crop", tức ba cột nữa và một bộ tay cầm thứ
hai. Gộp lại: `icon_size` là đường kính vòng tròn, ảnh bị mask theo nó, vành
ngoài là thanh tiến độ, và tay cầm đổi cỡ có sẵn của trình thiết kế màn chơi
dùng lại được nguyên vẹn.

**`is_locked` là cột riêng, không suy ra từ số màn đã xuất bản.** Suy ra thì gọn
hơn, nhưng giáo viên mất khả năng khoá một world đã có nội dung — đang sửa dở,
để dành học kỳ sau. Migration lấp `false` cho world CŨ rồi mới đặt mặc định
`true`: thêm thẳng với `server_default true` là khoá sạch mọi world đang chạy,
và một migration không được làm biến mất nội dung đang phục vụ người dùng.

**`GET /play/galaxy` trả nền, nhạc và danh sách world trong MỘT lượt.** Chúng
dựng nên một màn hình; tách làm hai lượt gọi thì màn hình vẽ hai lần và có một
khoảnh khắc các world nổi trên nền trống. Endpoint `GET /play/worlds` cũ bỏ đi —
giữ cả hai là giữ hai đường tới cùng một thứ.

**Nhạc nền KHÔNG tự phát.** Trình duyệt chặn âm thanh tự chạy trước khi người
dùng chạm vào trang, nên `autoplay` chỉ đem lại một thẻ audio im lặng và một
cảnh báo trong console. Có nút bấm, người chơi tự mở.

**Popup giới thiệu nằm ở ĐÁY khung, không bám theo con trỏ.** Bám theo con trỏ
thì nó che mất chính cái world đang được trỏ vào, và nhảy loạn khi rê qua nhiều
world liền nhau.

**World khoá không phải là một liên kết.** Làm mờ một thẻ `<a>` thì nó vẫn bấm
được bằng bàn phím, và bấm vào là học sinh rơi vào một world trống.

**Tái sử dụng là có thật, đo được:** `stage-designer.tsx` từ 835 xuống 683 dòng
sau khi chuyển sang `useDesignBoard()` và `PulseFields`. Không phải viết thêm
một bản sao rồi gọi đó là dùng chung.

**Nghiệm thu trong Chrome.**

| Việc | Kết quả |
|---|---|
| Thêm world chỉ bằng cái tên | tạo được, `is_locked = true`, hiện 🔒 |
| Bỏ khoá | DB `is_locked = false`, biểu tượng đổi sang 🔓 |
| Gõ lời giới thiệu | lưu vào `story_i18n` theo ngôn ngữ đang bật |
| Kéo world | `(1600,900) → (607,419)`, đúng phép quy đổi màn hình → thế giới |
| Kéo tay cầm góc | `icon_size 360 → 710` |
| Kéo thanh độ phồng | xem trước `--pulse-max: 1.22`, thả tay lưu `22/1600`, KHÔNG đụng world khác |
| World chưa đặt toạ độ | rải đều hàng ngang ở CẢ hai màn (`defaultWorldSpot`) |
| Màn học sinh | đúng vị trí/đường kính đã đặt, "3%" cho 1/30 mảnh |
| Rê chuột vào world | popup trồi lên, đủ tên + số mảnh + lời giới thiệu |
| Trình thiết kế MÀN CHƠI sau refactor | kéo `chest` 751 → 938 rồi trả lại; 4 nhiệm vụ nguyên vẹn |

**Bố cục: bảng sửa world nằm NGANG, ngay dưới khung xem trước.** Ban đầu nó xếp
dọc ở cột phải, và cột đó dài quá màn hình — cuộn xuống tới ô đang sửa thì cái
world đang sửa đã trôi mất, tức là mất luôn lý do tồn tại của một trình thiết kế
trực quan. Ba việc, không phải một:

1. Bảng sửa chuyển xuống dưới khung xem trước, xếp thành **bốn cột** (tên+khoá ·
   lời giới thiệu · ảnh · nhịp thở).
2. Trần chiều cao cho khung xem trước, đặt bằng `max-width` chứ KHÔNG bằng
   `max-height`: `aspect-ratio` nhường chỗ cho `max-height`, nên chặn chiều cao
   là khung bị bẹt và giáo viên căn bố cục trên một tỉ lệ học sinh không bao giờ
   thấy. Chặn bề rộng thì chiều cao tự co và 16:9 còn nguyên.
3. `sticky` cho khung xem trước. Không có con số `vh` nào đúng cho mọi cửa sổ;
   cửa sổ thấp quá thì vẫn phải cuộn, và khi đó khung ghim lại ở đỉnh.

Lớp `relative` bỏ đi khỏi khung: hai lớp cùng đặt `position` thì cái nào thắng
là do thứ tự Tailwind sinh CSS, không phải thứ tự viết trong `className` — nó
đang chạy đúng vì tình cờ. `sticky` cũng đã tạo gốc toạ độ cho các world
`absolute` bên trong, y như `relative`.

Trần đặt ở **51vh** — cao quá nửa cửa sổ. Bản đầu để 34vh cho vừa hẳn một màn
hình không cuộn, nhưng khung xem trước bé quá thì căn chỗ bằng mắt lại thành
đoán. Đây đúng là chỗ `sticky` đáng giá: khung to gấp rưỡi, trang dài thêm, mà
vẫn không có lúc nào nhìn bảng sửa mà mất khung.

Đo ở cửa sổ 1441×793: khung xem trước `719×404` ở `y 230…634`, cả trang cao
`982`. Cuộn hết xuống (189px) thì khung ghim ở `41…445` còn bảng sửa bắt đầu ở
`485` — **cả hai cùng nằm gọn trong một màn hình**, mà là ở cuối trang chứ không
phải chỉ ở đầu. Cột phải từ chỗ dài nhất trang thành `502px`.

Kéo thả sau khi đổi sang `sticky` và đổi cỡ: kéo 60px màn hình trên khung rộng
719 ra `x = 1318`, dự kiến `1050 + 60/719×3200 = 1317` — lệch 1 do làm tròn.

**Vành tròn thành một công tắc (`show_ring`, migration `0010`), mặc định TẮT —
và tắt nghĩa là BỎ HẲN cái đĩa, không chỉ bỏ nét vành.**

Bản đầu tôi hiểu công tắc chỉ tắt nét vành, còn ảnh vẫn bị mask tròn trên nền
`bg-abyss-800`. Sai: ảnh nào không vuông thì lòi ra một vành xanh đậm quanh
mình, và giáo viên đặt bề rộng 380 lại thấy một hình khác hẳn thứ họ tải lên.

Luật đúng, và nó vốn đã có sẵn ở chỗ khác trong sản phẩm: `icon_size` là **bề
rộng**, chiều cao suy ra theo tỉ lệ gốc, ranh giới của world **chính là** ranh
giới của ảnh — y hệt `quests.icon_size` bên màn chơi.

Bật `show_ring` thì đổi hẳn cách vẽ: huy hiệu tròn, ảnh bị mask, vành ngoài là
thanh tiến độ. Ép tròn ở chế độ đó không tuỳ tiện — một thanh tiến độ hình vành
khuyên thì phải có hình tròn để chạy quanh.

Bo góc của viền "đang chọn" và xem trước ảnh trong bảng sửa đều bám theo chế độ:
tròn khi bật vành, vuông bo nhẹ khi tắt. Một viền tròn quanh một ảnh chữ nhật là
vẽ lại đúng cái đĩa vừa bỏ.

Đặt `server_default false` cho cả world đã có, không chỉ world mới: bật sẵn một
thứ trang trí cho mọi người rồi bắt họ đi tìm chỗ tắt là làm ngược.

Kiểm: mặc định `background-color: rgba(0,0,0,0)`, `border-radius: 0`,
`aspect-ratio: auto`, `object-fit: contain`, 0 thẻ `<svg>` — tức không còn dấu
vết nào của cái đĩa. Bật cho một world thì đúng world đó `aspect-ratio: 1/1` +
`1 svg` + viền nút tròn, world kia vẫn `auto` + `0 svg` + viền `8px`.

**Ba chỗ sửa sau khi dùng thật:**

1. **Thêm world xong thì CHỌN LUÔN world đó.** Việc kế tiếp chắc chắn là đặt ảnh
   và viết lời giới thiệu; bắt người ta bấm thêm một lần vào cái tên mình vừa gõ
   là thêm một bước không mang thông tin gì. `setSelectedId()` gọi SAU
   `reload()` — gọi trước thì danh sách chưa có id đó, bảng sửa nhấp một cái rồi
   mới hiện.

2. **Bỏ hẳn việc làm mờ ảnh.** Bản trước hạ độ mờ 60% cho world còn ở dạng nháp.
   Hậu quả: mọi world vừa tạo đều xỉn màu, và người dùng đọc ra "hỏng" chứ không
   đọc ra "chưa phát hành" — đúng như báo lại. Trạng thái nói bằng biểu tượng: khoá
   thì có ổ khoá ở giữa, còn màu của bức tranh là màu giáo viên đã chọn. Prop
   `dimmed` xoá khỏi `WorldOrb`, không để lại lối nào làm việc đó nữa.

3. **Khung bao "to quá" — đo ra thì không phải lỗi của khung.** `wrapper`,
   `button` và `img` khớp nhau từng pixel; nhãn tên cách mép ảnh 0–4px. Chỗ thừa
   nằm BÊN TRONG file: ảnh 500×500 nhưng hình vẽ chỉ chiếm phần giữa, quanh nó
   là lề trong suốt. Có thể cắt tự động bằng cách đọc kênh alpha — tôi đã dựng
   thử rồi **bỏ đi theo yêu cầu**: đó là đoán ý người ta muốn thấy gì, và người
   ra tấm ảnh mới là người biết đâu là mép. Ghi rõ trong `WorldOrb` để lần sau
   không ai "sửa" lại.

**Khung tiêu đề + khung mô tả (migration `0011`).** Hai tấm ảnh trang trí trên
bản đồ, giáo viên tải lên, kéo chỗ và đổi cỡ như world. Lúc nghỉ mang tên và mô
tả thiên hà; rê chuột vào một world thì đổi sang của world đó.

- **Khung đứng yên, chỉ chữ đổi.** Vẽ lại một bộ khung cho từng world nghĩa là
  bản đồ nhấp nháy đổi hình mỗi lần con trỏ đi ngang, mà con trỏ đi ngang liên tục.
- **Khung TIÊU ĐỀ luôn nằm trên khung mô tả** (`FRAME[kind].z`, 20 so với 10).
  Hai tấm bảng này gần như chắc chắn chồng nhau — dáng thường gặp là dải băng
  tên gác lên mép trên tấm bảng lớn. Không nói rõ thứ tự thì cái nào vẽ sau nằm
  trên, tức tấm bảng mô tả nuốt mất dải băng tên, và người kéo tưởng mình vừa
  làm mất cái khung. Đặt `zIndex` chứ không dựa vào thứ tự viết JSX: đảo hai
  dòng lúc sửa là đảo luôn cái nào che cái nào mà không có gì báo rằng điều đó
  quan trọng. Chỗ mặc định cũng đặt sẵn theo dáng đó.
- **Cỡ chữ bằng `cqw`, không bằng `px`** — phần trăm bề rộng CỦA KHUNG. Kéo khung
  to nhỏ thì chữ co giãn đúng tỉ lệ ở mọi cỡ màn hình; `px` cố định thì khung nhỏ
  lại là chữ tràn qua viền, khung to ra là chữ lọt thỏm giữa một tấm biển trống.
- **MỘT bộ kéo thả cho cả world lẫn khung**, rẽ nhánh theo id (`frame:title` /
  `frame:desc` — id world là UUID nên không đụng). Dựng hai bộ thì cả hai cùng
  nghe chuột trên một `window` và cùng phản ứng với một cú kéo.
- Popup trồi lên từ đáy ở bản trước bỏ đi. Nó chạy đúng, nhưng chỗ đặt và dáng
  của nó do lập trình viên quyết; giờ cái bảng là một phần của bức tranh chứ
  không phải một hộp thoại đắp lên trên nó.
- Tên và mô tả THIÊN HÀ sửa ngay trong cùng cái thẻ: chúng là chữ mặc định nằm
  trong hai cái khung, nên chỗ chỉnh chúng phải ở cạnh chỗ chỉnh khung.

**Màu chữ và cỡ chữ (migration `0012`), đặt cho KHUNG chứ không cho từng world.**
Chữ của thiên hà và chữ của mọi world đều hiện ra ở đúng hai chỗ đó; cấu hình
riêng từng world nghĩa là rê chuột qua ba world là chữ đổi màu ba lần.

`*_font` lưu theo **phần trăm** so với cỡ nền (100 = giữ nguyên, 40…250), không
lưu số tuyệt đối: cỡ chữ thật tính theo bề rộng CỦA KHUNG (`cqw`), nên một con
số `px` trong database sẽ sai ngay khi ai đó kéo cái khung to ra. Giáo viên
chỉnh "to hơn / nhỏ hơn", cỡ nền thì ta giữ.

Hai cái khung cấu hình y hệt nhau nên gộp thành MỘT vòng lặp `['title','desc']`
trong trình thiết kế, không phải hai khối chép đôi — tên cột đều là `${kind}_*`.

**Cột phải TỰ CUỘN, không cuộn cả trang** (`sticky` + `overflow-y-auto` trên
cùng một thẻ, chỉ từ `lg` trở lên). Bảng cài đặt dài hơn màn hình là chuyện
thường; cuộn cả trang thì khung xem trước trôi lên mất. Dưới `lg` thì hai cột
xếp chồng thành một dòng dọc, và một ô cuộn lồng trong một trang cuộn là thứ
trên điện thoại không ai điều khiển nổi — nên tắt.

Đo: cột phải cao `717px` chứa nội dung `1280px`, cuộn nó xuống 400 thì
`window.scrollY` không đổi và mép trên khung xem trước đứng nguyên ở `133`.

**Khung xem trước đổi chữ theo world đang chọn / đang rê.** Bên học sinh rê
chuột là chữ đổi, nên bên soạn phải thấy đúng như vậy — không thì giáo viên
chỉnh màu và cỡ chữ trên một câu chữ không phải câu sẽ hiện ra. Thứ tự ưu tiên:
rê > chọn > thiên hà. Rê thắng vì nó nhất thời — buông chuột là quay lại world
đang sửa. Đo bốn trạng thái: nghỉ `Milky Way`, bấm `Enchanted Forest` → tên +
mô tả của nó, rê sang `Science Planet` → đổi theo, rời chuột → về lại
`Enchanted Forest`.

**Hai lỗi trình bày chỉ lộ ra khi nhìn ảnh chụp**, không lộ khi đọc DOM:

1. Nhãn + ô màu + nhãn + thanh trượt + số phần trăm xếp NGANG không lọt bề rộng
   cột phải — nhãn xuống dòng, con số `100%` bị cắt mất đuôi. Tách thành hai dòng.
2. Ô chọn màu hiện ra là một khung TRẮNG dù giá trị bên trong là `#04121f`.
   Chrome bọc ô màu trong `::-webkit-color-swatch-wrapper` có đệm và nền sáng
   riêng; `p-0` trên chính thẻ `input` không chạm tới nó. Phải nhắm thẳng vào
   phần ruột đó (và `::-moz-color-swatch` cho Firefox).

Nghiệm thu màu/cỡ chữ: đổi màu tiêu đề sang `#7a2e0b` → xem trước ra
`rgb(122,46,11)`, DB lưu đúng; kéo cỡ chữ 100% → 160% → cỡ vẽ `14.11px` thành
`21.10px`. Tỉ lệ đo được là `1.494` chứ không phải `1.60` vì khung soạn hẹp lại
từ `719` xuống `672` giữa hai lần đo (thanh cuộn xuất hiện) — cỡ chữ khung MÔ TẢ
cũng đổi theo đúng hệ số `0.934` đó dù không ai đụng vào nó, và `1.494 / 0.934 =
1.60`. Đúng là `cqw` đang làm việc của nó.

Nghiệm thu: kéo khung tiêu đề `−70px` màn hình trên khung rộng 719 → `title_x`
từ mặc định `1600` xuống `1288` (dự kiến `1600 − 70/719×3200 = 1289`); kéo tay
cầm → `title_width 1000 → 1372`, vị trí không đổi. Màn học sinh: lúc nghỉ hai
khung mang `"Milky Way"` + mô tả thiên hà, rê vào Science Planet thì đổi sang
tên và mô tả của world đó.

**Bản đồ thiên hà hiện MỌI world, world khoá có ổ khoá và không bấm được.**

Trước đó học sinh chỉ thấy đúng một world: danh sách đi qua `visible_worlds()`,
vốn lọc bỏ world `draft`. Ba world còn lại biến mất hẳn khỏi bản đồ thay vì hiện
ra kèm ổ khoá.

Ba mảnh, không phải một:

1. Danh sách bỏ bộ lọc phát hành — bản đồ là chỗ để nhìn thấy cả hành trình,
   không chỉ chặng đang mở.
2. `is_locked` trả về giá trị **đã tính**: cột `is_locked` **HOẶC** chưa có màn
   nào phát hành. Vế thứ hai phải đếm màn nên giao diện không tự suy ra được.
3. `can_enter` là cờ RIÊNG. Ổ khoá là thứ vẽ ra cho mọi người thấy; vào được hay
   không thì giáo viên chơi thử khác học sinh. Trộn vào một cờ là hoặc giáo viên
   mất đường xem trước, hoặc học sinh đi thẳng vào world chưa phát hành.

Chặn thật nằm ở `GET /play/worlds/{id}` — 404 khi `can_enter` sai. Không chỉ bỏ
thẻ `<a>` ở giao diện: một liên kết bị gỡ vẫn gõ URL được.

Nghiệm thu bằng cách gọi thẳng `_world_summary()` với CẢ HAI tài khoản seed,
không qua đăng nhập:

| World | published | học sinh | giáo viên |
|---|---|---|---|
| Science Planet | 0 | khoá, không vào được | khoá, vào được |
| Enchanted Forest | 0 | khoá, không vào được | khoá, vào được |
| Puzzle Caverns | 0 (+ cột khoá) | khoá, không vào được | khoá, vào được |
| Lost in Atlantis | 2 | mở, vào được | mở, vào được |

Danh sách trả về **4 world cho cả hai** (học sinh trước đây được 1). Trong Chrome:
4 world trên bản đồ, 3 cái mang ổ khoá, rê chuột vào world khoá vẫn hiện đủ tên
và mô tả ở hai cái khung.

**Chưa kiểm bằng mắt được nhánh "không phải liên kết"** — nó chỉ chạy khi
`can_enter` sai, mà phiên đang mở là giáo viên nên cờ đó luôn đúng. Dữ liệu sinh
ra nhánh đó thì đã kiểm ở bảng trên.

**Còn hở:**

- Không có `DELETE /worlds/{id}` — tạo nhầm một world thì không xoá được bằng giao diện. Đáng làm, nhưng xoá world kéo theo chương/màn/nhiệm vụ nên cần quyết riêng: xoá mềm, hay chặn khi còn nội dung.
- `PATCH /worlds/{id}` không đặt lại `scene_x/scene_y/icon_size/pulse_*` về `null` được — lần thứ TƯ gặp đúng lỗi `None` nghĩa là "không gửi". Đáng làm một cờ `clear_*` dùng chung hoặc đổi `_apply` sang đọc `model_fields_set`.
- Bản đồ lấy thiên hà ĐẦU TIÊN theo `position`. Sản phẩm hiện có đúng một thiên hà; khi nào có nhiều thì cần bộ chọn.
- Chưa chụp được ảnh màn hình phần học sinh và phần nhạc nền: tab Chrome ở trạng thái `hidden` gần hết lượt nên `Page.captureScreenshot` hết giờ. Mọi thứ trên đây kiểm bằng DOM và API thật, không phải bằng suy luận.
- World mẫu **"Number Kingdom"** do tôi tạo lúc thử vẫn còn trong DB (bản nháp, đang khoá — học sinh không thấy). Nói một tiếng nếu muốn dọn.

### Bước 6g — Trình thiết kế PHÒNG CHỜ của world  `[~]` ĐANG LÀM

- [x] Migration `0013`: `worlds.lobby_media_id` + `title_*` / `desc_*` (13 cột, tất cả nullable)
- [x] `/teacher/worlds/[id]/design` — nền, hai khung, kéo thả, đổi cỡ, màu chữ, cỡ chữ
- [x] Nút **🎨 Thiết kế giao diện** trên màn chi tiết world
- [x] Tách `MediaPicker` + `FrameTextFields` sang `designer-fields.tsx`, hai trình thiết kế dùng chung
- [x] Màn hình học sinh: khung phòng chờ vẽ đúng bố cục đã kéo

**`null` = THỪA CỦA THIÊN HÀ, không phải "để trống".** Đây là toàn bộ lý do mọi
cột đều nullable. World vừa tạo đã có sẵn nền, khung, màu chữ đúng tông với bản
đồ; giáo viên chỉ tải ảnh lên ở những chỗ world này cần khác đi. Nút gỡ ảnh vì
thế mang chữ "Dùng của thiên hà" chứ không phải "Gỡ ra" — cùng một nút, hai câu
chuyện khác nhau, nên `MediaPicker` nhận thêm `clearLabel`.

Cách khác là chép giá trị của thiên hà xuống world lúc tạo. Gọn hơn một chút lúc
đọc, nhưng sau đó đổi nền thiên hà sẽ không lan xuống world nào nữa — và người
đổi thì đinh ninh là có.

**Sáu khối đều kéo thả, đổi cỡ và tải ảnh được** — thành tích, xếp hạng, hàng
chương, và ba nút Chơi / Tạo phòng / Vào phòng. Bảng cấu hình nằm NGAY DƯỚI khung
xem trước, xếp ngang bốn cột (ảnh · X · Y · bề rộng), cùng lý do với bảng sửa
world bên trình thiết kế thiên hà.

**Bố cục nằm trong MỘT cột JSONB, không phải 24 cột** (migration `0014`). Sáu
khối × bốn thuộc tính, và mỗi khối thêm sau này lại là một migration nữa. Thay
vào đó có một SỔ ĐĂNG KÝ ở frontend:

```
LOBBY_ELEMENTS = { stats, ranking, chapters, play, createRoom, joinRoom }
```

Thêm khối mới = **một dòng ở đó + một khoá chữ**. Không migration, không sửa
trình thiết kế, không sửa màn học sinh — cả hai bên đều duyệt qua sổ này. Đó
chính là chỗ "thuận tiện để tái sử dụng và mở rộng" nằm.

Cái giá: database không kiểm được bên trong JSONB. Nên `LobbyElement` của
Pydantic là chỗ kiểm duy nhất, và nó đặt `extra="forbid"` — gửi nhầm tên trường
thì báo lỗi ngay chứ không lặng lẽ lưu một khoá không ai đọc.

`PATCH` gộp ở mức KHỐI: gửi `{"stats": {...}}` chỉ đụng `stats`. Chỗ gọi luôn
gửi trọn một khối; gộp sâu hơn thì không ai đoán được `media_id: null` nghĩa là
"gỡ ảnh" hay "không gửi".

Ô X / Y / bề rộng / chiều cao gõ tay được, không chỉ kéo: kéo thả nhanh nhưng
không chính xác, mà căn ba cái nút thẳng hàng bằng cách kéo là việc không ai
làm nổi.

**BA tay cầm, không một** — thêm vào `useDesignBoard()` nên mọi trình thiết kế
dùng được:

| Tay cầm | Kéo | Ghi |
|---|---|---|
| giữa cạnh PHẢI | ngang | chỉ bề rộng |
| giữa cạnh DƯỚI | dọc | chỉ chiều cao |
| ở GÓC | chéo | cả hai |

Một khung chữ nhật có hai chiều độc lập; chỉ có tay cầm góc thì muốn kéo dài
đúng một chiều là phải kéo chéo rồi sửa lại chiều kia — hai thao tác cho một ý
định. `onResize` nhận thêm `axis`, và chỗ gọi CHỈ ghi lại chiều thực sự được
kéo: kéo cạnh phải mà cũng ghi chiều cao là ghi đè một con số người dùng không
đụng tới.

Ba trình thiết kế cũ (màn chơi, thiên hà) giữ đúng một tay cầm góc và chỉ đọc
`w`: ảnh vật thể và ảnh world giữ tỉ lệ gốc, chiều cao suy ra từ ảnh — kéo cao
chúng ra là bóp méo tranh của giáo viên. Khối phòng chờ thì khác: bên trong là
NỘI DUNG, và nội dung cần một cái hộp có kích thước, không phải một tấm ảnh có
tỉ lệ. Khung tiêu đề/mô tả nhận thêm `*_height` (migration `0015`), `null` = vẫn
suy ra theo tỉ lệ ảnh như cũ.

**Nội dung mẫu bên trong mỗi khối.** Số liệu là bịa, nhưng số DÒNG, cỡ chữ và
cách xếp đúng bằng thứ màn hình thật sẽ vẽ. Không có nó thì giáo viên căn một
khung trống rồi tới lúc học sinh mở ra mới biết bảng xếp hạng tràn khỏi mép hay
ba cái nút chồng lên nhau. Riêng hàng chương vẽ bằng chương THẬT của world — tên
thật, ảnh thật, ổ khoá theo đúng luật "chưa có màn nào phát hành".

**`chapters.cover_media_id`** (migration `0015`): ảnh riêng của từng chương, tải
lên ngay trong trình thiết kế. Chương chưa có ảnh thì vẽ một khung trống mang
tên chương — hàng chương phải đọc được ngay cả khi chưa ai kịp vẽ.

**Một lỗi tự gây, đáng ghi.** Đoạn thêm `lobby_json` vào `WorldOut` neo vào hai
dòng `desc_color` / `desc_font` — mà hai dòng đó có ở CẢ `GalaxyOut` lẫn
`WorldOut`, và `GalaxyOut` đứng trước. `replace(..., 1)` đặt chúng vào nhầm
schema. `tsc` chỉ ra ngay vì `lobby_json` không tồn tại trên `World`, nhưng nếu
hai schema tình cờ được dùng lẫn nhau thì nó đã lọt. Neo bằng một đoạn CHỈ có ở
một chỗ, đừng neo bằng hai dòng tên chung.

**Nghiệm thu ba tay cầm.** Chọn khối "Bảng xếp hạng" → đúng ba tay cầm, con trỏ
`ew-resize` (phải), `ns-resize` (dưới), `nwse-resize` (góc). Kéo tay cầm DƯỚI
xuống 30px → `{h: 706, x, y}` — **không có `w`**. Kéo tiếp tay cầm PHẢI sang
40px → `{h: 706, w: 866, …}`, `h` giữ nguyên. Tức mỗi tay cầm chỉ ghi đúng chiều
của nó.

**Nghiệm thu bố cục.** Kéo nút "Tạo phòng" `−80px, −20px` trên khung rộng 672:
`lobby_json.createRoom = {x: 2449, y: 1505}` (mặc định `2830, 1600`; dự kiến
`2830 − 80/672×3200 = 2449`, `1600 − 20/378×1800 = 1505`). Gõ bề rộng `640` vào
ô số → `{w: 640, x: 2449, y: 1505}` — **`x` và `y` còn nguyên**, tức phép gộp
theo khối chạy đúng. Bảng cấu hình hiện đúng ở cột TRÁI, dưới khung xem trước,
lưới `182.5px × 4`.

**Nghiệm thu thừa kế.** World `Lost in Atlantis` chưa đặt gì riêng (`lobby_url`,
`title_url`, `title_x` đều `null`) → khung soạn vẫn hiện đủ nền và hai khung của
thiên hà. Kéo khung tiêu đề `−60px` màn hình trên khung rộng 719: **`worlds`**
nhận `title_x = 1338` (từ `1605` của thiên hà, dự kiến `1605 − 60/719×3200 =
1338`), còn **`galaxies.title_x` không đổi**. Tức sửa ở phòng chờ không chạm vào
bản đồ.

**Việc còn lại của bước này** là chính màn hình học sinh: thống kê bên trái, top
5 người chơi + tổng số người chơi bên phải, hàng 5 chương ở giữa có nút tới/lui,
chương khoá có ổ khoá, chương mở cuối cùng được làm sáng và nằm GIỮA — trừ khi
nó là chương 1 hoặc 2 thì cửa sổ vẫn là 1…5. Cần thêm hai đường đọc chưa có:
bảng xếp hạng theo world và số người chơi.

### Bước 6h — Nhân vật người chơi  `[~]` ĐANG LÀM

- [x] Migration `0016`: bảng `characters` + `character_actions`
- [x] Module API `characters` — CRUD nhân vật, `PUT` spritesheet cho từng hành động
- [x] Nút **Characters** trên thanh trên cùng, CHỈ hiện với giáo viên/admin
- [x] `/teacher/characters` — danh sách, thêm, sửa tên/tiểu sử/ảnh, quản lý hành động
- [x] Khối **Nhân vật** trong trình thiết kế world: chọn nhiều, gỡ từng cái
- [x] Học sinh chọn nhân vật lúc vào world (`world_progress.character_id`, migration `0018`)
- [ ] `StageScene` vẽ nhân vật đã chọn thay cho hình tròn tạm

**Phaser hỗ trợ đúng thứ này, và tên gọi là "sprite sheet".** Một tấm ảnh dài
chứa các khung xếp liên tiếp, nạp bằng:

```
this.load.spritesheet(key, url, { frameWidth, frameHeight })
this.anims.create({
  key, frameRate,
  frames: this.anims.generateFrameNumbers(key, { start: 0, end: frames - 1 }),
  repeat: -1,
})
```

Vì vậy bảng `character_actions` lưu **đúng bốn con số Phaser cần**:
`frame_width`, `frame_height`, `frames`, `frame_rate`. Không lưu thừa, không
lưu thiếu.

**`frames = 1` là hợp lệ và có nghĩa**: ảnh một khung, Phaser vẽ như hình tĩnh.
Đó là lý do không có ràng buộc `frames > 1` — và cũng là lý do không bắt buộc
phải có spritesheet mới tạo được hành động.

**`frame_width` tự điền từ khổ ảnh, ngay trong trình duyệt.** Tải lên xong,
giao diện đọc `naturalWidth/naturalHeight` rồi tính `width ÷ frames`. Bắt người
dùng tự đo bằng thước rồi gõ vào là cách chắc chắn nhất để có một con số sai và
một nhân vật giật hình.

**Xem trước CHẠY THẬT bằng CSS `steps()`, không nạp Phaser vào màn quản trị.**
Nguyên lý y hệt: dịch nền đi từng khung một, mỗi giây `frame_rate` khung.
`steps()` chứ không `linear` — `linear` trượt mượt qua giữa hai khung và cho ra
một con mờ nhoè. Sai số khung hay sai cỡ khung lộ ra ngay ở màn quản trị, không
đợi tới lúc vào màn chơi.

**`action_key` là chuỗi tự do, không phải enum.** Thêm một hành động mới là việc
của người dựng nội dung, không phải của một migration. Giao diện có sẵn bảy tên
gợi ý (`idle` `walk` `run` `jump` `talk` `win` `lose`) để mọi người cùng một bộ
tên — mỗi nhân vật một bộ tên riêng thì cảnh chơi không biết gọi hành động nào.

**`PUT /characters/{id}/actions` — một đường, không hai.** Giao diện chỉ biết
"nhân vật này, hành động `walk`, tấm ảnh này"; bắt nó tự tra xem hành động đã
tồn tại chưa để chọn `POST` hay `PATCH` là đẩy một cuộc đua sang phía client.

**Hộp thoại nằm SAU khung xem trước — và `z-50 > z-10` không cứu được.**

`position: sticky` luôn tạo ra một *stacking context*. Cột phải là `sticky`, nên
hộp thoại `z-50` bên trong nó chỉ xếp hạng được VỚI ANH EM CÙNG CỘT; so với
khung xem trước `z-10` ở cột trái thì cả cột phải mới là thứ được đem ra so, và
cột phải có `z-index: auto`. Tăng lên `z-9999` cũng vô ích.

Sửa bằng `components/ui/modal.tsx`: vẽ thẳng vào `document.body` bằng portal, ra
ngoài mọi stacking context của trang. Nhân tiện gom luôn "bấm nền để đóng" và
phím Escape vào một chỗ — bốn hộp thoại đang có (chọn nhân vật, cắt ảnh đại
diện, sửa nhiệm vụ, xem câu hỏi) giờ dùng chung, và `question-viewer` bỏ được bộ
bắt Escape riêng của nó.

Nghiệm thu: hộp thoại là con TRỰC TIẾP của `<body>`; `elementFromPoint` ngay
giữa khung xem trước trả về một phần tử BÊN TRONG hộp thoại. Escape đóng, bấm
nền đóng.

**Khung phòng chờ phía học sinh — dựng xong.**

Trình thiết kế và màn học sinh duyệt CHUNG `LOBBY_ELEMENTS`, cùng hệ toạ độ
3200×1800, cùng `GalaxyFrame`. Khối nào cũng nằm đúng chỗ và đúng cỡ giáo viên
đã kéo; chỉ NỘI DUNG bên trong là khác — bên kia là mẫu, bên này là thật.

**Chỉ hiện những con số CÓ THẬT.** Bản thiết kế có "Sao" và "Cấp world"; miền
dữ liệu chưa có hai thứ đó. Bịa ra hai dòng luôn bằng 0 thì tệ hơn là không
hiện — người chơi sẽ tưởng mình đang thua.

**Hai nút phòng chơi vẽ MỜ, không bấm được**, kèm lời giải thích "có ở Bước 7".
Giấu hẳn thì giáo viên căn bố cục cho ba cái nút rồi học sinh chỉ thấy một.

**Bảng xếp hạng theo ĐIỂM CHIẾN LỰC CỦA CHÍNH WORLD ĐÓ.** Điểm là riêng theo
world (GAME_DOMAIN §3.2), nên một bảng xếp hạng toàn hệ thống sẽ so nhầm hai
thứ khác nhau. Dòng của chính người đang xem được làm nổi lên.

**Thừa kế khung chữ giải ở SERVER, và giải TỪNG TRƯỜNG một.** Màn của học sinh
không nạp thiên hà; bắt nó nạp thêm chỉ để biết một cái nền là thêm một vòng
gọi cho mỗi lần mở world. Giải từng trường chứ không cả cụm: world có thể đặt
ảnh riêng mà vẫn dùng màu chữ của thiên hà, và "có ảnh riêng thì lấy hết của
world" là bắt người dựng đặt lại năm thứ khi họ chỉ muốn đổi một.

**Hàng chương: cửa sổ 5, chương mở cuối cùng nằm GIỮA.** Đó là chỗ người chơi
đang đứng — họ mở màn này ra để đi tiếp, không phải để ôn lại chương 1. Trừ khi
chương đó là số 1 hoặc 2: lúc ấy không có gì bên trái để đẩy, nên cửa sổ nằm ở
1…5. Lật cả năm mỗi lần.

Kiểm luật cửa sổ bằng chính công thức trong `ChapterRow`:

| Số chương | Mở tới | Cửa sổ |
|---|---|---|
| 10 | 1 | 1 2 3 4 5 |
| 10 | 2 | 1 2 3 4 5 |
| 10 | 3 | 1 2 3 4 5 |
| 10 | 5 | 3 4 5 **6** 7 → 5 ở giữa |
| 10 | 10 | 6 7 8 9 10 |
| 3 | 3 | 1 2 3 |

**Danh sách chương dạng chữ bên dưới GIỮ LẠI.** Hàng chương trong khung chỉ
hiện năm cái và không nói được số màn; danh sách thì đọc được cả world trong
một cái liếc. Hai cách nhìn cùng một dữ liệu, không phải hai nguồn dữ liệu.

**`lobby.sample.*` là chữ cho khung XEM TRƯỚC.** Màn thật lúc đầu mượn
`lobby.sample.rankingTitle`; đã tách sang `lobby.stat.rankingTitle`. Một khoá
tên "sample" dùng ở màn thật là cái bẫy cho người sửa tiếp theo.

Nghiệm thu: 9 khối trên khung (7 khối + 2 khung chữ), nền và khung tiêu đề thừa
đúng của thiên hà, bảng xếp hạng 2 dòng / tổng 2 người, ô nhân vật đọc
"+Choose character".

**Ô nhân vật ở phòng chờ — và cái sổ đăng ký đã trả công.**

Thêm khối `character` cho trình thiết kế tốn **đúng một dòng** trong
`LOBBY_ELEMENTS`. Không migration, không sửa trình thiết kế: kéo thả, ba tay
cầm, ảnh nền, bảng cấu hình — có hết. Đó chính là thứ cột JSONB + sổ đăng ký
sinh ra để làm, và đây là lần đầu nó được thử.

Phía học sinh: đã chọn thì hiện mặt, tên, tiểu sử; chưa chọn thì một vòng tròn
rỗng với dấu **+** và dòng "Chọn nhân vật" bên dưới — cái ô rỗng CHÍNH LÀ nút,
không cần thêm nút nào cạnh nó.

Bộ chọn là một **hàng ngang 5 nhân vật**, nhiều hơn thì lật trang. Hàng ngang
chứ không phải lưới: năm cái mặt cạnh nhau thì so được bằng một cái liếc. Lật
theo TRANG chứ không trượt từng cái — trượt một nhân vật mỗi lần thì bấm mười
lần mới xem hết mười nhân vật, mà mỗi lần cả hàng lại xê dịch. Nút lật luôn có
mặt, chỉ mờ đi khi hết trang; ẩn đi thì cả hàng xê dịch ở đầu và cuối.

**Server kiểm lại lựa chọn.** `PUT /play/worlds/{id}/character` chỉ nhận nhân
vật world đó cho dùng VÀ đã phát hành — bộ chọn ở giao diện không phải chỗ kiểm
cuối cùng. Bản nháp bị loại vì nó chưa chắc có spritesheet, và chọn phải nó thì
màn chơi không có gì để vẽ.

**Spritesheet KHÔNG gửi kèm** ở màn chọn: chúng chỉ có ích khi đã vào màn chơi,
và gửi cả bộ cho năm nhân vật là kéo về mấy megabyte để người ta nhìn năm cái
mặt.

**Chỗ đặt tạm.** Khung phòng chờ CÓ TOẠ ĐỘ chưa dựng, nên ô nhân vật hiện đang
là một thẻ bình thường trên `/play/world/[id]`. Toạ độ và ảnh nền giáo viên kéo
đã lưu sẵn cho lúc dựng xong khung.

Nghiệm thu: trình thiết kế có 9 khối (7 khối + 2 khung), ô nhân vật đủ ba tay
cầm `ew/ns/nwse` và bảng cấu hình. Phía học sinh: ô rỗng đọc "+Chọn nhân vật";
mở bộ chọn → hộp thoại là con của `<body>`, lưới đúng 5 cột, hai nút lật đều
tắt vì chỉ có 2 nhân vật; bấm `Kaelen` → `my_character_id` đổi, hộp thoại đóng,
ô hiện tên và nút "Đổi". Đã xoá lựa chọn thử.

**Nhân vật gắn với world qua BẢNG NỐI `world_characters`** (migration `0017`),
không phải một cột trên `characters`: một nhân vật dùng được ở nhiều world, và
một world cho nhiều nhân vật.

Khối **Nhân vật** nằm ở cột phải trình thiết kế world. Bấm "Thêm nhân vật" mở
bộ chọn, tick nhiều rồi thêm một lần.

**Chọn từ KHO CHUNG, không tạo mới tại chỗ.** Một nhân vật thường dùng cho
nhiều world; dựng lại nó ở từng world là dựng lại cả bộ spritesheet.

**"Gỡ ra" ≠ "Xoá".** Gỡ chỉ xoá bản ghi nối; nhân vật vẫn còn trong kho và vẫn
dùng được ở world khác. Nút vì thế mang chữ "Gỡ ra".

**Nhân vật đã có vẫn HIỆN trong bộ chọn**, chỉ bị làm mờ và không tick được.
Giấu đi thì người dùng đi tìm một cái họ nhớ là có, không thấy, rồi tạo trùng
thêm một cái nữa.

**Thêm trùng thì bỏ qua, không báo lỗi.** Tick lại một cái đã có là chuyện
thường; bắt cả mẻ hỏng vì một cái trùng thì họ phải tự dò xem cái nào.

Nghiệm thu: tick cả hai → nút đọc "Add 2" → thẻ đổi thành `Characters (2)`, hộp
thoại đóng. Gỡ `Lyra` → world còn `Kaelen`, nhưng **kho vẫn đủ hai nhân vật**.
Mở lại bộ chọn: `Kaelen` bị khoá, `Lyra` tick được. Đã gỡ hết liên kết thử.

**Một lỗi tự gây.** Migration `0016` khai `created_at`/`updated_at` là
`nullable=False` mà QUÊN `server_default`. `TimestampMixin` dựa vào đồng hồ của
DATABASE chứ không tự điền giờ ở Python, nên lệnh `INSERT` đầu tiên nổ
`NotNullViolation` → 500. Mọi bảng cũ đều có `server_default=sa.text('now()')`;
tôi chép cấu trúc bảng mà không chép chi tiết đó. Phát hiện lúc bấm thử "Thêm
nhân vật" trong trình duyệt — `tsc` và pytest đều xanh, vì không cái nào chạm
tới database thật.

**Cắt ảnh đại diện: bấm thẳng vào ẢNH, không có nút "Sửa" bên cạnh.** Cái ảnh
chính là nút — nó đã ở đúng chỗ, đủ to, và là thứ người ta nhắm tới khi muốn
sửa nó. Rê chuột vào thì hiện biểu tượng kéo.

Ảnh đại diện hiện ra dưới dạng vòng tròn; không có chỗ cắt thì `object-cover`
tự lấy phần giữa, mà phần giữa của một tấm chụp cả người thường là cái bụng.

**KHUNG TRÒN ĐỨNG YÊN, ảnh phía sau kéo và phóng được** — kiểu Facebook. Bản
đầu tôi làm ngược: khung tròn kéo được, ảnh đứng yên. Nó khó dùng, và lý do thì
rõ khi nhìn lại — muốn lấy một chi tiết ở góc ảnh thì phải vừa kéo khung vừa
thu nhỏ khung, mà khung nhỏ lại thì độ phân giải ảnh cắt ra cũng nhỏ theo. Mắt
người nhìn vào cái ẢNH, nên thứ nên di chuyển là cái ảnh.

`scale = 1` luôn nghĩa là "ảnh phủ kín khung" (đúng phép `object-fit: cover`),
và vị trí bị chặn để không bao giờ kéo lộ ra một mảng trống.

**Cắt xong lưu thành ảnh MỚI, không ghi đè ảnh gốc** — cùng luật với mọi tấm
khác trong sản phẩm: ghi đè thứ giáo viên đưa cho ta là quyết định không hoàn
tác được, và cùng tấm đó có thể đang được nhân vật khác dùng. Ảnh cắt ra là
tấm VUÔNG, không tự bo tròn: hình tròn là việc của CSS ở chỗ hiển thị, nướng
sẵn nền trong suốt vào file thì tấm đó không dùng lại được ở đâu nữa.

**Bẫy CORS-cache, mất một lượt mới tìm ra.** Hộp thoại đứng ở dấu "…" mãi
không hiện gì: thẻ `<img>` ảnh đại diện trên trang đã nạp tấm ảnh đó TRƯỚC,
không kèm `crossOrigin`, và trình duyệt lưu bản đó lại. Khi hộp thoại nạp lại
đúng URL ấy nhưng CÓ `crossOrigin`, nó dùng lại bản trong cache — bản không
mang tiêu đề CORS — nên cú nạp thất bại IM LẶNG: `onload` không bao giờ chạy.
Nạp thử tay bằng `?c=1` thì lại chạy, đúng vì tham số khác nhau là mục cache
khác. Cách sửa: hộp thoại luôn dùng URL kèm `?cors=1`, tức một mục cache riêng
được tải tử tế kèm CORS — và nhờ đó canvas không bị "nhiễm", `toBlob()` chạy
được.

**Thêm `Pillow` vào `requirements.txt`.** Trước đó không có, nên bản sinh ảnh
mẫu đầu tiên tôi tự viết bộ mã hoá PNG bằng `zlib` + `struct` — chạy được nhưng
răng cưa. Có Pillow thì vẽ ở độ phân giải gấp 4 rồi thu nhỏ, mép mượt hẳn. Ảnh
mẫu nằm ở `docs/sample-walk-768x96.png` (8 khung × 96px, dùng thật được) và
`docs/spritesheet-guide.png` (bản có kẻ ô và đánh số khung).

Pillow còn một chỗ đáng dùng nữa mà CHƯA làm: `media_assets.width`/`height` có
cột nhưng chưa bao giờ được điền. Điền lúc tải lên thì giao diện khỏi phải tự
đo khổ ảnh ở trình duyệt như hiện nay.

**Nghiệm thu trình cắt.** Ảnh gốc `500×500`, khung tròn `320px`: mở ra ảnh vẽ
đúng `320×320` (phủ kín, `scale = 1`). Kéo thanh trượt lên `2` → ảnh `640×640`;
kéo ảnh sang trái 60px → `translate(calc(-50% - 60px), …)`. Bấm **Use this
crop** → ảnh cắt ra `250×250`, đúng bằng `320 ÷ (320/500 × 2)`, và
`avatar_media_id` đổi sang tấm mới trong khi tấm gốc vẫn còn.

**Ba lỗi lộ ra khi dùng thật với một tấm spritesheet 5128×542.**

1. **`frame_width` đông cứng lúc tải lên.** Tôi tính `ảnh ÷ frames` MỘT LẦN khi
   chọn file. Ai tải ảnh lên trong lúc ô "Số khung" còn là `1` thì bề rộng khung
   bằng cả tấm — `5128`, vượt trần `4096`, và server từ chối bằng câu "Some
   fields are not valid" chẳng chỉ ra chỗ nào sai. Sửa số khung thành 8 cũng
   không cứu được, vì bề rộng đã lưu rồi.

   Sửa: **suy lại mỗi lần số khung đổi**, từ khổ CẢ TẤM. Muốn thế thì khổ tấm
   phải có sẵn — nên `media_assets.width`/`height` (hai cột có từ đầu, chưa bao
   giờ được điền) giờ được Pillow đo ngay lúc tải lên, và `CharacterActionOut`
   trả kèm `sheet_width`/`sheet_height`. Đã lấp đầy 21 ảnh cũ.

   Trần nâng lên `8192`: một tấm 8 khung mỗi khung 640px đã là 5128px, và để
   `frames = 1` cho tấm như thế là chuyện hợp lệ. Trần chỉ để chặn rác.

2. **Khung xem trước tràn khỏi thẻ.** Khung thật của tấm đó rộng `641px`, gấp
   đôi bề ngang cái thẻ chứa nó. Thu bằng `transform: scale()` chứ không đổi
   `width` — đổi `width` thì phải đổi luôn `background-size` và mọi con số bên
   trong.

3. **Khung xem trước TRẮNG TRƠN với ảnh nhiều khung.** Keyframes của tôi dịch
   nền tới `background-position-x: -100%`. Phần trăm của `background-position`
   tính theo `(bề rộng khung − bề rộng ảnh) × tỉ lệ`; với tấm rộng hơn khung thì
   `(641 − 5128) × (−1) = +4487px`, tức đẩy ảnh sang PHẢI ra ngoài. Ảnh một
   khung không có hoạt hình nên vẫn hiện — đúng cái làm nó khó nhìn ra.

   Sửa: dịch bằng PIXEL qua biến `--sprite-travel = −frames × bề rộng khung`.
   `steps(n)` cho ra đúng n vị trí rời rạc `0, −w, …, −(n−1)w`, nên quãng dịch
   là `n × w` chứ không phải `(n−1) × w`.

**Nghiệm thu.** Nút **Characters** chỉ có trong thanh của giáo viên. Gõ tên →
Thêm → nhân vật `draft` được tạo và chọn sẵn; bấm chip `+ walk` → **Add action**
→ `walk frames=1 fps=10`. Đã xoá nhân vật thử.

Với tấm thật `5128×542`: đặt `frames = 8` → `frame_width = 641`; đổi thành `4`
→ `frame_width = 1282` (tính lại đúng, không phải nhập tay). Khung xem trước
thu còn `213×180` (tỉ lệ `0.332`), `--sprite-travel: -5128px`, và
`background-position-x` đọc ra `-1923px` = khung thứ 3 — tức nó đang chạy qua
từng khung. Chụp hai lần liên tiếp ra hai tư thế khác nhau.

### Bước 6i — Nút Play vào màn đang dở, và nhân vật hiện trong màn chơi

**Nút Play đi tới màn mở CUỐI CÙNG, không phải màn đầu tiên.** Nút này nghĩa là
"chơi tiếp", và mép tiến độ mới là chỗ người chơi đang đứng. Trỏ về màn 1 là bắt
họ chơi lại thứ đã xong để tới được thứ chưa xong. Hàng chương bên cạnh vẫn giữ
nguyên luật của nó — bấm vào một chương là chọn CHƯƠNG ĐÓ, nên nó đi tới màn mở
đầu tiên trong chương ấy.

**Spritesheet của nhân vật đi theo `RunOut`, KHÔNG vào `snapshot`.** Cùng lý do
với `world_id`: snapshot là ĐỀ BÀI đóng băng — sửa câu hỏi sau đó không được
phép đổi lượt chơi đang diễn ra. Nhân vật thì ngược lại, là lựa chọn của người
chơi và đổi được giữa hai lượt, nên nó phải đọc mới mỗi lần.

- `RunCharacterOut.sprites` chỉ chứa hành động **có ảnh và đo được khổ khung**.
  Khổ khung để trống thì server suy từ khổ ảnh (`ảnh ÷ frames` × cả chiều cao) —
  suy ở server chứ không ở giao diện, vì cắt lệch một pixel là cả hoạt ảnh trượt
  khung, và chỉ server mới có `media_assets.width/height`.
- Chưa chọn nhân vật, hoặc nhân vật đã bị rút về nháp → `character: null`, và
  cảnh vẽ ký hiệu tròn cũ. **Một màn chơi không được đứng hình chỉ vì một lựa
  chọn cũ hết hiệu lực.**

**`idle` lúc đứng, `walk` lúc đi — suy từ CHÍNH VỊ TRÍ, không từ nơi ra lệnh.**
Có ba đường làm nhân vật dịch chuyển: tween của cú bấm, phím WASD, và cú huỷ
tween giữa chừng. Gắn hoạt ảnh vào từng đường là ba chỗ phải nhớ đồng bộ, và chỗ
nào quên thì nhân vật kẹt trong bước chạy giữa lúc đứng im. So vị trí hai khung
hình liên tiếp thì chỉ có MỘT luật, đúng cho cả ba — và nó chạy TRƯỚC cửa chặn
`typing`/`inputLocked`, nên mở bảng câu hỏi là nhân vật về `idle` chứ không chôn
chân giữa một bước chạy.

- Nhân vật thiếu tấm cho hành động đang cần thì **giữ nguyên tấm đang chạy**:
  một nhân vật chỉ có mỗi `idle` vẫn đi lại được, chỉ là không có bước chân.
- Khoá texture kèm ID nhân vật (`hero_<id>_<action>`): Phaser giữ texture theo
  khoá suốt vòng đời của game, nên khoá trần `hero_idle` là đổi nhân vật xong
  vẫn ra ảnh cũ.
- Cỡ ghim theo **chiều cao** (`HERO_HEIGHT = 160`, so với `DEFAULT_ICON_SIZE`
  của vật thể là 120), tính lại sau MỖI lần đổi tấm — `walk` và `idle` không bắt
  buộc cùng khổ khung, mà `scale` thì giữ nguyên qua lần đổi texture. Ghim theo
  bề rộng thì nhân vật gầy cao vống lên còn nhân vật mập lùn tịt.
- Vòng sáng dưới chân rộng theo cỡ nhân vật đứng trên nó: một cái bóng 60px dưới
  một nhân vật cao 160px trông như nó đang lơ lửng.

**Một lỗi chỉ lộ ra khi NHÌN vào vòng lặp game thật.** Kiểm bằng cách gọi tay
`update()` thì luật chạy đúng tuyệt đối. Nhưng chạy thật, giữa một chuyến đi
dài, nhân vật **chớp về `idle` đúng một khung hình rồi đi tiếp** (`walk → idle`
ở x=1650, `idle → walk` ở x=1648 — nhích 2px). Nguyên do: máy khựng một nhịp thì
Phaser bù lại bằng vài khung hình `delta` gần bằng 0, và một khung hình như thế
thì nhân vật "không nhúc nhích" theo đúng nghĩa đen.

Sửa bằng **độ trễ MỘT CHIỀU**: sang `walk` đổi ngay từ khung đầu tiên — người
chơi phải thấy nhân vật nhấc chân đúng lúc họ bấm; về `idle` thì đợi 3 khung
đứng yên liên tiếp (50ms ở 60fps, không ai thấy dừng chậm). Đối xứng hai chiều
là sai: bên nào cần nhạy, bên nào cần lì, là hai câu hỏi khác nhau.

**Nghiệm thu.** Với Lyra (`idle` 10 khung, `walk` 8 khung, đều `641×542`): bấm
nút Play trên phòng chờ → vào đúng màn mở cuối (`Rung tao phat quang`, chương 2)
thay vì màn đầu. Trong màn: `hero` mang texture `hero_<id>_idle`,
`displayHeight = 160`, cả hai hoạt ảnh đã đăng ký, nhân vật đứng trên vòng sáng.
Bấm đi một chuyến trong vòng lặp game thật: đúng HAI lần đổi trạng thái —
`idle → walk` lúc xuất phát, `walk → idle` lúc tới nơi, không còn cú chớp giữa
đường — và cả 8 khung hoạt ảnh `walk` đều đã chạy qua; đi sang trái thì
`flipX = true`.

**Ghi chú công cụ.** Tab Chrome nằm ngoài tab đang xem thì `visibilityState`
là `hidden`, renderer bị bóp ga, và `Page.captureScreenshot` hết giờ — mọi kiểm
tra bằng mắt đều bất khả. Phải đưa đúng tab đó lên trước (foreground cửa sổ +
chọn tab) thì mới chụp được. Đáng nhớ: lỗi chớp `idle` ở trên **không** lộ ra
qua kiểm tra trạng thái, chỉ lộ khi vòng lặp game chạy thật.

### Bước 6j — Minimap của chương: chọn màn chơi từ phòng chờ

**Bấm vào một chương đã mở thì hiện MINIMAP của chương đó** — bảng các màn chơi
bên trong, xếp thành một HÀNG NGANG theo thứ tự, năm cái một lúc, lật trang để
xem tiếp. Hàng ngang chứ không phải lưới, vì đây là một con đường: màn 1 dẫn tới
màn 2, và một cái lưới thì không nói được điều đó.

Trước đây cú bấm vào chương nhảy **thẳng** vào màn mở đầu tiên, tức người chơi
không bao giờ chọn được màn — chương chỉ là một nút tắt tới đúng một chỗ.

- Mỗi màn là một **vòng tròn**: có tên thì tên nằm giữa, chưa đặt tên thì số thứ
  tự nằm giữa. Chỗ nào cũng phải bấm được, kể cả màn người dựng chưa kịp đặt tên.
- Màn khoá không phải một liên kết bị làm mờ mà **không có liên kết** — thẻ `<a>`
  mờ vẫn bấm được bằng bàn phím. Cùng luật với world khoá trên bản đồ thiên hà.
- Chương khoá vẫn không bấm được, giữ nguyên luật cũ.

**`chapters.minimap_media_id` là cột RIÊNG, không dùng lại `cover_media_id`.**
Hai ảnh phục vụ hai chỗ có khuôn hình khác hẳn: `cover` là một ô nhỏ trên hàng
chương ở phòng chờ, `minimap` là cả cái nền trải rộng phía sau danh sách màn.
Dùng chung một ảnh thì hoặc ô nhỏ bị méo, hoặc cái nền vỡ hạt. Trình thiết kế
phòng chờ giờ có hai ô tải ảnh cho mỗi chương, mỗi ô một nhãn.

Ảnh nền của minimap luôn có một **lớp phủ tối 55%** đè lên: ảnh do người dựng
tải lên, sáng tối tuỳ ý, mà tên màn thì phải đọc được trên bất kỳ ảnh nào.

**Hai lỗi cũ lộ ra và đã sửa nhân lúc này** — cùng một gốc: `POST` và `PATCH`
chương tự dựng lấy một `ChapterOut` rút gọn (`stages=[]`, không có URL ảnh),
khác hẳn thứ `GET` trả về.

1. **Tải ảnh chương lên xong thì ảnh không hiện.** Giao diện đắp kết quả PATCH
   vào chỗ cũ, mà kết quả đó không có `cover_url` — đúng hơn là có, bằng `null`,
   nên nó ghi đè cả cái URL vừa có. Phải tải lại trang mới thấy ảnh.
2. **Tải ảnh chương lên xong thì chương hiện Ổ KHOÁ trong khung xem trước.**
   `stages=[]` làm phép tính "chương khoá khi mọi màn đều chưa phát hành" đúng
   một cách vô nghĩa — mọi phần tử của mảng rỗng đều thoả mọi điều kiện.

Sửa bằng **một chỗ dựng duy nhất** (`_chapter_out`) cho cả `GET`, `POST` và
`PATCH`. Ba đường trả về cùng một hình dạng thì không còn chỗ cho kiểu lệch đó.

**Nghiệm thu.** Trình thiết kế: mỗi chương hiện hai ô tải ảnh có nhãn riêng; tải
một ảnh nền minimap cho chương 2 → ảnh hiện **ngay** trong ô, và chương 2 trong
khung xem trước **vẫn không có ổ khoá** (hai lỗi trên đã hết). Phòng chờ học
sinh: bấm chương 2 → bảng mở ra với đúng ảnh nền vừa tải, tiêu đề chương, một
vòng tròn mang tên màn; bấm vòng tròn → vào thẳng màn đó. Xoá tạm tên màn trong
database → vòng tròn hiện **số 1** thay cho tên, rồi trả lại tên cũ.

**Chưa xem được bằng mắt: nhánh màn KHOÁ.** `unlocked` ở server tính bằng
`can_bypass or skill_pts >= required`, mà `can_bypass` bám theo VAI TRÒ — giáo
viên và admin thì luôn `true`. Đặt `required_skill_pts = 9999` rồi tắt ô "Bypass
unlock requirements" cũng không tạo ra được màn khoá, vì cái ô đó không chi phối
đường này. Nhánh đó dùng đúng luật đã chạy sẵn ở hàng chương trong cùng file.
Muốn xem tận mắt thì phải đăng nhập bằng tài khoản học sinh.

### Bước 6k — Hàng chương chỉ còn ảnh, và chữ trên nút là của người dựng

Ba việc trên cùng một màn hình: phòng chờ của học sinh.

**1. Hàng chương bỏ tên viết dưới ô.** Ảnh chương là tranh người dựng vẽ riêng
cho chương đó và hầu như bao giờ cũng đã có chữ trong tranh ("CHAPTER I —
UNDERWATER INCIDENT"); một dòng tên in thêm bên dưới vừa lặp lại vừa ăn mất
chiều cao của chính tấm ảnh. Tên vẫn còn ở `title` để rê chuột đọc được, và ở
ngay đầu minimap khi bấm vào. Khối mẫu trong trình thiết kế bỏ theo — hai bên
phải vẽ giống nhau, nếu không thì giáo viên căn bố cục cho một thứ mà học sinh
thấy một thứ khác. Ô nào **chưa có ảnh** thì mới điền tên vào giữa, để trong
trình thiết kế còn phân biệt được năm cái ô trống.

**2. Ảnh chương đã tải lên mà học sinh không thấy — lỗi CSS, không phải lỗi dữ
liệu.** Ảnh nằm trong DOM, tải về đủ 1024×1024, `cover_url` đúng trong API và
trong database; chỉ có điều cái ô chứa nó rộng **0px**. Ô ảnh là con của một thẻ
`<button>` (bấm vào chương thì mở minimap), mà trình duyệt tự đặt
`align-items: center` cho `button`. Trong một flex cột, `center` thì con **co
theo bề rộng nội dung** thay vì giãn ra — và nội dung của ô ảnh là một tấm ảnh
xếp `absolute`, tức bề rộng nội dung bằng 0. Còn lại đúng hai đường viền, 2px.

Sửa bằng `items-stretch` trên chính thẻ `button`. Chương **khoá** không bọc
trong `button` nên nó chưa bao giờ dính lỗi này — và cũng vì thế lỗi không lộ ra
trong trình thiết kế, nơi hàng chương chỉ là những thẻ `div`.

**3. Chữ trên ba cái nút (Chơi / Tạo phòng / Vào phòng) do NGƯỜI DỰNG đặt, và
mặc định RỖNG.** Trước đây màn học sinh in tên khối lấy từ `messages/` đè lên
tấm ảnh nút — mà ảnh nút họ tải lên đã vẽ sẵn chữ "PLAY NOW" trong tranh, nên
kết quả là hai lớp chữ chồng lên nhau, không đọc được lớp nào.

- Lưu ở `lobby_json.<khối>.text_i18n` — một `dict` theo ngôn ngữ chứ không phải
  một chuỗi, cùng luật với `name_i18n`: nút của world song ngữ phải đọc được ở
  cả hai thứ tiếng.
- Ô nhập chỉ hiện với **ba cái nút**. Khối khác (dãy chỉ số, bảng xếp hạng, hàng
  chương, ô nhân vật) đã có nội dung riêng; một dòng chữ đè lên chúng không để
  làm gì. Danh sách nút nằm ở `LOBBY_ACTION_KEYS` trong `web/src/game/world.ts`,
  cạnh sổ đăng ký — thêm một cái nút mới là sửa đúng một chỗ.
- Ô nhập dùng `ownText()` chứ không `pickText()`: đang xem tiếng Việt mà ô lại
  mượn chữ tiếng Anh thì chỉ cần rời chuột là chữ tiếng Anh bị ghi thành chữ
  tiếng Việt, dù không ai gõ gì.
- Trong trình thiết kế, nút chưa đặt chữ hiện **tên khối in nghiêng mờ** — chỗ
  giữ chỗ để còn căn bố cục, và nói rõ nó là chỗ giữ chỗ: học sinh không thấy
  dòng đó.

**Nghiệm thu.** Phòng chờ học sinh: năm ô chương hiện **đủ năm tấm ảnh**, không
còn dòng tên bên dưới, ô của chương đang chơi vẫn có vành vàng; ba cái nút chỉ
còn đúng tấm ảnh của chúng. Trình thiết kế: chọn khối "Nút chơi" → có ô **Chữ
trên nút** với gợi ý "Bỏ trống — chỉ hiện ảnh"; gõ một chữ vào → hiện ngay trên
khung xem trước, tải lại trang vẫn còn, và phòng chờ học sinh hiện đúng chữ đó;
xoá trắng ô → chữ biến mất ở cả hai nơi, `lobby_json.play.text_i18n` còn
`{"vi": ""}`.

### Bước 6l — Khung nội dung: chữ nằm ĐÚNG chỗ trong tấm ảnh nền

Ảnh nền của một khối phòng chờ gần như bao giờ cũng là tấm khung trang trí —
cuộn giấy, biển gỗ, tấm bảng có hoa văn chạy quanh viền — và chỗ VIẾT ĐƯỢC chỉ
là một ô ở giữa nó. Màn hình thì vẫn đang trải nội dung kín cả khối với đúng 4%
đệm mỗi bên, nên chữ đè lên hoa văn, và không có cách nào chỉnh ngoài việc sửa
lại chính tấm ảnh.

**Mỗi khối giờ có một KHUNG NỘI DUNG riêng**: kéo thả được, đổi cỡ được, đặt
được màu chữ và cỡ chữ. Mặc định chữ TRẮNG, viền đen.

- **Toạ độ tính bằng PHẦN TRĂM CỦA KHỐI**, không phải hệ 3200×1800. Ảnh nền căng
  theo khối, nên kéo khối to ra là hoa văn to theo — khung nội dung phải to theo
  cùng nhịp. Lưu theo hệ thế giới thì mỗi lần đổi cỡ khối là phải căn lại chữ từ
  đầu.
- **Cỡ chữ theo `cqw`**, cùng luật với `GalaxyFrame`: kéo khung to ra là chữ to
  theo, đúng tỉ lệ, ở mọi cỡ màn hình. Cỡ nền lấy theo TỪNG KHỐI
  (`LOBBY_ELEMENTS[key].font`) vì các khối rộng hẹp rất khác nhau — hàng chương
  rộng 1600, ô nhân vật rộng 420, một cỡ chung sẽ hoặc li ti ở khối này hoặc
  tràn khỏi khối kia. Phần trăm giáo viên đặt chỉ dịch cái thang, không thay nó.
- **Viền chữ cần `paint-order: stroke fill`.** Thiếu nó, viền vẽ ĐÈ LÊN ruột chữ
  và nét chữ bị gặm mất một nửa ở cỡ nhỏ — thứ mà chữ 10px thì không chịu nổi.
- Màu và cỡ chữ đặt ở MỘT chỗ (`LobbyContent`) rồi mọi thứ bên trong thừa hưởng,
  nên chữ con phải viết theo `em`, không viết `px`. Ô nhân vật viết cỡ mặt theo
  `cqw` vì nó là hình, không phải chữ.
- Dòng của CHÍNH MÌNH trong bảng xếp hạng giữ màu vàng riêng, không theo màu
  giáo viên đặt: nó đánh dấu "đây là bạn", mà một bảng xếp hạng không tìm ra
  mình ở đâu thì không dùng để làm gì.

**Trình thiết kế.** Chọn một khối thì hiện thêm một khung ĐỨT NÉT VÀNG bên trong
nó, kéo và đổi cỡ được như chính cái khối. Chỉ hiện khi khối đang được chọn —
bảy cái cùng lúc thì màn thiết kế thành một mớ khung chồng nhau, mà mỗi lúc
người ta cũng chỉ căn đúng một khối. Tay cầm của khung nội dung màu VÀNG, tay
cầm của khối màu XANH: mặc định khung chiếm 92% khối nên sáu cái chấm rơi gần
như chồng lên nhau, và không màu thì không ai đoán được cái nào kéo cái gì.

**Hai chỗ phải sửa thêm mới chạy được**

1. `useDesignBoard` nhận **giới hạn cỡ RIÊNG theo từng vật thể**
   (`BoardTarget.min` / `.max`). Sàn chung của bảng là bề rộng nhỏ nhất của một
   khung chữ (80 đơn vị thế giới), mà khung nội dung nằm trong một khối cao có
   88 — áp sàn chung vào thì nó không co lại nổi quá nửa khối. Hạ sàn chung
   xuống cho vừa thì lại cho phép kéo cả KHỐI nhỏ hơn mức server nhận, và cú kéo
   kết thúc bằng 422.
2. **Lỗi cũ, lộ ra nhân lúc này: bảng điều khiển hiện SỐ CŨ sau khi kéo.** Mọi ô
   số ở đó dùng `defaultValue`, mà React chỉ đọc `defaultValue` lúc gắn — kéo
   khối trên bảng xong thì bảng bên phải vẫn hiện con số trước cú kéo, và ai gõ
   đè lên đó là vô tình kéo cái khối về chỗ cũ. Sửa bằng cách cho khoá của
   `BlockInspector` mang theo GIÁ TRỊ chứ không chỉ tên khối.

**Nghiệm thu.** Trình thiết kế: chọn khối "Bảng thành tích" → hiện khung đứt nét
vàng với tay cầm vàng; kéo khung → chữ mẫu đi theo NGAY trong lúc kéo, thả tay
thì `lobby_json.stats.content` có `{"x": 39.8, "y": 41.7}`; kéo thanh cỡ chữ lên
150% → chữ mẫu to lên ngay; đổi màu chữ → `content` có thêm `font` VÀ `color`
(phép gộp lồng không làm mất cái đã có); bốn ô số hiện đúng giá trị sau cú kéo.
Phòng chờ học sinh mở ra: chữ đúng màu, đúng cỡ, đúng chỗ vừa kéo.

**Cái đổi theo mà cần biết: khung xem trước giờ ĐÚNG TỈ LỆ, nên chữ mẫu nhỏ hơn
trước.** Bảng thiết kế rộng ~670px trong khi phòng chờ thật rộng ~1100px; chữ
`cqw` co theo đúng tỉ lệ đó, còn chữ `px` cố định trước đây thì không. Nói cách
khác chữ mẫu trước kia to hơn sự thật khoảng 1,6 lần. Đổi lấy sự trung thực —
việc của khung xem trước là căn chữ vào hoa văn, mà căn thì cần đúng tỉ lệ.

### Bước 6m — Ô nhân vật gọn lại còn một dòng

- **Bỏ nút "Đổi".** Bấm vào mặt nhân vật đã mở bảng chọn rồi; hai đường đi tới
  cùng một chỗ thì cái thứ hai chỉ tốn thêm một dòng chữ trong một cái khung
  vốn đã chật.
- **Tên và giới thiệu gộp thành MỘT DÒNG** `Tên - giới thiệu`, cắt bằng dấu ba
  chấm khi quá khung: `Lyra - Bright, charming, and…`. Trước đây là tên một
  dòng rồi giới thiệu ba dòng — mà giới thiệu thì dài ngắn tuỳ người viết, nên
  ba dòng co giãn tự do bên trong một cái khung cố định sẽ tràn khỏi hoa văn ở
  world này và để lại một mảng trống ở world khác. Cắt một dòng thì chiều cao
  là hằng số. Rê chuột đọc được trọn câu.
- `w-full` trên dòng chữ KHÔNG thừa: thẻ cha xếp dọc và căn giữa nên con tự co
  theo bề rộng nội dung, mà `truncate` thì cần một bề rộng có thật mới biết cắt
  ở đâu — thiếu nó thì dòng chữ dài ra mãi và không bao giờ hiện dấu ba chấm.
- **Màu chữ và cỡ chữ của dòng này đã có sẵn** ở KHUNG NỘI DUNG của khối trong
  trình thiết kế (Bước 6l) — dòng chữ thừa hưởng thẳng từ đó, không đặt màu
  riêng, và cỡ chữ viết bằng `em` nên đi theo thanh Cỡ chữ. Không thêm bộ điều
  khiển thứ hai: hai cái nút cùng chỉnh một dòng chữ thì cái thứ hai chỉ là chỗ
  để hai bên lệch nhau.

### Bước 6n — Nhân vật tách làm HAI khối

Ảnh nhân vật và dòng mô tả nằm hai chỗ khác nhau trong tranh nền tuỳ người dựng
vẽ, mà một khối thì chỉ có MỘT chỗ đứng và MỘT cỡ. Tách ra thì mỗi thứ có khung
riêng, ảnh nền riêng, khung nội dung riêng, màu và cỡ chữ riêng.

Tách bằng **đúng một dòng trong `LOBBY_ELEMENTS`** cộng hai khoá chữ — không
migration, không sửa trình thiết kế, không sửa gì trong bộ kéo thả. Đó chính là
thứ sổ đăng ký sinh ra để làm, và đây là lần đầu nó được dùng đúng như lời hứa
ghi trong chú thích của nó.

- Khoá của khối ảnh **vẫn là `character`**, không đổi thành `characterAvatar`:
  world nào đã đặt chỗ và tải ảnh khung cho ô nhân vật thì dữ liệu đang nằm dưới
  khoá đó, đổi tên là mất sạch. Khối mới tên `characterInfo`.
- Chỗ mặc định của `characterInfo` đặt **đè lên phần dưới của khối ảnh** — đúng
  chỗ dòng mô tả vẫn đứng từ trước, nên world chưa ai kéo lại vẫn trông như cũ.
  World đã kéo khối ảnh đi chỗ khác thì dòng mô tả nằm ở chỗ mặc định và phải
  kéo lại một lần; không có cách nào đoán ra được ý người dựng.
- Khối ảnh **không in tên nhân vật dưới cái mặt nữa** khi đã chọn: tên đã nằm ở
  khối mô tả rồi, in lại lần nữa là hai lần cùng một chữ. Chưa chọn thì vẫn có
  dòng "Chọn nhân vật" — lúc đó cần một câu nói rõ phải làm gì.
- Khối mô tả **thuần hiển thị, không bấm được**: đường vào bảng chọn là cái mặt
  nhân vật. Hai cửa vào cùng một chỗ thì cửa thứ hai chỉ thêm một hộp thoại thứ
  hai để hai bên lệch trạng thái nhau.
- Trong trình thiết kế, khối ảnh vẽ một **vòng tròn đứt nét** đúng cỡ cái mặt sẽ
  chiếm, khối mô tả vẽ một **dòng mẫu**. Căn được bố cục trước khi có nhân vật
  nào được chọn.

**Nghiệm thu.** Phòng chờ học sinh: mặt nhân vật ở một khối, dòng `Tên - mô tả`
ở khối kia. Trình thiết kế: hai khối chọn riêng được, mỗi khối có bảng điều
khiển riêng với ảnh của khối, X/Y/bề rộng/chiều cao, và KHUNG NỘI DUNG kèm Màu
chữ + Cỡ chữ.

### Bước 6o — Khối mô tả chỉ còn MỘT khung, chữ tự xuống dòng

Khối mô tả nhân vật vốn có hai cái hộp kéo được lồng nhau: khung KHỐI (chấm
xanh) và khung NỘI DUNG bên trong nó (chấm vàng). Khung nội dung sinh ra để né
hoa văn ở viền một tấm ảnh khung trang trí — mà khối mô tả chỉ có đúng một đoạn
chữ và không có tấm khung nào để né, nên hai cái hộp chỉ là hai chỗ để kéo cho
CÙNG một kết quả.

- Thêm `LOBBY_PLAIN_KEYS` cạnh `LOBBY_ACTION_KEYS` trong sổ đăng ký: khối nằm
  trong danh sách đó thì khung nội dung TRÙNG KHÍT với khối. Trình thiết kế
  không vẽ khung vàng, bảng điều khiển bỏ bốn ô số phần trăm — nhưng **giữ
  nguyên Màu chữ và Cỡ chữ**, hai thứ đó không dính gì tới toạ độ.
- Chữ **xuống dòng cho vừa khung**, hết chỗ thì cắt bằng dấu ba chấm.

**Số dòng TÍNH RA, không đo DOM.** `-webkit-line-clamp` cần một số nguyên, mà đo
DOM thì phải dựng xong mới biết — tức vẽ một lần sai rồi sửa — và trên server
thì không có DOM để đo. Ở đây mọi thứ suy được từ dữ liệu: cỡ chữ là phần trăm
BỀ RỘNG khung, chiều cao khung thì đã biết, nên số dòng là một hằng số, giống
nhau ở mọi cỡ màn hình. `LOBBY_LINE_HEIGHT` phải bằng đúng lớp `leading-snug`
dùng để vẽ, nếu không thì số dòng tính ra lệch với số dòng hiện ra.

`-webkit-box` + `line-clamp` là cách DUY NHẤT có dấu ba chấm ở cuối một đoạn
NHIỀU DÒNG — `text-overflow: ellipsis` chỉ chạy với một dòng.

**Nghiệm thu.** Trình thiết kế, chọn khối "Mô tả nhân vật": không còn khung đứt
nét vàng, không còn chấm vàng, chỉ ba chấm xanh của khối; bảng điều khiển còn
X/Y/Bề rộng/Chiều cao của khối cộng Màu chữ + Cỡ chữ, không còn bốn ô phần trăm.
Chọn khối "Bảng thành tích" thì khung vàng và bốn ô phần trăm vẫn nguyên. Phòng
chờ học sinh: đoạn mô tả dài 348 ký tự hiện `-webkit-line-clamp: 2` đúng bằng số
dòng lọt vào khung 420×90, chữ bị cắt (`scrollHeight > clientHeight`), rê chuột
đọc được trọn câu.

*Không xem được bằng mắt lượt này:* một ứng dụng toàn màn hình đang giữ tiền
cảnh nên không chụp được màn hình; các con số trên lấy từ DOM và CSS đã tính.

### Bước 6p — Bảng chọn màu đổi màu NGAY trong lúc chọn

Trước đây phải chọn màu, bấm ra ngoài cho bảng đóng, rồi mới thấy màu mới — tức
muốn so hai màu là hai vòng mở/đóng bảng. Giờ rê tới đâu khung đổi màu tới đó.

**Xem trước liên tục, ghi xuống một lần** — cùng luật với thanh trượt cỡ chữ và
với `ghost`/`sizeDraft` của bộ kéo thả: thứ đang thay đổi dưới tay người dùng
thì sống ở client, và chỉ đi xuống server một lần lúc chốt.

Vì sao KHÔNG ghi thẳng mỗi lần đổi — hai lý do, lý do thứ hai mới là lý do thật:

1. Bảng chọn màu của trình duyệt bắn sự kiện theo từng nhịp con trỏ trong dải
   màu, hàng trăm cái cho một lần chọn. Ghi thẳng là hàng trăm lượt gọi server.
2. **Bảng điều khiển khối vẽ lại sau mỗi lần ghi** (khoá của `BlockInspector`
   mang theo giá trị — Bước 6l), mà vẽ lại thì chính ô màu bị gắn lại, và bảng
   chọn ĐANG MỞ đóng sập ngay giữa lúc người ta đang chọn. Tính năng tự huỷ.

- `FrameTextFields` thêm `onPreview` (gọi liên tục, chỉ để vẽ) bên cạnh `onColor`
  (chốt, gọi một lần lúc bảng đóng). Ô màu đổi từ `defaultValue` sang `value` —
  màu đang xem trước là của riêng nó cho tới lúc chốt.
- Mỗi trình thiết kế giữ một `tint: {id, color} | null`, đúng vai `ghost`.
- Đóng bảng mà màu KHÔNG đổi thì không ghi gì — nhưng vẫn phải `onPreview(null)`
  để tắt xem trước, nếu không màu tạm ở lại đè lên giá trị thật.

Sửa ở `FrameTextFields`, tức **cả ba chỗ có bảng chọn màu** cùng đổi: khung tiêu
đề và khung mô tả của bản đồ thiên hà, hai khung đó của phòng chờ world, và màu
chữ của từng khối phòng chờ.

**Nghiệm thu** (bắn đúng sự kiện `input` mà bảng chọn màu của trình duyệt bắn
ra). Khối "Bảng thành tích": rê qua ba màu → chữ đổi màu theo ngay, **0 lượt gọi
PATCH**; đóng bảng → đúng MỘT lượt ghi, `content.color` xuống database. Bản đồ
thiên hà, khung tiêu đề: rê sang cam → chữ đổi ngay; trả về màu cũ rồi đóng →
chữ về màu cũ, **0 lượt ghi**.

### Bước 6q — Phòng chờ có phản hồi khi rê chuột và khi bấm

- **Rê vào thì phóng nhẹ.** Mục đích là NHÌN CHO RÕ, không phải báo "bấm được
  đây" — nên khối nào cũng có, kể cả bảng chỉ số hay một chương đang khoá. Nút
  phóng đậm hơn khối (6% so với 3%) vì nút nhỏ hơn nhiều, cùng một tỉ lệ thì gần
  như không thấy gì.
- **Bấm thì nhún xuống** (`active:scale-[0.96]`), nhanh hơn lúc phóng (75ms so
  với 150ms) — cú bấm phải dứt khoát, cú rê thì không.
- **Nhún CHỈ gắn cho thứ thật sự làm gì khi bấm**: nút Chơi (và chỉ khi nó có
  màn để dẫn tới), ô nhân vật, và ô chương đã mở. Cho một cái nút chết nhún
  xuống là nói dối người dùng bằng hoạt hình — họ bấm, nó nhún, rồi không có gì
  xảy ra. Hai nút phòng còn chờ Bước 7 nên chỉ phóng, không nhún.
- **Hàng chương không phóng cả khối, từng Ô chương mới phóng.** Người chơi nhắm
  vào MỘT chương; phóng cả hàng thì bốn ô kia cũng nhúc nhích dù không ai chạm
  tới. `motionOf()` trả chuỗi rỗng cho khoá `chapters`.
- **Chỉ Ô CHƯƠNG đang rê mới được nâng `z-index`, KHỐI thì không.** Bản đầu nâng
  cả khối, và nó hỏng ngay: các khối phòng chờ chồng lên nhau theo thiết kế —
  dòng mô tả nhân vật nằm ngay trên tấm thẻ nhân vật — nên rê vào thẻ là ảnh thẻ
  được nâng lên đè mất dòng chữ, tức **rê chuột vào thì chữ biến mất**. Thứ tự
  chồng là do người dựng sắp đặt qua chỗ đứng của từng khối; cú rê chuột không
  có quyền sắp lại. Ô chương thì khác — chúng là năm ô rời cạnh nhau, ô đang rê
  đè lên hai ô bên cạnh mới đúng.
- Máy đặt **giảm chuyển động** thì bỏ phần HOẠT HÌNH, **không** bỏ phản hồi: cỡ
  vẫn đổi, chỉ là đổi ngay lập tức thay vì trượt trong 150ms.

**Một cái bẫy đã tránh được nhờ Tailwind v4.** Khối phòng chờ định vị bằng
`transform: translate(-50%, -50%)` đặt thẳng trong `style`. Nếu `scale-*` sinh ra
`transform: scale(...)` thì nó ĐÈ MẤT phép dịch kia và cả khối nhảy sang góc
khác ngay khi rê chuột vào. Tailwind v4 sinh ra thuộc tính `scale` riêng
(`scale: 1.06`), độc lập với `transform`, nên hai thứ cộng vào nhau. Đã kiểm
bằng cách đọc luật CSS thật trong `document.styleSheets`, và đo lại: khối phóng
đúng 1,060 lần cả hai chiều mà mép ngoài **không xê dịch một pixel nào**.

**Bản đầu KHÔNG chạy trên máy người dùng, và lỗi nằm ở chính cái chốt an toàn.**
Bản đầu có thêm `motion-reduce:hover:scale-100`, tức "máy đặt giảm chuyển động
thì đừng phóng". Máy người dùng đang bật `prefers-reduced-motion: reduce`, nên
luật đó thắng `hover:scale-[1.03]` (cùng độ ưu tiên, đứng sau trong tệp CSS) và
xoá sạch tính năng — rê chuột không thấy gì cả.

Bài học: `prefers-reduced-motion` xin BỚT THỨ NHÚC NHÍCH, không xin bớt thứ cho
biết con trỏ đang ở đâu. Đúng cách là bỏ hoạt hình (`transition-none`) mà giữ
nguyên trạng thái đích — cỡ vẫn đổi, chỉ là đổi ngay. Bỏ luôn cả cú phóng là
tắt tính năng chứ không phải giảm chuyển động.

**Nghiệm thu** (đo bằng chuột thật qua CDP, trên máy ĐANG bật giảm chuyển động).
Khối thành tích: rê vào → bề rộng 188,1px → 193,8px, `scale: 1.03`. Nút Chơi:
188,1px → 199,4px, `scale: 1.06`; rời chuột → về `none`. Ô chương thứ nhất:
91,7px → 96,2px, `scale: 1.05`, còn **bốn ô kia vẫn `none`** — đúng yêu cầu chỉ
ô đang rê mới phóng. `transition-property` là `none` vì máy đang giảm chuyển
động: đổi ngay, không trượt.

Tám khối: `stats`/`ranking`/`character`/`characterInfo` phóng 1.03, ba nút phóng
1.06, `chapters` không phóng; chỉ `play` và `character` có `active:scale-[0.96]`.
Ô chương: `hover:scale-105` + `active:scale-[0.98]`, ô khoá không có nhún. Luật
CSS nằm trong `@media (hover: hover)` nên máy cảm ứng không bị dính trạng thái
rê.

### Bước 6r — Bảng thành tích tách thành năm khối con

Khối `stats` giờ **chỉ còn tấm khung**. Năm con số bên trong nó là năm khối
riêng, mỗi cái kéo, đổi cỡ, đặt màu và cỡ chữ được một mình. Ảnh khung người
dựng tải lên thường vẽ sẵn năm cái ô ngang kèm biểu tượng, mà năm dòng chữ xếp
cứng theo một công thức thì không bao giờ rơi đúng vào năm cái ô đó.

Vẫn là thêm **năm dòng trong `LOBBY_ELEMENTS`** cộng khoá chữ. Chúng là khối
PHẲNG (`LOBBY_PLAIN_KEYS`): mỗi khối một con số, một khung — không có khung nội
dung lồng bên trong.

| # | Khối | Màn học sinh | Mẫu ở trình thiết kế |
|---|---|---|---|
| 1 | `statPower` | `world_progress.skill_pts` | 300 |
| 2 | `statShards` | mảnh khác nhau / `shard_total` | 23/30 |
| 3 | `statStars` | tổng `best_stars` / tổng `star_max` | 7/90 |
| 4 | `statLevel` | `worlds.level_i18n`, rỗng thì nhãn `difficulty` | Easy |
| 5 | `statProgress` | nhiệm vụ đã động tới / tổng nhiệm vụ | 80% |

**Chỉ có CON SỐ, không có nhãn.** Tấm ảnh khung gần như bao giờ cũng đã vẽ sẵn
biểu tượng cho từng dòng; in thêm chữ "Điểm chiến lực" cạnh cái biểu tượng nói
đúng điều đó là nói hai lần trong một cái ô vốn chỉ vừa một dòng.

**Cột mới (migration `0020_stats_blocks`)**

- `worlds.level_i18n` — nhãn cấp độ TỰ DO ("Easy", "C2", "3"). Tách khỏi
  `difficulty` chứ không dùng lại: `difficulty` là ba giá trị cố định mà cả hệ
  thống dựa vào để lọc và xếp world, còn cái này là chữ chỉ để HIỆN. Nhét "C2"
  vào `difficulty` là phá cái ràng buộc đang giữ cho phép lọc chạy đúng. Rỗng
  thì phòng chờ hiện nhãn của `difficulty` — world mới không phải một ô trống.
- `stages.star_max` — số sao một màn trao. Tổng sao của world = tổng cột này.
- `stages.star_score_pcts` — ngưỡng điểm để nhận từng sao, tính bằng **phần
  trăm** điểm tối đa của màn. Phần trăm chứ không phải điểm tuyệt đối: người
  dựng thêm một câu hỏi là điểm tối đa đổi, mà ngưỡng tuyệt đối thì đứng yên và
  bỗng dưng dễ đi. Server tự **sắp xếp và bỏ trùng** khi lưu — gõ "70, 40, 90,
  40" ra `[40, 70, 90]`.
- `stage_progress.best_stars` — sao CAO NHẤT từng đạt ở màn đó. Cao nhất chứ
  không phải lần gần nhất và cũng không cộng dồn: sao là huy hiệu cho thành tích
  tốt nhất, chơi lại kém đi thì không mất, mà chơi lại mười lần cũng không thành
  ba mươi sao.

**Cái nào tính được thì tính ngay.** Điểm chiến lực, mảnh bản đồ, tổng sao và
tiến độ đều là số THẬT từ database. Riêng **sao đã đạt** còn đứng ở 0 vì luật
chấm sao chưa có — nhưng chỗ hiển thị đã đọc `best_stars` rồi, nên khi luật chấm
xong thì không phải sửa gì ở giao diện. Hiện `0/15` là sự thật ("chưa ăn sao
nào"); giấu cả dòng đi thì người dựng không căn được bố cục cho thứ sắp có.

Tiến độ đếm nhiệm vụ **đã động tới**, không phải đã làm đúng — đây là thanh "đi
được bao xa". Mẫu số chỉ tính màn ĐÃ PHÁT HÀNH: cộng cả màn nháp vào thì tiến độ
tụt xuống mỗi lần người dựng tạo thêm một màn, và không ai hiểu vì sao. Ngược
lại, sao ĐÃ ĐẠT thì không lọc theo trạng thái màn — đã ăn sao rồi thì màn đó có
bị rút về nháp sau này cũng không lấy lại sao của người ta.

Bốn phép đếm này chỉ chạy ở màn CHI TIẾT world, không ở bản đồ thiên hà: bản đồ
vẽ mọi world cùng lúc, nhét chúng vào đó là nhân số câu truy vấn lên theo số
world để hiện những con số không ai nhìn thấy trên bản đồ.

**Nghiệm thu.** Phòng chờ học sinh của "Lạc vào vương quốc huyền thoại":
`138` · `1/30` · `0/15` · `Dễ` · `22%`. Đối chiếu thẳng database: tổng sao 15,
tổng nhiệm vụ 18, đã động tới 4 → 4/18 = 22% ✓. Trình thiết kế hiện đúng năm giá
trị mẫu và khối `stats` rỗng. Gõ "C2" vào ô Cấp độ world → database có
`{"vi": "C2"}`, phòng chờ hiện `C2`; xoá đi thì về `Dễ`. Soạn màn chơi: đặt số
sao 5 và ngưỡng "70, 40, 90, 40" → database lưu `5` và `[40, 70, 90]`.

**Còn nợ:** luật chấm ra `best_stars` từ điểm và `star_score_pcts`, và công thức
quy đổi thành tích nhiệm vụ sang điểm chiến lực — cả hai thuộc Bước 8.

### Bước 6s — Phóng to / thu nhỏ khung xem trước

Khung xem trước vẽ vừa chiều cao cửa sổ, tức khoảng 680px cho một sân 3200×1800.
Một khối chỉ số rộng 400 đơn vị ra chưa tới 85px trên màn hình, mà kéo một cái ô
85px vào đúng hoa văn của tấm ảnh nền là việc của người có tay rất vững.

Sáu mức: 50%, 75%, 100%, 150%, 200%, 300%. Danh sách rời rạc chứ không phải
thanh trượt — người ta muốn "to lên một nấc", không muốn ngồi rà tìm 137%. Có cả
mức nhỏ hơn 100% để xem lại toàn cảnh trên màn hình thấp. Bấm vào chính con số
phần trăm là về vừa khung: chỗ HIỆN mức phóng cũng là chỗ người ta tìm tới khi
muốn thoát khỏi mức phóng.

**Phóng bằng cách đổi BỀ RỘNG THẬT của khung, không phải `transform: scale`.**
`useDesignBoard` đổi toạ độ chuột sang hệ thế giới bằng `getBoundingClientRect()`
— khung to lên thì phép đổi tự đúng theo, không phải sửa một dòng nào trong bộ
kéo thả. Dùng `scale` thì thêm một tầng biến đổi nữa mà mọi chỗ đo đạc đều phải
nhớ trừ ra, và chỉ cần một chỗ quên là cả cú kéo lệch. Khung bọc ngoài cuộn
ngang khi phóng quá bề rộng cột, chứ không bóp khung lại.

**Nghiệm thu.** Bấm phóng: bề rộng khung 684px → 1025px → 1367px, đúng 1,5× và
2×. Ở mức **200%**, kéo khối "Điểm chiến lực" sang phải đúng 100px → toạ độ lưu
đi từ X=330 sang **X=564**, tức 234 đơn vị thế giới — khớp chính xác con số dự
đoán `100 ÷ (1367/3200)`. Phép đổi toạ độ không hề lệch theo mức phóng.

### Bước 6t — Bảng xếp hạng: top 10, mỗi hàng một người

Bỏ dòng tiêu đề "Nhà thám hiểm ở đây", bỏ dòng đếm người chơi ở chân, bỏ luôn số
thứ tự viết ra ngoài — **chỉ còn danh sách**. Mỗi hàng: ẢNH ĐẠI DIỆN + TÊN dồn
trái, ĐIỂM CHIẾN LỰC dồn phải.

Miền dữ liệu chưa có ảnh cho người dùng, nên chỗ ảnh tạm là một **vòng tròn
viền** mang số thứ tự. Thứ tự nằm TRONG cái vòng chứ không viết thêm bên ngoài:
khi có ảnh thật, tấm ảnh thay vào chỗ đó và bố cục không đổi một li nào. Viền
chứ không phải nền đặc — nó nằm trên một tấm ảnh khung không đoán trước sáng tối.

**Năm người → mười người.** `_leaderboard` nâng `limit` lên 10, và giao diện chia
chiều cao khối thành đúng `LOBBY_RANK_ROWS = 10` hàng.

**Chiều cao hàng cố định theo SỐ Ô, không theo số người đang có.** Để hàng tự
giãn thì world mới có ba người sẽ hiện ba cái ảnh đại diện to bằng nắm tay, rồi
người thứ tư vào là cả bảng co lại — bố cục người dựng vừa căn xong tự đổi sau
lưng họ. Vòng tròn cũng cao theo HÀNG (`h-[78%] aspect-square`) chứ không theo
cỡ chữ: hàng là thứ có chiều cao chắc chắn, còn cỡ chữ thì người dựng chỉnh được
và một cái vòng bám theo nó sẽ tràn khỏi hàng ngay khi ai kéo thanh cỡ chữ lên.

Dòng của CHÍNH mình vẫn giữ màu vàng riêng, không theo màu người dựng đặt: một
bảng xếp hạng không tìm ra mình ở đâu thì không dùng để làm gì.

**Nghiệm thu.** Phòng chờ học sinh (world mới có 2 người): hai hàng `1 · Cô Lan ·
138` và `2 · Bé Minh · 132`; vòng tròn 16×16px, hàng cao 21px = 1/10 chiều cao
khung — **hai người mà hàng vẫn đúng cỡ của mười**. Đo mép: vòng tròn sát mép
trái, điểm sát mép phải, tên chiếm khoảng giữa. Trình thiết kế hiện đủ **mười
hàng mẫu** Mia…Nam.

### Bước 6w — Thêm màn chơi: bấm một cái là vào thẳng màn chỉnh sửa

Trước đây bấm **Thêm màn** mở ra một cái hộp hỏi ba ô — tên màn, `scene_key`,
tên NPC — rồi mới tạo. Giờ bấm một cái là **tạo ngay và đi thẳng vào màn chỉnh
sửa**. Không còn hộp nào.

Ba ô đó không giữ được ô nào:

| Ô | Vì sao bỏ |
|---|---|
| `scene_key` | **Không chỗ nào đọc tới nó.** Nó có từ thời mỗi màn là một lớp cảnh Phaser viết tay riêng; giờ cả trò chơi chạy trên MỘT lớp cảnh dựng từ dữ liệu. Server tự điền `DEFAULT_SCENE_KEY` |
| Tên NPC (`advisor_npc_key`) | Trùng lặp. Cái tên học sinh nhìn thấy là tên của **nhiệm vụ NPC**, sửa ngay trong sơ đồ màn |
| Tên màn | Đằng nào người dựng cũng đổi sau khi nhìn thấy màn chơi thật |

Bắt trả lời ba câu trước khi được nhìn thấy thứ mình vừa tạo là dựng một cái
cổng không canh gì cả.

**`scene_key` không làm gì — bằng chứng.** Một màn từng bị gõ nhầm thành
`ship_desk_01` (desk, chứ không phải deck) và **không ai phát hiện ra**, vì
không có gì đọc nó để mà hỏng. Đã sửa lại trong database nhân tiện. Cột thì
**giữ**, không xoá: nếu sau này có loại cảnh thứ hai (bản đồ nhìn từ trên xuống,
màn chỉ hội thoại...) thì đây đúng là chỗ đánh dấu, và thêm lại một cột đã xoá
đắt hơn nhiều so với để nó nằm im. Nó chỉ thôi **bắt buộc**.

**Tên mặc định `Stage N`** lấy theo số thứ tự, sửa tại chỗ ngay ở tiêu đề màn
chỉnh sửa. Chuỗi nằm ở `messages/` chứ không sinh ở server: nó là chữ hiển thị,
mà server thì không biết người dựng đang xem bằng ngôn ngữ nào.

**Tên NPC mặc định là `NPC`**, cũng sửa tại chỗ, ngay ở hàng nhiệm vụ NPC trong
sơ đồ màn. Nhiệm vụ NPC sinh ra với `name_i18n` RỖNG và giao diện lùi về nhãn đã
dịch — chôn sẵn chữ vào một hàng `quests` là chôn luôn khả năng dịch nó.

> Hàng nhiệm vụ NPC sửa **tên hiển thị**, hàng nhiệm vụ thường sửa **khoá vật
> thể**. Khoá vật thể của NPC cố định là `npc` (cảnh và migration đều gọi đúng
> cái tên đó), nên ô sửa ở hàng đó phải trỏ vào thứ duy nhất còn đổi được — và
> cũng là thứ học sinh thật sự nhìn thấy.

`InlineName` (`components/ui/inline-name.tsx`) gom hai chỗ sửa tại chỗ về một
mối: gạch chân chấm chấm nói chữ này bấm được, rời ô hoặc Enter là lưu, Escape
là huỷ, **rỗng thì huỷ chứ không lưu** — một màn chơi không tên thì không tra ra
được ở bất cứ danh sách nào.

**Nghiệm thu.** Bấm "+ Thêm màn" ở chương 1 → URL nhảy thẳng sang
`/stages/<id>`, tiêu đề `Stage 2`, sơ đồ đã có sẵn `#0 NPC` với huy hiệu *Hội
thoại NPC* + *🔒 Bắt buộc*. Bấm tiêu đề, gõ "Bão ngoài khơi", Enter → tiêu đề và
breadcrumb đổi theo. Bấm chữ `NPC`, gõ "Thuyền trưởng Drake", Enter → đổi theo.
Đọc thẳng database: `name_i18n = {"vi": "Bão ngoài khơi"}`, `scene_key =
"default"` (server điền), `advisor_npc_key = NULL` (không còn ai hỏi), nhiệm vụ
`(#0, advisor, npc)` với `name_i18n = {"vi": "Thuyền trưởng Drake"}`.

### Bước 6x — Chọn nhiệm vụ bằng cả thẻ, và điểm qua ải luôn hiện số

Hai lỗi ở sơ đồ màn chơi, do người dùng báo.

**1. Bấm vào thẻ nhiệm vụ thỉnh thoảng không ăn.** Chỉ mỗi cái `<button>` bọc
hàng huy hiệu là bấm được; bấm vào phần NỀN của thẻ thì không có gì xảy ra. Cộng
thêm việc `onSelect` là BẬT/TẮT, nên bấm trúng rồi bấm trượt rồi lại bấm trúng
thành ra chọn xong bỏ chọn — người dùng thấy *"phải bấm đi bấm lại mấy lần"*, và
họ đọc đúng: nó hỏng thật.

Giờ **cả thẻ** nhận cú bấm. Những vùng có việc riêng chặn nổi bọt, và chặn ở
**thẻ bao** chứ không ở từng cái nút: thêm một nút mới vào đó sau này thì nó
được chặn sẵn, không phải nhớ.

| Vùng | Vì sao chặn |
|---|---|
| Tên nhiệm vụ | Bấm vào là mở ô sửa. Nó tự gọi `onSelect` khi thẻ chưa được chọn, nên để nổi bọt là gọi hai lần = bật rồi tắt |
| Danh sách câu hỏi (`<ol>`) | Sửa điểm, xem câu, gỡ câu |
| Hàng nút dưới (`<div>`) | Đổi giai đoạn, điểm qua ải, gỡ nhiệm vụ |

Giữ nguyên nét bật/tắt: bấm lại đúng thẻ đang chọn là bỏ chọn, để quay về chế độ
"tạo nhiệm vụ mới" ở cột phải.

**2. Ô Điểm qua ải để trống.** Tổng điểm chỉ nằm ở placeholder mờ, nên người
dựng nhìn vào một ô rỗng thì không biết luật đang là gì — mà "trống nghĩa là
phải đúng hết" là thứ không ai đoán ra được.

Giờ ô **luôn hiện một con số**, mặc định là điểm tối đa của nhiệm vụ. Bên dưới
vẫn là `pass_score = NULL` khi con số bằng đúng tổng điểm — gõ đúng bằng tổng
cũng lưu NULL, và xoá trắng cũng vậy. Giữ NULL thì thêm một câu hỏi vào nhiệm vụ
là ngưỡng tự đi theo; ghim cứng 30 rồi thêm câu thứ tư thành 40 điểm là bỗng
dưng qua ải dễ đi mà không ai đụng vào nó.

Sửa ở cả hai chỗ có ô này: sơ đồ màn (`PassScoreInput`) và hộp soạn nhiệm vụ.

**Nghiệm thu.** Bấm vào **nền** thẻ `#2` (toạ độ 51,553 — vùng đệm, trước đây
bấm không ăn) → chọn `#2`. Bấm nền thẻ `#3` → chuyển sang `#3`, không phải tắt.
Bấm lại đúng chỗ đó → bỏ chọn. Bấm ô Điểm qua ải của thẻ đang chọn → ô nhận con
trỏ và thẻ **vẫn** được chọn. Bấm tên `q3` khi chưa chọn gì → mở ô sửa VÀ chọn
`#4`, đúng một lần. Bốn thẻ đều hiện `Điểm qua ải 10` thay vì ô trống. Gõ `7` →
database lưu `pass_score = 7`; gõ lại `10` (bằng tổng) → về `NULL`.

### Bước 6y — Nhóm khối phòng chờ: phóng cùng nhau, kéo cùng nhau

Khối `character` và khối `stats` mỗi cái có các KHỐI CON — dòng mô tả nhân vật,
năm con số thành tích. Chúng nằm rời nhau trong DOM, mỗi cái là một hộp đặt theo
toạ độ thế giới, kéo riêng được. Nhưng với người chơi thì chúng là MỘT thứ:

- **Rê chuột vào một khối là cả nhóm phóng**, cùng một tỉ lệ, mỗi khối nở ĐỀU
  quanh tâm của chính nó.
- **Kéo khối cha là các khối con đi theo** đúng bấy nhiêu — cả khi kéo chuột lẫn
  khi gõ toạ độ vào ô số ở bảng thuộc tính.

Danh sách nhóm ở `LOBBY_GROUPS` trong `web/src/game/world.ts`, cạnh sổ đăng ký —
cùng nếp với `LOBBY_ACTION_KEYS` và `LOBBY_STAT_KEYS`.

**Một hướng đi sai đã thử rồi bỏ.** Bản đầu cho cả nhóm nở ra như một mảng CỨNG,
quanh tâm khối cha — nghe hợp lý, vì con số sẽ dính chặt vào cái ô vẽ trên tấm
khung. Nhưng nhìn thì sai, và đo ra được: khối con nằm lệch phải tâm cha nở
**0,74 điểm ảnh bên trái và 1,97 bên phải**; khối con nằm trên thì mép dưới THỤT
VÀO (−2,54) trong lúc mép trên vọt lên (+3,37). Nó không đọc ra là *to lên*, nó
đọc ra là *trượt đi* — đúng như người dùng báo: "hình như đang zoom sang trái".

Giờ mỗi khối nở quanh tâm của chính nó. Cái giá phải trả: con số xê dịch so với
hoa văn trên tấm khung đúng `(tỉ lệ − 1) × khoảng cách tới tâm khung` — một con
số cách tâm 200 đơn vị lệch 6 đơn vị thế giới, cỡ hơn một điểm ảnh. Đổi một điểm
ảnh lệch lấy việc mọi khối đều nở đều là cuộc đổi chác đáng.

**Cách bắt sự kiện.** Không bọc cả nhóm vào một thẻ chung: thẻ chung phải to bằng
hộp bao cả nhóm, và khoảng trống giữa các khối con trong hộp đó sẽ nuốt mất cú rê
dành cho thứ nằm bên dưới. Thay vào đó mỗi khối tự nghe
`pointerenter`/`pointerleave` và báo về một trạng thái chung `hoveredGroup`.

> Rời khối này sang khối anh em thì KHÔNG tắt: `pointerleave` của cái này chạy
> trước `pointerenter` của cái kia, nên tắt vô điều kiện là cả nhóm co lại rồi
> phồng lên trong một khung hình. Kiểm bằng `relatedTarget`.

**Sửa luôn một lỗi CÓ TỪ TRƯỚC — và đây mới là cái "zoom sang trái" gốc.** Phép
phóng cũ dùng lớp `hover:scale-*` của Tailwind, tức thuộc tính `scale:` riêng của
CSS. Thứ tự hợp thành mà trình duyệt áp là `translate → rotate → scale →
transform`, nên cái `translate(-50%, -50%)` căn giữa bị NHÂN với tỉ lệ phóng:
khối phóng 1,03 thì tâm nó trôi lên trái đúng 1,5% kích thước của chính nó. Trên
tấm khung thành tích 193×279 điểm ảnh là gần 3×4 điểm — khối *trượt sang trái*
thay vì *nở ra tại chỗ*. Viết `transform: translate(...) scale(...)` thì phép căn
giữa chạy trước và không bị nhân.

**Đổi KÍCH THƯỚC khối cha vẫn chỉ đổi của riêng nó.** Khung to ra thì các con số
bên trong vẫn ở đúng chỗ đã căn — đó là điều người dựng mong đợi khi kéo một cái
tay cầm ở góc. Chỉ có phép DỜI mới kéo theo cả nhóm.

**Nghiệm thu.** Đo bốn CẠNH (không phải tâm) của cả sáu khối nhóm `stats`, ghi
lại bằng `MutationObserver` để không phải đo trong lúc con trỏ đang đứng trên
khối:

| Khối | nở trái | nở phải | nở trên | nở dưới | tỉ lệ |
|---|---|---|---|---|---|
| `stats` (cha) | 2,89 | 2,90 | 4,18 | 4,17 | 1,030 |
| con 1 | 1,35 | 1,36 | 0,41 | 0,42 | 1,030 |
| con 2 | 1,27 | 1,27 | 0,41 | 0,41 | 1,030 |
| con 3 | 1,40 | 1,39 | 0,42 | 0,41 | 1,030 |
| con 4 | 1,33 | 1,33 | 0,41 | 0,41 | 1,030 |
| con 5 | 1,22 | 1,22 | 0,42 | 0,41 | 1,030 |

Mọi cặp cạnh đối xứng trong vòng 0,01 điểm ảnh, mọi tỉ lệ đúng 1,03. Kéo khung
`stats` đi (+191, +95) → cả năm con số dịch đúng (+191, +95). Gõ `x = 511` vào ô
số của khối cha (lệch +100) → cả năm dịch đúng +100, `y` đứng yên. Dữ liệu đã trả
về vị trí ban đầu sau khi thử.

### Bước 6z — Phòng chờ học sinh: chỉ còn giao diện đồ hoạ

Bỏ danh sách chương và màn chơi dạng thẻ chữ nằm dưới khung phòng chờ, bỏ luôn
tiêu đề trang. Cả hai nói lại đúng những gì cái khung phía trên đã vẽ: tên world
và cốt truyện nằm trong khung tiêu đề, điểm chiến lực và số mảnh bản đồ nằm ở
bảng thành tích, chương thì có hàng chương bấm vào là mở bản đồ chương.

Hai bản của cùng một thứ trên cùng một màn hình thì bản nào cũng làm yếu bản kia:
người dựng căn tấm khung cho đẹp, rồi ngay bên dưới là một danh sách chữ không
liên quan gì tới nó. Giữ đúng MỘT bản, và bản đó là cái người dựng dựng.

**Giữ lại hai thứ.** Vụn đường dẫn — nó là lối ra, không phải bản sao: khung
phòng chờ có nút về bản đồ thiên hà nhưng không có đường về danh sách world. Và
dòng báo mở được Cánh cổng Thời gian — một trạng thái mà tấm khung không vẽ.

**Đường vào màn chơi không mất:** bấm một chương ở hàng chương là mở
`ChapterMinimap`, mỗi màn trong đó dẫn thẳng tới `/play/stage/{id}`. Đã kiểm.

Gỡ luôn mười khoá chữ chỉ phục vụ danh sách vừa bỏ (`play.bestScore`,
`play.completed`, `play.mapShards`, `play.noStagesYet`, `play.play`,
`play.playAgain`, `play.quests`, `play.shard`, `play.skillPts`,
`play.enterWorld`) — khoá không ai đọc là thứ lần sau có người sửa nhầm mà không
biết mình vừa sửa cái gì.

### Bước 6aa — Ướm cỡ nhân vật cho từng màn chơi

Nhân vật vẫn luôn cao **160 đơn vị thế giới** — một hằng số nằm trong
`StageScene.ts`. Nhưng mỗi ảnh nền một tỉ lệ khác nhau: boong tàu vẽ cận cảnh
thì nhân vật 160 đơn vị trông bé xíu, quảng trường vẽ từ xa thì nó to như kho
lúa. Giờ người dựng ướm được, ngay trong trình thiết kế đồ hoạ của màn.

**Cột mới `stages.character_height`** (migration `0023_character_height`),
nullable. `NULL` = **kế thừa**, và `effective_character_height()` giải ba nấc,
dừng ở nấc đầu tiên có giá trị:

1. số của chính màn này,
2. số của màn **đầu tiên** trong world (chương nhỏ nhất, thứ tự nhỏ nhất),
3. `DEFAULT_CHARACTER_HEIGHT = 160`.

Nấc thứ hai là chỗ luật *"cỡ ở màn 1 làm mặc định cho cả world"* thành mã. Đọc
**lúc cần** chứ không sao chép sẵn xuống từng màn: sao chép thì sửa lại màn 1
sau đó không lan xuống đâu nữa, mà lan xuống mới là điều người dựng muốn.

**Lưu chiều CAO, không lưu bề rộng.** Mỗi nhân vật một khổ spritesheet khác
nhau, nhưng thứ người chơi so sánh là *"cao bằng chừng nào so với vật thể quanh
mình"*. Ghim bề rộng thì nhân vật gầy cao vống lên còn nhân vật mập thì lùn tịt.
Vì vậy trình thiết kế đọc `size.h` từ cú kéo — ngược với vật thể nhiệm vụ, thứ
lưu `size.w` vì ảnh của nó giữ tỉ lệ gốc theo bề rộng.

**Trong trình thiết kế.** Nhân vật **đầu tiên** của world hiện ở **giữa map**,
không kéo đi được, chỉ **một tay cầm ở góc** để đổi cỡ; thả tay là lưu. Lấy con
đầu tiên là đủ: người dựng cần một hình người có tỉ lệ đúng đứng cạnh cảnh, chứ
không cần đúng con học sinh sẽ chọn — mà cũng không đoán trước được. Cảnh chơi
đặt cỡ mọi nhân vật theo **cùng một chiều cao**, nên căn theo con nào cũng ra
cùng kết quả.

Vẽ **đúng một khung**, không chạy hoạt hình: đây là cái thước, mà một cái thước
đang nhấp nháy thì khó ướm. Mẹo `background-size: (số khung × 100%)` cắt lấy
khung đầu và kéo vừa khít thẻ — cùng nguyên lý Phaser dùng, nhưng theo PHẦN TRĂM
nên nó co giãn theo khung soạn mà không cần đo pixel.

Nhân vật vẽ **trước** các vật thể nhiệm vụ nên nằm **dưới** chúng: nó là thước
đo, không phải nội dung của màn, và không được che thứ người dựng đang sắp đặt.

**Có đường quay lại.** Thẻ *Cỡ nhân vật* ở cột phải nói rõ màn đang **kế thừa**
hay đã có **số riêng**, và khi có số riêng thì hiện nút *Về lại kế thừa*
(`clear_character_height`, cùng nếp với `clear_pass_score`). Không có nó thì cú
kéo đầu tiên là cánh cửa một chiều: lỡ tay kéo ở màn 7 là màn 7 vĩnh viễn không
theo màn 1 nữa.

**Đóng băng vào đề bài.** `snapshot.stage.character_height` mang số đã giải
xong kế thừa, nên người dựng chỉnh giữa chừng thì lượt đang chơi vẫn vẽ nhân vật
đúng cỡ nó bắt đầu. `HERO_HEIGHT` trong cảnh chỉ còn là đường lùi cho các lượt
đóng băng từ trước khi trường này ra đời.

**Nghiệm thu.** Mở trình thiết kế màn 1: nhân vật hiện giữa map, thẻ bên phải ghi
`160 · Đang kế thừa`. Kéo tay cầm góc → panel đổi sang `272`, database ghi
`character_height = 272` cho ĐÚNG màn 1. Hỏi API màn 2 và màn 5: `character_height
= null` nhưng `character_height_effective = 272` — kế thừa chạy. Đặt riêng `420`
cho màn 2 → màn 2 dùng 420, màn 1 vẫn 272, màn 5 vẫn kế thừa 272. Gọi
`clear_character_height` cho màn 2 → về `null`, dùng lại 272. Gửi `5000` → 422
`VALIDATION_FAILED` đúng trường `character_height`. Vào chơi màn 5: đề bài đóng
băng mang `character_height: 272`. Dữ liệu đã trả về `NULL` hết sau khi thử.

> ⚠️ **Ghi chú về cách nghiệm thu.** Cú bấm đơn của công cụ điều khiển trình
> duyệt không sinh `pointerdown`, nên nó không chọn được vật thể nào trong trình
> thiết kế — kể cả vật thể nhiệm vụ vốn đã chạy từ lâu. Đó là hạn chế của công
> cụ, không phải của màn hình; phần kéo được nghiệm thu bằng chuỗi sự kiện
> `pointerdown → pointermove → pointerup` bắn thẳng vào đúng những chỗ
> `useDesignBoard` nghe.

### Bước 6ab — Màn chơi: bỏ thanh tiến độ đội ở chân màn hình

Thanh này liệt kê tên từng người kèm một dãy chấm "ai xong nhiệm vụ nào". Chơi
một mình — mà hiện giờ chỉ có chơi một mình, phòng nhiều người là việc của Bước
7 — thì nó chỉ còn đúng tên người đang ngồi trước màn hình, cộng một dãy chấm
lặp lại thứ mà bộ đếm `Nhiệm vụ 1/4` trên thanh đầu đã nói. Nó ăn một dải chiều
cao của cảnh chơi để nói lại một điều.

Dựng lại ở **Bước 7**, khi trong phòng thật sự có người khác để mà theo dõi. Dữ
liệu vẫn còn nguyên ở `run.team`, không đụng gì tới server.

### Bước 6ac — Đáp án nháp, chấm cả nhiệm vụ, và chơi tiếp lượt đang dở

Ba thay đổi đi cùng nhau, vì chúng là ba mặt của một chuyện: **một lượt chơi dở
dang không được biến mất**.

#### 1. Chấm CẢ NHIỆM VỤ, không chấm từng câu

Một nhiệm vụ là MỘT việc — nói chuyện xong với thuyền trưởng, sửa xong cái cột
buồm. Người chơi phải được xem hết các câu, sửa lại, rồi mới chốt. Chấm ngay
từng câu thì câu một đã khoá lại trước khi họ kịp đọc câu bốn.

| | Trước | Sau |
|---|---|---|
| Endpoint | `POST .../questions/{id}/answer` | `PUT .../questions/{id}/draft` + `POST .../quests/{id}/submit` |
| Lúc chấm | Mỗi lần nộp một câu | Một lần cho cả nhiệm vụ |
| Sửa lại đáp án | Không — chấm rồi là xong | Được, tới lúc bấm Nộp bài |

**Một lần nộp nhiệm vụ = một lượt thử cho MỖI câu chưa đúng.** Câu đã đúng thì
bỏ qua, không chấm lại và không tiêu lượt — giữ nguyên luật "đúng rồi thì thôi"
mà chỉ số một phần `uq_quest_answers_correct_once` đang cưỡng chế ở database.
Câu **không có nháp** thì cũng không chấm: bỏ trống không phải là trả lời sai, và
tính nó là sai thì người chơi mất một lượt cho câu họ chưa kịp xem.

`attempts_left` trả về giờ là của cả nhiệm vụ, lấy theo câu còn NHIỀU lượt nhất —
một câu đã cạn lượt không được làm cả nhiệm vụ đóng lại khi những câu khác vẫn
còn cơ hội gỡ điểm.

#### 2. Bảng `quest_drafts` — bài đã chọn nhưng chưa nộp

Migration `0024_quest_drafts`. Một dòng cho mỗi (lượt chơi, người, câu hỏi), ghi
đè tự do. `UNIQUE(stage_run_id, user_id, question_id)` — **không** có `quest_id`
trong khoá: một câu chỉ thuộc một nhiệm vụ trong cùng một đề đã đóng băng, nên
thêm nó vào khoá là mở đường cho hai bản nháp của cùng một câu.

**Bảng NHÁP, không phải bảng điểm.** Không `score`, không `is_correct`, không
`attempt_no`. Chấm điểm vẫn là `quest_answers` — nhật ký từng lần thử, không ghi
đè. Gộp hai thứ vào một bảng thì mất lịch sử số lần thử, mà đó là thứ cả công
thức tính điểm dựa vào.

**Lưu ở SERVER chứ không ở máy.** `localStorage` thì đổi máy là mất, và cũng
chẳng có gì bảo đảm nó còn đó.

**Lưu lúc nào:** rời một câu sang câu khác, đóng bảng, và **ngưng thao tác 800ms**.
Cái thứ ba không có trong yêu cầu nhưng thiếu nó thì hụt mất đúng cái mục đích:
một nhiệm vụ chỉ có MỘT câu thì không bao giờ có cú chuyển câu nào, và người chơi
chọn xong rồi ngồi đọc lại đề mà mất mạng thì mất trắng. 800ms đủ dài để một lượt
gõ vào ô tự luận không bắn mỗi ký tự một request, đủ ngắn để "vừa chọn xong thì
mất điện" vẫn kịp.

`PUT` chứ không `POST`: gọi hai lần cùng một nội dung cho cùng một kết quả, và
mạng chập chờn thì lần gửi lại không sinh ra bản nháp thứ hai.

#### 3. `start_run`: chơi tiếp thay vì luôn mở lượt mới

```
lượt cũ còn `playing` của CHÍNH người này ở màn này?
  ├─ còn giờ  → trả về đúng lượt đó
  └─ hết giờ  → chốt thành `lost_time`, rồi mở lượt mới
không có     → mở lượt mới
```

Trạng thái khôi phục được **toàn bộ** vì nó vốn ở server cả: đề bài trong
`snapshot_json`, bài đã chấm ở `quest_answers`, bài đang dở ở `quest_drafts`,
năng lượng ở `stage_run_players`, và đồng hồ đếm từ `started_at` chứ không từ lúc
mở trang.

**Màn đã THẮNG rồi vẫn chơi lại được**, và lần đó là lượt hoàn toàn mới — lượt cũ
không còn `playing` nên không lọt vào nhánh chơi tiếp.

Hết giờ thì **chốt** lượt cũ chứ không bỏ đó: một lượt "đang chơi" nằm lại mãi
trong database là thứ mọi báo cáo về sau phải tự nhớ mà loại trừ. Việc này cũng
tự dọn các lượt cũ còn treo từ trước — lần đầu vào lại mỗi màn là chúng được chốt.

#### Nghiệm thu

Qua API, trên nhiệm vụ `hull` có hai câu hỏi:

| Bước | Kết quả |
|---|---|
| Gọi `start` hai lần liên tiếp | Cùng MỘT `run.id` — chơi tiếp, không mở lượt mới |
| Lưu nháp câu 1 rồi đọc lại lượt chơi | `draft = {"selectedOptionId": "b"}` quay về đúng |
| Sửa nháp câu 1 (`b` → `a`) | `quest_drafts` chỉ có một dòng, giá trị mới |
| Nộp nhiệm vụ khi câu 2 chưa có nháp | Chỉ câu 1 được chấm; câu 2 **không** có dòng nào trong `quest_answers`, `attempts_left` vẫn 3 |
| Trả lời câu 2 rồi nộp lại | `quest_completed: true`; câu 1 vẫn chỉ có `attempt_no = 1` — không chấm lại |
| Đẩy `started_at` lùi 2 giờ rồi gọi `start` | Lượt cũ thành `lost_time`, lượt mới sinh ra với trạng thái sạch |

Trên trình duyệt: chọn đáp án B ở nhiệm vụ NPC, **không** bấm Nộp bài, đợi một
nhịp → `quest_drafts` đã có `{"selectedOptionId": "b"}`. **Đóng hẳn tab**, mở lại
màn chơi → đồng hồ hiện `01:28` (chạy tiếp, không reset về `05:00`) và đáp án B
vẫn đang được chọn. Đổi sang A rồi nộp → `✓ MISSION COMPLETE`, huy hiệu *Đã hoàn
thành*, nhãn trong cảnh thành `⚓ Thuyền trưởng Drake ✓`, năng lượng được cấp
`100/100`.

#### 4. Nút Chơi ngay ở phòng chờ dẫn về màn đang dở

`PlayWorldDetailOut.resume_stage_id` — màn người này đang chơi dở và **vẫn còn
giờ**, hoặc `null`. Nút Chơi ngay ưu tiên nó, không có thì vẫn về màn mở cao
nhất như trước.

Không có nó thì người chơi đóng nhầm tab giữa chừng, vào lại phòng chờ, bấm Chơi
ngay — và rơi vào màn mở CAO NHẤT, không phải màn họ đang làm dở. Cái nút hứa
"chơi tiếp" mà lại dẫn đi chỗ khác.

Chỉ trả về màn **còn giờ**: lượt đã hết giờ thì bấm vào cũng là bắt đầu lại từ
đầu, nên dẫn người ta tới đó là hứa một thứ không có. Và đọc một phòng chờ thì
**không ghi** vào database — lượt hết giờ được chốt ở `start_run`, đúng lúc người
chơi thật sự quay lại màn đó.

Chữ trên nút (`title`) nói rõ nó dẫn đi đâu khi đang có màn dở: cùng một cái nút
mà hôm nay vào màn 7, mai vào màn 3, thì người chơi cần biết vì sao.

| Trạng thái | `resume_stage_id` | Nút Chơi ngay vào |
|---|---|---|
| Không có lượt dở | `null` | Màn mở cao nhất |
| Đang dở màn 1, còn giờ | màn 1 | **Màn 1** |
| Lượt dở đã hết giờ | `null` | Màn mở cao nhất |

Nghiệm thu cả ba dòng bằng API, rồi xem trên phòng chờ thật: `href` của nút đổi
từ `/play/stage/01a041b9…` (màn mở cao nhất) sang `/play/stage/01a03740…` (màn
đang dở), kèm chữ *"Chơi tiếp "Con bao bat ngo" — bạn đang dở màn này"*.

#### 5. Chỗ đứng của nhân vật cũng được khôi phục

`stage_run_players.pos_x` / `pos_y` (migration `0025_player_position`), toạ độ
thế giới 3200×1800. `NULL` = chưa đi đâu, cảnh đặt ở chỗ xuất phát mặc định.

Đặt ở `stage_run_players` chứ không ở `stage_progress`: một vị trí chỉ có nghĩa
trong CẢNH của một lượt chơi. Lượt mới là một ván mới và nhân vật phải đứng lại
ở vạch xuất phát — đúng nếp với mọi thứ khác của lượt chơi. Bảng này khoá theo
(lượt chơi, người), mà lượt chơi thuộc về một màn — nên **"riêng từng học sinh ở
từng màn" là hệ quả sẵn có**, không phải thêm cột.

**Ghi mỗi 2 giây, không ghi mỗi bước.** `PLAYER_MOVED` bắn sau mỗi bước — kể cả
giữa đường, kể cả từng khung hình khi giữ phím. Gửi thẳng là hàng trăm request
cho một lần đi bộ. Chỉ giữ vị trí mới nhất rồi ghi theo nhịp; mất tối đa một
nhịp nếu tab đóng đúng lúc, tức nhân vật lùi vài bước chứ không về vạch xuất
phát.

Cảnh Phaser chỉ **đặt** nhân vật vào chỗ đó lúc dựng rồi thôi — nó không tự nhớ
và không tự lưu. Cảnh biết vẽ, không biết mạng; việc ghi xuống server là của
React.

Toạ độ bị **kẹp vào khung** ở cả hai đầu: Pydantic chặn ngoài 0..3200/0..1800
(422), và service kẹp lại lần nữa. Đây là số do máy người chơi gửi lên, mà một
con số ngoài khung sẽ đẩy nhân vật ra khỏi cảnh ở lần vào sau — không sập gì cả,
chỉ là mất hút, tức kiểu hỏng khó lần ra nhất.

**Nghiệm thu.** API: lưu `(2100, 1300)` → đọc lại đúng; gửi `x = 99999` → 422.
Trên trình duyệt: vào màn mới, nhân vật ở chỗ mặc định; bấm sang góc phải dưới
boong tàu, đợi một nhịp → `pos_x=2699, pos_y=1533` đã ở database; **đóng hẳn
tab**, mở lại → nhân vật đứng đúng góc phải dưới đó, đồng hồ chạy tiếp `03:35`.

**Còn nợ:** chưa có nút "chơi lại từ đầu" khi lượt cũ vẫn còn giờ. Muốn làm lại
sạch thì phải bỏ dở (`POST /runs/{id}/abandon`) hoặc đợi hết giờ. Giao diện chưa
có lối vào cho việc đó.

### Bước 7 — Phòng chơi & realtime

- [ ] `ARCHITECTURE_REALTIME.md` — chốt protocol trước khi code
- [ ] API tạo/tham gia phòng, mã mời, đếm ngược, điền Bot
- [ ] WebSocket trong FastAPI + Redis pub/sub
- [ ] Trạng thái phòng lưu Redis (node chết không mất phòng)
- [ ] `/play/room/[code]` — phòng chờ (S4)
- [ ] **Nghiệm thu: 2 tab trình duyệt thấy nhau trong cùng phòng**

### Bước 8 — Đồng bộ trong trận & vòng lặp đầy đủ

- [ ] Đồng bộ vị trí, tiến độ nhiệm vụ, quỹ năng lượng đội
- [ ] Bản tin nộp bài phát cho phòng **chỉ mang `is_correct`**, không mang `response_json`
- [ ] Ghi DB **mỗi lần nộp** (≤16 lần/lượt) — không gom lô, vì điểm phải cộng ngay
- [ ] Nhịp 1: cộng điểm cơ bản lúc nộp đúng (âm thầm) · Nhịp 2: thưởng lúc thắng
- [ ] `attemptPenalty` — đúng lần 1 ăn đủ điểm, lần 2 còn 60%, lần 3 còn 30%
- [ ] **S6b `/play/run/[id]/review`** — chặn nếu `status == "playing"`, chỉ trả bài của chính người gọi
- [ ] Nút `[ XEM LẠI BÀI LÀM ]` trên cả bản Victory lẫn Defeat
- [ ] Thua vẫn giữ điểm cơ bản; Mảnh bản đồ chỉ trao khi thắng
- [ ] S6 Victory / Defeat (thay `alert()` + `reload()`)
- [ ] Trao Mảnh bản đồ cho **tất cả** thành viên khi thắng
- [ ] Cưỡng chế luật "mọi thành viên phải hoàn thành ≥1 nhiệm vụ"
- [ ] Chơi lại cộng đủ điểm mỗi lần (`balance_json.replayRatio = 1.0`)
- [ ] S7 Cánh cổng Thời gian
- [ ] **Nghiệm thu: 4 người chơi chung Màn 1, hoàn thành, nhận mảnh bản đồ**

### Bước 9 — Nội dung & hoàn thiện

- [ ] Grader đợt 2: `SHORT_ANSWER`, `MATCHING`, `REORDER`, `READ_ALOUD` (test trước)
- [ ] Màn 2–6 (hết Chương 1)
- [ ] Màn 7–30
- [ ] Docker + `docker-compose.yml`
- [ ] `README.md`

---

## 3. Hoãn — không làm ở giai đoạn này

- AI hội thoại NPC bằng LLM + rubric 4 tiêu chí (hiện dùng kịch bản + grader)
- Nâng cấp STT/TTS khỏi Web Speech API
- Bot AI biết giải nhiệm vụ (giai đoạn đầu Bot chỉ đứng yên)
- Kinh tế Xu / V-Points / voucher / UGC Marketplace
- Multi-tenant, bán B2B cho trung tâm
- Tối ưu cho >5.000 CCU
- World 2 (MAYA) và World 3 (Xuyên Việt)

---

### Bước 6u — Nhiệm vụ NPC là cổng vào của mọi màn chơi

Trước đây `phase = 'advisor'` chỉ là một lựa chọn: giáo viên tạo được một màn
không có NPC nào, hoặc ba cái, và mọi nhiệm vụ mở sẵn từ giây đầu. Giờ nó là
LUẬT:

1. Mỗi màn có **đúng một** nhiệm vụ NPC. Chỉ số một phần
   `uq_quests_stage_advisor` (`UNIQUE (stage_id) WHERE phase = 'advisor'`) chặn
   cái thứ hai ngay ở database.
2. Nhiệm vụ đó **sinh ra cùng lúc với màn chơi**, trong cùng một giao dịch —
   giáo viên không phải bấm gì. Tách thành hai lệnh nối nhau thì lệnh thứ hai
   hỏng là có một màn không cổng vào mà không ai biết.
3. **Không xoá được, không hạ xuống nhiệm vụ thường.** Đổi tên, đổi ảnh, đổi vị
   trí, thay câu hỏi bên trong thì vẫn được — cái khe thì phải còn.
4. Mọi nhiệm vụ khác **khoá** cho tới khi người chơi qua được nó.

**Vì sao đây không chỉ là chuyện dẫn dắt cốt truyện.** Luật chia mảnh bản đồ nói
*mỗi thành viên phải hoàn thành ít nhất một nhiệm vụ thì cả đội mới được chia*.
Trước đây không có gì bảo đảm điều đó: người thứ tư vào muộn có thể chạy thẳng
tới cột buồm, thấy đồng đội làm hết rồi, và cả đội hỏng vì một người không kịp
làm gì. Cổng NPC biến điều kiện đó thành hệ quả — ai cũng phải qua NPC, nên ai
cũng có ít nhất một nhiệm vụ.

**Khoá theo TỪNG NGƯỜI, không theo đội.** Đồng đội gặp NPC xong không mở khoá
hộ được. Mở theo đội thì đúng cái lỗ hổng trên lại mở ra.

**Chốt ở server.** `submit_answer` từ chối bài nộp vào nhiệm vụ đang khoá với mã
`ADVISOR_LOCKED`. Che ở giao diện thì gọi thẳng API là lách được, mà lách được
thì cái cổng không còn là luật chơi, chỉ là một gợi ý.

**Giao diện.** `QuestProgress.locked` đi kèm mỗi nhiệm vụ trong `RunOut`. Cảnh
Phaser gắn 🔒 vào **nhãn** của vật thể đang khoá, và **không làm mờ hình**: làm
mờ là cách nói mơ hồ — một vật thể mờ còn đọc được là "đã xong", là "ở xa", hay
chỉ là tấm ảnh giáo viên tải lên vốn đã nhạt. Cái ổ khoá nói đúng một điều và
không nói gì khác, nên nó là đủ; bỏ lớp mờ đi thì ảnh nền và ảnh vật thể giữ
nguyên được cái nhìn mà người dựng đã căn.

> Cùng luật đó áp cho nhiệm vụ **ĐÃ XONG**: không làm mờ, chỉ gắn `✓` vào
> **cuối** nhãn. Người dựng tải tấm ảnh lên và căn nó vào cảnh; hạ xuống nửa độ
> sáng là sửa tác phẩm của họ để nói một điều mà dấu ✓ đã nói rõ hơn. Dấu ✓ cũng
> chuyển vào NHÃN thay vì là một `text` 22px riêng trong hệ toạ độ thế giới —
> camera thu về cỡ 0,3 lần nên nó ra chưa tới bảy điểm ảnh trên màn hình, gần
> như vô hình. Nhãn thì đã có sẵn cơ chế giữ cỡ chữ không đổi theo mức thu phóng.
>
> Cuối nhãn chứ không đầu: đầu nhãn đã có `⚓` của NPC và `🔒` của nhiệm vụ đang
> khoá, nên nhét thêm dấu thứ ba vào đó là đẩy cái TÊN — thứ người chơi thật sự
> đọc — lùi mãi sang phải.

**Dấu ✓ là của RIÊNG từng người.** `completedQuestIds` dựng từ `run.my_progress`,
mà server tính nó chỉ từ bài làm của chính người gọi (`_run_out`:
`mine = [... if a.user_id == user.id]`). Bốn người cùng một phòng thì mỗi máy
thấy đúng dấu ✓ của mình — đó là luật §1.5 "kết quả từng người là độc lập" hiện
thành hình ảnh. Ai xong nhiệm vụ nào của ĐỒNG ĐỘI là dữ liệu khác (`run.team`),
và nó không được vẽ lên cảnh.

Nghiệm thu bằng cách nhét hai người vào CÙNG một lượt chơi rồi hỏi API bằng hai
tài khoản. Bé Minh qua NPC, Cô Lan chưa:

| | Bé Minh | Cô Lan |
|---|---|---|
| nhiệm vụ NPC | **xong** | chưa xong |
| ba nhiệm vụ chính | mở | **đang khoá** |
| năng lượng | 100/100 | 0/0 |

Cùng một lượt chơi, hai bức tranh khác nhau — dấu ✓, ổ khoá và năng lượng đều
theo người, không theo phòng. Đi tới một vật thể đang khoá thì bảng
vẫn **mở ra và nói vì sao**, có tên NPC phải gặp; im lặng không phản hồi đọc ra
là hỏng chứ không phải là luật.

> Ổ khoá nằm TRONG nhãn chứ không phải một ảnh riêng đặt phía trên. Nhãn đã có
> sẵn cơ chế giữ cỡ chữ không đổi theo mức thu phóng của camera
> (`rescaleLabels`); một ảnh riêng thì không, nên ở mức thu nhỏ nó co thành một
> chấm. Tôi đã làm đúng cách sai đó trước, và trên màn hình không thấy gì cả.

**Nhãn mặc định `Gặp NPC` nằm ở `messages/`, không nằm ở database.** Nhiệm vụ
sinh tự động nên `name_i18n` rỗng; `questLabel()` lùi về nhãn đã dịch. Chôn sẵn
chữ tiếng Việt vào một hàng `quests` là chôn luôn khả năng dịch nó.

**Điều kiện xuất bản.** `STAGE_NO_ADVISOR` giờ kiểm **vô điều kiện**, không còn
chỉ kiểm khi giáo viên đã gõ `advisor_npc_key`. Nhiệm vụ NPC vẫn **được tính**
vào `MIN_QUESTS_PER_STAGE = 4`: nó là một nhiệm vụ thật — có câu hỏi, có điểm
qua ải — chứ không phải một bước thủ tục.

**Migration `0021_npc_gate`** làm hai nhịp, thứ tự quan trọng: (1) NÂNG nhiệm vụ
đã mang khoá `npc` mà còn `phase = 'main'` lên `advisor`, giữ nguyên câu hỏi bên
trong; (2) màn nào vẫn chưa có thì CHÈN một cái. Chèn trước là đụng
`UNIQUE (stage_id, quest_object_key)`. `downgrade` chỉ gỡ chỉ số, **không xoá**
các nhiệm vụ đã tạo — giáo viên có thể đã lắp câu hỏi vào chúng.

**Nghiệm thu.** Năm màn có sẵn: sau migration mỗi màn đúng 1 `advisor` + n
`main`; chèn tay cái thứ hai → `duplicate key ... uq_quests_stage_advisor`. Tạo
màn mới qua API → có ngay `(#0, advisor, npc)`, và `STAGE_NO_ADVISOR` biến khỏi
danh sách chặn xuất bản. Xoá nhiệm vụ NPC → 409 `ADVISOR_QUEST_REQUIRED`; hạ nó
xuống `main` → 409 cùng mã; nâng nhiệm vụ thứ hai lên `advisor` → 409
`ADVISOR_QUEST_EXISTS`; đổi tên nó → 200. Vào màn "Cơn bão bất ngờ" bằng tài
khoản học sinh: `npc locked=False`, ba nhiệm vụ còn lại `locked=True`; nộp vào
`mast` → 409 `ADVISOR_LOCKED`; làm xong NPC → cả ba về `locked=False` và nộp vào
`mast` trả 200. Trên màn hình: ba nhãn `🔒 Cột buồm chính` / `🔒 Hòm báu cổ
Atlantis` / `🔒 Thân tàu rạn nứt`, hình vật thể giữ nguyên độ sáng, bảng khoá
hiện đúng câu *"Qua
"Thuyền trưởng Drake" trước đã"*, và sau khi qua NPC thì cả ba ổ khoá biến mất,
bộ đếm lên `1/4`.

### Bước 6v — Năng lượng là của TỪNG NGƯỜI, cấp sau khi qua NPC

Trả nợ Bước 8b, phần năng lượng. Trước đây năng lượng là một quỹ **chung cả
đội**, cấp ngay lúc vào màn, và cạn quỹ là **cả đội thua** (`lost_energy`). Giờ:

| | Trước | Sau |
|---|---|---|
| Thuộc về ai | Một quỹ chung cả đội (`stage_runs.team_energy_*`) | **Từng người** (`stage_run_players.energy_granted` / `energy_remaining`) |
| Cấp lúc nào | Vào màn là có ngay | **Sau khi chính người đó qua nhiệm vụ NPC** |
| Cấp bao nhiêu | `stages.initial_team_energy` | `stages.energy_per_player`, giáo viên đặt lúc dựng màn |
| Trả lời sai | Trừ `energyCost.wrongAnswer` của cả đội | **Không trừ gì** |
| Hết năng lượng | `status = 'lost_energy'`, cả đội chơi lại | **Không thua.** Chỉ mất quyền dùng trợ giúp |
| Tiêu vào đâu | Trả lời sai | **Chỉ các hành động trợ giúp** (Dịch, nghe lại, xem text) |

**Vì sao cấp SAU khi qua NPC.** NPC là cổng vào của màn (Bước 6u). Cấp trước thì
người chơi tiêu hết vào các hành động trợ giúp ngay ở cửa, rồi bước vào phần
chính với hai bàn tay trắng — mà phần chính mới là chỗ cần trợ giúp.

**Chỉ cấp một lần.** `energy_granted > 0` vừa là số đã cấp vừa là cờ *đã cấp*:
qua NPC là chuyện một chiều nên hai điều đó là một. Không có cái cờ này thì mỗi
lần nộp thêm một câu của nhiệm vụ NPC (một nhiệm vụ chứa nhiều câu) lại nạp đầy
bình thêm một lần nữa.

**Vì sao bỏ trừ-khi-sai.** Trừ điểm khi trả lời sai là phạt việc dám thử, trong
một trò chơi mà cả mục đích là để học sinh dám nói tiếng Anh. Trần **3 lượt thử**
vẫn còn, và đó mới là cái chặn đoán bừa. Cột `quest_answers.energy_spent` giữ
nguyên cho các hành động trợ giúp ghi vào sau này; hiện nó luôn bằng 0.

**Vì sao bỏ `lost_energy`.** Để một người tiêu hết năng lượng làm **cả đội thua**
là đúng thứ mà luật "kết quả từng người độc lập" sinh ra để loại trừ. Hết giờ
giờ là cách thua duy nhất, và ràng buộc CHECK của `stage_runs.status` phản ánh
điều đó.

**Thưởng năng lượng khi thắng** (`energyBonus` trong `balance_json`) tính theo
quỹ **của chính người đó**, không phải một con số chung — công thức Exp là công
thức cá nhân, nên người tiêu dè sẻn không bị kéo xuống vì đồng đội xài hoang.
Chưa được cấp (chưa qua NPC) thì không có thưởng: chia cho 0 là hỏng, mà cho họ
100% cũng sai — họ chưa từng có bình nào.

**`energy_per_player = 0` là hợp lệ** và có nghĩa: *màn này không có trợ giúp*.
Ràng buộc cũ là `> 0`, giờ là `>= 0`.

**Giao diện.** `my_energy_granted === 0` nghĩa là CHƯA QUA NPC, khác hẳn "đã cấp
rồi và tiêu hết". Vẽ chung một thanh rỗng cho cả hai thì người chơi vừa vào màn
nhìn thấy một vạch đỏ cạn kiệt và tưởng mình sắp hỏng chuyện gì đó. Nên chưa cấp
thì HUD hiện chữ *"qua NPC để nhận"*, cấp rồi mới hiện thanh.

**Migration `0022_personal_energy`.** Đổi tên `stages.initial_team_energy` →
`energy_per_player`; thêm hai cột vào `stage_run_players`; bỏ hai cột năng lượng
khỏi `stage_runs`; gỡ `'lost_energy'` khỏi CHECK. Backfill lấy thẳng số của CẢ
ĐỘI làm số của mỗi người — không có cách đọc ngược chính xác từ một quỹ chung, và
đây là dữ liệu lịch sử chỉ dùng để xem lại.

**Nghiệm thu.** Vào màn "Cơn bão bất ngờ": `granted=0 remaining=0`, HUD hiện
*"qua NPC để nhận"*. Trả lời SAI câu của NPC → `my_energy: 0`, còn 2 lượt thử,
bảng phản hồi **không còn** dòng "mất năng lượng". Trả lời ĐÚNG → `my_energy:
100` ngay trong phản hồi, và HUD đổi sang thanh đầy `100/100`. Trả lời sai ở
nhiệm vụ chính → vẫn `100`. Nộp lại câu NPC đã đúng → vẫn `100`, không cấp hai
lần. Đọc thẳng database: `energy_granted=100, energy_remaining=100`, tổng
`energy_spent` của mọi bài nộp = **0**.

**Còn nợ:** nhóm nút **trợ giúp** (Dịch / nghe lại / xem text / hint) chưa dựng,
nên hiện chưa có gì tiêu năng lượng — thanh cấp xong thì đứng nguyên ở 100%. Đây
là lựa chọn có chủ ý: dựng đúng cái luật trước, cái sink sau. Cột
`quests.energy_cost` cũng vẫn **chưa được dùng**; nếu bật nó lên thì phải nhớ
MIỄN cho nhiệm vụ NPC, vì người chơi chỉ có năng lượng SAU khi qua NPC và một
cái cổng đòi năng lượng để đi qua là cái cổng không mở được.

### Bước 8b — Đổi luật năng lượng & luật cộng điểm theo `PROJECT OVERVIEW.md`

Nhánh `main` mang về `docs/PROJECT OVERVIEW.md` — bản luật chung cho **toàn dự
án**, không riêng Atlantis. Ba luật trong đó lật ngược cái `api/` đang chạy. Khi
merge, **doc theo bản luật chung**, còn code thành nợ, trả ở đây chứ không trả
trong commit merge: trộn một thay đổi cột database vào commit merge là cách chắc
chắn nhất để sáu tháng nữa không ai truy được vì sao nó đổi.

| Luật | Code đang làm | Phải thành |
|---|---|---|
| Quỹ năng lượng | `stage_runs.team_energy_initial` / `team_energy_remaining`, `stages.initial_team_energy` — **một quỹ cho cả đội** | Quỹ **riêng từng người**, cấp lúc vào màn |
| Hết năng lượng | `status = 'lost_energy'` → cả đội thua, chơi lại | **Không thua.** Chỉ mất quyền dùng hành động trợ giúp; `lost_energy` biến mất khỏi ràng buộc CHECK |
| Trả lời sai | Trừ `energyCost.wrongAnswer` vào quỹ đội | **Không trừ năng lượng.** Năng lượng chỉ tiêu cho Dịch / nghe lại / xem text. Trần 3 lượt thử vẫn giữ |
| Cộng điểm chiến lực | Cộng ngay lúc nộp; **thua vẫn giữ điểm cơ bản** | Chỉ chốt **khi thắng** — công thức Exp của `PROJECT OVERVIEW.md` không áp dụng cho lượt thua |

**Cái mất khi đổi:** lý lẽ ở [GAME_DOMAIN.md §"Thua thì vẫn giữ điểm cơ bản"] —
*học sinh trả lời đúng ba câu tiếng Anh thì đã học được cái gì đó, kể cả khi
đồng đội tiêu hết năng lượng*. Luật mới bỏ cái đó đi, nhưng bù lại nó cũng bỏ
luôn đường mà một người có thể làm cả đội thua (hết năng lượng), nên nỗi lo
"người giỏi bị phạt vì đồng đội kém" tự mất theo. Ghi lại ở đây để lần cân bằng
sau không ai đề xuất lại cái cũ mà tưởng là ý mới.

**Cái được giữ:** `status = 'lost_time'` đã có sẵn và khớp luật mới —
*"điều kiện thời gian là tiên quyết, hết giờ mà chưa xong là thua"*.

**Yêu cầu mới đi kèm (thuộc Bước 7, màn Phòng chờ):** mỗi nhân vật chỉ một người
được chọn, chọn rồi thì khoá; phòng thiếu người vẫn bắt đầu được và người chơi
gánh thêm nhiệm vụ của nhân vật còn trống; không mời người vào giữa lượt chơi.

- [x] Migration: `stage_runs` bỏ `team_energy_*`, thêm cột năng lượng theo người — **0022, xem Bước 6v**
- [x] Bỏ `'lost_energy'` khỏi CHECK của `stage_runs.status` — **0022**
- [x] `submit_answer` thôi trừ năng lượng khi sai, giữ trần 3 lượt — **Bước 6v**
- [ ] Dời việc cộng `world_progress.skill_pts` sang lúc kết thúc màn với `status = 'won'`
- [ ] Viết lại các đoạn nói về năng lượng đội trong `GAME_DOMAIN.md`
- [ ] Dựng nhóm nút TRỢ GIÚP (Dịch / nghe lại / xem text) — chỗ tiêu năng lượng

## 4. Nợ kỹ thuật của prototype — xử lý ở bước nào

| Nợ | Bước |
|---|---|
| Chấm điểm bằng `String.includes()` | 5 |
| Bug đáp án bám `currentTaskIndex` | 5 |
| Năng lượng 10/hero, chỉ trừ của Leo | 5 |
| `skillPts` hardcode 450 | 3 (vào `world_progress`, mặc định 0) |
| `initialEnergy` / `requiredSkillPts` / `grammarHint` bị bỏ qua | 3 |
| `alert()` + `window.location.reload()` | 8 |
| Không lưu tiến trình | 3 |
| Ảnh trùng lặp, tên file có dấu và khoảng trắng | 5 |
| Chữ tiếng Việt nằm trong code | 5 |
| Chấm điểm chung cho cả phòng, không tách theo người | 5 (nút Nộp bài) + 8 (ghi DB theo người) |
| Hiện thẳng đáp án đúng khi trả lời sai | 5 (phản hồi chỉ còn xong/chưa xong) |
| `.gitignore` không chặn `.env` | 1 — **đã sửa** |
| `alembic.ini` chết vì chú thích tiếng Việt trên Windows | 1 — **đã sửa**, file đó chỉ được chứa ASCII |
| `PORT` trong `.env` gốc bị Next bỏ qua | 1 — **đã sửa** bằng `web/scripts/with-root-env.mjs` |
| Cookie `Secure` theo `NODE_ENV` → đăng nhập vòng lặp trên HTTP | 4 — **đã sửa**, căn theo giao thức request |
| Không có test | 2 — **đã trả**, 95 test |
| `pnpm build` chạy đè lên `.next` của `pnpm dev` đang chạy → hỏng bundle | 2 — xem [DEPLOY §0.7](./DEPLOY.md) |

# ARCHITECTURE — Vitaminfun / Lost in Atlantis

> **SSOT về kiến trúc.** Sửa file này **trước**, rồi mới sửa code.
> Bổ trợ: [GAME_DOMAIN.md](./GAME_DOMAIN.md) (mô hình dữ liệu) · [UI_META_SCREENS.md](./UI_META_SCREENS.md) (bố cục màn hình) · [DEPLOY.md](./DEPLOY.md) · [TASKS.md](./TASKS.md)
> Cập nhật: 2026-08-25

---

## 1. Sản phẩm là gì

Một website duy nhất. Đăng nhập bằng tài khoản nào thì ra giao diện của vai trò đó:

| Vai trò | Vào để làm gì |
|---|---|
| **Giáo viên** | Soạn câu hỏi tiếng Anh, tạo world/chương/màn chơi, **gán câu hỏi vào từng nhiệm vụ** của màn, và **chơi thử** trước khi phát hành |
| **Học sinh** | Chọn world → vào world → tạo/tham gia phòng → chơi các màn cùng bạn bè |
| **Admin** | Quản lý tài khoản, cấu hình cân bằng game, chơi thử |

Nội dung game: [LOST IN ATLANTIS](./LOST%20IN%20ATLANTIS_Lạc%20vào%20vương%20quốc%20huyền%20thoại.md) — 1 world = 5 chương × 6 màn = 30 màn, mỗi màn ≥4 nhiệm vụ, đủ 30 mảnh bản đồ thì mở Cánh cổng Thời gian.

---

## 2. Stack

| Tầng | Công nghệ | Vì sao |
|---|---|---|
| Backend | FastAPI · SQLAlchemy 2.0 async · Alembic · Pydantic v2 · Python 3.12 | Phần chấm điểm — tài sản lớn nhất copy được — là Python. Máy đã cài sẵn |
| Database | PostgreSQL | |
| Frontend | Next.js 15 App Router · React 19 · TypeScript strict · Tailwind · next-intl | Question Builder 1.4k dòng copy được là React. Điều hướng theo vai trò cần framework thật |
| Game engine | Phaser 4, nạp bằng `dynamic(ssr: false)` | Chỉ route màn chơi mới tải Phaser |
| Cache / Realtime | Redis (chỉ bắt buộc từ Bước 7) | |

**Không dùng monorepo tooling.** Chỉ hai app độc lập (`api/`, `web/`), không pnpm workspace, không Turborepo — nhờ vậy ràng buộc *1 lệnh cho BE, 1 lệnh cho FE* là hiển nhiên chứ không phải cố gắng.

---

## 3. Cấu trúc thư mục

```
vitaminfun/
├── api/                          FastAPI
│   ├── app/
│   │   ├── core/                 config · security (JWT) · deps · errors · logging
│   │   ├── db/
│   │   │   ├── base.py, session.py
│   │   │   └── models/           user · media · game · progress · room · run
│   │   ├── modules/
│   │   │   ├── auth/             đăng nhập, đổi mật khẩu, JWT
│   │   │   ├── users/            hồ sơ, vai trò
│   │   │   ├── questions/        ⭐ kho câu hỏi + chấm điểm
│   │   │   │   └── grading/      graders.py · normalize.py  (hàm thuần, có test)
│   │   │   ├── media/            upload ảnh/audio, lưu đĩa local
│   │   │   ├── worlds/           CRUD world → chương → màn → nhiệm vụ   (giáo viên)
│   │   │   ├── play/             danh sách world, tiến trình, chơi màn   (học sinh)
│   │   │   └── rooms/            phòng chơi + WebSocket                 (Bước 7)
│   │   └── seeds/                dữ liệu mẫu, idempotent
│   ├── alembic/
│   ├── tests/
│   └── requirements.txt
│
├── web/                          Next.js
│   ├── src/
│   │   ├── app/[locale]/
│   │   │   ├── (auth)/login/
│   │   │   ├── (teacher)/teacher/
│   │   │   └── (student)/play/
│   │   ├── components/
│   │   │   ├── question/         ⭐ Builder · Renderer · registry (copy từ LMS)
│   │   │   ├── game/             PhaserCanvas · HUD trong trận
│   │   │   └── ui/               primitives
│   │   ├── game/                 ⭐ Phaser: scenes · GameState · EventBus (từ prototype)
│   │   ├── lib/                  api-client · api-types (sinh từ OpenAPI) · auth-context
│   │   └── i18n/                 locales (danh sách + mặc định) · routing · request
│   ├── messages/                 en.json · vi.json
│   └── package.json
│
└── docs/
```

---

## 3c. Hai trình thiết kế, một bộ máy

| | Thiết kế **màn chơi** | Thiết kế **bản đồ thiên hà** |
|---|---|---|
| Đường dẫn | `/teacher/worlds/{w}/stages/{s}/design` | `/teacher/worlds/design` |
| Kéo cái gì | vật thể nhiệm vụ trong cảnh | world trên bản đồ chọn world |
| Nền | `stages.background_media_id` | `galaxies.background_media_id` (+ nhạc) |
| | ảnh **hoặc video** — xem GAME_DOMAIN §Nền động | ảnh **hoặc video** |
| Toạ độ | `quests.scene_x/scene_y/icon_size` | `worlds.scene_x/scene_y/icon_size` |

Dùng chung, không phải chép:

- **`useDesignBoard()`** — toàn bộ phép toán kéo/thả/đổi cỡ: quy đổi con trỏ sang hệ toạ độ thế giới, nghe chuột trên `window` (kéo nhanh là con trỏ ra ngoài khung trước khi thả tay), ghi xuống server khi THẢ TAY.
- **`PulseFields`** — hai thanh trượt nhịp thở, xem trước trong lúc kéo, lưu khi nhả.
- **`resolvePulse()`** trong `game/world.ts` — một hàm quy đổi cho cả CSS lẫn tween Phaser.
- **`GALAXY = WORLD`** — một giá trị, hai cái tên, không có hai hằng số phải nhớ giữ bằng nhau.

`WorldOrb` thì chỉ dùng chung giữa trình thiết kế và màn của học sinh: giáo viên
kéo thấy sao thì học sinh nhìn thấy vậy, vì hai bên vẽ bằng đúng một component.

**Mọi hộp thoại đi qua `components/ui/modal.tsx`, và nó vẽ vào `document.body`
bằng portal.** Không phải để cho sang: `position: sticky` và `position: fixed`
LUÔN tạo ra một *stacking context*, nên `z-index` bên trong chỉ có nghĩa bên
trong cái hộp đó. Một hộp thoại `z-50` nằm trong cột `sticky` vẫn bị khung xem
trước `z-10` ở cột bên cạnh đè lên — hai con số ấy ở hai thế giới khác nhau.
`Modal` cũng gom luôn "bấm nền để đóng" và phím Escape, để không hộp nào quên.


---

## 3b. Ngôn ngữ

**Mặc định là TIẾNG ANH.** Đây là sản phẩm dạy tiếng Anh — chữ trên giao diện
cũng là một phần bài học, nên người học phải gặp tiếng Anh trước. Tiếng Việt là
lối thoát khi bí, không phải điểm xuất phát.

| | URL | `<html lang>` |
|---|---|---|
| Tiếng Anh (mặc định) | `/teacher` · `/play` | `en` |
| Tiếng Việt | `/vi/teacher` · `/vi/play` | `vi` |

`localePrefix: 'as-needed'` — ngôn ngữ mặc định không có tiền tố.

**Không dò `Accept-Language`.** `localeDetection: false`. Bật lên thì gần như
mọi máy ở Việt Nam bị đá sang `/vi` ngay lần vào đầu tiên, và "mặc định tiếng
Anh" chỉ đúng trên giấy. Đổi ngôn ngữ là hành động có chủ ý, qua bộ chọn ở
thanh trên cùng và ở màn đăng nhập.

**Nhớ lựa chọn bằng cookie `vf_locale`.** Chỉ bộ chọn ngôn ngữ ghi cookie này,
chỉ middleware đọc — nên nó tồn tại đồng nghĩa với "người dùng đã tự tay chọn".
Middleware chỉ tra tới nó khi URL KHÔNG có tiền tố (gõ thẳng tên miền, hay bị đá
về nhà sau khi đăng nhập); URL đã nói rõ ngôn ngữ thì URL thắng.

**Bốn nơi giữ danh sách ngôn ngữ, một nguồn.** `web/src/i18n/locales.ts` là dữ
liệu thuần (không import next-intl) nên middleware, `lib/routes.ts`,
`lib/i18n-text.ts` và bộ chọn đều dùng chung. Thêm ngôn ngữ = một dòng ở đó +
một file `messages/<mã>.json` đủ khoá.

**Chữ đa ngữ trong dữ liệu (`name_i18n`, `story_i18n`) — hai hàm, đừng lẫn:**

| | Dùng ở | Thiếu bản dịch thì |
|---|---|---|
| `pickText()` | chỗ HIỆN | mượn ngôn ngữ khác |
| `ownText()` | ô NHẬP trong màn soạn thảo | trả rỗng |

Ô nhập mà mượn bản dịch là đường ghi đè dữ liệu: người soạn chuyển sang tiếng
Việt, ô đã sẵn tên tiếng Anh, họ bấm Lưu — tên tiếng Anh thành tên tiếng Việt mà
chẳng ai gõ chữ nào. Muốn cho thấy bản gốc để đối chiếu thì đưa `pickText()`
xuống `placeholder`.

---

## 4. Một link, hai giao diện

```
GET /
 ├── chưa đăng nhập ─────────────────────► /login
 └── đã đăng nhập, đọc user.role
      ├── teacher ──► /teacher
      ├── student ──► /play
      └── admin   ──► /admin
```

Điều hướng **không đối xứng**, và đây là chủ ý:

| | `/teacher/*` | `/play/*` |
|---|---|---|
| student | ✗ đá về `/play` | ✓ chơi thật |
| teacher | ✓ | ✓ **chơi thử** |
| admin | ✓ | ✓ **chơi thử** |

Học sinh gõ tay `/teacher` bị đưa về `/play`. Nhưng giáo viên vào `/play` thì **không** bị chặn — họ phải chơi thử đúng cái học sinh sắp chơi, bằng đúng giao diện đó, trước khi phát hành world. Một world chưa ai chơi thử là một world chưa ai biết có chạy hay không.

Backend **không tin** vào middleware — mọi endpoint của giáo viên đều có `require_role("teacher")`. Chặn ở giao diện là để trải nghiệm, chặn ở API mới là bảo mật.

### Bản đồ route

**Giáo viên**
```
/teacher                                  bảng điều khiển
/teacher/questions                        kho câu hỏi
/teacher/questions/new                    trình soạn câu hỏi
/teacher/worlds                           danh sách world
/teacher/worlds/[id]                      chương & màn chơi của world
/teacher/worlds/[id]/stages/[sid]         ⭐ gán câu hỏi vào các nhiệm vụ của màn
```

**Học sinh** — và giáo viên/admin khi chơi thử, dùng chung y hệt các route này
```
/play                                     bản đồ thiên hà, chọn world      (S0)
/play/world/[id]                          chi tiết world, chương/màn, phòng (S1, S2)
/play/world/[id]/stage/[sid]              chi tiết màn                      (S3)
/play/room/[code]                         phòng chờ                         (S4)
/play/stage/[code]                        màn chơi Phaser                   (S5)
/play/run/[id]/review                     xem lại bài của mình sau khi hết màn (S6b)
```

### Chơi thử — giáo viên dùng chính giao diện học sinh

Không có giao diện xem trước riêng. Giáo viên bấm **Chơi thử** ở màn dựng world và được đưa thẳng vào `/play`, cùng route, cùng component, cùng Phaser scene mà học sinh sẽ thấy. Một bản dựng thứ hai chỉ dành cho giáo viên là một bản có thể chạy đúng trong khi bản thật đang hỏng.

Khác biệt nằm ở **dữ liệu**, không ở giao diện:

| | Học sinh | Giáo viên / Admin |
|---|---|---|
| Nhìn thấy world & màn | chỉ `status = published` | cả `draft` |
| Điều kiện mở khoá màn | luôn cưỡng chế | có nút **Bỏ qua điều kiện mở khoá** |
| Lượt chơi ghi vào DB | `is_trial = false` | `is_trial = true` |
| Phòng hiện ở danh sách công khai | có | **không** — học sinh không vào nhầm được bản nháp |
| Vào báo cáo & thống kê | có | không, mọi truy vấn lọc `users.role = 'student'` |

Trên đầu màn hình hiện một thanh cảnh báo cố định — không có nó thì sớm muộn cũng có người tưởng dữ liệu thử là dữ liệu thật:

```
+-------------------------------------------------------------------------+
| 🧪 CHẾ ĐỘ CHƠI THỬ — không tính vào báo cáo                             |
|    [x] Bỏ qua điều kiện mở khoá     [ Xoá tiến độ chơi thử ]  [ Thoát ] |
+-------------------------------------------------------------------------+
```

Lượt chơi thử **vẫn ghi tiến trình thật** cho chính tài khoản giáo viên đó (điểm chiến lực, mảnh bản đồ, tiến độ màn). Đây là chủ ý: nếu chơi thử không ghi gì thì không thể kiểm chứng chính những thứ hay hỏng nhất — cộng điểm, trao mảnh, mở khoá màn kế tiếp. Nút **Xoá tiến độ chơi thử** dọn lại để thử từ đầu.

`is_trial` đã có sẵn trên `stage_runs` từ mẫu `Attempt` của LMS — không phải thêm cột.

### Màn hình quan trọng nhất — gán câu hỏi vào nhiệm vụ

`/teacher/worlds/[id]/stages/[sid]` là lý do tồn tại của việc tái sử dụng LMS:

```
+---------------------------------------------------------------------------+
| < Chương 1   MÀN 1 — Sự cố dưới đáy biển        [Lưu nháp] [Xuất bản]      |
+----------------------------------+----------------------------------------+
|  SƠ ĐỒ MÀN CHƠI                  |  KHO CÂU HỎI                            |
|                                  |  [Tìm...] [Dạng v] [CEFR v] [Tags v]    |
|   [ ảnh nền boong tàu ]          |  ---------------------------------------|
|                                  |  [ ] Lower the sails      MCQ_SINGLE A1 |
|   (NPC) Captain Drake            |  [ ] Which tool...        MCQ_SINGLE A1 |
|     └ Hội thoại: 2 bước  [sửa]   |  [ ] Type the password    GAP_FILL   A2 |
|                                  |  [ ] Orichalcum means...  SHORT_ANS  A2 |
|   (1) Cột buồm    → đã gán  [x]  |  ---------------------------------------|
|   (2) Thân tàu    → đã gán  [x]  |          [ GÁN VÀO NHIỆM VỤ ĐANG CHỌN ] |
|   (3) Đèn phao    → CHƯA GÁN     |                                         |
|   (4) Hòm báu     → đã gán  [x]  |  hoặc  [ + SOẠN CÂU HỎI MỚI ]           |
|       └ thưởng Mảnh bản đồ #1    |                                         |
+----------------------------------+----------------------------------------+
| ⚠ Chưa xuất bản được: nhiệm vụ 3 chưa có câu hỏi (cần tối thiểu 4)         |
+---------------------------------------------------------------------------+
```

Bộ chọn bên phải copy từ `question-picker.tsx` của LMS. Điều kiện xuất bản (≥4 nhiệm vụ, mỗi nhiệm vụ có câu hỏi, đúng 1 nhiệm vụ trao mảnh bản đồ) kiểm tra ở service, không phải ở giao diện.

---

## 5. Tái sử dụng từ LMS EDUPLAY

> `D:\Programs\LMS` là **kho tham khảo chỉ đọc**. Không sửa, không commit, không phụ thuộc lúc chạy.
> Code được **copy sang và tổ chức lại**, từ đó vitaminfun tự đứng một mình.

| Nguồn | Dòng | Copy được | Ghi chú |
|---|---|---|---|
| `grading/graders.py` + `normalize.py` | 266 | **100%** | Chỉ import stdlib. Hàm thuần, không đụng DB |
| `docs/question-schemas.md` | 25KB | **100%** | Hợp đồng 16 dạng câu hỏi |
| `questions/schemas.py` | 274 | ~90% | Thuần Pydantic |
| `questions/service.py` + `router.py` | 331 | ~60% | Giữ logic che đáp án; thay `apply_scope()` bằng kiểm tra vai trò |
| `components/question/*` | 1.446 | ~85% | Builder · Renderer · registry · template |
| `components/exam/question-picker.tsx` | 248 | ~80% | Thành bộ chọn câu hỏi cho nhiệm vụ |
| `core/` config · security · deps · errors | ~600 | ~80% | Cắt phần tenant |
| `attempts/scoring.py` | 90 | ~70% | Cộng dồn điểm → Điểm chiến lực |

**Cố ý KHÔNG mang sang:** multi-tenant, RBAC động 4 mức phạm vi, lớp học, giao bài, đề thi, cổng phụ huynh, quản trị theme/i18n động. Đó là nghiệp vụ của một LMS trung tâm, không phải của game này.

---

## 6. Sáu nguyên tắc bất di bất dịch

1. **Chấm điểm chỉ có một bản, viết bằng Python, chạy ở server.** Frontend không tính điểm, kể cả chế độ luyện tập. `answer_json` không rời server khi đang chơi.
2. **Nhiệm vụ LÀ câu hỏi.** Không có bảng câu hỏi riêng cho game. Giáo viên dùng một trình soạn duy nhất.
3. **Không hardcode giá trị cấu hình.** Chữ hiển thị → `messages/`. Số cân bằng game → `worlds.balance_json`. Cổng, đường dẫn, số worker → `.env`. Lệnh deploy không được chứa giá trị cấu hình nào.
4. **Ảnh và audio đi qua `media_assets`**, không lưu URL trần, không nhét vào bundle.
5. **Deploy = 1 lệnh cho BE, 1 lệnh cho FE.** Migration và seed nằm trong lệnh deploy. Seed phải idempotent.
6. **Tầng realtime không quyết đúng/sai** — chỉ chuyển tiếp kết quả server đã chấm. Nhờ vậy sau này thay bằng Go/Elixir không đụng luật chơi.

---

## 7. Vai trò & quyền

Bỏ RBAC động của LMS. Ba vai trò cố định trên `users.role`:

```python
class UserRole:
    ADMIN   = "admin"      # quản lý tài khoản, chỉnh balance_json, chơi thử
    TEACHER = "teacher"    # soạn câu hỏi, dựng world/màn/nhiệm vụ, chơi thử
    STUDENT = "student"    # chơi
```

Cưỡng chế bằng một dependency duy nhất:
```python
@router.post("/worlds", dependencies=[Depends(require_role(UserRole.TEACHER))])
```

Các endpoint `/play/*` **không** giới hạn vai trò — cả ba vai trò đều gọi được. Cái thay đổi theo vai trò là **phạm vi dữ liệu**, và nó nằm ở đúng một chỗ:

```python
def visible_worlds(user):
    q = select(World)
    if user.role == UserRole.STUDENT:
        q = q.where(World.status == "published")   # giáo viên thấy cả draft
    return q
```

Viết điều kiện này rải rác ở từng endpoint là cách chắc chắn nhất để có ngày một endpoint quên nó và lộ world nháp cho học sinh.

Không có `tenant_id`. Đây là **đảo ngược có chủ ý** so với bản kế hoạch trước: khi còn định gộp vào LMS đa trung tâm thì `tenant_id` là bắt buộc; giờ vitaminfun đứng riêng với đúng ba vai trò, mang theo cột đó nghĩa là mọi bảng có một cột luôn cùng giá trị và mọi truy vấn có một điều kiện thừa. Nếu sau này cần bán cho trung tâm, thêm lại là một migration — đắt, nhưng không đắt bằng việc mang nó suốt chặng đường mà không dùng.

---

## 8. Luồng dữ liệu một nhiệm vụ, từ lúc soạn tới lúc chấm

```
Giáo viên soạn câu hỏi
      │  content_json (đề, không có đáp án)  +  answer_json (đáp án)
      ▼
   questions ──────────────┐
                           │ quests: gắn câu hỏi vào vật thể trong màn,
                           │         đặt chi phí năng lượng
                           ▼
                        stages
                           │
   Học sinh bấm Bắt đầu    │  đóng băng thành snapshot_json + answer_key_json
                           ▼
                       stage_runs ───► gửi snapshot xuống 4 máy (KHÔNG có đáp án)
                           │
   MỖI người tự trả lời,   │
   tự bấm "Nộp bài"        ▼
       POST /play/runs/{id}/quests/{qid}/answer      ← sai thì thử lại, tối đa N lần
                           │  grade(qtype, content, answer, response, points)
                           ▼
                     quest_answers ──┬─► trả NGƯỜI NỘP: CHỈ xong/chưa xong + còn mấy lượt
                     (nhật ký từng   │   (không điểm, không đáp án, không giải thích)
                      lần thử)       └─► phát cả phòng: "ai xong nhiệm vụ nào" + năng lượng
                           │
                           ▼
              cộng điểm cơ bản → world_progress.skill_pts   (âm thầm, chưa hiện)
                           │
   Kết thúc màn            ▼
              scoring → thưởng thời gian/năng lượng → world_progress
                       Mảnh bản đồ → map_shards_owned (cho TẤT CẢ thành viên)
                           │
                           ▼
              GET /play/runs/{id}/review ──► giờ mới lộ điểm, đáp án, giải thích
                                             CHỈ bài của chính người gọi
```

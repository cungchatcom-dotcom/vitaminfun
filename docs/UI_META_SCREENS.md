# UI SCREENS — Bố cục màn hình (Wireframe)

> Đọc trước: [ARCHITECTURE.md](./ARCHITECTURE.md) (bản đồ route) · [LOST IN ATLANTIS_...md](./LOST%20IN%20ATLANTIS_Lạc%20vào%20vương%20quốc%20huyền%20thoại.md) (luật chơi).
> Tài liệu này mô tả:
> - **T0 → T3** — giao diện **giáo viên** (Phần B, cuối file)
> - **S0 → S4** — giao diện **học sinh** trước khi vào trận
> - **S6 → S7** — kết thúc màn và end-game
>
> Bố cục màn chơi in-game (S5) xem tại [backup/Mockup Designs.md](./backup/Mockup%20Designs.md).

## Bảng màu & phong cách dùng chung

| Token | Mã màu | Dùng cho |
|---|---|---|
| `--slate-deep` | `#102229` | Nền khung, panel đá phiến biển sâu |
| `--orichalcum` | `#D4AF37` | Viền kim loại, tiêu đề, nút chính |
| `--glow-cyan` | `#00F0FF` | Highlight, đường nối thiên hà, trạng thái active |
| `--alert-red` | `#FF3B30` | Cảnh báo, hết giờ, khóa |
| `--locked-gray` | `#4A5A62` | Hành tinh/màn chơi đang khóa |

- Font tiêu đề: serif cổ điển (kiểu khắc đá); font nội dung: sans-serif dễ đọc.
- Toàn bộ text giao diện: **tiếng Việt**. Text hội thoại/nhiệm vụ: **tiếng Anh**.

---

# PHẦN A — GIAO DIỆN HỌC SINH

> Route `/play/*`. **Giáo viên và admin dùng đúng những màn hình này để chơi thử** — không có bản xem trước riêng.

## Thanh chơi thử — hiện trên MỌI màn `/play/*` khi vai trò không phải học sinh

```
+=========================================================================+
| 🧪 CHẾ ĐỘ CHƠI THỬ — không tính vào báo cáo                            |
|    [x] Bỏ qua điều kiện mở khoá    [ Xoá tiến độ chơi thử ]  [ Thoát ] |
+=========================================================================+
```

- Nền màu cảnh báo, ghim trên cùng, không cuộn mất. Không có nó thì sớm muộn cũng có người tưởng dữ liệu thử là dữ liệu thật.
- **Bỏ qua điều kiện mở khoá** cho phép nhảy thẳng vào màn 30 mà không cần cày điểm chiến lực. Tắt nó đi để kiểm chứng chính cái cổng khoá đó.
- World và màn ở trạng thái `draft` hiện thêm nhãn `NHÁP` — học sinh không nhìn thấy chúng.
- Phòng do giáo viên tạo **không** xuất hiện ở danh sách phòng công khai.
- **Thoát** quay về `/teacher`.

Chi tiết dữ liệu khác nhau ra sao: [ARCHITECTURE §4](./ARCHITECTURE.md).

---

## S0 — GALAXY MAP (Danh sách Vũ trụ / Thiên hà / Hành tinh)

**Mục đích:** Điểm vào chính sau đăng nhập. Người chơi chọn Vũ trụ → Dải thiên hà → Hành tinh (World) để chơi.

```
+=========================================================================================+
| [LOGO Vitaminfun]   Vũ trụ: [ ADVENTURE UNIVERSE  v ]        Thuan | 1.250 Xu | [*] [!] |
+=========================================================================================+
|  DẢI THIÊN HÀ                |                                                          |
|  --------------------------- |            BẢN ĐỒ THIÊN HÀ (Canvas nền sao)              |
|  (o) Văn minh cổ đại    (3)  |                                                          |
|  ( ) Thiên nhiên hoang dã(2) |          .-------.                    .-------.          |
|  ( ) Tương lai & Công nghệ(0)|          |  (O)  |--------------------|  [X]  |          |
|  ( ) Việt Nam ký sự     (1)  |          |ATLANTIS|                   | MAYA  |          |
|                              |          '-------'                    '-------'          |
|  --------------------------- |         Lost in Atlantis              Yêu cầu:           |
|  BỘ LỌC                      |         [####......] 12/30            Hoàn thành         |
|  [ ] Đang chơi dở            |         Chiến lực 450 | Mảnh 12       Atlantis           |
|  [ ] Đã hoàn thành           |                        \                                 |
|  [ ] Miễn phí                |                         \          .-------.             |
|  Độ khó: [Easy][Med][Hard]   |                          \---------|  [X]  |             |
|                              |                                    | AI CẬP|             |
|                              |                                    '-------'             |
+=========================================================================================+
| Hành tinh đang chọn: ATLANTIS | Easy | 16-25 tuổi | 30 màn | Miễn phí   [ VÀO WORLD > ] |
+=========================================================================================+
```

**Thành phần:**

1. **Header:** dropdown chọn Vũ trụ, avatar + ví Xu, nút cài đặt/thông báo.
2. **Sidebar trái:** danh sách Dải thiên hà (kèm số hành tinh đã mở), bộ lọc theo trạng thái/độ khó.
3. **Canvas giữa:** các hành tinh vẽ trên nền sao, nối bằng đường sáng cyan thể hiện thứ tự mở khóa.
   - Hành tinh **đã mở**: xoay nhẹ, có quầng sáng, hiện thanh tiến độ `12/30`, điểm chiến lực, số mảnh bản đồ.
   - Hành tinh **khóa**: xám `--locked-gray`, icon ổ khóa, hover hiện điều kiện mở khóa.
   - Hành tinh **đã hoàn thành**: viền vàng Orichalcum + huy hiệu hoàn thành.
4. **Footer:** tóm tắt hành tinh đang hover/chọn + nút **VÀO WORLD**.

**Dữ liệu cần:** `universes[]`, `galaxies[]`, `worlds[] { id, name, thumbnail, difficulty, ageRange, price, stageCount, unlockCondition, myProgress { stagesCompleted, skillPts, shards } }`

---

## S1 — WORLD DETAIL (Chi tiết Hành tinh / World)

**Mục đích:** Trung tâm điều phối của 1 world: xem mô tả, tiến độ cá nhân, chương/màn, phòng chơi đang mở, tạo phòng.

```
+=========================================================================================+
| < Thiên hà   |   LOST IN ATLANTIS — Lạc vào vương quốc huyền thoại   |  Thuan  | [*]    |
+=========================================================================================+
| [ KEY ART BANNER — thành phố Atlantis dưới đáy biển, hiệu ứng bọt khí ]                  |
|  Easy | 16-25 tuổi | 5 chương | 30 màn | Học: Nghe-Nói-Đọc-Viết, Teamwork                |
+=========================================================================================+
| TIẾN ĐỘ CỦA BẠN TẠI WORLD NÀY                                                            |
| Điểm chiến lực: 450   Mảnh bản đồ: 12/30   Màn đã qua: 12/30   Thời gian chơi: 4h20m     |
| [########............] 40%      Màn tiếp theo gợi ý: Màn 13 — Quảng trường nước          |
+-----------------------------------------------------------------------------------------+
| [ TỔNG QUAN ] [ CHƯƠNG & MÀN CHƠI ] [ PHÒNG CHƠI ] [ ĐỒNG ĐỘI ] [ BẢNG XẾP HẠNG ]        |
+-----------------------------------------------------------------------------------------+
|  CHƯƠNG & MÀN CHƠI                          |  PHÒNG CHƠI ĐANG MỞ           [+ TẠO PHÒNG]|
|  v Chương 1: Sự cố dưới đáy biển   6/6 [v]  |  .----------------------------------------.|
|     v1  v2  v3  v4  v5  v6                  |  | (live) Phòng #A12 | Màn 13             ||
|  v Chương 2: Ngoại ô Thành phố TT  6/6 [v]  |  | 3/4 người | Chủ phòng: Minh            ||
|     v7  v8  v9  v10 v11 v12                 |  | Bắt đầu sau 00:18     [ THAM GIA ]     ||
|  v Chương 3: Đô thị cổ Hoàng gia   0/6      |  |----------------------------------------||
|     >13 [X]14 [X]15 [X]16 [X]17 [X]18       |  | (wait) Phòng #B07 | Màn 9 (chơi lại)   ||
|  > Chương 4: Tháp Chúa Trời        [X]      |  | 2/4 người | Chủ phòng: Lan             ||
|  > Chương 5: Cuộc đua với Thời gian[X]      |  | Đang chờ...           [ THAM GIA ]     ||
|                                             |  '----------------------------------------'|
|  [ XEM TẤT CẢ MÀN CHƠI > ]                  |  Tự làm mới mỗi 5s                         |
+-----------------------------------------------------------------------------------------+
|  ĐỒNG ĐỘI TỪNG CHƠI CÙNG                                                                 |
|  Minh (online) 8 màn chung | Lan (online) 5 màn chung | Khoa (offline) 2 màn chung        |
|  [ + MỜI VÀO PHÒNG ]                                                                     |
+=========================================================================================+
|                     [ CÁNH CỔNG THỜI GIAN — cần 30/30 mảnh (đang 12/30) ]  KHÓA          |
+=========================================================================================+
```

**Thành phần:**

1. **Banner:** key art + metadata world (độ khó, lứa tuổi, số chương/màn, kỹ năng học được, giá bán).
2. **Panel tiến độ cá nhân:** điểm chiến lực **của riêng world này**, số mảnh bản đồ, số màn đã qua, thanh %, gợi ý màn tiếp theo.
3. **Tabs:** Tổng quan / Chương & Màn chơi / Phòng chơi / Đồng đội / Bảng xếp hạng.
4. **Cột trái — Accordion chương:** mỗi chương xổ ra 6 màn với 4 trạng thái: `hoàn thành` · `đang mở` · `khóa` · `có thể chơi lại`.
5. **Cột phải — Danh sách phòng:** mã phòng, màn chơi, số người `3/4`, avatar, chủ phòng, đếm ngược, nút **THAM GIA**; nút **+ TẠO PHÒNG** nổi bật màu Orichalcum.
6. **Dải đồng đội:** người từng chơi cùng, trạng thái online, số màn đã chơi chung, nút mời.
7. **Footer — Cánh cổng Thời gian:** khóa cho tới khi đủ 30/30 mảnh; click khi chưa đủ mở màn hình S7 liệt kê màn/nhiệm vụ còn thiếu.

**Dữ liệu cần:** `world`, `chapters[] { stages[] { id, status } }`, `rooms[] { code, stageId, players[], hostId, countdown, state }`, `myWorldProgress`, `teammates[]`

---

## S2 — STAGE LIST (Danh sách màn chơi của 1 World)

**Mục đích:** Xem toàn bộ 30 màn theo chương dưới dạng lộ trình, thấy rõ điều kiện mở khóa và cơ chế **nhảy bậc**.

```
+=========================================================================================+
| < Atlantis   |   DANH SÁCH MÀN CHƠI (30)   | Chiến lực 450 | Mảnh 12/30 | [Lưới][Lộ trình]
+=========================================================================================+
|  CHƯƠNG 3: ĐÔ THỊ CỔ HOÀNG GIA                                          4/6 hoàn thành   |
|                                                                                          |
|   .----------.   .----------.   .----------.   .----------.   .----------.   .----------.|
|   | [v] 13   |-->| [>] 14   |-->| [X] 15   |-->| [X] 16   |-->| [X] 17   |-->| [X] 18   ||
|   | Quảng    |   | Thư viện |   | Chợ nổi  |   | Đền thờ  |   | Hầm mộ   |   | Ngai vàng||
|   | trường   |   | đá       |   |          |   |          |   |          |   |          ||
|   | Mảnh #13 |   | cần 400  |   | cần 480  |   | cần 560  |   | cần 640  |   | cần 720  ||
|   | *** 4/4  |   | 4 nh.vụ  |   | 4 nh.vụ  |   | 5 nh.vụ  |   | 5 nh.vụ  |   | 6 nh.vụ  ||
|   |[CHƠI LẠI]|   |[ VÀO >  ]|   |  KHÓA    |   |  KHÓA    |   |  KHÓA    |   |  KHÓA    ||
|   '----------'   '----------'   '----------'   '----------'   '----------'   '----------'|
|                                                                                          |
|   NHẢY BẬC: Bạn còn thiếu 30 điểm chiến lực để mở thẳng Màn 16 (bỏ qua 14, 15).          |
|   Chơi lại Màn 13 để cày thêm điểm.                          [ CHƠI LẠI MÀN 13 ]         |
+=========================================================================================+
```

**Thành phần:**

- Toggle **Lưới / Lộ trình**; sticky header hiện điểm chiến lực + mảnh bản đồ.
- Mỗi thẻ màn: số màn, tên, trạng thái, số nhiệm vụ, phần thưởng mảnh bản đồ, **yêu cầu điểm chiến lực**, số sao đạt được, nút hành động.
- **Banner nhảy bậc:** tính sẵn màn xa nhất có thể mở nếu cày thêm điểm, gợi ý màn nên chơi lại.
- Màn đã hoàn thành hiện số sao theo số nhiệm vụ hoàn thành và cho phép **chơi lại để cày điểm**.

---

## S3 — STAGE DETAIL (Chi tiết 1 màn chơi)

**Mục đích:** Xem trước nội dung màn, kiểm tra điều kiện, rồi Tạo phòng / Tham gia phòng.

```
+=========================================================================================+
| < Danh sách màn   |   MÀN 13 — QUẢNG TRƯỜNG NƯỚC   |  Chương 3 · Đô thị cổ Hoàng gia    |
+=========================================================================================+
|  [ ẢNH BỐI CẢNH MÀN CHƠI ]          |  ĐIỀU KIỆN & PHẦN THƯỞNG                          |
|                                     |  Yêu cầu điểm chiến lực: 400  (bạn có 450 OK)     |
|  Cốt truyện:                        |  Thời gian: 05:00                                 |
|  "Quảng trường trung tâm bị ngập.   |  Năng lượng đội: 100                              |
|   Nhóm phải điều khiển hệ thống van |  Số người chơi: 1-4 (thiếu -> Bot thay thế)       |
|   cổ để rút nước trước khi thủy     |  Phần thưởng: Mảnh bản đồ #13                     |
|   triều dâng."                      |  Điểm chiến lực tối đa: +80                       |
|                                     |                                                   |
|  NPC CỐ VẤN:                        |  NGỮ PHÁP TRỌNG TÂM                               |
|  [Portrait] Guardian Golem          |  Imperatives · Present Simple · Prepositions       |
|  "Rotate the mirror 45 degrees!"    |  Độ khó: [##.] Medium                             |
+-----------------------------------------------------------------------------------------+
|  DANH SÁCH NHIỆM VỤ (4)                                                                  |
|  1. Nghe NPC hướng dẫn và điều khiển nhịp nước          (Listening + Imperatives)         |
|  2. Nói mật khẩu mở ô cờ áp lực                         (Speaking)                       |
|  3. Viết câu lệnh khóa van                              (Writing)                        |
|  4. Thu thập Mảnh bản đồ #13                            (Reading)                        |
|  LƯU Ý: Mọi thành viên phải hoàn thành ít nhất 1 nhiệm vụ thì màn chơi mới được tính xong |
+-----------------------------------------------------------------------------------------+
|      [ + TẠO PHÒNG ]      [ THAM GIA PHÒNG NGẪU NHIÊN ]      [ CHƠI ĐƠN (SINGLE) ]       |
+=========================================================================================+
```

**Ghi chú:** Nếu **chưa đủ điểm chiến lực**, các nút hành động bị vô hiệu hóa và hiện dòng cảnh báo đỏ: *"Bạn còn thiếu N điểm chiến lực. Chơi lại các màn trước để cày thêm."*

---

## S4 — CREATE ROOM / LOBBY (Tạo phòng & Phòng chờ)

**Mục đích:** Tập hợp tối đa 4 người, mời bạn bè, chọn nhân vật, sẵn sàng và bắt đầu.

```
+=========================================================================================+
| < Thoát phòng  |  PHÒNG #A12  |  Màn 13 — Quảng trường nước  |  Mã mời: ATL-A12  [copy] |
+=========================================================================================+
|  THÀNH VIÊN (3/4)                              |  MỜI BẠN BÈ                             |
|  .-------------------------------------------. |  [ Tìm bạn bè...                    ]   |
|  | (chủ phòng) Minh                          | |  -------------------------------------- |
|  |    [LEO — Guardian | xanh dương]  SẴN SÀNG| |  Lan      Online       [ MỜI ]          |
|  |-------------------------------------------| |  Khoa     Online       [ MỜI ]          |
|  |    Thuận (Bạn)                            | |  Hương    Đang chơi    [ MỜI ]          |
|  |    [MAYA — Scholar | tím]  v   CHƯA SẴN   | |  Nam      Offline      [ MỜI ]          |
|  |-------------------------------------------| |  -------------------------------------- |
|  |    Lan                                    | |  Đã mời: Khoa (đang chờ...)             |
|  |    [SAM — Fixer | vàng]           SẴN SÀNG| |                                         |
|  |-------------------------------------------| |  CHIA SẺ LỜI MỜI                        |
|  |    [ TRỐNG ]                              | |  [ Sao chép link ]  [ Zalo ]            |
|  |    + Mời bạn   /   + Thêm Bot (JADE)      | |  Mã phòng: ATL-A12                      |
|  '-------------------------------------------' |                                         |
+-----------------------------------------------------------------------------------------+
|  CHAT PHÒNG                                    |  THÔNG TIN MÀN CHƠI                      |
|  Minh: chuẩn bị nhé                            |  Thời gian 05:00 | Năng lượng đội: 100   |
|  Lan: ok                                       |  Thưởng: Mảnh #13                        |
|  [ Nhập tin nhắn...                    ] [Gửi] |  Thiếu người -> Bot tự thay sau 30s      |
+=========================================================================================+
|  Tự động bắt đầu sau  00:18   [#####.....]     [ SẴN SÀNG ]   [ BẮT ĐẦU ] (chủ phòng)    |
+=========================================================================================+
```

**Quy tắc:**

- Tối đa **4 người / phòng**. Slot trống có thể **mời bạn** hoặc **thêm Bot**.
- Mỗi người chọn **1 nhân vật khác nhau** (Leo / Maya / Sam / Jade) — nhân vật đã bị chọn sẽ khóa.
- Đếm ngược **30s**: hết giờ thì tự điền Bot vào slot trống và bắt đầu. Chủ phòng có thể bấm **BẮT ĐẦU** sớm khi mọi người đã Sẵn sàng.
- Chế độ **Single**: bỏ qua đếm ngược, vào chơi ngay với 3 Bot.

---

## S5 — TRONG TRẬN: HỘI THOẠI VỚI NGƯỜI CANH GIỮ

Mỗi nhiệm vụ là **một cuộc nói chuyện** với người canh giữ vật thể đó, không phải một tờ bài tập bung ra giữa cảnh. Người canh giữ hỏi, học sinh trả lời, người canh giữ nói đúng hay sai rồi hỏi tiếp.

```
+=========================================================================+
|  Cột buồm chính        Câu 2/3                    ⏱ 03:12    [Rời đi]  |
+-------------------------------------------------------------------------+
|                  ╭──────────────────────────────────╮                   |
|                  │ Bão đang tới. Việc đầu tiên      │                   |
|   ╭────────╮     │ cậu làm là gì?                   │                   |
|   │ avatar │     ╰─╮────────────────────────────────╯                   |
|   │  NPC   │       ▾                                                    |
|   ╰────────╯              ╭────────────────────╮      ╭────────╮        |
|                           │ Lower the sails!   │      │ avatar │        |
|                           ╰──────────────────╮─╯      │ player │        |
|                  ╭─────────────────────╮     ▾        ╰────────╯        |
|                  │ Chuẩn! Nhanh tay lên│                                |
|                  ╰─╮───────────────────╯                                |
|                    ▾                                                    |
+-------------------------------------------------------------------------+
|  [ A · Lower the sails! ]        [ B · Open the chest! ]                 |
|  [ C · Take a nap!      ]                                               |
|  [💡 Gợi ý]                                        [    Trả lời    ]    |
+=========================================================================+
```

Ảnh nền trải kín phía sau — mặc định là ảnh nền của màn, tức đúng chỗ học sinh đang đứng.

### Vòng một câu

1. Người canh giữ hỏi. Câu **nghe** thì bong bóng mang trình phát gọn (`CompactAudio`), tự phát một lần, chữ giấu sau nút *Lời thoại* — đúng luật ở [GAME_DOMAIN §3c](./GAME_DOMAIN.md).
2. Học sinh trả lời ở dải dưới. Dải này đổi theo dạng câu hỏi; **học sinh không bao giờ thấy tên dạng câu**.
3. Bài trả lời hiện thành bong bóng bên phải, kiểu tin nhắn.
4. Người canh giữ đáp — **chỉ nói đúng hay sai, không bao giờ nói đáp án**.

### Luật sai: một lần được làm lại, hai lần thì đi tiếp

| | nhiệm vụ NPC (`phase = advisor`) | nhiệm vụ thường |
|---|---|---|
| Số lần sai cho phép | **không giới hạn** | **1** |
| Sai quá thì sao | vẫn đứng lại, hỏi tiếp cùng câu | NPC nói *"thôi được, để đó"* rồi **chuyển câu**, câu đó 0 điểm |

Nhiệm vụ NPC không giới hạn vì không qua nó thì cả màn đứng lại — server đã cưỡng chế bằng `not is_gate` trong `_grade_one`.

Nhiệm vụ thường thì trần này là `balance_json.maxAttemptsPerQuestion` (**đặt về `2`**), và điểm giảm dần theo `attemptPenalty` (**`[1.0, 0.6]`**). Đúng ngay lần đầu ăn đủ điểm; đúng ở lần hai còn 60%.

**Sai lần hai vẫn KHÔNG lộ đáp án.** Ba người ngồi cạnh có thể chưa làm tới câu đó, và một đáp án đọc được là một lần chơi lại mất nghĩa. Đáp án chỉ lộ khi có luật riêng cho phép — hiện chưa có, xem §S6b.

### Chốt ở cuối nhiệm vụ

Hết câu cuối, server cộng điểm từng câu rồi so với `pass_score`. Qua thì người canh giữ chúc mừng và trao sổ tay; không qua thì nói tiếc, học sinh bấm lại vào vật thể để chơi lại nhiệm vụ từ đầu.

Lời chia tay (`advisor_outro_i18n`) và nút trao sổ tay **không còn là một bảng riêng** — chúng là hai tin nhắn cuối của chính cuộc hội thoại.

### Người canh giữ NÓI, không phải hiện ra

Mỗi câu của NPC đi qua một nhịp *đang gõ* (ba chấm trong bong bóng) rồi mới hiện. Thời gian gõ theo độ dài câu, **trần khoảng 1,1 giây** — chờ ba giây cho một lời khen hai chữ thì không còn là tự nhiên, mà là chậm. Nhiều câu liên tiếp thì gõ từng câu một.

Đây là khác biệt giữa *đang nói chuyện với ai đó* và *một cái đèn báo đúng/sai*. Vế thứ hai là thứ bảng câu hỏi cũ đã làm rồi.

Thời gian này **đã tính vào trần giờ của màn** khi cân bằng — nó không phải phần thừa để cắt đi cho nhanh.

### Vào lại giữa chừng: dựng lại nguyên cuộc hội thoại

Không có bảng nào lưu khung chat, và không cần:

- `quest_answers` đã là **nhật ký từng lần thử** — `question_id`, `attempt_no`, `response_json`, `is_correct`. Từ đó dựng lại được cả những lần sai.
- `quest_drafts` giữ câu đang gõ dở.
- Lời của NPC chọn theo **hash của `(question_id, attempt_no)`**, không phải `Math.random()`. Cùng một lần thử luôn cho ra cùng một câu, nên vào lại thấy đúng cuộc hội thoại đã diễn ra.

Chọn theo hash chứ không lưu transcript: lưu nghĩa là một lượt ghi database cho **mỗi tin nhắn**, để đổi lấy một kết quả y hệt.

### Lời của người canh giữ

Ba tập câu, nằm ở `messages/` chứ không viết cứng: chào, khen (đúng), chê (sai). Chê có đường ghi đè riêng cho từng câu — `content.wrong_answer_message`, đã có sẵn trong lược đồ câu hỏi và đang được nhiệm vụ NPC dùng.

Không lấy hai câu giống nhau liền nhau. Cách chọn theo hash ở trên lo luôn việc đó.

---

## S5b — TRÌNH THIẾT KẾ HỘI THOẠI (giáo viên)

Màn hội thoại **không còn là sáu khối kéo thả**. Nó là một cuộc trò chuyện cuộn
được, dựng theo Messenger — xem §S5.

Một danh sách cuộn thì không có "chỗ" để căn: nó dài ra theo số câu đã hỏi. Nên
trình thiết kế rút còn đúng những thứ vẫn còn tác dụng:

| thẻ | sửa gì |
|---|---|
| Dữ liệu mẫu | chọn nhiệm vụ để lấy câu hỏi thật làm mẫu |
| Khoảnh khắc | xem tư thế hai bên ở từng nhịp (đang đọc đề · đang nghĩ · đúng · sai) |
| Người canh giữ | gán NPC cho nhiệm vụ đang xem |
| **Ảnh nền tấm bảng** | tuỳ chọn; không có thì tấm bảng trong mờ và cảnh chơi hiện xuyên qua |
| **Ảnh bong bóng** | hai ảnh, một cho mỗi bên; không có thì dùng lớp kính mặc định |
| Phạm vi | đang sửa bố cục của cả world hay của riêng màn này |

Khung xem trước là **chính `QuestChat`** mà học sinh nhìn thấy, với ba tin nhắn
mẫu — đủ để thấy cả hai kiểu bong bóng và cách chúng dính thành cụm. Ít hơn thì
không so được hai bên; nhiều hơn thì khung xem trước thành một đoạn văn, mà thứ
người dựng đang chỉnh chỉ là màu và ảnh.

Ảnh bong bóng **kéo giãn** cho vừa bong bóng chứ không lặp, và bong bóng vẫn dài
ra theo chữ — nên ảnh phải là một khung trơn, đừng vẽ hoạ tiết ở giữa.

`dialogue_json` vẫn giữ nguyên hình dạng cũ (`LobbySaved` theo khoá khối), chỉ là
giờ chỉ ba khoá còn được đọc: `background`, `npcBubble`, `playerBubble`. Không
đổi hình dạng vì các màn đã dựng đang mang dữ liệu ấy, và một migration để xoá
mấy con số không ai đọc nữa là rủi ro không đổi lấy gì.

---

## S6 — KẾT THÚC MÀN CHƠI (Victory / Defeat)

```
+===============================================================+
|                    HOÀN THÀNH MÀN 13!                         |
|              Bạn nhận được Mảnh bản đồ #13                    |
+---------------------------------------------------------------+
|  Thành viên   | Nhiệm vụ | Chính xác | Thời gian | Chiến lực  |
|  Minh (Leo)   |   2/4    |   92%     |  03:12    |  +32       |
|  Thuận (Maya) |   1/4    |   85%     |  03:12    |  +18       |
|  Lan (Sam)    |   1/4    |   78%     |  03:12    |  +15       |
|  Bot (Jade)   |   0/4    |    -      |    -      |   +0       |
+---------------------------------------------------------------+
|  Năng lượng còn lại: 34/100      Hoàn thành trong 03:12       |
|  Điểm chiến lực world: 450 -> 468 (+18)                       |
|  Mảnh bản đồ: 12/30 -> 13/30                                  |
+---------------------------------------------------------------+
|  [ XEM LẠI BÀI LÀM ]  [ CHƠI LẠI ]  [ MÀN TIẾP THEO > ]        |
+===============================================================+
```

**Bản Defeat:** đổi tiêu đề thành `THẤT BẠI — Hết năng lượng / Hết giờ`, **không** trao mảnh bản đồ, nhưng **vẫn giữ điểm chiến lực cơ bản** mà từng người đã kiếm được trong trận — chỉ mất phần thưởng thời gian/năng lượng. Ghi rõ trên màn hình:

```
|  Không nhận được Mảnh bản đồ.                                 |
|  Điểm chiến lực đã kiếm trong trận vẫn được giữ:              |
|  Minh +18   Thuận +12   Lan +9                                |
```

Vẫn hiện bảng thống kê, và **vẫn có nút `[ XEM LẠI BÀI LÀM ]`** — thua là lúc cần xem mình sai ở đâu nhất. Lý do giữ điểm: [GAME_DOMAIN §6](./GAME_DOMAIN.md) — học sinh trả lời đúng thì đã học được, không nên bị phạt vì đồng đội tiêu hết năng lượng.

> **Đã dựng, và là một BẢNG NỔI chứ không phải một trang riêng** — `StageOver` trong `stage-play.tsx`, đọc `GET /play/runs/{id}/result`.
>
> Hết màn là một khoảnh khắc trong lúc chơi, không phải một chặng mới. Ném học sinh sang một URL khác nghĩa là tải lại cả trang, mất cảnh, mất nhạc — rồi bấm "chơi lại" để tải ngược về. Bảng nổi trên chính cái cảnh vừa chơi, và hai cái nút đưa đi đúng hai nơi người ta muốn tới.
>
> **Sáu con số, không có bảng từng người:** nhiệm vụ đã qua / tổng, điểm / điểm tối đa, chiến lực nhận, thời gian, mảnh bản đồ đang có / tổng của world, chiến lực world. Cột "Thành viên" trong bản vẽ để dành tới Bước 7 — chơi một mình thì nó là một bảng một dòng, nói lại đúng những con số ngay bên cạnh.
>
> **Tiêu đề và hai cái nút vẽ NGAY, con số đến sau.** Bảng điểm là một cú gọi mạng; hỏng thì học sinh vẫn phải ra khỏi màn được. Một bảng kết thúc chỉ hiện ra khi mạng còn sống là cách nhốt người ta lại trong một màn đã chơi xong.
>
> **"Chơi lại" tải lại cả trang**, không gọi `startRun` lần nữa. Một lượt mới cần một cảnh Phaser mới — nhân vật về chỗ xuất phát, ổ khoá đóng lại, đồng hồ đếm từ đầu — mà `PhaserCanvas` cố ý không dựng lại cảnh khi dữ liệu đổi (nếu không thì mỗi lần nộp bài là nạp lại cả game).

---

## S6b — XEM LẠI BÀI CỦA MÌNH — **HOÃN, có chủ ý**

`GET /play/runs/{id}/review` đã dựng xong và trả về đầy đủ: từng lần thử, đáp án đúng, lời giải thích của giáo viên. **Không có màn hình nào gọi tới nó.**

Màn `/play/run/[id]/review` đã từng được dựng rồi **gỡ đi**, vì nó đánh nhau với một thứ quan trọng hơn:

> **Nói ra đáp án ngay sau lượt đầu thì CHƠI LẠI không còn nghĩa gì.** Lượt thứ hai chỉ là gõ lại thứ vừa đọc được, và điểm của nó không đo được gì nữa. Mà chơi lại chính là vòng lặp học của trò chơi này — xem [GAME_DOMAIN §1.7](./GAME_DOMAIN.md).

Nên bảng kết thúc chỉ đưa ra **con số**: đủ để biết mình đứng ở đâu, không đủ để suy ra bài.

### Bao giờ dựng lại

Khi có một luật quyết định **lúc nào thì được xem đáp án** — hết số lượt thử, hết một buổi học, hoặc giáo viên mở khoá. Chừng nào chưa có luật đó thì mở màn xem lại ra là bỏ mất cơ chế chơi lại để đổi lấy một màn hình.

### Còn một lỗ

Endpoint vẫn **gọi được** từ trình duyệt: một học sinh biết mở DevTools có thể lấy nguyên bộ đáp án của lượt vừa chơi. Nếu quyết định "không cho xem đáp án" là thật thì phải khoá endpoint lại — hạn cho giáo viên, hoặc gỡ hẳn cho tới khi có luật ở trên.

Bản vẽ và ghi chú thiết kế giữ nguyên bên dưới, để lúc dựng lại không phải nghĩ lại từ đầu.

---

### Bản thiết kế (chưa dựng)

`/play/run/[id]/review` — mở từ nút `[ XEM LẠI BÀI LÀM ]` trên S6. Chỉ mở khi lượt chơi đã kết thúc, **thắng hay thua đều xem được**, và **chỉ hiện bài của chính mình**.

```
+=========================================================================+
| < Kết quả màn      XEM LẠI — MÀN 1: Sự cố dưới đáy biển                 |
+=========================================================================+
|  Minh (Leo)   ·   3/4 nhiệm vụ   ·   Điểm chiến lực nhận: +32           |
+-------------------------------------------------------------------------+
|  NV | Nhiệm vụ        | Lần thử | Kết quả | Điểm | Chiến lực            |
|  ---|-----------------|---------|---------|------|--------------------- |
|  1  | Cột buồm        |   1     |   ✓     | 1/1  | +13                  |
|  2  | Thân tàu        |   2     |   ✓     | 1/1  | +8   (lần 2, ×0.6)   |
|  3  | Đèn phao        |   3     |   ✗     | 0/1  | +0   (hết lượt)      |
|  4  | Hòm báu         |   1     |   ✓     | 1/1  | +13                  |
+-------------------------------------------------------------------------+
|  ▼ NHIỆM VỤ 3 — ĐÈN PHAO CỨU SINH                                       |
|                                                                         |
|  Đề:        The captain shouts. What do you do?                         |
|                                                                         |
|  Lần 1:  "Open the chest!"            ✗                                 |
|  Lần 2:  "Raise the flag!"            ✗                                 |
|  Lần 3:  "Raise the flag!"            ✗                                 |
|                                                                         |
|  Đáp án đúng:  Lower the sails!                                         |
|                                                                         |
|  Giải thích:   "Lower the sails" là câu mệnh lệnh (imperative) —        |
|                động từ nguyên thể đứng đầu câu, không có chủ ngữ.       |
|                Khi thuyền trưởng ra lệnh trong bão, thuỷ thủ hạ buồm.   |
|                                                                         |
|  Ngữ pháp:  grammar:imperatives      CEFR: A1                           |
+-------------------------------------------------------------------------+
|  [ CHƠI LẠI MÀN NÀY ]        [ VỀ WORLD ]                               |
+=========================================================================+
```

- Bung từng nhiệm vụ để xem **toàn bộ các lần thử** của mình, đáp án đúng và giải thích.
- Nội dung `Giải thích` lấy từ trường explanation của `questions` — chính cái giáo viên gõ ở màn T2. Đây là lúc nó được dùng, nên ở T2 phải nhắc giáo viên viết cho tử tế.
- **Không có tab xem bài người khác.** Không phải vì khó làm, mà vì bài làm sai của một đứa trẻ không nên nằm trên màn hình của ba đứa còn lại.
- Vào lại được bất cứ lúc nào từ lịch sử chơi của màn — không mất khi rời trang.

---

## S7 — CÁNH CỔNG THỜI GIAN (End-game)

## S7 — CÁNH CỔNG THỜI GIAN (End-game)

```
+===============================================================+
|                 CÁNH CỔNG THỜI GIAN                           |
|      Ghép 30 mảnh bản đồ để mở cổng trở về nhà                |
+---------------------------------------------------------------+
|   [ Lưới 30 ô ghép bản đồ — ô đã có sáng vàng, ô thiếu tối ]  |
|   ######  ######  #.....  ......  ......                      |
|                                                               |
|   Bạn có 13/30 mảnh — còn thiếu 17 mảnh:                      |
|   - Chương 3: Màn 14, 15, 16, 17, 18                          |
|   - Chương 4: Màn 19 -> 24                                    |
|   - Chương 5: Màn 25 -> 30                                    |
+---------------------------------------------------------------+
|          [ MỞ CỔNG ] (khóa)      [ ĐI ĐẾN MÀN 14 > ]          |
+===============================================================+
```

- Đủ 30/30 thì chạy animation mở cổng + màn hình hoàn thành World + tổng kết toàn bộ hành trình.
- Chưa đủ thì liệt kê chính xác **màn chơi / nhiệm vụ còn thiếu**, có nút điều hướng nhanh.

---

# PHẦN B — GIAO DIỆN GIÁO VIÊN

> Route: `/teacher/*`. Chặn bằng `role = teacher` ở middleware **và** `require_role()` ở API.
> Phần lớn component copy từ LMS EDUPLAY — xem [ARCHITECTURE §5](./ARCHITECTURE.md).

## T0 — DASHBOARD GIÁO VIÊN

```
+=========================================================================================+
| Vitaminfun · Giáo viên       Cô Lan  |  [Kho câu hỏi] [World] [Media]  |  [*] [Thoát]   |
+=========================================================================================+
|  VIỆC CẦN LÀM                              |  THỐNG KÊ                                  |
|  +--------------------------------------+  |  Câu hỏi đã soạn:        128               |
|  | Màn 3 — thiếu 1 nhiệm vụ    [Sửa >]  |  |  Đã xuất bản:             94               |
|  | Màn 5 — chưa có câu hỏi nào [Sửa >]  |  |  World:                    1               |
|  | 12 câu hỏi còn ở trạng thái nháp     |  |  Màn đã xuất bản:      6 / 30              |
|  +--------------------------------------+  |                                            |
+-----------------------------------------------------------------------------------------+
|  WORLD CỦA BẠN                                                        [+ TẠO WORLD]     |
|  +-----------------------------------------------------------------------------------+  |
|  | LOST IN ATLANTIS   Easy | 5 chương | 30 màn | 6 màn đã xuất bản      [ Mở > ]     |  |
|  +-----------------------------------------------------------------------------------+  |
+=========================================================================================+
```

## T0b — BÁO CÁO KẾT QUẢ NGƯỜI CHƠI

`/teacher/reports`. Một màn hình, hai tầng: nhìn TỔNG QUÁT trước, mở ra CHI TIẾT
sau — vì hai câu hỏi của giáo viên đến theo đúng thứ tự đó ("lớp có chơi không?"
rồi mới "em nào đang đuối?").

```
+=========================================================================================+
|  KẾT QUẢ NGƯỜI CHƠI    Chỉ tính lượt chơi thật · Ngày cắt lúc nửa đêm, giờ Asia/Bangkok |
+-----------------------------------------------------------------------------------------+
|  [ World: Tất cả world  v ]   [ Tìm: họ tên hoặc email ................... ]   (dính)   |
+-----------------------------------------------------------------------------------------+
|  NGƯỜI CHƠI HÔM NAY | LƯỢT CHƠI HÔM NAY | TỈ LỆ QUA MÀN    | ĐIỂM TRUNG BÌNH            |
|         12          |        48         |      31%         |       64%                  |
|  7d 34 · 30d 51     | 7d 190 · 30d 420  | Qua 15 · Hết giờ | TB 4m54s · NV 56 · CL 1.270|
+-----------------------------------------------------------------------------------------+
|  14 NGÀY GẦN NHẤT   ▇ người chơi (cột đậm) nằm trong ▁ lượt chơi (cột mờ)               |
+-----------------------------------------------------------------------------------------+
|  BẢNG XẾP HẠNG                                                                          |
|  #  Người chơi        Điểm CL  Màn đã qua  Lượt  Qua màn  Thời gian  Gần nhất  [Xem >]  |
|  1  Bé Minh           1.270        1        147     3      12h01m    12/09     [Xem >]  |
|  ...                                                          1–50 trên N  [Trước][Sau] |
+=========================================================================================+
```

Những chỗ dễ làm sai, và đã chốt:

- **Chỉ HỌC SINH, và chỉ lượt chơi THẬT.** Mọi lượt của giáo viên/admin mang cờ
  `is_trial` nên đã bị loại; nhưng `world_progress` vẫn cộng điểm cho những lượt
  ấy, nên bảng xếp hạng còn phải lọc thêm `role = 'student'` — không thì cô giáo
  dựng bài cả tuần đứng hạng nhì trong bảng của lớp mình với 0 lượt chơi.
- **Thời lượng chặn trần bằng `stages.time_limit_seconds`.** Lượt nào người chơi
  đóng tab thì nằm ở `playing` tới khi vòng quét dọn tới, và `duration_seconds`
  ghi cả khoảng nằm im ấy — dữ liệu thật có một lượt "dài" 17 ngày, kéo thời
  lượng trung bình lên 48 tiếng. Trần là LUẬT CHƠI, không phải một con số chọn
  đại: không ai chơi một màn lâu hơn giới hạn giờ của màn.
- **Điểm trung bình tính theo PHẦN TRĂM**, không phải điểm thô: các màn có tổng
  điểm khác nhau, trung bình của điểm thô là trung bình của những thứ không so
  được với nhau.
- **"Hôm nay" cắt theo `REPORTS_TIMEZONE`** (mặc định `Asia/Bangkok`), và màn
  hình NÓI RA múi giờ ấy. Cắt theo UTC thì với lớp ở Việt Nam, bảy giờ đầu mỗi
  ngày bị tính sang hôm trước.
- **Ngày không ai chơi vẫn có cột 0** trong biểu đồ. Bỏ trống ngày ấy thì mười
  bốn cột đều nhau trông như mười bốn ngày đều đặn.
- **Điểm chiến lực riêng theo từng world.** Không lọc world thì cột ấy là TỔNG,
  và màn hình ghi rõ điều đó ngay cạnh bảng.
- Chi tiết một người tải KHI BẤM, không tải sẵn năm mươi bản cho một cú bấm.

## T0c — CẤU HÌNH TRANG

`/teacher/config`, vào từ mục **Cấu hình** ở thanh đầu trang (chỉ giáo viên và
admin thấy). Chỗ để những thứ áp cho CẢ TRANG, với mọi người — hôm nay có hai:

```
+=========================================================================================+
|  CẤU HÌNH TRANG    Áp dụng cho cả trang, với mọi người.                                 |
+-----------------------------------------------------------------------------------------+
|  TÊN TRANG                                                                              |
|  Hiện ở tab trình duyệt và thanh đầu trang. Để trống thì dùng tên mặc định.             |
|  [ Vitaverse — Play to Learn ................................ ]                         |
|  Đang sửa bản "vi". Đổi ngôn ngữ ở thanh đầu trang để sửa bản kia.                      |
+-----------------------------------------------------------------------------------------+
|  BIỂU TƯỢNG TAB (FAVICON)                                                               |
|  [◼]  [ Tải ảnh lên ]  [ Gỡ ảnh ]                                                       |
+=========================================================================================+
```

- **Bảng `site_config`, một dòng**, không phải mấy biến trong `.env`. `.env` giữ
  những thứ của NGƯỜI VẬN HÀNH (cổng, chuỗi kết nối, khoá API); bảng này giữ
  những thứ của NGƯỜI DÙNG — giáo viên đổi từ trong giao diện, lúc trang đang
  chạy, không phải vào máy chủ sửa file rồi khởi động lại.
- **RỖNG là mặc định và là trạng thái đúng**: tên trống = dùng chuỗi trong
  `messages/*.json`, favicon trống = dùng file tĩnh sẵn có. Một bản cài chưa ai
  mở màn này thì không thấy gì đổi.
- **`GET /site/config` KHÔNG cần đăng nhập**; `PATCH` thì chỉ giáo viên/admin.
  Cái tên và cái favicon nằm trên chính màn ĐĂNG NHẬP — bắt đăng nhập mới đọc
  được nghĩa là trang đăng nhập mang tên mặc định còn mọi trang khác mang tên
  thật, và người dùng thấy hai sản phẩm khác nhau.
- **Tiêu đề dựng ở `generateMetadata`**, không phải hằng số `metadata`: giá trị
  này đổi lúc đang chạy, nên phải hỏi lại mỗi request. `readSiteConfig()` gói
  trong `cache()` của React để `generateMetadata` và thân layout dùng chung một
  lượt gọi.
- **Favicon trỏ tới `media_assets`**, đi qua đúng đường tải lên của mọi ảnh khác
  (kiểm loại, kiểm dung lượng, tên theo nội dung); xoá ảnh thì cột về `NULL`
  thay vì trỏ vào hư không. Chỉ khai `icons` KHI CÓ ảnh — khai mảng rỗng sẽ chặn
  mất `/favicon.ico` mặc định và tab thành trống trơn.
- **Độ tối của màn đang khoá** (`site_config.locked_stage_dim`, phần trăm, mặc
  định 75). Lớp phủ tối trên minimap để ổ khoá và tên màn còn đọc được trên bất
  kỳ tấm ảnh nào — mà "bao nhiêu là vừa" phụ thuộc vào chính những tấm ảnh ấy,
  tức thứ chỉ người dựng world nhìn thấy. Trước đây nó là một lớp Tailwind
  (`bg-abyss-950/75`), nên "tối quá" là một lần sửa mã + build + triển khai.
  - Thanh kéo có **xem thử ngay tại chỗ**: hai vòng tròn cạnh nhau, một mở một
    khoá, trên cùng một tấm nền giả. Con số phần trăm không nói được "tối chừng
    nào là vừa"; hai vòng tròn cạnh nhau thì nói được.
  - Kéo thì chỉ đổi trên màn hình, **nhả tay mới lưu** — lưu theo từng nấc kéo
    là hai chục lần gọi mạng cho một lần chỉnh.
- Thêm mục cấu hình mới = thêm một `Card`, không phải sắp xếp lại cả trang.

## T1 — KHO CÂU HỎI

Copy từ LMS gần như nguyên vẹn.

```
+=========================================================================================+
| < Dashboard  |  KHO CÂU HỎI (128)                          [ + SOẠN CÂU HỎI MỚI ]      |
+=========================================================================================+
| [ Tìm nội dung...        ]  Dạng [Tất cả v]  CEFR [v]  Tags [v]  Trạng thái [v]         |
+-----------------------------------------------------------------------------------------+
|  Nội dung                      | Dạng         | CEFR | Tags               | T.thái |     |
|  ------------------------------|--------------|------|--------------------|--------|---- |
|  Lower the sails!              | MCQ_SINGLE   | A1   | grammar:imperative | Xuất bản| Sửa|
|  Which tool do you need?       | MCQ_SINGLE   | A1   | vocab:tools        | Xuất bản| Sửa|
|  Type the password             | GAP_FILL     | A2   | vocab:atlantis     | Nháp    | Sửa|
|  What does Orichalcum mean?    | SHORT_ANSWER | A2   | vocab:atlantis     | Xuất bản| Sửa|
+-----------------------------------------------------------------------------------------+
|                                                          < 1 2 3 ... 13 >                |
+=========================================================================================+
```

## T2 — SOẠN CÂU HỎI

Builder + Renderer copy từ `components/question/` của LMS. Khung xem trước dùng **chính Renderer ở mode `preview`** — giáo viên nhìn thấy đúng cái học sinh sẽ thấy, và không có hai đường vẽ khác nhau cho cùng một dạng bài.

```
+=========================================================================================+
| < Kho câu hỏi  |  SOẠN CÂU HỎI                        [ Lưu nháp ]  [ Xuất bản ]        |
+=========================================================================================+
|  SOẠN                                      |  XEM TRƯỚC (đúng như học sinh thấy)        |
|  Dạng: [ MCQ_SINGLE            v ]         |  +--------------------------------------+  |
|  (o) Chọn một đáp án  ( ) Chọn nhiều       |  |                                      |  |
|                                            |  |  [ảnh]  The captain shouts. What do  |  |
|  Đề bài:                                   |  |         you do?                      |  |
|  [ The captain shouts. What do you do? ]   |  |                                      |  |
|                                            |  |  ( ) Lower the sails!                |  |
|  Media:  [ + Ảnh ]  [ + Audio ]            |  |  ( ) Raise the flag!                 |  |
|  Số lần được nghe lại: [ 2 ]               |  |  ( ) Open the chest!                 |  |
|                                            |  +--------------------------------------+  |
|  Lựa chọn:                                 |                                            |
|   [x] Lower the sails!           [xoá]     |  CHẤM ĐIỂM                                 |
|   [ ] Raise the flag!            [xoá]     |  Điểm tối đa: [ 1 ]                        |
|   [ ] Open the chest!            [xoá]     |  Cho điểm từng phần: [ ]                   |
|   [ + thêm lựa chọn ]                      |                                            |
|                                            |  PHÂN LOẠI                                 |
|  Giải thích (hiện ở màn xem lại bài):      |  CEFR: [ A1 v ]   Chủ đề: [ Ship v ]       |
|  [ "Lower the sails" là câu mệnh lệnh... ] |  Tags: [grammar:imperatives] [ + ]         |
+=========================================================================================+
```

## T3 — GÁN CÂU HỎI VÀO NHIỆM VỤ CỦA MÀN

Màn hình quan trọng nhất của phần giáo viên — nơi kho câu hỏi gặp game.

```
+=========================================================================================+
| < Chương 1  MÀN 1 — Sự cố dưới đáy biển  [ 🧪 Chơi thử ] [ Lưu nháp ] [ Xuất bản màn ] |
+=========================================================================================+
|  SƠ ĐỒ MÀN CHƠI                         |  KHO CÂU HỎI                                  |
|                                         |  [ Tìm... ] [Dạng v] [CEFR v] [Tags v]        |
|  +-------------------------------------+|  -------------------------------------------- |
|  |                                     ||  ( ) Lower the sails!         MCQ_SINGLE  A1  |
|  |    [ ảnh nền boong tàu 2.5D ]       ||  ( ) Which tool do you need?  MCQ_SINGLE  A1  |
|  |                                     ||  (o) Type the password        GAP_FILL    A2  |
|  |    (NPC) Captain Drake              ||  ( ) What does Orichalcum...  SHORT_ANS   A2  |
|  |      Hội thoại: 2 bước     [sửa]    ||  -------------------------------------------- |
|  |                                     ||     [ GÁN VÀO NHIỆM VỤ ĐANG CHỌN ]            |
|  |    (1) Cột buồm     đã gán   [x]    ||     [ + SOẠN CÂU HỎI MỚI ]                    |
|  |    (2) Thân tàu     đã gán   [x]    ||                                               |
|  |    (3) Đèn phao     CHƯA GÁN  <---  ||  CHI TIẾT NHIỆM VỤ (3) — Đèn phao             |
|  |    (4) Hòm báu      đã gán   [x]    ||  Câu hỏi:            (chưa gán)                |
|  |        trao Mảnh bản đồ #1          ||  Chi phí năng lượng: [ 0 ]                    |
|  |                                     ||  Vị trí trong cảnh:  x [ 640 ]  y [ 380 ]     |
|  +-------------------------------------+|  [ ] Nhiệm vụ này trao Mảnh bản đồ            |
+-----------------------------------------------------------------------------------------+
|  CẤU HÌNH MÀN                                                                            |
|  Thời gian: [ 300 ]s    Năng lượng đội: [ 100 ]    Điểm chiến lực tối đa: [ 80 ]         |
|  Yêu cầu điểm chiến lực để mở: [ tự động theo world ]    Mảnh bản đồ: # [ 1 ]            |
+-----------------------------------------------------------------------------------------+
|  CHƯA XUẤT BẢN ĐƯỢC: nhiệm vụ (3) chưa có câu hỏi. Màn cần tối thiểu 4 nhiệm vụ.         |
+=========================================================================================+
```

**Nút Chơi thử** mở `/play/world/[id]/stage/[sid]` trong tab mới, ở chế độ chơi thử, kể cả khi màn còn `draft` và chưa đủ điều kiện xuất bản. Đây là cách duy nhất để biết câu hỏi vừa gán có thật sự chấm đúng trong cảnh hay không.

**Luồng thao tác:** chọn một vật thể nhiệm vụ ở sơ đồ bên trái → chọn câu hỏi ở kho bên phải → bấm **Gán**. Hoặc bấm **Soạn câu hỏi mới** để mở T2 ngay trong ngữ cảnh màn này, soạn xong tự gán vào nhiệm vụ đang chọn.

**Điều kiện xuất bản màn** — kiểm ở service, không phải ở giao diện:

- Có tối thiểu **4 nhiệm vụ**
- **Mọi** nhiệm vụ đều đã gán câu hỏi, và câu hỏi đó đã ở trạng thái xuất bản
- **Đúng một** nhiệm vụ được đánh dấu trao Mảnh bản đồ
- Có NPC cố vấn với tối thiểu 1 bước hội thoại

Bộ chọn câu hỏi bên phải copy từ `components/exam/question-picker.tsx` của LMS (248 dòng, khoảng 80% dùng lại được).

### Lời phán: nghe thử và thu lại TỪNG CÂU

Bảng *Giọng đọc* trong popup nhiệm vụ chỉ giữ ba thứ ngắn: nút sinh, bộ đếm
`80/80`, và một nút **Xem & nghe** mở popup riêng.

Danh sách không nằm trong cột trái, vì hai lý do đo được:

- Cột trái rộng **22rem** và đã chứa sáu khối. Tám mươi dòng ở đó thì người dựng
  cuộn qua hàng trăm dòng mới tới ô "Điểm qua ải" bên dưới.
- Nghe thử cần **bề ngang**: một câu dài trong cột hẹp bị ngắt làm ba dòng, và
  tám mươi câu như thế thì không đọc lướt được.

Popup gom theo tám nhóm, mỗi dòng có ô tick · câu chữ · nút 🔊 (hoặc chữ *"chưa
có tiếng"* — nói ra chứ không để ô trống). Chân popup có **hai nút, khác hẳn nhau
về tiền**:

| nút | làm gì | tốn tiền |
|---|---|---|
| *Thu N câu còn thiếu* | lấp chỗ trống, không ghi đè | chỉ phần thiếu |
| *Thu lại N câu đã chọn* | thu lại thứ đã có | trả lần nữa → có hộp xác nhận |

Server lọc danh sách gửi lên theo bộ câu THẬT của world: nhận bừa chuỗi client
gửi là mở đường thu bất cứ gì bằng giọng của người khác.

Một tiếng tại một lúc — bấm nhanh năm cái loa thì năm câu nói chồng lên nhau, mà
đây đúng là màn người ta bấm nhanh nhiều cái loa.

### Đang sinh giọng thì PHỦ MÀN HÌNH

Mọi nút sinh giọng — một câu, một nhiệm vụ, cả màn, lời chia tay — đều bật một
hộp phủ kín trong lúc chờ, và hộp đó **không đóng được**. Tự tắt khi xong.

Không đóng được là chủ ý: mỗi lần sinh là một lần trả tiền cho nhà cung cấp, và
một cái bảng chờ bấm ra ngoài được là một cái bảng người ta bấm ra ngoài rồi bấm
Tạo lần nữa. Một mẻ cả màn mất hàng chục giây; không có gì che thì màn hình đứng
im, và người dựng chỉ có hai cách hiểu — hoặc hỏng, hoặc mình chưa bấm.

Hộp nói luôn **sắp sinh bao nhiêu bản**, lấy từ chính bộ đếm trên nút.

### Nghe thử phương án: một cái loa mỗi đáp án

Popup xem câu hỏi vẽ một nút 🔊 nhỏ ở mép phải MỖI phương án đã có tiếng, và một
hàng chọn nhân vật ngay dưới các phương án.

`optionAudio` là một prop của `QuestionRenderer`, không phải một lớp riêng của
màn quản trị: đọc phương án thành tiếng là tính năng của BÀI — học sinh rồi cũng
nghe đúng những tệp này. Vắng prop thì không loa nào mọc ra, y như trước.

Nút loa nằm NGOÀI nút phương án, trong một lớp bọc `relative`: `<button>` lồng
trong `<button>` là HTML sai và trình duyệt gỡ nó ra theo cách không ai đoán
được.

Một câu có thể đã thu bằng nhiều giọng, mà bốn cái loa chỉ phát được một giọng
tại một lúc — nên hàng dưới nói rõ đang nghe giọng ai và đổi được. Mặc định là
**nhân vật đầu tiên có bản thu**; chỉ liệt kê ai thật sự có, vì hiện cả dàn rồi
bấm vào ai cũng im là tệ hơn không hiện gì. Toàn bộ trang chỉ giữ MỘT thẻ
`<audio>` — bấm nhanh vài cái loa thì bốn phương án nói chồng lên nhau.

### Nhân vật đọc phương án: lấy dàn của WORLD, tick sẵn tất cả

Hàng chọn nhân vật đọc phương án lấy từ `GET /worlds/{id}/characters` — đúng
danh sách đã chọn ở màn thiết kế world, và cũng đúng những nhân vật học sinh vào
world này chọn được. Không lấy cả kho nhân vật: kho có người thuộc world khác,
tick vào là sinh tiếng cho một giọng không ai nghe.

**Mặc định tick HẾT.** Bỏ ai thì bấm bỏ, cần lại thì bấm lại. Bắt tick tay có
một cách hỏng lặng lẽ: quên một người thì em nào chọn nhân vật ấy sẽ gặp một
khoảng im giữa bài, mà không có gì trên màn hình báo.

Nhân vật **chưa gán giọng** vẫn hiện trong hàng — gạch ngang, không tick được,
rê chuột vào nói rõ vì sao. Giấu đi thì người dựng không hiểu vì sao giọng của
người ấy không bao giờ được sinh.

### Kho câu hỏi mở SẴN đúng chỗ, không mở cả kho

Bộ chọn câu hỏi trong popup nhiệm vụ chọn bộ lọc mặc định theo thứ tự:

1. **Bộ lọc lần trước của CHÍNH nhiệm vụ này** — nhớ trong `localStorage`, khoá
   `vf.picker.<quest id>`. Không lưu vào database: đây là thói quen của một
   người trên một máy, không phải thuộc tính của nhiệm vụ.
2. **Mã mà những câu ĐÃ LẮP trong nhiệm vụ mang** (`quest_questions[].quest_code`).
3. **Mã mà những câu đã lắp trong cả MÀN mang** (`stage_code`).
4. `stages.stage_code`, rồi cuối cùng là không lọc.

Bước 2 và 3 tồn tại vì bước 4 **gần như luôn trống**: `stages.stage_code` và
`quests.quest_code` chỉ được điền khi nội dung vào bằng file `.xlsx`, và trong
kho hiện tại không màn nào, không nhiệm vụ nào có mã. Bộ lọc cũ chỉ dựa vào
`stageCode` nên rơi về rỗng, và người dựng mở popup ra là thấy cả 112 câu.

Mã của chính CÂU HỎI thì có: 26 câu mang `W1-S1`. Đó mới là bằng chứng thật về
"nhiệm vụ này lấy câu từ đâu", nên `QuestQuestionOut` trả thêm `stage_code` và
`quest_code` để giao diện đọc được.

Đo trên dữ liệu thật: nhiệm vụ NPC mở ra còn **2** dòng (đúng bộ của nó), nhiệm
vụ thường còn **26** (đúng bộ của màn), thay vì 112.

Chỉ nhớ hai ô MÃ. Từ khoá tìm và bộ lọc dạng bài là thứ gõ cho một lần tra cứu —
khôi phục lại chúng ở lần mở sau là hiện một danh sách đã lọc mà không ai nhớ vì
sao.

### Sổ tay & lời chia tay soạn TRONG popup nhiệm vụ NPC

Ba trường `advisor_outro_i18n` · `cluebook_title_i18n` · `cluebook_i18n` thuộc về
`stages`, nhưng bảng soạn của chúng nằm trong popup **nhiệm vụ NPC**, ngay dưới
bảng giọng đọc — không nằm ở cột cấu hình màn nữa.

Vì chúng là một khoảnh khắc, không phải một nhóm cột: học sinh qua nhiệm vụ NPC →
người canh giữ nói lời chia tay → trao sổ tay. Và giọng đọc lời chia tay lấy từ
chính người canh giữ được chọn cách đó vài dòng. Để ở cột cấu hình màn thì soạn
lời chia tay ở một chỗ, sinh giọng cho nó ở một chỗ khác, mà hai chỗ ấy không
nhìn thấy nhau.

Cột trái của popup nở từ 18rem lên 22rem để hai ô văn bản dùng được. Nhiệm vụ
thường không có khối này — chỉ nhiệm vụ NPC dẫn tới khoảnh khắc trao sổ tay.

Bảng giọng đọc vì thế KHÔNG chép lại đoạn lời chia tay nữa: ô soạn nằm ngay dưới
nó trong cùng một cột, và hiện hai lần thì người dựng sửa ở một chỗ rồi thấy chỗ
kia chưa đổi.

### Một nhiệm vụ, MỘT cái tên

`quests` có hai chuỗi dễ nhầm là "tên", và chúng không thay nhau được:

| cột | là gì | ai nhìn thấy |
|---|---|---|
| `name_i18n` | **TÊN** nhiệm vụ, dịch được | học sinh, trong game |
| `quest_object_key` | khoá vật thể trong cảnh Phaser (`a-z0-9_`) | không ai ngoài người dựng |

Màn gán câu hỏi (T3) từng hiện `quest_object_key` làm tiêu đề cho nhiệm vụ
thường, và ô sửa tại chỗ ở đó cũng ghi vào đúng cột ấy. Hậu quả: cùng một nhiệm
vụ mang hai cái tên ở hai màn quản trị — `object_5` ở T3, *"Evidence That
Remains"* ở trình thiết kế và trong game. Không có lỗi nào ném ra; người dựng chỉ
đơn giản không nhận ra đó là cùng một thứ.

Giờ cả ba chỗ — T3, trình thiết kế, màn chơi của học sinh — đều gọi `questLabel()`
và đều sửa `name_i18n`. `quest_object_key` vẫn sửa được ở T3, nhưng trông đúng
thân phận của nó: một chip chữ mono cỡ nhỏ cạnh `#N`, không phải tiêu đề. Nhiệm
vụ NPC không có chip đó — khoá của nó cố định là `npc`.

Hai màn quản trị là **hai cách sửa cùng một nhiệm vụ**, nên tiêu đề popup sửa
nhiệm vụ cũng sửa tại chỗ được. Để một bên đọc được mà không sửa được thì người
dựng phải nhớ "đổi tên thì sang màn kia" — và đó là thứ không ai nhớ.

### Sinh TIẾNG ĐỌC: ba nút, ba tầm với

Cùng một việc, ba chỗ bấm, và chỗ nào cũng nằm ngay cạnh thứ nó tác động —
người dựng không phải nhớ "nút ấy ở màn nào":

| bấm ở đâu | sinh cho | vào từ đâu |
|---|---|---|
| thẻ **Giọng đọc** trên trình thiết kế màn | cả màn | `/stages/[sid]/design` |
| popup **sửa nhiệm vụ**, ngay dưới ô chọn người canh giữ | cả nhiệm vụ | bấm một nhiệm vụ → *Câu hỏi (n)* |
| popup **xem câu hỏi**, cột phải | đúng một câu | bấm *Xem* ở danh sách câu hỏi |

Mỗi chỗ đều có **hai** nút tách rời — *đề bài* và *đáp án* — vì chúng đọc bằng
giọng của hai người khác nhau: đề bài là người canh giữ của nhiệm vụ (không cho
chọn lại; cùng câu ấy nằm trong nhiệm vụ nào thì người của nhiệm vụ ấy đọc), đáp
án là những nhân vật học sinh được tick bên dưới.

Popup xem câu hỏi vì thế cần biết `questId`. Mở từ kho câu hỏi thì không có —
lúc ấy phần đề bài tắt, phần đáp án vẫn sinh được.

### Popup xem câu hỏi: hai cột, và KHÔNG có thanh cuộn ngang

Bên trái là **câu hỏi**, bên phải là những thứ **làm với** nó (cách ra đề, sinh
tiếng, các bản thu đã có). Xếp dọc một cột thì bản xem trước bị đẩy xuống dưới
hai khối cấu hình — thứ người dựng mở popup ra để xem lại là thứ phải cuộn mới
thấy.

Thanh cuộn ngang là một lỗi, không phải một lựa chọn. Chỗ sinh ra nó ở đây:
trình phát `<audio>` mặc định rộng ~300px và **không co lại được**. Xếp các bản
thu cạnh nhau thì hễ khung hẹp là cả popup mọc thanh cuộn ngang — nên mỗi bản
thu một hàng, trình phát `flex-1 min-w-0`.

### `1fr` là một cái bẫy, dùng `minmax(0,1fr)`

Đã cắn ba lần ở ba popup khác nhau, nên viết ra đây một lần:

```
grid-cols-[18rem_1fr]            ← cột phải KHÔNG chịu hẹp hơn nội dung của nó
grid-cols-[18rem_minmax(0,1fr)]  ← đúng
```

`1fr` là viết tắt của `minmax(auto,1fr)`, mà `auto` ở vế sàn nghĩa là
`min-content`. Cột nào có một câu hỏi dài, một trình phát audio, hay một từ
không ngắt được thì cột ấy nở ra bằng đúng thứ đó, đẩy cả lưới rộng hơn khung.
Thân popup lại là `overflow-y-auto`, và trình duyệt tự nâng `overflow-x` lên
`auto` theo — thành ra một thanh cuộn ngang không ai đặt.

Vế còn lại của cùng một luật: con của grid/flex mặc định `min-width: auto`, nên
mỗi cột cũng cần `min-w-0`.

**Lỗi này ẩn theo DỮ LIỆU.** Sàn là `min-content` của nội dung THẬT, nên cùng một
popup mở ở nhiệm vụ có câu hỏi ngắn thì sạch, mở ở nhiệm vụ có câu hỏi dài thì
tràn. Đo một nhiệm vụ rồi kết luận "không tràn" là kết luận sai — phải đo cái
dài nhất, hoặc sửa cho nó không tràn được nữa.

---

---

## Ánh xạ màn hình → route

Mọi route `/play/*` dùng chung cho học sinh và cho giáo viên/admin ở chế độ chơi thử.

| Màn | Route | Bước |
|---|---|---|
| T0 | `/teacher` | 1 |
| T1 | `/teacher/questions` | 2 |
| T2 | `/teacher/questions/new` · `/teacher/questions/[id]` | 2 |
| T3 | `/teacher/worlds/[id]/stages/[sid]` | 4 |
| S0 | `/play` | 6 |
| S1, S2 | `/play/world/[id]` | 6 |
| S3 | `/play/world/[id]/stage/[sid]` | 6 |
| S4 | `/play/room/[code]` | 7 |
| S5 | `/play/stage/[id]` | 5 · hội thoại: đang dựng |
| S5b | `/teacher/worlds/[id]/stages/[sid]/dialogue` | đã dựng |
| S6 | overlay trong S5 | 8 |
| S6b | *(chưa dựng — xem §S6b)* | 8 |
| S7 | `/play/world/[id]/gate` | 8 |

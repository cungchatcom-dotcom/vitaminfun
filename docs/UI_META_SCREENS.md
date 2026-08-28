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

## S5 — TRONG TRẬN: NỘP BÀI TỪNG NHIỆM VỤ

Bố cục đầy đủ của màn chơi xem [backup/Mockup Designs.md](./backup/Mockup%20Designs.md). Ở đây chỉ mô tả phần **nộp bài**, vì đó là chỗ luật "kết quả từng người là độc lập" hiện ra thành giao diện.

```
+=========================================================================+
|  ⚡ Năng lượng đội 68/100        ⏱ 02:41        Nhiệm vụ của bạn 2/4   |
+=========================================================================+
|                                                                         |
|              [ cảnh 2.5D — boong tàu ]                                  |
|                                                                         |
+-------------------------------------------------------------------------+
|  NHIỆM VỤ 3 — ĐÈN PHAO CỨU SINH                          Lượt thử 1/3  |
|  The captain shouts. What do you do?                                    |
|                                                                         |
|   ( ) Lower the sails!      ( ) Raise the flag!     ( ) Open the chest! |
|                                                                         |
|   [ 🎤 Nói ]  [ ⌨ Gõ ]                       [   NỘP BÀI   ]           |
+-------------------------------------------------------------------------+
|  TIẾN ĐỘ ĐỘI          NV1   NV2   NV3   NV4                             |
|  Minh (Leo)   bạn      ✓     ✓     •     -                              |
|  Thuận (Maya)          ✓     -     ✓     -                              |
|  Lan (Sam)             -     ✓     -     -                              |
|  Bot (Jade)            -     -     -     -                              |
|                        ✓ xong   • đang làm   ✗ hết lượt   - chưa làm    |
+=========================================================================+
```

Thanh trên cùng **không hiện điểm chiến lực**. Bảng tiến độ đội cũng chỉ hiện *xong / chưa xong*, không hiện đúng sai từng lần thử của người khác.

### Phản hồi sau khi nộp — chỉ hai trạng thái

```
        HOÀN THÀNH                          CHƯA HOÀN THÀNH
+-----------------------------+     +---------------------------------+
|                             |     |                                 |
|      ✓  MISSION COMPLETE    |     |    ✗  CHƯA HOÀN THÀNH           |
|                             |     |                                 |
|   Nhiệm vụ 3 — Đèn phao     |     |   Đội mất 2 điểm năng lượng     |
|                             |     |   Bạn còn 2 lượt thử            |
|      [  Tiếp tục  ]         |     |                                 |
|                             |     |   [ THỬ LẠI ]    [ Để sau ]     |
+-----------------------------+     +---------------------------------+
```

**Không có điểm, không có đáp án đúng, không có giải thích.** Ba thứ đó để dành cho màn xem lại sau khi hết màn (S6b) — xem lý do ở [GAME_DOMAIN §1.6](./GAME_DOMAIN.md).

Luồng khi bấm **NỘP BÀI**:

1. Máy gửi `POST /play/runs/{id}/quests/{qid}/answer`, khoá nút chống bấm hai lần.
2. Server chấm, trả về đúng ba trường: `{ completed, attempts_left, team_energy }`.
3. Cả phòng nhận `{ai, nhiệm vụ nào, completed, năng lượng đội}` — bảng tiến độ cập nhật. **Bản tin không mang nội dung trả lời**, nên nhìn màn hình bạn cũng không chép được bài.
4. Sai thì trừ năng lượng **đội**. Đây là chỗ duy nhất bài làm cá nhân chạm vào cả nhóm.

**Hết lượt thử** (`maxAttemptsPerQuest`, mặc định 3): nhiệm vụ khoá lại trong lượt chơi này, ô trong bảng tiến độ chuyển `✗`. Chơi lại màn thì làm lại từ đầu.

**Để sau** đóng bảng câu hỏi, người chơi đi làm nhiệm vụ khác rồi quay lại — lượt thử vẫn còn nguyên.

> **Đúng sớm được nhiều điểm hơn.** Lần thử 1 ăn đủ điểm, lần 2 còn 60%, lần 3 còn 30% (`balance_json.attemptPenalty`). Người chơi **không** thấy con số này trong trận, nhưng dòng `Lượt thử 1/3` cho biết thử càng nhiều càng thiệt.

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

> Hiện tại code đang dùng `alert()` + `window.location.reload()` cho cả 2 trường hợp — cần thay bằng màn hình này.

---

## S6b — XEM LẠI BÀI CỦA MÌNH (sau khi màn kết thúc)

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
| S5 | `/play/stage/[code]` | 5 (nộp bài từng người: 8) |
| S6 | overlay trong S5 | 8 |
| S6b | `/play/run/[id]/review` | 8 |
| S7 | `/play/world/[id]/gate` | 8 |

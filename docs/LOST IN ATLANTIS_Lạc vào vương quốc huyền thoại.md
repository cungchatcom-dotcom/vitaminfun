# LOST IN ATLANTIS: Lạc vào vương quốc huyền thoại

## Concept

- Tiếng Anh là ngôn ngữ vận hành: người chơi phải dùng tiếng Anh để lấy thông tin, thuyết phục, quyết định và làm thay đổi world state.
- Thiết kế cho lứa tuổi 16-25.

## Language
- ngôn ngữ giao diện mặc định là tiếng Việt (sau này có thể chuyển thành ngôn ngữ khác)
- ngôn ngữ giao tiếp với NPC và học trong trò chơi là Tiếng Anh

## Flows

- Chọn kiểu Single hoặc Multi-players:
  - Nếu Single thì không cần chờ room, vào chơi luôn.
  - Nếu Multi thì đợi tối đa 30s để người khác vào. Có thể rủ bạn bè vào phòng ngay từ bước này nếu muốn có người hỗ trợ vượt màn khó — không mời được người vào giữa một lượt chơi đang diễn ra.
- Chọn world → chọn map → chọn chapter/màn → chọn nhân vật (mỗi nhân vật chỉ 1 người được chọn, chọn rồi thì hệ thống khóa lại, người vào sau phải chọn nhân vật còn trống) → (chờ đủ người chơi: auto chơi hoặc bấm nút Bắt đầu thủ công — nếu phòng thiếu người vẫn bắt đầu được bình thường, người chơi đảm nhận thêm nhiệm vụ của nhân vật còn trống) → Bắt đầu chơi → Kết thúc màn chơi → Chấm điểm & cộng Điểm chiến lực.
- **End-game Flow (Về đích):** Sau khi vượt qua hết 30 màn, người chơi đi đến Cánh cổng Thời gian và bấm Mở cửa (điều kiện đủ/chưa đủ: xem mục Rules → Điều kiện Mở Cánh cổng Thời gian).

## Assets

- **Vật phẩm (Mảnh bản đồ):** Mỗi màn chơi hoàn thành sẽ nhận được 1 mảnh bản đồ (áp dụng cho tất cả thành viên trong phòng nếu chơi Multiplayer). Người chơi cần thu thập đủ 30 mảnh bản đồ khác nhau (tương ứng 30 màn chơi) để mở Cánh cổng Thời gian.
- **Điểm năng lượng:** Là điểm cá nhân (mỗi người chơi có quỹ riêng), được cấp lúc bắt đầu màn chơi để dùng cho các hành động trợ giúp (nghe lại NPC, xem text, dịch text...). Đây là điểm mang tính hỗ trợ: dùng hết năng lượng **không** làm thua màn chơi, chỉ khiến người chơi mất quyền dùng các hành động trợ giúp đó và phải tự lực vượt nhiệm vụ.
- **Điểm chiến lực:** Là điểm cá nhân trong 1 world, ban đầu bằng **0**, tính riêng cho từng người kể cả khi chơi Multiplayer. Được cộng một lần khi **chiến thắng** màn chơi, theo công thức chung của dự án (xem `PROJECT OVERVIEW.md` mục Hệ thống điểm): số nhiệm vụ cá nhân hoàn thành × độ khó, cộng thêm điểm thưởng theo tỉ lệ thời gian còn lại và tỉ lệ năng lượng còn lại. Điểm chiến lực sử dụng để **unlock các màn chơi**.
  - **Cơ chế nhảy bậc (Level Jump):** Có thể chơi 1 màn nhiều lần để tăng điểm chiến lực, từ đó đủ điều kiện nhảy bậc màn chơi (ví dụ: nhảy từ màn 1 lên màn 4, bỏ qua màn 2, 3).
- **Túi đồ:** Ngăn Vật phẩm chứa các Mảnh bản đồ đã thu thập; Ngăn Kiến thức chứa các từ vựng/mẫu câu (`targetPhrase`) và bí quyết (`cluebook`) đã học được từ NPC cố vấn qua từng màn, để người chơi luyện lại khi cần.

## Rules

- **Cấu trúc World & Màn chơi:**
  - Mỗi world có nhiều màn chơi. Hoàn thành tất cả các màn chơi mới hoàn thành world.
  - Mỗi màn chơi có nhiều nhiệm vụ: **Tối thiểu 4 nhiệm vụ / màn chơi**.
- **Điều kiện Thắng/Thua & Share Mảnh bản đồ:**
  - Thắng khi tất cả các thành viên tham gia đều **hoàn thành ít nhất 1 nhiệm vụ** và cả nhóm hoàn thành đủ nhiệm vụ **trong thời gian cho phép của màn chơi** — điều kiện thời gian là tiên quyết, hết giờ mà chưa xong thì tính là thua, cả nhóm phải chơi lại từ đầu màn.
  - Khi màn chơi hoàn thành, các thành viên được share và nhận mảnh bản đồ của màn chơi đó.
- **Quy tắc Điểm năng lượng (hỗ trợ cá nhân):**
  - Mỗi người chơi có quỹ Điểm năng lượng riêng, cấp lúc bắt đầu màn chơi, dùng cho các hành động trợ giúp: nghe lại NPC nói, xem dạng text lời NPC nói, dịch text NPC nói...
  - Dùng hết điểm năng lượng **không** làm thua màn chơi — chỉ khiến người chơi đó mất quyền dùng các hành động trợ giúp trên, buộc phải tự lực hoàn thành nhiệm vụ còn lại bằng khả năng của mình.
- **Quy tắc Điểm chiến lực & Mở khóa màn chơi:**
  - Điểm chiến lực ban đầu = 0. Được cộng một lần cho mỗi cá nhân khi **chiến thắng** màn chơi, theo công thức chung của dự án (độ khó × số nhiệm vụ hoàn thành + điểm thưởng theo tỉ lệ thời gian còn lại + điểm thưởng theo tỉ lệ năng lượng còn lại).
  - Đủ Điểm chiến lực yêu cầu mới được phép unlock và tham gia màn chơi tiếp theo.
  - Cho phép chơi lại màn đã qua nhiều lần để cày thêm điểm chiến lực và nhảy cóc bỏ qua các màn chơi trung gian (nhảy bậc).
- **Cơ chế Tương tác NPC Cố vấn & Đối tượng Nhiệm vụ (NPC Advisor & Quest Objects):**
  - **Mỗi màn chơi có 1 nhân vật NPC chính (Cố vấn / Người dẫn dắt):** Ví dụ màn 1 có Thuyền trưởng (Captain).
  - **Giai đoạn 1 — Tiếp cận & Mở khóa Bí quyết:** Người chơi cần di chuyển đến gặp NPC này trước. Để nhận được lời khuyên/bí quyết/kinh nghiệm/mật khẩu vượt ải, người chơi phải trả lời một chuỗi câu hỏi giao tiếp tiếng Anh (chào hỏi, giới thiệu tên tuổi và kỹ năng của bản thân, trình bày mục đích đến đây xin hỗ trợ). Khi hoàn thành, NPC mới trao bí quyết, sổ tay hướng dẫn hoặc mật khẩu.
  - **Giai đoạn 2 — Vận dụng giải quyết Đối tượng Nhiệm vụ:** Khi bấm vào các đối tượng nhiệm vụ trong màn (Cột buồm, Thân tàu, Đèn phao cứu sinh, Hòm báu...), người chơi phải vận dụng chính các lời khuyên, bí quyết, kinh nghiệm hoặc mật khẩu mà NPC cố vấn đã cung cấp để giải quyết vấn đề.
  - **Hình thức giải quyết đa dạng:** Người chơi có thể trả lời câu hỏi bằng Voice (Nói), gõ Text (Viết), hoặc chọn đáp án trắc nghiệm đúng bằng tiếng Anh để vượt qua nhiệm vụ và thu thập Mảnh bản đồ.
- **Điều kiện Mở Cánh cổng Thời gian (End-game Rule):**
  - Khi chơi hết 30 màn, người chơi tiến đến địa điểm Cánh cổng Thời gian và bấm Mở cửa.
  - Nếu đủ 30 mảnh bản đồ khác nhau → Được mở cổng trở về nhà.
  - Nếu chưa đủ 30 mảnh bản đồ → Báo các nhiệm vụ / màn chơi còn thiếu.

## World

- Mỗi world là seri các câu chuyện liên quan tới nhau, người chơi phải phối hợp cùng vượt qua các thử thách để vượt ải (điều kiện hoàn thành World: xem mục Rules → Cấu trúc World & Màn chơi).
- Thuộc tính:
  - Học ngôn ngữ:
  - Học kĩ năng:
  - Độ khó:
  - Lứa tuổi phù hợp
  - Giá bán
- Độ khó của game thể hiện qua việc giao tiếp bằng tiếng Anh với NPC, qua đó học được các kĩ năng nghe-nói-đọc-viết:
  - **Easy:** be/have got; present simple/continuous; can/must; imperatives; there is/are; past simple; going to; comparatives; question forms.
  - **Medium:** question forms; narrative tenses; modals of deduction; reported speech; passive; conditionals; relative clauses; comparison; linking and persuasion.
  - **Hard:** hedging; advanced reporting; nominalisation; inversion; clefts; advanced concession; mixed conditionals; cohesion; counterargument.

### World 1 — Lost in Atlantis: Lạc vào vương quốc huyền thoại

- **Cốt truyện:** Một nhóm bạn vô tình lạc vào thế giới huyền thoại Atlantis. Vượt qua các thử thách để sưu tầm 30 "Mảnh bản đồ", khi ghép lại cánh cổng thời gian sẽ hiện ra để trở về nhà.
- **Vật phẩm chính:** Mảnh bản đồ (30 mảnh khác nhau).
- **Nhiệm vụ:** Người chơi cần vượt qua tổng cộng 30 màn chơi: chia làm 5 Chương, mỗi chương có 6 màn chơi (mỗi màn tối thiểu 4 nhiệm vụ). Sưu tầm đủ 30 mảnh bản đồ khác nhau, sau đó di chuyển đến Cánh cổng Thời gian bấm mở cửa để trở về nhà. Nếu chưa đủ mảnh, cổng sẽ báo các nhiệm vụ/màn chơi còn thiếu.

### World 2 — MAYA: Trở về nền văn minh cổ đại *(chưa triển khai)*

### World 3 — Xuyên Việt: Một chuyến phượt bụi *(chưa triển khai)*

## Characters

### NPC / Bot — Thiết kế riêng cho World "Lost in Atlantis"

#### 1. LEO (The Guardian) – Đội trưởng mẫu mực

- **Tên đầy đủ:** Leo Harrison (dựa trên hình tượng con sư tử — mạnh mẽ và dẫn dắt).
- **Vai trò:** Trưởng nhóm, chuyên gia thể lực & cận chiến.
- **Đặc điểm:** Thể hình vạm vỡ, ánh mắt kiên định. Anh là "lá chắn" của cả đội.
- **Tính cách:** Quyết đoán, dũng cảm nhưng đôi khi hơi bảo thủ. Anh coi việc đưa mọi người về nhà là sứ mệnh sống còn.
- **Kỹ năng:** Đẩy vật nặng, phá rào chắn và bảo vệ đồng đội khỏi các đòn tấn công vật lý.

#### 2. MAYA (The Scholar) – Nhà thông thái khảo cổ

- **Tên đầy đủ:** Maya Sterling (tên gợi cảm giác về những nền văn minh cổ đại như Maya).
- **Vai trò:** Chuyên gia giải đố & ngôn ngữ cổ.
- **Đặc điểm:** Thông minh, đeo kính, luôn mang theo một cuốn nhật ký cổ mà cô tìm thấy ở lối vào Atlantis.
- **Tính cách:** Điềm tĩnh, tò mò và cực kỳ chi tiết. Maya là người kết nối các mảnh ghép lịch sử để tìm ra lối thoát.
- **Kỹ năng:** Giải mã các bảng ký tự cổ, phát hiện bẫy ngầm và tìm ra các lối đi bí mật (Secret Rooms).

#### 3. SAM (The Fixer) – Thiên tài công nghệ

- **Tên đầy đủ:** Sam "Gizmo" Miller (biệt danh Gizmo ám chỉ sự am hiểu về máy móc).
- **Vai trò:** Kỹ sư hệ thống & cơ khí.
- **Đặc điểm:** Nhỏ con, đeo kính bảo hộ trên trán, túi đồ luôn lỉnh kỉnh dây điện và công cụ.
- **Tính cách:** Lém lỉnh, hay cằn nhằn nhưng rất trung thành. Sam thường dùng sự hài hước để xua tan không khí căng thẳng dưới đáy biển.
- **Kỹ năng:** Sửa chữa máy móc Atlantis, hack hệ thống năng lượng Orichalcum và chế tạo các thiết bị hỗ trợ (như drone lặn hoặc đèn pin tầm xa).

#### 4. JADE (The Wraith) – Bóng ma địa hình

- **Tên đầy đủ:** Jade "Swift" Nguyen (tên gợi sự sắc bén và linh hoạt).
- **Vai trò:** Tiên phong, chuyên gia di chuyển & thám thính.
- **Đặc điểm:** Dáng người nhỏ gọn nhưng cực kỳ dẻo dai, phong cách của một vận động viên Parkour.
- **Tính cách:** Lạc quan, ưa mạo hiểm và có bản năng sinh tồn cực mạnh. Cô là người đầu tiên dám nhảy xuống những hố sâu để thăm dò.
- **Kỹ năng:** Leo trèo tường bám, nhảy qua vực thẳm và có khả năng nín thở cực lâu để bơi qua các đường cống ngầm chật hẹp.

## UI

### Lost in Atlantis

- **Bối cảnh:** thế giới Atlantis, huyền thoại, kì bí, cổ kính.
- **Nhân vật & NPC:** NPC xuất hiện theo từng màn chơi.
- **Hội thoại:** chat nhóm giữa các người chơi và hội thoại với NPC/Bot.
- **Vật phẩm:** "Mảnh bản đồ".
- **Khác:** Background, nhạc nền, SFX, icon, color, font, voice...

## Gameplay

### World 1 — Lost in Atlantis: The Way Home

*(Xem cốt truyện & tổng quan ở mục World → World 1. Dưới đây là chi tiết từng Chương/Màn/Nhiệm vụ.)*

---

#### Chương 1: Sự cố dưới đáy biển (Màn 1 – 6)

**Bối cảnh:** Nhóm bạn bị đắm tàu, rơi vào hang động biển sâu và phát hiện ra lối vào Atlantis.

##### Màn 1: Cơn bão bất ngờ

*Nhóm bạn điều khiển thuyền vượt qua giông bão, tàu bị lật.*

- **Hạ buồm đón gió:** [Kỹ năng Nghe & Nói] Nghe NPC Thuyền trưởng hô hiệu lệnh hướng gió qua bộ đàm và Nói phản hồi khẩu lệnh xác nhận điều khiển tời buồm.
- **Gia cố thân tàu nứt:** [Kỹ năng Đọc & Viết] Đọc hướng dẫn khắc phục sự cố trên sổ tay kỹ thuật khoang tàu và Viết tên công cụ cần NPC thợ máy chuyền cho.
- **Định vị phao cứu sinh:** [Kỹ năng Nghe & Nói] Nghe cảnh báo radar và Nói mô tả vị trí phát sáng của đèn khẩn cấp cho hoa tiêu.
- **Thu thập Mảnh bản đồ 1:** [Kỹ năng Đọc & Viết] Đọc câu đố gợi ý trên khóa hòm cứu nạn và Viết từ khóa giải mã.

##### Màn 2: Hang bong bóng

*Tỉnh dậy trong hang động ngầm, học cách di chuyển và nhặt nhu yếu phẩm.*

- **Tạo chuỗi bóng khí thở:** [Kỹ năng Nghe & Nói] Nghe NPC Tinh linh bóng khí hướng dẫn nhịp phát quang và Nói khẩu lệnh kích hoạt chuỗi san hô.
- **Nhặt nhu yếu phẩm trôi dạt:** [Kỹ năng Đọc & Nói] Đọc nhãn phân loại túi cứu thương và Nói báo cáo tình trạng tồn kho với NPC cứu hộ.
- **Dọn lối thoát ngầm:** [Kỹ năng Đọc & Viết] Đọc văn tự cảnh báo trên tảng đá và Viết mật lệnh làm suy yếu khớp đá.
- **Thu thập Mảnh bản đồ 2:** [Kỹ năng Đọc & Nói] Đọc câu đố vách hang và Nói giải thích ý nghĩa câu thơ cổ để nhận mảnh bản đồ từ linh hồn vách đá.

##### Màn 3: Ánh sáng kỳ lạ

*Giải mã các khối đá phát quang để mở lối đi sâu vào lòng đất.*

- **Thu thập 4 tinh thể phát quang:** [Kỹ năng Nghe & Nói] Nghe NPC Người gác hang mô tả đặc tính màu sắc/vị trí từng viên đá và Nói phân công vị trí cho đồng đội.
- **Ghép mã màu quang học:** [Kỹ năng Đọc & Viết] Đọc bảng quy tắc pha màu và Viết thứ tự sắp xếp tinh thể vào bệ đá.
- **Cân bằng bệ đá trọng lực:** [Kỹ năng Nghe & Nói] Nghe NPC đo áp suất đếm nhịp và Nói hiệu lệnh đồng bộ bước chân lên bệ đá.
- **Thu thập Mảnh bản đồ 3:** [Kỹ năng Đọc & Nói] Đọc văn bản trên bệ trung tâm và Nói câu thần chú mở khóa hốc đá.

##### Màn 4: Dòng chảy xiết

*Cả nhóm phải bám nhau vượt qua một thác nước ngầm chảy xiết.*

- **Bắn neo cố định:** [Kỹ năng Đọc & Viết] Đọc bảng thông số sức gió/lực căng trên ống ngắm và Viết lệnh điều chỉnh góc bắn neo.
- **Vượt thác nước ngầm:** [Kỹ năng Nghe & Nói] Nghe NPC hoa tiêu cảnh báo chu kỳ dòng xoáy và Nói đếm nhịp di chuyển an toàn cho cả đội.
- **Đóng van xoáy nước:** [Kỹ năng Đọc & Nói] Đọc sơ đồ thủy lực ngầm và Nói hướng dẫn đồng đội thứ tự ngắt van áp suất.
- **Thu thập Mảnh bản đồ 4:** [Kỹ năng Nói & Nghe] Nói lời thuyết phục NPC Thủy quái dẫn đường vào ngách bí mật và Nghe chỉ dẫn đường vào.

##### Màn 5: Quái thú canh cửa

*Né tránh một con lươn điện khổng lồ đang ngủ say để lẻn qua.*

- **Di chuyển lén lút:** [Kỹ năng Nghe & Nói] Nghe nhịp thở/tiếng rít của quái thú lươn điện và Nói thì thầm ra hiệu dừng lại hoặc bò tiếp.
- **Cắt nguồn tích điện:** [Kỹ năng Đọc & Viết] Đọc sơ đồ mạch sinh học trên máy quét và Viết tên vị trí rễ điện cần cắt.
- **Đánh lạc hướng:** [Kỹ năng Nói] Mô phỏng lại âm thanh giao tiếp của loài cá phát quang bằng tiếng Anh để dụ quái thú xoay đầu.
- **Thu thập Mảnh bản đồ 5:** [Kỹ năng Đọc & Nói] Đọc bài ru cổ ngữ và Nói nhẹ nhàng câu thần chú xoa dịu giấc ngủ quái thú để lấy bản đồ.

##### Màn 6: Cổng chào Atlantis

*Kích hoạt đại bửu thạch, cánh cổng dẫn vào thành phố chìm mở ra.*

- **Tìm 3 khối Đại bửu thạch:** [Kỹ năng Nghe & Nói] Nghe NPC Người canh cổng mô tả hình dạng bửu thạch và Nói báo cáo khi tìm thấy từng khối đá.
- **Dịch mật mã mở cổng:** [Kỹ năng Đọc & Viết] Đọc câu danh ngôn khắc trên vòm cổng và Viết từ khuyết để hoàn thiện mật mã.
- **Lắp bửu thạch vào trục:** [Kỹ năng Nghe & Nói] Nghe NPC kỹ sư cơ khí chỉ dẫn hướng xoay khớp và Nói hiệu lệnh cùng đẩy đá vào bệ.
- **Thu thập Mảnh bản đồ 6:** [Kỹ năng Nói & Nghe] Nói lời tuyên thệ trước Người canh cổng và Nghe lời chúc phúc trao mảnh bản đồ.

---

#### Chương 2: Ngoại ô Thành phố Thủy tinh (Màn 7 – 12)

**Bối cảnh:** Khám phá những tàn tích, khu vườn sinh học ngoài rìa hoàng cung.

##### Màn 7: Rừng tảo phát quang

*Nhóm bạn tìm cách hái quả sinh học để có khả năng thở dưới nước lâu hơn.*

- **Thu hoạch 4 quả sinh học:** [Kỹ năng Đọc & Nói] Đọc tài liệu thực vật học phân biệt quả độc/lành và Nói hướng dẫn đồng đội trèo hái.
- **Vượt qua bãi gai độc:** [Kỹ năng Nghe & Nói] Nghe NPC Thần rừng cảnh báo chu kỳ gai nở và Nói chỉ đạo nhịp né tránh.
- **Bào chế thuốc tăng thể lực:** [Kỹ năng Đọc & Viết] Đọc công thức phối chế thảo dược cổ và Viết tỉ lệ dung dịch vào bàn pha chế.
- **Thu thập Mảnh bản đồ 7:** [Kỹ năng Nói] Nói câu chào bằng ngôn ngữ thiên nhiên để hoa khổng lồ mở nhụy nhả bản đồ.

##### Màn 8: Cầu treo đổ nát

*Phối hợp kích hoạt các đòn bẩy cổ xưa để bắc cầu qua vực thẳm sâu hoắm.*

- **Hạ đòn bẩy đối trọng:** [Kỹ năng Đọc & Viết] Đọc chỉ số tải trọng và Viết thông số cân bằng lực vào bảng điều khiển tời.
- **Sửa bánh răng cầu:** [Kỹ năng Nghe & Nói] Nghe NPC Thợ máy cổ hướng dẫn quy trình lắp ráp và Nói xác nhận hoàn thành từng mắt xích.
- **Nối thang dây:** [Kỹ năng Nghe & Nói] Nghe NPC giữ chốt ra tín hiệu an toàn và Nói hướng dẫn đồng đội điểm bám thang.
- **Thu thập Mảnh bản đồ 8:** [Kỹ năng Đọc & Nói] Đọc nhật ký người gác cầu và Nói lời giải câu đố để mở hòm kho báu.

##### Màn 9: Mê cung san hô

*Định vị đường đi trong mê cung gai góc, tránh né các loài cá ăn thịt.*

- **Định vị lộ trình:** [Kỹ năng Đọc & Nói] Đọc sơ đồ rạn san hô và Nói chỉ huy phương hướng rẽ (trái, phải, tiến, dừng) cho cả đội.
- **Xua đuổi cá săn mồi:** [Kỹ năng Nghe & Nói] Nghe tần số tiếng gầm cá dữ và Nói lệnh nạp pháo sáng cho súng phóng.
- **Phá rào san hô vôi hóa:** [Kỹ năng Đọc & Viết] Đọc phân tích cấu trúc điểm yếu của vách đá và Viết tọa độ va đập cho búa tạ.
- **Thu thập Mảnh bản đồ 9:** [Kỹ năng Nói & Nghe] Nói lời thương lượng xã giao với NPC Ẩn sĩ san hô và Nghe gợi ý vị trí cất giấu bản đồ.

##### Màn 10: Nhà máy năng lượng Orichalcum

*Sửa chữa hệ thống ống dẫn năng lượng cổ để mở cửa một khu nhà cổ.*

- **Nối 3 đường ống dẫn nhiệt:** [Kỹ năng Nghe & Nói] Nghe AI cảnh báo mức độ quá nhiệt và Nói lệnh điều phối các van xả tương ứng.
- **Hack bảng điều khiển:** [Kỹ năng Đọc & Viết] Đọc sơ đồ vi mạch logic và Viết dòng lệnh tái lập trình hệ thống.
- **Xả áp suất lò phản ứng:** [Kỹ năng Đọc & Nói] Đọc chỉ số áp kế nguy hiểm và Nói đếm nhịp gạt cần xả khẩn cấp cùng NPC cơ khí.
- **Thu thập Mảnh bản đồ 10:** [Kỹ năng Nghe & Viết] Nghe thông báo xác thực giọng nói của AI và Viết mã truy xuất buồng chứa bản đồ.

##### Màn 11: Những bức phù điêu kể chuyện

*Giải câu đố xếp hình cổ xưa để tìm ra manh mối về "Chìa khóa Trở về".*

- **Quét 4 bức phù điêu:** [Kỹ năng Đọc] Đọc các đoạn chú giải lịch sử cổ đại khắc dưới chân từng bức phù điêu.
- **Xếp dòng thời gian:** [Kỹ năng Nghe & Nói] Nghe NPC Nhà khảo cổ tóm tắt niên đại và Nói sắp xếp thứ tự các sự kiện lịch sử.
- **Vượt qua bài khảo hạch:** [Kỹ năng Nghe & Nói] Nghe 3 câu hỏi vấn đáp lịch sử từ Tinh linh canh giữ và Nói câu trả lời.
- **Thu thập Mảnh bản đồ 11:** [Kỹ năng Viết] Viết bài học lịch sử ngắn gọn (từ khóa) lên bệ thờ để mở bệ chứa bản đồ.

##### Màn 12: Đội quân đất sét thức tỉnh

*Chạy trốn khỏi các hộ vệ bằng đá vô tình bị nhóm kích hoạt.*

- **Kích hoạt bẫy sập:** [Kỹ năng Đọc & Nói] Đọc cơ chế kích hoạt bẫy trần đá và Nói hiệu lệnh giật chốt khi kẻ địch đi vào tầm ngắm.
- **Chạy đua qua hành lang:** [Kỹ năng Nghe & Nói] Nghe NPC hoa tiêu báo trước các điểm nứt sụt và Nói dẫn hướng chạy cho cả đội.
- **Phòng thủ chặn hậu:** [Kỹ năng Nghe & Viết] Nghe tiếng nạp năng lượng của kẻ địch và Viết lệnh kích hoạt lá chắn năng lượng tối đa.
- **Thu thập Mảnh bản đồ 12:** [Kỹ năng Đọc & Nói] Đọc ký hiệu phong ấn trên tượng tướng chỉ huy và Nói mật mã vô hiệu hóa để nhặt bản đồ.

---

#### Chương 3: Đô thị cổ Hoàng gia (Màn 13 – 18)

**Bối cảnh:** Tiến vào trung tâm Atlantis, nơi có kiến trúc vĩ đại nhưng đầy cạm bẫy.

##### Màn 13: Quảng trường nước

*Vượt qua hệ thống đài phun nước áp lực cao di chuyển theo quy luật.*

- **Giải mã nhịp phun nước:** [Kỹ năng Đọc & Nói] Đọc quy luật nhịp điệu phun nước trên bia đá và Nói giải thích chu kỳ an toàn cho đồng đội.
- **Vượt ô cờ áp lực:** [Kỹ năng Nghe & Nói] Nghe NPC Trọng tài cơ giới đọc tín hiệu ô an toàn và Nói chỉ đạo bước chân tiếp theo.
- **Khóa van nước tổng:** [Kỹ năng Đọc & Viết] Đọc áp suất hai bên trụ van và Viết lệnh đồng bộ hóa hai van khóa thủy lực.
- **Thu thập Mảnh bản đồ 13:** [Kỹ năng Nói] Nói câu lệnh xác nhận hoàn thành thử thách trước đài phun trung tâm.

##### Màn 14: Thư viện ngập nước

*Tìm kiếm các cuộn giấy da cổ giữa các tầng lầu lơ lửng bằng trọng lực nước.*

- **Thu thập 3 cuộn giấy da cổ:** [Kỹ năng Nghe & Nói] Nghe NPC Thủ thư ma hướng dẫn vị trí tầng sách và Nói yêu cầu tra cứu thư mục cổ.
- **Dịch mật thư Atlantis:** [Kỹ năng Đọc & Viết] Đọc bản văn cổ bị mờ/rách và Viết từ vựng khuyết thiếu để phục hồi nội dung.
- **Kéo cần gạt giá sách:** [Kỹ năng Đọc & Nói] Đọc tên các đầu sách mật mã và Nói thứ tự kéo sách cho đồng đội thực hiện.
- **Thu thập Mảnh bản đồ 14:** [Kỹ năng Nghe & Nói] Nghe câu đố tư duy của Thủ thư và Nói lời giải đáp để nhận bản đồ.

##### Màn 15: Hệ thống tàu ngầm cổ

*Sửa chữa và điều khiển một chiếc tàu ngầm mini của người Atlantis để di chuyển.*

- **Lắp pin năng lượng:** [Kỹ năng Đọc & Viết] Đọc sơ đồ lắp ráp pin năng lượng và Viết mã khởi động nguồn điện.
- **Sửa chân vịt tàu ngầm:** [Kỹ năng Nghe & Nói] Nghe NPC Thợ máy chỉ dẫn kỹ thuật hàn và Nói xác nhận từng khớp nối chân vịt.
- **Lái tàu qua bãi thủy lôi:** [Kỹ năng Nghe & Nói] Nghe hệ thống sonar cảnh báo khoảng cách vật cản và Nói lệnh bẻ lái khẩn cấp.
- **Thu thập Mảnh bản đồ 15:** [Kỹ năng Đọc & Viết] Đọc nhật trình lưu trữ trên tàu và Viết mã mở hòm thiết bị buồng lái.

##### Màn 16: Cạm bẫy gương kính

*Ánh sáng bị khúc xạ, nhóm phải xoay các thấu kính để chiếu mở phong ấn cửa.*

- **Lau sạch 4 thấu kính:** [Kỹ năng Đọc & Nói] Đọc chỉ dẫn quang học trên từng trụ kính và Nói phân chia vị trí lau cho từng thành viên.
- **Chỉnh góc phản xạ quang học:** [Kỹ năng Nghe & Nói] Nghe NPC Kỹ sư ánh sáng hướng dẫn độ lệch góc phản xạ và Nói điều chỉnh độ nghiêng của gương.
- **Kích hoạt ngọc phong ấn:** [Kỹ năng Đọc & Viết] Đọc bảng hội tụ quang năng và Viết công thức hội tụ tia sáng vào viên ngọc.
- **Thu thập Mảnh bản đồ 16:** [Kỹ năng Nói] Nói khẩu lệnh tụ quang để thu nhận mảnh bản đồ phóng ra từ cột sáng.

##### Màn 17: Chợ đen bỏ hoang

*Thu thập các linh kiện cơ khí cổ để chế tạo vũ khí tự vệ.*

- **Tìm 4 linh kiện máy móc:** [Kỹ năng Đọc & Nói] Đọc danh mục vật liệu cần tìm và Nói đối chiếu các bộ phận tìm thấy với danh sách.
- **Mặc cả với Bot bán hàng:** [Kỹ năng Nói & Nghe] Nói đàm phán/thuyết phục NPC Bot thương nhân để đổi lấy linh kiện vũ khí và Nghe báo giá.
- **Chế tạo súng xung điện:** [Kỹ năng Đọc & Viết] Đọc bản thiết kế vũ khí và Viết thông số nạp điện dung cho súng.
- **Thu thập Mảnh bản đồ 17:** [Kỹ năng Nghe & Nói] Nghe gợi ý mật khẩu két sắt từ Bot buôn bán và Nói câu giải mã chính xác.

##### Màn 18: Đấu trường Poseidon

*Sống sót trước các đợt tấn công thử thách của robot bảo an tinh nhuệ.*

- **Sống sót qua 3 đợt lính robot:** [Kỹ năng Nghe & Nói] Nghe NPC Bình luận viên đấu trường thông báo chủng loại kẻ địch và Nói chiến thuật phòng thủ phù hợp.
- **Bắn hạ trụ sạc năng lượng:** [Kỹ năng Đọc & Nói] Đọc phân tích điểm yếu của trụ sạc trên máy quét và Nói tọa độ ngắm bắn cho xạ thủ.
- **Hạ gục Robot thủ lĩnh:** [Kỹ năng Nghe & Nói] Nghe cảnh báo từ hệ thống phân tích chiến thuật và Nói khẩu lệnh dồn hỏa lực vào lõi năng lượng sau lưng trùm.
- **Thu thập Mảnh bản đồ 18:** [Kỹ năng Nói] Nói lời tuyên bố chiến thắng trước Hội đồng Đấu trường để nhận bản đồ trên ngai vàng.

---

#### Chương 4: Tháp Chúa Trời & Năng lượng Gốc (Màn 19 – 24)

**Bối cảnh:** Leo lên ngọn tháp cao nhất, nơi nắm giữ lõi năng lượng của toàn bộ lục địa.

##### Màn 19: Đỉnh tháp lộng gió

*Leo bên ngoài tháp, né tránh các mảnh vỡ và luồng gió biển cực mạnh.*

- **Bắn dây neo trèo tháp:** [Kỹ năng Đọc & Nói] Đọc thiết bị đo tốc độ gió bão và Nói góc bắn móc neo an toàn cho đồng đội.
- **Ẩn nấp luồng gió giật:** [Kỹ năng Nghe & Nói] Nghe còi báo bão rít trên đỉnh tháp và Nói đếm ngược thời gian toàn đội ẩn nấp vào hốc đá.
- **Đập tan rào cản gỉ sét:** [Kỹ năng Đọc & Viết] Đọc chỉ số độ bền kim loại và Viết lệnh kích hoạt sóng siêu âm phá rỉ sét.
- **Thu thập Mảnh bản đồ 19:** [Kỹ năng Đọc & Nói] Đọc ký tự ghi trên cột cờ đỉnh tháp và Nói mật lệnh mở hộp cờ.

##### Màn 20: Phòng thí nghiệm sinh học

*Giải cứu một thành viên trong nhóm bị các xúc tu thực vật đột biến bắt giữ.*

- **Cắt đứt xúc tu quái thụ:** [Kỹ năng Nghe & Nói] Nghe tiếng kêu cứu và vị trí bị trói của đồng đội qua tai nghe, Nói kế hoạch tấn công đồng loạt.
- **Pha dung dịch ức chế sinh học:** [Kỹ năng Đọc & Viết] Đọc hướng dẫn an toàn hóa chất phòng lab và Viết công thức pha chế thuốc diệt rễ cây.
- **Phun hóa chất vào cuống hoa mẹ:** [Kỹ năng Nghe & Nói] Nghe NPC Trợ lý ảo hướng dẫn thời điểm đài hoa mở và Nói hiệu lệnh xịt thuốc.
- **Thu thập Mảnh bản đồ 20:** [Kỹ năng Nói & Nghe] Nói lời cảm ơn trợ lý ảo và Nghe chỉ dẫn mở hộc hoa lấy bản đồ.

##### Màn 21: Vòng xoáy trọng lực

*Vượt qua các căn phòng nơi trọng lực liên tục đảo ngược sau mỗi vài giây.*

- **Căn nhịp đảo trọng lực:** [Kỹ năng Nghe & Nói] Nghe đồng hồ đếm ngược của hệ thống trọng lực và Nói cảnh báo chuẩn bị đáp sàn/trần nhà.
- **Đẩy nệm từ trường tiếp đất:** [Kỹ năng Đọc & Nói] Đọc tọa độ điểm rơi hiển thị trên máy quét và Nói hướng đẩy nệm đỡ an toàn.
- **Bật công tắc cân bằng:** [Kỹ năng Đọc & Viết] Đọc bảng mạch đảo chiều trên trần phòng và Viết chuỗi thao tác ngắt lực nổi khẩn cấp.
- **Thu thập Mảnh bản đồ 21:** [Kỹ năng Nói] Nói khẩu lệnh kích hoạt từ trường cá nhân để hút mảnh bản đồ đang trôi lơ lửng.

##### Màn 22: Trộm lõi năng lượng

*Vượt qua lưới tia laser năng lượng xanh bảo vệ viên đá Orichalcum Thượng Cổ.*

- **Trườn qua lưới laser:** [Kỹ năng Nghe & Nói] Nghe NPC hacker đọc quy luật quét tia laser an ninh và Nói chỉ đạo tư thế di chuyển.
- **Vô hiệu hóa cảnh báo:** [Kỹ năng Đọc & Viết] Đọc mã lỗi hệ thống cảnh báo và Viết câu lệnh giải mã bảo mật để ngắt còi báo động.
- **Rút viên đá Thượng Cổ:** [Kỹ năng Đọc & Nói] Đọc hướng dẫn cân bằng áp lực từ trường và Nói nhịp kéo kìm nhấc lõi Orichalcum ra ngoài.
- **Thu thập Mảnh bản đồ 22:** [Kỹ năng Đọc & Nói] Đọc văn bản ẩn dưới đế năng lượng và Nói mật khẩu giải phóng ngàm giữ bản đồ.

##### Màn 23: Thần hộ vệ khổng lồ

*Trận chiến cam go với bức tượng thần Poseidon bằng máy cơ khí khổng lồ.*

- **Né đòn quét đinh ba:** [Kỹ năng Nghe & Nói] Nghe âm thanh tích tụ sóng chấn động và Nói hiệu lệnh nhảy né sóng thần lực trên mặt sàn.
- **Phá hủy 2 khớp gối cơ khí:** [Kỹ năng Đọc & Viết] Đọc phân tích cấu trúc chịu lực của tượng và Viết lệnh công phá vào điểm yếu hai khớp gối.
- **Hack bảng mạch sau gáy:** [Kỹ năng Nghe & Nói] Nghe NPC hoa tiêu đọc mã ngắt nguồn sau gáy tượng và Nói xác nhận thao tác ngắt điện.
- **Thu thập Mảnh bản đồ 23:** [Kỹ năng Đọc & Nói] Đọc cổ tự khắc trên vương miện của Thần hộ vệ để nhặt mảnh bản đồ rơi ra.

##### Màn 24: Kích hoạt cổng trời

*Đặt viên đá năng lượng vào bệ phóng, định vị tọa độ quay về Trái Đất hiện đại.*

- **Đặt lõi năng lượng vào bệ:** [Kỹ năng Đọc & Nói] Đọc hướng dẫn tiếp xúc năng lượng và Nói khẩu lệnh hạ lõi đá vào cổng truyền dẫn.
- **Xoay 3 đĩa tọa độ không gian:** [Kỹ năng Đọc & Viết] Đọc nhật ký hành trình thế giới hiện đại và Viết chính xác kinh độ/vĩ độ tọa độ Trái Đất.
- **Đồng bộ hóa tần số:** [Kỹ năng Nghe & Nói] Nghe sóng âm đối chiếu và Nói điều chỉnh tần số dao động trùng khớp với tín hiệu sóng về nhà.
- **Thu thập Mảnh bản đồ 24:** [Kỹ năng Nghe & Nói] Nghe lời xác nhận từ AI Cổng Trời và Nói lời chấp nhận hoàn tất để nhận bản đồ.

---

#### Chương 5: Cuộc đua với Thời gian (Màn 25 – 30)

**Bối cảnh:** Hệ thống tự hủy bị kích hoạt, Atlantis bắt đầu sụp đổ hoàn toàn. Nhóm bạn phải chạy trốn.

##### Màn 25: Thành phố sụp đổ

*Chạy đua với tốc độ khi các tòa nhà xung quanh đổ sụp và đá tảng rơi xuống.*

- **Chạy nước rút qua phố:** [Kỹ năng Nghe & Nói] Nghe AI cảnh báo sớm các cấu trúc nhà sập phía trước và Nói chỉ huy hướng rẽ thoát hiểm.
- **Phá đá chắn cửa hầm:** [Kỹ năng Đọc & Viết] Đọc phân tích độ nứt của tảng đá và Viết lệnh kích nổ bộc phá phá đá.
- **Cứu đồng đội trượt ngã:** [Kỹ năng Nghe & Nói] Nghe tiếng kêu cứu và Nói lời động viên, hướng dẫn đồng đội nắm lấy tay/dây kéo.
- **Thu thập Mảnh bản đồ 25:** [Kỹ năng Đọc & Nói] Đọc mã cứu hộ khẩn cấp trên nóc xe cổ và Nói mật mã mở hòm cứu hộ lấy bản đồ.

##### Màn 26: Dòng nước ngược dòng

*Bơi ngược dòng nước lũ đang tràn vào các đường hầm thoát hiểm.*

- **Bơi bám gờ tường chắn:** [Kỹ năng Nghe & Nói] Nghe còi báo lũ dâng cao từng đợt và Nói đếm nhịp tiến lên giữa các khoảng lặng nước rút.
- **Mở cửa xả áp suất lớn:** [Kỹ năng Đọc & Viết] Đọc biển cảnh báo thủy lực và Viết mã xả áp suất nước trên bảng điều khiển cửa hầm.
- **Tiếp ứng bình dưỡng khí:** [Kỹ năng Nghe & Nói] Nghe NPC cứu hộ thông báo vị trí các túi oxy dự phòng và Nói chỉ định phân phát bình khí cho đồng đội.
- **Thu thập Mảnh bản đồ 26:** [Kỹ năng Đọc & Nói] Đọc mã hiệu lưới chắn rác và Nói mật mã tháo khớp lưới lấy bản đồ.

##### Màn 27: Sự phản bội của hộ vệ

*Chiến đấu với thủ lĩnh đội cận vệ máy đang cố chặn đường sống của nhóm.*

- **Phá khiên phòng thủ của thủ lĩnh:** [Kỹ năng Nghe & Nói] Nghe NPC hoa tiêu đọc chu kỳ suy yếu của trường lực và Nói thời điểm mở đòn tấn công tổng lực.
- **Đánh văng drone tiếp viện:** [Kỹ năng Đọc & Nói] Đọc cảnh báo đường bay của drone trên kính ngắm và Nói hướng đánh chặn cho lá chắn phòng thủ.
- **Tước khóa kích hoạt:** [Kỹ năng Đọc & Viết] Đọc mã vô hiệu hóa cánh tay cơ khí của thủ lĩnh và Viết lệnh khóa khớp tay để giật chìa khóa.
- **Thu thập Mảnh bản đồ 27:** [Kỹ năng Đọc & Nói] Đọc mã số lớp giáp ngực của robot bị hạ gục và Nói lệnh mở khóa lấy bản đồ.

##### Màn 28: Cây cầu gãy

*Cả nhóm phải phối hợp dùng dây đu và kỹ năng nhảy vượt chướng ngại vật qua vực nham thạch nước.*

- **Bắn dây neo qua vực dung nham:** [Kỹ năng Đọc & Viết] Đọc máy đo nhiệt độ và hướng gió bề mặt, Viết thông số bắn móc neo chuẩn xác.
- **Đu dây vượt vực:** [Kỹ năng Nghe & Nói] Nghe tín hiệu luồng khí nóng ngắt quãng và Nói đếm nhịp xuất phát nhảy đu dây cho từng người.
- **Đỡ đồng đội tiếp đất:** [Kỹ năng Nghe & Nói] Nghe tín hiệu hô tiếp đất của đồng đội đang đu dây và Nói hướng dẫn vị trí đón an toàn.
- **Thu thập Mảnh bản đồ 28:** [Kỹ năng Đọc & Nói] Đọc văn tự tưởng niệm trên bia đá cổ bờ bên kia và Nói câu truy niệm để rút mảnh bản đồ.

##### Màn 29: Cổng dịch chuyển quá tải

*Giữ vững vị trí, bảo vệ lõi năng lượng khỏi làn sóng quái vật biển trong lúc cổng sạc đầy.*

- **Lập vành đai phòng thủ:** [Kỹ năng Nghe & Nói] Nghe NPC Chỉ huy phân công các hướng quái vật tấn công và Nói phân nhiệm vụ cho từng vị trí phòng thủ.
- **Tiêu diệt 3 đợt quái vật biển:** [Kỹ năng Đọc & Nói] Đọc điểm yếu của quái vật trên máy quét và Nói lệnh kích hoạt bẫy điện tập trung.
- **Hạ nhiệt buồng nạp:** [Kỹ năng Đọc & Viết] Đọc biểu đồ cảnh báo nhiệt độ lò sạc và Viết lệnh bơm nitơ lỏng làm mát khẩn cấp.
- **Thu thập Mảnh bản đồ 29:** [Kỹ năng Nghe & Nói] Nghe thông báo hệ thống đạt 100% mức năng lượng và Nói khẩu lệnh nhận mảnh bản đồ thứ 29.

##### Màn 30: Trở về đất liền

*Cánh cổng mở ra, nhóm bạn thực hiện cú nhảy quyết định, thoát khỏi Atlantis ngay trước khi nó nổ tung và tỉnh dậy an toàn trên một bãi biển quê nhà.*

- **Ghép hoàn chỉnh 30 mảnh bản đồ:** [Kỹ năng Đọc & Nói] Đọc sơ đồ hướng dẫn thứ tự ghép các mảnh vỡ và Nói điều phối vị trí lắp đặt với toàn đội.
- **Đọc khẩu lệnh kích hoạt cổng thời gian:** [Kỹ năng Nghe & Nói] Nghe giọng đọc mẫu phát âm chuẩn từ Linh hồn Thời gian và toàn đội cùng Nói (luyện phát âm chuẩn xác khẩu lệnh) kích hoạt cổng.
- **Cắt cầu dao quá tải ngăn nổ ngược:** [Kỹ năng Đọc & Viết] Đọc cảnh báo hố đen quá tải và Viết lệnh ngắt mạch từ trường để ngăn nổ ngược.
- **Thực hiện cú nhảy quyết định:** [Kỹ năng Nghe & Nói] Nghe tín hiệu đếm ngược cuối cùng từ Cổng Không Gian và toàn đội cùng Nói khẩu hiệu đồng lòng trước khi nhảy về thế giới hiện đại.

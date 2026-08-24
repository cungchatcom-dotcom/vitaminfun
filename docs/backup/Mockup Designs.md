## 0. OVERVIEW MOCKUP DESIGN

+---------------------------------------------------------------------------------------------------------+
| [TOP BAR] Chapter 3 - Stage 13: Quảng trường nước  | ⏳ 04:35 | ⚡ Team Energy: 85/100 | 🏆 Skill: 450 |
+---------------------------------------------------------------------------------------------------------+
|                                                                                    |      [MISSION]     |
|                                                                                    |                    |
|                       KHUNG NHÌN 2.5D ISOMETRIC                                    | [x] 1. Nhịp nước   |
|                  (Góc nhìn chiến thuật 45 độ, di chuyển click đất,                 | [ ] 2. Ô cờ áp lực |
|                  vật thể phát sáng Orichalcum, hiệu ứng bọt khí ngầm)              | [ ] 3. Khóa van    |
|                                                                                    | [ ] 4. Mảnh bản đồ |
|                                                                                    |                    |
|                                                                                    | 🗺️ Map: 12/30     |
|                                                                                    | (Nhấn Tab để ẩn/hiện)
|                                                                                    |                    |
+---------------------------------------------------------------------------------------------------------+
| [BOTTOM DASHBOARD - BẢNG ĐIỀU KHIỂN HUYỀN BÍ THEO PHONG CÁCH ATLANTIS]                                  |
| +---------------------+ +-------------------------------------+ +-------------------------------------+ |
| |         NPC         | | ENGLISH CONSOLE (HỘI THOẠI & TASK)  | |                ACTION               | |
| |  [Portrait: Poseidon| | NPC: "Rotate the mirror 45 degrees!"| | [Q] Leo: Khiên chắn (Shield)        | |
| |   Guardian Golem]   | | 🔊 [Listen]  🎤 [Hold to Speak]    | | [W] Maya: Giải mã (Decipher)        | |
| |  "Fix the hydraulic | | > Input command: [turn left coral]  | | [E] Sam: Sửa chữa (Fix Tool)        | |
| |      pipe now!"     | | Gợi ý: [Imperatives / Present Simple| | [R] Jade: Bắn móc neo (Grapple)     | |
| +---------------------+ +-------------------------------------+ +-------------------------------------+ |
+---------------------------------------------------------------------------------------------------------+


## 1. Thanh trạng thái phía trên (Top Status Bar)

Thiết kế thanh ngang viền kim loại vàng Orichalcum khảm trên nền đá phiến biển sâu, tập trung vào 4 chỉ số vận hành cốt lõi:

- **Chapter & Stage** (Tên chương & Màn): Hiển thị vị trí chương/màn hiện tại (ví dụ: Chapter 3 - Stage 13: Quảng trường nước).
- **Bộ đếm thời gian** (⏳ Timer): Đồng hồ đếm ngược từ 05:00 phút cho mỗi màn chơi, chuyển sang màu đỏ cảnh báo khi còn dưới 01:00.
- **Năng lượng dùng chung** (⚡ Team Energy): Thanh năng lượng toàn đội (ví dụ: 85/100), tụt dần khi kích hoạt kỹ năng, tương tác tốn sức hoặc trả lời sai ngữ pháp/từ vựng.
- **Điểm kỹ năng** (🏆 Skill Pts): Điểm kỹ năng tích lũy của phòng chơi, quyết định điều kiện mở khóa các màn chơi tiếp theo.


## 2. Khung nhìn trung tâm & Bảng nhiệm vụ (Viewport & Mission Tracker)

### Khung nhìn 2.5D Isometric (Chính giữa)

- Góc camera nghiêng 45 độ chuẩn chiến thuật thời gian thực (RTS).
- Hỗ trợ click chuột để di chuyển nhân vật hoặc tương tác với môi trường tàn tích Atlantis.
- Hiệu ứng sương mù biển (Fog of War) che khuất các khu vực chưa thám hiểm.
- Vòng tròn sáng ma thuật dưới chân để phân biệt 4 nhân vật (Leo: Xanh dương, Maya: Tím, Sam: Vàng, Jade: Xanh lá).

### Bảng theo dõi nhiệm vụ (Góc trên bên phải)

- Gồm 4 nhiệm vụ tuần tự của màn chơi kèm trạng thái hoàn thành: [x] Đã xong / [ ] Đang thực hiện.
- Hiển thị tiến độ thu thập Mảnh bản đồ tổng quát (12/30 Shards).
- Phím tắt Tab cho phép thu gọn/mở rộng bảng để không che tầm nhìn chiến thuật.

## 3. Bảng điều khiển đáy (Bottom Dashboard - 3 Khối chuẩn AOE)

### Khối 1: Khung tương tác NPC / Đối tượng (Bên trái)

- **Khung chân dung động (Portrait):** Thể hiện hình ảnh 3D/2D chuyển động của NPC đang giao tiếp (Linh hồn Atlantis, Robot bảo an, Thần hộ vệ, hoặc Bot đồng đội).
- **Tên & Lời thoại ngắn:** Hiển thị danh tính NPC và câu nói trực tiếp tóm lược tình huống hiện tại.
- **Chỉ số trạng thái:** Thanh đo mức độ kiên nhẫn/thái độ của NPC (khi thực hiện đàm phán, thuyết phục bằng tiếng Anh).

### Khối 2: Bảng điều khiển Anh ngữ (English Console - Trung tâm)

Trung tâm vận hành cơ chế Play to Learn, tích hợp đầy đủ 4 kỹ năng ngôn ngữ:

- **Luyện Nghe** (🔊 Listen): Nhấn để nghe giọng đọc bản xứ từ NPC hoặc gợi ý âm thanh; hỗ trợ chỉnh tốc độ phát âm (1.0x, 0.8x).
- **Luyện Nói** (🎤 Hold to Speak): Giữ phím Spacebar hoặc click giữ icon Micro để phát âm câu thoại/khẩu lệnh; hệ thống AI chấm điểm ngữ điệu và độ chuẩn thời gian thực.
- **Luyện Đọc & Viết** (Text Input): Ô nhập văn bản `> Input command: [ ... ]` dùng để điền từ khuyết, gõ câu lệnh giải đố, hoặc nhập tọa độ/mật mã kỹ thuật.
- **Khung ngữ pháp hỗ trợ:** Hiển thị thẻ gợi ý cấu trúc ngữ pháp tương ứng với cấp độ màn chơi (Easy: Imperatives/Present Simple, Medium: Passive/Conditionals, Hard: Inversion/Cleft sentences).

### Khối 3: Bảng hành động & Kỹ năng (Action Grid - Bên phải)

Lưới các ô kỹ năng với phím tắt nhanh (Q, W, E, R), thay đổi linh hoạt theo nhân vật người chơi đang điều khiển:

| Phím tắt | Nhân vật / Kỹ năng | Thao tác tương tác trong game |
| ---------| ------------------ | ------------------------------|
| [Q]      | Leo (The Guardian) | Đẩy tảng đá lớn, giương khiên chắn quái vật/sóng chấn động. |
| [W]      | Maya (The Scholar) | Dịch văn tự cổ trên bia đá, phát hiện bẫy sàn ngầm. |
| [E]      | Sam (The Fixer)    | Sửa chữa đường ống/máy móc, hack bảng điều khiển Orichalcum. |
| [R]      | Jade (The Wraith)  | Bắn súng móc neo vượt vực, lén lút vượt qua tầm nhìn quái thú. |

## 4. Bảng màu & Phong cách thiết kế Atlantis

| Thành phần giao diện | Mã màu / Chất liệu | Ý nghĩa thị giác |
| ---------------------| ------------------ | ---------------  |
| Khung viền Dashboard | Đá phiến nứt ngập nước (#102229) | Mô phỏng phong cách bảng điều khiển cổ điển của Age of Empires. |
| Họa tiết & Phím bấm  | Kim loại vàng Orichalcum (#D4AF37) | Ánh kim cổ đại đặc trưng của nền văn minh huyền thoại Atlantis. |
| Đèn tín hiệu Micro / Text | Xanh ngọc phát quang (#00F0FF) | Tạo cảm giác công nghệ ma thuật cổ đại, rõ nét dưới nền tối đáy biển. |
| Cảnh báo lỗi / Nguy hiểm | Đỏ san hô chớp sáng (#FF3B30) | Cảnh báo sai ngữ pháp, cạn bình dưỡng khí hoặc quái vật thức tỉnh. |
# **VITAMINFUN — MASTER SYSTEM SPECIFICATIONS & ARCHITECTURE**

**Tài liệu:** Master Specifications (PRD \+ TDD \+ Game Economy \+ Narrative Design & Learning Metrics)  
**Phiên bản:** 2.0.0 (Bản hợp nhất Kỹ thuật & Sư phạm)  
**Role:** Senior Software Architect, EdTech Product Lead & Game Designer  
**Trạng thái:** Approved Baseline (Single Source of Truth \- SSOT)

## **MỤC LỤC**

> 1. TỔNG QUAN DỰ ÁN & PRODUCT REQUIREMENTS (PRD)  
> 2. HỆ THỐNG GAMEPLAY & THIẾT KẾ CỐT TRUYỆN (NARRATIVE DESIGN)  
> 3. KHUNG NĂNG LỰC STEALTH LEARNING & LỘ TRÌNH NỘI DUNG (LEVEL MATRIX)  
> 4. KIẾN TRÚC KỸ THUẬT TOÀN HỆ THỐNG (TECHNICAL ARCHITECTURE)  
> 5. CƠ SỞ DỮ LIỆU & DATA SCHEMAS (ERD & JSON SPECS)  
> 6. MÔ HÌNH KINH TẾ (GAME ECONOMY & UNIT ECONOMICS)  
> 7. PHÂN TÍCH CHI PHÍ AI & BỘ PHÒNG VỆ CHI PHÍ (COST SAFEGUARDS)  
> 8. HỆ THỐNG ĐO LƯỜNG SƯ PHẠM & KPIs (LEARNING METRICS)  
> 9. NỀN TẢNG UGC & LỘ TRÌNH TRIỂN KHAI (ROADMAP)

## **1\. TỔNG QUAN DỰ ÁN & PRODUCT REQUIREMENTS (PRD)**

| VITAMINFUN PRODUCT VISION Biến việc học ngoại ngữ thành một tựa game nhập vai thực thụ, nơi tiếng Anh là công cụ sinh tồn và vượt ải. Kết hợp cùng một nhóm bạn thân thuộc, một thế giới bí ẩn mới và những quyết định mang tính hậu quả. Yếu tố học thuật được ẩn giấu hoàn toàn. |
| ----- |

### **1.1. Mục tiêu & Định vị**

> * **Đối tượng mục tiêu:** Học sinh, sinh viên, người trẻ từ 12 – 25 tuổi (Gen Z & Gen Alpha).  
> * **Vấn đề cốt lõi:** Các ứng dụng học tiếng Anh hiện tại thiên về học thuật, khiến người học nhanh nản sau 14–30 ngày.  
> * **Giải pháp đột phá:** Game nhập vai thế giới mở chia theo Map/Stage. Trẻ phải dùng tiếng Anh để lấy thông tin, thuyết phục, quyết định và làm thay đổi thế giới trong game (world state).  
> * **Phần thưởng:** Hoàn thành nhiệm vụ nhận điểm đổi Voucher sách thật tại Fahasa, Phương Nam.

### **1.2. Chân dung Nhân vật (Cast \- The 47 Club)**

Hệ thống sử dụng tổ đội 4 vai trò (có thể là NPC đồng hành hoặc chế độ Co-op), mỗi vai trò nắm giữ một mảnh ghép thông tin:

> * **ALEX (Pattern Hunter):** Giỏi ghép mẫu và timeline, nhưng sợ nói sai và thường giữ giả thuyết quá lâu.  
> * **MAYA (Bridge Builder):** Chuyên phỏng vấn và thương lượng, nhưng hay né xung đột và hứa quá nhiều.  
> * **LEO (Maker/Operator):** Hành động nhanh và thử nghiệm quy luật, nhưng bốc đồng.  
> * **NORA (Skeptic/Archivist):** Giữ Passport, kiểm tra nguồn tin, nhưng hay hoài nghi và khó tin người.  
> * **Cast Rule:** Không có thám tử thiên tài giải quyết mọi thứ. Mỗi tập khóa đáp án sau 4 đóng góp khác nhau, buộc các vai phải tương tác.

## **2\. HỆ THỐNG GAMEPLAY & THIẾT KẾ CỐT TRUYỆN (NARRATIVE DESIGN)**

### **2.1. 10 Nguyên tắc Thiết kế Màn chơi (Core Rules)**

> * **English changes world state:** Ít nhất 3 hành động ngôn ngữ làm mở gợi ý (clue), đổi phản hồi của NPC hoặc kết quả; không thể thắng chỉ bằng click.  
> * **Một tập \= một câu hỏi đóng:** Câu hỏi của tập được trả lời ở cuối để tạo cảm giác hoàn tất, dù cốt truyện chính (metaplot) còn mở.  
> * **Familiar crew, new wonder:** Giữ nguyên nhóm nhân vật và cốt lõi lối chơi, chỉ đổi quy luật thế giới và hiện tượng.  
> * **Mystery công bằng:** Gợi ý thật phải xuất hiện trước khi giải mã, không dùng thông tin giấu ngoài game.  
> * **Information asymmetry:** Mỗi vai giữ gợi ý khác nhau, buộc phải hỏi hoặc tóm tắt cho đồng đội ít nhất 2 lần.  
> * **Meaningful choice:** Phải có ít nhất 2 phương án có lợi-hại, buộc phải nêu lý do trước khi quyết định, không có đáp án đạo đức tuyệt đối.  
> * **Passport remembers:** Lựa chọn sẽ được ghi vào Passport và có tác động thật trong 1-3 tập sau (ví dụ: đổi tuyến đường, giá cả, hoặc độ tin cậy).  
> * **Grammar serves intent:** Mỗi tập tích hợp 1 chức năng giao tiếp và 1-2 trọng tâm ngữ pháp, lặp lại tự nhiên 5-8 lượt.  
> * **Difficulty \= cognition \+ language:** Level cao hơn do gợi ý mơ hồ và quyết định khó khăn hơn, không chỉ do câu dài hơn.  
> * **Cliffhanger trả thưởng:** Cuối tập trả lời bí ẩn hiện tại trước, sau đó mới hé lộ gợi ý cho cốt truyện lớn trong 10-20 giây.

### **2.2. Cấu trúc Chuẩn một Tập (Episode Beat 20-30 phút)**

> * **Phút 0-2 (Cold open / Wonder):** Hiện tượng lạ xuất hiện cùng câu hỏi tập.  
> * **Phút 2-6 (Private clues):** 4 vai nhận thông tin không trùng nhau.  
> * **Phút 6-14 (Investigation):** Hỏi NPC, kiểm chứng, sửa hiểu lầm bằng Voice AI.  
> * **Phút 14-18 (False solution):** Giải pháp đầu thất bại do hiểu sai luật.  
> * **Phút 18-24 (Decision room):** Ghim bằng chứng, tranh luận, nêu lý do và chốt phương án.  
> * **Phút 24-27 (Consequence \+ reveal):** Thế giới thay đổi, Passport ghi nhận hậu quả, đáp án lộ diện.  
> * **Phút 27-28 (Metaplot sting):** Một chi tiết cũ mang ý nghĩa mới, tạo sự tò mò.

## **3\. KHUNG NĂNG LỰC STEALTH LEARNING & LỘ TRÌNH NỘI DUNG**

### **3.1. Ma trận Phát triển 3 Level (Level Matrix)**

> * **A1–A2 (THE LOST SIGNS):**  
  * **Cốt truyện:** Các biển chỉ dẫn biến mất, mỗi thế giới có một luật đơn giản. "Quái vật" lấy biển thực ra đang cứu người khỏi biển báo sai.  
  * **Kỹ năng & Ngữ pháp:** An toàn, chỉ đường, yêu cầu giúp đỡ. Dùng Present simple/continuous, can/must, imperatives.  
  * **Passport:** Lưu người đã giúp, vật đã chia sẻ, tuyến đường đã mở.  
> * **B1–B2 (ATLAS WITHOUT WORDS):**  
  * **Cốt truyện:** Tên địa điểm và khái niệm biến mất, Atlas chỉ nhận ý nghĩa đã được chứng minh.  
  * **Kỹ năng & Ngữ pháp:** Tư duy phản biện, kiểm tra nguồn tin, thương lượng. Dùng Question forms, narrative tenses, reported speech, passive.  
  * **Passport:** Lưu lại Độ tin cậy (Trust), Nghĩa vụ (Obligation), Tuyến đường và Định nghĩa.  
> * **C1–C2 (THE WAR OF DEFINITIONS):**  
  * **Cốt truyện:** Không mất chữ mà mất ý nghĩa thống nhất, hai hồ sơ trái ngược nhau đều hợp lệ.  
  * **Kỹ năng & Ngữ pháp:** Tư duy hệ thống, đạo đức, thương lượng liên văn hóa. Dùng Hedging, advanced reporting, inversion, mixed conditionals.  
  * **Passport:** Lưu định nghĩa và tiền lệ pháp lý, thay đổi luật của mọi thế giới theo lịch sử quyết định.

### **3.2. Tiêu chí Chấm điểm Tương tác (Voice AI Rubric)**

Mỗi tương tác được chấm từ 0-100 điểm dựa trên:

> * **Task Completion (40%):** Hoàn thành mục tiêu giao tiếp.  
> * **Fluency & Pronunciation (30%):** Trôi chảy và phát âm từ khóa.  
> * **Grammar Accuracy (15%):** Cấu trúc câu theo ngữ cảnh.  
> * **Vocabulary & Relevance (15%):** Đúng từ vựng chủ đề, không lan man.

## **4\. KIẾN TRÚC KỸ THUẬT TOÀN HỆ THỐNG (TECHNICAL ARCHITECTURE)**

### **4.1. Hệ thống Kiến trúc Cốt lõi**

> * **Client Layer:** Dùng Flutter \+ Flame / 2D Canvas (Phaser.js / PixiJS) kết hợp Smart VAD.  
> * **API Gateway:** Dùng Envoy / NGINX / Cloudflare cùng Redis Token Bucket Rate Limiter.  
> * **Quest Engine:** Dùng NestJS / Go State Machine quản lý tiến trình chơi và trạng thái thế giới (World-state engine).  
> * **AI Orchestration Pipeline:** Dùng WebSocket streaming kết nối Deepgram STT → Gemini 2.0 Flash → Kokoro/Azure TTS.  
> * **Economy & Commerce:** Microservice quản lý Ví Xu, Subscription và Cổng Voucher O2O.  
> * **Data Storage:** Dùng PostgreSQL cho Core Data, Redis Cluster cho Live Sessions, và S3 cho Assets/Audio.

### **4.2. Modules Yêu cầu Kỹ thuật Đặc thù (Dành cho P0 / MVP)**

> * **4-role private view:** Mỗi người chơi chỉ thấy gợi ý và quyền hạn của vai mình.  
> * **Dialogue/action validator:** P0 ưu tiên dùng lựa chọn câu, keyword/meaning intent, không phụ thuộc hoàn toàn vào generative AI/ASR. Đúng intent thì thay đổi world state, sai/thiếu thì đưa ra gợi ý sửa chữa (repair prompt) chứ không kết thúc game (game-over).  
> * **Evidence board & Decision room:** Pin gợi ý, tranh luận, không cho chốt phương án nếu thiếu bằng chứng và lý do.  
> * **World-state engine (Deterministic):** Cùng một input/state phải ra cùng output để QA có thể replay được.

## **5\. CƠ SỞ DỮ LIỆU & DATA SCHEMAS (ERD & JSON SPECS)**

### **5.1. Sơ đồ Quan hệ Thực thể Bổ sung (ERD)**

| users id (PK) email role | user\_wallets id (PK) user\_id (FK) xu\_balance | passports id (PK) user\_id (FK) saved\_trust |
| ----- | ----- | ----- |
| **quest\_logs** id (PK) user\_id (FK) stage\_id (FK) | **stages** id (PK) goal\_rubric target\_grammar | **evidence\_board** id (PK) pinned\_clues decision\_log |

### **5.2. Single-Call AI Optimization & API Response**

```json
{
  "npc_dialogue": "Good choice! Two bottles of water and a box of matches will be 5 dollars.",
  "assessment": {
    "task_completed": true,
    "score": 85,
    "feedback": "Phát âm từ 'matches' rất chuẩn."
  },
  "quest_progress": { "bought_water": true, "bought_matches": true },
  "passport_update": { "trust_gained": 10, "consequence_flag": "bought_supplies" },
  "next_state": "CHECKOUT"
}
```

## **6\. MÔ HÌNH KINH TẾ (GAME ECONOMY & UNIT ECONOMICS)**

Hệ thống sử dụng cơ chế Dual-Currency Tokenomics:

> * **Xu Năng Lượng (Energy Currency):** Tiêu hao 10 Xu / 1 câu thoại AI. Free User nhận 100 Xu/ngày, VIP User nhận 400 Xu/ngày. Có thể mua thêm qua IAP để tiếp tục chơi khi hết Xu.  
> * **Điểm Thành Tựu (V-Points):** Thưởng khi vượt màn điểm cao (≥80) và duy trì chuỗi Streak. Dùng để đổi Voucher quà tặng sách thật tại nhà sách đối tác (Fahasa / Phương Nam) hoặc trang phục trong game.

## **7\. PHÂN TÍCH CHI PHÍ AI & BỘ PHÒNG VỆ CHI PHÍ (COST SAFEGUARDS)**

> * **Chi phí 1 Turn đối thoại:** Sử dụng Deepgram, Gemini 2.0 Flash và Kokoro/Azure TTS, tổng chi phí khoảng $0.000502 USD (\~13 VNĐ).  
> * **Monthly Unit Economics (Gói VIP 99.000 VNĐ):** Sau khi trừ phí App Store (15%), chi phí AI (360 turns), server, và quỹ Voucher (10%), Lợi nhuận gộp (Gross Margin) đạt khoảng 67.6%.  
> * **Bộ phòng vệ chi phí:**  
  * **Hết Xu Năng Lượng:** Chuyển sang chơi các màn "Non-AI Gameplay" miễn phí phí API (Reading, Mini-game logic) hoặc mua thêm IAP.  
  * **Bấm Mic nói quá dài:** Có đồng hồ đếm ngược cốt truyện ("Bộ đàm sắp hết pin"). Hệ thống kỹ thuật tự động ngắt thu âm ở giây thứ 12, cắt STT Input ở 40 từ và hủy gói tin nếu im lặng ≥ 1.5s.

## **8\. HỆ THỐNG ĐO LƯỜNG SƯ PHẠM & KPIs (LEARNING METRICS)**

Giai đoạn Pilot (thử nghiệm) sẽ đánh giá dựa trên tối thiểu 24–40 trẻ chơi 4 tập liên tiếp. Đây không phải app luyện ngữ pháp khoác vỏ bọc phiêu lưu, việc đo lường phải phản ánh sự tương tác ngôn ngữ.

### **8.1. KPI Engagement & Retention**

> * **Episode Completion Rate (Tỷ lệ hoàn thành tập):** Mục tiêu Xanh ≥ 85%, Đỏ \< 70%.  
> * **English Bypass Rate (Tỷ lệ thắng mà không cần Tiếng Anh):** Mục tiêu Xanh ≤ 10%, Đỏ \> 20%. (Lưu ý: Tỷ lệ giữ chân cao nhưng English bypass cao là thất bại sản phẩm).  
> * **Repair Success (Tỷ lệ sửa hiểu lầm thành công):** Mục tiêu Xanh ≥ 65%, Đỏ \< 45%.  
> * **Decision Quality (Quyết định có bằng chứng \+ lý do):** Mục tiêu Xanh ≥ 75%.  
> * **Voluntary Next-session Intent (Muốn chơi tiếp tập sau):** Mục tiêu Xanh ≥ 80%.

### **8.2. Learning Guardrails (Lan can Bảo vệ Học tập)**

> * **Function transfer:** ≥ 60% trẻ dùng chức năng giao tiếp cũ trong bối cảnh mới ở tập sau (Đo học thật, không phải học vẹt).  
> * **Role equity:** Phân bổ lượt chơi công bằng (P90/P10 ≤ 3.0), không để một trẻ giỏi chơi hộ cả đội.  
> * **Target-form opportunity:** Mỗi trẻ có 5-8 cơ hội có ý nghĩa/tập, không biến game thành một bài tập điền từ.  
> * **Quy tắc quyết định sau Pilot:** Sẽ STOP hoặc REDESIGN CORE LOOP nếu gặp 2 KPI lõi ở mức Đỏ (Completion, English Bypass, Intent), không dùng Coin/Streak để cố cứu vãn.

## **9\. NỀN TẢNG UGC & LỘ TRÌNH TRIỂN KHAI (ROADMAP)**

> * **Phase 1: MVP & Pilot Pilot (Tháng 1 \- 2\)**  
  * Xây dựng lõi cơ bản với cấu trúc Deterministic world-state, Validation qua Intent/Keyword và tính năng Passport Lite.  
  * Hoàn thiện Voice Pipeline (độ trễ ≤ 1.2s).  
  * Chạy Pilot kín với 24-40 học viên, tuân thủ nghiêm ngặt các KPI đo lường sư phạm (Đảm bảo English Bypass Rate ≤ 10%).  
> * **Phase 2: Retention & Economy (Tháng 3 \- 4\)**  
  * Tích hợp Game Economy (Ví Xu, V-Points) và mở cổng Voucher O2O tại Fahasa/Phương Nam.  
  * Phát triển các tập tiếp theo dựa trên dữ liệu lưu trữ từ Passport của người chơi.  
> * **Phase 3: UGC Platform & Generative Expansion (Tháng 5 \- 6\)**  
  * Ra mắt Creator Studio với giao thức Prompt-to-Quest và mô hình chia doanh thu 70% cho Creator, 30% cho nền tảng.  
  * Quét nội dung độc hại qua Llama Guard và mở rộng hệ thống màn chơi Tiếng Trung (HSK).
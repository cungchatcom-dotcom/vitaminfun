## Overview

- Concept xuyên suốt dự án: Play to Learn (Chơi để Học)
- Loại kiến thức (Learning): phân loại kiến thức mà người chơi sẽ học như Ngôn ngữ hay Kĩ năng
    - Ngôn ngữ (language): tiếng Anh, tiếng Trung,..
    - Kiến thức & Kĩ năng (knowledge skills): Kĩ năng sống, Nấu ăn, Âm nhạc,..
- Cơ chế: giống game online nhập vai tương tác realtime với người chơi và NPC. Có thể học/chơi một mình (Single) hoặc theo nhóm (Multiplayer), tối đa 4 người trong 1 phòng.
- Phương pháp học: NPC hướng dẫn & dạy, người chơi thực hiện theo các nhiệm vụ trong game để qua đó học được các kiến thức & kĩ năng thực tế.
- Cấu trúc phân cấp: World → Chapter → Stage → Task
- Ngôn ngữ (system language): mỗi World sẽ chọn được ngôn ngữ người chơi và ngôn ngữ NPC nếu kiến thức là học ngôn ngữ.
- Tương tác giao tiếp trong game (communication): mọi tương tác sẽ diễn ra trên thanh Chat.
- Hệ thống điểm: mỗi world sẽ có hệ thống điểm riêng, nhưng phải tuân theo nguyên tắc thiết kế chung.
- Túi đồ: gồm 2 ngăn:
    - Ngăn Kiến thức: chứa các kiến thức mà người chơi cần thu về để luyện lại mỗi khi cần.
    - Ngăn vật phẩm: chứa các vật phẩm mà người chơi thu được qua mỗi màn chơi.
- Phí: để mở khóa mỗi World, người chơi phải nạp Xu, mỗi World có giá Xu khác nhau. Trong quá trình chơi, một số hành động tốn AI token có thể bị tính Xu, ví dụ như STT, Dịch, Đánh giá kết quả bài thi,..

# Người chơi & Nhập vai
- Người chơi nhập vai vào một trong các nhân vật được định nghĩa sẵn trong World.
- Trước mỗi màn chơi, người chơi được chọn nhập vai vào các nhân vật mình thích.
- Mỗi nhân vật chỉ được 1 người chơi chọn: khi một người chọn nhân vật nào, hệ thống khóa (lock) nhân vật đó lại, người chơi khác trong cùng phòng buộc phải chọn nhân vật còn trống khác.
- Nếu phòng thiếu người (không đủ người chọn hết các nhân vật), người chơi vẫn vào màn chơi bình thường nhưng phải đảm nhận thêm nhiệm vụ của (các) nhân vật còn trống.

# World
- Mỗi World sẽ yêu cầu người chơi phải tìm được Vật phẩm chính để chiến thắng. Vật phẩm chính được ghép lại từ các mảnh Vật phẩm. Ví dụ: Lost in Atlantis có vật phẩm chính là "Mảnh bản đồ", nó được ghép lại từ 30 mảnh bản đồ có số thứ tự khác nhau.
    - Trong World có các Chương
        - Trong Chương có các Màn chơi
            - Trong màn chơi có các Nhiệm vụ
- Vượt qua màn chơi sẽ được tặng Mảnh vật phẩm
- Ghép các mảnh vật phẩm để có Vật phẩm chính 

# Vật phẩm
- Mỗi world sẽ có một loại vật phẩm chính khác nhau. 
- Vật phẩm chính: khi ghép lại các mảnh vật phẩm theo đúng thứ tự để mở khóa vật phẩm chính. 
- Mảnh vật phẩm: Người chơi sẽ nhận được các mảnh vật phẩm khi chiến thắng mỗi màn chơi
- Khi chiến thắng mỗi màn chơi, người chơi sẽ nhận Vật phẩm của màn chơi đó. Ví dụ với Lost in Atlantis, khi chiến thắng màn chơi số 5 thì người chơi sẽ nhận được một mảnh bản đồ số 5.
- Trong chế độ Multiplayer, nếu cả đội chiến thắng thì tất cả thành viên trong phòng đều nhận Mảnh vật phẩm như nhau; riêng Điểm kinh nghiệm thì mỗi người nhận khác nhau, tính theo công thức cá nhân (xem mục Hệ thống điểm).

# Màn chơi (Stage)
- Mỗi màn chơi sẽ cấp cho người chơi điểm năng lượng & thời gian.
- Chiến thắng: khi hoàn thành mọi nhiệm vụ trong thời gian cho phép của màn chơi. Điều kiện thời gian là tiên quyết — hết thời gian mà chưa xong nhiệm vụ thì tính là thua và phải chơi lại từ đầu màn.
- Điểm năng lượng chỉ mang tính hỗ trợ: dùng hết năng lượng không làm thua màn chơi, người chơi chỉ mất quyền dùng các hành động trợ giúp (Dịch, nghe lại, xem hint,...) và phải tự vượt qua nhiệm vụ bằng khả năng của mình.
- Nếu khó quá mà mãi không vượt qua được màn, người chơi có thể rủ bạn bè cùng vào chơi màn đó ngay từ đầu (chế độ Multiplayer) để hỗ trợ qua màn — không mời bạn tham gia giữa chừng một lượt chơi đang diễn ra được.
- Chơi một mình (Single Player): người chơi phải hoàn thành hết các nhiệm vụ mà không có sự hỗ trợ từ người chơi khác.
- Chơi nhóm (Multiplayers): người chơi cùng nhau hoàn thành các nhiệm vụ.

## Hệ thống điểm: 
- Mỗi World có thể thiết kế hệ thống điểm riêng, nhưng phải dùng chung nguyên tắc trên toàn bộ dự án.
- Loại điểm mặc định: 
    - Điểm kinh nghiệm (Experience point): người chơi sẽ thu được Điểm kinh nghiệm sau mỗi màn chơi, tính riêng cho từng cá nhân (kể cả khi chơi Multiplayer). Điểm này cũng dùng làm điều kiện truy cập màn chơi. Điểm này chỉ tăng chứ không giảm.
        - Công thức tính Điểm kinh nghiệm cá nhân sau mỗi màn chơi (chỉ áp dụng khi chiến thắng màn chơi):
          `Exp = (Số nhiệm vụ cá nhân hoàn thành × Điểm/nhiệm vụ × Hệ số độ khó) + (Tỉ lệ thời gian còn lại × Điểm thưởng thời gian tối đa) + (Tỉ lệ năng lượng còn lại × Điểm thưởng năng lượng tối đa)`
          - Hệ số độ khó: bảng quy đổi theo độ khó màn chơi, ví dụ Easy = 1, Medium = 2, Hard = 3 (World có thể tùy chỉnh giá trị nhưng giữ 3 bậc).
          - Tỉ lệ thời gian còn lại = (Giới hạn thời gian − Thời gian đã dùng) / Giới hạn thời gian, tính đến lúc cá nhân đó hoàn thành nhiệm vụ cuối cùng.
          - Tỉ lệ năng lượng còn lại = Năng lượng còn lại / Năng lượng ban đầu được cấp.
          - Mỗi thành phần trong công thức đều là điểm thưởng không âm (không có phép trừ trực tiếp) — đảm bảo Điểm kinh nghiệm luôn ≥ 0, khớp nguyên tắc "chỉ tăng chứ không giảm".
          - "Điểm/nhiệm vụ" và 2 mức "Điểm thưởng tối đa" là hằng số World tự tùy chỉnh (theo mục dưới), cấu trúc công thức thì cố định chung cho toàn dự án.
    - Điểm năng lượng (Energy point): Giống cơ chế của Blood, điểm năng lượng được cấp cho người chơi lúc vào game để người chơi sử dụng. Đây là điểm mang tính hỗ trợ (dùng cho các hành động trợ giúp như Dịch, nghe lại,...); dùng hết năng lượng không khiến màn chơi thất bại, chỉ khiến người chơi mất quyền dùng các hành động trợ giúp đó.
- Nhà thiết kế game có thể tùy chỉnh các thuộc tính điểm theo World nhưng không thêm được loại điểm.
    - Tên loại điểm điểm: ví dụ Nhà thiết kế game "Điểm kinh nghiệm" có thể được đổi thành "Điểm chiến lực"
    - icon loại điểm điểm: Nhà thiết kế game có thể đổi sang icon khác tùy ý.
    - số điểm mỗi hành động (cộng hoặc trừ số điểm tương ứng với mỗi hành động của người chơi): ví dụ Nhà thiết kế game có thể tùy chỉnh hành động A có thể tốn X điểm, hành động B có thể tốn Y điểm,...

## Thanh Chat
- Có nhiều hình thức tương tác trong thanh chat:
    - NPC: 
        - Nói: phát ra loa đoạn âm thanh ghi âm ẵn
        - Viết: hiển thị text
        - Dịch: dịch text mà NPC nói sang ngôn ngữ của người chơi
        - Đọc: đọc text mà người chơi nhập
        - Nghe: nghe voice từ người chơi, speech to text
    - Người chơi: 
        - Nghe: nghe âm thanh voice mà NPC nói
        - Đọc: đọc text mà NPC viết ra 
        - Viết: gõ text vào ô chat
        - Nói: thu âm vào mic
        - Chọn đáp án: bấm chọn đáp án trắc nghiệm mà NPC đưa ra để trả lời.

## Thiết bị (device)
- Hỗ trợ người dùng sử dụng trên web, điện thoại và máy tính bảng

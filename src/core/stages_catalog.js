/**
 * stages_catalog.js
 * Danh mục toàn bộ 5 Chương và 30 Màn chơi của World 1: Lost in Atlantis
 * Dữ liệu bám sát tài liệu đặc tả: docs/LOST IN ATLANTIS_Lạc vào vương quốc huyền thoại.md
 */

export const CHAPTERS_DATA = [
  {
    id: 1,
    number: "Chương 1",
    title: "Sự cố dưới đáy biển",
    subtitle: "Hang động biển sâu & Lối vào Atlantis",
    description: "Nhóm bạn bị đắm tàu, rơi vào hang động biển sâu và phát hiện ra lối vào Atlantis.",
    icon: "🌊",
    stageRange: [1, 6],
    themeColor: "#00f0ff",
    bannerImage: "./assets/backgrounds/chapter_1.jpg"
  },
  {
    id: 2,
    number: "Chương 2",
    title: "Ngoại ô Thành phố Thủy tinh",
    subtitle: "Tàn tích & Vườn sinh học cổ",
    description: "Khám phá những tàn tích, khu vườn sinh học ngoài rìa hoàng cung huyền thoại.",
    icon: "🌿",
    stageRange: [7, 12],
    themeColor: "#27ae60",
    bannerImage: "./assets/backgrounds/chapter_2.jpg"
  },
  {
    id: 3,
    number: "Chương 3",
    title: "Đô thị cổ Hoàng gia",
    subtitle: "Kiến trúc vĩ đại & Cạm bẫy cổ",
    description: "Tiến vào trung tâm Atlantis, nơi có kiến trúc vĩ đại nhưng đầy rẫy cạm bẫy bí ẩn.",
    icon: "🏛️",
    stageRange: [13, 18],
    themeColor: "#9b51e0",
    bannerImage: "./assets/backgrounds/chapter_3.jpg"
  },
  {
    id: 4,
    number: "Chương 4",
    title: "Tháp Chúa Trời & Năng lượng Gốc",
    subtitle: "Lõi Orichalcum Thượng Cổ",
    description: "Leo lên ngọn tháp cao nhất, nơi nắm giữ lõi năng lượng của toàn bộ lục địa.",
    icon: "⚡",
    stageRange: [19, 24],
    themeColor: "#d4af37",
    bannerImage: "./assets/backgrounds/chapter_4.jpg"
  },
  {
    id: 5,
    number: "Chương 5",
    title: "Cuộc đua với Thời gian",
    subtitle: "Atlantis sụp đổ & Cánh cổng trở về",
    description: "Hệ thống tự hủy kích hoạt, Atlantis sụp đổ. Chạy đua tìm đường mở Cánh cổng Thời gian trở về nhà.",
    icon: "⏳",
    stageRange: [25, 30],
    themeColor: "#ff3b30",
    bannerImage: "./assets/backgrounds/chapter_5.jpg"
  }
];

export const STAGES_CATALOG = [
  // ===================== CHƯƠNG 1 (Màn 1 - 6) =====================
  {
    id: 1,
    chapterId: 1,
    stageNumber: 1,
    title: "Cơn bão bất ngờ",
    story: "Nhóm bạn điều khiển thuyền vượt qua giông bão dữ dội, tàu bị lật chìm xuống biển sâu.",
    difficulty: "Easy",
    minCombatPower: 0,
    advisor: {
      name: "Thuyền trưởng Drake",
      role: "Thuyền trưởng mẫu mực",
      avatar: "./assets/portraits/leo.jpg",
      advice: "Giữ vững bánh lái, phản xạ nhanh với hiệu lệnh hướng gió và kiểm tra ngay hòm cứu sinh!"
    },
    skills: ["Nghe", "Nói", "Đọc", "Viết"],
    tasks: [
      { id: "task_1", title: "Hạ buồm đón gió", skill: "Nghe & Nói", desc: "Nghe hiệu lệnh hướng gió từ Thuyền trưởng Drake và Nói phản hồi xác nhận điều khiển tời buồm." },
      { id: "task_2", title: "Gia cố thân tàu nứt", skill: "Đọc & Viết", desc: "Đọc hướng dẫn khắc phục sự cố trên sổ tay kỹ thuật và Viết tên công cụ sửa chữa." },
      { id: "task_3", title: "Định vị phao cứu sinh", skill: "Nghe & Nói", desc: "Nghe cảnh báo radar và Nói mô tả vị trí phát sáng của đèn khẩn cấp cho hoa tiêu." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 1", skill: "Đọc & Viết", desc: "Đọc câu đố gợi ý trên khóa hòm cứu nạn và Viết từ khóa giải mã." }
    ],
    shardRewardId: 1
  },
  {
    id: 2,
    chapterId: 1,
    stageNumber: 2,
    title: "Hang bong bóng",
    story: "Tỉnh dậy trong hang động ngầm, học cách di chuyển trong môi trường bọt khí và nhặt nhu yếu phẩm trôi dạt.",
    difficulty: "Easy",
    minCombatPower: 60,
    advisor: {
      name: "Tinh linh bóng khí Sylph",
      role: "Người dẫn đường hang ngầm",
      avatar: "./assets/portraits/maya.jpg",
      advice: "Hãy chú ý chu kỳ phát quang của chuỗi san hô để giữ nhịp thở ổn định."
    },
    skills: ["Nghe", "Nói", "Đọc", "Viết"],
    tasks: [
      { id: "task_1", title: "Tạo chuỗi bóng khí thở", skill: "Nghe & Nói", desc: "Nghe Tinh linh hướng dẫn nhịp phát quang và Nói khẩu lệnh kích hoạt chuỗi san hô." },
      { id: "task_2", title: "Nhặt nhu yếu phẩm trôi dạt", skill: "Đọc & Nói", desc: "Đọc nhãn phân loại túi cứu thương và Nói báo cáo tình trạng tồn kho." },
      { id: "task_3", title: "Dọn lối thoát ngầm", skill: "Đọc & Viết", desc: "Đọc văn tự cảnh báo trên tảng đá và Viết mật lệnh làm suy yếu khớp đá." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 2", skill: "Đọc & Nói", desc: "Đọc câu đố vách hang và Nói giải thích ý nghĩa câu thơ cổ để nhận mảnh bản đồ." }
    ],
    shardRewardId: 2
  },
  {
    id: 3,
    chapterId: 1,
    stageNumber: 3,
    title: "Ánh sáng kỳ lạ",
    story: "Giải mã các khối đá phát quang huyền bí để mở lối đi tiến sâu vào lòng đất Atlantis.",
    difficulty: "Easy",
    minCombatPower: 130,
    advisor: {
      name: "Người gác hang Kael",
      role: "Hộ vệ cổ xưa",
      avatar: "./assets/portraits/sam.jpg",
      advice: "Mỗi màu sắc tinh thể tương ứng với một tần số năng lượng riêng biệt."
    },
    skills: ["Nghe", "Nói", "Đọc", "Viết"],
    tasks: [
      { id: "task_1", title: "Thu thập 4 tinh thể phát quang", skill: "Nghe & Nói", desc: "Nghe mô tả đặc tính màu sắc/vị trí từng viên đá và Nói phân công vị trí cho đồng đội." },
      { id: "task_2", title: "Ghép mã màu quang học", skill: "Đọc & Viết", desc: "Đọc bảng quy tắc pha màu và Viết thứ tự sắp xếp tinh thể vào bệ đá." },
      { id: "task_3", title: "Cân bằng bệ đá trọng lực", skill: "Nghe & Nói", desc: "Nghe đo áp suất đếm nhịp và Nói hiệu lệnh đồng bộ bước chân lên bệ đá." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 3", skill: "Đọc & Nói", desc: "Đọc văn bản trên bệ trung tâm và Nói câu thần chú mở khóa hốc đá." }
    ],
    shardRewardId: 3
  },
  {
    id: 4,
    chapterId: 1,
    stageNumber: 4,
    title: "Dòng chảy xiết",
    story: "Cả nhóm phối hợp bám nhau vượt qua thác nước ngầm chảy xiết đầy xoáy nước nguy hiểm.",
    difficulty: "Medium",
    minCombatPower: 210,
    advisor: {
      name: "Hoa tiêu ngầm Finn",
      role: "Chuyên gia địa hình thủy văn",
      avatar: "./assets/portraits/jade.jpg",
      advice: "Canh đúng khoảng lặng giữa hai đợt xoáy nước để bắn neo cố định."
    },
    skills: ["Nghe", "Nói", "Đọc", "Viết"],
    tasks: [
      { id: "task_1", title: "Bắn neo cố định", skill: "Đọc & Viết", desc: "Đọc bảng thông số sức gió/lực căng trên ống ngắm và Viết lệnh điều chỉnh góc bắn neo." },
      { id: "task_2", title: "Vượt thác nước ngầm", skill: "Nghe & Nói", desc: "Nghe cảnh báo chu kỳ dòng xoáy và Nói đếm nhịp di chuyển an toàn cho cả đội." },
      { id: "task_3", title: "Đóng van xoáy nước", skill: "Đọc & Nói", desc: "Đọc sơ đồ thủy lực ngầm và Nói hướng dẫn đồng đội thứ tự ngắt van áp suất." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 4", skill: "Nói & Nghe", desc: "Nói lời thuyết phục Thủy quái dẫn đường vào ngách bí mật và Nghe chỉ dẫn đường vào." }
    ],
    shardRewardId: 4
  },
  {
    id: 5,
    chapterId: 1,
    stageNumber: 5,
    title: "Quái thú canh cửa",
    story: "Né tránh một con lươn điện khổng lồ đang ngủ say để lẻn qua cánh cổng dẫn vào thành phố.",
    difficulty: "Medium",
    minCombatPower: 300,
    advisor: {
      name: "Học giả Maya",
      role: "Chuyên gia ngôn ngữ & sinh vật học cổ",
      avatar: "./assets/portraits/maya.jpg",
      advice: "Hát nhẹ nhàng câu thần chú ru ngủ để giữ nhịp thở của lươn điện ổn định."
    },
    skills: ["Nghe", "Nói", "Đọc", "Viết"],
    tasks: [
      { id: "task_1", title: "Di chuyển lén lút", skill: "Nghe & Nói", desc: "Nghe nhịp thở/tiếng rít của quái thú và Nói thì thầm ra hiệu dừng lại hoặc bò tiếp." },
      { id: "task_2", title: "Cắt nguồn tích điện", skill: "Đọc & Viết", desc: "Đọc sơ đồ mạch sinh học trên máy quét và Viết tên vị trí rễ điện cần cắt." },
      { id: "task_3", title: "Đánh lạc hướng", skill: "Nói", desc: "Mô phỏng lại âm thanh giao tiếp của loài cá phát quang bằng tiếng Anh để dụ quái thú xoay đầu." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 5", skill: "Đọc & Nói", desc: "Đọc bài ru cổ ngữ và Nói nhẹ nhàng câu thần chú xoa dịu giấc ngủ quái thú." }
    ],
    shardRewardId: 5
  },
  {
    id: 6,
    chapterId: 1,
    stageNumber: 6,
    title: "Cổng chào Atlantis",
    story: "Kích hoạt 3 khối Đại bửu thạch, cánh cổng khổng lồ dẫn vào trung tâm vương quốc chìm mở ra.",
    difficulty: "Medium",
    minCombatPower: 400,
    advisor: {
      name: "Người canh cổng Nereus",
      role: "Đại hộ vệ vương triều",
      avatar: "./assets/portraits/leo.jpg",
      advice: "Lời tuyên thệ trung thành bằng tiếng Anh cổ sẽ đánh thức linh hồn cánh cổng."
    },
    skills: ["Nghe", "Nói", "Đọc", "Viết"],
    tasks: [
      { id: "task_1", title: "Tìm 3 khối Đại bửu thạch", skill: "Nghe & Nói", desc: "Nghe mô tả hình dạng bửu thạch và Nói báo cáo khi tìm thấy từng khối đá." },
      { id: "task_2", title: "Dịch mật mã mở cổng", skill: "Đọc & Viết", desc: "Đọc câu danh ngôn khắc trên vòm cổng và Viết từ khuyết để hoàn thiện mật mã." },
      { id: "task_3", title: "Lắp bửu thạch vào trục", skill: "Nghe & Nói", desc: "Nghe chỉ dẫn hướng xoay khớp và Nói hiệu lệnh cùng đẩy đá vào bệ." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 6", skill: "Nói & Nghe", desc: "Nói lời tuyên thệ trước Người canh cổng và Nghe lời chúc phúc trao mảnh bản đồ." }
    ],
    shardRewardId: 6
  },

  // ===================== CHƯƠNG 2 (Màn 7 - 12) =====================
  {
    id: 7,
    chapterId: 2,
    stageNumber: 7,
    title: "Rừng tảo phát quang",
    story: "Nhóm bạn tìm cách hái quả sinh học cổ đại để có khả năng nín thở dưới nước lâu hơn.",
    difficulty: "Medium",
    minCombatPower: 520,
    advisor: {
      name: "Thần rừng Tảo Xanh",
      role: "Người bảo hộ sinh thái",
      avatar: "./assets/portraits/maya.jpg",
      advice: "Quả lành luôn phát ra ánh sáng xanh lam dịu nhẹ, tránh xa quả màu đỏ thẫm!"
    },
    skills: ["Đọc", "Nói", "Nghe", "Viết"],
    tasks: [
      { id: "task_1", title: "Thu hoạch 4 quả sinh học", skill: "Đọc & Nói", desc: "Đọc tài liệu thực vật học phân biệt quả độc/lành và Nói hướng dẫn đồng đội trèo hái." },
      { id: "task_2", title: "Vượt qua bãi gai độc", skill: "Nghe & Nói", desc: "Nghe Thần rừng cảnh báo chu kỳ gai nở và Nói chỉ đạo nhịp né tránh." },
      { id: "task_3", title: "Bào chế thuốc tăng thể lực", skill: "Đọc & Viết", desc: "Đọc công thức phối chế thảo dược cổ và Viết tỉ lệ dung dịch vào bàn pha chế." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 7", skill: "Nói", desc: "Nói câu chào bằng ngôn ngữ thiên nhiên để hoa khổng lồ mở nhụy nhả bản đồ." }
    ],
    shardRewardId: 7
  },
  {
    id: 8,
    chapterId: 2,
    stageNumber: 8,
    title: "Cầu treo đổ nát",
    story: "Phối hợp kích hoạt các đòn bẩy cổ xưa để bắc cầu dây xích qua vực thẳm sâu hoắm.",
    difficulty: "Medium",
    minCombatPower: 650,
    advisor: {
      name: "Thợ máy Cổ Ark",
      role: "Kỹ sư kiến trúc",
      avatar: "./assets/portraits/sam.jpg",
      advice: "Cân bằng tải trọng hai đầu cầu trước khi kéo đòn bẩy chính."
    },
    skills: ["Đọc", "Viết", "Nghe", "Nói"],
    tasks: [
      { id: "task_1", title: "Hạ đòn bẩy đối trọng", skill: "Đọc & Viết", desc: "Đọc chỉ số tải trọng và Viết thông số cân bằng lực vào bảng điều khiển tời." },
      { id: "task_2", title: "Sửa bánh răng cầu", skill: "Nghe & Nói", desc: "Nghe hướng dẫn quy trình lắp ráp và Nói xác nhận hoàn thành từng mắt xích." },
      { id: "task_3", title: "Nối thang dây", skill: "Nghe & Nói", desc: "Nghe tín hiệu an toàn và Nói hướng dẫn đồng đội điểm bám thang." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 8", skill: "Đọc & Nói", desc: "Đọc nhật ký người gác cầu và Nói lời giải câu đố để mở hòm kho báu." }
    ],
    shardRewardId: 8
  },
  {
    id: 9,
    chapterId: 2,
    stageNumber: 9,
    title: "Mê cung san hô",
    story: "Định vị đường đi trong mê cung san hô gai góc, dùng pháo sáng xua đuổi các loài cá ăn thịt.",
    difficulty: "Medium",
    minCombatPower: 790,
    advisor: {
      name: "Ẩn sĩ San hô Coralis",
      role: "Cư dân ẩn dật",
      avatar: "./assets/portraits/jade.jpg",
      advice: "Quy tắc bàn tay phải và âm thanh tần số cao sẽ giúp bạn không bao giờ bị lạc."
    },
    skills: ["Đọc", "Nói", "Nghe", "Viết"],
    tasks: [
      { id: "task_1", title: "Định vị lộ trình", skill: "Đọc & Nói", desc: "Đọc sơ đồ rạn san hô và Nói chỉ huy phương hướng rẽ (trái, phải, tiến, dừng)." },
      { id: "task_2", title: "Xua đuổi cá săn mồi", skill: "Nghe & Nói", desc: "Nghe tần số tiếng gầm cá dữ và Nói lệnh nạp pháo sáng cho súng phóng." },
      { id: "task_3", title: "Phá rào san hô vôi hóa", skill: "Đọc & Viết", desc: "Đọc phân tích cấu trúc điểm yếu của vách đá và Viết tọa độ va đập cho búa tạ." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 9", skill: "Nói & Nghe", desc: "Nói lời thương lượng xã giao với Ẩn sĩ san hô và Nghe gợi ý vị trí cất giấu bản đồ." }
    ],
    shardRewardId: 9
  },
  {
    id: 10,
    chapterId: 2,
    stageNumber: 10,
    title: "Nhà máy năng lượng Orichalcum",
    story: "Sửa chữa hệ thống ống dẫn năng lượng cổ để mở cửa một khu nghiên cứu bị niêm phong.",
    difficulty: "Hard",
    minCombatPower: 940,
    advisor: {
      name: "Kỹ sư Trưởng Sam",
      role: "Thiên tài công nghệ & cơ khí",
      avatar: "./assets/portraits/sam.jpg",
      advice: "Cẩn thận xả áp kế lò phản ứng trước khi thực hiện viết code hack vi mạch!"
    },
    skills: ["Nghe", "Nói", "Đọc", "Viết"],
    tasks: [
      { id: "task_1", title: "Nối 3 đường ống dẫn nhiệt", skill: "Nghe & Nói", desc: "Nghe AI cảnh báo mức độ quá nhiệt và Nói lệnh điều phối các van xả tương ứng." },
      { id: "task_2", title: "Hack bảng điều khiển", skill: "Đọc & Viết", desc: "Đọc sơ đồ vi mạch logic và Viết dòng lệnh tái lập trình hệ thống." },
      { id: "task_3", title: "Xả áp suất lò phản ứng", skill: "Đọc & Nói", desc: "Đọc chỉ số áp kế nguy hiểm và Nói đếm nhịp gạt cần xả khẩn cấp." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 10", skill: "Nghe & Viết", desc: "Nghe thông báo xác thực giọng nói của AI và Viết mã truy xuất buồng chứa bản đồ." }
    ],
    shardRewardId: 10
  },
  {
    id: 11,
    chapterId: 2,
    stageNumber: 11,
    title: "Những bức phù điêu kể chuyện",
    story: "Giải câu đố xếp hình niên đại cổ xưa để tìm ra manh mối về Chìa khóa Trở về.",
    difficulty: "Hard",
    minCombatPower: 1100,
    advisor: {
      name: "Tinh linh Khảo cổ Chrono",
      role: "Ký ức thời gian",
      avatar: "./assets/portraits/maya.jpg",
      advice: "Đọc kỹ từng câu văn tự khắc dưới chân phù điêu để nối kết dòng thời gian chuẩn xác."
    },
    skills: ["Đọc", "Nghe", "Nói", "Viết"],
    tasks: [
      { id: "task_1", title: "Quét 4 bức phù điêu", skill: "Đọc", desc: "Đọc các đoạn chú giải lịch sử cổ đại khắc dưới chân từng bức phù điêu." },
      { id: "task_2", title: "Xếp dòng thời gian", skill: "Nghe & Nói", desc: "Nghe tóm tắt niên đại và Nói sắp xếp thứ tự các sự kiện lịch sử." },
      { id: "task_3", title: "Vượt qua bài khảo hạch", skill: "Nghe & Nói", desc: "Nghe 3 câu hỏi vấn đáp lịch sử từ Tinh linh canh giữ và Nói câu trả lời." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 11", skill: "Viết", desc: "Viết bài học lịch sử ngắn gọn (từ khóa) lên bệ thờ để mở bệ chứa bản đồ." }
    ],
    shardRewardId: 11
  },
  {
    id: 12,
    chapterId: 2,
    stageNumber: 12,
    title: "Đội quân đất sét thức tỉnh",
    story: "Chạy trốn khỏi các hộ vệ bằng đá vô tình bị kích hoạt khi tháo dỡ phong ấn cổ.",
    difficulty: "Hard",
    minCombatPower: 1270,
    advisor: {
      name: "Đội trưởng Leo",
      role: "Chuyên gia tác chiến & phòng thủ",
      avatar: "./assets/portraits/leo.jpg",
      advice: "Giữ vững cự ly hàng ngũ, tập trung hỏa lực vào khớp phong ấn của tượng chỉ huy!"
    },
    skills: ["Đọc", "Nói", "Nghe", "Viết"],
    tasks: [
      { id: "task_1", title: "Kích hoạt bẫy sập", skill: "Đọc & Nói", desc: "Đọc cơ chế kích hoạt bẫy trần đá và Nói hiệu lệnh giật chốt khi kẻ địch đi vào tầm ngắm." },
      { id: "task_2", title: "Chạy đua qua hành lang", skill: "Nghe & Nói", desc: "Nghe báo trước các điểm nứt sụt và Nói dẫn hướng chạy cho cả đội." },
      { id: "task_3", title: "Phòng thủ chặn hậu", skill: "Nghe & Viết", desc: "Nghe tiếng nạp năng lượng của kẻ địch và Viết lệnh kích hoạt lá chắn năng lượng tối đa." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 12", skill: "Đọc & Nói", desc: "Đọc ký hiệu phong ấn trên tượng tướng chỉ huy và Nói mật mã vô hiệu hóa để nhặt bản đồ." }
    ],
    shardRewardId: 12
  },

  // ===================== CHƯƠNG 3 (Màn 13 - 18) =====================
  {
    id: 13,
    chapterId: 3,
    stageNumber: 13,
    title: "Quảng trường nước",
    story: "Vượt qua hệ thống đài phun nước áp lực cao di chuyển theo quy luật trận đồ cổ.",
    difficulty: "Medium",
    minCombatPower: 1450,
    advisor: {
      name: "Trọng tài Cơ giới Golem",
      role: "Giám sát đấu trường nước",
      avatar: "./assets/portraits/sam.jpg",
      advice: "Các cột nước đổi hướng theo chu kỳ 4 giây, hãy quan sát mặt sàn phát sáng."
    },
    skills: ["Đọc", "Nói", "Nghe", "Viết"],
    tasks: [
      { id: "task_1", title: "Giải mã nhịp phun nước", skill: "Đọc & Nói", desc: "Đọc quy luật nhịp điệu phun nước trên bia đá và Nói giải thích chu kỳ an toàn." },
      { id: "task_2", title: "Vượt ô cờ áp lực", skill: "Nghe & Nói", desc: "Nghe tín hiệu ô an toàn và Nói chỉ đạo bước chân tiếp theo." },
      { id: "task_3", title: "Khóa van nước tổng", skill: "Đọc & Viết", desc: "Đọc áp suất hai bên trụ van và Viết lệnh đồng bộ hóa hai van khóa thủy lực." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 13", skill: "Nói", desc: "Nói câu lệnh xác nhận hoàn thành thử thách trước đài phun trung tâm." }
    ],
    shardRewardId: 13
  },
  {
    id: 14,
    chapterId: 3,
    stageNumber: 14,
    title: "Thư viện ngập nước",
    story: "Tìm kiếm các cuộn giấy da cổ giữa các tầng lầu lơ lửng nhờ trường phản trọng lực.",
    difficulty: "Hard",
    minCombatPower: 1640,
    advisor: {
      name: "Thủ thư Ma Althea",
      role: "Người canh giữ tri thức ngàn năm",
      avatar: "./assets/portraits/maya.jpg",
      advice: "Mỗi cuốn sách cổ đều chứa một vần thơ mật mã định vị tầng chứa kho báu."
    },
    skills: ["Nghe", "Nói", "Đọc", "Viết"],
    tasks: [
      { id: "task_1", title: "Thu thập 3 cuộn giấy da cổ", skill: "Nghe & Nói", desc: "Nghe hướng dẫn vị trí tầng sách và Nói yêu cầu tra cứu thư mục cổ." },
      { id: "task_2", title: "Dịch mật thư Atlantis", skill: "Đọc & Viết", desc: "Đọc bản văn cổ bị mờ/rách và Viết từ vựng khuyết thiếu để phục hồi nội dung." },
      { id: "task_3", title: "Kéo cần gạt giá sách", skill: "Đọc & Nói", desc: "Đọc tên các đầu sách mật mã và Nói thứ tự kéo sách cho đồng đội thực hiện." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 14", skill: "Nghe & Nói", desc: "Nghe câu đố tư duy của Thủ thư và Nói lời giải đáp để nhận bản đồ." }
    ],
    shardRewardId: 14
  },
  {
    id: 15,
    chapterId: 3,
    stageNumber: 15,
    title: "Hệ thống tàu ngầm cổ",
    story: "Sửa chữa và điều khiển một chiếc tàu ngầm mini của người Atlantis băng qua bãi thủy lôi.",
    difficulty: "Hard",
    minCombatPower: 1840,
    advisor: {
      name: "Thợ máy Tàu ngầm Gizmo",
      role: "Kỹ sư cơ khí biển sâu",
      avatar: "./assets/portraits/sam.jpg",
      advice: "Sử dụng sóng âm sonar để định vị khoảng cách an toàn với thủy lôi từ trường."
    },
    skills: ["Đọc", "Viết", "Nghe", "Nói"],
    tasks: [
      { id: "task_1", title: "Lắp pin năng lượng", skill: "Đọc & Viết", desc: "Đọc sơ đồ lắp ráp pin năng lượng và Viết mã khởi động nguồn điện." },
      { id: "task_2", title: "Sửa chân vịt tàu ngầm", skill: "Nghe & Nói", desc: "Nghe chỉ dẫn kỹ thuật hàn và Nói xác nhận từng khớp nối chân vịt." },
      { id: "task_3", title: "Lái tàu qua bãi thủy lôi", skill: "Nghe & Nói", desc: "Nghe hệ thống sonar cảnh báo khoảng cách vật cản và Nói lệnh bẻ lái khẩn cấp." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 15", skill: "Đọc & Viết", desc: "Đọc nhật trình lưu trữ trên tàu và Viết mã mở hòm thiết bị buồng lái." }
    ],
    shardRewardId: 15
  },
  {
    id: 16,
    chapterId: 3,
    stageNumber: 16,
    title: "Cạm bẫy gương kính",
    story: "Ánh sáng bị khúc xạ phức tạp, nhóm phải xoay các thấu kính để chiếu mở viên ngọc phong ấn.",
    difficulty: "Hard",
    minCombatPower: 2050,
    advisor: {
      name: "Kỹ sư Ánh sáng Helios",
      role: "Chuyên gia quang học",
      avatar: "./assets/portraits/jade.jpg",
      advice: "Góc tới bằng góc phản xạ! Tính toán độ lệch lăng kính để hội tụ tia sáng."
    },
    skills: ["Đọc", "Nói", "Nghe", "Viết"],
    tasks: [
      { id: "task_1", title: "Lau sạch 4 thấu kính", skill: "Đọc & Nói", desc: "Đọc chỉ dẫn quang học trên từng trụ kính và Nói phân chia vị trí lau cho từng người." },
      { id: "task_2", title: "Chỉnh góc phản xạ quang học", skill: "Nghe & Nói", desc: "Nghe hướng dẫn độ lệch góc phản xạ và Nói điều chỉnh độ nghiêng của gương." },
      { id: "task_3", title: "Kích hoạt ngọc phong ấn", skill: "Đọc & Viết", desc: "Đọc bảng hội tụ quang năng và Viết công thức hội tụ tia sáng vào viên ngọc." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 16", skill: "Nói", desc: "Nói khẩu lệnh tụ quang để thu nhận mảnh bản đồ phóng ra từ cột sáng." }
    ],
    shardRewardId: 16
  },
  {
    id: 17,
    chapterId: 3,
    stageNumber: 17,
    title: "Chợ đen bỏ hoang",
    story: "Thu thập các linh kiện cơ khí cổ và đàm phán với Bot thương nhân để chế tạo súng xung điện.",
    difficulty: "Hard",
    minCombatPower: 2270,
    advisor: {
      name: "Bot Thương nhân Scrappy",
      role: "Chủ cửa hàng đồ cũ cổ đại",
      avatar: "./assets/portraits/sam.jpg",
      advice: "Dùng kỹ năng đàm phán tiếng Anh chuẩn xác để đổi lấy giá linh kiện hời nhất!"
    },
    skills: ["Đọc", "Nói", "Nghe", "Viết"],
    tasks: [
      { id: "task_1", title: "Tìm 4 linh kiện máy móc", skill: "Đọc & Nói", desc: "Đọc danh mục vật liệu cần tìm và Nói đối chiếu các bộ phận tìm thấy với danh sách." },
      { id: "task_2", title: "Mặc cả với Bot bán hàng", skill: "Nói & Nghe", desc: "Nói đàm phán/thuyết phục Bot thương nhân để đổi lấy linh kiện vũ khí và Nghe báo giá." },
      { id: "task_3", title: "Chế tạo súng xung điện", skill: "Đọc & Viết", desc: "Đọc bản thiết kế vũ khí và Viết thông số nạp điện dung cho súng." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 17", skill: "Nghe & Nói", desc: "Nghe gợi ý mật khẩu két sắt từ Bot buôn bán và Nói câu giải mã chính xác." }
    ],
    shardRewardId: 17
  },
  {
    id: 18,
    chapterId: 3,
    stageNumber: 18,
    title: "Đấu trường Poseidon",
    story: "Sống sót trước các đợt tấn công thử thách của robot bảo an tinh nhuệ trên đấu trường danh vọng.",
    difficulty: "Hard",
    minCombatPower: 2500,
    advisor: {
      name: "Bình luận viên Đấu trường Magnus",
      role: "Chủ tọa Đấu trường",
      avatar: "./assets/portraits/leo.jpg",
      advice: "Lõi năng lượng sau lưng Robot thủ lĩnh là điểm yếu duy nhất khi hắn chuẩn bị vung búa."
    },
    skills: ["Nghe", "Nói", "Đọc"],
    tasks: [
      { id: "task_1", title: "Sống sót qua 3 đợt lính robot", skill: "Nghe & Nói", desc: "Nghe thông báo chủng loại kẻ địch và Nói chiến thuật phòng thủ phù hợp." },
      { id: "task_2", title: "Bắn hạ trụ sạc năng lượng", skill: "Đọc & Nói", desc: "Đọc phân tích điểm yếu của trụ sạc trên máy quét và Nói tọa độ ngắm bắn." },
      { id: "task_3", title: "Hạ gục Robot thủ lĩnh", skill: "Nghe & Nói", desc: "Nghe cảnh báo từ hệ thống phân tích và Nói khẩu lệnh dồn hỏa lực vào lõi năng lượng." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 18", skill: "Nói", desc: "Nói lời tuyên bố chiến thắng trước Hội đồng Đấu trường để nhận bản đồ trên ngai vàng." }
    ],
    shardRewardId: 18
  },

  // ===================== CHƯƠNG 4 (Màn 19 - 24) =====================
  {
    id: 19,
    chapterId: 4,
    stageNumber: 19,
    title: "Đỉnh tháp lộng gió",
    story: "Leo bên ngoài tháp chọc trời Atlantis, né tránh các mảnh vỡ và luồng gió biển cực mạnh.",
    difficulty: "Hard",
    minCombatPower: 2750,
    advisor: {
      name: "Tiên phong Jade",
      role: "Chuyên gia leo trèo & thám thính",
      avatar: "./assets/portraits/jade.jpg",
      advice: "Nghe tiếng còi báo bão để kịp đếm ngược ẩn nấp vào các hốc đá an toàn."
    },
    skills: ["Đọc", "Nói", "Nghe", "Viết"],
    tasks: [
      { id: "task_1", title: "Bắn dây neo trèo tháp", skill: "Đọc & Nói", desc: "Đọc thiết bị đo tốc độ gió bão và Nói góc bắn móc neo an toàn cho đồng đội." },
      { id: "task_2", title: "Ẩn nấp luồng gió giật", skill: "Nghe & Nói", desc: "Nghe còi báo bão rít trên đỉnh tháp và Nói đếm ngược thời gian toàn đội ẩn nấp." },
      { id: "task_3", title: "Đập tan rào cản gỉ sét", skill: "Đọc & Viết", desc: "Đọc chỉ số độ bền kim loại và Viết lệnh kích hoạt sóng siêu âm phá rỉ sét." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 19", skill: "Đọc & Nói", desc: "Đọc ký tự ghi trên cột cờ đỉnh tháp và Nói mật lệnh mở hộp cờ." }
    ],
    shardRewardId: 19
  },
  {
    id: 20,
    chapterId: 4,
    stageNumber: 20,
    title: "Phòng thí nghiệm sinh học",
    story: "Giải cứu một thành viên trong nhóm bị các xúc tu thực vật đột biến giam giữ trong phòng lab.",
    difficulty: "Hard",
    minCombatPower: 3020,
    advisor: {
      name: "Trợ lý ảo Lab AI Iris",
      role: "Hệ thống quản lý phòng lab",
      avatar: "./assets/portraits/maya.jpg",
      advice: "Pha chế đúng nồng độ dung dịch diệt rễ cây trước khi đài hoa mẹ mở ra."
    },
    skills: ["Nghe", "Nói", "Đọc", "Viết"],
    tasks: [
      { id: "task_1", title: "Cắt đứt xúc tu quái thụ", skill: "Nghe & Nói", desc: "Nghe tiếng kêu cứu và vị trí bị trói của đồng đội, Nói kế hoạch tấn công đồng loạt." },
      { id: "task_2", title: "Pha dung dịch ức chế sinh học", skill: "Đọc & Viết", desc: "Đọc hướng dẫn an toàn hóa chất phòng lab và Viết công thức pha chế thuốc." },
      { id: "task_3", title: "Phun hóa chất vào cuống hoa mẹ", skill: "Nghe & Nói", desc: "Nghe Trợ lý ảo hướng dẫn thời điểm đài hoa mở và Nói hiệu lệnh xịt thuốc." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 20", skill: "Nói & Nghe", desc: "Nói lời cảm ơn trợ lý ảo và Nghe chỉ dẫn mở hộc hoa lấy bản đồ." }
    ],
    shardRewardId: 20
  },
  {
    id: 21,
    chapterId: 4,
    stageNumber: 21,
    title: "Vòng xoáy trọng lực",
    story: "Vượt qua các căn phòng nơi trọng lực liên tục đảo ngược trần - sàn sau mỗi vài giây.",
    difficulty: "Hard",
    minCombatPower: 3300,
    advisor: {
      name: "Nhà vật lý Trọng lực Newton",
      role: "Nhà nghiên cứu trường năng lượng",
      avatar: "./assets/portraits/sam.jpg",
      advice: "Đồng hồ đếm ngược báo hiệu thời điểm đảo cực, sẵn sàng đẩy nệm từ trường tiếp đất."
    },
    skills: ["Nghe", "Nói", "Đọc", "Viết"],
    tasks: [
      { id: "task_1", title: "Căn nhịp đảo trọng lực", skill: "Nghe & Nói", desc: "Nghe đồng hồ đếm ngược và Nói cảnh báo chuẩn bị đáp sàn/trần nhà." },
      { id: "task_2", title: "Đẩy nệm từ trường tiếp đất", skill: "Đọc & Nói", desc: "Đọc tọa độ điểm rơi hiển thị trên máy quét và Nói hướng đẩy nệm đỡ an toàn." },
      { id: "task_3", title: "Bật công tắc cân bằng", skill: "Đọc & Viết", desc: "Đọc bảng mạch đảo chiều trên trần phòng và Viết chuỗi thao tác ngắt lực nổi khẩn cấp." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 21", skill: "Nói", desc: "Nói khẩu lệnh kích hoạt từ trường cá nhân để hút mảnh bản đồ đang trôi lơ lửng." }
    ],
    shardRewardId: 21
  },
  {
    id: 22,
    chapterId: 4,
    stageNumber: 22,
    title: "Trộm lõi năng lượng",
    story: "Vượt qua lưới tia laser năng lượng xanh bảo vệ viên đá Orichalcum Thượng Cổ.",
    difficulty: "Hard",
    minCombatPower: 3600,
    advisor: {
      name: "Hacker Ngầm Zero",
      role: "Chuyên gia vô hiệu hóa an ninh",
      avatar: "./assets/portraits/jade.jpg",
      advice: "Lưới laser có một khe hở 1.5 giây sau mỗi chu kỳ quét chéo."
    },
    skills: ["Nghe", "Nói", "Đọc", "Viết"],
    tasks: [
      { id: "task_1", title: "Trườn qua lưới laser", skill: "Nghe & Nói", desc: "Nghe hacker đọc quy luật quét tia laser an ninh và Nói chỉ đạo tư thế di chuyển." },
      { id: "task_2", title: "Vô hiệu hóa cảnh báo", skill: "Đọc & Viết", desc: "Đọc mã lỗi hệ thống cảnh báo và Viết câu lệnh giải mã bảo mật để ngắt còi báo động." },
      { id: "task_3", title: "Rút viên đá Thượng Cổ", skill: "Đọc & Nói", desc: "Đọc hướng dẫn cân bằng áp lực từ trường và Nói nhịp kéo kìm nhấc lõi Orichalcum." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 22", skill: "Đọc & Nói", desc: "Đọc văn bản ẩn dưới đế năng lượng và Nói mật khẩu giải phóng ngàm giữ bản đồ." }
    ],
    shardRewardId: 22
  },
  {
    id: 23,
    chapterId: 4,
    stageNumber: 23,
    title: "Thần hộ vệ khổng lồ",
    story: "Trận chiến cam go với bức tượng thần Poseidon bằng máy cơ khí khổng lồ bảo vệ đền đài.",
    difficulty: "Hard",
    minCombatPower: 3920,
    advisor: {
      name: "Thuyền trưởng Drake",
      role: "Chỉ huy chiến thuật",
      avatar: "./assets/portraits/leo.jpg",
      advice: "Phá hủy hai khớp gối để tượng quỳ xuống, sau đó hack bảng mạch sau gáy!"
    },
    skills: ["Nghe", "Nói", "Đọc", "Viết"],
    tasks: [
      { id: "task_1", title: "Né đòn quét đinh ba", skill: "Nghe & Nói", desc: "Nghe âm thanh tích tụ sóng chấn động và Nói hiệu lệnh nhảy né sóng thần lực." },
      { id: "task_2", title: "Phá hủy 2 khớp gối cơ khí", skill: "Đọc & Viết", desc: "Đọc phân tích cấu trúc chịu lực và Viết lệnh công phá vào điểm yếu khớp gối." },
      { id: "task_3", title: "Hack bảng mạch sau gáy", skill: "Nghe & Nói", desc: "Nghe đọc mã ngắt nguồn sau gáy tượng và Nói xác nhận thao tác ngắt điện." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 23", skill: "Đọc & Nói", desc: "Đọc cổ tự khắc trên vương miện của Thần hộ vệ để nhặt mảnh bản đồ rơi ra." }
    ],
    shardRewardId: 23
  },
  {
    id: 24,
    chapterId: 4,
    stageNumber: 24,
    title: "Kích hoạt cổng trời",
    story: "Đặt viên đá năng lượng vào bệ phóng, định vị tọa độ không gian quay về Trái Đất hiện đại.",
    difficulty: "Hard",
    minCombatPower: 4260,
    advisor: {
      name: "AI Cổng Trời Aether",
      role: "Trí tuệ điều phối không gian",
      avatar: "./assets/portraits/maya.jpg",
      advice: "Đồng bộ hóa tần số sóng âm với tọa độ quê nhà trước khi kích nổ năng lượng."
    },
    skills: ["Đọc", "Nói", "Viết", "Nghe"],
    tasks: [
      { id: "task_1", title: "Đặt lõi năng lượng vào bệ", skill: "Đọc & Nói", desc: "Đọc hướng dẫn tiếp xúc năng lượng và Nói khẩu lệnh hạ lõi đá vào cổng truyền dẫn." },
      { id: "task_2", title: "Xoay 3 đĩa tọa độ không gian", skill: "Đọc & Viết", desc: "Đọc nhật ký hành trình thế giới hiện đại và Viết chính xác kinh độ/vĩ độ tọa độ Trái Đất." },
      { id: "task_3", title: "Đồng bộ hóa tần số", skill: "Nghe & Nói", desc: "Nghe sóng âm đối chiếu và Nói điều chỉnh tần số dao động trùng khớp tín hiệu về nhà." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 24", skill: "Nghe & Nói", desc: "Nghe lời xác nhận từ AI Cổng Trời và Nói lời chấp nhận hoàn tất để nhận bản đồ." }
    ],
    shardRewardId: 24
  },

  // ===================== CHƯƠNG 5 (Màn 25 - 30) =====================
  {
    id: 25,
    chapterId: 5,
    stageNumber: 25,
    title: "Thành phố sụp đổ",
    story: "Chạy đua với tốc độ khi các tòa nhà xung quanh đổ sụp và đá tảng từ trên cao rơi xuống.",
    difficulty: "Hard",
    minCombatPower: 4620,
    advisor: {
      name: "Hoa tiêu Tinh linh Zephyr",
      role: "Dẫn đường thoát hiểm",
      avatar: "./assets/portraits/jade.jpg",
      advice: "Chú ý còi báo động các cấu trúc sắp sập phía trước để kịp đổi hướng chạy!"
    },
    skills: ["Nghe", "Nói", "Đọc", "Viết"],
    tasks: [
      { id: "task_1", title: "Chạy nước rút qua phố", skill: "Nghe & Nói", desc: "Nghe AI cảnh báo sớm các cấu trúc nhà sập phía trước và Nói chỉ huy hướng rẽ thoát hiểm." },
      { id: "task_2", title: "Phá đá chắn cửa hầm", skill: "Đọc & Viết", desc: "Đọc phân tích độ nứt của tảng đá và Viết lệnh kích nổ bộc phá phá đá." },
      { id: "task_3", title: "Cứu đồng đội trượt ngã", skill: "Nghe & Nói", desc: "Nghe tiếng kêu cứu và Nói lời động viên, hướng dẫn đồng đội nắm lấy tay/dây kéo." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 25", skill: "Đọc & Nói", desc: "Đọc mã cứu hộ khẩn cấp trên nóc xe cổ và Nói mật mã mở hòm cứu hộ lấy bản đồ." }
    ],
    shardRewardId: 25
  },
  {
    id: 26,
    chapterId: 5,
    stageNumber: 26,
    title: "Dòng nước ngược dòng",
    story: "Bơi ngược dòng nước lũ khổng lồ đang tràn vào các đường hầm thoát hiểm.",
    difficulty: "Hard",
    minCombatPower: 5000,
    advisor: {
      name: "Cứu hộ Biển sâu Marina",
      role: "Chuyên gia bơi lội & dưỡng khí",
      avatar: "./assets/portraits/sam.jpg",
      advice: "Bơi bám sát các gờ tường chắn sóng trong lúc nước rút và tiếp ứng túi oxy kịp thời."
    },
    skills: ["Nghe", "Nói", "Đọc", "Viết"],
    tasks: [
      { id: "task_1", title: "Bơi bám gờ tường chắn", skill: "Nghe & Nói", desc: "Nghe còi báo lũ dâng cao từng đợt và Nói đếm nhịp tiến lên giữa các khoảng lặng nước rút." },
      { id: "task_2", title: "Mở cửa xả áp suất lớn", skill: "Đọc & Viết", desc: "Đọc biển cảnh báo thủy lực và Viết mã xả áp suất nước trên bảng điều khiển cửa hầm." },
      { id: "task_3", title: "Tiếp ứng bình dưỡng khí", skill: "Nghe & Nói", desc: "Nghe thông báo vị trí các túi oxy dự phòng và Nói chỉ định phân phát bình khí." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 26", skill: "Đọc & Nói", desc: "Đọc mã hiệu lưới chắn rác và Nói mật mã tháo khớp lưới lấy bản đồ." }
    ],
    shardRewardId: 26
  },
  {
    id: 27,
    chapterId: 5,
    stageNumber: 27,
    title: "Sự phản bội của hộ vệ",
    story: "Chiến đấu với thủ lĩnh đội cận vệ máy đang cố chặn đường sống của toàn bộ nhóm.",
    difficulty: "Hard",
    minCombatPower: 5400,
    advisor: {
      name: "Đội trưởng Leo",
      role: "Trưởng nhóm & chiến binh tiên phong",
      avatar: "./assets/portraits/leo.jpg",
      advice: "Đánh văng các drone tiếp viện trước khi tập trung khóa khớp cánh tay cơ khí của hắn!"
    },
    skills: ["Nghe", "Nói", "Đọc", "Viết"],
    tasks: [
      { id: "task_1", title: "Phá khiên phòng thủ của thủ lĩnh", skill: "Nghe & Nói", desc: "Nghe đọc chu kỳ suy yếu của trường lực và Nói thời điểm mở đòn tấn công tổng lực." },
      { id: "task_2", title: "Đánh văng drone tiếp viện", skill: "Đọc & Nói", desc: "Đọc cảnh báo đường bay của drone trên kính ngắm và Nói hướng đánh chặn." },
      { id: "task_3", title: "Tước khóa kích hoạt", skill: "Đọc & Viết", desc: "Đọc mã vô hiệu hóa cánh tay cơ khí và Viết lệnh khóa khớp tay để giật chìa khóa." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 27", skill: "Đọc & Nói", desc: "Đọc mã số lớp giáp ngực của robot bị hạ gục và Nói lệnh mở khóa lấy bản đồ." }
    ],
    shardRewardId: 27
  },
  {
    id: 28,
    chapterId: 5,
    stageNumber: 28,
    title: "Cây cầu gãy",
    story: "Cả nhóm phải phối hợp dùng dây đu và kỹ năng nhảy vượt chướng ngại qua vực nham thạch nước.",
    difficulty: "Hard",
    minCombatPower: 5820,
    advisor: {
      name: "Kỹ sư Sam Miller",
      role: "Chuyên gia móc neo & cơ học",
      avatar: "./assets/portraits/sam.jpg",
      advice: "Đo nhiệt độ và luồng khí nóng ngắt quãng để đếm nhịp xuất phát nhảy đu dây chính xác."
    },
    skills: ["Đọc", "Viết", "Nghe", "Nói"],
    tasks: [
      { id: "task_1", title: "Bắn dây neo qua vực dung nham", skill: "Đọc & Viết", desc: "Đọc máy đo nhiệt độ và hướng gió bề mặt, Viết thông số bắn móc neo chuẩn xác." },
      { id: "task_2", title: "Đu dây vượt vực", skill: "Nghe & Nói", desc: "Nghe tín hiệu luồng khí nóng ngắt quãng và Nói đếm nhịp xuất phát nhảy đu dây." },
      { id: "task_3", title: "Đỡ đồng đội tiếp đất", skill: "Nghe & Nói", desc: "Nghe tín hiệu hô tiếp đất của đồng đội và Nói hướng dẫn vị trí đón an toàn." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 28", skill: "Đọc & Nói", desc: "Đọc văn tự tưởng niệm trên bia đá cổ bờ bên kia và Nói câu truy niệm để rút mảnh bản đồ." }
    ],
    shardRewardId: 28
  },
  {
    id: 29,
    chapterId: 5,
    stageNumber: 29,
    title: "Cổng dịch chuyển quá tải",
    story: "Giữ vững vành đai phòng thủ, bảo vệ lõi năng lượng khỏi làn sóng quái vật biển trong lúc cổng sạc đầy 100%.",
    difficulty: "Hard",
    minCombatPower: 6260,
    advisor: {
      name: "Chỉ huy Trận địa Commander Vane",
      role: "Tướng lĩnh liên minh",
      avatar: "./assets/portraits/leo.jpg",
      advice: "Kích hoạt bẫy điện tập trung và bơm nitơ lỏng hạ nhiệt lò sạc khẩn cấp!"
    },
    skills: ["Nghe", "Nói", "Đọc", "Viết"],
    tasks: [
      { id: "task_1", title: "Lập vành đai phòng thủ", skill: "Nghe & Nói", desc: "Nghe phân công các hướng quái vật tấn công và Nói phân nhiệm vụ cho từng vị trí." },
      { id: "task_2", title: "Tiêu diệt 3 đợt quái vật biển", skill: "Đọc & Nói", desc: "Đọc điểm yếu của quái vật trên máy quét và Nói lệnh kích hoạt bẫy điện." },
      { id: "task_3", title: "Hạ nhiệt buồng nạp", skill: "Đọc & Viết", desc: "Đọc biểu đồ cảnh báo nhiệt độ lò sạc và Viết lệnh bơm nitơ lỏng làm mát khẩn cấp." },
      { id: "task_4", title: "Thu thập Mảnh bản đồ 29", skill: "Nghe & Nói", desc: "Nghe thông báo hệ thống đạt 100% mức năng lượng và Nói khẩu lệnh nhận mảnh bản đồ 29." }
    ],
    shardRewardId: 29
  },
  {
    id: 30,
    chapterId: 5,
    stageNumber: 30,
    title: "Trở về đất liền",
    story: "Cánh cổng mở ra, nhóm bạn thực hiện cú nhảy quyết định, thoát khỏi Atlantis và tỉnh dậy an toàn trên bãi biển quê nhà.",
    difficulty: "Hard (Chung Kết)",
    minCombatPower: 6720,
    advisor: {
      name: "Linh hồn Thời gian Chronos",
      role: "Vị thần bảo hộ Cánh Cổng Thời Gian",
      avatar: "./assets/portraits/maya.jpg",
      advice: "Ghép đủ 30 mảnh bản đồ cổ và toàn đội cùng đọc vang khẩu lệnh kích hoạt để trở về nhà!"
    },
    skills: ["Đọc", "Nói", "Nghe", "Viết"],
    tasks: [
      { id: "task_1", title: "Ghép hoàn chỉnh 30 mảnh bản đồ", skill: "Đọc & Nói", desc: "Đọc sơ đồ hướng dẫn thứ tự ghép các mảnh vỡ và Nói điều phối vị trí lắp đặt với toàn đội." },
      { id: "task_2", title: "Đọc khẩu lệnh kích hoạt cổng thời gian", skill: "Nghe & Nói", desc: "Nghe phát âm chuẩn từ Linh hồn Thời gian và toàn đội cùng Nói khẩu lệnh kích hoạt cổng." },
      { id: "task_3", title: "Cắt cầu dao quá tải ngăn nổ ngược", skill: "Đọc & Viết", desc: "Đọc cảnh báo hố đen quá tải và Viết lệnh ngắt mạch từ trường để ngăn nổ ngược." },
      { id: "task_4", title: "Thực hiện cú nhảy quyết định", skill: "Nghe & Nói", desc: "Nghe tín hiệu đếm ngược cuối cùng từ Cổng Không Gian và toàn đội cùng hô khẩu hiệu nhảy về nhà." }
    ],
    shardRewardId: 30
  }
];

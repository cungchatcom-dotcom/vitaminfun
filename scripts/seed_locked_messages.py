# -*- coding: utf-8 -*-
"""Câu khoá riêng cho từng nhiệm vụ của Lost in Atlantis.

Cùng một việc phải làm — "đi tới chỗ người gác cửa, qua nhiệm vụ của người ấy
trước đã" — và câu nào cũng GỌI ĐÚNG TÊN cánh cửa ấy, y như câu mẫu:

    Locked. Go and clear "Lyra's Warning" first — the NPC hands out the clue
    you need here.

Chỉ khác cách nói: mỗi nhiệm vụ trong màn lấy một khuôn câu khác nhau, để đi
qua bốn, sáu cánh cửa trong cùng một màn không phải nghe lại một câu bốn, sáu
lần. Tên cánh cửa thì đọc thẳng từ cơ sở dữ liệu (nhiệm vụ `phase='advisor'`
của chính màn ấy), nên người dựng đổi tên nhiệm vụ gác cửa là chạy lại script
này, không phải sửa tay ba mươi sáu câu.

Chỉ đặt `en`: đây là trò chơi học tiếng Anh, người gác cửa nói tiếng Anh, và
`pickText` tự lùi về khoá duy nhất có mặt nên bản tiếng Việt vẫn đọc ra câu ấy.
Đặt thêm `vi` còn làm hỏng việc thu tiếng: endpoint đọc MỌI bản dịch, nên một
giọng tiếng Anh sẽ đọc cả câu tiếng Việt, và trả tiền hai lần.

Màn NÀO CHƯA CÓ nhiệm vụ gác cửa mang tên thì để trống — câu tự sinh sẵn trong
`messages/` vẫn đúng, còn một câu cứng nhắc gọi tên một cánh cửa không tồn tại
thì sai.
"""
import sys, io, json, sqlalchemy as sa
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Xoay vòng theo thứ tự nhiệm vụ trong màn. Màn dài nhất hiện có sáu nhiệm vụ,
# nên sáu khuôn là đủ để không câu nào lặp lại trong cùng một màn.
KHUON = [
    'Locked. Go and clear "{gate}" first — the NPC there hands out the clue you need here.',
    'Not yet. Finish "{gate}" first; what opens this door is handed to you there.',
    'Sealed. Go to "{gate}", clear it, then come back to me.',
    'This stays shut until "{gate}" is done. Speak to the NPC there first.',
    'Come back after "{gate}". The clue that opens this one starts there.',
    'Locked. "{gate}" comes first — clear it with the NPC and this opens.',
]

url = [l.split('=', 1)[1].strip() for l in open(r'D:\Programs\vitaminfun\.env', encoding='utf-8')
       if l.startswith('DATABASE_URL_SYNC=')][0]
e = sa.create_engine(url)

with e.begin() as c:
    rows = c.execute(sa.text("""
        select q.id, s.id as stage_id, q.order_index, q.locked_message_i18n,
               (select a.name_i18n->>'en' from quests a
                 where a.stage_id = q.stage_id and a.phase = 'advisor'
                 order by a.order_index, a.id limit 1) as gate
        from quests q
        join stages s on s.id = q.stage_id
        join chapters ch on ch.id = s.chapter_id
        where ch.world_id = '01a0373c-b339-70c3-938b-779c93190f22' and q.phase = 'main'
        order by s.id, q.order_index, q.id
    """)).all()

    dat = bo_qua = khong_cong = 0
    dem = {}
    for qid, stage_id, so_q, hien, gate in rows:
        if not gate:
            khong_cong += 1
            continue
        # KHÔNG đè lên câu người dựng đã tự soạn. `hien` chỉ đáng tin khi nó là
        # một object i18n; lần chạy hỏng trước đó để lại một chuỗi JSON trần, và
        # chuỗi ấy phải bị ghi đè chứ không phải được giữ.
        if isinstance(hien, dict) and hien.get('en'):
            bo_qua += 1
            continue
        i = dem.get(stage_id, 0)
        dem[stage_id] = i + 1
        cau = KHUON[i % len(KHUON)].format(gate=gate)
        c.execute(sa.text("update quests set locked_message_i18n = cast(:m as jsonb), updated_at = now() where id = :i"),
                  {'m': json.dumps({'en': cau}), 'i': qid})
        dat += 1

    print(f'dat {dat} cau, bo qua {bo_qua} (da co san), man khong co nguoi gac cua {khong_cong}')

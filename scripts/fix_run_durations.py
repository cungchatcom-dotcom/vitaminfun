# -*- coding: utf-8 -*-
"""Chặn trần thời lượng cho các lượt chơi ĐÃ ghi sai từ trước.

`settle_run()` nay chặn trần ngay lúc chốt (xem `_gioi_han_giay`), nhưng những
lượt chốt trước bản vá vẫn mang con số cũ: khoảng cách từ lúc bắt đầu tới lúc có
ai đó gọi tới server, chứ không phải thời gian làm bài. Một màn 5 phút ghi 5:18
vì lời chốt tới chậm mười tám giây; một tab bị bỏ quên ghi 17 ngày vì vòng quét
dọn tới sau mười bảy ngày.

Trần lấy từ ĐỀ BÀI ĐÃ ĐÓNG BĂNG của chính lượt ấy, lùi về `stages` hiện tại nếu
ảnh chụp thiếu — cùng nguồn mà `settle_run()` đọc.

`ended_at` được kéo theo cho khớp: hai trường cùng nói một việc thì không được
trừ nhau ra một số thứ ba.

CHẠY ĐƯỢC NHIỀU LẦN: chỉ động vào dòng đang vượt trần. Giá trị cũ được ghi ra
một file JSON cạnh script trước khi sửa, để còn lần ngược nếu cần.
"""
import io
import json
import sys
from datetime import datetime
from pathlib import Path

import sqlalchemy as sa

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

REPO = Path(__file__).resolve().parent.parent
url = [
    l.split("=", 1)[1].strip()
    for l in open(REPO / ".env", encoding="utf-8")
    if l.startswith("DATABASE_URL_SYNC=")
][0]

TRAN = """
    coalesce((r.snapshot_json->'stage'->>'time_limit_seconds')::int, s.time_limit_seconds)
"""

engine = sa.create_engine(url)
with engine.begin() as c:
    hong = c.execute(
        sa.text(f"""
        select r.id, r.duration_seconds, r.ended_at, r.started_at, {TRAN} as tran
        from stage_runs r join stages s on s.id = r.stage_id
        where r.duration_seconds is not null and r.duration_seconds > {TRAN}
        """)
    ).mappings().all()

    if not hong:
        print("khong co dong nao vuot tran — khong sua gi")
        raise SystemExit(0)

    sao_luu = REPO / "scripts" / f"run_durations_backup_{datetime.now():%Y%m%d_%H%M%S}.json"
    sao_luu.write_text(
        json.dumps([{k: str(v) for k, v in row.items()} for row in hong], indent=2),
        encoding="utf-8",
    )

    n = c.execute(
        sa.text(f"""
        update stage_runs r
        set duration_seconds = least(r.duration_seconds, {TRAN}),
            ended_at = r.started_at + make_interval(secs => least(r.duration_seconds, {TRAN})),
            updated_at = now()
        from stages s
        where s.id = r.stage_id
          and r.duration_seconds is not null
          and r.duration_seconds > {TRAN}
        """)
    ).rowcount

    print(f"da sua {n} luot choi · gia tri cu luu o {sao_luu.name}")

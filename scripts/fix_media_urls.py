# -*- coding: utf-8 -*-
"""Đổi đường dẫn media từ TUYỆT ĐỐI sang TƯƠNG ĐỐI.

`media_assets.url` được ghi MỘT LẦN lúc tải file lên, theo `STORAGE_PUBLIC_URL`
tại thời điểm đó. Ghi tuyệt đối (`https://abc.vita.com/media/...`) là đóng đinh
một tên miền vào dữ liệu:

  - nhiều tên miền trỏ vào cùng một bản cài thì tất cả cùng tải ảnh từ MỘT cái;
  - đổi tên miền, hay bỏ cái cũ đi, là mọi ảnh đã tải lên trước đó chết theo;
  - trình duyệt tải ảnh từ origin KHÁC với trang, nên Phaser phải đi qua CORS —
    thêm một thứ để hỏng mà không có gì bù lại.

Tương đối (`/media/...`) thì mỗi tên miền tự phục vụ file của mình và dữ liệu
không biết gì về tên miền cả.

CHẠY ĐƯỢC NHIỀU LẦN: chỉ động vào dòng đang mang một địa chỉ tuyệt đối, và luôn
dựng lại từ `storage_key` — cột định danh file thật, chứ không cắt chuỗi URL cũ.

Ảnh chụp đề bài của các lượt chơi CŨ (`stage_runs.snapshot_json`) vẫn giữ địa
chỉ tuyệt đối: đó là đề bài đã đóng băng, và sửa nó là sửa lịch sử. Lượt chơi
mới đóng băng địa chỉ mới. Nếu vẫn còn lượt đang chơi dở lúc đổi tên miền, bảo
học sinh bấm "Chơi lại" là xong.
"""
import io
import sys
from pathlib import Path

import sqlalchemy as sa

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

REPO = Path(__file__).resolve().parent.parent


def _env(key: str) -> str | None:
    for line in open(REPO / ".env", encoding="utf-8"):
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip()
    return None


url = _env("DATABASE_URL_SYNC")
assert url, "thieu DATABASE_URL_SYNC trong .env"

# Tien to cong khai dang cau hinh. Tuyet doi thi script nay khong con viec gi.
public = (_env("STORAGE_PUBLIC_URL") or "/media").rstrip("/")
if "://" in public:
    print(f"STORAGE_PUBLIC_URL dang la dia chi tuyet doi ({public}) — khong doi gi.")
    print("Dat no thanh /media roi chay lai neu ban muon nhieu ten mien cung dung.")
    raise SystemExit(0)

engine = sa.create_engine(url)
with engine.begin() as c:
    n = c.execute(
        sa.text(
            """
            update media_assets
               set url = :public || '/' || storage_key,
                   updated_at = now()
             where url like '%://%'
            """
        ),
        {"public": public},
    ).rowcount

with engine.connect() as c:
    con_tuyet_doi = c.execute(
        sa.text("select count(*) from media_assets where url like '%://%'")
    ).scalar()
    vi_du = c.execute(sa.text("select url from media_assets order by created_at desc limit 1")).scalar()

print(f"da doi {n} dong · con tuyet doi: {con_tuyet_doi} · vi du: {vi_du}")

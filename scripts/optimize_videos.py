# -*- coding: utf-8 -*-
"""Tối ưu các video ĐÃ tải lên: mục lục lên đầu file + ảnh poster.

Video tải lên từ nay được xử lý tự động (`api/app/modules/media/video.py`).
Script này lo phần đã có trên đĩa từ trước.

    api/.venv/bin/python scripts/optimize_videos.py            # chạy thật
    api/.venv/bin/python scripts/optimize_videos.py --dry-run  # chỉ liệt kê

AN TOÀN:
  - Trước khi ghi đè một video, bản gốc được chép vào `<kho>/_backup_faststart/`
    (cùng đường dẫn con). Muốn hoàn tác thì chép ngược lại.
  - Chỉ ghi đè video có mục lục ở CUỐI. Video đã đúng thì không đụng tới.
  - `-c copy`: không nén lại, chất lượng giữ nguyên từng bit.
  - Database: chỉ cập nhật `size_bytes` của ĐÚNG dòng vừa ghi lại (`WHERE id`).

CHẠY ĐƯỢC NHIỀU LẦN: lần sau thấy mục lục đã ở đầu và poster đã có thì bỏ qua.
"""
import io
import shutil
import struct
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "api"))

import sqlalchemy as sa  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.modules.media.service import storage_root  # noqa: E402
from app.modules.media.video import (  # noqa: E402
    _ffmpeg,
    faststart,
    make_poster,
    poster_path,
)

DRY = "--dry-run" in sys.argv


def moov_o_cuoi(path: Path) -> bool:
    """True nếu atom `moov` đứng SAU `mdat` — tức trình duyệt phải tải tới cuối."""
    size = path.stat().st_size
    pos = 0
    with open(path, "rb") as f:
        while pos < size:
            f.seek(pos)
            head = f.read(8)
            if len(head) < 8:
                return False
            n, kind = struct.unpack(">I4s", head)
            if n == 1:
                n = struct.unpack(">Q", f.read(8))[0]
            if kind == b"moov":
                return False
            if kind == b"mdat":
                return True
            if n == 0:
                return False
            pos += n
    return False


if _ffmpeg() is None:
    print(f"Không tìm thấy ffmpeg ({settings.ffmpeg_path}). Cài ffmpeg hoặc đặt FFMPEG_PATH.")
    raise SystemExit(1)

root = storage_root()
backup = root / "_backup_faststart"
engine = sa.create_engine(settings.database_url_sync)

with engine.connect() as conn:
    rows = conn.execute(
        sa.text("SELECT id, storage_key, size_bytes FROM media_assets WHERE kind = 'video'")
    ).all()

    sua, poster_moi, thieu = 0, 0, 0
    for media_id, key, cu in rows:
        path = root / key
        if not path.exists():
            thieu += 1
            continue

        if path.suffix.lower() == ".mp4" and moov_o_cuoi(path):
            print(f"[faststart] {key}  ({cu or 0:,} byte)")
            if not DRY:
                dich = backup / key
                dich.parent.mkdir(parents=True, exist_ok=True)
                if not dich.exists():
                    shutil.copy2(path, dich)
                if faststart(path):
                    moi = path.stat().st_size
                    conn.execute(
                        sa.text("UPDATE media_assets SET size_bytes = :s WHERE id = :id"),
                        {"s": moi, "id": media_id},
                    )
                    conn.commit()
                    sua += 1
                else:
                    print("   -> ffmpeg lỗi, giữ nguyên tệp gốc")

        if not poster_path(path).exists():
            print(f"[poster]    {key}")
            if not DRY and make_poster(path):
                poster_moi += 1

print(
    f"\nXong. {len(rows)} video; faststart {sua}; poster mới {poster_moi}; "
    f"thiếu tệp {thieu}.{' (dry-run, không ghi gì)' if DRY else ''}"
)
if sua and not DRY:
    print(f"Bản gốc đã chép vào: {backup}")

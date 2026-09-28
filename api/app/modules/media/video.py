"""Tối ưu video lúc tải lên: mục lục lên đầu file, và một ảnh poster.

## Vì sao cần

**Mục lục (`moov`) ở CUỐI file** là mặc định của nhiều phần mềm dựng phim.
Trình duyệt phải đọc được mục lục mới phát được khung hình nào, nên với một
video nền 11–15MB nó phải kéo tới tận cuối file trước — người chơi nhìn một
màn đen chừng một giây mỗi lần vào phòng chờ hay vào màn. `-movflags +faststart`
dời mục lục lên đầu. Chỉ chép lại các luồng (`-c copy`), KHÔNG nén lại: chất
lượng giữ nguyên từng bit, và mất chưa tới một giây.

**Ảnh poster** là khung hình đầu, lưu cạnh file video theo một quy ước cố định:
`<tên video>.poster.jpg` (xem `poster_path`). Trang vẽ ảnh đó NGAY LẬP TỨC trong
lúc video còn đang tải, nên không còn khoảng đen nào — kể cả trên mạng chậm.
Quy ước tên thay vì một cột mới: mọi chỗ đang có URL video (nền thiên hà, phòng
chờ, màn chơi, đề bài đã đóng băng…) tự suy ra được URL poster mà không phải
thêm một trường vào hàng chục schema.

## Không có ffmpeg thì sao

Video VẪN lưu được — chỉ bỏ qua bước tối ưu và ghi một dòng cảnh báo. Thiếu một
công cụ trên server không được biến việc tải bài giảng lên thành lỗi.
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
from pathlib import Path

from app.core.config import settings

log = logging.getLogger(__name__)

#: Đuôi nối vào tên file video để ra tên ảnh poster. Phía web dùng ĐÚNG chuỗi
#: này (`web/src/lib/media.ts`, `posterOf`) — đổi một bên là mất poster.
POSTER_SUFFIX = ".poster.jpg"

#: Bề ngang tối đa của poster. Nó chỉ phải che đúng khoảng một giây chờ video,
#: nên không cần nét hơn video; 1280 đủ cho màn máy bàn mà file chỉ vài chục KB.
POSTER_MAX_WIDTH = 1280

#: Trần thời gian cho một lệnh ffmpeg. `-c copy` trên 32MB mất dưới một giây;
#: chờ quá lâu nghĩa là tệp lạ, và việc tải lên không được treo vì nó.
TIMEOUT_S = 60


def poster_path(video: Path) -> Path:
    return video.with_name(video.name + POSTER_SUFFIX)


def _ffmpeg() -> str | None:
    lenh = settings.ffmpeg_path or "ffmpeg"
    return shutil.which(lenh) or (lenh if Path(lenh).is_file() else None)


def _chay(args: list[str]) -> bool:
    try:
        ket_qua = subprocess.run(
            args,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=TIMEOUT_S,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        log.warning("ffmpeg không chạy được: %s", exc)
        return False
    if ket_qua.returncode != 0:
        log.warning("ffmpeg lỗi (%s): %s", ket_qua.returncode, ket_qua.stderr[-500:])
        return False
    return True


def faststart(video: Path) -> bool:
    """Dời mục lục MP4 lên đầu file, TẠI CHỖ. Trả về True nếu đã ghi lại.

    Ghi ra một tệp tạm cùng thư mục rồi `os.replace` — thao tác nguyên tử: hỏng
    giữa chừng thì tệp gốc còn nguyên, không bao giờ có một video cụt.
    """
    if video.suffix.lower() != ".mp4":
        # WebM không có `moov`; trình duyệt phát được ngay từ đầu tệp.
        return False
    ffmpeg = _ffmpeg()
    if ffmpeg is None:
        log.warning("Không tìm thấy ffmpeg (%s) — bỏ qua faststart", settings.ffmpeg_path)
        return False
    tam = video.with_name(video.stem + ".faststart.tmp.mp4")
    ok = _chay(
        [
            ffmpeg,
            "-y",
            "-v",
            "error",
            "-i",
            str(video),
            "-map",
            "0",
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            str(tam),
        ]
    )
    if not ok or not tam.exists() or tam.stat().st_size == 0:
        tam.unlink(missing_ok=True)
        return False
    os.replace(tam, video)
    return True


def make_poster(video: Path) -> Path | None:
    """Tách khung hình đầu thành `<video>.poster.jpg`. Trả về đường dẫn, hoặc None."""
    ffmpeg = _ffmpeg()
    if ffmpeg is None:
        return None
    dich = poster_path(video)
    ok = _chay(
        [
            ffmpeg,
            "-y",
            "-v",
            "error",
            "-i",
            str(video),
            "-frames:v",
            "1",
            # Thu nhỏ khi rộng hơn trần, giữ tỉ lệ; `-2` giữ chiều cao chẵn.
            "-vf",
            f"scale='min({POSTER_MAX_WIDTH},iw)':-2",
            # Chất lượng JPEG 2 (tốt nhất) … 31. 7: vài trăm KB xuống còn
            # chừng một nửa — poster chỉ che khoảng chờ, video lên là thay ngay.
            "-q:v",
            "7",
            str(dich),
        ]
    )
    if not ok or not dich.exists():
        return None
    return dich


def optimize(video: Path) -> None:
    """Cả hai bước. Gọi trong threadpool — ffmpeg là tiến trình đồng bộ."""
    faststart(video)
    make_poster(video)

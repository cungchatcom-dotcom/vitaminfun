"""Chạy API bằng `python -m app --serve`.

Cố ý KHÔNG nhận --host/--port/--workers. Mọi giá trị đó đọc từ `.env` qua
`settings`. Có tham số dòng lệnh nghĩa là cổng thật nằm ở hai nơi, và sẽ có
ngày chúng lệch nhau. Xem docs/DEPLOY.md §3.
"""

from __future__ import annotations

import argparse
import sys


def main() -> int:
    parser = argparse.ArgumentParser(prog="python -m app")
    parser.add_argument(
        "--serve",
        action="store_true",
        help="Chạy HTTP server. Cấu hình đọc từ .env, không truyền qua dòng lệnh.",
    )
    args = parser.parse_args()

    if not args.serve:
        parser.print_help()
        return 1

    import uvicorn

    from app.core.config import settings

    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        # reload và workers loại trừ nhau; uvicorn báo lỗi nếu bật cả hai.
        reload=settings.api_reload,
        workers=None if settings.api_reload else settings.api_workers,
        log_config=None,  # đã cấu hình structlog trong lifespan
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

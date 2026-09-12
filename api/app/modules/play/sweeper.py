"""CHỐT những lượt chơi đã hết giờ mà không ai quay lại.

## Vì sao cần một vòng quét

Hết giờ chỉ được chốt khi CÓ NGƯỜI HỎI TỚI: `read_run` thấy `seconds_remaining
<= 0` thì gọi `settle_run`. Đường ấy đúng cho người còn ngồi đó, nhưng người
đóng tab giữa chừng thì không bao giờ hỏi nữa — và dòng của họ nằm lại ở trạng
thái `playing` vĩnh viễn.

Hậu quả không phải là một dòng rác: lượt ấy KHÔNG VÀO BÁO CÁO. Chạy thử với một
lớp trăm em thì đúng những em bỏ dở — nhóm đáng xem nhất — là nhóm biến mất khỏi
số liệu. Và lần sau vào lại màn đó, `start_run` thấy một lượt "còn đang chơi" từ
hôm kia nên nối tiếp nó thay vì mở lượt mới.

## Vì sao `SKIP LOCKED`

Hôm nay chạy một tiến trình, mai có thể chạy bốn. Không khoá thì bốn vòng quét
cùng đọc một lượt và cùng đi chốt nó. `FOR UPDATE SKIP LOCKED` cho mỗi dòng về
đúng một tiến trình, và tiến trình nào bận thì bỏ qua chứ không xếp hàng chờ.

## Vì sao chốt TỪNG lượt một giao dịch

Một lượt hỏng — đề bài cũ thiếu khoá, dữ liệu lạ — không được kéo theo cả mẻ.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.logging import logger
from app.db.models import RunStatus, StageRun
from app.db.session import SessionFactory
from app.modules.play import service


async def quet_mot_lan(*, an_han_giay: int = 60) -> int:
    """Chốt mọi lượt đã quá hạn. Trả về số lượt vừa chốt.

    `an_han_giay` là quãng ÂN HẠN sau mốc hết giờ. Không có nó thì vòng quét
    tranh chấp với chính người chơi: em vừa hết giờ đúng lúc đang gửi câu cuối,
    và hai bên cùng chốt một lượt.
    """
    now = datetime.now(UTC)
    da_chot = 0

    async with SessionFactory() as db:
        # Lọc thô bằng `started_at` — trần giờ dài nhất của mọi màn là bao nhiêu
        # thì ở đây không biết, nên lấy rộng tay rồi để `seconds_remaining` đọc
        # đúng trần của từng lượt trong `snapshot_json`. Một lần quét mỗi phút
        # thì con số này không phải chỗ để tối ưu.
        rows = await db.scalars(
            select(StageRun)
            .where(
                StageRun.status == RunStatus.PLAYING,
                StageRun.started_at < now - timedelta(seconds=an_han_giay),
            )
            .order_by(StageRun.started_at)
            .limit(200)
            .with_for_update(skip_locked=True)
        )
        qua_han = [
            run for run in rows if service.seconds_remaining(run) <= 0
        ]

    for run in qua_han:
        try:
            async with SessionFactory() as db:
                moi = await db.get(StageRun, run.id, with_for_update=True)
                if moi is None or moi.status != RunStatus.PLAYING:
                    continue
                if service.seconds_remaining(moi) > 0:
                    continue
                await service.settle_run(db, moi, RunStatus.LOST_TIME)
                da_chot += 1
        except Exception as exc:  # pragma: no cover - phòng thân, không chặn mẻ
            logger.warning("play.sweep.failed", run=str(run.id), error=str(exc))

    if da_chot:
        logger.info("play.sweep.settled", count=da_chot)
    return da_chot


async def chay_vong(*, moi_giay: int) -> None:
    """Vòng lặp nền. Ngủ TRƯỚC khi quét lần đầu: lúc khởi động, mọi thứ khác
    đang tranh nhau tài nguyên và một vòng quét không gấp gáp đến thế."""
    while True:
        try:
            await asyncio.sleep(moi_giay)
            await quet_mot_lan()
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # pragma: no cover
            logger.warning("play.sweep.loop_error", error=str(exc))

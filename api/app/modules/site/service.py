"""Đọc và sửa cấu hình chung. Bảng một dòng."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MediaAsset
from app.db.models.site import SiteConfig
from app.modules.site.schemas import SiteConfigOut, SiteConfigUpdate


async def _hang(db: AsyncSession) -> SiteConfig:
    """Dòng cấu hình duy nhất, tạo nếu chưa có.

    Tạo LÚC CẦN chứ không seed sẵn: một bản cài chưa ai đụng tới thì không có gì
    để lưu, và mọi giá trị trống đều đã có nghĩa mặc định rõ ràng. Seed một dòng
    rỗng chỉ thêm một thứ phải nhớ chạy.
    """
    row = await db.scalar(select(SiteConfig).order_by(SiteConfig.created_at).limit(1))
    if row is not None:
        return row

    row = SiteConfig()
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        # Hai request đầu tiên đến cùng lúc. Không có ràng buộc nào chặn hai
        # dòng, nên nhánh này gần như không xảy ra — nhưng nếu có thì đọc lại
        # vẫn đúng hơn là ném lỗi vào mặt người dùng.
        await db.rollback()
        row = await db.scalar(select(SiteConfig).order_by(SiteConfig.created_at).limit(1))
        if row is None:
            raise
    await db.refresh(row)
    return row


async def _ra(db: AsyncSession, row: SiteConfig) -> SiteConfigOut:
    url = None
    if row.favicon_media_id:
        url = await db.scalar(
            select(MediaAsset.url).where(MediaAsset.id == row.favicon_media_id)
        )
    return SiteConfigOut(
        title_i18n=row.title_i18n or {},
        favicon_media_id=row.favicon_media_id,
        favicon_url=url,
    )


async def doc(db: AsyncSession) -> SiteConfigOut:
    return await _ra(db, await _hang(db))


async def sua(db: AsyncSession, payload: SiteConfigUpdate) -> SiteConfigOut:
    row = await _hang(db)

    if payload.title_i18n is not None:
        # THAY HẲN, không gộp: bỏ một bản dịch đi phải là bỏ được. Giao diện gửi
        # cả bảng mỗi lần lưu, và đó cũng là cách `name_i18n` ở mọi nơi khác làm.
        row.title_i18n = {k: v.strip() for k, v in payload.title_i18n.items() if v and v.strip()}

    if payload.clear_favicon:
        row.favicon_media_id = None
    elif payload.favicon_media_id is not None:
        row.favicon_media_id = payload.favicon_media_id

    await db.commit()
    await db.refresh(row)
    return await _ra(db, row)

"""Seed khung nội dung: Vũ trụ → Thiên hà → World Atlantis → 5 chương.

Cố ý **KHÔNG** seed màn chơi và nhiệm vụ. Đó là việc của giáo viên làm qua giao
diện ở Bước 4 — và nghiệm thu của bước đó chính là *"dựng trọn vẹn Màn 1 từ
giao diện, không cần đụng database"*. Seed sẵn màn chơi là tự tước mất phép thử
đó của mình.

Idempotent: nhận diện theo `name_i18n->>'en'` nên chạy lại bao nhiêu lần cũng
chỉ có một bản.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import configure_logging, logger
from app.db.models import Chapter, Galaxy, PublishStatus, Universe, World
from app.db.models.content import Difficulty
from app.db.session import SessionFactory, dispose_engine
from app.modules.worlds.balance import DEFAULT_BALANCE

UNIVERSE_EN = "The Known Universe"
GALAXY_EN = "Milky Way"
WORLD_EN = "Lost in Atlantis"

#: 5 chương của World 1, theo tài liệu thiết kế Atlantis.
CHAPTERS: list[tuple[int, str, str]] = [
    (1, "Sự cố dưới đáy biển", "Underwater Incident"),
    (2, "Ngoại ô Thành phố Thuỷ tinh", "Outskirts of the Glass City"),
    (3, "Đô thị cổ Hoàng gia", "The Royal Old Town"),
    (4, "Tháp Chúa Trời & Năng lượng Gốc", "The God Tower and the Core"),
    (5, "Cánh cổng Thời gian", "The Time Gate"),
]


async def seed_world(db: AsyncSession) -> None:
    universe = await db.scalar(
        select(Universe).where(Universe.name_i18n["en"].astext == UNIVERSE_EN)
    )
    if universe is None:
        universe = Universe(
            name_i18n={"vi": "Vũ trụ đã biết", "en": UNIVERSE_EN},
            description_i18n={},
            position=1,
            status=PublishStatus.PUBLISHED,
        )
        db.add(universe)
        await db.flush()
        logger.info("seed_universe_created", name=UNIVERSE_EN)

    galaxy = await db.scalar(
        select(Galaxy).where(
            Galaxy.universe_id == universe.id,
            Galaxy.name_i18n["en"].astext == GALAXY_EN,
        )
    )
    if galaxy is None:
        galaxy = Galaxy(
            universe_id=universe.id,
            name_i18n={"vi": "Dải Ngân Hà", "en": GALAXY_EN},
            description_i18n={},
            position=1,
            status=PublishStatus.PUBLISHED,
        )
        db.add(galaxy)
        await db.flush()
        logger.info("seed_galaxy_created", name=GALAXY_EN)

    world = await db.scalar(
        select(World).where(
            World.galaxy_id == galaxy.id,
            World.name_i18n["en"].astext == WORLD_EN,
        )
    )
    if world is None:
        world = World(
            galaxy_id=galaxy.id,
            name_i18n={"vi": "Lạc vào vương quốc huyền thoại", "en": WORLD_EN},
            story_i18n={
                "vi": (
                    "Một cơn bão bất ngờ nhấn chìm con tàu. Bốn bạn nhỏ tỉnh dậy "
                    "dưới đáy biển, giữa vương quốc Atlantis huyền thoại. Để trở "
                    "về nhà, các em phải gom đủ 30 mảnh bản đồ và mở Cánh cổng "
                    "Thời gian."
                ),
                "en": (
                    "A sudden storm sinks the ship. Four children wake up on the "
                    "seabed, in the legendary kingdom of Atlantis. To go home they "
                    "must gather 30 map shards and open the Time Gate."
                ),
            },
            position=1,
            difficulty=Difficulty.EASY,
            age_min=8,
            age_max=12,
            shard_total=30,
            # Giá trị khởi tạo. Từ giờ nguồn chân lý là cột trong database —
            # chỉnh cân bằng là sửa ở đó, không sửa `balance.py`.
            balance_json=dict(DEFAULT_BALANCE),
            # Draft: world chỉ hiện cho học sinh khi giáo viên đã dựng đủ màn và
            # bấm xuất bản. Xem visible_worlds() ở ARCHITECTURE §7.
            status=PublishStatus.DRAFT,
        )
        db.add(world)
        await db.flush()
        logger.info("seed_world_created", name=WORLD_EN)
    else:
        # Bù khoá cân bằng mới thêm vào DEFAULT_BALANCE, nhưng KHÔNG ghi đè giá
        # trị người vận hành đã chỉnh. Ghi đè là làm mất công điều chỉnh của họ.
        missing = {k: v for k, v in DEFAULT_BALANCE.items() if k not in (world.balance_json or {})}
        if missing:
            world.balance_json = {**(world.balance_json or {}), **missing}
            logger.info("seed_world_balance_filled", keys=sorted(missing))

    for order, name_vi, name_en in CHAPTERS:
        existing = await db.scalar(
            select(Chapter).where(Chapter.world_id == world.id, Chapter.order_index == order)
        )
        if existing is None:
            db.add(
                Chapter(
                    world_id=world.id,
                    order_index=order,
                    name_i18n={"vi": name_vi, "en": name_en},
                    synopsis_i18n={},
                )
            )
            logger.info("seed_chapter_created", order=order, name=name_en)

    await db.commit()


async def main() -> None:
    configure_logging()
    logger.info("seed_world_starting", env=settings.app_env)
    async with SessionFactory() as db:
        await seed_world(db)
    await dispose_engine()
    logger.info("seed_world_done")


if __name__ == "__main__":
    asyncio.run(main())

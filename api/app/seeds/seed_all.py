"""Dữ liệu mẫu. Chạy: `python -m app.seeds.seed_all`

LUẬT: seed phải IDEMPOTENT — chạy mười lần cho kết quả giống hệt chạy một lần.
Lệnh deploy gọi seed mỗi lần triển khai (docs/DEPLOY.md §4), nên seed không
idempotent nghĩa là deploy lần hai nhân đôi dữ liệu.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import configure_logging, logger
from app.core.security import hash_password
from app.db.models.user import User, UserRole, UserStatus
from app.db.session import SessionFactory, dispose_engine
from app.seeds.seed_world import seed_world


async def seed_users(db: AsyncSession) -> None:
    """Ba tài khoản mẫu, một cho mỗi vai trò.

    Email và mật khẩu đọc từ `.env` chứ không viết cứng ở đây: mật khẩu mẫu là
    thứ đầu tiên phải đổi khi lên server thật, và không được nằm trong git.
    """
    wanted = [
        (settings.seed_admin_email, "Quản trị viên", UserRole.ADMIN),
        (settings.seed_teacher_email, "Cô Lan", UserRole.TEACHER),
        (settings.seed_student_email, "Bé Minh", UserRole.STUDENT),
    ]

    for email, display_name, role in wanted:
        normalized = email.strip().lower()
        existing = await db.scalar(select(User).where(User.email == normalized))

        if existing is None:
            db.add(
                User(
                    email=normalized,
                    password_hash=hash_password(settings.seed_default_password),
                    display_name=display_name,
                    role=role,
                    status=UserStatus.ACTIVE,
                    locale="en",
                )
            )
            logger.info("seed_user_created", email=normalized, role=role)
            continue

        # Đã có thì chỉ sửa vai trò nếu lệch — KHÔNG đụng vào mật khẩu.
        # Seed chạy lại trên server thật mà đặt lại mật khẩu là một sự cố
        # bảo mật, không phải một tiện ích.
        if existing.role != role:
            existing.role = role
            existing.perm_version += 1  # vô hiệu hoá mọi token cũ
            logger.info("seed_user_role_fixed", email=normalized, role=role)
        else:
            logger.info("seed_user_exists", email=normalized, role=role)

    await db.commit()


async def main() -> None:
    configure_logging()
    logger.info("seed_starting", env=settings.app_env)
    async with SessionFactory() as db:
        await seed_users(db)
        await seed_world(db)
    await dispose_engine()
    logger.info("seed_done")


if __name__ == "__main__":
    asyncio.run(main())

"""Cấu hình chung của trang: tên trang và biểu tượng tab.

Hai endpoint, và chúng có hai tầng quyền KHÁC NHAU — cố ý:

- **ĐỌC thì ai cũng đọc được, kể cả khách chưa đăng nhập.** Cái tên và cái
  favicon nằm trên chính màn hình ĐĂNG NHẬP, tức là ở chỗ chưa có ai để phân
  quyền. Bắt đăng nhập mới đọc được nghĩa là trang đăng nhập mang tên mặc định
  còn mọi trang khác mang tên thật — người dùng thấy hai sản phẩm khác nhau.
  Ở đây cũng không có gì để giấu: một cái tên và một đường dẫn ảnh là thứ hiện
  công khai trên mọi tab trình duyệt.

- **SỬA thì chỉ giáo viên và admin**, như mọi thứ dựng nội dung khác.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.deps import DbDep, require_role
from app.db.models.user import UserRole
from app.modules.site import service
from app.modules.site.schemas import SiteConfigOut, SiteConfigUpdate

router = APIRouter(prefix="/site", tags=["site"])


@router.get("/config", response_model=SiteConfigOut, summary="Cấu hình chung của trang")
async def read_config(db: DbDep) -> SiteConfigOut:
    return await service.doc(db)


@router.patch(
    "/config",
    response_model=SiteConfigOut,
    summary="Sửa cấu hình chung",
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)
async def update_config(payload: SiteConfigUpdate, db: DbDep) -> SiteConfigOut:
    return await service.sua(db, payload)

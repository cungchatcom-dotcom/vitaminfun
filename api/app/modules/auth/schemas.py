"""Schema request/response cho xác thực.

Lưu ý: mọi chuỗi hiển thị đều KHÔNG nằm ở đây. Backend trả dữ liệu + mã lỗi;
Frontend tra `web/messages/*.json` và hiển thị.
"""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255, examples=["teacher@vitaminfun.local"])
    # KHÔNG đặt min_length ở đây. Đây là form ĐĂNG NHẬP, không phải đăng ký:
    #   - gõ nhầm mật khẩu ngắn phải báo "sai mật khẩu", không phải "dữ liệu không hợp lệ"
    #   - ràng buộc độ dài ở đây làm lộ chính sách mật khẩu cho người dò
    #   - tài khoản cũ có mật khẩu ngắn hơn chính sách hiện tại vẫn phải đăng nhập được
    password: str = Field(max_length=128)


class UserSummary(BaseModel):
    """Thông tin đủ để giao diện dựng khung và điều hướng."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str

    #: Literal chứ không phải str: nhờ vậy kiểu TS sinh ra là một union
    #: ba giá trị, và frontend gõ sai tên vai trò sẽ gãy lúc biên dịch.
    role: Literal["admin", "teacher", "student"]
    locale: str | None = None
    avatar_media_id: uuid.UUID | None = None

    #: Trang chủ theo vai trò. Tính ở backend để chỉ có MỘT bảng ánh xạ
    #: vai trò -> route trong cả hệ thống; frontend không tự đoán.
    home_route: str

    #: Vai trò này có được vào chế độ chơi thử không. Giao diện dùng để hiện
    #: thanh cảnh báo chơi thử và nút "Bỏ qua điều kiện mở khoá".
    can_preview: bool


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Số giây còn hiệu lực của access token")
    user: UserSummary

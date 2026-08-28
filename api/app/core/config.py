"""Cấu hình ứng dụng — đọc từ .env, kiểm tra ngay lúc khởi động.

Nguyên tắc: KHÔNG đọc os.environ rải rác trong code. Mọi cấu hình đi qua `settings`.
Thiếu biến bắt buộc thì app chết ngay lúc start, không chết giữa chừng khi có request.

Xem docs/ARCHITECTURE.md §6 nguyên tắc 3: không hardcode giá trị cấu hình.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# api/app/core/config.py -> lên 3 cấp là gốc repo vitaminfun/
REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(REPO_ROOT / ".env", REPO_ROOT / ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ---------- Chung ----------
    app_env: Literal["development", "staging", "production"] = "development"
    app_debug: bool = True
    app_name: str = "Vitaminfun"

    # ---------- PostgreSQL ----------
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/vitaminfun",
        description="Chuỗi kết nối async (asyncpg) — dùng lúc chạy app",
    )
    database_url_sync: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/vitaminfun",
        description="Chuỗi kết nối sync (psycopg) — dùng cho Alembic",
    )
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_echo: bool = False

    # ---------- Bảo mật ----------
    jwt_secret_key: str = Field(default="dev-only-insecure-key-change-me-32chars")
    jwt_algorithm: str = "HS256"
    jwt_access_token_minutes: int = 60 * 12
    jwt_refresh_token_days: int = 30

    # ---------- Lưu trữ media (dùng từ Bước 2) ----------
    storage_backend: Literal["local", "s3"] = "local"
    storage_local_path: str = "./storage"
    storage_public_url: str = "http://localhost:8000/media"

    # ---------- API ----------
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_workers: int = 1
    api_prefix: str = "/api/v1"
    api_reload: bool = False
    cors_origins: str = "http://localhost:3000"

    # ---------- Realtime (bắt buộc từ Bước 7) ----------
    redis_url: str = "redis://localhost:6379/0"
    cache_use_redis: bool = False

    # ---------- Tài khoản mẫu cho seed ----------
    # Để ở .env chứ không viết cứng trong seed: mật khẩu mẫu là thứ đầu tiên
    # phải đổi khi lên server thật, và không được nằm trong git.
    seed_admin_email: str = "admin@vitaminfun.local"
    seed_teacher_email: str = "teacher@vitaminfun.local"
    seed_student_email: str = "student@vitaminfun.local"
    seed_default_password: str = "vitaminfun123"

    # ---------- Kiểm tra ----------
    @field_validator("database_url")
    @classmethod
    def _check_async_driver(cls, v: str) -> str:
        if "+asyncpg" not in v:
            raise ValueError("DATABASE_URL phải dùng driver async: postgresql+asyncpg://...")
        return v

    @field_validator("database_url_sync")
    @classmethod
    def _check_sync_driver(cls, v: str) -> str:
        if "+psycopg" not in v:
            raise ValueError("DATABASE_URL_SYNC phải dùng driver sync: postgresql+psycopg://...")
        return v

    @field_validator("jwt_secret_key")
    @classmethod
    def _check_secret_strength(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("JWT_SECRET_KEY phải dài tối thiểu 32 ký tự")
        return v

    # ---------- Tiện ích ----------
    @computed_field  # type: ignore[prop-decorator]
    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    def model_post_init(self, __context: object) -> None:
        # Chặn sự cố kinh điển: deploy production mà quên đổi khoá bí mật.
        if self.is_production and "dev-only" in self.jwt_secret_key:
            raise ValueError("Không được dùng JWT_SECRET_KEY mặc định ở môi trường production")
        if self.is_production and self.seed_default_password == "vitaminfun123":
            raise ValueError("Không được dùng SEED_DEFAULT_PASSWORD mặc định ở production")


@lru_cache
def get_settings() -> Settings:
    """Cache 1 lần cho cả vòng đời tiến trình."""
    return Settings()


settings = get_settings()

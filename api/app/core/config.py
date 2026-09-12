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

    #: Cho phép người lạ TỰ mở tài khoản (`POST /auth/signup`).
    #:
    #: Một biến, hai phía: API từ chối thẳng khi tắt, còn web đọc cùng biến ấy
    #: từ `.env` ở gốc repo để giấu nút Đăng ký. Giấu nút mà không chặn endpoint
    #: là một cánh cửa vẫn mở cho bất kỳ ai biết gõ `curl`; chặn endpoint mà
    #: không giấu nút là một cái nút bấm vào chỉ để nhận lỗi.
    #:
    #: Tài khoản tự mở LUÔN là học sinh — xem `signup()` trong auth/service.py.
    allow_self_signup: bool = True

    # ---------- Đọc chữ thành tiếng ----------
    #
    # Rỗng = chưa cấu hình, và khi đó `POST /voices/sync` từ chối thẳng thay vì
    # gọi ra ngoài rồi nhận 401. Không có mặc định giả: một khoá API bịa ra chỉ
    # đẩy lỗi xuống tận lúc gọi, ở một chỗ khó lần ra hơn nhiều.
    elevenlabs_api_key: str = ""

    #: Bao nhiêu câu được đọc CÙNG LÚC khi sinh cả mẻ.
    #:
    #: Đây là một HỒ BƠI LUỒNG, không phải từng đợt: luồng nào xong là nhận câu
    #: tiếp ngay. Chia thành đợt mười câu rồi chờ đủ mới sang đợt sau thì cả đợt
    #: phải đứng chờ câu chậm nhất — một câu dài kéo chín câu ngắn đứng im.
    #:
    #: Nhà cung cấp có trần số request ĐỒNG THỜI theo hạng tài khoản, và trần đó
    #: thấp hơn người ta tưởng: hạng thấp chỉ vài luồng, hạng cao mới tới mười
    #: lăm. Năm là mức đi được ở gần hết các hạng.
    #:
    #: Đặt quá tay cũng không vỡ mẻ: gặp 429 thì lùi lại rồi thử tiếp — xem
    #: `_post()` trong `providers.py`. Cái giá của việc đặt quá tay chỉ là chậm.
    elevenlabs_concurrency: int = 5

    # ---------- Lưu trữ media (dùng từ Bước 2) ----------
    storage_backend: Literal["local", "s3"] = "local"
    storage_local_path: str = "./storage"
    storage_public_url: str = "http://localhost:8000/media"

    # ---------- API ----------
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_workers: int = 1

    #: Bao lâu quét một lần để chốt các lượt chơi đã hết giờ, tính bằng giây.
    #:
    #: `0` = tắt hẳn vòng quét. Để tắt được là có chủ ý: khi chạy test, khi chạy
    #: một tiến trình chỉ để migrate, hay khi ai đó muốn dời việc này sang một
    #: cron riêng bên ngoài.
    run_sweep_seconds: int = 60
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

    # ---------- Báo cáo ----------
    #: Múi giờ dùng để cắt NGÀY trong báo cáo của giáo viên.
    #:
    #: "Hôm nay có bao nhiêu người chơi" là một câu hỏi về múi giờ, không phải
    #: về dữ liệu: mốc lưu trong database là `timestamptz`, còn ranh giới nửa
    #: đêm thì tuỳ nơi người đọc đang đứng. Máy chủ chạy ở UTC mà cắt theo UTC
    #: thì với lớp học ở Việt Nam, bảy giờ đầu mỗi ngày bị tính sang hôm trước
    #: — và giáo viên sẽ thấy con số "hôm nay" tụt xuống vào đúng 7 giờ sáng.
    #:
    #: Một biến ở `.env` chứ không viết cứng: cùng bản mã này có thể phục vụ một
    #: trung tâm ở múi giờ khác.
    reports_timezone: str = "Asia/Bangkok"

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

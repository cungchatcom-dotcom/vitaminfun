"""Lưu file tải lên xuống đĩa và ghi bản ghi `media_assets`.

Ba luật ở đây:

1. **Tên file do server đặt**, không dùng tên người dùng gửi lên. Tên gốc chỉ
   lưu để hiển thị. Tin vào tên file của client là mở đường cho `../../etc/passwd`.
2. **Chỉ chấp nhận đuôi trong danh sách trắng.** Danh sách đen luôn thiếu một mục.
3. **Tên file trên đĩa chỉ dùng `a-z0-9-_`.** Ubuntu phân biệt hoa thường và
   không ưa dấu tiếng Việt trong tên file — xem docs/DEPLOY.md §5.2.
"""

from __future__ import annotations

import io
import uuid
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import ErrorCode, ValidationFailedError
from app.db.models import MediaAsset, MediaKind

#: Đuôi file được phép, ánh xạ sang loại và MIME.
#: Danh sách TRẮNG: thêm một dạng mới là một quyết định có ý thức.
ALLOWED: dict[str, tuple[str, str]] = {
    ".png": (MediaKind.IMAGE, "image/png"),
    ".jpg": (MediaKind.IMAGE, "image/jpeg"),
    ".jpeg": (MediaKind.IMAGE, "image/jpeg"),
    ".webp": (MediaKind.IMAGE, "image/webp"),
    ".gif": (MediaKind.IMAGE, "image/gif"),
    ".svg": (MediaKind.IMAGE, "image/svg+xml"),
    ".mp3": (MediaKind.AUDIO, "audio/mpeg"),
    ".ogg": (MediaKind.AUDIO, "audio/ogg"),
    ".wav": (MediaKind.AUDIO, "audio/wav"),
    ".m4a": (MediaKind.AUDIO, "audio/mp4"),
    ".mp4": (MediaKind.VIDEO, "video/mp4"),
    ".webm": (MediaKind.VIDEO, "video/webm"),
}

#: Trần kích thước. Phải khớp `client_max_body_size` của nginx (DEPLOY.md §7),
#: nếu không thì file quá cỡ bị nginx chặn bằng lỗi 413 khó hiểu thay vì bằng
#: mã lỗi có bản dịch của chúng ta.
MAX_BYTES = 32 * 1024 * 1024


def storage_root() -> Path:
    """Thư mục gốc lưu file, tạo nếu chưa có."""
    root = Path(settings.storage_local_path)
    if not root.is_absolute():
        # Đường dẫn tương đối tính từ GỐC REPO, không từ thư mục đang đứng —
        # nếu không thì chạy lệnh từ chỗ khác là file rơi vào chỗ khác.
        from app.core.config import REPO_ROOT

        root = (REPO_ROOT / root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _classify(filename: str) -> tuple[str, str, str]:
    """Trả về (đuôi, loại, mime). Ném lỗi nếu đuôi không được phép."""
    suffix = Path(filename or "").suffix.lower()
    entry = ALLOWED.get(suffix)
    if entry is None:
        raise ValidationFailedError(
            ErrorCode.MEDIA_KIND_NOT_ALLOWED,
            extension=suffix or "(không có đuôi)",
            allowed=sorted(ALLOWED),
        )
    kind, mime = entry
    return suffix, kind, mime


def _image_size(data: bytes) -> tuple[int | None, int | None]:
    """Khổ ảnh, đo NGAY LÚC TẢI LÊN.

    Hai cột `width`/`height` có từ đầu nhưng chưa bao giờ được điền, nên mọi
    chỗ cần biết ảnh to bao nhiêu đều phải tự nạp lại ảnh ở trình duyệt rồi đo.
    Đo một lần ở đây thì cả sản phẩm dùng chung — và quan trọng hơn: con số này
    có mặt NGAY trong phản hồi tải lên, không phải chờ thêm một vòng nạp ảnh.

    Không đo được thì trả `None`. Một tấm SVG hay một file ảnh hỏng vẫn nên lưu
    được; thiếu khổ ảnh là bất tiện, không phải lỗi.
    """
    try:
        from PIL import Image

        with Image.open(io.BytesIO(data)) as image:
            return image.width, image.height
    except Exception:
        return None, None


async def save_upload(
    db: AsyncSession,
    *,
    filename: str,
    data: bytes,
    uploaded_by_id: uuid.UUID | None,
    folder: str | None = None,
) -> MediaAsset:
    if not data:
        raise ValidationFailedError(ErrorCode.MEDIA_EMPTY_FILE)
    if len(data) > MAX_BYTES:
        raise ValidationFailedError(
            ErrorCode.MEDIA_TOO_LARGE, maxBytes=MAX_BYTES, actualBytes=len(data)
        )

    suffix, kind, mime = _classify(filename)

    # Tên do server đặt: uuid4 hex + đuôi đã lọc. Chỉ chứa a-z0-9 và dấu chấm.
    # Chia theo thư mục con 2 ký tự để một thư mục không phình lên hàng vạn file.
    stem = uuid.uuid4().hex
    storage_key = f"{kind}/{stem[:2]}/{stem}{suffix}"

    target = storage_root() / storage_key
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)

    width, height = _image_size(data) if kind == MediaKind.IMAGE else (None, None)

    asset = MediaAsset(
        url=f"{settings.storage_public_url.rstrip('/')}/{storage_key}",
        storage_key=storage_key,
        kind=kind,
        mime=mime,
        original_name=(filename or "")[:255] or None,
        size_bytes=len(data),
        width=width,
        height=height,
        folder=folder,
        uploaded_by_id=uploaded_by_id,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset

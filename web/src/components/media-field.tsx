'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-error';
import { AUDIO_ACCEPT, VIDEO_ACCEPT, uploadMedia } from '@/lib/media';

/** Một tệp đã tải lên. `null` cả hai = chưa có gì. */
export interface MediaValue {
  mediaId: string | null;
  /** URL để nghe/xem thử ngay tại chỗ. Server dựng sẵn. */
  url: string | null;
}

/** Đuôi file cho phép, suy từ `kind` — hai chỗ không lệch nhau được. */
const ACCEPT: Record<'audio' | 'video', string> = {
  audio: AUDIO_ACCEPT,
  video: VIDEO_ACCEPT,
};

/**
 * Tải lên / xem thử / gỡ MỘT tệp media.
 *
 * Dùng chung cho ba chỗ: câu hỏi nghe, lời chia tay của NPC, và video mở màn.
 * Ba chỗ đó lưu vào ba cột khác nhau nhưng thao tác thì giống hệt, và ba bản
 * chép của cùng một ô tải file sẽ lệch nhau đúng vào lúc ai đó sửa một bên —
 * thường là ở chỗ `event.target.value = ''`, và hậu quả là chọn lại cùng một
 * file thì im lặng không làm gì.
 *
 * `kind` quyết định CẢ đuôi file cho phép LẪN thẻ xem thử: hai thứ đó phải khớp
 * nhau, nên chúng suy từ một tham số chứ không nhận riêng.
 *
 * Component này KHÔNG biết mạng ngoài việc tải file lên kho media rồi báo id và
 * URL cho chỗ gọi. Lưu id đó vào đâu là việc của chỗ gọi.
 */
export function MediaField({
  kind,
  value,
  onChange,
  folder,
  removeLabel,
  disabled = false,
  /** Nhắc gì khi chưa có file. Mỗi chỗ dùng có một hậu quả khác nhau. */
  emptyHint,
  /**
   * Độ dài tệp, giây, đọc từ metadata của chính file vừa tải lên.
   *
   * ĐO chứ không lưu: `<video>` biết con số này sau khi đọc metadata, và một
   * cột "thời lượng" trong database chỉ là bản sao có thể lệch với file mà
   * không ai kiểm được. Chỗ gọi dùng nó để CẢNH BÁO, không để chặn.
   */
  onDuration,
  actions,
}: {
  kind: 'audio' | 'video';
  value: MediaValue;
  onChange: (next: MediaValue) => void;
  /** Thư mục trong kho media, để sau này tìm lại được theo nhóm. */
  folder: string;
  removeLabel: string;
  disabled?: boolean;
  emptyHint?: string;
  onDuration?: (seconds: number) => void;
  /**
   * Nút thêm, đặt CÙNG HÀNG với nút Gỡ nhưng căn phải.
   *
   * Sinh giọng đọc là một cách LÀM RA cái tệp này, ngang hàng với tải lên — nên
   * nút của nó thuộc về đây, cạnh tệp nó tạo ra, chứ không nằm ở một khối khác
   * cách mấy dòng.
   */
  actions?: ReactNode;
}) {
  const t = useTranslations();
  const [uploading, setUploading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setErrorKey(null);
    try {
      const asset = await uploadMedia(file, folder);
      onChange({ mediaId: asset.id, url: asset.url });
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    } finally {
      setUploading(false);
    }
  }

  // Xem thử ngay tại chỗ. Tải lên xong mà phải mở màn học sinh mới biết mình có
  // nhầm file không là một vòng lặp quá dài cho một việc rất dễ sai.
  const preview = value.url ? (
    kind === 'audio' ? (
      <audio
        src={value.url}
        controls
        // Thanh ngang THẤP. Trình phát mặc định cao chừng 54px và chiếm mất
        // cả một khoảng trong cột cấu hình — ở đây nó chỉ để nghe kiểm tra
        // một lần, không phải để ngồi nghe.
        className="h-8 w-full"
        preload="metadata"
        onLoadedMetadata={(e) => onDuration?.(e.currentTarget.duration)}
      />
    ) : (
      <video
        src={value.url}
        controls
        // `muted` cho khung xem thử: người dựng bấm nút khi họ muốn nghe. Một
        // đoạn video tự rống lên giữa trình thiết kế là thứ ai cũng vội tắt.
        muted
        playsInline
        className="w-full rounded-lg border border-abyss-700 bg-black"
        preload="metadata"
        onLoadedMetadata={(e) => onDuration?.(e.currentTarget.duration)}
      />
    )
  ) : null;

  return (
    <div className="space-y-2">
      {preview}

      <input
        type="file"
        accept={ACCEPT[kind]}
        disabled={disabled || uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          // Xoá để chọn LẠI CÙNG một file vẫn bắn `change`. Không có dòng này
          // thì sửa file rồi tải lại lần hai sẽ im lặng không làm gì.
          event.target.value = '';
        }}
        className="block w-full text-xs text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-abyss-800 file:px-2.5 file:py-1 file:text-slate-200 hover:file:bg-abyss-700"
      />

      {uploading && <p className="text-xs text-slate-500">{t('common.loading')}</p>}
      {errorKey && <p className="text-xs text-coral-500">{t(errorKey)}</p>}

      {!value.mediaId && !uploading && emptyHint && (
        <p className="text-[11px] leading-snug text-orichalcum-400">⚠ {emptyHint}</p>
      )}

      {/* HÀNG THAO TÁC: gỡ ở trái, việc khác căn phải.
          Nút Gỡ là NÚT thật chứ không phải một dòng chữ gạch chân — nó xoá một
          thứ, và một thao tác xoá trông như chú thích thì hoặc bị bỏ sót, hoặc
          bị bấm nhầm. */}
      {((value.mediaId && !uploading) || actions) && (
        <div className="flex flex-wrap items-center gap-2">
          {value.mediaId && !uploading && (
            <Button
              variant="danger"
              size="sm"
              disabled={disabled}
              onClick={() => onChange({ mediaId: null, url: null })}
            >
              {removeLabel}
            </Button>
          )}
          {actions && <div className="ml-auto">{actions}</div>}
        </div>
      )}
    </div>
  );
}

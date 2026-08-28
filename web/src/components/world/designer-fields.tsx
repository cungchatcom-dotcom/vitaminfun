'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';

import { FRAME_FONT } from '@/game/world';

/**
 * Hai ô nhập dùng chung cho trình thiết kế BẢN ĐỒ THIÊN HÀ và trình thiết kế
 * PHÒNG CHỜ của world. Hai màn hình sắp đặt thứ khác nhau, nhưng chọn ảnh và
 * chỉnh chữ thì giống hệt — và hai bản sao của cùng một ô nhập sẽ lệch nhau
 * đúng vào lần thứ ba ai đó sửa một bên.
 */

/** Ô chọn file dùng chung cho ảnh nền và nhạc nền. */
export function MediaPicker({
  label,
  accept,
  busy,
  hasValue,
  preview,
  onPick,
  onClear,
  clearLabel,
}: {
  label: string;
  accept: string;
  busy: boolean;
  hasValue: boolean;
  preview: ReactNode;
  onPick: (file: File) => void;
  onClear: () => void;
  /** Chữ cho nút gỡ. Ở phòng chờ world thì gỡ = "quay về dùng của thiên hà",
      không phải "xoá trắng" — cùng một nút, hai câu chuyện khác nhau. */
  clearLabel?: string;
}) {
  const t = useTranslations();
  return (
    <div>
      <span className="field-label">{label}</span>
      {preview}
      <input
        type="file"
        accept={accept}
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          // Xoá để chọn LẠI ĐÚNG file vừa chọn vẫn bắn ra `change`.
          e.target.value = '';
        }}
        className="block w-full text-xs text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-abyss-800 file:px-2.5 file:py-1 file:text-slate-200 hover:file:bg-abyss-700"
      />
      {busy && <p className="mt-1 text-xs text-slate-500">{t('common.loading')}</p>}
      {hasValue && !busy && (
        <button
          type="button"
          onClick={onClear}
          className="mt-1 text-xs text-slate-500 hover:text-coral-500"
        >
          {clearLabel ?? t('galaxy.designer.removeMedia')}
        </button>
      )}
    </div>
  );
}

/**
 * Màu chữ và cỡ chữ cho một cái khung.
 *
 * **Xem trước liên tục, ghi xuống một lần** — cùng luật với thanh trượt cỡ chữ,
 * và với `ghost`/`sizeDraft` của bộ kéo thả. Chọn màu trong bảng là khung đổi
 * màu NGAY (`onPreview`), còn lệnh ghi chỉ chạy lúc bảng đóng (`onBlur`).
 *
 * Vì sao không ghi thẳng mỗi lần đổi: bảng chọn màu của trình duyệt bắn sự kiện
 * theo từng nhịp con trỏ trong dải màu — hàng trăm cái cho một lần chọn — nên
 * ghi thẳng là hàng trăm lượt gọi server. Tệ hơn: bảng điều khiển khối vẽ lại
 * sau mỗi lần ghi, mà vẽ lại thì chính ô màu bị gắn lại và bảng chọn ĐANG MỞ
 * đóng sập ngay giữa lúc người ta đang chọn.
 *
 * Ô màu vì thế phải là ô CÓ ĐIỀU KHIỂN (`value`, không phải `defaultValue`):
 * màu đang xem trước là của riêng nó cho tới lúc chốt. `useEffect` đồng bộ lại
 * khi giá trị thật đổi từ nơi khác — gỡ màu riêng của world thì nó thừa của
 * thiên hà, và cái ô phải hiện màu mới ấy chứ không phải màu vừa bị gỡ.
 */
export function FrameTextFields({
  color,
  fontScale,
  onColor,
  onFontScale,
  onPreview,
}: {
  color: string;
  fontScale: number;
  /** Chốt màu: gọi MỘT lần, lúc bảng chọn đóng. */
  onColor: (value: string) => void;
  onFontScale: (value: number) => void;
  /**
   * Màu đang rê tới: gọi liên tục, chỉ để vẽ. `null` = thôi xem trước, quay về
   * giá trị thật. Bỏ trống cả prop thì không xem trước gì cả.
   */
  onPreview?: (value: string | null) => void;
}) {
  const t = useTranslations();
  const [size, setSize] = useState(fontScale);
  const [tint, setTint] = useState(color);

  useEffect(() => setTint(color), [color]);

  // HAI DÒNG, không một dòng. Nhãn + ô màu + nhãn + thanh trượt + số phần trăm
  // xếp ngang không lọt bề rộng cột phải: nhãn xuống dòng và con số bị cắt mất
  // đuôi — đúng cái nhìn thấy khi thử lần đầu.
  return (
    <div className="mt-2 space-y-2">
      <label className="flex items-center gap-2">
        <input
          type="color"
          value={tint}
          onChange={(e) => {
            setTint(e.target.value);
            onPreview?.(e.target.value);
          }}
          onBlur={(e) => {
            if (e.target.value !== color) onColor(e.target.value);
            // Đóng bảng mà màu không đổi thì không ghi gì — nhưng vẫn phải tắt
            // xem trước, nếu không thì màu tạm ở lại đè lên giá trị thật cho
            // tới lượt vẽ sau, và lần đổi màu tiếp theo từ nơi khác không hiện.
            else onPreview?.(null);
          }}
          // Ba lớp cùng cần thiết. `p-0` là của chính thẻ input; hai lớp kia
          // nhắm vào phần RUỘT do trình duyệt tự vẽ — Chrome bọc ô màu trong
          // một `::-webkit-color-swatch-wrapper` có đệm và nền sáng riêng, nên
          // không chạm tới nó thì ô màu hiện ra là một khung TRẮNG dù giá trị
          // bên trong là màu gì đi nữa. Đúng thứ nhìn thấy khi thử lần đầu.
          className="h-7 w-10 shrink-0 cursor-pointer rounded border border-abyss-700 bg-transparent p-0 [&::-moz-color-swatch]:rounded [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0"
        />
        <span className="text-xs text-slate-400">{t('galaxy.designer.textColor')}</span>
      </label>

      <label className="flex items-center gap-2">
        <span className="shrink-0 text-xs text-slate-400">{t('galaxy.designer.textSize')}</span>
        <input
          type="range"
          min={FRAME_FONT.min}
          max={FRAME_FONT.max}
          step={5}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          onPointerUp={() => size !== fontScale && onFontScale(size)}
          onKeyUp={() => size !== fontScale && onFontScale(size)}
          className="min-w-0 flex-1 accent-lagoon-400"
        />
        <span className="w-9 shrink-0 text-right font-mono text-xs text-slate-400">{size}%</span>
      </label>
    </div>
  );
}

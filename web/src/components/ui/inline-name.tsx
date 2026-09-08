'use client';

import { useEffect, useState } from 'react';

/**
 * Một cái tên bấm vào là sửa được tại chỗ.
 *
 * Không có nút "Sửa", không có nút "Lưu": gạch chân chấm chấm nói rằng chữ này
 * bấm được, và rời ô hoặc bấm Enter là lưu. Đây là kiểu sửa dành cho những chỗ
 * mà cái tên CHÍNH LÀ tiêu đề người ta đang nhìn — dựng thêm một biểu mẫu quanh
 * nó là bắt người dùng đi vòng để đổi một chuỗi.
 *
 * **Rỗng thì huỷ, không lưu.** Xoá sạch rồi rời ô nghĩa là "thôi", không phải
 * "đặt tên thành chuỗi rỗng" — một màn chơi hay một nhiệm vụ không tên thì
 * không còn tra ra được ở bất cứ danh sách nào.
 */
export function InlineName({
  value,
  onCommit,
  onStartEditing,
  title,
  className = '',
}: {
  value: string;
  onCommit: (next: string) => void;
  /** Chạy ngay trước khi ô mở ra — dùng để chọn luôn dòng đang sửa. */
  onStartEditing?: () => void;
  /** Chữ hiện khi rê chuột, và nhãn cho trình đọc màn hình. */
  title: string;
  /** Lớp CSS cho phần CHỮ, để chỗ gọi quyết định cỡ chữ. */
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  // Tên đổi từ nơi khác (server trả về) thì đồng bộ lại.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (!next) {
      setDraft(value);
      return;
    }
    if (next !== value) onCommit(next);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          onStartEditing?.();
          setEditing(true);
        }}
        title={title}
        className={`rounded px-1 text-left underline decoration-dotted decoration-slate-600 underline-offset-4 transition hover:bg-abyss-800 hover:decoration-lagoon-400 ${className}`}
      >
        {value}
      </button>
    );
  }

  return (
    <input
      className={`field-input px-1.5 py-0.5 ${className}`}
      value={draft}
      aria-label={title}
      // autoFocus đúng chỗ ở đây: ô chỉ xuất hiện do người dùng vừa bấm vào, nên
      // con trỏ nhảy vào là điều họ đang mong đợi.
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}

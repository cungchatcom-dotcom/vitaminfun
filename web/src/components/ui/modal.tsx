'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Hộp thoại phủ toàn màn hình, vẽ THẲNG VÀO `document.body`.
 *
 * Cái portal không phải để cho sang: nó sửa một lỗi thật. `position: sticky` và
 * `position: fixed` LUÔN tạo ra một *stacking context* riêng, và mọi `z-index`
 * bên trong chỉ có nghĩa BÊN TRONG cái hộp đó. Hộp thoại `z-50` nằm trong cột
 * phải `sticky` vì thế vẫn bị khung xem trước `z-10` ở cột trái đè lên — hai
 * con số không so với nhau được, chúng ở hai thế giới khác nhau.
 *
 * Vẽ vào `body` thì hộp thoại nằm ngoài mọi stacking context của trang, và
 * `z-50` lại có nghĩa như người viết nó tưởng.
 *
 * `mounted` để tránh lệch giữa HTML dựng ở server và DOM ở trình duyệt:
 * `document` chưa tồn tại lúc dựng trên server, nên lượt vẽ đầu tiên trả `null`.
 */
export function Modal({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    // Esc để đóng. Hộp thoại nào cũng nên có, và gom về đây thì không hộp nào
    // quên. Nghe ở `window` vì tiêu điểm có thể đang nằm ở một ô nhập bên trong.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-50 flex items-center justify-center bg-abyss-950/85 p-4"
      // Bấm ra NỀN thì đóng. Dùng `mouseDown` chứ không `click`: bấm bên trong
      // rồi kéo tay ra ngoài mới nhả cũng tính là một `click` trên nền, và hộp
      // thoại đóng mất giữa lúc người ta đang bôi đen một đoạn chữ.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

import Link from 'next/link';

import type { ReactNode } from 'react';

export interface Crumb {
  label: ReactNode;
  /** Không có href = đang đứng ở đây, hiện dạng chữ thường. */
  href?: string;
}

/**
 * Đường dẫn phân cấp + lối quay lại.
 *
 * Dùng `<Link>` chứ không phải `router.back()`: người dùng có thể vào thẳng
 * một màn chơi bằng URL (chính là cách nút "Chơi thử" mở tab mới), lúc đó
 * lịch sử trình duyệt trống và `back()` không đưa họ đi đâu cả.
 */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  const parent = [...items].reverse().find((c) => c.href);

  return (
    <nav aria-label="breadcrumb" className="mb-4">
      {/* Lối quay lại to, bấm được bằng ngón tay — trên điện thoại thì dãy
          breadcrumb bên dưới quá nhỏ để bấm chính xác. */}
      {parent?.href && (
        <Link
          href={parent.href}
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-slate-300 no-underline transition hover:text-lagoon-400"
        >
          <span aria-hidden>←</span> {parent.label}
        </Link>
      )}

      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>/</span>}
            {item.href ? (
              <Link
                href={item.href}
                className="text-slate-400 no-underline transition hover:text-lagoon-400"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-slate-300">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

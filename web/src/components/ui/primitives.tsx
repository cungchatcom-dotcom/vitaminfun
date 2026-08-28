import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-abyss-800 text-slate-300',
  success: 'bg-emerald-500/15 text-emerald-400',
  warning: 'bg-orichalcum-500/15 text-orichalcum-400',
  danger: 'bg-coral-500/15 text-coral-500',
  info: 'bg-lagoon-500/15 text-lagoon-400',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children?: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export function Card({
  className = '',
  padded = true,
  children,
}: {
  className?: string;
  padded?: boolean;
  children?: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-abyss-800 bg-abyss-900/50 ${padded ? 'p-5' : ''} ${className}`}
    >
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  description,
  badge,
  actions,
}: {
  title: ReactNode;
  /** `subtitle` và `description` là một; giữ cả hai tên cho các component copy từ LMS. */
  subtitle?: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  const sub = subtitle ?? description;
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-100">{title}</h1>
          {badge}
        </div>
        {sub && <p className="mt-1 text-sm text-slate-400">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children }: { children?: ReactNode }) {
  return (
    <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-300 uppercase">
      {children}
    </h2>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-abyss-800 ${className}`} />;
}

export function EmptyState({ label, hint }: { label: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-abyss-700 px-6 py-10 text-center">
      <p className="text-slate-400">{label}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

/**
 * Bảng dữ liệu đơn giản.
 *
 * `rows` là mảng các ô đã dựng sẵn chứ không phải object + định nghĩa cột: bảng
 * ở đây luôn có ô chứa nút bấm và huy hiệu, nên một lớp trừu tượng "cột" sẽ tốn
 * nhiều mã hơn là tiết kiệm.
 *
 * Bọc trong `overflow-x-auto` để bảng rộng tự cuộn ngang thay vì đẩy cả trang.
 */
export function DataTable({
  columns,
  rows,
  emptyLabel,
}: {
  columns: ReactNode[];
  rows: ReactNode[][];
  emptyLabel?: ReactNode;
}) {
  if (rows.length === 0 && emptyLabel) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-slate-400">
          <tr>
            {columns.map((col, i) => (
              <th key={i} className="px-4 py-2 font-medium whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, r) => (
            <tr key={r} className="border-t border-abyss-800/60">
              {cells.map((cell, c) => (
                <td key={c} className="px-4 py-2 align-top text-slate-200">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

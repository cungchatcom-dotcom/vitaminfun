import Link from 'next/link';

import type { ReactNode } from 'react';

import type { ButtonSize, ButtonVariant } from './button';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-lagoon-500 text-abyss-950 hover:bg-lagoon-400 font-semibold',
  secondary: 'border border-abyss-700 text-slate-200 hover:border-lagoon-500 hover:text-lagoon-400',
  ghost: 'text-slate-300 hover:text-lagoon-400',
  danger: 'border border-coral-500/50 text-coral-500 hover:bg-coral-500/10',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
};

/**
 * Trông như nút, hoạt động như liên kết.
 *
 * Dùng cái này khi thao tác là ĐIỀU HƯỚNG. Một `<button onClick={router.push}>`
 * không cho mở tab mới bằng chuột giữa, không hiện địa chỉ đích ở thanh trạng
 * thái, và trình đọc màn hình đọc nhầm nó thành nút bấm.
 */
export function LinkButton({
  href,
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-lg transition ${VARIANT[variant]} ${SIZE[size]} ${className}`}
    >
      {children}
    </Link>
  );
}

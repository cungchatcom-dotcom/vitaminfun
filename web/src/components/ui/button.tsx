'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

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

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Đang chạy: khoá nút và đổi con trỏ. Dùng chung với `useAsyncAction`. */
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      // `type="button"` là mặc định CÓ CHỦ Ý: mặc định của HTML là "submit",
      // nên một nút phụ đặt trong form sẽ vô tình gửi cả form.
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

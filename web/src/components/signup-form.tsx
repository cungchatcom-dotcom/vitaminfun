'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { localizedPath } from '@/lib/routes';

interface SignupError {
  error?: { code?: string; params?: Record<string, unknown> };
}

/**
 * Dạng email, kiểm NGAY TRONG TRÌNH DUYỆT trước khi gửi.
 *
 * Bản sao của `EMAIL_RE` bên `api/app/modules/auth/service.py` — và là bản sao
 * CÓ Ý THỨC, không phải trùng lặp lỡ tay: máy chủ vẫn kiểm lại, vì mọi thứ đi
 * qua mạng đều sửa được. Cái này chỉ để người gõ thiếu chữ `@` biết ngay tại
 * chỗ thay vì sau một vòng đi về.
 */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

/** Giữ bằng `MIN_PASSWORD_LENGTH` phía API. */
const MIN_PASSWORD = 8;

export function SignupForm() {
  const t = useTranslations('signup');
  const tError = useTranslations('error');
  const router = useRouter();
  const locale = useLocale();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorParams, setErrorParams] = useState<Record<string, unknown>>({});
  const [pending, setPending] = useState(false);

  function bao(code: string, params: Record<string, unknown> = {}) {
    setErrorCode(code);
    setErrorParams(params);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorCode(null);

    // Kiểm tại chỗ TRƯỚC khi gửi — cùng ba luật máy chủ sẽ kiểm lại.
    if (!EMAIL_RE.test(email.trim())) return bao('SIGNUP_EMAIL_INVALID');
    if (!displayName.trim()) return bao('SIGNUP_NAME_REQUIRED');
    if (password.length < MIN_PASSWORD) {
      return bao('SIGNUP_PASSWORD_TOO_SHORT', { min: MIN_PASSWORD });
    }

    setPending(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          display_name: displayName.trim(),
          password,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as SignupError;
        bao(payload.error?.code ?? 'INTERNAL_ERROR', payload.error?.params ?? {});
        setPending(false);
        return;
      }

      // Mở tài khoản xong LÀ ĐÃ ĐĂNG NHẬP: route handler đặt cookie phiên ngay
      // trong lời gọi này. Đi thẳng về nhà theo vai trò, không quay lại
      // `/login` bắt gõ lại đúng thứ vừa gõ.
      const { home_route } = (await response.json()) as { home_route: string };
      router.replace(localizedPath(home_route, locale));
      router.refresh();
    } catch {
      bao('NETWORK');
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="signup-email" className="mb-1 block text-sm text-slate-300">
          {t('email')}
        </label>
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-abyss-700 bg-abyss-900 px-3 py-2 text-slate-100 outline-none focus:border-lagoon-500"
        />
      </div>

      <div>
        <label htmlFor="signup-name" className="mb-1 block text-sm text-slate-300">
          {t('displayName')}
        </label>
        <input
          id="signup-name"
          type="text"
          autoComplete="name"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-lg border border-abyss-700 bg-abyss-900 px-3 py-2 text-slate-100 outline-none focus:border-lagoon-500"
        />
      </div>

      <div>
        <label htmlFor="signup-password" className="mb-1 block text-sm text-slate-300">
          {t('password')}
        </label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-abyss-700 bg-abyss-900 px-3 py-2 text-slate-100 outline-none focus:border-lagoon-500"
        />
        <p className="mt-1 text-xs text-slate-500">{t('passwordHint', { min: MIN_PASSWORD })}</p>
      </div>

      {errorCode && (
        <p role="alert" className="rounded-lg bg-coral-500/15 px-3 py-2 text-sm text-coral-500">
          {/* Backend chỉ trả mã lỗi; chữ hiển thị nằm ở messages/*.json */}
          {tError(errorCode, errorParams as never)}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-lagoon-500 px-4 py-2.5 font-semibold text-abyss-950 transition hover:bg-lagoon-400 disabled:opacity-50"
      >
        {pending ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}

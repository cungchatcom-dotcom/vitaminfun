'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { localizedPath } from '@/lib/routes';

interface LoginError {
  error?: { code?: string };
}

export function LoginForm() {
  const t = useTranslations('login');
  const tError = useTranslations('error');
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrorCode(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as LoginError;
        setErrorCode(payload.error?.code ?? 'INTERNAL_ERROR');
        setPending(false);
        return;
      }

      const { home_route } = (await response.json()) as { home_route: string };
      // Đăng nhập xong quay lại đúng chỗ đang muốn vào, nếu có.
      //
      // `next` do middleware dựng từ URL thật nên đã sẵn tiền tố ngôn ngữ.
      // `home_route` thì backend trả về trần ('/play'), phải tự gắn tiền tố —
      // không thì đăng nhập ở `/vi/login` xong bị ném sang bản tiếng Anh.
      const next = searchParams.get('next');
      router.replace(
        next && next.startsWith('/') ? next : localizedPath(home_route, locale),
      );
      router.refresh();
    } catch {
      setErrorCode('NETWORK');
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-slate-300">
          {t('email')}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-abyss-700 bg-abyss-900 px-3 py-2 text-slate-100 outline-none focus:border-lagoon-500"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm text-slate-300">
          {t('password')}
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-abyss-700 bg-abyss-900 px-3 py-2 text-slate-100 outline-none focus:border-lagoon-500"
        />
      </div>

      {errorCode && (
        <p role="alert" className="rounded-lg bg-coral-500/15 px-3 py-2 text-sm text-coral-500">
          {/* Backend chỉ trả mã lỗi; chữ hiển thị nằm ở messages/*.json */}
          {tError(errorCode)}
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

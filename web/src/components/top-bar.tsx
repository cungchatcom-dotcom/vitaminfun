'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { localizedPath } from '@/lib/routes';
import { HOME_ROUTE } from '@/lib/session';

import { useCurrentUser } from './auth-context';
import { LocaleSwitcher } from './locale-switcher';

/** Thanh trên cùng dùng chung cho mọi vai trò. */
export function TopBar({ accent }: { accent: 'teacher' | 'student' | 'admin' }) {
  const t = useTranslations('nav');
  const tRole = useTranslations('role');
  const tApp = useTranslations('app');
  const user = useCurrentUser();
  const router = useRouter();
  const locale = useLocale();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  const accentClass = {
    teacher: 'text-lagoon-400',
    student: 'text-orichalcum-400',
    admin: 'text-coral-500',
  }[accent];

  return (
    <header className="flex items-center justify-between border-b border-abyss-800 bg-abyss-900/70 px-6 py-3">
      <div className="flex items-baseline gap-3">
        {/* Tên sản phẩm là lối về trang chủ.
            Đích lấy từ `HOME_ROUTE` — cùng bảng mà middleware và backend dùng để
            điều hướng sau khi đăng nhập. Viết tay '/play' hay '/teacher' ở đây là
            tạo bản sao thứ ba của một luật đã có hai bản phải khớp nhau.
            `<Link>` chứ không phải `<button onClick={router.push}>`: đây là điều
            hướng, nên phải mở được tab mới bằng chuột giữa và hiện địa chỉ đích. */}
        <Link
          href={localizedPath(HOME_ROUTE[user.role], locale)}
          className={`font-bold no-underline transition hover:opacity-80 ${accentClass}`}
        >
          {tApp('name')}
        </Link>
        <span className="rounded-full bg-abyss-800 px-2.5 py-0.5 text-xs text-slate-300">
          {tRole(user.role)}
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm">
        {/* Quản lý nhân vật CHỈ hiện với người dựng nội dung. Học sinh CHỌN
            nhân vật lúc vào world, không sửa chúng — một lối vào mà bấm thì
            gặp 403 còn tệ hơn là không có lối nào. */}
        {(user.role === 'teacher' || user.role === 'admin') && (
          <Link
            href={localizedPath('/teacher/characters', locale)}
            className="text-slate-300 no-underline transition hover:text-lagoon-400"
          >
            {t('characters')}
          </Link>
        )}
        <LocaleSwitcher />
        <span className="text-slate-300">{user.display_name}</span>
        <button
          type="button"
          onClick={logout}
          className="rounded-lg border border-abyss-700 px-3 py-1.5 text-slate-300 transition hover:border-coral-500 hover:text-coral-500"
        >
          {t('logout')}
        </button>
      </div>
    </header>
  );
}

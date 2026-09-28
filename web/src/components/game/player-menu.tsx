'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { useCurrentUser } from '../auth-context';

/**
 * Tài khoản của học sinh, gói trong MỘT NÚT TRÒN ở góc màn.
 *
 * Thay cho thanh trên cùng. Thanh ấy chạy ngang hết bề rộng để chở đúng ba thứ
 * — tên trang, tên người, nút đăng xuất — và đổi lại nó ăn khoảng 56px chiều
 * cao. Trên máy tính thì phí; xoay ngang điện thoại thì đó là một phần tám màn
 * hình, cắt thẳng vào tấm bản đồ 16:9 vốn đã phải co để vừa chiều cao. Tên
 * trang thì chính tấm bản đồ đã viết to giữa màn, còn tên người và lối đăng
 * xuất là thứ dùng một lần mỗi buổi — không đáng một dải cố định.
 *
 * Nên nó thành một nút tròn NỔI trên tấm bản đồ, đứng cạnh nút loa ở cùng góc:
 * không chiếm chiều cao nào cả, và vẫn luôn ở trong tầm mắt.
 *
 * Chữ cái đầu của tên chứ không phải hình người chung chung: máy phòng học dùng
 * chung, và nhìn thấy chữ cái của mình là cách nhanh nhất biết người trước đã
 * đăng xuất chưa.
 */
export function PlayerMenu({ className = '' }: { className?: string }) {
  const t = useTranslations('nav');
  const tRole = useTranslations('role');
  const user = useCurrentUser();
  const router = useRouter();

  const [mo, setMo] = useState(false);
  const boc = useRef<HTMLDivElement>(null);

  // Bấm ra ngoài hoặc Esc thì đóng. Nghe ở `pointerdown` chứ không `click`: cú
  // bấm vào một world trên bản đồ phải mở world đó, không phải mất một nhịp chỉ
  // để đóng cái bảng này.
  useEffect(() => {
    if (!mo) return;
    const ngoai = (e: PointerEvent) => {
      if (!boc.current?.contains(e.target as Node)) setMo(false);
    };
    const phim = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMo(false);
    };
    window.addEventListener('pointerdown', ngoai);
    window.addEventListener('keydown', phim);
    return () => {
      window.removeEventListener('pointerdown', ngoai);
      window.removeEventListener('keydown', phim);
    };
  }, [mo]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  const chuCai = (user.display_name || '?').trim().charAt(0).toUpperCase();

  return (
    <div ref={boc} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={mo}
        aria-label={t('account')}
        title={user.display_name}
        onClick={() => setMo((v) => !v)}
        // Cùng cỡ và cùng chất liệu với cụm loa đứng bên cạnh — hai cái nút nổi
        // trên tấm bản đồ phải trông như một bộ, không phải hai thứ đắp vào từ
        // hai lúc khác nhau.
        className="grid size-8 place-items-center rounded-full border border-white/25 bg-black/45 text-sm font-bold text-white/85 backdrop-blur transition hover:border-lagoon-400 hover:bg-black/70 hover:text-white"
      >
        {chuCai}
      </button>

      {mo && (
        // Neo về mép PHẢI: cụm này nằm sát góc phải màn, thả bảng ra giữa hay
        // sang trái là nó tràn khỏi tấm bản đồ.
        <div
          role="menu"
          className="absolute end-0 top-full z-30 mt-2 min-w-44 rounded-xl border border-white/20 bg-abyss-950/95 p-3 text-sm shadow-xl backdrop-blur"
        >
          <p className="truncate font-bold text-white">{user.display_name}</p>
          <p className="mt-0.5 truncate text-xs text-slate-400">{user.email}</p>
          <p className="mt-1 text-xs text-orichalcum-400">{tRole(user.role)}</p>
          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className="mt-3 w-full rounded-lg border border-abyss-700 px-3 py-1.5 text-slate-300 transition hover:border-coral-500 hover:text-coral-500"
          >
            {t('logout')}
          </button>
        </div>
      )}
    </div>
  );
}

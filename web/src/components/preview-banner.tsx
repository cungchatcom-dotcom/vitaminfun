'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';

/**
 * Thanh cảnh báo chơi thử — ghim trên mọi màn /play khi vai trò không phải học sinh.
 *
 * Không có nó thì sớm muộn cũng có người tưởng dữ liệu thử là dữ liệu thật.
 * Xem docs/UI_META_SCREENS.md phần A.
 */
export function PreviewBanner() {
  const t = useTranslations('preview');
  // Bước 1 mới chỉ dựng khung. Công tắc này sẽ nối vào API mở khoá màn ở Bước 6.
  const [bypassUnlock, setBypassUnlock] = useState(true);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-orichalcum-500/40 bg-orichalcum-500/15 px-6 py-2 text-sm">
      <span className="font-semibold text-orichalcum-400">🧪 {t('banner')}</span>

      <label className="flex cursor-pointer items-center gap-2 text-slate-300">
        <input
          type="checkbox"
          checked={bypassUnlock}
          onChange={(e) => setBypassUnlock(e.target.checked)}
          className="accent-orichalcum-500"
        />
        {t('bypassUnlock')}
      </label>

      <button type="button" className="text-slate-400 underline-offset-2 hover:underline" disabled>
        {t('resetProgress')}
      </button>

      <Link href="/teacher" className="ml-auto text-slate-300 underline-offset-2 hover:underline">
        {t('exit')}
      </Link>
    </div>
  );
}

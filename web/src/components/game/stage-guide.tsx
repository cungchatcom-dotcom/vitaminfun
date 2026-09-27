'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/modal';

import guideEn from '../../../messages/guide/en.json';
import guideVi from '../../../messages/guide/vi.json';

/**
 * NỘI DUNG hướng dẫn, cả hai thứ tiếng — tách khỏi `messages/<mã>.json`.
 *
 * Bảng có hai nút Vi / En đổi ngôn ngữ CHỈ của phần hướng dẫn, không đổi cả
 * trang: học sinh học tiếng Anh có thể đọc luật bằng tiếng Việt cho chắc rồi
 * đọc lại bằng tiếng Anh. `next-intl` chỉ nạp bộ chữ của ngôn ngữ đang chọn,
 * nên muốn có cả hai thì phải có một nguồn riêng — và hai tệp nhỏ này là nguồn
 * đó (vẫn nằm trong `messages/`, vẫn không viết cứng chữ nào trong mã).
 *
 * Phần khung của bảng (ô tick, nhãn nút) vẫn theo ngôn ngữ của trang.
 */
const NOI_DUNG = { vi: guideVi, en: guideEn } as const;
type GuideLang = keyof typeof NOI_DUNG;

/**
 * BẢNG HƯỚNG DẪN CHƠI — hiện lúc vào màn, mở lại bằng biểu tượng ℹ️.
 *
 * Màn chơi này không giống một trang web: nhân vật đi theo cú chạm, nhiệm vụ mở
 * khi đứng đúng chỗ, năng lượng mua gợi ý, sổ tay nhận từ người canh giữ. Không
 * ai đoán ra bấy nhiêu luật bằng cách nhìn, nên lần đầu vào là nói thẳng ra.
 *
 * ## Nhớ hay không nhớ là việc của NGƯỜI CHƠI
 *
 * Mặc định hiện lại ở MỌI lượt mới — chơi lại, hết giờ vào lại, vào màn khác.
 * Người chơi tick "Không hiện lại nữa" thì thôi hẳn, và khi nào cần thì bấm
 * ℹ️. Ghi vào `localStorage` chứ không vào server: đây là thói quen của máy
 * đang ngồi, không phải dữ liệu học tập.
 *
 * `localStorage` có thể ném lỗi (chế độ ẩn danh của vài trình duyệt), nên mọi
 * lần đọc/ghi đều bọc `try` — hỏng thì coi như "chưa tắt", tức vẫn hiện.
 */
const KHOA = 'vitaminfun.guide.off';

/** Người chơi đã tắt hẳn bảng hướng dẫn chưa. */
export function guideOff(): boolean {
  try {
    return window.localStorage.getItem(KHOA) === '1';
  } catch {
    return false;
  }
}

function ghiGuideOff(off: boolean) {
  try {
    if (off) window.localStorage.setItem(KHOA, '1');
    else window.localStorage.removeItem(KHOA);
  } catch {
    // Không ghi được thì lần sau lại hiện — phiền một chút, không mất gì.
  }
}

/** Các mục hướng dẫn, theo đúng thứ tự người chơi gặp chúng trong màn. */
const MUC = [
  { key: 'move', icon: '🕹️' },
  { key: 'npc', icon: '🧭' },
  { key: 'energy', icon: '⚡' },
  { key: 'cluebook', icon: '📖' },
  { key: 'quests', icon: '🎯' },
  { key: 'time', icon: '⏳' },
] as const;

export function StageGuide({ onClose }: { onClose: () => void }) {
  const t = useTranslations('game.guide');
  const locale = useLocale();
  const [tat, setTat] = useState(false);
  const [lang, setLang] = useState<GuideLang>(locale === 'vi' ? 'vi' : 'en');
  const g = NOI_DUNG[lang];

  // Đọc trong `useEffect`: `localStorage` không tồn tại lúc dựng trên server,
  // và lượt vẽ đầu ở client phải khớp với HTML của server.
  useEffect(() => setTat(guideOff()), []);

  return (
    // Bấm ra NGOÀI bảng là đóng — `Modal` lo việc đó.
    <Modal label={g.title} onClose={onClose}>
      {/*
       * MỘT bố cục cho cả hai hướng, không hai nhánh.
       *
       * Bề ngang trần `max-w-2xl`, chiều cao trần `85dvh` rồi cuộn: màn ngang
       * của điện thoại chỉ cao chừng 390px, và một bảng sáu mục thì không có
       * cách nào vừa — nên nó cuộn, còn tiêu đề và hàng nút thì DÍNH hai đầu để
       * lúc nào cũng thấy đường ra.
       *
       * Các mục xếp một cột ở màn hẹp, hai cột từ `sm` trở lên (điện thoại nằm
       * ngang đã qua ngưỡng này) — sáu dòng dọc trên một màn thấp là cuộn mãi.
       *
       * Nền ĐẶC, không `backdrop-blur`, và chữ SÁNG: trên điện thoại, lớp kính
       * mờ khiến một số trình duyệt vẽ cả khối ở độ phân giải thấp (chữ nhoè),
       * còn chữ xám nhạt cỡ 12–13px trên nền trong mờ thì đọc không ra ngoài
       * trời. Đây là bảng để ĐỌC, không phải để ngắm cảnh xuyên qua.
       */}
      <div className="flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-abyss-700 bg-abyss-950 shadow-2xl">
        <header className="flex shrink-0 items-center gap-3 border-b border-abyss-800 bg-gradient-to-r from-lagoon-500/15 to-transparent px-4 py-3 sm:px-5">
          <span aria-hidden className="text-2xl">
            🗺️
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-slate-100 sm:text-lg">
              {g.title}
            </h2>
            <p className="truncate text-xs text-slate-300">{g.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="grid size-9 shrink-0 place-items-center rounded-full text-lg text-slate-400 transition hover:bg-white/10 hover:text-slate-100 [@media(pointer:coarse)]:size-11"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4">
          <p className="mb-3 text-sm leading-relaxed text-slate-100">{g.intro}</p>

          <ul className="grid gap-2 sm:grid-cols-2">
            {MUC.map((muc) => (
              <li
                key={muc.key}
                className="flex gap-2.5 rounded-xl border border-abyss-700 bg-abyss-900 p-3"
              >
                <span aria-hidden className="text-xl leading-none">
                  {muc.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{g[muc.key].title}</p>
                  <p className="mt-0.5 text-sm leading-snug text-slate-200">
                    {g[muc.key].body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-abyss-800 px-4 py-3 sm:px-5">
          {/* Ô tick ghi NGAY lúc bấm, không đợi bấm Đóng: người chơi bấm ✕ ở
              góc hay bấm ra ngoài bảng cũng là đóng, mà lúc ấy ý họ đã rõ. */}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={tat}
              onChange={(e) => {
                setTat(e.currentTarget.checked);
                ghiGuideOff(e.currentTarget.checked);
              }}
              className="size-4 accent-lagoon-500"
            />
            {t('dontShow')}
          </label>

          {/* Vi / En: đổi ngôn ngữ CHỈ của nội dung hướng dẫn. Không có nút
              "Bắt đầu chơi" — đóng bằng ✕ hoặc bấm ra ngoài bảng. */}
          <div
            role="group"
            aria-label={t('langLabel')}
            className="flex overflow-hidden rounded-xl border border-abyss-700"
          >
            {(['vi', 'en'] as const).map((ma) => (
              <button
                key={ma}
                type="button"
                aria-pressed={lang === ma}
                onClick={() => setLang(ma)}
                className={`min-w-12 px-3 py-1.5 text-sm font-semibold transition [@media(pointer:coarse)]:min-h-10 ${
                  lang === ma
                    ? 'bg-lagoon-500 text-abyss-950'
                    : 'text-slate-300 hover:bg-white/10 hover:text-slate-100'
                }`}
              >
                {ma === 'vi' ? 'Vi' : 'En'}
              </button>
            ))}
          </div>
        </footer>
      </div>
    </Modal>
  );
}

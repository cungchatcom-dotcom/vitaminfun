'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';

import { Modal } from '@/components/ui/modal';
import { useSiteConfig } from '@/components/site-config-context';
import { BackgroundLayer } from './background-layer';
import { pickText } from '@/lib/i18n-text';
import { localizedPath } from '@/lib/routes';

import type { PlayChapter, PlayStage } from '@/lib/types';

/** Số màn hiện cùng lúc trên một hàng ngang. Cùng nhịp với hàng chương. */
const PER_PAGE = 5;

/**
 * Minimap của một chương: bảng mở ra khi học sinh bấm vào chương ở phòng chờ.
 *
 * Các màn xếp thành MỘT HÀNG NGANG theo thứ tự, năm cái một lúc. Hàng ngang chứ
 * không phải lưới, và theo đúng thứ tự chương — vì đây là một con đường: màn 1
 * dẫn tới màn 2. Một cái lưới thì không nói được điều đó.
 *
 * Mỗi màn là một VÒNG TRÒN. Có tên thì tên nằm giữa, chưa đặt tên thì số thứ tự
 * nằm giữa — chỗ nào cũng phải bấm được, kể cả màn người dựng chưa kịp đặt tên.
 */
export function ChapterMinimap({
  chapter,
  onClose,
}: {
  chapter: PlayChapter;
  onClose: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [page, setPage] = useState(0);

  const name = pickText(chapter.name_i18n, locale);

  /* Chưa tải ảnh minimap thì MƯỢN ảnh chương.
     Hai ảnh có khuôn hình khác nhau — ô nhỏ trên hàng chương so với cả tấm nền
     trải rộng — nên chúng vẫn là hai cột riêng, và người dựng tải riêng vẫn cho
     ra kết quả đẹp hơn. Nhưng một tấm ảnh hơi bị kéo giãn vẫn hơn hẳn một mảng
     đen trống, và ảnh chương thì luôn nói đúng về chương này. */
  const background = chapter.minimap_url || chapter.cover_url;
  const stages = chapter.stages ?? [];
  const pages = Math.max(1, Math.ceil(stages.length / PER_PAGE));
  const shown = stages.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  return (
    <Modal label={t('lobby.minimap.title', { chapter: name })} onClose={onClose}>
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-abyss-700 bg-abyss-900 shadow-2xl">
        {background && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={background}
              alt=""
              className="pointer-events-none absolute inset-0 size-full object-cover"
              draggable={false}
            />
            {/* Lớp phủ tối: ảnh nền do người dựng tải lên, sáng tối tuỳ ý, mà
                tên màn thì phải đọc được trên bất kỳ ảnh nào. */}
            <div className="pointer-events-none absolute inset-0 bg-abyss-950/55" />
          </>
        )}

        <div className="relative">
          <header className="flex items-center justify-between gap-4 px-5 py-3">
            <h2 className="truncate font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              {chapter.order_index}. {name}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="text-white/70 transition hover:text-white"
            >
              ✕
            </button>
          </header>

          <div className="px-5 pb-5">
            {stages.length === 0 ? (
              <p className="py-10 text-center text-sm text-white/70">{t('lobby.minimap.empty')}</p>
            ) : (
              <div className="flex items-center gap-3">
                {/* Nút lật luôn CÓ MẶT, chỉ mờ đi khi hết trang — ẩn đi thì cả
                    hàng xê dịch mỗi lần tới đầu hoặc cuối. */}
                <PageArrow
                  label={t('lobby.minimap.prev')}
                  arrow="‹"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                />

                <ul
                  className="grid flex-1 gap-3"
                  style={{ gridTemplateColumns: `repeat(${PER_PAGE}, minmax(0, 1fr))` }}
                >
                  {shown.map((stage) => (
                    <li key={stage.id}>
                      {/* Hai lý do khoá, hai câu nói. "Cần thêm điểm" là việc
                          học sinh làm được; "chưa tới lúc mở" thì cày bao nhiêu
                          điểm cũng không mở ra, và nói nhầm câu là để các em
                          ngồi cày một cánh cửa không mở bằng điểm. */}
                      <StageDot
                        stage={stage}
                        locale={locale}
                        lockedLabel={t(
                          stage.locked_by_teacher
                            ? 'lobby.minimap.lockedByTeacher'
                            : 'lobby.minimap.locked',
                        )}
                      />
                    </li>
                  ))}
                </ul>

                <PageArrow
                  label={t('lobby.minimap.next')}
                  arrow="›"
                  disabled={page >= pages - 1}
                  onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                />
              </div>
            )}
          </div>

          {pages > 1 && (
            <footer className="px-5 pb-3 text-center font-mono text-xs text-white/60">
              {page + 1} / {pages}
            </footer>
          )}
        </div>
      </div>
    </Modal>
  );
}

/**
 * Một màn chơi trên minimap.
 *
 * Mặt của vòng tròn là ẢNH NỀN CỦA CHÍNH MÀN ĐÓ — đúng tấm ảnh sẽ hiện ra khi
 * người chơi bấm vào. Minimap nhờ vậy trở thành một lời hứa xem trước được: cái
 * hang xanh trên bản đồ chính là cái hang xanh lát nữa mình bước vào. Sáu vòng
 * tròn rỗng giống hệt nhau thì không hứa được gì, và người chơi chỉ còn cách
 * đọc tên để đoán.
 *
 * Màn khoá cũng đeo ảnh, nhưng XÁM và tối hơn hẳn: thấy được nơi mình sắp tới
 * là một phần của động lực đi tiếp, còn xám thì nói rõ "chưa phải bây giờ" mà
 * không cần thêm chữ nào.
 *
 * Màn khoá KHÔNG phải một liên kết — một thẻ `<a>` bị làm mờ vẫn bấm được bằng
 * bàn phím. Cùng luật với world khoá trên bản đồ thiên hà và chương khoá ở hàng
 * chương.
 */
function StageDot({
  stage,
  locale,
  lockedLabel,
}: {
  stage: PlayStage;
  locale: string;
  lockedLabel: string;
}) {
  const name = pickText(stage.name_i18n, locale);
  // Độ tối của màn đang khoá — người dựng chỉnh ở màn Cấu hình.
  const doToi = useSiteConfig().locked_stage_dim ?? 75;

  const dot = (
    <span
      className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-full border-2 p-2 text-center ${
        stage.unlocked
          ? 'group border-orichalcum-400 bg-abyss-950/70 transition hover:bg-orichalcum-500/25'
          : 'border-white/30 bg-abyss-950/70'
      }`}
    >
      {stage.background_url && (
        <>
          {/* `still`: nền của màn có thể là VIDEO, và minimap vẽ nhiều màn cùng
              lúc. Ở đây nó được ghim ở khung hình đầu — cho tất cả chạy vòng lặp
              là bắt máy học sinh nuôi N bộ giải mã để vẽ mấy vòng tròn nhỏ. */}
          <BackgroundLayer
            url={stage.background_url}
            kind={stage.background_kind}
            still
            className={`pointer-events-none absolute inset-0 size-full object-cover ${
              stage.unlocked ? '' : 'grayscale'
            }`}
          />
          {/* Lớp phủ tối: ảnh nền do người dựng tải lên, sáng tối tuỳ ý, mà tên
              màn thì phải đọc được trên bất kỳ ảnh nào. Rê chuột vào thì lớp phủ
              mỏng đi — ảnh sáng lên đúng lúc người chơi đang nhìn nó.

              MÀN ĐANG KHOÁ thì độ tối lấy từ CẤU HÌNH TRANG, không phải một lớp
              Tailwind: "tối quá" hay "chưa đủ tối" phụ thuộc vào chính những
              tấm ảnh người dựng tải lên, mà người duy nhất nhìn thấy chúng là
              họ. Núm vặn ở màn Cấu hình. */}
          {stage.unlocked ? (
            <span className="pointer-events-none absolute inset-0 bg-abyss-950/55 transition group-hover:bg-abyss-950/25" />
          ) : (
            <span
              className="pointer-events-none absolute inset-0 transition"
              style={{ background: `rgba(4,18,31,${doToi / 100})` }}
            />
          )}
        </>
      )}

      {stage.unlocked ? (
        <span className="relative line-clamp-3 text-[11px] leading-tight font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          {name || stage.order_index}
        </span>
      ) : (
        <span
          aria-label={lockedLabel}
          title={lockedLabel}
          className="relative text-lg drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
        >
          🔒
        </span>
      )}
    </span>
  );

  if (!stage.unlocked) return dot;

  return (
    <Link
      href={localizedPath(`/play/stage/${stage.id}`, locale)}
      title={name || String(stage.order_index)}
      className="block no-underline"
    >
      {dot}
    </Link>
  );
}

function PageArrow({
  label,
  arrow,
  disabled,
  onClick,
}: {
  label: string;
  arrow: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="shrink-0 rounded-lg border border-white/40 bg-abyss-950/50 px-2 py-1 text-xl text-white transition hover:border-lagoon-400 disabled:pointer-events-none disabled:opacity-30"
    >
      {arrow}
    </button>
  );
}

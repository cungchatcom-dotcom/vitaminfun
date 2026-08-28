'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { ApiError } from '@/lib/api-error';
import { pickText } from '@/lib/i18n-text';
import { pickCharacter, type PlayCharacter } from '@/lib/play';

/** Số nhân vật hiện cùng lúc trên một hàng ngang trong bộ chọn. */
const PER_PAGE = 5;

/**
 * Ô nhân vật ở phòng chờ world.
 *
 * CHỈ cái ảnh — dòng mô tả là khối riêng, xem `CharacterInfo`. Hai thứ đó nằm
 * hai chỗ khác nhau trong tranh nền tuỳ người dựng vẽ, mà một khối thì chỉ có
 * một chỗ đứng và một cỡ.
 *
 * Đã chọn thì hiện mặt nhân vật. Chưa chọn thì một ô tròn rỗng với dấu **+** và
 * dòng chữ "Chọn nhân vật" — cái ô rỗng đó chính là nút, không cần thêm một nút
 * nữa bên cạnh, và cũng không cần nút "Đổi": bấm vào mặt là mở lại bảng chọn.
 *
 * Cỡ chữ viết theo `em`, cỡ mặt viết theo `cqw`: cả ô nằm trong KHUNG NỘI DUNG
 * do giáo viên kéo (`LobbyContent`), nên kéo khung to nhỏ là mọi thứ bên trong
 * đi theo. Đặt `px` cố định thì thu khung lại là cái mặt tràn ra ngoài viền.
 * Riêng bộ chọn nhân vật thì không — nó vẽ vào `document.body` qua `Modal`, tức
 * nằm ngoài khung, nên vẫn dùng cỡ chữ thường của trang.
 */
export function CharacterSlot({
  worldId,
  characters,
  chosenId,
}: {
  worldId: string;
  characters: PlayCharacter[];
  chosenId: string | null | undefined;
}) {
  const t = useTranslations('lobby.character');
  const locale = useLocale();
  const router = useRouter();

  const [picking, setPicking] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const chosen = characters.find((c) => c.id === chosenId) ?? null;

  async function choose(characterId: string) {
    try {
      await pickCharacter(worldId, characterId);
      setPicking(false);
      // Nạp lại dữ liệu của trang từ server thay vì tự sửa state: `my_character_id`
      // là của server, và một bản sao ở client sẽ lệch ngay khi mở hai tab.
      router.refresh();
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <button
        type="button"
        onClick={() => setPicking(true)}
        title={chosen ? pickText(chosen.name_i18n, locale) : t('choose')}
        className="group flex w-full min-w-0 flex-col items-center justify-center"
      >
        {chosen?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={chosen.avatar_url}
            alt=""
            className="size-[55cqw] rounded-full border-2 border-orichalcum-400 object-cover transition group-hover:brightness-110"
          />
        ) : (
          <span className="flex size-[55cqw] items-center justify-center rounded-full border-2 border-dashed border-white/50 text-[2.5em] opacity-70 transition group-hover:border-orichalcum-400 group-hover:text-orichalcum-400 group-hover:opacity-100">
            +
          </span>
        )}

        {/* Chưa chọn thì cần một dòng chữ nói rõ phải làm gì. Chọn rồi thì
            thôi — tên nhân vật đã nằm ở khối mô tả, in lại lần nữa ngay dưới
            cái mặt chỉ là hai lần cùng một chữ trong một cái khung chật. */}
        {!chosen && <span className="mt-2 w-full truncate text-[1em] font-bold">{t('choose')}</span>}
      </button>

      {errorKey && (
        <p role="alert" className="text-[1em] text-coral-500">
          {errorKey}
        </p>
      )}

      {picking && (
        <CharacterPicker
          characters={characters}
          chosenId={chosenId}
          locale={locale}
          onClose={() => setPicking(false)}
          onChoose={choose}
        />
      )}
    </div>
  );
}

/**
 * Mô tả nhân vật: `Tên - giới thiệu`, XUỐNG DÒNG cho vừa khung, hết chỗ thì cắt
 * bằng dấu ba chấm.
 *
 * Số dòng do `lobbyTextLines()` TÍNH RA từ khung và cỡ chữ, không phải một con
 * số viết cứng: người dựng kéo khung cao lên thì có thêm dòng, thu lại thì bớt
 * đi. Không đo DOM — xem ghi chú ở hàm đó.
 *
 * Thuần hiển thị, KHÔNG bấm được: đường vào bảng chọn là cái mặt nhân vật ở
 * khối bên cạnh. Hai cửa vào cùng một chỗ thì cửa thứ hai chỉ thêm một hộp
 * thoại thứ hai để hai bên lệch trạng thái nhau.
 *
 * Màu và cỡ chữ lấy từ cấu hình của chính khối này — nên ở đây không đặt màu,
 * và cỡ chữ viết bằng `em`.
 */
export function CharacterInfo({
  characters,
  chosenId,
  lines,
}: {
  characters: PlayCharacter[];
  chosenId: string | null | undefined;
  /** Số dòng lọt vào khung. Cắt ở dòng cuối bằng dấu ba chấm. */
  lines: number;
}) {
  const t = useTranslations('lobby.character');
  const locale = useLocale();
  const chosen = characters.find((c) => c.id === chosenId) ?? null;

  if (!chosen) {
    return (
      <span className="flex size-full items-center justify-center text-center text-[1em] opacity-70">
        {t('noneChosen')}
      </span>
    );
  }

  const name = pickText(chosen.name_i18n, locale);
  const bio = pickText(chosen.bio_i18n, locale);

  return (
    <span
      className="flex size-full items-center justify-center text-center"
      // Rê chuột đọc được trọn câu — chữ bị cắt, và người ta có quyền biết phần
      // bị cắt là gì mà không phải mở bảng chọn ra xem.
      title={bio ? `${name} - ${bio}` : name}
    >
      {/* `-webkit-box` + `line-clamp` là cách DUY NHẤT có dấu ba chấm ở cuối
          một đoạn NHIỀU DÒNG; `text-overflow: ellipsis` chỉ chạy với một dòng.
          `w-full` KHÔNG thừa: thẻ cha căn giữa nên con tự co theo bề rộng nội
          dung, mà cắt chữ thì cần một bề rộng có thật mới biết cắt ở đâu. */}
      <span
        className="w-full text-[1em] leading-snug"
        style={{
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: lines,
          overflow: 'hidden',
        }}
      >
        <span className="font-bold">{name}</span>
        {bio && <span className="opacity-85"> - {bio}</span>}
      </span>
    </span>
  );
}

/**
 * Bộ chọn: một HÀNG NGANG năm nhân vật, nhiều hơn thì lật trang.
 *
 * Hàng ngang chứ không phải lưới: năm cái mặt cạnh nhau thì so được với nhau
 * bằng một cái liếc, còn một lưới cuộn dài thì phải nhớ cái vừa lướt qua.
 *
 * Lật theo TRANG chứ không trượt từng cái: trượt một nhân vật mỗi lần thì bấm
 * mười lần mới xem hết mười nhân vật, mà mỗi lần cả hàng lại xê dịch.
 */
function CharacterPicker({
  characters,
  chosenId,
  locale,
  onClose,
  onChoose,
}: {
  characters: PlayCharacter[];
  chosenId: string | null | undefined;
  locale: string;
  onClose: () => void;
  onChoose: (id: string) => void;
}) {
  const t = useTranslations('lobby.character');
  const [page, setPage] = useState(0);

  const pages = Math.max(1, Math.ceil(characters.length / PER_PAGE));
  const shown = characters.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  return (
    <Modal label={t('pickTitle')} onClose={onClose}>
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-abyss-700 bg-abyss-900 shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-abyss-800 px-5 py-3">
          <h2 className="font-semibold text-slate-100">{t('pickTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('prev')}
            className="text-slate-400 hover:text-slate-100"
          >
            ✕
          </button>
        </header>

        <div className="p-5">
          {characters.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">{t('noneAvailable')}</p>
          ) : (
            <div className="flex items-stretch gap-3">
              {/* Nút lật luôn CÓ MẶT, chỉ mờ đi khi hết trang. Ẩn đi thì cả
                  hàng nhân vật xê dịch mỗi lần tới đầu hoặc cuối. */}
              <PageButton
                label={t('prev')}
                arrow="‹"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              />

              <ul className="grid flex-1 gap-3" style={{ gridTemplateColumns: `repeat(${PER_PAGE}, minmax(0, 1fr))` }}>
                {shown.map((character) => {
                  const current = character.id === chosenId;
                  return (
                    <li key={character.id}>
                      <button
                        type="button"
                        onClick={() => onChoose(character.id)}
                        className={`flex h-full w-full flex-col items-center gap-2 rounded-xl border p-3 text-center transition ${
                          current
                            ? 'border-orichalcum-400 bg-orichalcum-500/10'
                            : 'border-abyss-800 hover:border-lagoon-500/60 hover:bg-abyss-800/50'
                        }`}
                      >
                        {character.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={character.avatar_url}
                            alt=""
                            className="size-16 rounded-full border border-abyss-700 object-cover"
                          />
                        ) : (
                          <span className="size-16 rounded-full border border-dashed border-abyss-700" />
                        )}
                        <span className="text-sm font-semibold text-slate-100">
                          {pickText(character.name_i18n, locale)}
                        </span>
                        <span className="line-clamp-4 text-xs text-slate-400">
                          {pickText(character.bio_i18n, locale)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <PageButton
                label={t('next')}
                arrow="›"
                disabled={page >= pages - 1}
                onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              />
            </div>
          )}
        </div>

        {pages > 1 && (
          <footer className="border-t border-abyss-800 px-5 py-2 text-center font-mono text-xs text-slate-500">
            {page + 1} / {pages}
          </footer>
        )}
      </div>
    </Modal>
  );
}

function PageButton({
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
      className="shrink-0 rounded-lg border border-abyss-800 px-2 text-xl text-slate-400 transition hover:border-lagoon-500 hover:text-lagoon-400 disabled:pointer-events-none disabled:opacity-30"
    >
      {arrow}
    </button>
  );
}

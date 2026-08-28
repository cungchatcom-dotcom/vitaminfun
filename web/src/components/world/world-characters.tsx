'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Badge, Card, EmptyState, SectionTitle } from '@/components/ui/primitives';
import { ApiError } from '@/lib/api-error';
import {
  addWorldCharacters,
  listCharacters,
  listWorldCharacters,
  removeWorldCharacter,
  type Character,
} from '@/lib/characters';
import { pickText } from '@/lib/i18n-text';

/**
 * Nhân vật dùng được ở một world.
 *
 * Học sinh vào world sẽ chọn một trong những nhân vật ở đây. Chọn từ KHO CHUNG
 * chứ không tạo mới tại chỗ: một nhân vật thường dùng cho nhiều world, và dựng
 * lại nó ở từng world là dựng lại cả bộ spritesheet.
 *
 * Gỡ ở đây chỉ gỡ khỏi WORLD NÀY. Nhân vật vẫn còn trong kho và vẫn dùng được
 * ở world khác — nên nút mang chữ "Gỡ ra", không phải "Xoá".
 */
export function WorldCharacters({ worldId }: { worldId: string }) {
  const t = useTranslations();
  const locale = useLocale();

  const [chosen, setChosen] = useState<Character[]>([]);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const reload = useCallback(async () => {
    try {
      setChosen(await listWorldCharacters(worldId));
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    }
  }, [worldId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function guard<T>(fn: () => Promise<T>) {
    try {
      return await fn();
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
      return null;
    }
  }

  return (
    <Card>
      <SectionTitle>{t('world.characters.title', { count: chosen.length })}</SectionTitle>
      <p className="mb-3 text-xs text-slate-500">{t('world.characters.hint')}</p>

      {errorKey && (
        <p role="alert" className="mb-3 rounded-lg bg-coral-500/15 px-3 py-2 text-xs text-coral-500">
          {t(errorKey)}
        </p>
      )}

      {chosen.length === 0 ? (
        <EmptyState label={t('world.characters.empty')} />
      ) : (
        <ul className="mb-3 space-y-1">
          {chosen.map((character) => (
            <li
              key={character.id}
              className="flex items-center gap-2 rounded-lg border border-abyss-800 px-2 py-1.5"
            >
              <Avatar character={character} />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-300">
                {pickText(character.name_i18n, locale)}
              </span>
              {character.status !== 'published' && (
                <Badge tone="neutral">{t('status.draft')}</Badge>
              )}
              <button
                type="button"
                onClick={async () => {
                  const next = await guard(() => removeWorldCharacter(worldId, character.id));
                  if (next) setChosen(next);
                }}
                className="shrink-0 text-xs text-slate-500 hover:text-coral-500"
              >
                {t('world.characters.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button variant="primary" size="sm" onClick={() => setPicking(true)}>
        {t('world.characters.add')}
      </Button>

      {picking && (
        <CharacterPicker
          alreadyIn={new Set(chosen.map((c) => c.id))}
          locale={locale}
          onClose={() => setPicking(false)}
          onPick={async (ids) => {
            const next = await guard(() => addWorldCharacters(worldId, { character_ids: ids }));
            if (next) setChosen(next);
            setPicking(false);
          }}
          onError={setErrorKey}
        />
      )}
    </Card>
  );
}

function Avatar({ character }: { character: Character }) {
  if (!character.avatar_url) {
    return <span className="size-8 shrink-0 rounded-full border border-dashed border-abyss-700" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={character.avatar_url}
      alt=""
      className="size-8 shrink-0 rounded-full border border-abyss-700 object-cover"
    />
  );
}

/**
 * Bộ chọn nhân vật: tick nhiều rồi thêm MỘT lần.
 *
 * Nhân vật đã có trong world vẫn hiện ra nhưng bị làm mờ và không tick được —
 * giấu đi thì người dùng đi tìm một cái họ nhớ là có, không thấy, rồi tạo trùng
 * thêm một cái nữa.
 */
function CharacterPicker({
  alreadyIn,
  locale,
  onClose,
  onPick,
  onError,
}: {
  alreadyIn: Set<string>;
  locale: string;
  onClose: () => void;
  onPick: (ids: string[]) => void;
  onError: (key: string) => void;
}) {
  const t = useTranslations();
  const [all, setAll] = useState<Character[] | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    listCharacters()
      .then(setAll)
      .catch((error: unknown) =>
        onError(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR'),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string) {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Modal label={t('world.characters.pickTitle')} onClose={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-abyss-700 bg-abyss-900 shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-abyss-800 px-5 py-3">
          <h2 className="font-semibold text-slate-100">{t('world.characters.pickTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.action.cancel')}
            className="text-slate-400 hover:text-slate-100"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {all === null ? (
            <p className="text-center text-sm text-slate-500">…</p>
          ) : all.length === 0 ? (
            <EmptyState label={t('character.empty')} />
          ) : (
            <ul className="space-y-1">
              {all.map((character) => {
                const inWorld = alreadyIn.has(character.id);
                return (
                  <li key={character.id}>
                    <label
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                        inWorld
                          ? 'border-abyss-800 opacity-50'
                          : 'cursor-pointer border-abyss-800 hover:border-lagoon-500/60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={inWorld}
                        checked={inWorld || ticked.has(character.id)}
                        onChange={() => toggle(character.id)}
                        className="size-4 shrink-0 accent-lagoon-400"
                      />
                      <Avatar character={character} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-200">
                          {pickText(character.name_i18n, locale)}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {t('world.characters.actionCount', {
                            count: character.actions?.length ?? 0,
                          })}
                        </span>
                      </span>
                      {inWorld && <Badge tone="info">{t('world.characters.inWorld')}</Badge>}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-abyss-800 px-5 py-3">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.action.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={ticked.size === 0}
            onClick={() => onPick([...ticked])}
          >
            {t('world.characters.addCount', { count: ticked.size })}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}

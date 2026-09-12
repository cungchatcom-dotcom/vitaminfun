'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { DIALOGUE_POSES } from '@/game/character';
import { listCharacters, type Character } from '@/lib/characters';
import { pickText } from '@/lib/i18n-text';
import { localizedPath } from '@/lib/routes';

import type { Quest } from '@/lib/worlds';

/**
 * Kho NGƯỜI CANH GIỮ — mọi `characters` có `kind = 'npc'`.
 *
 * `null` = đang tải. Hỏng thì trả mảng rỗng chứ không ném: chỗ gọi là một ô
 * chọn, không phải nơi báo lỗi mạng, và một danh sách rỗng vẫn nói đúng thứ cần
 * nói — chưa chọn được ai.
 *
 * Tách thành hook vì màn thiết kế hội thoại cần CÙNG danh sách cho hai việc:
 * vẽ ô chọn, và dựng tư thế ra khung xem trước. Tải hai lần là hai lượt đi về
 * cho một màn hình, và là hai bản có thể lệch nhau trong một nhịp.
 */
export function useNpcs(): Character[] | null {
  const [npcs, setNpcs] = useState<Character[] | null>(null);

  useEffect(() => {
    listCharacters('npc').then(setNpcs, () => setNpcs([]));
  }, []);

  return npcs;
}

/**
 * Chọn người canh giữ cho một nhiệm vụ.
 *
 * Không phải một ô tải ảnh: người canh giữ là một NHÂN VẬT có nhiều tư thế
 * spritesheet, và nó sống ở màn quản lý nhân vật cùng với nhân vật học sinh.
 * Ở đây chỉ TRỎ tới nó. Nhờ vậy một người canh giữ dùng lại được ở nhiều nhiệm
 * vụ, và sửa ảnh một lần là mọi nhiệm vụ đổi theo.
 *
 * Hàng chip bên dưới trả lời đúng câu hỏi người dựng đang có trong đầu — "đã
 * tải ảnh chưa?" — mà không bắt họ mở sang màn khác để xem.
 *
 * Dùng ở HAI chỗ: popup sửa nhiệm vụ (nơi đang dựng nội dung) và trình thiết kế
 * màn hội thoại (nơi đang nhìn thấy khuôn mặt đó to bằng thật). Cùng một việc ở
 * hai chỗ người ta thật sự nghĩ tới nó, chứ không bắt đi vòng.
 */
export function NpcField({
  quest,
  npcs,
  locale,
  onPick,
}: {
  quest: Quest;
  /** Kho người canh giữ, từ `useNpcs()`. `null` = đang tải. */
  npcs: Character[] | null;
  locale: string;
  onPick: (characterId: string | null) => void;
}) {
  const t = useTranslations();

  const chosen = npcs?.find((c) => c.id === quest.npc_character_id) ?? null;
  //: Trước khi danh sách về, ảnh vẫn hiện được: nhiệm vụ đã mang sẵn URL.
  const avatar = chosen?.avatar_url ?? quest.npc_avatar_url ?? null;
  const has = new Set((chosen?.actions ?? []).map((a) => a.action_key));

  return (
    <div className="rounded-xl border border-abyss-800 p-3">
      <span className="field-label">{t('designer.npc')}</span>

      <div className="flex items-center gap-2">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            className="size-10 shrink-0 rounded-full border border-abyss-700 object-cover"
          />
        ) : (
          <span className="size-10 shrink-0 rounded-full border border-dashed border-abyss-700" />
        )}
        <select
          className="field-input min-w-0 flex-1"
          value={quest.npc_character_id ?? ''}
          disabled={npcs === null}
          // Ô trống gửi lên `null`, và `npc_character_id` nằm trong danh sách
          // xoá được của router — `null` ở đây nghĩa là "gỡ ra", không phải
          // "không gửi". Xem `QUEST_CLEARABLE_FIELDS`.
          onChange={(e) => onPick(e.target.value || null)}
        >
          <option value="">{t('designer.npcNone')}</option>
          {(npcs ?? []).map((npc) => (
            <option key={npc.id} value={npc.id}>
              {pickText(npc.name_i18n, locale)}
            </option>
          ))}
        </select>
      </div>

      {chosen ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {DIALOGUE_POSES.npc.map((pose) => (
            <span
              key={pose}
              className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${
                has.has(pose)
                  ? 'border-lagoon-500/40 text-lagoon-400'
                  : 'border-abyss-700 text-slate-600'
              }`}
            >
              {has.has(pose) ? '✓' : '○'} {pose}
            </span>
          ))}
          {/* Sang TAB MỚI: cả hai màn gọi tới đây đều đang giữ một khung dựng
              dở — cảnh Phaser bên này, bố cục vừa kéo bên kia — rời đi rồi quay
              lại là dựng lại từ đầu. */}
          <a
            href={localizedPath(`/teacher/characters?id=${chosen.id}`, locale)}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-xs text-lagoon-400 hover:underline"
          >
            {t('designer.npcEdit')} ↗
          </a>
        </div>
      ) : (
        npcs?.length === 0 && (
          <a
            href={localizedPath('/teacher/characters?kind=npc', locale)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block text-xs text-lagoon-400 hover:underline"
          >
            {t('designer.npcNew')} ↗
          </a>
        )
      )}

      <p className="mt-2 text-xs text-slate-500">{t('designer.npcHint')}</p>
    </div>
  );
}

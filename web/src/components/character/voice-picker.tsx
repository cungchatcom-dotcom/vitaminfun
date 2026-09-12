'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  listVoiceProviders,
  listVoices,
  syncVoices,
  type Voice,
  type VoiceAge,
  type VoiceGender,
  type VoiceProvider,
} from '@/lib/voices';

/** Ba nhãn giới tính và ba nhóm tuổi — đúng bộ ElevenLabs trả về. */
const GENDERS: VoiceGender[] = ['female', 'male', 'neutral'];
const AGES: VoiceAge[] = ['young', 'middle_aged', 'old'];

/**
 * CHỌN GIỌNG cho một nhân vật — lọc dần bốn nấc.
 *
 *   dịch vụ → giới tính → nhóm tuổi → giọng
 *
 * Bốn ô chứ không một danh sách hai chục dòng: người dựng biết trước họ cần
 * "một giọng nữ trẻ", và bắt họ đọc hết cả danh sách để tìm là bắt làm một việc
 * máy làm được. Hai ô giữa BỎ TRỐNG ĐƯỢC, và bỏ trống nghĩa là "mọi giá trị" —
 * mở ra là thấy giọng ngay, rồi mới thu hẹp dần.
 *
 * Dùng cho CẢ HAI vai. Người canh giữ cũng là một `characters`, cũng cần một
 * giọng để đọc đề bài, nên không có bản riêng nào cho NPC.
 *
 * ## Nghe thử trước khi chọn
 *
 * Mỗi giọng có một đoạn mẫu của nhà cung cấp. Không nghe được thì chọn giọng là
 * chọn theo cái tên — mà tên giọng thì nói rất ít về việc nó nghe ra sao.
 *
 * Đoạn mẫu phát THẲNG từ URL của nhà cung cấp, không tải về kho media: nó là
 * tài sản của họ, đổi khi họ đổi, và giữ một bản sao là giữ một thứ sẽ cũ đi.
 */
export function VoicePicker({
  value,
  voice,
  onPick,
  onError,
}: {
  /** Giọng đang gán. `null` = chưa gán ai. */
  value: string | null;
  /** Giọng đang gán, đã dựng sẵn — để hiện tên và nghe thử ngay khi mở màn. */
  voice: Voice | null;
  onPick: (voiceId: string | null) => void;
  onError: (key: string) => void;
}) {
  const t = useTranslations();

  const [providers, setProviders] = useState<VoiceProvider[] | null>(null);
  const [provider, setProvider] = useState('');
  const [gender, setGender] = useState<VoiceGender | ''>('');
  const [age, setAge] = useState<VoiceAge | ''>('');
  const [voices, setVoices] = useState<Voice[] | null>(null);
  const [syncing, setSyncing] = useState(false);

  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    listVoiceProviders().then(
      (list) => {
        setProviders(list);
        // Chọn sẵn dịch vụ ĐÃ CÓ GIỌNG. Mở ra mà ô chọn giọng rỗng thì người
        // dùng tưởng hỏng, trong khi thật ra họ chỉ đang đứng ở một dịch vụ
        // chưa đồng bộ lần nào.
        setProvider((before) => before || (list.find((p) => p.voice_count > 0) ?? list[0])?.key || '');
      },
      () => setProviders([]),
    );
  }, []);

  useEffect(() => {
    if (!provider) return;
    listVoices({ provider, gender: gender || null, age_group: age || null }).then(setVoices, () =>
      setVoices([]),
    );
  }, [provider, gender, age]);

  /**
   * Giọng đang gán, ghép vào danh sách nếu bộ lọc hiện tại đã loại nó ra.
   *
   * Không có dòng này thì đổi bộ lọc một cái là ô chọn nhảy về "chưa gán" —
   * trông như vừa mất giọng, dù chưa ai bấm gì.
   */
  const options = (() => {
    const list = voices ?? [];
    if (!voice || list.some((v) => v.id === voice.id)) return list;
    return [voice, ...list];
  })();

  const current = options.find((v) => v.id === value) ?? null;

  function play() {
    const node = audio.current;
    if (!node) return;
    if (playing) return node.pause();
    node.currentTime = 0;
    void node.play().catch(() => undefined);
  }

  async function sync() {
    if (!provider) return;
    setSyncing(true);
    try {
      const done = await syncVoices(provider);
      setProviders((before) =>
        (before ?? []).map((p) => (p.key === provider ? { ...p, voice_count: done.total } : p)),
      );
      setVoices(
        await listVoices({ provider, gender: gender || null, age_group: age || null }),
      );
    } catch {
      onError('error.INTERNAL_ERROR');
    } finally {
      setSyncing(false);
    }
  }

  const empty = providers?.find((p) => p.key === provider)?.voice_count === 0;

  return (
    <div>
      <span className="field-label">{t('character.voice')}</span>

      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="mb-0.5 block text-[11px] text-slate-500">{t('character.voiceProvider')}</span>
          <select
            className="field-input"
            value={provider}
            disabled={providers === null}
            onChange={(e) => setProvider(e.target.value)}
          >
            {(providers ?? []).map((p) => (
              <option key={p.key} value={p.key}>
                {p.key}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-0.5 block text-[11px] text-slate-500">{t('character.voiceGender')}</span>
          <select
            className="field-input"
            value={gender}
            onChange={(e) => setGender(e.target.value as VoiceGender | '')}
          >
            <option value="">{t('character.voiceAny')}</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {t(`character.gender.${g}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-0.5 block text-[11px] text-slate-500">{t('character.voiceAge')}</span>
          <select
            className="field-input"
            value={age}
            onChange={(e) => setAge(e.target.value as VoiceAge | '')}
          >
            <option value="">{t('character.voiceAny')}</option>
            {AGES.map((a) => (
              <option key={a} value={a}>
                {t(`character.age.${a}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <select
          className="field-input min-w-0 flex-1"
          value={value ?? ''}
          disabled={voices === null}
          // Ô trống gửi lên `null` — "gỡ giọng ra", không phải "không gửi".
          onChange={(e) => onPick(e.target.value || null)}
        >
          <option value="">{t('character.voiceNone')}</option>
          {options.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>

        {/* Nghe thử. Chỉ hiện khi giọng đang chọn CÓ đoạn mẫu — một cái nút bấm
            vào rồi không có gì phát ra là tệ hơn không có nút nào. */}
        {current?.preview_url && (
          <>
            <audio
              ref={audio}
              src={current.preview_url}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />
            <button
              type="button"
              onClick={play}
              aria-label={t('character.voicePreview')}
              title={t('character.voicePreview')}
              className={`grid size-9 shrink-0 place-items-center rounded-full transition ${
                playing
                  ? 'bg-lagoon-500/25 text-lagoon-300'
                  : 'bg-white/8 text-slate-300 hover:bg-white/15'
              }`}
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="currentColor">
                {playing ? (
                  <path d="M8 5h3v14H8zM13 5h3v14h-3z" />
                ) : (
                  <path d="M8 5.14v13.72a.5.5 0 0 0 .76.43l11.02-6.86a.5.5 0 0 0 0-.86L8.76 4.71a.5.5 0 0 0-.76.43Z" />
                )}
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Danh mục rỗng thì nói rõ phải làm gì. Một ô chọn rỗng không giải thích
          gì là chỗ người ta đứng lại và đi hỏi. */}
      {empty ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">{t('character.voiceEmpty')}</span>
          <Button variant="secondary" size="sm" loading={syncing} onClick={() => void sync()}>
            {t('character.voiceSync')}
          </Button>
        </div>
      ) : (
        <p className="mt-1 text-xs text-slate-500">
          {current
            ? [current.accent, current.style, current.use_case].filter(Boolean).join(' · ')
            : t('character.voiceHint')}
        </p>
      )}
    </div>
  );
}

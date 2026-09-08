'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Modal } from '@/components/ui/modal';
import { Card, SectionTitle } from '@/components/ui/primitives';
import {
  AUDIO_RANGE,
  AUDIO_SLOTS,
  AUDIO_SURFACE_SLOTS,
  resolveAudio,
  type AudioSlot,
  type AudioSurface,
  type AudioTrack,
} from '@/game/audio';
import { AUDIO_ACCEPT, uploadMedia, type BackgroundKind } from '@/lib/media';

import { MediaPicker } from './designer-fields';

/**
 * Bảng ÂM THANH của màn chơi: nhạc nền, tiếng đi, tiếng đứng.
 *
 * Cả ba khối dùng CHUNG một component `<AudioBlock>`, và danh sách khối thì
 * duyệt qua sổ đăng ký `AUDIO_SLOTS`. Thêm một khối tiếng mới = một dòng trong
 * sổ cộng một khoá chữ — không phải chép khối này ra lần thứ tư.
 *
 * **Nghe thử ngay tại chỗ.** Không có nút nghe thì người dựng chỉnh âm lượng và
 * tốc độ bằng cách đoán, rồi phải lưu, mở màn chơi, đi vài bước, quay về sửa.
 * Nút nghe dùng CHUNG `resolveAudio()` với cảnh chơi, nên thứ nghe được ở đây
 * đúng bằng thứ học sinh sẽ nghe.
 */
export function AudioPanel({
  surface,
  audio,
  audioUrls,
  audioNames,
  backgroundKind,
  onSave,
  onError,
}: {
  /**
   * Màn hình nào — quyết định hiện những khối nào.
   *
   * Bản đồ thiên hà và phòng chờ chỉ có nhạc nền; ở đó không có nhân vật nào đi
   * lại nên hai khối `walk`/`idle` sẽ là hai ô nhập không bao giờ có tác dụng.
   */
  surface: AudioSurface;
  audio: Partial<Record<string, AudioTrack>>;
  audioUrls: Record<string, string>;
  /**
   * Ảnh nền của màn này là ảnh hay video.
   *
   * Lựa chọn "dùng tiếng của video nền" CHỈ hiện khi nền thật sự là video. Hiện
   * sẵn rồi để đó là mời giáo viên bật một cái cờ không có tác dụng, rồi tự hỏi
   * vì sao vào chơi không nghe thấy gì.
   */
  backgroundKind?: BackgroundKind | null;
  /** Tên file gốc của từng khối, để người dựng biết mình đã tải bản nào. */
  audioNames?: Record<string, string>;
  /** Ghi MỘT khối. Server gộp theo khối, nên khối khác không bị đụng. */
  onSave: (slot: AudioSlot, track: AudioTrack) => Promise<void>;
  onError: (key: string) => void;
}) {
  const t = useTranslations('designer.audio');

  return (
    <Card>
      <SectionTitle>{t('title')}</SectionTitle>
      <p className="mt-1 mb-3 text-xs text-slate-500">{t('intro')}</p>
      <div className="space-y-4">
        {AUDIO_SURFACE_SLOTS[surface].map((slot) => (
          <AudioBlock
            key={slot}
            surface={surface}
            slot={slot}
            track={audio[slot] ?? {}}
            url={audioUrls[slot] ?? null}
            name={audioNames?.[slot] ?? null}
            backgroundKind={backgroundKind}
            onSave={(next) => onSave(slot, next)}
            onError={onError}
          />
        ))}
      </div>
    </Card>
  );
}

function AudioBlock({
  surface,
  slot,
  track,
  url,
  name,
  backgroundKind,
  onSave,
  onError,
}: {
  surface: AudioSurface;
  slot: AudioSlot;
  backgroundKind?: BackgroundKind | null;
  track: AudioTrack;
  url: string | null;
  /** Tên file gốc. `null` = server chưa ghi tên (file tải lên từ rất lâu). */
  name: string | null;
  onSave: (track: AudioTrack) => Promise<void>;
  onError: (key: string) => void;
}) {
  const t = useTranslations('designer.audio');
  const [uploading, setUploading] = useState(false);

  /**
   * Đang hỏi "chắc chưa?" trước khi chuyển nhạc nền sang tiếng của video.
   *
   * Chỉ hỏi khi có gì để MẤT — tức là đã tải một file nhạc lên. Chưa có file thì
   * bật cờ không lấy chỗ của ai cả, và một hộp thoại lúc đó chỉ là một cú bấm
   * thừa cho việc giáo viên vừa nói rõ là mình muốn.
   */
  const [confirming, setConfirming] = useState(false);

  /**
   * Giá trị ĐANG KÉO, chỉ để vẽ và để nghe thử.
   *
   * Cùng luật với thanh trượt nhịp thở: kéo thanh trượt mà phải đợi server trả
   * lời mới nghe thấy khác thì không ai chỉnh được — thứ đang chỉnh là một cảm
   * giác, không phải một con số. Ghi xuống khi THẢ TAY.
   */
  const [draft, setDraft] = useState<AudioTrack | null>(null);
  const live = draft ?? track;
  const spec = resolveAudio(slot, live);

  // Người khác (hoặc chính ta, ở tab khác) đổi khối này thì bỏ bản nháp đi.
  useEffect(() => setDraft(null), [track]);

  const player = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  // "Tiếng của video" chỉ có nghĩa với NHẠC NỀN, và chỉ khi nền thật sự là
  // video — cùng hai vế với `ambientFromVideo()` bên `game/audio.ts`, nơi cảnh
  // chơi hỏi cùng câu hỏi này.
  const videoAvailable = slot === 'ambient' && backgroundKind === 'video';
  const usingVideo = videoAvailable && Boolean(live.from_video);

  // Âm lượng và tốc độ KHÔNG đặt được bằng thuộc tính JSX: React không có
  // `volume`/`playbackRate` như thuộc tính DOM thật trên `<audio>`, nên phải
  // ghi thẳng vào phần tử. Chạy lại mỗi lần kéo để nghe thử đổi theo NGAY
  // trong lúc đang phát.
  useEffect(() => {
    const el = player.current;
    if (!el) return;
    el.volume = spec.volume;
    el.playbackRate = spec.rate;
    el.loop = spec.loop;
  }, [spec.volume, spec.rate, spec.loop]);

  async function commit(next: AudioTrack) {
    setDraft(next);
    await onSave(next);
  }

  async function pick(file: File) {
    setUploading(true);
    try {
      const asset = await uploadMedia(file, `${surface}-audio`);
      await commit({ ...live, media_id: asset.id });
    } catch {
      onError('error.INTERNAL_ERROR');
    } finally {
      setUploading(false);
    }
  }

  function toggle() {
    const el = player.current;
    if (!el) return;
    if (playing) {
      el.pause();
      el.currentTime = 0;
      setPlaying(false);
      return;
    }
    // Bấm nghe thử LÀ cú chạm mở khoá âm thanh của trình duyệt, nên chỗ này
    // không cần né gì cả — khác hẳn cảnh chơi, nơi nhạc phải đợi cú bấm đầu.
    void el.play().then(() => setPlaying(true)).catch(() => onError('error.INTERNAL_ERROR'));
  }

  return (
    <div className="rounded-lg border border-abyss-700 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-slate-200">{t(`slots.${slot}`)}</span>
        {url && (
          <button
            type="button"
            onClick={toggle}
            className="text-xs text-lagoon-400 hover:text-lagoon-300"
          >
            {playing ? `⏹ ${t('stop')}` : `▶ ${t('preview')}`}
          </button>
        )}
      </div>
      <p className="mb-2 text-[11px] leading-snug text-slate-500">{t(`hints.${slot}`)}</p>

      {videoAvailable && (
        <label className="mb-2 flex items-start gap-2 rounded-lg bg-abyss-900/60 p-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={usingVideo}
            onChange={(event) => {
              const bat = event.currentTarget.checked;
              // Bật ĐÈ LÊN một file đã tải thì hỏi trước. Mọi trường hợp khác
              // — bật khi chưa có file, và mọi lần bỏ chọn — là không mất gì,
              // nên đi thẳng.
              if (bat && live.media_id) {
                setConfirming(true);
                return;
              }
              void commit({ ...live, from_video: bat });
            }}
            className="mt-0.5 size-3.5 shrink-0 accent-lagoon-400"
          />
          <span className="min-w-0">
            {t('fromVideo')}
            <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
              {t('fromVideoHint')}
            </span>
          </span>
        </label>
      )}

      {confirming && (
        <Modal label={t('confirmTitle')} onClose={() => setConfirming(false)}>
          <div className="w-full max-w-md rounded-2xl border border-abyss-700 bg-abyss-900 p-5 shadow-2xl">
            <h2 className="text-sm font-medium text-slate-100">{t('confirmTitle')}</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">{t('confirmBody')}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-abyss-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-abyss-800"
              >
                {t('confirmCancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  void commit({ ...live, from_video: true });
                }}
                className="rounded-lg bg-lagoon-500 px-3 py-1.5 text-xs font-medium text-abyss-950 hover:bg-lagoon-400"
              >
                {t('confirmOk')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <MediaPicker
        label={t('file')}
        accept={AUDIO_ACCEPT}
        busy={uploading}
        hasValue={Boolean(live.media_id)}
        clearLabel={t('remove')}
        preview={
          url ? (
            <>
              {/* TÊN FILE GỐC, không phải đường dẫn: `storage_key` là một chuỗi
                  băm, nhìn vào nó thì không ai biết mình đã tải bản nào lên.
                  `break-all` vì tên file không có chỗ xuống dòng tự nhiên, mà
                  cột bên phải thì hẹp. */}
              <p
                className={`mb-1.5 flex items-baseline gap-1.5 text-xs ${
                  usingVideo ? 'text-slate-500 line-through' : 'text-slate-300'
                }`}
              >
                <span aria-hidden>🎵</span>
                <span className="min-w-0 break-all">{name ?? t('unnamed')}</span>
              </p>
              {/* Gạch ngang mới chỉ nói "khác thường"; câu này nói RÕ nó khác ở
                  chỗ nào và làm sao quay lại. Thiếu nó thì giáo viên tưởng file
                  hỏng và tải lên lần nữa. */}
              {usingVideo && (
                <p className="mb-1.5 text-[11px] leading-snug text-amber-400/90">
                  {t('fromVideoUnused')}
                </p>
              )}
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio ref={player} src={url} preload="none" onEnded={() => setPlaying(false)} />
            </>
          ) : (
            <p className="mb-1 text-xs text-slate-600">{t('empty')}</p>
          )
        }
        onPick={pick}
        // Gỡ file = gửi khối KHÔNG có `media_id`. Giữ lại âm lượng và tốc độ đã
        // chỉnh: người dựng đổi bản nhạc chứ hiếm khi đổi luôn cả cách chỉnh.
        onClear={() => void commit({ ...live, media_id: null })}
      />

      {/* Lấy tiếng từ video thì KHÔNG có `media_id` nào, nhưng vẫn phải chỉnh
          được âm lượng — nếu không thì bật cờ xong là mất luôn cái núm duy nhất
          còn có nghĩa. */}
      {(live.media_id || usingVideo) && (
        <div className="mt-3 space-y-2">
          {usingVideo && (
            <p className="text-[11px] leading-snug text-lagoon-400/90">{t('fromVideoOn')}</p>
          )}
          <Slider
            label={t('volume')}
            value={Math.round(spec.volume * 100)}
            min={AUDIO_RANGE.volumeMin}
            max={AUDIO_RANGE.volumeMax}
            suffix="%"
            zeroLabel={t('muted')}
            onPreview={(volume) => setDraft({ ...live, volume })}
            onCommit={(volume) => void commit({ ...live, volume })}
          />
          {/* Tốc độ và lặp KHÔNG hiện khi tiếng đến từ video.
              Đổi tốc độ phát của một video là đổi tốc độ cả HÌNH — một núm
              "tốc độ nhạc" làm cảnh nền chạy nhanh lên là thứ không ai đoán
              được. Còn lặp thì video nền vốn đã lặp sẵn. */}
          {usingVideo ? (
            <p className="text-[11px] leading-snug text-slate-500">{t('fromVideoNoRate')}</p>
          ) : (
            <>
              <Slider
                label={t('rate')}
                value={Math.round(spec.rate * 100)}
                min={AUDIO_RANGE.rateMin}
                max={AUDIO_RANGE.rateMax}
                suffix="%"
                onPreview={(rate) => setDraft({ ...live, rate })}
                onCommit={(rate) => void commit({ ...live, rate })}
              />
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={spec.loop}
                  onChange={(e) => void commit({ ...live, loop: e.target.checked })}
                  className="size-3.5 accent-lagoon-400"
                />
                {t('loop')}
                <span className="text-slate-600">
                  {AUDIO_SLOTS[slot].loop ? t('loopDefaultOn') : t('loopDefaultOff')}
                </span>
              </label>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Thanh trượt XEM TRƯỚC LIÊN TỤC, ghi xuống MỘT LẦN.
 *
 * `onInput` bắn theo từng nhịp con trỏ — hàng chục cái cho một lần kéo. Ghi
 * thẳng mỗi nhịp là hàng chục lượt gọi server, và cái tới sau cùng chưa chắc là
 * cái mới nhất. `onChange` của `<input type="range">` chỉ bắn khi THẢ TAY, nên
 * nó là chỗ đúng để ghi.
 */
function Slider({
  label,
  value,
  min,
  max,
  suffix,
  zeroLabel,
  onPreview,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  /** Chữ thay cho số khi giá trị bằng 0 — "0%" không nói ra là đã câm hẳn. */
  zeroLabel?: string;
  onPreview: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-xs text-slate-400">
        {label}
        <span className="font-mono text-lagoon-400">
          {value === 0 && zeroLabel ? zeroLabel : `${value}${suffix}`}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onInput={(e) => onPreview(Number(e.currentTarget.value))}
        onChange={(e) => onCommit(Number(e.currentTarget.value))}
        className="mt-1 w-full accent-lagoon-400"
      />
    </label>
  );
}

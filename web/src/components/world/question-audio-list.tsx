'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { listQuestionAudio, type QuestionAudio } from '@/lib/question-audio';

/**
 * Những GIỌNG đã thu cho câu này, và giọng nào đang được dùng.
 *
 * ## Một câu, một tiếng đọc
 *
 * `questions.audio_media_id` là bản thu ĐANG DÙNG — thứ ô "Cách ra đề" hiện và
 * thứ học sinh nghe. `question_audios` không phải một danh sách song song để
 * chọn giữa: nó là cái KHO, nhớ lại "câu này từng được thu bằng những giọng
 * nào", để lắp câu vào màn khác với cùng giọng thì không phải thu lại.
 *
 * Trước đây chỗ này vẽ MỘT TRÌNH PHÁT cho mỗi bản thu, nên một câu đã có tệp
 * tải lên rồi lại sinh thêm tiếng máy đọc thì popup hiện hai trình phát với hai
 * nội dung khác nhau, không cái nào nói nó là cái đang dùng. Người dựng nghe
 * thử cái này, học sinh nghe cái kia.
 *
 * Nên ở đây không còn trình phát nào. Trình phát chỉ có MỘT, nằm ở ô tệp nghe.
 * Chỗ này chỉ trả lời hai câu: *đã thu bằng những giọng nào*, và *đang dùng
 * giọng nào* — bấm một giọng khác là đổi, và đổi thì không tốn gì cả vì bản thu
 * đã nằm sẵn trong kho.
 */
export function QuestionAudioList({
  questionId,
  currentMediaId,
  refreshKey = 0,
  onPick,
}: {
  questionId: string;
  /** `questions.audio_media_id` — bản thu đang dùng. */
  currentMediaId?: string | null;
  refreshKey?: number;
  /** Chọn một giọng đã thu làm giọng đang dùng. */
  onPick?: (mediaId: string) => void;
}) {
  const t = useTranslations();
  const [rows, setRows] = useState<QuestionAudio[] | null>(null);

  const reload = useCallback(() => {
    listQuestionAudio(questionId).then(setRows, () => setRows([]));
  }, [questionId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(reload, [reload]);

  // CHỈ đề bài. Phương án đọc bằng giọng của nhiều nhân vật cùng lúc — chúng
  // không tranh nhau một chỗ, nên "đang dùng cái nào" không có nghĩa gì ở đó.
  const prompts = (rows ?? []).filter((row) => row.target === 'prompt');
  if (prompts.length === 0) return null;

  return (
    <div className="rounded-xl border border-abyss-800 bg-abyss-950/40 p-4">
      <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
        {t('audio.existing')}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {prompts.map((row) => {
          const current = !!currentMediaId && row.media_id === currentMediaId;
          return (
            <button
              key={row.id}
              type="button"
              disabled={current || !onPick}
              onClick={() => row.media_id && onPick?.(row.media_id)}
              title={row.voice_name ?? undefined}
              className={`max-w-full truncate rounded-full border px-2.5 py-0.5 text-xs transition ${
                current
                  ? 'border-lagoon-400 bg-lagoon-500/15 text-lagoon-300'
                  : 'border-abyss-700 text-slate-400 hover:border-lagoon-500/60 hover:text-slate-200'
              }`}
            >
              {current ? '✓ ' : ''}
              {row.voice_name ?? row.voice_id.slice(0, 8)}
            </button>
          );
        })}
      </div>

      {/* Bản thu đang dùng KHÔNG nằm trong kho giọng: nó là tệp người dựng tự
          tải lên. Nói ra, chứ không im lặng để họ tự đoán vì sao không giọng
          nào được đánh dấu. */}
      {currentMediaId && !prompts.some((row) => row.media_id === currentMediaId) && (
        <p className="mt-2 text-xs text-slate-500">{t('audio.uploadedInUse')}</p>
      )}
    </div>
  );
}

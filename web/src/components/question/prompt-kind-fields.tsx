'use client';

import { useTranslations } from 'next-intl';

import { MediaField } from '@/components/media-field';
import type { PromptKind } from './audio-prompt';

/** Cách ra đề của một câu hỏi, đủ để vẽ và để lưu. */
export interface PromptKindValue {
  promptKind: PromptKind;
  showTranscript: boolean;
  audioMediaId: string | null;
  /** URL để nghe thử ngay sau khi tải lên. Server dựng sẵn. */
  audioUrl: string | null;
}

/**
 * Ba ô điều khiển CÁCH RA ĐỀ: đọc hay nghe, tệp nghe, transcript mở sẵn.
 *
 * Một component cho CẢ HAI chỗ sửa được câu hỏi — trang soạn câu hỏi, và popup
 * xem câu hỏi mở từ màn ghép nhiệm vụ. Hai bản chép của cùng ba ô này thì sớm
 * muộn cũng lệch nhau, và bản lệch là bản người dùng đang nhìn.
 *
 * Chỗ gọi quyết định `onChange` nghĩa là gì: trang soạn ghi vào state rồi lưu
 * cùng nút Lưu, popup thì gửi PATCH ngay. Component này không biết mạng là gì.
 */
export function PromptKindFields({
  value,
  onChange,
  disabled = false,
}: {
  value: PromptKindValue;
  onChange: (next: PromptKindValue) => void;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const laNghe = value.promptKind === 'audio';

  return (
    <div>
      <span className="field-label">{t('question.promptKind.label')}</span>

      <div className="mt-1 flex flex-wrap gap-2">
        {(['text', 'audio'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            disabled={disabled}
            onClick={() => onChange({ ...value, promptKind: kind })}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
              value.promptKind === kind
                ? 'border-lagoon-400 bg-lagoon-500/15 text-lagoon-300'
                : 'border-abyss-700 text-slate-400 hover:border-abyss-600 hover:text-slate-200'
            }`}
          >
            {kind === 'text' ? '📄' : '🔊'} {t(`question.promptKind.${kind}`)}
          </button>
        ))}
      </div>

      <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
        {t(laNghe ? 'question.promptKind.audioHint' : 'question.promptKind.textHint')}
      </p>

      {laNghe && (
        <div className="mt-3 space-y-2 rounded-lg border border-abyss-800 bg-abyss-950/40 p-3">
          <MediaField
            kind="audio"
            folder="question-audio"
            removeLabel={t('question.promptKind.removeAudio')}
            disabled={disabled}
            value={{ mediaId: value.audioMediaId, url: value.audioUrl }}
            onChange={(next) =>
              onChange({
                ...value,
                // Tải tệp nghe lên là một câu nói rõ ràng: "câu này để nghe".
                // Chuyển luôn cách ra đề thay vì bắt bấm thêm một nút — không ai
                // tải một đoạn ghi âm lên rồi muốn nó nằm im.
                promptKind: next.mediaId ? 'audio' : value.promptKind,
                audioMediaId: next.mediaId,
                audioUrl: next.url,
              })
            }
            // CẢNH BÁO chứ không phải lỗi chặn: giáo viên phải đặt được cách ra
            // đề trước rồi mới tải file, nên trạng thái này là một bước bình
            // thường trên đường đi. Nói rõ chuyện gì xảy ra nếu dừng ở đây.
            emptyHint={t('question.promptKind.noAudio')}
          />

          <label className="flex items-start gap-2 border-t border-abyss-800 pt-2 text-xs text-slate-300">
            <input
              type="checkbox"
              disabled={disabled}
              checked={value.showTranscript}
              onChange={(event) =>
                onChange({ ...value, showTranscript: event.target.checked })
              }
              className="mt-0.5 size-3.5 accent-lagoon-400"
            />
            <span>
              {t('question.promptKind.showTranscript')}
              <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                {t('question.promptKind.showTranscriptHint')}
              </span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

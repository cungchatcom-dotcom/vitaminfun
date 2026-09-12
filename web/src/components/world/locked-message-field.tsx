'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-error';
import { generateLockedAudio } from '@/lib/question-audio';
import type { Quest } from '@/lib/worlds';

import { pickText } from '@/lib/i18n-text';

import { reportText } from './audio-tools';

/**
 * CÂU KHOÁ của một nhiệm vụ — soạn chữ và thu tiếng.
 *
 * ## Vì sao mỗi nhiệm vụ một câu
 *
 * Câu tự sinh ("Đang khoá. Qua X trước đã…") nói đúng việc cần nói, nhưng nó
 * giống nhau ở mọi cánh cửa trong màn. Đi qua cửa thứ ba, thứ tư, thứ năm và
 * nghe lại đúng dòng ấy thì người gác cửa không còn là một nhân vật — họ là một
 * hộp thoại lỗi lặp lại.
 *
 * ## Để TRỐNG là hợp lệ
 *
 * Trống = quay về câu tự sinh. Người dựng không phải soạn gì để màn chơi chạy,
 * và xoá sạch ô này là cách "xoá" — không cần thêm một cái nút xoá riêng.
 *
 * ## Giọng là của NGƯỜI GÁC CỬA
 *
 * Không phải giọng của nhiệm vụ đang sửa: câu ấy do người gác cửa nói, và cả màn
 * chỉ có một người gác cửa. `hasVoice` do chỗ gọi tra sẵn — nó đã nạp danh sách
 * NPC cho ô chọn ngay phía trên.
 */
export function LockedMessageField({
  quest,
  locale,
  hasVoice,
  onPatch,
  onError,
}: {
  quest: Quest;
  locale: string;
  /** Người gác cửa của màn đã gán giọng chưa. Chưa thì nút thu bị khoá. */
  hasVoice: boolean;
  onPatch: (next: Record<string, string>) => Promise<void> | void;
  onError: (key: string | null) => void;
}) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const hien = (quest.locked_message_i18n ?? {}) as Record<string, string>;
  const daCoChu = Object.values(hien).some((v) => v?.trim());

  return (
    <label className="block">
      <span className="field-label">{t('designer.lockedMessage')}</span>
      <p className="mb-1 text-[11px] leading-snug text-slate-500">
        {t('designer.lockedMessageHint')}
      </p>

      <textarea
        className="field-input min-h-16 resize-y text-xs"
        rows={2}
        // Ô SỬA thì chỉ hiện bản dịch của ĐÚNG ngôn ngữ này — mượn của ngôn
        // ngữ khác thì người soạn chỉ cần rời chuột là bản tiếng Anh bị ghi
        // thành bản tiếng Việt mà chẳng ai gõ chữ nào. Bản gốc xuống
        // `placeholder` để còn đối chiếu.
        placeholder={pickText(hien, locale) || t('designer.lockedMessagePlaceholder')}
        // Không kiểm soát: gõ xong rời ô mới lưu. Ô kiểm soát thì mỗi ký tự là
        // một lần gọi mạng, và con trỏ nhảy về cuối khi sửa giữa dòng.
        defaultValue={hien[locale] ?? ''}
        onBlur={(event) => {
          const chu = event.target.value.trim();
          if (chu === (hien[locale] ?? '')) return;
          // Xoá hết chữ = XOÁ khoá ngôn ngữ ấy, không để lại một chuỗi rỗng:
          // một khoá rỗng nằm đó trông như "đã soạn rồi nhưng trống".
          const next = { ...hien };
          if (chu) next[locale] = chu;
          else delete next[locale];
          void onPatch(next);
        }}
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          // Chưa có chữ thì không có gì để đọc; chưa có giọng thì không ai đọc
          // được. Khoá nút ở cả hai chỗ, và nhãn nói rõ vì sao.
          disabled={busy || !daCoChu || !hasVoice}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setNote(null);
            try {
              const report = await generateLockedAudio(quest.id, { overwrite: false });
              setNote(reportText(report, t as never));
              onError(null);
            } catch (error) {
              onError(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('designer.lockedVoice')}
        </Button>

        {!hasVoice && (
          <span className="text-[11px] text-orichalcum-400">
            {t('designer.lockedNoVoice')}
          </span>
        )}
        {note && <span className="text-[11px] text-lagoon-400">{note}</span>}
      </div>
    </label>
  );
}

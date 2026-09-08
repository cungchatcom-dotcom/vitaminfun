'use client';

import { useTranslations } from 'next-intl';

import { MediaField } from '@/components/media-field';
import { Card, SectionTitle } from '@/components/ui/primitives';
import { ownText, pickText } from '@/lib/i18n-text';
import type { Stage, updateStage } from '@/lib/worlds';

/**
 * SỔ TAY BÍ QUYẾT và LỜI CHIA TAY của NPC — bảng soạn của giáo viên.
 *
 * Ba trường, MỘT khoảnh khắc trong trận: học sinh trả lời xong câu cuối của
 * nhiệm vụ NPC, và bảng hội thoại chuyển sang bước cuối — bước không hỏi gì cả.
 * Vì thế chúng nằm chung một thẻ, dù lưu vào ba cột khác nhau: người dựng soạn
 * chúng cùng lúc, và đọc lại cũng cùng lúc.
 *
 * ## Ba ô, ba hậu quả KHÁC NHAU khi bỏ trống
 *
 *   - lời NPC trống  → bảng cuối chỉ còn biểu tượng và cái nút
 *   - tên sổ tay trống → lùi về nhãn dịch chung ("Sổ tay bí quyết")
 *   - nội dung trống → **biểu tượng 📖 không hiện ra chút nào**
 *
 * Cái thứ ba là thứ dễ làm người dựng mất cả buổi đi tìm, nên nó được nói thẳng
 * ra chứ không để đoán từ một ô trống.
 *
 * ## Soạn theo NGÔN NGỮ ĐANG XEM, nhưng CẢNH BÁO theo mọi thứ tiếng
 *
 * Ô nhập đọc `ownText()`: nó phải TRỐNG khi thứ tiếng này chưa có bản dịch. Lùi
 * về tiếng khác thì người dựng tưởng mình đã dịch rồi, và bản tiếng Anh lặng lẽ
 * nằm trong cột tiếng Việt.
 *
 * Nhưng lời cảnh báo thì đọc `pickText()` — tức MỌI thứ tiếng — vì hậu quả mà
 * nó cảnh báo là chuyện của học sinh, mà học sinh thì được lùi về tiếng khác.
 * Một màn có sổ tay tiếng Anh mà chưa dịch sang tiếng Việt **vẫn hiện biểu
 * tượng 📖**; báo "sẽ không hiện" ở đó là nói sai, và người dựng sẽ đi sửa một
 * thứ không hỏng.
 *
 * Chưa dịch thứ tiếng này thì nói đúng cái đó, bằng một dòng nhẹ hơn.
 */
export function CluebookPanel({
  stage,
  locale,
  onPatch,
}: {
  stage: Stage;
  locale: string;
  /** Vá một mẩu vào màn chơi. Chỗ gọi lo việc lưu và báo lỗi. */
  onPatch: (payload: Parameters<typeof updateStage>[1]) => void;
}) {
  const t = useTranslations();

  /** Ghi một trường i18n cho ĐÚNG thứ tiếng đang xem, giữ nguyên các thứ khác. */
  function setText(
    field: 'advisor_outro_i18n' | 'cluebook_title_i18n' | 'cluebook_i18n',
    next: string,
  ) {
    const before = stage[field] ?? {};
    if ((ownText(before, locale) || '') === next) return;
    onPatch({ [field]: { ...before, [locale]: next } });
  }

  return (
    <Card>
      <SectionTitle>{t('designer.cluebook.title')}</SectionTitle>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">
        {t('designer.cluebook.intro')}
      </p>

      {/* --- Lời NPC nói lúc trao --- */}
      <label className="mt-4 block">
        <span className="field-label">{t('designer.cluebook.outro')}</span>
        <textarea
          className="field-input min-h-20 resize-y"
          rows={3}
          defaultValue={ownText(stage.advisor_outro_i18n ?? {}, locale)}
          placeholder={t('designer.cluebook.outroPlaceholder')}
          onBlur={(event) => setText('advisor_outro_i18n', event.target.value.trim())}
        />
      </label>
      <FieldNote
        own={ownText(stage.advisor_outro_i18n ?? {}, locale)}
        any={pickText(stage.advisor_outro_i18n ?? {}, locale)}
        hintKey="designer.cluebook.outroHint"
      />

      {/* Tiếng của lời NPC. Cùng ô tải file với câu hỏi nghe — xem `MediaField`. */}
      <div className="mt-3 space-y-2 rounded-lg border border-abyss-800 bg-abyss-950/40 p-3">
        <span className="field-label">{t('designer.cluebook.outroAudio')}</span>
        <MediaField
          kind="audio"
          folder="stage-outro"
          removeLabel={t('question.promptKind.removeAudio')}
          value={{
            mediaId: stage.advisor_outro_audio_media_id ?? null,
            url: stage.advisor_outro_audio_url ?? null,
          }}
          onChange={(next) => onPatch({ advisor_outro_audio_media_id: next.mediaId })}
        />
        <label className="flex items-start gap-2 border-t border-abyss-800 pt-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={stage.advisor_outro_show_transcript}
            onChange={(event) =>
              onPatch({ advisor_outro_show_transcript: event.target.checked })
            }
            className="mt-0.5 size-3.5 accent-lagoon-400"
          />
          <span>
            {t('designer.cluebook.outroTranscript')}
            {/* BẬT SẴN, ngược với câu hỏi nghe. Nói rõ vì sao ngay tại đây:
                người dựng vừa thấy ô kia tắt sẵn sẽ tưởng chỗ này quên đồng bộ. */}
            <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
              {t('designer.cluebook.outroTranscriptHint')}
            </span>
          </span>
        </label>
      </div>

      {/* --- Sổ tay --- */}
      <label className="mt-4 block border-t border-abyss-800 pt-4">
        <span className="field-label">{t('designer.cluebook.bookTitle')}</span>
        <input
          className="field-input"
          defaultValue={ownText(stage.cluebook_title_i18n ?? {}, locale)}
          placeholder={t('designer.cluebook.bookTitlePlaceholder')}
          onBlur={(event) => setText('cluebook_title_i18n', event.target.value.trim())}
        />
      </label>
      <FieldNote
        own={ownText(stage.cluebook_title_i18n ?? {}, locale)}
        any={pickText(stage.cluebook_title_i18n ?? {}, locale)}
        hintKey="designer.cluebook.bookTitleHint"
      />

      <label className="mt-3 block">
        <span className="field-label">{t('designer.cluebook.body')}</span>
        <textarea
          className="field-input min-h-32 resize-y"
          rows={6}
          defaultValue={ownText(stage.cluebook_i18n ?? {}, locale)}
          placeholder={t('designer.cluebook.bodyPlaceholder')}
          onBlur={(event) => setText('cluebook_i18n', event.target.value.trim())}
        />
      </label>
      {/* Ba trạng thái, ba câu khác nhau:
          - chưa có ở BẤT KỲ thứ tiếng nào → cảnh báo: 📖 không mọc ra
          - có ở tiếng khác, thiếu ở tiếng này → nhắc dịch, không phải lỗi
          - có ở tiếng này → chỉ nói nó dùng để làm gì */}
      <FieldNote
        own={ownText(stage.cluebook_i18n ?? {}, locale)}
        any={pickText(stage.cluebook_i18n ?? {}, locale)}
        emptyKey="designer.cluebook.bodyEmpty"
        hintKey="designer.cluebook.bodyHint"
      />
    </Card>
  );
}
/**
 * Dòng chú thích dưới một ô văn bản đa ngữ.
 *
 * Ba trạng thái, và chúng KHÔNG được gộp: "chưa có gì cả" là một hậu quả cho
 * học sinh, còn "có nhưng chưa dịch" chỉ là một việc chưa làm xong. Gộp lại
 * thành một dòng cảnh báo thì người dựng đi sửa một thứ không hỏng.
 */
function FieldNote({
  own,
  any,
  emptyKey,
  hintKey,
}: {
  /** Chữ của ĐÚNG thứ tiếng đang xem. */
  own: string;
  /** Chữ của bất kỳ thứ tiếng nào — đúng cái học sinh sẽ thấy. */
  any: string;
  /** Câu nói khi KHÔNG thứ tiếng nào có chữ. Bỏ trống = không cảnh báo gì. */
  emptyKey?: string;
  hintKey: string;
}) {
  const t = useTranslations();

  if (!any && emptyKey) {
    return (
      <p className="mt-1 text-[11px] leading-snug text-orichalcum-400">⚠ {t(emptyKey)}</p>
    );
  }
  if (any && !own) {
    return (
      <p className="mt-1 text-[11px] leading-snug text-slate-400">
        {t('designer.cluebook.notTranslated')}
      </p>
    );
  }
  return <p className="mt-1 text-[11px] leading-snug text-slate-500">{t(hintKey)}</p>;
}

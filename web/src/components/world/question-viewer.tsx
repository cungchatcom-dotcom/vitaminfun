'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import {
  PromptKindFields,
  type PromptKindValue,
} from '@/components/question/prompt-kind-fields';
import { QuestionRenderer } from '@/components/question/renderers';
import { QUESTION_TYPE_META } from '@/components/question/registry';
import { Badge } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { ApiError } from '@/lib/api-error';
import { getQuestion, updateQuestion, type QuestionSummary } from '@/lib/questions';

/**
 * Popup xem một câu hỏi kèm đáp án.
 *
 * Dùng lại `QuestionRenderer` ở chế độ `review` — cùng component học sinh nhìn
 * thấy, chỉ khác là có tô đáp án đúng. Không vẽ lại một bản riêng: hai bản vẽ
 * cho cùng một dạng bài thì sẽ có ngày chúng hiện khác nhau, và bản sai là bản
 * giáo viên tin tưởng.
 *
 * Đáp án chỉ có ở đây vì đây là màn của GIÁO VIÊN. Học sinh không bao giờ gọi
 * `GET /questions/{id}`.
 *
 * ## Sửa được CÁCH RA ĐỀ ngay tại đây
 *
 * Ba ô — đọc/nghe, tệp nghe, transcript mở sẵn — sửa và lưu ngay trong popup.
 * Chúng là thứ người dựng chỉnh trong lúc ghép nhiệm vụ, và bắt mở trang soạn
 * ở tab khác cho một cú bấm checkbox là mất mạch: họ đang so hai mươi sáu câu
 * với nhau, không đang soạn một câu.
 *
 * Phần còn lại (đề bài, phương án, đáp án) vẫn chỉ ĐỌC. Sửa nội dung là việc
 * cần khung soạn đầy đủ kèm kiểm tra đáp án — nhét vào một popup đang mở đè lên
 * bản đồ màn chơi thì làm nửa vời cả hai việc.
 */
export function QuestionViewer({
  questionId,
  onClose,
}: {
  questionId: string;
  onClose: () => void;
}) {
  const t = useTranslations();
  const [question, setQuestion] = useState<QuestionSummary | null>(null);
  //: Lỗi NẠP — chặn cả popup, vì không có gì để hiện.
  const [errorKey, setErrorKey] = useState<string | null>(null);
  //: Lỗi LƯU — hiện tại chỗ, không được nuốt mất câu hỏi đang xem. Gộp hai loại
  //: vào một state thì một lần lưu hỏng sẽ xoá trắng popup, và người dùng mất
  //: luôn thứ họ đang đọc chỉ vì bấm nhầm một cái checkbox.
  const [saveErrorKey, setSaveErrorKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * Lưu NGAY cách ra đề vừa đổi.
   *
   * Không có nút Lưu trong popup, cùng nếp với trình thiết kế màn chơi: mỗi ô ở
   * đây là một câu nói trọn vẹn ("câu này để nghe"), không phải một mẩu của một
   * biểu mẫu phải điền xong mới có nghĩa.
   */
  async function savePrompt(next: PromptKindValue) {
    // Vẽ ngay theo giá trị mới, không đợi mạng: bấm một checkbox mà phải chờ
    // server trả lời mới thấy nó tích là một cái checkbox có vẻ hỏng.
    setQuestion((before) =>
      before
        ? {
            ...before,
            prompt_kind: next.promptKind,
            show_transcript: next.showTranscript,
            audio_media_id: next.audioMediaId,
            audio_url: next.audioUrl,
          }
        : before,
    );
    setSaving(true);
    setSaveErrorKey(null);
    try {
      const saved = await updateQuestion(questionId, {
        prompt_kind: next.promptKind,
        show_transcript: next.showTranscript,
        // `null` = XOÁ tệp nghe. Server phân biệt "gửi null" với "không gửi".
        audio_media_id: next.audioMediaId,
      });
      setQuestion(saved);
    } catch (error) {
      setSaveErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
      // Nạp lại để màn hình thôi hiện một thứ server đã từ chối.
      void getQuestion(questionId).then(setQuestion).catch(() => undefined);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    getQuestion(questionId)
      .then((q) => {
        if (!cancelled) setQuestion(q);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [questionId]);

  return (
    // `Modal` lo cả việc vẽ ra `body`, bấm nền để đóng, và phím Escape.
    <Modal label={t('stage.viewer.title')} onClose={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-abyss-700 bg-abyss-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-100">{t('stage.viewer.title')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('stage.viewer.close')}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-abyss-800 hover:text-slate-100"
          >
            ✕
          </button>
        </div>

        {errorKey ? (
          <p role="alert" className="text-sm text-coral-500">
            {t(errorKey)}
          </p>
        ) : !question ? (
          <p className="text-sm text-slate-400">{t('common.loading')}</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
              <Badge tone="info">
                {t(QUESTION_TYPE_META[question.type]?.labelKey ?? 'field.type')}
              </Badge>
              <Badge tone={question.status === 'published' ? 'success' : 'neutral'}>
                {t(question.status === 'published' ? 'status.published' : 'status.draft')}
              </Badge>
              {question.level && <span className="text-slate-500">{question.level}</span>}
              {question.topic && <span className="text-slate-500">{question.topic}</span>}
            </div>

            {/* Sửa được, và nằm TRƯỚC bản xem trước: đổi sang "nghe" thì thấy
                ngay bên dưới câu hỏi biến thành trình phát kèm nút Transcript. */}
            <div className="mb-5 rounded-xl border border-abyss-800 bg-abyss-950/40 p-4">
              <PromptKindFields
                value={{
                  promptKind: question.prompt_kind,
                  showTranscript: question.show_transcript,
                  audioMediaId: question.audio_media_id ?? null,
                  audioUrl: question.audio_url ?? null,
                }}
                onChange={(next) => void savePrompt(next)}
                disabled={saving}
              />
              {saveErrorKey && (
                <p role="alert" className="mt-2 text-xs text-coral-500">
                  {t(saveErrorKey)}
                </p>
              )}
            </div>

            <QuestionRenderer
              type={question.type}
              promptKind={question.prompt_kind}
              audioUrl={question.audio_url}
              showTranscript={question.show_transcript}
              content={question.content}
              value={null}
              onChange={() => {}}
              // `review` = tô đáp án đúng. Chính component học sinh dùng.
              mode="review"
              answer={question.answer}
              disabled
            />

            {question.explanation && (
              <div className="mt-5 rounded-xl border border-abyss-800 bg-abyss-950/40 p-4">
                <p className="mb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                  {t('question.editor.explanation')}
                </p>
                <p className="text-sm whitespace-pre-wrap text-slate-300">{question.explanation}</p>
              </div>
            )}

            {question.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {question.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-abyss-800 px-2 py-0.5 font-mono text-xs text-slate-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { QuestionRenderer } from '@/components/question/renderers';
import { QUESTION_TYPE_META } from '@/components/question/registry';
import { Badge } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { ApiError } from '@/lib/api-error';
import { getQuestion, type QuestionSummary } from '@/lib/questions';

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
  const [errorKey, setErrorKey] = useState<string | null>(null);

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

            <QuestionRenderer
              type={question.type}
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

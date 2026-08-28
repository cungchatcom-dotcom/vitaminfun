'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { QuestionRenderer } from '@/components/question/renderers';
import type { QuestionResponse } from '@/components/question/types';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { pickText } from '@/lib/i18n-text';
import type { QuestProgress, SnapshotQuest, SubmitAnswerOut } from '@/lib/play';

/**
 * Bảng làm nhiệm vụ — mở ra khi bấm vào một vật thể trong cảnh.
 *
 * Đây là chỗ luật "trong trận chỉ nói xong/chưa xong" (§1.6) thành giao diện:
 * sau khi nộp chỉ có hai trạng thái, **không** điểm, **không** đáp án, **không**
 * giải thích. Ba thứ đó ở màn xem lại sau khi hết màn.
 *
 * Frontend cũng KHÔNG có gì để tự chấm: đáp án chưa bao giờ rời server.
 */
export function QuestPanel({
  quest,
  progress,
  onSubmit,
  onClose,
  onTypingChange,
}: {
  quest: SnapshotQuest;
  progress: QuestProgress | undefined;
  onSubmit: (questionId: string, response: Record<string, unknown> | null) => Promise<SubmitAnswerOut>;
  onClose: () => void;
  onTypingChange: (typing: boolean) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();

  const [index, setIndex] = useState(0);
  const [value, setValue] = useState<QuestionResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<SubmitAnswerOut | null>(null);

  // Tắt cờ "đang gõ" khi bảng BIẾN MẤT khỏi màn hình.
  //
  // `onBlurCapture` không chạy trong trường hợp này: gỡ một phần tử đang giữ
  // focus ra khỏi DOM KHÔNG sinh sự kiện `blur` — focus lặng lẽ rơi về `<body>`.
  // Nên chỉ cần bấm vào một đáp án (nó nhận focus) rồi đóng bảng là cờ kẹt ở
  // `true` vĩnh viễn, và `update()` của cảnh thoát ra ngay ở dòng đầu: chuột vẫn
  // đi được, còn W A D X thì chết hẳn cho tới khi tải lại trang.
  useEffect(() => () => onTypingChange(false), [onTypingChange]);

  const question = quest.questions[index];
  const questionProgress = progress?.questions.find((q) => q.question_id === question?.id);
  const done = questionProgress?.completed ?? false;
  const attemptsLeft = feedback?.attempts_left ?? questionProgress?.attempts_left ?? null;
  const locked = !done && attemptsLeft === 0;

  // Đổi câu thì xoá bài đang gõ và xoá phản hồi cũ — không thì câu sau hiện
  // "CHƯA HOÀN THÀNH" của câu trước.
  useEffect(() => {
    setValue(null);
    setFeedback(null);
  }, [index]);

  // Nhảy tới câu đầu tiên chưa xong, để không phải bấm qua các câu đã làm.
  useEffect(() => {
    const next = quest.questions.findIndex(
      (q) => !progress?.questions.find((p) => p.question_id === q.id)?.completed,
    );
    setIndex(next === -1 ? 0 : next);
  }, [quest.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!question || pending) return;
    setPending(true);
    try {
      setFeedback(await onSubmit(question.id, value as Record<string, unknown> | null));
    } finally {
      setPending(false);
    }
  }

  if (!question) return null;

  const label = pickText(quest.name_i18n, locale) || quest.quest_object_key;
  const total = quest.questions.length;

  return (
    <section
      className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-abyss-700 bg-abyss-900/95 p-5 shadow-2xl backdrop-blur"
      // Gõ trong bảng này thì cảnh Phaser phải ngừng nhận WASD, không thì gõ
      // chữ "a" là nhân vật chạy sang trái. Nhớ đọc kèm effect dọn dẹp ở trên:
      // `onBlurCapture` MỘT MÌNH là không đủ.
      onFocusCapture={() => onTypingChange(true)}
      onBlurCapture={() => onTypingChange(false)}
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-slate-100">{label}</h2>
          <Badge tone={quest.phase === 'advisor' ? 'info' : 'neutral'}>
            {t(`stage.phase.${quest.phase}`)}
          </Badge>
          {progress?.completed && <Badge tone="success">{t('game.questDone')}</Badge>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('stage.viewer.close')}
          className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-abyss-800 hover:text-slate-100"
        >
          ✕
        </button>
      </header>

      {/* Điều hướng giữa các câu trong cùng nhiệm vụ */}
      {total > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {quest.questions.map((q, i) => {
            const p = progress?.questions.find((x) => x.question_id === q.id);
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-current={i === index}
                className={`size-8 rounded-lg text-xs font-medium transition ${
                  i === index
                    ? 'bg-lagoon-500 text-abyss-950'
                    : p?.completed
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-abyss-800 text-slate-400 hover:bg-abyss-700'
                }`}
              >
                {p?.completed ? '✓' : i + 1}
              </button>
            );
          })}
          <span className="ml-2 text-xs text-slate-500">
            {t('game.questionOf', { current: index + 1, total })}
          </span>
        </div>
      )}

      <QuestionRenderer
        type={question.type}
        content={question.content}
        value={value}
        onChange={setValue}
        // `exam` = chế độ làm bài thật: renderer KHÔNG nhận đáp án, và server
        // cũng không gửi xuống.
        mode="exam"
        answer={null}
        disabled={done || locked || pending}
      />

      {/* --------- Phản hồi: ĐÚNG HAI TRẠNG THÁI --------- */}
      {feedback && (
        <div
          role="status"
          className={`mt-4 rounded-xl border px-4 py-3 text-center ${
            feedback.completed
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
              : 'border-coral-500/40 bg-coral-500/10 text-coral-500'
          }`}
        >
          <p className="text-lg font-bold">
            {feedback.completed ? `✓ ${t('game.missionComplete')}` : `✗ ${t('game.notComplete')}`}
          </p>
          {!feedback.completed && (
            <p className="mt-1 text-sm">
              {t('game.energyLost')} ·{' '}
              {feedback.attempts_left === null
                ? t('game.unlimitedTries')
                : t('game.triesLeft', { count: feedback.attempts_left })}
            </p>
          )}
          {feedback.completed && feedback.quest_completed && (
            <p className="mt-1 text-sm text-emerald-300">{t('game.questAllDone')}</p>
          )}
        </div>
      )}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-slate-500">
          {attemptsLeft === null
            ? ''
            : done
              ? t('game.alreadyCorrect')
              : t('game.triesLeft', { count: attemptsLeft })}
        </span>

        <div className="flex gap-2">
          {index < total - 1 && (
            <Button variant="secondary" onClick={() => setIndex(index + 1)}>
              {t('game.nextQuestion')}
            </Button>
          )}
          {done || locked ? (
            <Button variant="secondary" onClick={onClose}>
              {t('game.continue')}
            </Button>
          ) : feedback && !feedback.completed ? (
            <Button variant="primary" loading={pending} onClick={() => setFeedback(null)}>
              {t('game.tryAgain')}
            </Button>
          ) : (
            <Button variant="primary" loading={pending} disabled={value === null} onClick={submit}>
              {t('game.submit')}
            </Button>
          )}
        </div>
      </footer>
    </section>
  );
}

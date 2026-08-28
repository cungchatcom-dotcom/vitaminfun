'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { ApiError } from '@/lib/api-error';
import { pickText } from '@/lib/i18n-text';
import type { QuestionSummary } from '@/lib/questions';
import {
  addQuestQuestions,
  removeQuestQuestion,
  updateQuest,
  updateQuestQuestion,
  type Quest,
} from '@/lib/worlds';

import { QuestionPicker } from './question-picker';
import { QuestionViewer } from './question-viewer';

/** Điểm mặc định khi lắp một câu hỏi vào nhiệm vụ. Phải khớp backend. */
const DEFAULT_POINTS = 10;

/**
 * Popup sửa một nhiệm vụ — hai cột.
 *
 *   Trái  : tuỳ chỉnh KHÔNG nhìn thấy trên bản đồ (khoá vật thể, giai đoạn,
 *           điểm qua ải, năng lượng)
 *   Phải  : danh sách câu hỏi đang có + kho câu hỏi để lắp thêm
 *
 * Tên, ảnh và bán kính CỐ Ý không ở đây — chúng nằm ở bảng bên phải màn thiết
 * kế. Nguyên tắc: thứ gì đổi hình dáng trên bản đồ thì phải sửa ở chỗ nhìn thấy
 * bản đồ; sửa trong popup che mất cảnh là sửa mù.
 *
 * Mọi thay đổi lưu ngay, không có nút "Lưu": một nút Lưu là thêm một chỗ để
 * mất công.
 */
export function QuestEditorDialog({
  quest,
  locale,
  onChanged,
  onReload,
  onClose,
}: {
  quest: Quest;
  locale: string;
  onChanged: (quest: Quest) => void;
  onReload: () => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations();

  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [picked, setPicked] = useState<Map<string, QuestionSummary>>(new Map());
  const [viewingId, setViewingId] = useState<string | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // Escape đóng popup — nhưng không khi đang mở popup xem câu hỏi chồng lên.
      if (event.key === 'Escape' && !viewingId) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, viewingId]);

  async function patch(payload: Parameters<typeof updateQuest>[1]) {
    setErrorKey(null);
    try {
      onChanged(await updateQuest(quest.id, payload));
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    }
  }

  async function addPicked() {
    if (picked.size === 0) return;
    setErrorKey(null);
    try {
      onChanged(
        await addQuestQuestions(quest.id, {
          question_ids: [...picked.keys()],
          points: DEFAULT_POINTS,
        }),
      );
      setPicked(new Map());
      // Điều kiện xuất bản đổi theo — nạp lại ở nền.
      void onReload();
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    }
  }

  const name = pickText(quest.name_i18n, locale);
  const alreadyIn = new Set(quest.questions.map((q) => q.question_id));

  return (
    <Modal label={t('designer.edit')} onClose={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-abyss-700 bg-abyss-900 shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-abyss-800 px-5 py-3">
          <h2 className="font-semibold text-slate-100">
            {name || quest.quest_object_key}
            <span className="ml-2 font-mono text-xs text-slate-500">#{quest.order_index}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('stage.viewer.close')}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-abyss-800 hover:text-slate-100"
          >
            ✕
          </button>
        </header>

        {errorKey && (
          <p role="alert" className="mx-5 mt-3 rounded-lg bg-coral-500/15 px-3 py-2 text-sm text-coral-500">
            {t(errorKey)}
          </p>
        )}

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[18rem_1fr]">
          {/* ============ CỘT TRÁI: tuỳ chỉnh nhiệm vụ ============ */}
          <div className="space-y-4">
            <Field label={t('designer.objectKey')} hint={t('stage.builder.objectHint')}>
              <input
                className="field-input font-mono text-xs"
                defaultValue={quest.quest_object_key}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next && next !== quest.quest_object_key) {
                    void patch({ quest_object_key: next });
                  }
                }}
              />
            </Field>

            <Field label={t('designer.phase')}>
              <select
                className="field-input"
                value={quest.phase}
                onChange={(e) => void patch({ phase: e.target.value as 'advisor' | 'main' })}
              >
                <option value="main">{t('stage.phase.main')}</option>
                <option value="advisor">{t('stage.phase.advisor')}</option>
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('stage.builder.passScore')}>
                <input
                  type="number"
                  min={0}
                  className="field-input"
                  placeholder={String(quest.total_points)}
                  defaultValue={quest.pass_score ?? ''}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    const next = raw === '' ? null : Number(raw);
                    if (next !== quest.pass_score) {
                      void patch({ pass_score: next, clear_pass_score: next === null });
                    }
                  }}
                />
              </Field>
              <Field label={t('designer.energyCost')}>
                <input
                  type="number"
                  min={0}
                  className="field-input"
                  defaultValue={quest.energy_cost}
                  onBlur={(e) => {
                    const next = Number(e.target.value);
                    if (next >= 0 && next !== quest.energy_cost) void patch({ energy_cost: next });
                  }}
                />
              </Field>
            </div>
          </div>

          {/* ============ CỘT PHẢI: câu hỏi ============ */}
          <div className="flex min-h-0 flex-col gap-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold tracking-wide text-slate-300 uppercase">
                {t('stage.builder.questionCount', { count: quest.questions.length })} ·{' '}
                {t('stage.builder.passOf', {
                  pass: quest.pass_score_effective,
                  total: quest.total_points,
                })}
              </h3>

              {quest.questions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-abyss-700 px-3 py-4 text-center text-sm text-slate-500">
                  {t('stage.builder.emptyQuest')}
                </p>
              ) : (
                <ol className="space-y-1.5">
                  {quest.questions.map((item) => {
                    const broken =
                      item.question_status !== 'published' || item.question_deleted;
                    return (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg bg-abyss-950/50 px-2.5 py-1.5"
                      >
                        <span className="font-mono text-xs text-slate-600">
                          {item.order_index}.
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-300">
                          {item.question_prompt ?? '—'}
                        </span>
                        {broken && (
                          <Badge tone="danger">
                            {t(
                              item.question_deleted
                                ? 'stage.builder.questionGone'
                                : 'status.draft',
                            )}
                          </Badge>
                        )}
                        <input
                          type="number"
                          min={0}
                          aria-label={t('stage.builder.points')}
                          className="field-input w-16 px-1.5 py-0.5 text-center text-xs"
                          defaultValue={item.points}
                          onBlur={(e) => {
                            const next = Number(e.target.value);
                            if (next >= 0 && next !== item.points) {
                              void updateQuestQuestion(item.id, { points: next }).then(onChanged);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setViewingId(item.question_id)}
                          className="text-xs text-lagoon-400 hover:underline"
                        >
                          {t('stage.builder.viewQuestion')}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void removeQuestQuestion(item.id).then((updated) => {
                              onChanged(updated);
                              void onReload();
                            })
                          }
                          aria-label={t('stage.builder.removeQuestion')}
                          className="px-1 text-slate-500 hover:text-coral-500"
                        >
                          ✕
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-abyss-800 p-3">
              <h3 className="mb-2 text-sm font-semibold tracking-wide text-slate-300 uppercase">
                {t('stage.builder.bank')}
              </h3>
              <div className="min-h-64 flex-1">
                <QuestionPicker
                  selected={new Set(picked.keys())}
                  alreadyIn={alreadyIn}
                  onToggle={(question) =>
                    setPicked((before) => {
                      const after = new Map(before);
                      if (after.has(question.id)) after.delete(question.id);
                      else after.set(question.id, question);
                      return after;
                    })
                  }
                />
              </div>
              <div className="mt-3 border-t border-abyss-800 pt-3">
                <Button variant="primary" disabled={picked.size === 0} onClick={addPicked}>
                  {t('stage.builder.addSelected', { count: picked.size })}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {viewingId && (
        <QuestionViewer questionId={viewingId} onClose={() => setViewingId(null)} />
      )}
    </Modal>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { QUESTION_TYPE_META } from '@/components/question/registry';
import { Badge, EmptyState, Skeleton } from '@/components/ui/primitives';
import { QUESTION_TYPES, listQuestions, type QuestionSummary } from '@/lib/questions';

/**
 * Bộ chọn câu hỏi để lắp vào một nhiệm vụ — **chọn nhiều**.
 *
 * Một nhiệm vụ mang nhiều câu hỏi (GAME_DOMAIN §1.5b), nên tích nhiều ô rồi
 * thêm một lần. Câu đã có trong nhiệm vụ hiện mờ và không tích được — thấy nó
 * ở đó vẫn hơn là biến mất, vì giáo viên cần biết mình đã lắp câu nào rồi.
 */
export function QuestionPicker({
  selected,
  alreadyIn,
  onToggle,
}: {
  selected: Set<string>;
  /** Id câu hỏi đã có trong nhiệm vụ đang chọn. */
  alreadyIn: Set<string>;
  onToggle: (question: QuestionSummary) => void;
}) {
  const t = useTranslations();

  const [items, setItems] = useState<QuestionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState('');
  const [level, setLevel] = useState('');

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      try {
        const data = await listQuestions(
          { q: keyword, type, level, status: 'published', limit: 100 },
          signal,
        );
        if (!signal.aborted) setItems(data.items);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setItems([]);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [keyword, type, level],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void load(controller.signal), 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          className="field-input min-w-40 flex-1"
          placeholder={t('question.bank.search')}
          aria-label={t('question.bank.search')}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <select
          className="field-input w-auto"
          aria-label={t('question.bank.allTypes')}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">{t('question.bank.allTypes')}</option>
          {QUESTION_TYPES.map((key) => (
            <option key={key} value={key}>
              {t(QUESTION_TYPE_META[key].labelKey)}
            </option>
          ))}
        </select>
        <select
          className="field-input w-auto"
          aria-label={t('field.level')}
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          <option value="">{t('field.level')}</option>
          {['Pre-A1', 'A1', 'A2', 'B1', 'B2'].map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-abyss-800">
        {loading ? (
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-4">
            <EmptyState label={t('stage.picker.empty')} hint={t('stage.picker.emptyHint')} />
          </div>
        ) : (
          <ul className="divide-y divide-abyss-800/60">
            {items.map((item) => {
              const inQuest = alreadyIn.has(item.id);
              const checked = selected.has(item.id);
              return (
                <li key={item.id}>
                  <label
                    className={`flex items-start gap-3 px-3 py-2.5 transition ${
                      inQuest
                        ? 'cursor-not-allowed opacity-45'
                        : checked
                          ? 'cursor-pointer bg-lagoon-500/15'
                          : 'cursor-pointer hover:bg-abyss-800/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 size-4 shrink-0 accent-lagoon-500"
                      checked={checked || inQuest}
                      disabled={inQuest}
                      onChange={() => onToggle(item)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-sm text-slate-200">
                        {summarize(item)}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Badge tone="info">
                          {t(QUESTION_TYPE_META[item.type]?.labelKey ?? 'field.type')}
                        </Badge>
                        {item.level && <span>{item.level}</span>}
                        {inQuest && <Badge tone="neutral">{t('stage.picker.alreadyIn')}</Badge>}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function summarize(item: QuestionSummary): string {
  const content = item.content as { prompt?: string; template?: string };
  if (content.prompt) return content.prompt;
  if (content.template) return content.template.replace(/\{\{\s*\w+\s*\}\}/g, '____');
  return '—';
}

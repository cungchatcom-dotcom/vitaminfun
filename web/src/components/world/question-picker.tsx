'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { QUESTION_TYPE_META } from '@/components/question/registry';
import { Badge, EmptyState, Skeleton } from '@/components/ui/primitives';
import {
  QUESTION_TYPES,
  listQuestionCodes,
  listQuestions,
  type QuestionSummary,
} from '@/lib/questions';

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
  stageCode,
  onToggle,
}: {
  selected: Set<string>;
  /** Id câu hỏi đã có trong nhiệm vụ đang chọn. */
  alreadyIn: Set<string>;
  /**
   * Mã màn chơi đang mở. Có mã thì kho được lọc SẴN về màn này.
   *
   * Đây là chỗ "vào một màn thì tự hiện câu hỏi của màn đó" thành hình: người
   * dựng vừa nhập một file nghìn câu, và thứ họ cần lúc lắp nhiệm vụ là hai
   * mươi sáu câu của màn đang mở, không phải cả kho.
   */
  stageCode?: string | null;
  onToggle: (question: QuestionSummary) => void;
}) {
  const t = useTranslations();

  const [items, setItems] = useState<QuestionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState('');
  const [level, setLevel] = useState('');

  /**
   * Mã màn / mã nhiệm vụ đang lọc. Hai Ô CHỌN THẬT, luôn hiện.
   *
   * Trước đây chỗ này là một ô tích chỉ hiện khi màn ĐANG MỞ đã có mã — và
   * đúng vào lúc cần nhất thì nó vắng mặt: người dựng vừa nhập một file, chưa
   * màn nào mang mã nào, nên không có gì để tích và không có đường nào lọc.
   *
   * Chuỗi rỗng = không lọc. Danh sách mã lấy từ KHO, nên chọn được cả mã mà
   * chưa màn nào mang.
   */
  const [locMan, setLocMan] = useState(stageCode ?? '');
  const [locNhiemVu, setLocNhiemVu] = useState('');

  /** Mã có thật trong kho — nguồn cho hai ô chọn. */
  const [ma, setMa] = useState<{ stage_codes: string[]; quest_codes: string[] }>({
    stage_codes: [],
    quest_codes: [],
  });

  // Danh sách mã nạp lại khi ĐỔI MÃ MÀN: mã nhiệm vụ thu hẹp theo màn, vì một
  // world nhiều màn có hàng trăm mã nhiệm vụ và một danh sách dài như thế thì
  // không chọn được bằng mắt.
  useEffect(() => {
    const controller = new AbortController();
    void listQuestionCodes(locMan || null, controller.signal)
      .then((data) => setMa({ stage_codes: data.stage_codes, quest_codes: data.quest_codes }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [locMan]);

  // Đổi màn thì mã nhiệm vụ cũ gần như chắc chắn không thuộc màn mới, và giữ nó
  // lại là một danh sách rỗng mà không có gì giải thích vì sao.
  useEffect(() => {
    setLocNhiemVu('');
  }, [locMan]);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      try {
        const data = await listQuestions(
          {
            q: keyword,
            type,
            level,
            status: 'published',
            stage_code: locMan || undefined,
            quest_code: locNhiemVu || undefined,
            limit: 100,
          },
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
    [keyword, type, level, locMan, locNhiemVu],
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
        {/* Hai ô mã LUÔN hiện, kể cả khi kho chưa có mã nào — một ô trống nói
            "chưa có gì để lọc", còn một ô vắng mặt thì không nói gì cả và người
            dùng đi tìm một thứ không tồn tại. */}
        <select
          className="field-input w-auto font-mono text-xs"
          aria-label={t('question.bank.byStageCode')}
          value={locMan}
          onChange={(event) => setLocMan(event.target.value)}
        >
          <option value="">{t('question.bank.allStageCodes')}</option>
          {/* Mã của màn ĐANG MỞ luôn có mặt trong danh sách, kể cả khi kho chưa
              có câu nào mang mã đó: nếu không thì ô chọn im lặng nhảy về "tất
              cả" và người dựng tưởng bộ lọc hỏng. */}
          {[...new Set([...(stageCode ? [stageCode] : []), ...ma.stage_codes])].map((code) => (
            <option key={code} value={code}>
              {code}
              {code === stageCode ? ` ${t('question.bank.thisStage')}` : ''}
            </option>
          ))}
        </select>
        <select
          className="field-input w-auto font-mono text-xs"
          aria-label={t('question.bank.byQuestCode')}
          value={locNhiemVu}
          // Chưa có mã nhiệm vụ nào thì khoá lại thay vì để một ô chọn rỗng
          // bấm vào không ra gì.
          disabled={ma.quest_codes.length === 0}
          onChange={(event) => setLocNhiemVu(event.target.value)}
        >
          <option value="">{t('question.bank.allQuestCodes')}</option>
          {ma.quest_codes.map((code) => (
            <option key={code} value={code}>
              {code}
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
                        {/* MÃ NHIỆM VỤ đứng ĐẦU hàng, không nhét xuống cuối:
                            khi lọc theo một màn, đây là thứ duy nhất phân biệt
                            hai mươi sáu câu trông na ná nhau, và mắt phải bắt
                            được nó mà không cần đọc hết dòng.

                            Chữ mono vì nó là một MÃ — đọc theo ký tự, và cột
                            chữ đều nhau thì các câu cùng nhiệm vụ xếp thẳng
                            hàng, nhìn ra ngay đâu là một cụm. */}
                        {item.quest_code && (
                          <span className="rounded bg-lagoon-500/15 px-1.5 py-0.5 font-mono text-[11px] text-lagoon-300">
                            {item.quest_code}
                            {/* Số thứ tự TRONG nhiệm vụ, đúng thứ tự của file.
                                Không có nó thì bốn câu cùng một mã là bốn dòng
                                không phân biệt được. */}
                            {item.question_order != null && (
                              <span className="text-lagoon-400/60">·{item.question_order}</span>
                            )}
                          </span>
                        )}
                        {/* Mã màn chỉ hiện khi KHÔNG lọc theo màn: đang lọc rồi
                            thì mọi dòng đều mang cùng một mã, và một cột giống
                            hệt nhau chỉ ăn chỗ của thứ đáng đọc. */}
                        {!locMan && item.stage_code && (
                          <span className="font-mono text-[11px] text-slate-600">
                            {item.stage_code}
                          </span>
                        )}
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

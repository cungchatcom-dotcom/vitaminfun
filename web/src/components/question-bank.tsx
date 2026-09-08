'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { ImportPanel } from '@/components/question/import-panel';
import { QUESTION_TYPE_META } from '@/components/question/registry';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { LinkButton } from '@/components/ui/link-button';
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';
import { QUESTION_TYPES, listQuestions, type QuestionSummary } from '@/lib/questions';
import { localizedPath } from '@/lib/routes';

/**
 * Kho câu hỏi (màn T1).
 *
 * Cố ý KHÔNG hiện đáp án ở màn danh sách: chỉ cần một lần chiếu màn hình trong
 * lớp là cả lớp thấy đáp án. API cũng không trả đáp án ở đường này — xem
 * `service.to_out(include_answer=False)`.
 */
export function QuestionBank() {
  const t = useTranslations();
  const locale = useLocale();

  const [items, setItems] = useState<QuestionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [code, setCode] = useState('');
  // Đổi sau mỗi lần nhập xong để danh sách tải lại — nhập 26 câu mà bảng vẫn
  // trống là thứ khiến người dùng bấm nhập lần nữa.
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      try {
        const data = await listQuestions(
          { type, status, q: keyword, stage_code: code || undefined },
          signal,
        );
        if (signal.aborted) return;
        setItems(data.items);
        setTotal(data.total);
      } catch (error) {
        // Huỷ do gõ tiếp thì bỏ qua, không phải lỗi.
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setItems([]);
        setTotal(0);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [type, status, keyword, code, reloadKey],
  );

  useEffect(() => {
    // Chờ một nhịp trước khi gọi API để gõ tìm kiếm không bắn mỗi ký tự một
    // request. `AbortController` huỷ hẳn request cũ — không có nó thì phản hồi
    // đến muộn của lần gõ trước sẽ ghi đè kết quả mới hơn.
    const controller = new AbortController();
    const timer = setTimeout(() => void load(controller.signal), 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb
        items={[
          { label: t('teacher.title'), href: localizedPath('/teacher', locale) },
          { label: t('question.bank.title') },
        ]}
      />
      <PageHeader
        title={t('question.bank.title')}
        description={t('question.bank.count', { count: total })}
        actions={
          <LinkButton variant="primary" href="/teacher/questions/new">
            {t('question.bank.create')}
          </LinkButton>
        }
      />

      <ImportPanel onDone={() => setReloadKey((n) => n + 1)} />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-3">
          <input
            className="field-input max-w-72"
            placeholder={t('question.bank.search')}
            aria-label={t('question.bank.search')}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <select
            className="field-input w-auto"
            aria-label={t('question.bank.allTypes')}
            value={type}
            onChange={(event) => setType(event.target.value)}
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
            aria-label={t('question.bank.allStatus')}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">{t('question.bank.allStatus')}</option>
            <option value="draft">{t('status.draft')}</option>
            <option value="published">{t('status.published')}</option>
          </select>
          {/* Lọc theo MÃ MÀN CHƠI. Ô gõ tự do chứ không phải danh sách chọn:
              mã do bộ phận nội dung đặt trong file, kho không có sẵn danh sách
              các mã đang tồn tại, và một ô gõ thì luôn đúng. */}
          <input
            className="field-input w-auto max-w-40 font-mono"
            placeholder={t('question.bank.stageCode')}
            aria-label={t('question.bank.stageCode')}
            value={code}
            onChange={(event) => setCode(event.target.value.trim())}
          />
        </div>
      </Card>

      <Card padded={false} className="p-4">
        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            <DataTable
              columns={[
                t('field.title'),
                t('question.bank.code'),
                t('field.type'),
                t('field.score'),
                t('field.status'),
                t('field.action'),
              ]}
              emptyLabel={t('question.bank.empty')}
              rows={items.map((item) => [
                <span key="p" className="line-clamp-2">
                  {summarize(item)}
                </span>,
                // Địa chỉ gốc. Câu soạn tay không có mã, và ô trống ở đây nói
                // đúng điều đó — không bịa một dấu gạch trông như dữ liệu.
                <span key="c" className="font-mono text-[11px] text-slate-500">
                  {item.quest_code ?? ''}
                  {item.question_order != null && (
                    <span className="text-slate-600"> #{item.question_order}</span>
                  )}
                </span>,
                t(QUESTION_TYPE_META[item.type]?.labelKey ?? 'field.type'),
                item.points,
                <Badge key="s" tone={item.status === 'published' ? 'success' : 'neutral'}>
                  {t(item.status === 'published' ? 'status.published' : 'status.draft')}
                </Badge>,
                <LinkButton
                  key="a"
                  variant="ghost"
                  size="sm"
                  href={`/teacher/questions/${item.id}`}
                >
                  {t('common.action.edit')}
                </LinkButton>,
              ])}
            />

            {items.length === 0 && (
              <EmptyState
                label={t('question.bank.empty')}
                hint={t('question.bank.emptyHint')}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}

/**
 * Một dòng tóm tắt để nhận ra câu hỏi trong danh sách.
 *
 * Dạng trắc nghiệm có sẵn đề bài; dạng ô trống thì lấy chính câu có ô trống,
 * thay `{{1}}` bằng gạch chân cho dễ đọc.
 */
function summarize(item: QuestionSummary): string {
  const content = item.content as { prompt?: string; template?: string };
  if (content.prompt) return content.prompt;
  if (content.template) return content.template.replace(/\{\{\s*\w+\s*\}\}/g, '____');
  return '—';
}

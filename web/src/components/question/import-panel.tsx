'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Card } from '@/components/ui/primitives';
import { ApiError } from '@/lib/api-error';
import { importQuestions, type ImportReport } from '@/lib/questions';

/** Đuôi file nhận được. Phải khớp thứ `openpyxl` đọc được bên server. */
const ACCEPT = '.xlsx';

/**
 * Nhập câu hỏi từ file .xlsx của bộ phận nội dung.
 *
 * ## Vì sao có một bảng KẾT QUẢ chứ không chỉ một dòng "đã nhập xong"
 *
 * Nhập khẩu là thao tác ghi hàng loạt từ một file do người khác soạn, và nó
 * hỏng theo những kiểu rất im lặng: lệch một cột, một dòng thiếu đáp án, hay
 * một mã nhiệm vụ gõ sai. Một chữ "thành công" ở đây là mời người dùng tin vào
 * điều họ không kiểm được.
 *
 * Nên mọi con số đều nói rõ và đều đếm lại được bằng cách mở kho ra xem: tạo
 * mới bao nhiêu, ghi đè bao nhiêu, lắp được vào nhiệm vụ bao nhiêu, còn bao
 * nhiêu nằm lại trong kho. Danh sách mã nhiệm vụ chưa có chính là việc-cần-làm
 * tiếp theo, viết sẵn ra.
 */
export function ImportPanel({ onDone }: { onDone: () => void }) {
  const t = useTranslations('question.import');
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File) {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const result = await importQuestions(file);
      setReport(result);
      onDone();
    } catch (err) {
      // Mã lỗi của server có bản dịch riêng — `IMPORT_SHEET_MISSING` nói được
      // "thiếu sheet Questions", trong khi một chữ "lỗi" thì không giúp gì.
      setError(err instanceof ApiError ? `error.${err.code}` : 'error.INTERNAL_ERROR');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-200">{t('title')}</p>
          <p className="mt-0.5 text-xs leading-snug text-slate-500">{t('hint')}</p>
        </div>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void pick(file);
            // Xoá giá trị để chọn LẠI CÙNG một file vẫn bắn `change`. Không có
            // dòng này thì sửa file rồi nhập lại lần hai sẽ im lặng không làm gì.
            event.target.value = '';
          }}
          className="block text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-abyss-800 file:px-3 file:py-1.5 file:text-slate-200 hover:file:bg-abyss-700"
        />
      </div>

      {busy && <p className="mt-2 text-xs text-slate-500">{t('running')}</p>}
      {error && <p className="mt-2 text-xs text-coral-400">{t(error)}</p>}
      {report && <Report report={report} />}
    </Card>
  );
}

function Report({ report }: { report: ImportReport }) {
  const t = useTranslations('question.import');
  const so = [
    ['created', report.created],
    ['updated', report.updated],
    ['linked', report.linked],
    ['alreadyLinked', report.already_linked],
    ['inBank', report.in_bank],
  ] as const;

  return (
    <div className="mt-3 rounded-lg border border-abyss-700 bg-abyss-900/60 p-3">
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {so.map(([key, value]) => (
          <span key={key} className="text-xs text-slate-400">
            {t(key)}{' '}
            {/* Con số nổi bật hơn nhãn: người dùng quét bảng này để tìm SỐ, và
                cái họ sợ nhất là một số 0 ở chỗ đáng lẽ phải có gì đó. */}
            <b className={value > 0 ? 'text-slate-100' : 'text-slate-600'}>{value}</b>
          </span>
        ))}
      </div>

      {report.missing_quest_codes.length > 0 && (
        <div className="mt-2.5 border-t border-abyss-700 pt-2.5">
          <p className="text-xs text-amber-400/90">{t('missingQuests')}</p>
          <p className="mt-1 font-mono text-[11px] break-all text-slate-400">
            {report.missing_quest_codes.join(', ')}
          </p>
        </div>
      )}

      {report.skipped.length > 0 && (
        <div className="mt-2.5 border-t border-abyss-700 pt-2.5">
          <p className="text-xs text-coral-400">{t('skipped', { count: report.skipped.length })}</p>
          {/* Cuộn được, và có TRẦN chiều cao: một file hỏng nặng sinh ra hàng
              trăm dòng, và chúng sẽ đẩy cả trang xuống dưới màn hình. */}
          <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-[11px] text-slate-400">
            {report.skipped.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

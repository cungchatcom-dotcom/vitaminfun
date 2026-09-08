'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';

import { PICKER_TYPES } from '@/components/question/registry';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Card, PageHeader } from '@/components/ui/primitives';
import { localizedPath } from '@/lib/routes';

/**
 * Màn chọn loại câu hỏi.
 *
 * Chỉ hiện những dạng ĐÃ CHẤM ĐƯỢC. Bày sẵn dạng chưa làm xong để "trông cho
 * phong phú" là mời giáo viên soạn một câu mà hệ thống không chấm nổi — và lỗi
 * đó chỉ lộ ra khi học sinh đang chơi.
 */
export default function SelectQuestionTypePage() {
  const t = useTranslations();
  const locale = useLocale();
  const [keyword, setKeyword] = useState('');

  const query = keyword.trim().toLowerCase();
  const shown = PICKER_TYPES.filter(
    (meta) => !query || t(meta.labelKey).toLowerCase().includes(query),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <Breadcrumb
        items={[
          { label: t('teacher.title'), href: localizedPath('/teacher', locale) },
          { label: t('question.bank.title'), href: localizedPath('/teacher/questions', locale) },
          { label: t('question.new.title') },
        ]}
      />
      <PageHeader title={t('question.new.title')} description={t('question.new.subtitle')} />

      <input
        className="field-input mb-6"
        placeholder={t('question.new.search')}
        aria-label={t('question.new.search')}
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
      />

      <p className="mb-3 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {t('question.new.group')}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {shown.map((meta) => (
          // Liên kết chứ không phải nút: Next tải trước trang soạn ngay khi thẻ
          // này hiện ra, nên bấm vào là mở gần như tức thì.
          <Link
            key={meta.type}
            href={localizedPath(`/teacher/questions/new/${meta.type}`, locale)}
            className="flex flex-col items-center gap-2 rounded-2xl border border-abyss-800 bg-abyss-900/50 p-5 text-center no-underline transition hover:border-lagoon-500"
          >
            <span aria-hidden className="text-3xl">
              {meta.icon}
            </span>
            <span className="font-bold text-slate-100">{t(meta.labelKey)}</span>
            <span className="text-xs text-slate-400">{t(meta.descKey)}</span>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <p className="text-center text-sm text-slate-400">{t('question.new.moreSoon')}</p>
      </Card>
    </div>
  );
}

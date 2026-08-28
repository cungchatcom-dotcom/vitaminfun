import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';

import { Card, PageHeader, SectionTitle } from '@/components/ui/primitives';
import { apiFetch } from '@/lib/api-client';
import { requireUser } from '@/lib/auth';
import type { components } from '@/lib/api-types';

// Trang này hiển thị dữ liệu RIÊNG của từng người, không bao giờ được nằm
// trong bộ nhớ đệm dùng chung. `cookies()` vốn đã làm nó động, nhưng ghi rõ ra
// đây vì hậu quả của việc đoán sai là người này thấy trang của người kia.
export const dynamic = 'force-dynamic';

type QuestionList = components['schemas']['QuestionListOut'];

export default async function TeacherDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireUser();
  const t = await getTranslations('teacher');

  // Chỉ cần con số tổng, nên lấy 1 bản ghi thay vì cả trang danh sách.
  const [all, published] = await Promise.all([
    apiFetch<QuestionList>('/questions?limit=1'),
    apiFetch<QuestionList>('/questions?limit=1&status=published'),
  ]);

  const stats: [string, number][] = [
    ['statQuestions', all.total],
    ['statPublished', published.total],
    ['statWorlds', 0],
    ['statStages', 0],
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t('title')}
        description={t('welcome', { name: user.display_name })}
        actions={
          user.can_preview ? (
            // Nửa bất đối xứng của luật điều hướng: giáo viên đi thẳng sang
            // giao diện học sinh để chơi thử. Xem ARCHITECTURE.md §4.
            <Link
              href="/play"
              className="inline-flex items-center gap-2 rounded-xl border border-orichalcum-500/40 bg-orichalcum-500/10 px-4 py-2 text-sm font-medium text-orichalcum-400 transition hover:bg-orichalcum-500/20"
            >
              🧪 {t('previewCta')}
            </Link>
          ) : null
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <SectionTitle>{t('todo')}</SectionTitle>
          <p className="text-sm text-slate-500">{t('emptyTodo')}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link
              href="/teacher/questions"
              className="text-lagoon-400 underline-offset-2 hover:underline"
            >
              {t('openBank')} →
            </Link>
            <Link
              href="/teacher/worlds"
              className="text-lagoon-400 underline-offset-2 hover:underline"
            >
              {t('openWorlds')} →
            </Link>
          </div>
        </Card>

        <Card>
          <SectionTitle>{t('stats')}</SectionTitle>
          <dl className="space-y-2 text-sm">
            {stats.map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <dt className="text-slate-400">{t(key as 'statQuestions')}</dt>
                <dd className="font-mono text-slate-200">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}

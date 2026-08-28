import { setRequestLocale } from 'next-intl/server';

import { QuestionBank } from '@/components/question-bank';

export const dynamic = 'force-dynamic';

export default async function QuestionBankPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <QuestionBank />;
}

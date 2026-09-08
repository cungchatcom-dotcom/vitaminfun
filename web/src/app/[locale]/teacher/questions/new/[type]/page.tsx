import { notFound } from 'next/navigation';

import { QuestionEditor } from '@/components/question/editor';
import { isQuestionType } from '@/components/question/registry';

export const dynamic = 'force-dynamic';

/**
 * Soạn câu hỏi mới.
 *
 * Dạng bài nằm trong đường dẫn nên gửi được link thẳng tới đúng loại cần soạn.
 */
export default async function NewQuestionPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  if (!isQuestionType(type)) notFound();
  return <QuestionEditor initialType={type} />;
}

import { QuestionEditor } from '@/components/question/editor';

export const dynamic = 'force-dynamic';

/** Sửa một câu hỏi đã có trong kho. */
export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuestionEditor questionId={id} />;
}

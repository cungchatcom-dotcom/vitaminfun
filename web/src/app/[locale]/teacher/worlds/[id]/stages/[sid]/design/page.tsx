import { setRequestLocale } from 'next-intl/server';

import { StageDesigner } from '@/components/world/stage-designer';

export const dynamic = 'force-dynamic';

/**
 * Giao diện thiết kế đồ hoạ màn chơi.
 *
 * Đặt cạnh màn T3 (`../`) chứ không thay nó: T3 là chỗ làm việc với NỘI DUNG
 * (câu hỏi, điểm, điều kiện xuất bản), còn đây là chỗ làm việc với BỐ CỤC.
 * Hai việc khác nhau, hai màn hình, cùng một dữ liệu.
 */
export default async function StageDesignPage({
  params,
}: {
  params: Promise<{ locale: string; id: string; sid: string }>;
}) {
  const { locale, id, sid } = await params;
  setRequestLocale(locale);
  return <StageDesigner stageId={sid} worldId={id} />;
}

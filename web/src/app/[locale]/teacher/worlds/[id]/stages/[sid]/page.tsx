import { setRequestLocale } from 'next-intl/server';

import { StageBuilder } from '@/components/world/stage-builder';

export const dynamic = 'force-dynamic';

/**
 * Màn T3 — gán câu hỏi vào các nhiệm vụ của một màn chơi.
 *
 * `id` (world) không cần cho việc tải dữ liệu — `stages/{sid}` đã đủ. Nó có mặt
 * trong đường dẫn để breadcrumb biết đường quay về đúng world, kể cả khi người
 * dùng mở thẳng URL này trong tab mới và lịch sử trình duyệt đang trống.
 */
export default async function StagePage({
  params,
}: {
  params: Promise<{ locale: string; id: string; sid: string }>;
}) {
  const { locale, id, sid } = await params;
  setRequestLocale(locale);
  return <StageBuilder stageId={sid} worldId={id} />;
}

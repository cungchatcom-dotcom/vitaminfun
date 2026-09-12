import { setRequestLocale } from 'next-intl/server';

import { DialogueDesigner } from '@/components/world/dialogue-designer';

export const dynamic = 'force-dynamic';

/**
 * Trình thiết kế màn hội thoại với người canh giữ.
 *
 * Đặt cạnh `../design` chứ không nhập vào nó: kia là bản đồ 3200×1800 học sinh
 * đi lại trên đó, đây là tấm bảng 1000×700 phủ lên màn hình. Hai hệ toạ độ, hai
 * việc, hai màn hình — nhét chung một chỗ là hai bộ kéo thả tranh nhau một
 * khung.
 */
export default async function StageDialoguePage({
  params,
}: {
  params: Promise<{ locale: string; id: string; sid: string }>;
}) {
  const { locale, id, sid } = await params;
  setRequestLocale(locale);
  return <DialogueDesigner stageId={sid} worldId={id} />;
}

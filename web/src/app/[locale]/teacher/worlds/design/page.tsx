import { setRequestLocale } from 'next-intl/server';

import { GalaxyDesigner } from '@/components/world/galaxy-designer';

// Trình thiết kế đọc dữ liệu sống, không bao giờ nằm trong bộ nhớ đệm dựng sẵn.
export const dynamic = 'force-dynamic';

/**
 * Trình thiết kế bản đồ thiên hà — màn chọn world mà học sinh nhìn thấy.
 *
 * Song song với `/teacher/worlds/[id]/stages/[id]/design`: cùng một ý, một bậc
 * cao hơn trong cây nội dung.
 *
 * Không dựng lại `AuthProvider` / `TopBar` ở đây — `teacher/layout.tsx` lo cả
 * khung lẫn việc kiểm vai trò cho mọi màn `/teacher/*`.
 */
export default async function GalaxyDesignPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GalaxyDesigner />;
}

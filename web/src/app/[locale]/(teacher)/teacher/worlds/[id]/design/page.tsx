import { setRequestLocale } from 'next-intl/server';

import { LobbyDesigner } from '@/components/world/lobby-designer';

export const dynamic = 'force-dynamic';

/**
 * Trình thiết kế phòng chờ của một world — màn hình học sinh thấy khi bấm vào
 * world đó trên bản đồ thiên hà.
 *
 * `(teacher)/layout.tsx` lo khung và việc kiểm vai trò cho mọi màn `/teacher/*`.
 */
export default async function LobbyDesignPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <LobbyDesigner worldId={id} />;
}

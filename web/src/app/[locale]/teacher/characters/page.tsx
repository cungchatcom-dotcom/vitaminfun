import { setRequestLocale } from 'next-intl/server';

import { CharacterManager } from '@/components/character/character-manager';

export const dynamic = 'force-dynamic';

/**
 * Quản lý nhân vật và người canh giữ. `teacher/layout.tsx` lo khung và phân quyền.
 *
 * `?id=` mở sẵn một nhân vật, `?kind=npc` mở sẵn thẻ người canh giữ. Trình
 * thiết kế nhiệm vụ dẫn tới đây bằng hai đường đó, nên đường dẫn cũng là thứ
 * dán được cho đồng nghiệp — một trạng thái giao diện chỉ nằm trong bộ nhớ
 * React thì không.
 */
export default async function CharactersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ id?: string; kind?: string }>;
}) {
  const { locale } = await params;
  const { id, kind } = await searchParams;
  setRequestLocale(locale);
  return <CharacterManager initialId={id} initialKind={kind === 'npc' ? 'npc' : undefined} />;
}

import { setRequestLocale } from 'next-intl/server';

import { CharacterManager } from '@/components/character/character-manager';

export const dynamic = 'force-dynamic';

/** Quản lý nhân vật người chơi. `teacher/layout.tsx` lo khung và phân quyền. */
export default async function CharactersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CharacterManager />;
}

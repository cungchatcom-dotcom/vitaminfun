import { setRequestLocale } from 'next-intl/server';

import { WorldDetail } from '@/components/world/world-detail';

export const dynamic = 'force-dynamic';

export default async function WorldPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <WorldDetail worldId={id} />;
}

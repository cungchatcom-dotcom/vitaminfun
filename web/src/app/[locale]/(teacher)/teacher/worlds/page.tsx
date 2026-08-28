import { setRequestLocale } from 'next-intl/server';

import { WorldList } from '@/components/world/world-list';

export const dynamic = 'force-dynamic';

export default async function WorldsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <WorldList />;
}

'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Badge, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/primitives';
import { ApiError } from '@/lib/api-error';
import { pickText } from '@/lib/i18n-text';
import { localizedPath } from '@/lib/routes';
import { listWorlds, type World } from '@/lib/worlds';


export function WorldList() {
  const t = useTranslations();
  const locale = useLocale();

  const [worlds, setWorlds] = useState<World[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    listWorlds()
      .then(setWorlds)
      .catch((error: unknown) =>
        setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR'),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <Breadcrumb
        items={[
          { label: t('teacher.title'), href: localizedPath('/teacher', locale) },
          { label: t('world.list.title') },
        ]}
      />
      <PageHeader
        title={t('world.list.title')}
        description={t('world.list.subtitle')}
        actions={
          <Link href={localizedPath('/teacher/worlds/design', locale)}>
            <Button variant="primary" size="sm">
              🎨 {t('galaxy.designer.open')}
            </Button>
          </Link>
        }
      />

      {errorKey && (
        <p role="alert" className="mb-4 rounded-lg bg-coral-500/15 px-4 py-2 text-sm text-coral-500">
          {t(errorKey)}
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : worlds.length === 0 ? (
        <EmptyState label={t('world.list.empty')} hint={t('world.list.emptyHint')} />
      ) : (
        <div className="space-y-3">
          {worlds.map((world) => (
            <Link
              key={world.id}
              href={localizedPath(`/teacher/worlds/${world.id}`, locale)}
              className="block no-underline"
            >
              <Card className="transition hover:border-lagoon-500">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-100">
                      {pickText(world.name_i18n, locale)}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {t('world.detail.summary', {
                        chapters: world.chapter_count,
                        stages: world.stage_count,
                        published: world.stage_published_count,
                        shards: world.shard_total,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="info">{t(`world.difficulty.${world.difficulty}`)}</Badge>
                    <Badge tone={world.status === 'published' ? 'success' : 'neutral'}>
                      {t(world.status === 'published' ? 'status.published' : 'status.draft')}
                    </Badge>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

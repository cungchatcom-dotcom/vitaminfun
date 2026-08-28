'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from '@/components/ui/primitives';
import { ApiError } from '@/lib/api-error';
import { ownText, pickText } from '@/lib/i18n-text';
import { localizedPath } from '@/lib/routes';
import { useAsyncAction } from '@/lib/use-async-action';
import {
  createChapter,
  createStage,
  deleteChapter,
  getWorld,
  listChapters,
  updateChapter,
  updateWorld,
  type Chapter,
  type World,
} from '@/lib/worlds';


/** Chương và màn chơi của một world. */
export function WorldDetail({ worldId }: { worldId: string }) {
  const t = useTranslations();
  const locale = useLocale();

  const [world, setWorld] = useState<World | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addingChapter, setAddingChapter] = useState(false);
  const [editingChapter, setEditingChapter] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [w, c] = await Promise.all([getWorld(worldId), listChapters(worldId)]);
      setWorld(w);
      setChapters(c);
      setErrorKey(null);
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    } finally {
      setLoading(false);
    }
  }, [worldId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function withError(fn: () => Promise<unknown>) {
    setErrorKey(null);
    try {
      await fn();
      await reload();
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    }
  }

  if (loading) return <p className="p-8 text-slate-400">{t('common.loading')}</p>;
  if (!world) {
    return (
      <p role="alert" className="p-8 text-coral-500">
        {t(errorKey ?? 'error.NOT_FOUND')}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Breadcrumb
        items={[
          { label: t('teacher.title'), href: localizedPath('/teacher', locale) },
          { label: t('world.list.title'), href: localizedPath('/teacher/worlds', locale) },
          { label: pickText(world.name_i18n, locale) },
        ]}
      />
      <PageHeader
        title={pickText(world.name_i18n, locale)}
        description={t('world.detail.summary', {
          chapters: world.chapter_count,
          stages: world.stage_count,
          published: world.stage_published_count,
          shards: world.shard_total,
        })}
        badge={
          <Badge tone={world.status === 'published' ? 'success' : 'neutral'}>
            {t(world.status === 'published' ? 'status.published' : 'status.draft')}
          </Badge>
        }
        actions={
          <>
            <Link href={localizedPath(`/teacher/worlds/${world.id}/design`, locale)}>
              <Button variant="primary">🎨 {t('galaxy.designer.open')}</Button>
            </Link>
            <Link
              href={localizedPath('/play', locale)}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-lg border border-orichalcum-500/40 bg-orichalcum-500/10 px-4 py-2 text-sm font-medium text-orichalcum-400 transition hover:bg-orichalcum-500/20"
            >
              🧪 {t('teacher.previewCta')}
            </Link>
            <Button
              variant={world.status === 'published' ? 'secondary' : 'primary'}
              onClick={() =>
                withError(() =>
                  updateWorld(world.id, {
                    status: world.status === 'published' ? 'draft' : 'published',
                  }),
                )
              }
            >
              {t(
                world.status === 'published'
                  ? 'world.detail.unpublishWorld'
                  : 'world.detail.publishWorld',
              )}
            </Button>
          </>
        }
      />

      <p className="mb-4 text-xs text-slate-500">{t('world.detail.publishWorldHint')}</p>

      {errorKey && (
        <p role="alert" className="mb-4 rounded-lg bg-coral-500/15 px-4 py-2 text-sm text-coral-500">
          {t(errorKey)}
        </p>
      )}

      <div className="space-y-4">
        {chapters.map((chapter) => (
          <Card key={chapter.id}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <SectionTitle>
                {chapter.order_index}. {pickText(chapter.name_i18n, locale)}
              </SectionTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAddingTo(addingTo === chapter.id ? null : chapter.id)}
                >
                  {t('world.detail.addStage')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setEditingChapter(editingChapter === chapter.id ? null : chapter.id)
                  }
                >
                  {t('world.detail.editChapter')}
                </Button>
                {chapter.stages.length === 0 && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      // Hỏi lại trước khi xoá: đây là thao tác không hoàn tác được.
                      if (!window.confirm(t('world.detail.confirmDeleteChapter'))) return;
                      void withError(() => deleteChapter(chapter.id));
                    }}
                  >
                    {t('world.detail.deleteChapter')}
                  </Button>
                )}
              </div>
            </div>

            {editingChapter === chapter.id && (
              <ChapterForm
                initialName={ownText(chapter.name_i18n, locale)}
                initialOrder={chapter.order_index}
                submitLabel={t('common.action.save')}
                onSubmit={async (name, order) => {
                  await withError(() =>
                    updateChapter(chapter.id, {
                      name_i18n: { ...chapter.name_i18n, [locale]: name },
                      order_index: order,
                    }),
                  );
                  setEditingChapter(null);
                }}
              />
            )}

            {chapter.stages.length === 0 ? (
              <p className="text-sm text-slate-500">{t('world.detail.noStage')}</p>
            ) : (
              <ul className="space-y-2">
                {chapter.stages.map((stage) => (
                  <li key={stage.id}>
                    <Link
                      href={localizedPath(
                        `/teacher/worlds/${worldId}/stages/${stage.id}`,
                        locale,
                      )}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-abyss-800 bg-abyss-900/40 px-4 py-2.5 no-underline transition hover:border-lagoon-500"
                    >
                      <span className="font-mono text-xs text-slate-500">
                        #{stage.order_index}
                      </span>
                      <span className="flex-1 text-slate-100">
                        {pickText(stage.name_i18n, locale)}
                      </span>
                      <span className="text-xs text-slate-500">
                        🗺 {stage.map_shard_index}
                      </span>
                      <span className="text-xs text-slate-500">
                        {t('world.detail.questCount', { count: stage.quest_count })}
                      </span>
                      <Badge tone={stage.status === 'published' ? 'success' : 'neutral'}>
                        {t(stage.status === 'published' ? 'status.published' : 'status.draft')}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {addingTo === chapter.id && (
              <NewStageForm
                chapterId={chapter.id}
                nextOrder={Math.max(0, ...chapter.stages.map((s) => s.order_index)) + 1}
                nextShard={world.stage_count + 1}
                onDone={async () => {
                  setAddingTo(null);
                  await reload();
                }}
                onError={setErrorKey}
              />
            )}
          </Card>
        ))}

        {chapters.length === 0 && (
          <EmptyState label={t('world.detail.noChapter')} hint={t('world.detail.noChapterHint')} />
        )}

        <Card>
          {addingChapter ? (
            <ChapterForm
              initialName=""
              initialOrder={Math.max(0, ...chapters.map((c) => c.order_index)) + 1}
              submitLabel={t('world.detail.createChapter')}
              onSubmit={async (name, order) => {
                await withError(() =>
                  createChapter(worldId, { name_i18n: { [locale]: name }, order_index: order }),
                );
                setAddingChapter(false);
              }}
            />
          ) : (
            <Button variant="secondary" onClick={() => setAddingChapter(true)}>
              {t('world.detail.addChapter')}
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Form chương, dùng chung cho tạo mới và sửa — hai form giống hệt nhau. */
function ChapterForm({
  initialName,
  initialOrder,
  submitLabel,
  onSubmit,
}: {
  initialName: string;
  initialOrder: number;
  submitLabel: string;
  onSubmit: (name: string, order: number) => Promise<void>;
}) {
  const t = useTranslations();
  const [name, setName] = useState(initialName);
  const [order, setOrder] = useState(initialOrder);

  const { run: submit, pending } = useAsyncAction(async () => {
    if (!name.trim()) return;
    await onSubmit(name.trim(), order);
  });

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
      <label className="block">
        <span className="field-label">{t('world.detail.chapterName')}</span>
        <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block">
        <span className="field-label">{t('world.detail.chapterOrder')}</span>
        <input
          type="number"
          className="field-input"
          value={order}
          onChange={(e) => setOrder(Number(e.target.value))}
        />
      </label>
      <Button variant="primary" loading={pending} disabled={!name.trim()} onClick={submit}>
        {submitLabel}
      </Button>
    </div>
  );
}

function NewStageForm({
  chapterId,
  nextOrder,
  nextShard,
  onDone,
  onError,
}: {
  chapterId: string;
  nextOrder: number;
  nextShard: number;
  onDone: () => Promise<void>;
  onError: (key: string) => void;
}) {
  const t = useTranslations();
  const [nameVi, setNameVi] = useState('');
  const [sceneKey, setSceneKey] = useState('');
  const [advisor, setAdvisor] = useState('');

  const { run: submit, pending } = useAsyncAction(async () => {
    if (!nameVi.trim() || !sceneKey.trim()) return;
    try {
      await createStage(chapterId, {
        name_i18n: { vi: nameVi.trim() },
        order_index: nextOrder,
        scene_key: sceneKey.trim(),
        map_shard_index: nextShard,
        advisor_npc_key: advisor.trim() || null,
      });
      await onDone();
    } catch (error) {
      onError(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    }
  });

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-dashed border-abyss-700 p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="field-label">{t('stage.field.name')}</span>
          <input
            className="field-input"
            value={nameVi}
            onChange={(e) => setNameVi(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="field-label">{t('stage.field.sceneKey')}</span>
          <input
            className="field-input"
            placeholder="ship_deck_01"
            value={sceneKey}
            onChange={(e) => setSceneKey(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="field-label">{t('stage.field.advisor')}</span>
          <input
            className="field-input"
            placeholder="captain_drake"
            value={advisor}
            onChange={(e) => setAdvisor(e.target.value)}
          />
        </label>
      </div>
      <p className="text-xs text-slate-500">
        {t('world.detail.newStageHint', { order: nextOrder, shard: nextShard })}
      </p>
      <Button
        variant="primary"
        size="sm"
        loading={pending}
        disabled={!nameVi.trim() || !sceneKey.trim()}
        onClick={submit}
      >
        {t('world.detail.createStage')}
      </Button>
    </div>
  );
}

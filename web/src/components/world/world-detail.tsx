'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { VerdictPanel } from './verdict-panel';
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
  deleteWorld,
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
  const router = useRouter();

  const [world, setWorld] = useState<World | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
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


  /**
   * Thêm màn chơi: tạo NGAY rồi đi thẳng vào màn chỉnh sửa.
   *
   * Không còn cái hộp hỏi ba ô nữa. Ba ô đó hỏi tên màn, `scene_key` và tên NPC
   * — mà `scene_key` thì không chỗ nào đọc tới, tên NPC đã có chỗ đặt bên trong
   * màn chỉnh sửa, còn cái tên thì đằng nào người dựng cũng đổi sau khi nhìn
   * thấy màn chơi thật. Bắt trả lời ba câu trước khi được nhìn thấy thứ mình
   * vừa tạo là dựng một cái cổng không canh gì cả.
   *
   * Tên mặc định lấy theo SỐ THỨ TỰ ("Stage 5") và sửa tại chỗ ở màn chỉnh sửa.
   * Chuỗi nằm ở `messages/` chứ không sinh ở server: nó là chữ hiển thị, và
   * server thì không biết người dựng đang xem bằng ngôn ngữ nào.
   */
  const { run: addStage, pending: addingStage } = useAsyncAction(
    async (chapter: Chapter) => {
      const order = Math.max(0, ...chapter.stages.map((s) => s.order_index)) + 1;
      try {
        const stage = await createStage(chapter.id, {
          name_i18n: { [locale]: t('stage.defaultName', { order }) },
          order_index: order,
          map_shard_index: (world?.stage_count ?? 0) + 1,
        });
        router.push(
          localizedPath(`/teacher/worlds/${worldId}/stages/${stage.id}`, locale),
        );
      } catch (error) {
        setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
      }
    },
  );

  /**
   * Xoá world rồi VỀ DANH SÁCH.
   *
   * Không dùng `withError` như mọi nút khác: `withError` gọi `reload()` sau khi
   * xong, mà ở đây thứ vừa bị xoá chính là cái trang đang đứng — nạp lại nó là
   * đi thẳng vào nhánh 404.
   */
  const { run: xoaWorld, pending: dangXoa } = useAsyncAction(async () => {
    setErrorKey(null);
    try {
      await deleteWorld(worldId);
      router.replace(localizedPath('/teacher/worlds', locale));
      router.refresh();
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    }
  });

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

            {/* XOÁ WORLD — chỉ hiện khi world đã RỖNG.
                Cùng luật với nút xoá chương bên dưới, và cùng một lý do: khoá
                ngoại là CASCADE, nên xoá một world đang có nội dung sẽ kéo theo
                cả chương, màn, nhiệm vụ, mọi lượt chơi và mọi điểm chiến lực
                của học sinh trong world ấy — sau một cú bấm, không hoàn tác
                được. Ẩn nút đi khi còn chương là bắt người dựng đi qua từng
                bước, và mỗi bước là một lần nhìn thấy mình sắp mất gì.

                Đây là ẩn CÁI NÚT, không phải cái chặn: server vẫn từ chối bằng
                `WORLD_HAS_CHAPTERS`. */}
            {chapters.length === 0 && (
              <Button
                variant="danger"
                loading={dangXoa}
                onClick={() => {
                  if (!window.confirm(t('world.detail.confirmDeleteWorld'))) return;
                  void xoaWorld();
                }}
              >
                {t('world.detail.deleteWorld')}
              </Button>
            )}
          </>
        }
      />

      <p className="mb-4 text-xs text-slate-500">{t('world.detail.publishWorldHint')}</p>

      {/* MÃ WORLD trong file nội dung.
          Hôm nay các file chưa có cột `world_code`, nên ô này bình thường sẽ để
          trống — và đó là trạng thái ĐÚNG, không phải một việc còn dang dở. Có
          sẵn ô thì world thứ hai chỉ cần điền vào, không phải chờ một migration
          và một lần triển khai nữa. */}
      <label className="mb-4 flex flex-wrap items-center gap-2">
        <span className="field-label mb-0">{t('world.detail.worldCode')}</span>
        <input
          className="field-input w-40 font-mono text-xs"
          defaultValue={world.world_code ?? ''}
          placeholder="W1"
          onBlur={(event) => {
            const next = event.target.value.trim();
            if (next !== (world.world_code ?? '')) {
              void withError(() => updateWorld(world.id, { world_code: next || null }));
            }
          }}
        />
        <span className="text-xs text-slate-500">{t('world.detail.worldCodeHint')}</span>
      </label>

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
                  loading={addingStage}
                  onClick={() => addStage(chapter)}
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

          </Card>
        ))}

        {chapters.length === 0 && (
          <EmptyState label={t('world.detail.noChapter')} hint={t('world.detail.noChapterHint')} />
        )}

        {/* LỜI PHÁN — giọng điệu của cả world. Đặt SAU danh sách chương vì nó
            không phải thứ người dựng đụng tới hằng ngày: soạn một lần lúc dựng
            world, rồi thôi. */}
        <VerdictPanel
          value={world.verdict_json ?? {}}
          onSave={(next) =>
            withError(async () => {
              setWorld(await updateWorld(world.id, { verdict_json: next }));
            })
          }
        />

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

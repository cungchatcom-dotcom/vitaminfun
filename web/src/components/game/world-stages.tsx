import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { Breadcrumb } from '@/components/ui/breadcrumb';
import { LinkButton } from '@/components/ui/link-button';
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from '@/components/ui/primitives';

import { WorldLobby } from './world-lobby';
import { pickText } from '@/lib/i18n-text';
import { localizedPath } from '@/lib/routes';

import type { PlayStage, PlayWorldDetail } from '@/lib/types';

/**
 * Chi tiết một world (S1–S2): chương, màn chơi, tiến độ.
 *
 * Trạng thái khoá/mở do BACKEND trả về trong `unlocked`, frontend không tự so
 * điểm. Nếu tính lại ở đây thì có hai bản của cùng một luật, và bản sai là bản
 * cho người chơi vào màn họ chưa đủ điểm.
 */
export async function WorldStages({ world, locale }: { world: PlayWorldDetail; locale: string }) {
  const t = await getTranslations('play');

  return (
    <>
      <Breadcrumb
        items={[
          { label: t('title'), href: localizedPath('/play', locale) },
          { label: pickText(world.name_i18n, locale) },
        ]}
      />

      <PageHeader
        title={pickText(world.name_i18n, locale)}
        subtitle={pickText(world.story_i18n, locale)}
        badge={<Badge tone="info">{world.difficulty}</Badge>}
        actions={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border border-abyss-700 px-3 py-1 text-slate-300">
              {t('skillPts')}: <span className="font-mono text-orichalcum-400">{world.my_skill_pts}</span>
            </span>
            <span className="rounded-full border border-abyss-700 px-3 py-1 text-slate-300">
              {t('mapShards')}:{' '}
              <span className="font-mono text-lagoon-400">
                {world.my_shards} / {world.shard_total}
              </span>
            </span>
          </div>
        }
      />

      {/* Khung phòng chờ: vẽ đúng bố cục giáo viên đã kéo trong trình thiết
          kế. Danh sách chương dạng chữ bên dưới GIỮ LẠI — hàng chương trong
          khung chỉ hiện năm cái một lúc và không nói được số màn, còn danh
          sách thì đọc được cả world trong một cái liếc. Hai cách nhìn cùng một
          dữ liệu, không phải hai nguồn dữ liệu. */}
      <div className="mb-6">
        <WorldLobby world={world} />
      </div>

      {world.gate_ready && (
        <Card className="mb-6 border-orichalcum-500/40 bg-orichalcum-500/5">
          <p className="text-orichalcum-400">⏳ {t('gateReady')}</p>
        </Card>
      )}

      {world.chapters.length === 0 && <EmptyState label={t('noStagesYet')} />}

      {world.chapters.map((chapter) => (
        <section key={chapter.id} className="mb-8">
          <SectionTitle>
            {chapter.order_index}. {pickText(chapter.name_i18n, locale)}
          </SectionTitle>

          {/* Không có nhánh "chương này chưa có màn nào": server không gửi
              chương rỗng xuống nữa. Giữ lại một nhánh không bao giờ chạy là
              giữ một lời hứa sai về những gì màn hình này có thể hiện. */}
          <div className="grid gap-3 sm:grid-cols-2">
            {chapter.stages.map((stage) => (
              <StageCard key={stage.id} stage={stage} locale={locale} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

async function StageCard({ stage, locale }: { stage: PlayStage; locale: string }) {
  const t = await getTranslations('play');
  const href = localizedPath(`/play/stage/${stage.id}`, locale);

  return (
    <Card className={stage.unlocked ? '' : 'opacity-60'}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-slate-100">
            {stage.order_index}. {pickText(stage.name_i18n, locale)}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-sm text-slate-400">
            {pickText(stage.synopsis_i18n, locale)}
          </p>
        </div>
        {stage.completed && <Badge tone="success">✓ {t('completed')}</Badge>}
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <div>
          <dt className="inline">{t('quests')}: </dt>
          <dd className="inline font-mono">{stage.quest_count}</dd>
        </div>
        <div>
          <dt className="inline">{t('shard')}: </dt>
          <dd className="inline font-mono">#{stage.map_shard_index}</dd>
        </div>
        {stage.times_played > 0 && (
          <div>
            <dt className="inline">{t('bestScore')}: </dt>
            <dd className="inline font-mono text-orichalcum-400">{stage.best_score}</dd>
          </div>
        )}
      </dl>

      <div className="mt-4">
        {stage.unlocked ? (
          <LinkButton href={href} variant="primary" size="sm">
            {stage.times_played > 0 ? t('playAgain') : t('play')}
          </LinkButton>
        ) : (
          // Không dựng liên kết cho màn đang khoá: dẫn tới một trang chỉ để nó
          // báo lỗi thì thà đừng dẫn.
          <p className="text-xs text-slate-500">
            🔒 {t('locked', { required: stage.required_skill_pts })}
          </p>
        )}
      </div>
    </Card>
  );
}

/** Liên kết quay lại bản đồ thiên hà, dùng khi world không tồn tại. */
export async function BackToGalaxy({ locale }: { locale: string }) {
  const t = await getTranslations('play');
  return (
    <Link href={localizedPath('/play', locale)} className="text-sm text-lagoon-400">
      ← {t('title')}
    </Link>
  );
}

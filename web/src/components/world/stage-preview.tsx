'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Badge, Card, PageHeader, SectionTitle } from '@/components/ui/primitives';
import { ApiError } from '@/lib/api-error';
import { pickText } from '@/lib/i18n-text';
import { localizedPath } from '@/lib/routes';
import { getStage, type Stage } from '@/lib/worlds';


/**
 * Chơi thử một màn — bản trước khi có Phaser.
 *
 * Cảnh 2.5D đến ở Bước 5. Đến lúc đó, chính route này sẽ nạp `PhaserCanvas`
 * thay cho danh sách bên dưới.
 *
 * Trang này tồn tại từ bây giờ vì hai lý do:
 *   - Nút "Chơi thử" ở màn dựng phải dẫn tới đâu đó, không phải một trang 404.
 *   - Nhìn được thứ tự nhiệm vụ, thứ tự câu hỏi và số điểm đúng như học sinh sẽ
 *     gặp — đó là phần lớn giá trị của việc chơi thử NỘI DUNG, và nó không cần
 *     chờ đồ hoạ.
 *
 * Cố ý KHÔNG hiện đáp án: đây là màn của người chơi, và API cũng không trả
 * đáp án ở đường này.
 */
export function StagePreview({ stageId }: { stageId: string }) {
  const t = useTranslations();
  const locale = useLocale();

  const [stage, setStage] = useState<Stage | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    getStage(stageId)
      .then(setStage)
      .catch((error: unknown) =>
        setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR'),
      )
      .finally(() => setLoading(false));
  }, [stageId]);

  const crumbs = [
    { label: t('play.title'), href: localizedPath('/play', locale) },
    { label: stage ? pickText(stage.name_i18n, locale) : '…' },
  ];

  if (loading) return <p className="p-8 text-slate-400">{t('common.loading')}</p>;
  if (!stage) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <Breadcrumb items={crumbs} />
        <p role="alert" className="rounded-lg bg-coral-500/15 px-4 py-3 text-coral-500">
          {t(errorKey ?? 'error.NOT_FOUND')}
        </p>
      </div>
    );
  }

  const totalPoints = stage.quests.reduce((sum, q) => sum + q.total_points, 0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Breadcrumb items={crumbs} />

      <PageHeader
        title={pickText(stage.name_i18n, locale)}
        description={t('stage.preview.subtitle', { shard: stage.map_shard_index })}
        badge={
          <Badge tone={stage.status === 'published' ? 'success' : 'neutral'}>
            {t(stage.status === 'published' ? 'status.published' : 'status.draft')}
          </Badge>
        }
      />

      {/* Nói thẳng cái gì chưa có, thay vì để người dùng tự đoán vì sao không
          thấy cảnh 2.5D nào. */}
      <div className="mb-6 rounded-xl border border-orichalcum-500/40 bg-orichalcum-500/10 px-4 py-3 text-sm text-orichalcum-400">
        🚧 {t('stage.preview.noSceneYet', { scene: stage.scene_key })}
      </div>

      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        <Stat label={t('stage.field.timeLimit')} value={`${stage.time_limit_seconds}s`} />
        <Stat label={t('stage.field.energy')} value={stage.initial_team_energy} />
        <Stat label={t('stage.preview.totalPoints')} value={totalPoints} />
        <Stat
          label={t('stage.field.requiredSkillPts')}
          value={stage.required_skill_pts_effective}
        />
      </div>

      <div className="space-y-4">
        {stage.quests.map((quest) => (
          <Card key={quest.id}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <SectionTitle>{quest.quest_object_key}</SectionTitle>
              <Badge tone={quest.phase === 'advisor' ? 'info' : 'neutral'}>
                {t(`stage.phase.${quest.phase}`)}
              </Badge>
              <span className="text-xs text-slate-500">
                {t('stage.builder.passOf', {
                  pass: quest.pass_score_effective,
                  total: quest.total_points,
                })}
              </span>
            </div>

            <ol className="space-y-1.5">
              {quest.questions.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg bg-abyss-950/40 px-3 py-2"
                >
                  <span className="font-mono text-xs text-slate-600">{item.order_index}.</span>
                  <span className="min-w-0 flex-1 text-sm text-slate-300">
                    {item.question_prompt ?? '—'}
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    {item.points}
                    {t('stage.builder.pointsShort')}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        🗺 {t('stage.builder.shardNote', { shard: stage.map_shard_index })}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="rounded-full border border-abyss-700 px-3 py-1 text-slate-300">
      {label}: <span className="font-mono text-slate-100">{value}</span>
    </span>
  );
}

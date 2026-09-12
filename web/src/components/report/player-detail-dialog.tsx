'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Badge, type BadgeTone } from '@/components/ui/primitives';
import { pickText } from '@/lib/i18n-text';
import { getReportPlayerDetail, type ReportPlayerDetail } from '@/lib/reports';
import { Modal } from '@/components/ui/modal';

import { lucNao, so, thoiLuong } from './format';

/** Kết thúc của lượt chơi -> màu huy hiệu. */
const TONE: Record<string, BadgeTone> = {
  won: 'success',
  lost_time: 'danger',
  abandoned: 'neutral',
  playing: 'info',
};

function KetQua({ status }: { status: string | null | undefined }) {
  const t = useTranslations('report.status');
  if (!status) return <span className="text-slate-600">—</span>;
  return (
    <Badge tone={TONE[status] ?? 'neutral'}>
      {t(status as 'won')}
    </Badge>
  );
}

/** Một con số nhỏ có nhãn, dùng cho hàng chỉ số trong hộp thoại. */
function O({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-abyss-950/40 px-3 py-2">
      <div className="text-[0.7rem] tracking-wide text-slate-500 uppercase">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-slate-100">{value}</div>
    </div>
  );
}

/**
 * CHI TIẾT MỘT NGƯỜI CHƠI.
 *
 * Tải dữ liệu khi mở chứ không tải sẵn cả trang: bảng xếp hạng có năm mươi
 * hàng, và kéo sẵn năm mươi bản chi tiết để người ta bấm vào đúng một cái là
 * năm mươi lần truy vấn cho bốn mươi chín câu trả lời không ai đọc.
 */
export function PlayerDetailDialog({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const t = useTranslations('report');
  const locale = useLocale();

  const [data, setData] = useState<ReportPlayerDetail | null>(null);
  const [loi, setLoi] = useState(false);

  useEffect(() => {
    let huy = false;
    setData(null);
    setLoi(false);
    getReportPlayerDetail(userId)
      .then((d) => {
        if (!huy) setData(d);
      })
      .catch(() => {
        if (!huy) setLoi(true);
      });
    return () => {
      huy = true;
    };
  }, [userId]);

  return (
    <Modal label={data?.display_name ?? t('view')} onClose={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-abyss-700 bg-abyss-900 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-abyss-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              {data?.display_name ?? t('loading')}
            </h2>
            <p className="text-sm text-slate-400">{data?.email ?? ''}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-abyss-800 hover:text-slate-200"
            aria-label={t('close')}
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loi && <p className="text-sm text-coral-500">⚠</p>}
          {!data && !loi && <p className="text-sm text-slate-500">{t('loading')}</p>}

          {data && (
            <>
              {/* Bốn con số của cả hành trình, trước khi đi vào từng world. */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <O label={t('detailRuns')} value={so(data.runs, locale)} />
                <O label={t('detailWins')} value={so(data.runs_won, locale)} />
                <O label={t('detailPlayTime')} value={thoiLuong(data.play_seconds)} />
                <O label={t('detailSkillPts')} value={so(data.skill_pts, locale)} />
              </div>

              {data.worlds.length === 0 && (
                <p className="mt-6 text-sm text-slate-500">{t('noWorlds')}</p>
              )}

              {data.worlds.map((w) => (
                <section key={w.world_id} className="mt-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold text-slate-100">
                      {pickText(w.name_i18n, locale)}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span>
                        {t('detailSkillPts')}:{' '}
                        <span className="font-mono text-orichalcum-400">
                          {so(w.skill_pts, locale)}
                        </span>
                      </span>
                      <span>
                        {t('stagesCompleted')}:{' '}
                        <span className="font-mono text-slate-200">{w.stages_completed}</span>
                      </span>
                      <span>
                        {t('worldShards')}:{' '}
                        <span className="font-mono text-slate-200">
                          {w.shards_owned}/{w.shard_total}
                        </span>
                      </span>
                      <span>
                        {t('firstPlayed')}: {lucNao(w.first_played_at, locale)}
                      </span>
                      {w.completed_at && (
                        <span className="text-emerald-400">
                          {t('completedAt')}: {lucNao(w.completed_at, locale)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 overflow-x-auto rounded-xl border border-abyss-800">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-abyss-950/40 text-xs tracking-wide text-slate-500 uppercase">
                        <tr>
                          <th className="px-3 py-2 font-medium">{t('stageCol')}</th>
                          <th className="px-3 py-2 text-right font-medium">{t('bestScore')}</th>
                          <th className="px-3 py-2 text-right font-medium">{t('questsCol')}</th>
                          <th className="px-3 py-2 text-right font-medium">{t('timesPlayed')}</th>
                          <th className="px-3 py-2 text-right font-medium">{t('bestTime')}</th>
                          <th className="px-3 py-2 font-medium whitespace-nowrap">
                            {t('lastRun')}
                          </th>
                          <th className="px-3 py-2 font-medium">{t('result')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {w.stages.map((s) => (
                          <tr key={s.stage_id} className="border-t border-abyss-800/60">
                            <td className="px-3 py-2">
                              <div className="text-slate-100">{pickText(s.name_i18n, locale)}</div>
                              <div className="text-xs text-slate-500">
                                {pickText(s.chapter_name_i18n, locale)}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-200">
                              {s.best_score}
                              {s.max_score > 0 && (
                                <span className="text-slate-500">/{s.max_score}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-300">
                              {s.best_quests_completed}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-300">
                              {s.times_played}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-300">
                              {thoiLuong(s.best_duration_seconds)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-400">
                              {lucNao(s.last_played_at, locale)}
                            </td>
                            <td className="px-3 py-2">
                              <KetQua status={s.last_status} />
                            </td>
                          </tr>
                        ))}
                        {w.stages.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-3 py-4 text-sm text-slate-500">
                              {t('notPlayed')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}

              {data.recent_runs.length > 0 && (
                <section className="mt-8">
                  <h3 className="mb-2 text-sm font-semibold tracking-wide text-slate-300 uppercase">
                    {t('recentTitle')}
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-abyss-800">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-abyss-950/40 text-xs tracking-wide text-slate-500 uppercase">
                        <tr>
                          <th className="px-3 py-2 font-medium whitespace-nowrap">{t('when')}</th>
                          <th className="px-3 py-2 font-medium">{t('stageCol')}</th>
                          <th className="px-3 py-2 font-medium">{t('result')}</th>
                          <th className="px-3 py-2 text-right font-medium">{t('scoreCol')}</th>
                          <th className="px-3 py-2 text-right font-medium">{t('questsCol')}</th>
                          <th className="px-3 py-2 text-right font-medium">{t('skillPts')}</th>
                          <th className="px-3 py-2 text-right font-medium">{t('durationCol')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recent_runs.map((r) => (
                          <tr key={r.run_id} className="border-t border-abyss-800/60">
                            <td className="px-3 py-2 whitespace-nowrap text-slate-400">
                              {lucNao(r.started_at, locale)}
                            </td>
                            <td className="px-3 py-2 text-slate-100">
                              {pickText(r.stage_name_i18n, locale)}
                              {r.got_map_shard && (
                                <span className="ml-2 text-xs text-orichalcum-400">
                                  🗺 {t('shard')}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <KetQua status={r.status} />
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-200">
                              {Math.round(r.score)}
                              {r.max_score > 0 && (
                                <span className="text-slate-500">/{r.max_score}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-300">
                              {r.quests_completed}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-orichalcum-400">
                              {r.skill_pts_earned > 0 ? `+${r.skill_pts_earned}` : '—'}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-300">
                              {thoiLuong(r.duration_seconds)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Chỉ mốc tạo tài khoản. KHÔNG tính lại "điểm trung bình" ở
                  đây: con số ấy đã có trên thẻ tổng quan với một định nghĩa
                  rõ ràng, và một phép tính thứ hai trên bốn mươi lượt gần
                  nhất sẽ ra số khác dưới cùng một cái tên. */}
              <p className="mt-6 text-xs text-slate-600">
                {t('joined')}: {lucNao(data.created_at, locale)}
              </p>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

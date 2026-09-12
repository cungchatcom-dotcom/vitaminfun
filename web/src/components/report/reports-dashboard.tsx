'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Card, PageHeader, SectionTitle } from '@/components/ui/primitives';
import { pickText } from '@/lib/i18n-text';
import {
  getReportOverview,
  getReportPlayers,
  getReportWorlds,
  type ReportOverview,
  type ReportPlayerList,
  type ReportWorldOption,
} from '@/lib/reports';

import { lucNao, ngay, phanTram, so, thoiLuong } from './format';
import { PlayerDetailDialog } from './player-detail-dialog';

/** Mỗi trang 50 người — khớp trần `PAGE_SIZE` của API. */
const PAGE_SIZE = 50;

/**
 * MỘT Ô SỐ LỚN.
 *
 * Một con số to, một dòng chú giải nhỏ bên dưới. Không có mũi tên tăng/giảm:
 * so với hôm qua là một phép so sánh mà dữ liệu ở đây chưa đủ để nói cho tử tế
 * (một ngày nghỉ lễ sẽ hiện ra như một cú sụt 100%), và một mũi tên đỏ sai là
 * tệ hơn không có mũi tên nào.
 */
function The({
  label,
  value,
  hint,
  accent = 'text-slate-100',
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  accent?: string;
}) {
  return (
    <Card className="min-w-0">
      <div className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</div>
      <div className={`mt-1 font-mono text-3xl leading-none font-semibold ${accent}`}>{value}</div>
      {hint && <div className="mt-2 text-xs leading-relaxed text-slate-500">{hint}</div>}
    </Card>
  );
}

/**
 * BIỂU ĐỒ CỘT 14 NGÀY, vẽ bằng CSS.
 *
 * Không kéo thêm thư viện biểu đồ cho đúng một hình: mười bốn cái `div` có
 * chiều cao theo phần trăm làm được đúng việc này, đọc được, và không thêm
 * 200KB vào gói tải về của một trang mà giáo viên mở mỗi tuần một lần.
 *
 * Hai chuỗi số nằm chồng chứ không cạnh nhau: LƯỢT CHƠI là cột nền mờ, NGƯỜI
 * CHƠI là cột đậm bên trong. Người chơi luôn ≤ lượt chơi, nên cột đậm luôn nằm
 * gọn trong cột mờ, và tỉ lệ giữa hai màu chính là "mỗi người chơi mấy lượt" —
 * câu hỏi thứ hai người ta hỏi sau khi nhìn con số đầu tiên.
 */
function BieuDo({ data }: { data: ReportOverview['daily'] }) {
  const t = useTranslations('report');
  const locale = useLocale();
  const dinh = Math.max(1, ...data.map((d) => d.runs));

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-lagoon-500" /> {t('chartPlayers')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-lagoon-500/25" /> {t('chartRuns')}
        </span>
      </div>

      <div className="flex h-40 gap-1.5">
        {data.map((d) => {
          const caoRuns = (d.runs / dinh) * 100;
          // Cột người chơi tính theo PHẦN TRĂM CỦA CỘT LƯỢT CHƠI, vì nó nằm
          // BÊN TRONG cột ấy. Lấy theo đỉnh chung thì nó tràn ra ngoài.
          const caoPlayers = d.runs > 0 ? (d.players / d.runs) * 100 : 0;
          return (
            <div
              key={d.day}
              className="group flex min-w-0 flex-1 flex-col gap-1"
              title={`${ngay(d.day, locale)} · ${t('chartPlayers')}: ${d.players} · ${t('chartRuns')}: ${d.runs}`}
            >
              {/* Vùng vẽ cột phải có CHIỀU CAO XÁC ĐỊNH thì `height: %` bên
                  trong mới có gì để so. `flex-1` trong một cột đã cao 10rem
                  cho đúng điều đó; đặt cột trực tiếp vào một hộp cao tự động
                  thì mọi phần trăm rơi về `auto` và cả biểu đồ biến mất. */}
              <div className="relative flex-1">
                <div
                  className="absolute inset-x-0 bottom-0 rounded-t bg-lagoon-500/25 transition group-hover:bg-lagoon-500/40"
                  style={{ height: `${d.runs > 0 ? Math.max(caoRuns, 2) : 1}%` }}
                >
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t bg-lagoon-500"
                    style={{ height: `${caoPlayers}%` }}
                  />
                </div>
                <span className="absolute inset-x-0 -top-0.5 text-center font-mono text-[0.65rem] text-slate-400 opacity-0 transition group-hover:opacity-100">
                  {d.runs}
                </span>
              </div>
              <span className="truncate text-center text-[0.65rem] text-slate-600">
                {ngay(d.day, locale)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ReportsDashboard() {
  const t = useTranslations('report');
  const locale = useLocale();

  const [worlds, setWorlds] = useState<ReportWorldOption[]>([]);
  const [worldId, setWorldId] = useState<string>('');
  const [tim, setTim] = useState('');
  const [page, setPage] = useState(1);

  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [list, setList] = useState<ReportPlayerList | null>(null);
  const [dangTai, setDangTai] = useState(true);
  const [xem, setXem] = useState<string | null>(null);

  useEffect(() => {
    getReportWorlds()
      .then(setWorlds)
      .catch(() => setWorlds([]));
  }, []);

  // Gõ tới đâu gọi tới đó thì mỗi phím là một request. Chờ 300ms im lặng rồi
  // mới hỏi — đủ ngắn để không ai thấy chậm, đủ dài để một cái tên tám chữ chỉ
  // tốn một lần gọi thay vì tám.
  const [timCho, setTimCho] = useState('');
  useEffect(() => {
    const h = setTimeout(() => setTimCho(tim), 300);
    return () => clearTimeout(h);
  }, [tim]);

  // Đổi bộ lọc thì quay về trang 1. Ở nguyên trang 7 sau khi lọc còn 2 trang
  // thì người ta nhìn thấy một bảng trống và tưởng là không có dữ liệu.
  useEffect(() => setPage(1), [worldId, timCho]);

  // Bỏ qua kết quả của lần gọi CŨ nếu người dùng đã đổi bộ lọc trong lúc chờ.
  // Không có chốt này thì một request chậm trả về sau sẽ ghi đè kết quả mới —
  // bảng hiện dữ liệu của bộ lọc mà người ta vừa rời khỏi.
  const lan = useRef(0);
  useEffect(() => {
    const cua = ++lan.current;
    setDangTai(true);
    Promise.all([
      getReportOverview(worldId || null),
      getReportPlayers({ worldId: worldId || null, page, size: PAGE_SIZE, q: timCho || null }),
    ])
      .then(([o, l]) => {
        if (cua !== lan.current) return;
        setOverview(o);
        setList(l);
      })
      .catch(() => {
        if (cua === lan.current) {
          setOverview(null);
          setList(null);
        }
      })
      .finally(() => {
        if (cua === lan.current) setDangTai(false);
      });
  }, [worldId, page, timCho]);

  const tong = list?.total ?? 0;
  const soTrang = Math.max(1, Math.ceil(tong / PAGE_SIZE));
  const tu = tong === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const den = Math.min(page * PAGE_SIZE, tong);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t('title')}
        description={
          <>
            {t('subtitle')}
            {overview && (
              <span className="text-slate-500"> {t('tz', { tz: overview.timezone })}</span>
            )}
          </>
        }
      />

      {/* THANH LỌC nằm trên cùng và dính lại khi cuộn: mọi con số bên dưới đều
          phụ thuộc vào nó, nên nó phải luôn ở trong tầm mắt — cuộn xuống giữa
          bảng xếp hạng rồi quên mất đang lọc world nào là cách đọc nhầm cả
          trang. */}
      <div className="sticky top-0 z-10 -mx-2 mb-6 rounded-2xl border border-abyss-800 bg-abyss-900/80 px-4 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-end gap-4">
          <label className="min-w-0">
            <span className="mb-1 block text-xs text-slate-400">{t('filterWorld')}</span>
            <select
              value={worldId}
              onChange={(e) => setWorldId(e.target.value)}
              className="w-64 max-w-full rounded-lg border border-abyss-700 bg-abyss-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-lagoon-500"
            >
              <option value="">{t('allWorlds')}</option>
              {worlds.map((w) => (
                <option key={w.world_id} value={w.world_id}>
                  {pickText(w.name_i18n, locale)} ({w.players})
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-xs text-slate-400">{t('search')}</span>
            <input
              type="search"
              value={tim}
              onChange={(e) => setTim(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full min-w-48 rounded-lg border border-abyss-700 bg-abyss-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-lagoon-500"
            />
          </label>

          {dangTai && <span className="pb-2 text-xs text-slate-500">{t('loading')}</span>}
        </div>
      </div>

      {/* BỐN Ô SỐ. Hàng đầu trả lời bốn câu hỏi khác nhau: bao nhiêu người, bao
          nhiêu lượt, chơi có qua được không, và làm đúng được bao nhiêu. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <The
          label={t('kpiPlayers')}
          value={so(overview?.players.today, locale)}
          accent="text-lagoon-400"
          hint={
            overview && (
              <>
                {t('last7d')}: <b className="text-slate-400">{so(overview.players.last_7d, locale)}</b>
                {' · '}
                {t('last30d')}:{' '}
                <b className="text-slate-400">{so(overview.players.last_30d, locale)}</b>
                {' · '}
                {t('total')}: <b className="text-slate-400">{so(overview.players.total, locale)}</b>
              </>
            )
          }
        />
        <The
          label={t('kpiRuns')}
          value={so(overview?.runs.today, locale)}
          hint={
            overview && (
              <>
                {t('last7d')}: <b className="text-slate-400">{so(overview.runs.last_7d, locale)}</b>
                {' · '}
                {t('last30d')}:{' '}
                <b className="text-slate-400">{so(overview.runs.last_30d, locale)}</b>
                {' · '}
                {t('total')}: <b className="text-slate-400">{so(overview.runs.total, locale)}</b>
              </>
            )
          }
        />
        <The
          label={t('kpiWinRate')}
          value={phanTram(overview?.win_rate)}
          accent="text-emerald-400"
          hint={
            overview && (
              <>
                {t('won')}: <b className="text-emerald-400">{so(overview.runs_won, locale)}</b>
                {' · '}
                {t('lost')}: <b className="text-coral-500">{so(overview.runs_lost, locale)}</b>
                {' · '}
                {t('abandoned')}:{' '}
                <b className="text-slate-400">{so(overview.runs_abandoned, locale)}</b>
              </>
            )
          }
        />
        <The
          label={t('kpiAvgScore')}
          value={phanTram(overview?.avg_score_pct)}
          accent="text-orichalcum-400"
          hint={
            overview && (
              <>
                {t('avgDuration')}:{' '}
                <b className="text-slate-400">{thoiLuong(overview.avg_duration_seconds)}</b>
                {' · '}
                {t('questsDone')}:{' '}
                <b className="text-slate-400">{so(overview.quests_completed, locale)}</b>
                {' · '}
                {t('skillPts')}:{' '}
                <b className="text-slate-400">{so(overview.skill_pts_awarded, locale)}</b>
              </>
            )
          }
        />
      </div>

      <Card className="mt-6">
        <SectionTitle>{t('chartTitle')}</SectionTitle>
        {overview ? (
          <BieuDo data={overview.daily} />
        ) : (
          <div className="h-36 animate-pulse rounded-lg bg-abyss-800/50" />
        )}
      </Card>

      <Card className="mt-6" padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 pb-3">
          <SectionTitle>{t('tableTitle')}</SectionTitle>
          <span className="text-xs text-slate-500">{tong > 0 && t('sumNote')}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-abyss-950/40 text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t('rank')}</th>
                <th className="px-4 py-2.5 font-medium">{t('player')}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t('skillPtsCol')}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t('stagesCompleted')}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t('runsCol')}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t('winsCol')}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t('playTime')}</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">{t('lastPlayed')}</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {list?.items.map((p) => (
                <tr
                  key={p.user_id}
                  className="border-t border-abyss-800/60 transition hover:bg-abyss-800/30"
                >
                  {/* Ba hạng đầu đeo màu: một bảng năm mươi hàng toàn chữ xám
                      thì "xếp hạng" chỉ còn là thứ tự dòng. */}
                  <td
                    className={`px-4 py-2.5 font-mono ${
                      p.rank === 1
                        ? 'text-orichalcum-400'
                        : p.rank <= 3
                          ? 'text-slate-200'
                          : 'text-slate-500'
                    }`}
                  >
                    {p.rank}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-100">{p.display_name}</div>
                    <div className="text-xs text-slate-500">{p.email}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-orichalcum-400">
                    {so(p.skill_pts, locale)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                    {p.stages_completed}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300">{p.runs}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-emerald-400">
                    {p.runs_won}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                    {thoiLuong(p.play_seconds)}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-400">
                    {lucNao(p.last_played_at, locale)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setXem(p.user_id)}
                      className="rounded-lg border border-abyss-700 px-3 py-1 text-xs whitespace-nowrap text-slate-300 transition hover:border-lagoon-500 hover:text-lagoon-400"
                    >
                      {t('view')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* "Chưa có ai chơi" và "không tìm thấy ai" là hai tình huống khác
            hẳn nhau: một cái nói về dữ liệu, một cái nói về ô tìm kiếm đang
            gõ dở. Dùng chung một câu thì người gõ nhầm một chữ sẽ tưởng cả
            lớp chưa ai vào chơi. */}
        {list && list.items.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-slate-400">{timCho ? t('noMatch') : t('empty')}</p>
            <p className="mt-1 text-sm text-slate-500">
              {timCho ? t('noMatchHint') : t('emptyHint')}
            </p>
          </div>
        )}

        {/* Thanh phân trang hiện cả khi chỉ có một trang: con số "1–7 trên 7"
            là câu trả lời cho "bảng này có bao nhiêu người", mà đó là thứ người
            ta muốn biết trước cả khi nghĩ tới chuyện lật trang. */}
        {tong > 0 && (
          <div className="flex items-center justify-between border-t border-abyss-800/60 px-5 py-3 text-sm">
            <span className="text-slate-500">
              {t('pageInfo', { from: tu, to: den, total: tong })}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-abyss-700 px-3 py-1 text-slate-300 transition hover:border-lagoon-500 hover:text-lagoon-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('prev')}
              </button>
              <span className="font-mono text-slate-400">
                {page}/{soTrang}
              </span>
              <button
                type="button"
                disabled={page >= soTrang}
                onClick={() => setPage((p) => Math.min(soTrang, p + 1))}
                className="rounded-lg border border-abyss-700 px-3 py-1 text-slate-300 transition hover:border-lagoon-500 hover:text-lagoon-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('next')}
              </button>
            </div>
          </div>
        )}
      </Card>

      {xem && <PlayerDetailDialog userId={xem} onClose={() => setXem(null)} />}
    </div>
  );
}

'use client';

import { useLocale, useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-error';
import { pickText } from '@/lib/i18n-text';
import { getRun, startRun, submitAnswer, type Run } from '@/lib/play';
import { localizedPath } from '@/lib/routes';

import { QuestPanel } from './quest-panel';

import { EventBus, GAME_EVENTS } from '@/game/EventBus';
import type { StageSceneData } from '@/game/scenes/StageScene';

// Phaser đụng `window` ngay lúc import — nạp phía server là vỡ.
const PhaserCanvas = dynamic(
  () => import('./phaser-canvas').then((m) => m.PhaserCanvas),
  { ssr: false },
);

/**
 * Màn chơi (S5).
 *
 * Ba tầng, không tầng nào đụng vào DOM của tầng kia:
 *   - Phaser vẽ cảnh 2.5D vào `<canvas>` riêng
 *   - React vẽ HUD chồng lên trên
 *   - Server giữ đáp án, chấm điểm, và đếm giờ
 */
export function StagePlay({ stageId }: { stageId: string }) {
  const t = useTranslations();
  const locale = useLocale();

  const [run, setRun] = useState<Run | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [activeQuestId, setActiveQuestId] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [clock, setClock] = useState(0);

  // Bắt đầu lượt chơi đúng MỘT lần. React 18 gọi effect hai lần ở chế độ dev,
  // và không có chốt này thì mỗi lần vào màn tạo hai phòng.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    startRun(stageId)
      .then((data) => {
        setRun(data);
        setClock(data.seconds_remaining);
      })
      .catch((error: unknown) =>
        setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR'),
      );
  }, [stageId]);

  // Đồng hồ đếm ở máy chỉ để hiển thị cho mượt. Mốc thật là `started_at` ở
  // server; hết giờ thì chính server chốt lượt chơi khi có request tới.
  useEffect(() => {
    if (!run || run.status !== 'playing') return;
    const timer = setInterval(() => setClock((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [run]);

  // Hết giờ ở phía máy thì hỏi lại server để nó chốt.
  useEffect(() => {
    if (clock > 0 || !run || run.status !== 'playing') return;
    void getRun(run.id).then(setRun);
  }, [clock, run]);

  // Nhân vật ĐI VÀO phạm vi nhiệm vụ -> mở bảng câu hỏi.
  // Bấm chuột chỉ ra lệnh đi tới; cảnh Phaser mới là thứ quyết định đã tới chưa.
  useEffect(() => {
    // Cảnh chỉ phát sự kiện này khi người chơi THẬT SỰ muốn vào — dừng lại trong
    // khung, hoặc bấm lại vào khung đang đứng. Nên ở đây cứ mở, không cần cờ
    // "vừa đóng" nào nữa: đóng bảng xong phạm vi không đổi, cảnh im lặng, và
    // bảng không tự bật lại.
    const offEnter = EventBus.on(GAME_EVENTS.QUEST_ZONE_ENTERED, ((p: { questId: string }) => {
      setActiveQuestId(p.questId);
    }) as never);

    const offLeave = EventBus.on(GAME_EVENTS.QUEST_ZONE_LEFT, ((p: { questId: string }) => {
      setActiveQuestId((active) => (active === p.questId ? null : active));
    }) as never);

    return () => {
      offEnter();
      offLeave();
    };
  }, []);

  // Bảng đóng thì cờ "đang gõ" phải tắt, bất kể `QuestPanel` có kịp dọn hay không.
  //
  // Cờ này kẹt ở `true` là cả bàn phím chết câm mà không có lỗi nào hiện ra —
  // hỏng lặng lẽ kiểu đó thì đáng để chốt ở hai chỗ.
  useEffect(() => {
    if (activeQuestId === null) setTyping(false);
  }, [activeQuestId]);

  const onSubmit = useCallback(
    async (questionId: string, response: Record<string, unknown> | null) => {
      if (!run || !activeQuestId) throw new Error('no run');
      const result = await submitAnswer(run.id, activeQuestId, questionId, response);

      // Nạp lại trạng thái để bảng tiến độ và năng lượng khớp server, thay vì
      // tự suy ra ở client — client không biết đủ để suy đúng.
      const fresh = await getRun(run.id);
      setRun(fresh);
      setClock(fresh.seconds_remaining);

      if (result.quest_completed) {
        EventBus.emit(GAME_EVENTS.QUEST_COMPLETED, { questId: activeQuestId });
      }
      if (fresh.status === 'won') {
        EventBus.emit(GAME_EVENTS.STAGE_WON);
      }
      return result;
    },
    [run, activeQuestId],
  );

  const sceneData: StageSceneData | null = useMemo(() => {
    if (!run) return null;
    return {
      // Ảnh nền qua `media_assets` khi giáo viên đã tải lên; chưa có thì dùng
      // ảnh mặc định theo `scene_key`.
      // URL ảnh nền đã đóng băng trong snapshot.
      //
      // Chưa tải ảnh thì để RỖNG chứ không đoán một đường dẫn theo `scene_key`:
      // màn nào có `scene_key` khác `ship_deck_01` sẽ nhận 404, và người dùng
      // thấy "không có ảnh nền" mà không biết vì sao. Cảnh tự vẽ nền biển.
      backgroundUrl: run.snapshot.stage.background_url ?? '',
      advisorLabel: run.snapshot.stage.advisor_npc_key,
      quests: run.snapshot.quests.map((q) => ({
        id: q.id,
        order_index: q.order_index,
        phase: q.phase,
        quest_object_key: q.quest_object_key,
        label: pickText(q.name_i18n, locale) || q.quest_object_key,
        scene_x: q.scene_x ?? null,
        scene_y: q.scene_y ?? null,
        trigger_radius: q.trigger_radius ?? null,
        icon_url: q.icon_url ?? null,
        icon_size: q.icon_size ?? null,
        pulse_percent: q.pulse_percent ?? null,
        pulse_period_ms: q.pulse_period_ms ?? null,
      })),
      completedQuestIds: run.my_progress.filter((p) => p.completed).map((p) => p.quest_id),
      // Nhân vật đến từ `run`, KHÔNG từ `snapshot`: snapshot là đề bài đóng
      // băng, còn nhân vật là lựa chọn của người chơi và đổi được giữa hai lượt.
      character: run.character
        ? { id: run.character.id, sprites: run.character.sprites }
        : null,
    };
    // Chỉ dựng lại cảnh khi ĐỔI lượt chơi. Dựng lại sau mỗi lần nộp bài là nạp
    // lại toàn bộ Phaser và nhân vật nhảy về vị trí đầu.
  }, [run?.id, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  if (errorKey) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p role="alert" className="rounded-xl bg-coral-500/15 px-4 py-3 text-coral-500">
          {t(errorKey)}
        </p>
        <Link
          href={localizedPath('/play', locale)}
          className="mt-4 inline-block text-sm text-lagoon-400 hover:underline"
        >
          ← {t('play.title')}
        </Link>
      </div>
    );
  }

  if (!run || !sceneData) {
    return <p className="p-8 text-center text-slate-400">{t('common.loading')}</p>;
  }

  const activeQuest = run.snapshot.quests.find((q) => q.id === activeQuestId) ?? null;
  const activeProgress = run.my_progress.find((p) => p.quest_id === activeQuestId);
  const doneCount = run.my_progress.filter((p) => p.completed).length;
  const energyPct = Math.round(
    (100 * run.team_energy_remaining) / Math.max(1, run.team_energy_initial),
  );

  return (
    // Xếp DỌC, không xếp chồng: thanh trên và thanh dưới là thành phần thật của
    // bố cục, canvas nhận đúng phần còn lại.
    //
    // Trước đây HUD phủ `absolute inset-0` lên canvas, nên hai thanh che mất mép
    // trên và mép dưới của cảnh — camera hiện trọn thế giới thật, nhưng người
    // chơi vẫn thấy như bị cắt.
    <div className="flex h-[calc(100vh-8rem)] min-h-[32rem] w-full flex-col overflow-hidden">
      <header className="flex flex-wrap items-center gap-4 border-b border-abyss-800 bg-abyss-950/85 px-5 py-2.5 text-sm">
          <span className="font-semibold text-orichalcum-400">
            {pickText(run.snapshot.stage.name_i18n, locale)}
          </span>

          <span className="flex items-center gap-2">
            ⚡
            <span className="h-2 w-24 overflow-hidden rounded-full bg-abyss-800">
              <span
                className={`block h-full transition-all ${
                  energyPct > 50 ? 'bg-lagoon-500' : energyPct > 25 ? 'bg-orichalcum-500' : 'bg-coral-500'
                }`}
                style={{ width: `${energyPct}%` }}
              />
            </span>
            <span className="font-mono text-slate-300">
              {run.team_energy_remaining}/{run.team_energy_initial}
            </span>
          </span>

          <span className={`font-mono ${clock < 30 ? 'text-coral-500' : 'text-slate-300'}`}>
            ⏱ {String(Math.floor(clock / 60)).padStart(2, '0')}:
            {String(clock % 60).padStart(2, '0')}
          </span>

          <span className="text-slate-300">
            {t('game.questsDone', { done: doneCount, total: run.snapshot.quests.length })}
          </span>

          {/* Cố ý KHÔNG hiện điểm chiến lực trong trận — xem GAME_DOMAIN §1.6. */}

          {run.is_trial && <Badge tone="warning">🧪 {t('preview.banner')}</Badge>}

          {/* Rời trận thì về đúng bản đồ world vừa đi ra, không phải về
              bản đồ thiên hà. Người chơi đang dở một world; ném họ lên tận màn
              chọn world là bắt đi lại hai bước để làm cái việc họ gần như chắc
              chắn muốn làm tiếp — chơi màn kế bên. */}
          <Link
            href={localizedPath(`/play/world/${run.world_id}`, locale)}
            className="ml-auto text-slate-400 hover:text-slate-100"
          >
            {t('game.leave')}
          </Link>
        </header>

      {/* Khu giữa: canvas nằm dưới, bảng câu hỏi phủ lên — nhưng chỉ phủ trong
          khu này, không phủ lên hai thanh HUD. */}
      <div className="relative min-h-0 flex-1">
        {/* Bảng câu hỏi mở = khoá di chuyển. Đang trả lời mà nhân vật vẫn đi
            được thì họ tự đi ra khỏi phạm vi và bảng đóng ngang giữa chừng. */}
        <PhaserCanvas sceneData={sceneData} typing={typing} locked={activeQuestId !== null} />

        <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-4 sm:items-center">
          {activeQuest && run.status === 'playing' && (
            <QuestPanel
              quest={activeQuest}
              progress={activeProgress}
              onSubmit={onSubmit}
              onClose={() => setActiveQuestId(null)}
              onTypingChange={setTyping}
            />
          )}

          {/* Không có nút "mở lại nhiệm vụ" nào ở đây.
              Đóng bảng rồi muốn mở lại thì bấm vào chính vật thể đó — nhân vật
              đang đứng sẵn trong khung nên bảng bật lên ngay. Một cái nút to
              giữa màn hình để làm việc mà cú bấm vào vật thể đã làm được thì chỉ
              tổ che mất cảnh. */}

            {run.status !== 'playing' && (
            <StageOver
              runId={run.id}
              worldId={run.world_id}
              status={run.status}
              shard={run.snapshot.stage.map_shard_index}
            />
          )}
        </div>

        {/* Hướng dẫn hiện SUỐT màn chơi, kể cả khi đã hết giờ hay thua.
            Trước đây gắn điều kiện `status === 'playing'`, nên đúng lúc người
            chơi lúng túng nhất — vừa thua, đang muốn đọc lại luật — thì nó biến
            mất. Một trang trợ giúp mà tự ẩn đi khi có sự cố thì để làm gì. */}
        <HelpBubble />
      </div>

      {/* Bảng tiến độ đội — chỉ "ai xong nhiệm vụ nào", không có bài làm. */}
      <footer className="flex flex-wrap gap-3 border-t border-abyss-800 bg-abyss-950/85 px-5 py-2 text-xs">
          {run.team.map((mate) => (
            <span key={mate.hero_key} className="flex items-center gap-1.5">
              <span className={mate.is_me ? 'font-semibold text-lagoon-400' : 'text-slate-400'}>
                {mate.display_name}
              </span>
              {run.snapshot.quests.map((q) => (
                <span
                  key={q.id}
                  title={pickText(q.name_i18n, locale) || q.quest_object_key}
                  className={
                    mate.quest_ids_completed.includes(q.id) ? 'text-emerald-400' : 'text-slate-700'
                  }
                >
                  ●
                </span>
              ))}
            </span>
          ))}
      </footer>
    </div>
  );
}

/** Màn kết thúc (S6) — lối sang bảng điểm và màn xem lại. */
function StageOver({
  runId,
  worldId,
  status,
  shard,
}: {
  runId: string;
  worldId: string;
  status: string;
  shard: number;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const won = status === 'won';

  return (
    <section className="pointer-events-auto w-full max-w-md rounded-2xl border border-abyss-700 bg-abyss-900/95 p-6 text-center shadow-2xl backdrop-blur">
      <p className="text-4xl" aria-hidden>
        {won ? '🗺' : '💧'}
      </p>
      <h2 className="mt-3 text-lg font-bold text-slate-100">
        {won ? t('game.victory') : t(`game.defeat.${status}`)}
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        {won ? t('game.shardEarned', { shard }) : t('game.keptPoints')}
      </p>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link href={localizedPath(`/play/run/${runId}/review`, locale)}>
          <Button variant="primary">{t('game.review')}</Button>
        </Link>
        {/* Nút này vẫn luôn mang chữ "về world" — chỉ có đích là sai, nó
            trỏ về bản đồ thiên hà. Giờ nó đi đúng chỗ tên nó nói. */}
        <Link href={localizedPath(`/play/world/${worldId}`, locale)}>
          <Button variant="secondary">{t('game.backToWorld')}</Button>
        </Link>
      </div>
    </section>
  );
}

/**
 * Hướng dẫn chơi, thu vào một biểu tượng ở góc màn.
 *
 * Trước đây một dòng chữ "dùng W A D X" nằm giữa cảnh. Nó chỉ hữu ích ở giây
 * đầu tiên, rồi che mất chính cái cảnh mà nó đang hướng dẫn cách đi.
 *
 * CHỈ đóng mở bằng cú bấm — không nghe rê chuột. Rê chuột làm bảng tự bật lên
 * mỗi lần con trỏ đi ngang góc màn, ngay giữa lúc đang chơi; và trên màn hình
 * cảm ứng thì không có trạng thái "đang rê" nên nó chẳng giúp được gì. Một cú
 * bấm để mở, một cú nữa để tắt, giống nhau ở mọi thiết bị.
 *
 * Và đang mở mà người chơi làm việc khác — bấm ra ngoài, đi bằng phím — thì tự
 * tắt. Hướng dẫn là thứ người ta liếc một cái rồi quay lại chơi, không phải một
 * ô cửa sổ phải nhớ đi đóng.
 */
function HelpBubble() {
  const t = useTranslations('game.help');
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);

  const LINES = ['click', 'keys', 'walkToQuest', 'enterZone', 'boundary', 'energy'] as const;

  // Đang mở mà người chơi làm bất cứ việc gì khác thì tự tắt.
  //
  // Nghe ở giai đoạn BẮT (capture) và dùng `pointerdown` chứ không phải `click`:
  // bảng phải biến mất TRƯỚC khi Phaser xử lý cú bấm, không thì có một khoảnh
  // khắc nhân vật đã chạy còn hướng dẫn vẫn nằm đè lên cảnh.
  //
  // Bấm vào chính nút `?` thì bỏ qua — `onClick` của nó lo việc đóng, để cả hai
  // cùng chạy là đóng rồi mở lại ngay trong một cú bấm.
  //
  // `useEffect` chạy sau khi cú bấm mở bảng đã dispatch xong, nên không có
  // chuyện vừa mở đã tự đóng.
  useEffect(() => {
    if (!open) return;

    const closeIfOutside = (event: Event) => {
      if (holder.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    // Gõ phím nào cũng đóng: W A D X là đang đi, Esc là muốn thoát ra.
    const closeOnKey = () => setOpen(false);

    document.addEventListener('pointerdown', closeIfOutside, true);
    window.addEventListener('keydown', closeOnKey);
    return () => {
      document.removeEventListener('pointerdown', closeIfOutside, true);
      window.removeEventListener('keydown', closeOnKey);
    };
  }, [open]);

  return (
    <div ref={holder} className="absolute right-4 bottom-4 flex flex-col items-end gap-2">
      {open && (
        <div
          role="tooltip"
          className="max-w-xs rounded-xl border border-abyss-700 bg-abyss-950/95 p-4 text-xs shadow-2xl backdrop-blur"
        >
          <p className="mb-2 font-semibold text-slate-100">{t('title')}</p>
          <ul className="space-y-1.5 text-slate-400">
            {LINES.map((key) => (
              <li key={key} className="flex gap-2">
                <span aria-hidden className="text-lagoon-400">
                  ·
                </span>
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        aria-label={t('title')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold shadow-lg backdrop-blur transition ${
          open
            ? 'border-lagoon-500 bg-abyss-900 text-lagoon-400'
            : 'border-abyss-700 bg-abyss-950/80 text-slate-400 hover:text-slate-100'
        }`}
      >
        ?
      </button>
    </div>
  );
}

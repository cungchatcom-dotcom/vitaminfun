'use client';

import { useLocale, useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-error';
import { pickText } from '@/lib/i18n-text';
import {
  getRun,
  saveDraft,
  savePosition,
  startRun,
  submitQuest,
  type Run,
  type Snapshot,
  type SnapshotQuest,
} from '@/lib/play';
import { questLabel } from '@/lib/quest-label';
import { localizedPath } from '@/lib/routes';

import { MusicControls } from './music-controls';
import { QuestPanel } from './quest-panel';
import { StageIntro } from './stage-intro';

import { EventBus, GAME_EVENTS } from '@/game/EventBus';
import type { StageSceneData } from '@/game/scenes/StageScene';

/**
 * Bao lâu ghi chỗ đứng của nhân vật xuống server một lần, mili giây.
 *
 * Hai giây: đủ thưa để một lần đi bộ ngang bản đồ chỉ tốn vài request, đủ dày
 * để tai nạn chỉ làm nhân vật lùi lại vài bước chứ không về vạch xuất phát.
 */
const POSITION_SAVE_MS = 2000;

/**
 * Nhiệm vụ này có gì để NGHE không.
 *
 * Quyết định xem lúc mở bảng có hạ tiếng của màn xuống hay không. Hạ với mọi
 * bảng thì mở một câu trắc nghiệm chữ cũng làm nhạc nền tụt xuống mà không ai
 * hiểu vì sao — và bản nhạc thì cứ lên xuống suốt màn.
 *
 * Hai nguồn tiếng, và phải hỏi cả hai:
 *
 *   - câu hỏi NGHE trong nhiệm vụ (`audio_url` của từng câu),
 *   - lời chia tay của NPC, chỉ có ở nhiệm vụ `advisor` và nằm ở MÀN chứ không
 *     ở nhiệm vụ — quên vế này thì đúng cái bảng có giọng NPC đang nói lại là
 *     bảng duy nhất không được ưu tiên.
 *
 * Hỏi ĐỀ BÀI ĐÃ ĐÓNG BĂNG, như mọi thứ khác của lượt chơi: giáo viên gỡ đoạn
 * ghi âm giữa chừng thì lượt đang chơi vẫn cư xử đúng như lúc nó bắt đầu.
 */
function questHasSound(quest: SnapshotQuest, snapshot: Snapshot): boolean {
  if (quest.questions.some((q) => q.audio_url)) return true;
  return quest.phase === 'advisor' && Boolean(snapshot.stage.advisor_outro_audio_url);
}

// Phaser đụng `window` ngay lúc import — nạp phía server là vỡ.
const PhaserCanvas = dynamic(
  () => import('./phaser-canvas').then((m) => m.PhaserCanvas),
  { ssr: false },
);

/**
 * Màn chơi (S5) — vỏ ngoài, chỉ lo TẤM MÀN mở đầu.
 *
 * ## Vì sao tách làm hai component
 *
 * Không phải để cho gọn. `StageRunView` bên dưới có hai lần `return` sớm — lúc
 * đang chờ server, và lúc lỗi — nên cây React nó vẽ ra đổi hình ngay giữa lúc
 * đoạn video đang chạy. Thẻ `<video>` nằm trong cái cây đó sẽ bị gỡ và dựng
 * lại, tức là **chạy lại từ giây 0**, đúng vào lúc `run` về tới nơi.
 *
 * Trên máy chạy nhanh thì chớp một cái không ai thấy. Trên đường truyền chậm —
 * tức là đúng cái hoàn cảnh tính năng này sinh ra để phục vụ — `run` có thể về
 * ở giây thứ hai, và học sinh thấy đoạn mở màn giật về đầu.
 *
 * Nên tấm màn nằm ở ĐÂY, một tầng ngoài, làm anh em cùng cấp với cả cái màn
 * chơi. Từ lúc dựng tới lúc kéo ra nó không đi đâu cả, dù bên trong có vẽ lại
 * bao nhiêu lần.
 *
 * ## Hai cái cờ, hai nguồn
 *
 *   - `introDone` — tấm màn đã kéo ra chưa. Không có video thì `true` ngay từ
 *     lần vẽ đầu: màn chơi chạy y hệt trước khi có tính năng này.
 *   - `sceneReady` — cảnh Phaser đã nạp xong mọi tài sản (`STAGE_READY`).
 *
 * Cửa vào màn mở khi cả hai xong; luật ghép nằm trong `StageIntro`.
 */
export function StagePlay({
  stageId,
  introVideoUrl,
}: {
  stageId: string;
  /**
   * Video mở màn, đọc phía SERVER lúc render trang. `null` = vào thẳng.
   *
   * Là `prop` chứ không phải một cú gọi API ở đây, và đó là cả điểm mấu chốt:
   * thẻ `<video>` phải nằm sẵn trong HTML của lần vẽ đầu tiên. Hỏi server ở
   * client nghĩa là màn hình trống thêm một vòng mạng nữa — đúng cái thứ tấm
   * màn này sinh ra để xoá đi.
   */
  introVideoUrl: string | null;
}) {
  const [introDone, setIntroDone] = useState(introVideoUrl === null);
  const [sceneReady, setSceneReady] = useState(false);

  // Kéo gói Phaser về NGAY, không đợi `run`.
  //
  // Đây là nửa quan trọng hơn của video mở màn. `dynamic()` ở trên chỉ bắt đầu
  // tải khi `<PhaserCanvas>` thật sự được vẽ ra, tức là sau khi server trả lời —
  // nên nếu không có dòng này thì suốt đoạn video đầu tiên, cái chunk lớn nhất
  // vẫn chưa hề được yêu cầu, và "nạp ngầm trong lúc xem" chỉ là một câu nói.
  // `phaser-canvas` import `StageScene`, và `StageScene` import `phaser`, nên
  // một dòng này kéo cả chuỗi.
  //
  // Chạy cả khi màn KHÔNG có video: nó chỉ dời việc tải lên sớm hơn vài trăm
  // mili giây, và không dời thì cũng chẳng để dành được gì.
  useEffect(() => {
    void import('./phaser-canvas');
  }, []);

  useEffect(() => {
    const off = EventBus.on(GAME_EVENTS.STAGE_READY, (() => setSceneReady(true)) as never);
    return off;
  }, []);

  return (
    // Chiều cao của cả màn chơi đặt ở ĐÂY, không ở trong: tấm màn phủ
    // `absolute inset-0` lên chính khung này, nên nó phải là khung có kích
    // thước thật — bên trong chỉ việc lấp đầy.
    <div className="relative h-[calc(100vh-8rem)] min-h-[32rem] w-full">
      <StageRunView stageId={stageId} introDone={introDone} />

      {introVideoUrl !== null && !introDone && (
        <StageIntro
          src={introVideoUrl}
          ready={sceneReady}
          onDone={() => setIntroDone(true)}
        />
      )}
    </div>
  );
}

/**
 * Màn chơi (S5) — phần thật.
 *
 * Ba tầng, không tầng nào đụng vào DOM của tầng kia:
 *   - Phaser vẽ cảnh 2.5D vào `<canvas>` riêng
 *   - React vẽ HUD chồng lên trên
 *   - Server giữ đáp án, chấm điểm, và đếm giờ
 */
function StageRunView({ stageId, introDone }: { stageId: string; introDone: boolean }) {
  const t = useTranslations();
  const locale = useLocale();

  const [run, setRun] = useState<Run | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [activeQuestId, setActiveQuestId] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [clock, setClock] = useState(0);

  /**
   * MỐC hết giờ theo đồng hồ của chính máy này (`Date.now()`), không phải một
   * con số đếm lùi.
   *
   * Đây là chỗ sửa cái lỗi "chuyển sang tab khác thì đồng hồ đứng lại". Bản cũ
   * mỗi giây trừ đi 1 (`s - 1`), mà trình duyệt thì BÓP `setInterval` của tab
   * chạy nền: Chrome hạ xuống 1 lần/phút, và sau 5 phút ẩn thì còn ngặt hơn.
   * Trừ dần theo số lần hàm chạy nghĩa là đi vắng ba phút chỉ trừ ba giây.
   *
   * Hậu quả không chỉ là con số xấu: người chơi quay lại, thấy còn 03:12, chơi
   * tiếp — rồi server (vốn đếm từ `started_at`, không hề ngừng) báo thua vì hết
   * giờ. Cái đồng hồ đã nói dối họ.
   *
   * Đọc hiệu số tới một cái mốc thì hàm chạy thưa bao nhiêu cũng không sai: nó
   * chỉ làm con số cập nhật chậm hơn, chứ không làm con số lệch đi.
   */
  const deadline = useRef<number | null>(null);

  /** Nhận trạng thái mới từ server: đặt lại cả lượt chơi lẫn mốc hết giờ. */
  const applyRun = useCallback((data: Run) => {
    deadline.current = Date.now() + data.seconds_remaining * 1000;
    setClock(data.seconds_remaining);
    setRun(data);
  }, []);

  // Bắt đầu lượt chơi đúng MỘT lần. React 18 gọi effect hai lần ở chế độ dev,
  // và không có chốt này thì mỗi lần vào màn tạo hai phòng.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    startRun(stageId)
      .then(applyRun)
      .catch((error: unknown) =>
        setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR'),
      );
  }, [stageId, applyRun]);

  // Đồng hồ trên máy chỉ để HIỂN THỊ. Mốc thật là `started_at` ở server; hết
  // giờ thì chính server chốt lượt chơi khi có request tới.
  useEffect(() => {
    if (!run || run.status !== 'playing') return;

    // `ceil` chứ không `round`: chỉ chạm 0 khi mốc đã thật sự trôi qua. Làm
    // tròn thì ở 0,4 giây cuối màn hình đã báo hết giờ trong khi server vẫn
    // tính là còn — client hỏi, server bảo "vẫn đang chơi", và effect bên dưới
    // hỏi lại vòng nữa.
    const tick = () => {
      if (deadline.current === null) return;
      setClock(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    };

    const timer = setInterval(tick, 1000);

    // Quay lại tab thì đọc lại NGAY, không đợi nhịp sau.
    //
    // Trình duyệt có thể vừa bóp `setInterval` xuống 1 lần/phút, nên nếu chỉ
    // dựa vào nó thì người chơi nhìn một con số đã cũ suốt gần một phút — đúng
    // cái khoảnh khắc họ cần biết mình còn bao nhiêu thời gian nhất.
    document.addEventListener('visibilitychange', tick);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [run]);

  // Hết giờ ở phía máy thì hỏi lại server để nó chốt.
  useEffect(() => {
    if (clock > 0 || !run || run.status !== 'playing') return;
    void getRun(run.id).then(applyRun);
  }, [clock, run]);


  // Ghi chỗ nhân vật đang đứng, để thoát ra vào lại còn ở đúng đó.
  //
  // `PLAYER_MOVED` bắn sau MỖI bước — kể cả giữa đường, kể cả từng khung hình
  // khi giữ phím. Gửi thẳng lên là hàng trăm request cho một lần đi bộ, nên chỉ
  // giữ vị trí mới nhất rồi ghi mỗi POSITION_SAVE_MS một lần.
  //
  // Mất tối đa một nhịp cuối nếu tab đóng ngay giữa chừng — nhân vật lùi lại vài
  // bước, không phải về vạch xuất phát. Đổi lấy việc không nã request suốt lúc
  // chơi thì đáng.
  useEffect(() => {
    if (!run || run.status !== 'playing') return;

    let latest: { x: number; y: number } | null = null;
    let sent = `${run.my_pos_x},${run.my_pos_y}`;

    const off = EventBus.on(GAME_EVENTS.PLAYER_MOVED, ((p: { x: number; y: number }) => {
      latest = { x: Math.round(p.x), y: Math.round(p.y) };
    }) as never);

    const timer = setInterval(() => {
      if (!latest) return;
      const key = `${latest.x},${latest.y}`;
      if (key === sent) return;
      sent = key;
      // Không `await`: đứng yên chờ mạng thì cả vòng lặp này thành một hàng đợi,
      // mà thứ nó chở chỉ là một toạ độ sẽ bị cái sau ghi đè.
      void savePosition(run.id, latest.x, latest.y).catch(() => {
        // Hỏng thì thôi, nhịp sau gửi lại. Không có gì để báo cho người chơi:
        // họ đang đi bộ, không đang lưu bài.
        sent = '';
      });
    }, POSITION_SAVE_MS);

    return () => {
      off();
      clearInterval(timer);
    };
  }, [run?.id, run?.status]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /** Ghi bản nháp của một câu. Không chấm, nên cũng không nạp lại gì. */
  const onSaveDraft = useCallback(
    async (questionId: string, response: Record<string, unknown> | null) => {
      if (!run || !activeQuestId) return;
      await saveDraft(run.id, activeQuestId, questionId, response);
    },
    [run, activeQuestId],
  );

  const onSubmitQuest = useCallback(
    async () => {
      if (!run || !activeQuestId) throw new Error('no run');
      const result = await submitQuest(run.id, activeQuestId);

      // Nạp lại trạng thái để bảng tiến độ và năng lượng khớp server, thay vì
      // tự suy ra ở client — client không biết đủ để suy đúng.
      const fresh = await getRun(run.id);
      applyRun(fresh);

      if (result.quest_completed) {
        EventBus.emit(GAME_EVENTS.QUEST_COMPLETED, { questId: activeQuestId });
      }

      // Vừa qua NPC thì cả màn mở ra.
      //
      // So sánh TRƯỚC và SAU thay vì hỏi "nhiệm vụ này có phải NPC không":
      // server là nơi giữ luật mở khoá, nên cứ nhìn vào cái nó vừa trả về. Hôm
      // nào luật đổi — thêm điều kiện, đổi cổng — chỗ này không phải sửa.
      const wasLocked = run.my_progress.some((p) => p.locked);
      if (wasLocked && !fresh.my_progress.some((p) => p.locked)) {
        EventBus.emit(GAME_EVENTS.QUESTS_UNLOCKED);
      }
      if (fresh.status === 'won') {
        EventBus.emit(GAME_EVENTS.STAGE_WON);
      }

      // Trả kèm tình trạng TỪNG CÂU vừa chấm. Bảng nhiệm vụ cần biết "câu vừa
      // rồi đúng chưa" để đi tiếp hay nói lại, mà `prop` của nó chỉ mới sang ở
      // lượt vẽ sau — trong lúc `await` thì nó vẫn đang cầm bản cũ.
      return {
        result,
        questions: fresh.my_progress.find((p) => p.quest_id === activeQuestId)?.questions ?? [],
      };
    },
    [run, activeQuestId, applyRun],
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
      // Loại nền cũng lấy từ ĐỀ BÀI ĐÃ ĐÓNG BĂNG, không hỏi lại server:
      // giáo viên đổi nền giữa chừng thì lượt đang chơi vẫn nạp đúng thứ
      // nó bắt đầu, bằng đúng đường nạp của thứ đó.
      backgroundKind: run.snapshot.stage.background_kind ?? null,
      advisorLabel: run.snapshot.stage.advisor_npc_key,
      characterHeight: run.snapshot.stage.character_height,
      // Vùng đi được lấy từ SNAPSHOT, không hỏi lại server: giáo viên vẽ lại
      // giữa chừng thì lượt đang chơi vẫn đi trên đúng cái sàn nó bắt đầu.
      collision: run.snapshot.stage.collision,
      audio: run.snapshot.stage.audio,
      audioUrls: run.snapshot.stage.audio_urls,
      // Chỗ đứng lấy từ `run`, KHÔNG từ `snapshot`: snapshot là đề bài đóng
      // băng, còn đây là chỗ người chơi đang đứng và nó đổi suốt lúc chơi.
      startPos:
        run.my_pos_x != null && run.my_pos_y != null
          ? { x: run.my_pos_x, y: run.my_pos_y }
          : null,
      // Chỗ XUẤT PHÁT thì ngược lại: lấy từ SNAPSHOT, vì nó là thứ người dựng
      // đặt — một phần của đề bài, như vùng đi được và cỡ nhân vật. Chỉ dùng
      // khi `startPos` trống, tức là lần đầu người này vào lượt.
      spawnPos: {
        x: run.snapshot.stage.spawn_x ?? null,
        y: run.snapshot.stage.spawn_y ?? null,
      },
      quests: run.snapshot.quests.map((q) => ({
        id: q.id,
        order_index: q.order_index,
        phase: q.phase,
        quest_object_key: q.quest_object_key,
        label: questLabel(q, locale, t),
        scene_x: q.scene_x ?? null,
        scene_y: q.scene_y ?? null,
        trigger_radius: q.trigger_radius ?? null,
        icon_url: q.icon_url ?? null,
        icon_size: q.icon_size ?? null,
        pulse_percent: q.pulse_percent ?? null,
        pulse_period_ms: q.pulse_period_ms ?? null,
      })),
      completedQuestIds: run.my_progress.filter((p) => p.completed).map((p) => p.quest_id),
      lockedQuestIds: run.my_progress.filter((p) => p.locked).map((p) => p.quest_id),
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
    // Căn giữa khung: khung này giờ cao bằng cả màn chơi (xem `StagePlay`), nên
    // một dòng chữ dính mép trên trông như trang vẽ hỏng.
    return (
      <div className="flex size-full items-center justify-center">
        <p className="p-8 text-center text-slate-400">{t('common.loading')}</p>
      </div>
    );
  }

  // Tên NPC lấy từ chính nhiệm vụ NPC, không lấy `stage.advisor_npc_key`: cột
  // đó là khoá kỹ thuật ("captain"), có thể rỗng, và giáo viên đặt tên hiển thị
  // ở nhiệm vụ chứ không ở đó.
  const advisorQuest = run.snapshot.quests.find((q) => q.phase === 'advisor');
  const advisorLabel = advisorQuest ? questLabel(advisorQuest, locale, t) : t('stage.quest.npcDefault');

  const activeQuest = run.snapshot.quests.find((q) => q.id === activeQuestId) ?? null;
  const activeProgress = run.my_progress.find((p) => p.quest_id === activeQuestId);
  const doneCount = run.my_progress.filter((p) => p.completed).length;

  // Sổ tay chỉ mở được SAU khi chính người này qua nhiệm vụ NPC — đó là lúc NPC
  // trao nó. Hỏi thẳng tiến độ của nhiệm vụ NPC chứ không suy từ năng lượng: màn
  // đặt `energy_per_player = 0` vẫn có sổ tay để trao.
  const cluebook = pickText(run.snapshot.stage.cluebook_i18n, locale);
  const cluebookTitle = pickText(run.snapshot.stage.cluebook_title_i18n, locale);
  const advisorOutro = pickText(run.snapshot.stage.advisor_outro_i18n, locale);
  const advisorDone =
    run.my_progress.find((p) => p.quest_id === advisorQuest?.id)?.completed ?? false;

  return (
    // Xếp DỌC, không xếp chồng: thanh trên và thanh dưới là thành phần thật của
    // bố cục, canvas nhận đúng phần còn lại.
    //
    // Trước đây HUD phủ `absolute inset-0` lên canvas, nên hai thanh che mất mép
    // trên và mép dưới của cảnh — camera hiện trọn thế giới thật, nhưng người
    // chơi vẫn thấy như bị cắt.
    <div className="flex size-full flex-col overflow-hidden">
      <header className="flex flex-wrap items-center gap-4 border-b border-abyss-800 bg-abyss-950/85 px-5 py-2.5 text-sm">
          <span className="font-semibold text-orichalcum-400">
            {pickText(run.snapshot.stage.name_i18n, locale)}
          </span>

          {/* Năng lượng KHÔNG còn ở đây — nó nằm trong cụm biểu tượng góc dưới,
              cạnh sổ tay. Hai chỗ cùng hiện một con số thì có ngày chúng lệch
              nhau, mà kể cả không lệch thì cũng chỉ là hai chỗ để mắt phải đi
              tìm cùng một thứ. */}

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
        {/* Tấm màn còn che thì KHOÁ cả chuột lẫn bàn phím: cảnh Phaser nghe
            phím ở tầng document, nên bấm mũi tên trong lúc xem video là nhân vật
            đi lang thang phía sau và học sinh vào màn ở một chỗ họ không chọn. */}
        <PhaserCanvas
          sceneData={sceneData}
          typing={typing}
          locked={activeQuestId !== null || !introDone}
          // Chỉ hạ tiếng khi bảng đang mở CÓ gì để nghe — xem `questHasSound`.
          ducked={activeQuest !== null && questHasSound(activeQuest, run.snapshot)}
        />

        <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-4 sm:items-center">
          {activeQuest && run.status === 'playing' && (
            <QuestPanel
              quest={activeQuest}
              progress={activeProgress}
              advisorLabel={advisorLabel}
              cluebook={cluebook}
              advisorOutro={advisorOutro}
              // Tiếng và cờ transcript đều lấy từ ĐỀ BÀI ĐÃ ĐÓNG BĂNG, như mọi
              // thứ khác của màn: giáo viên thay đoạn ghi âm giữa chừng thì
              // lượt đang chơi vẫn nghe đúng cái nó bắt đầu.
              advisorOutroAudio={run.snapshot.stage.advisor_outro_audio_url ?? null}
              advisorOutroShowTranscript={run.snapshot.stage.advisor_outro_show_transcript}
              onSaveDraft={onSaveDraft}
              onSubmitQuest={onSubmitQuest}
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

        {/* Hiện SUỐT màn chơi, kể cả khi đã hết giờ hay thua.
            Trước đây gắn điều kiện `status === 'playing'`, nên đúng lúc người
            chơi lúng túng nhất — vừa thua, đang muốn đọc lại luật — thì nó biến
            mất. Một trang trợ giúp mà tự ẩn đi khi có sự cố thì để làm gì. */}
        <CornerTools
          cluebook={cluebook}
          cluebookTitle={cluebookTitle}
          cluebookReady={advisorDone}
          energyRemaining={run.my_energy_remaining}
          energyGranted={run.my_energy_granted}
        />
      </div>

      {/* KHÔNG có thanh tiến độ đội ở đây nữa.
          Nó liệt kê tên từng người kèm một dãy chấm "ai xong nhiệm vụ nào".
          Chơi một mình — mà hiện giờ chỉ có chơi một mình, phòng nhiều người là
          việc của Bước 7 — thì nó chỉ còn đúng tên người đang ngồi trước màn
          hình cộng một dãy chấm lặp lại thứ mà bộ đếm "Nhiệm vụ 1/4" trên thanh
          đầu đã nói. Nó ăn một dải chiều cao của cảnh chơi để nói lại một điều.
          Dựng lại ở Bước 7, khi trong phòng thật sự có người khác để mà theo
          dõi. Dữ liệu vẫn còn nguyên ở `run.team`. */}
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
 * Một biểu tượng ở góc màn, bấm ra một bảng nhỏ.
 *
 * CHỈ đóng mở bằng cú bấm — không nghe rê chuột. Rê chuột làm bảng tự bật lên
 * mỗi lần con trỏ đi ngang góc màn, ngay giữa lúc đang chơi; và trên màn hình
 * cảm ứng thì không có trạng thái "đang rê" nên nó chẳng giúp được gì. Một cú
 * bấm để mở, một cú nữa để tắt, giống nhau ở mọi thiết bị.
 *
 * Và đang mở mà người chơi làm việc khác — bấm ra ngoài, đi bằng phím — thì tự
 * tắt. Đây là thứ người ta liếc một cái rồi quay lại chơi, không phải một ô cửa
 * sổ phải nhớ đi đóng.
 */
function CornerBubble({
  icon,
  label,
  disabled,
  children,
}: {
  icon: string;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);

  // Đang mở mà người chơi làm bất cứ việc gì khác thì tự tắt.
  //
  // Nghe ở giai đoạn BẮT (capture) và dùng `pointerdown` chứ không phải `click`:
  // bảng phải biến mất TRƯỚC khi Phaser xử lý cú bấm, không thì có một khoảnh
  // khắc nhân vật đã chạy còn bảng vẫn nằm đè lên cảnh.
  //
  // Bấm vào chính cái nút thì bỏ qua — `onClick` của nó lo việc đóng, để cả hai
  // cùng chạy là đóng rồi mở lại ngay trong một cú bấm.
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

  // Khoá lại thì phải đóng luôn: bảng đang mở mà quyền xem mất đi (hết giờ, đổi
  // lượt) thì nó vẫn nằm đó cho tới khi có người bấm chỗ khác.
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div ref={holder} className="relative flex flex-col items-end gap-2">
      {open && !disabled && (
        <div
          role="tooltip"
          className="absolute right-0 bottom-11 w-72 max-w-[80vw] rounded-xl border border-abyss-700 bg-abyss-950/95 p-4 text-xs shadow-2xl backdrop-blur"
        >
          {children}
        </div>
      )}

      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold shadow-lg backdrop-blur transition ${
          disabled
            ? 'cursor-not-allowed border-abyss-800 bg-abyss-950/60 text-slate-700'
            : open
              ? 'border-lagoon-500 bg-abyss-900 text-lagoon-400'
              : 'border-abyss-700 bg-abyss-950/80 text-slate-400 hover:text-slate-100'
        }`}
      >
        {icon}
      </button>
    </div>
  );
}

/**
 * Cụm biểu tượng góc dưới bên phải: sổ tay, năng lượng, hướng dẫn.
 *
 * Cả ba đều là thứ người chơi LIẾC vào giữa lúc chơi, nên chúng đứng cùng chỗ
 * và cùng cỡ. Rải mỗi cái một góc thì mỗi lần cần là một lần phải đi tìm.
 */
function CornerTools({
  cluebook,
  cluebookTitle,
  cluebookReady,
  energyRemaining,
  energyGranted,
}: {
  cluebook: string;
  /** Ten so tay do giao vien dat. Rong = lui ve nhan dich cua giao dien. */
  cluebookTitle: string;
  cluebookReady: boolean;
  energyRemaining: number;
  energyGranted: number;
}) {
  const t = useTranslations();
  const HELP = ['click', 'keys', 'walkToQuest', 'enterZone', 'boundary', 'energy'] as const;

  return (
    <div className="absolute right-4 bottom-4 flex items-end gap-2">
      {/* Cùng cụm với sổ tay và năng lượng, và cùng một tuỳ chọn với bản đồ
          thiên hà: tắt nhạc ở ngoài kia thì vào đây vẫn tắt. */}
      <MusicControls className="h-9" />
      {/* Màn không có sổ tay thì KHÔNG hiện biểu tượng. Một cái nút mà bấm vào
          chẳng bao giờ có gì thì tệ hơn là không có nút. */}
      {cluebook && (
        <CornerBubble
          icon="📖"
          label={cluebookReady ? t('game.cluebook.title') : t('game.cluebook.locked')}
          disabled={!cluebookReady}
        >
          {/* Ten do giao vien dat thang, khong co thi moi lui ve nhan dich:
              "CAPTAIN DRAKE'S SECRET HANDBOOK" noi ro day la so tay CUA AI,
              con "So tay bi quyet" thi man nao cung giong man nao. */}
          <p className="mb-2 font-semibold text-orichalcum-400">
            {cluebookTitle || t('game.cluebook.title')}
          </p>
          {/* `whitespace-pre-line`: sổ tay do giáo viên soạn, xuống dòng ở đâu
              là họ cố ý xuống ở đó. */}
          <p className="whitespace-pre-line leading-relaxed text-slate-300">{cluebook}</p>
        </CornerBubble>
      )}

      {/* Năng lượng: một con số, luôn nhìn thấy.
          Trước khi qua NPC nó là 0 — và 0 là con số ĐÚNG, không phải trạng thái
          "chưa có gì": người chơi chưa được cấp thì họ đang có đúng 0 điểm để
          tiêu. Sau khi qua NPC thì hiện cả phần đã tiêu trên tổng được cấp. */}
      <span
        title={t('game.energyMine')}
        className={`flex h-9 items-center gap-1 rounded-full border px-3 text-sm font-medium shadow-lg backdrop-blur ${
          energyGranted > 0
            ? 'border-orichalcum-500/50 bg-abyss-950/80 text-orichalcum-400'
            : 'border-abyss-700 bg-abyss-950/80 text-slate-500'
        }`}
      >
        <span aria-hidden>⚡</span>
        <span className="font-mono">
          {energyRemaining}
          {energyGranted > 0 && <span className="text-slate-500">/{energyGranted}</span>}
        </span>
      </span>

      <CornerBubble icon="?" label={t('game.help.title')}>
        <p className="mb-2 font-semibold text-slate-100">{t('game.help.title')}</p>
        <ul className="space-y-1.5 text-slate-400">
          {HELP.map((key) => (
            <li key={key} className="flex gap-2">
              <span aria-hidden className="text-lagoon-400">
                ·
              </span>
              <span>{t(`game.help.${key}`)}</span>
            </li>
          ))}
        </ul>
      </CornerBubble>
    </div>
  );
}

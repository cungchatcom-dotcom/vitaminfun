'use client';

import { useLocale, useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useCurrentUser } from '@/components/auth-context';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-error';
import { pickText } from '@/lib/i18n-text';
import {
  abandonRun,
  appendDialogue,
  getDialogue,
  retryQuest,
  buyHint,
  getResult,
  getRun,
  saveDraft,
  savePosition,
  startRun,
  submitQuest,
  type Run,
  type RunResult,
  type Snapshot,
  type SnapshotQuest,
} from '@/lib/play';
import { questLabel } from '@/lib/quest-label';
import { localizedPath } from '@/lib/routes';

import { MusicControls } from './music-controls';
import { QuestPanel, type HintKind } from './quest-panel';
import type { ChatLine } from './quest-chat';
import { StageIntro } from './stage-intro';

import { readDialogue } from '@/game/dialogue';
import { themeVars } from '@/game/dialogue-theme';
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
/**
 * Lớp KÍNH của mấy cụm HUD nổi trên cảnh.
 *
 * Mờ chứ không đặc: phía sau là đáy biển thật, và dán một mảng xám kín lên bốn
 * góc là che mất đúng cảnh mà cả màn chơi dựng ra. Cùng chất liệu với bảng hội
 * thoại — một thứ kính cho cả màn, không phải mỗi chỗ một kiểu.
 */
const HUD_GLASS =
  'bg-abyss-950/55 ring-1 ring-white/10 backdrop-blur-md shadow-lg shadow-abyss-950/40';

/**
 * MỜ ĐI khi không ai đụng tới, RÕ khi rê chuột vào.
 *
 * Ba cụm HUD nằm đè lên cảnh, và cảnh mới là thứ đáng nhìn. Nhưng chúng cũng
 * không được biến mất hẳn: người chơi phải liếc thấy đồng hồ mà không cần đi
 * tìm nó. Mờ một nửa là giữ được cả hai — đọc lướt vẫn ra, mà không cắt ngang
 * khung cảnh.
 *
 * `focus-within` đi cùng `hover`: bấm Tab tới nút "Rời màn" cũng phải làm cụm
 * hiện rõ, nếu không thì người dùng bàn phím đang thao tác trên một thứ mờ tịt.
 */
const HUD_FADE =
  'opacity-55 transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100';

/**
 * Cả CỤM rõ lên là một chuyện; cái NÚT đang trỏ vào phải nổi thêm một nấc nữa.
 *
 * Chỉ mờ-rõ theo cụm thì rê vào một hàng bốn biểu tượng, cả bốn cùng sáng đều —
 * và người chơi không biết mình đang trỏ trúng cái nào cho tới lúc bấm. Một nấc
 * nữa ở chính cái đang trỏ mới trả lời được câu "bấm bây giờ là bấm vào gì".
 */
const HUD_ITEM =
  'transition hover:bg-white/12 hover:text-white hover:ring-white/30 focus-visible:bg-white/12';

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
    // LẤP ĐẦY chỗ được cho, không tự tính chiều cao.
    //
    // Bản trước viết `calc(100vh-8rem)` — trừ đi đúng chiều cao của thanh điều
    // hướng và dải chơi thử. Đó là một con số chép tay về một thứ nằm ở file
    // khác: bỏ thanh điều hướng đi, hay dải chơi thử xuống dòng, là nó sai ngay
    // mà không ai biết. Giờ trang bọc ngoài lo chiều cao (`h-dvh` + flex), ở đây
    // chỉ việc lấp đầy.
    <div className="relative size-full">
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
  const me = useCurrentUser();
  const t = useTranslations();
  const locale = useLocale();

  const [run, setRun] = useState<Run | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [activeQuestId, setActiveQuestId] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [clock, setClock] = useState(0);
  const [dangKhoiDongLai, setDangKhoiDongLai] = useState(false);
  /**
   * Đếm số lần LÀM LẠI một nhiệm vụ — chỉ để làm `key` cho `QuestPanel`.
   *
   * Làm lại là dựng lại bảng từ số không: về câu đầu, quên hết bong bóng, nạp
   * lại đoạn chat (giờ đã trống). Bảng ấy giữ cả chục biến trạng thái cho nhịp
   * nói, cho tiếng, cho hẹn giờ — đặt lại từng cái là một danh sách sẽ thiếu
   * đúng cái vừa thêm tuần sau. Đổi `key` thì React gỡ hẳn và dựng mới, và
   * không có cái nào sót lại được.
   */
  const [soLanLamLai, setSoLanLamLai] = useState(0);

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

  /**
   * CHƠI LẠI TỪ ĐẦU, ngay giữa trận.
   *
   * Hai việc, đúng thứ tự: CHỐT lượt đang dở rồi mới MỞ lượt mới.
   *
   * Chốt trước là bắt buộc. `start_run` thấy một lượt còn giờ thì trả về chính
   * nó — đó là luật "chơi tiếp" dựng lên cho những lần mất mạng, đóng nhầm tab.
   * Không chốt thì bấm Chơi lại chẳng có gì xảy ra, mà nhìn từ ngoài thì giống
   * hệt một cái nút hỏng.
   *
   * Chốt bằng `abandon` chứ không xoá: điểm chiến lực kiếm được trong lượt dở
   * VẪN ĐƯỢC GIỮ (cộng ngay lúc nộp từng câu, xem `settle_run`), chỉ mất phần
   * thưởng cuối màn và mảnh bản đồ. Bỏ dở giữa chừng thì đúng là như vậy.
   *
   * KHÔNG tải lại trang — khác với nút "Chơi lại" ở bảng kết quả. Tải lại thì
   * đoạn phim mở màn chạy lại từ đầu, mà người bấm Chơi lại giữa trận là người
   * đã xem nó rồi. Thay vào đó `PhaserCanvas` mang `key={run.id}`: lượt mới là
   * một `run.id` mới, nên React gỡ cảnh cũ và dựng cảnh mới — nhân vật về chỗ
   * xuất phát, ổ khoá đóng lại, đồng hồ đếm từ đầu.
   */
  async function khoiDongLai() {
    if (!run || dangKhoiDongLai) return;
    setDangKhoiDongLai(true);
    try {
      await abandonRun(run.id);
      const moi = await startRun(stageId);
      // Bảng nhiệm vụ đang mở thuộc về lượt CŨ. Không đóng thì nó đứng đó với
      // một `quest_id` của đề bài đã chốt xong.
      setActiveQuestId(null);
      setTyping(false);
      applyRun(moi);
      setErrorKey(null);
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    } finally {
      setDangKhoiDongLai(false);
    }
  }

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

  /**
   * BÁO cho cảnh Phaser, và KHÔNG để nó làm hỏng việc đang làm.
   *
   * `EventBus.emit` gọi tai nghe ĐỒNG BỘ, nên một tai nghe ném lỗi sẽ bắn ngược
   * vào giữa luồng chấm bài — bong bóng trả lời đã hiện, người canh giữ im bặt,
   * và không ai biết vì sao. Mấy cú bắn này chỉ là hiệu ứng nhìn: một dấu ✓ trên
   * bản đồ, một ánh chớp. Chúng không được quyền quyết định cuộc trò chuyện có
   * đi tiếp hay không.
   *
   * Gốc rễ đã sửa ở `StageScene` (gỡ tai nghe khi cảnh chết). Đây là lớp chắn
   * thứ hai, cho cái tai nghe hỏng tiếp theo mà hôm nay chưa ai viết.
   */
  const bao = useCallback((event: string, payload?: unknown) => {
    try {
      EventBus.emit(event, payload as never);
    } catch (error) {
      console.error('[stage] tai nghe canh Phaser nem loi', event, error);
    }
  }, []);

  const onSubmitQuest = useCallback(
    async () => {
      if (!run || !activeQuestId) throw new Error('no run');
      const result = await submitQuest(run.id, activeQuestId);

      /**
       * VÁ TẠI CHỖ, không tải lại cả lượt chơi.
       *
       * Bản trước gọi thêm `GET /runs/{id}` sau mỗi lần nộp để "cho chắc".
       * Lượt gọi ấy nặng 66 KB, trong đó 62 KB là ĐỀ BÀI ĐÃ ĐÓNG BĂNG — thứ
       * không bao giờ đổi trong suốt một lượt chơi. Nhân với mỗi câu trả lời
       * của mỗi học sinh trong một lớp trăm em thì đó là phần lớn băng thông
       * của cả hệ, để đồng bộ một thay đổi cỡ một dòng.
       *
       * Vẫn KHÔNG tự suy: mọi con số dưới đây đều do server vừa gửi về.
       *
       * `setRun` chứ không `applyRun`: `applyRun` đặt lại mốc hết giờ theo
       * `seconds_remaining`, mà nộp bài không đụng tới đồng hồ — đặt lại là
       * đẩy mốc đi mỗi lần nộp.
       */
      setRun((truoc) =>
        truoc === null
          ? truoc
          : {
              ...truoc,
              status: result.run_status as typeof truoc.status,
              my_energy_remaining: result.my_energy,
              // Quỹ được CẤP cũng phải đi theo: chính lần nộp qua cổng NPC là
              // lần nó khác 0 lần đầu, và thiếu nó thì ô năng lượng mất mẫu số
              // đúng vào giây nó vừa có nghĩa.
              my_energy_granted: result.my_energy_granted,
              my_progress: truoc.my_progress.map((p) =>
                p.quest_id === activeQuestId
                  ? result.quest
                  : // Mở khoá là mở HẾT, nên một cờ đủ cho cả danh sách.
                    result.unlocked && p.locked
                    ? { ...p, locked: false }
                    : p,
              ),
            },
      );

      if (result.quest_completed) {
        bao(GAME_EVENTS.QUEST_COMPLETED, { questId: activeQuestId });
      }

      // Vừa qua NPC thì cả màn mở ra. So TRƯỚC với SAU chứ không hỏi "nhiệm vụ
      // này có phải NPC không": server là nơi giữ luật mở khoá.
      const wasLocked = run.my_progress.some((p) => p.locked);
      if (wasLocked && result.unlocked) {
        bao(GAME_EVENTS.QUESTS_UNLOCKED);
      }
      if (result.run_status === 'won') {
        bao(GAME_EVENTS.STAGE_WON);
      }

      // Trả kèm tình trạng TỪNG CÂU vừa chấm. Bảng nhiệm vụ cần biết "câu vừa
      // rồi đúng chưa" để đi tiếp hay nói lại, mà `prop` của nó chỉ mới sang ở
      // lượt vẽ sau — trong lúc `await` thì nó vẫn đang cầm bản cũ.
      return { result, questions: result.quest.questions };
    },
    [run, activeQuestId, bao],
  );

  /**
   * Mua một gợi ý cho câu hỏi — tốn năng lượng.
   *
   * Nạp lại cả lượt chơi sau đó, không tự trừ con số ở client: năng lượng là
   * của SERVER, và một phép trừ thứ hai ở đây là một chỗ để hai bên lệch nhau.
   */
  const onBuyHint = useCallback(
    async (questionId: string, kind: HintKind) => {
      if (!run) throw new Error('no run');
      const bought = await buyHint(run.id, questionId, kind);
      applyRun(await getRun(run.id));
      return bought.text;
    },
    [run, applyRun],
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
    /**
     * TRỌN MÀN HÌNH, HUD nổi ở BA GÓC.
     *
     * Bản trước xếp dọc: một thanh HUD đặc chiếm hết bề ngang ở trên, canvas
     * nhận phần còn lại. Đổi lại thì cảnh — thứ duy nhất đáng nhìn ở màn này —
     * mất một dải ngang chỉ để chứa bốn con số và hai đường dẫn.
     *
     * Giờ canvas lấp đầy khung, HUD nổi lên trên thành ba cụm ở ba góc:
     *
     *     trên-trái   tên màn · đồng hồ · số nhiệm vụ
     *     trên-phải   Chơi lại · Rời màn
     *     dưới-phải   nhạc · sổ tay · năng lượng · trợ giúp
     *
     * `pointer-events-none` ở lớp bọc, `pointer-events-auto` ở từng cụm: đi lại
     * trong màn là BẤM VÀO CẢNH, nên một lớp phủ trong suốt nuốt cú bấm ở bốn
     * góc là làm hỏng đúng thao tác chính.
     */
    <div className="relative size-full overflow-hidden">
      {/* Khu chơi: canvas nằm dưới, bảng câu hỏi phủ lên. */}
      <div className="absolute inset-0">
        {/* Bảng câu hỏi mở = khoá di chuyển. Đang trả lời mà nhân vật vẫn đi
            được thì họ tự đi ra khỏi phạm vi và bảng đóng ngang giữa chừng. */}
        {/* Tấm màn còn che thì KHOÁ cả chuột lẫn bàn phím: cảnh Phaser nghe
            phím ở tầng document, nên bấm mũi tên trong lúc xem video là nhân vật
            đi lang thang phía sau và học sinh vào màn ở một chỗ họ không chọn. */}
        <PhaserCanvas
          // Lượt MỚI là một cảnh MỚI. `PhaserCanvas` cố ý không dựng lại khi dữ
          // liệu đổi — nếu không thì mỗi lần nộp bài là nạp lại cả game — nên
          // `run.id` là đúng cái khoá để nói "lần này thì dựng lại thật".
          key={run.id}
          sceneData={sceneData}
          typing={typing}
          locked={activeQuestId !== null || !introDone}
          // Chỉ hạ tiếng khi bảng đang mở CÓ gì để nghe — xem `questHasSound`.
          ducked={activeQuest !== null && questHasSound(activeQuest, run.snapshot)}
        />

        {/* CHỪA CHỖ cho ba cụm HUD: đệm dọc đủ để bảng không bao giờ trèo lên
            hàng trên và hàng dưới. Bảng nằm trên HUD theo thứ tự chồng, nên
            không chừa thì nó che mất đồng hồ đúng lúc người ta cần liếc xem còn
            bao nhiêu thời gian. */}
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center px-4 py-14 sm:items-center">
          {activeQuest && run.status === 'playing' && (
            <QuestPanel
              // Làm lại = một bảng MỚI. Xem `soLanLamLai`.
              key={`${activeQuest.id}:${soLanLamLai}`}
              quest={activeQuest}
              progress={activeProgress}
              advisorLabel={advisorLabel}
              // Mặt người GÁC CỔNG cho tấm bảng "đang khoá". Lấy từ ĐỀ BÀI ĐÃ
              // ĐÓNG BĂNG như mọi thứ khác của màn.
              cluebook={cluebook}
              advisorOutro={advisorOutro}
              // Tiếng và cờ transcript đều lấy từ ĐỀ BÀI ĐÃ ĐÓNG BĂNG, như mọi
              // thứ khác của màn: giáo viên thay đoạn ghi âm giữa chừng thì
              // lượt đang chơi vẫn nghe đúng cái nó bắt đầu.
              advisorOutroAudio={run.snapshot.stage.advisor_outro_audio_url ?? null}
              advisorOutroShowTranscript={run.snapshot.stage.advisor_outro_show_transcript}
              // Bố cục hội thoại cũng từ ĐỀ BÀI ĐÃ ĐÓNG BĂNG: giáo viên căn lại
              // giữa chừng thì lượt đang chơi vẫn giữ đúng cái nó bắt đầu.
              dialogue={run.snapshot.stage.dialogue}
              dialogueUrls={run.snapshot.stage.dialogue_urls ?? {}}
              // Nhân vật đến từ `run`, KHÔNG từ snapshot: đó là lựa chọn của
              // người chơi và đổi được giữa hai lượt.
              playerName={
                run.character ? pickText(run.character.name_i18n, locale) : t('game.you')
              }
              player={run.character ?? null}
              // ĐOẠN CHAT nằm ở server, khoá theo (lượt chơi, học sinh, nhiệm
              // vụ). `QuestPanel` không biết mạng là gì — nó chỉ gọi hai hàm
              // này, cùng ranh giới với `onSaveDraft` và `onSubmitQuest`.
              onLoadDialogue={() =>
                getDialogue(run.id, activeQuest.id).then((thread) => thread.lines as ChatLine[])
              }
              onAppendDialogue={(lines) =>
                appendDialogue(run.id, activeQuest.id, lines).then(
                  (thread) => thread.lines as ChatLine[],
                )
              }
              // Lời của người canh giữ đổi theo LƯỢT và theo NGƯỜI: chơi lại
              // nghe dãy khác, hai bạn cùng lớp nghe dãy khác nhau. Cố định
              // suốt một lượt nên vào lại giữa chừng vẫn nghe đúng câu đã nghe.
              variantSeed={`${run.id}:${me?.id ?? 'anon'}`}
              onSaveDraft={onSaveDraft}
              onSubmitQuest={onSubmitQuest}
              onBuyHint={onBuyHint}
              hintCost={run.hint_cost}
              energy={run.my_energy_remaining}
              onRetryQuest={async () => {
                applyRun(await retryQuest(run.id, activeQuest.id));
                setSoLanLamLai((n) => n + 1);
              }}
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
              // Tổng nhiệm vụ lấy từ đề bài đã đóng băng: bảng kết quả chỉ trả
              // về số nhiệm vụ ĐÃ QUA, mà "3" một mình thì không nói lên gì.
              questTotal={run.snapshot.quests.length}
              theme={readDialogue(run.snapshot.stage.dialogue).theme}
            />
          )}
        </div>

        {/* ── HUD ba góc ───────────────────────────────────────────── */}
        <div className="pointer-events-none absolute inset-0 z-20">
          {/* TRÊN-TRÁI: mình đang ở đâu, còn bao lâu, được mấy nhiệm vụ. */}
          <div
            className={`pointer-events-auto absolute top-3 left-3 flex items-center gap-3 rounded-2xl px-3.5 py-2 text-sm ${HUD_GLASS} ${HUD_FADE}`}
          >
            <span className="font-semibold text-orichalcum-400">
              {pickText(run.snapshot.stage.name_i18n, locale)}
            </span>

            {/* Năng lượng KHÔNG ở đây — nó nằm trong cụm góc dưới, cạnh sổ tay.
                Hai chỗ cùng hiện một con số thì có ngày chúng lệch nhau, mà kể
                cả không lệch thì cũng chỉ là hai chỗ để mắt phải đi tìm cùng
                một thứ. */}
            <span className={`font-mono ${clock < 30 ? 'text-coral-500' : 'text-slate-300'}`}>
              ⏱ {String(Math.floor(clock / 60)).padStart(2, '0')}:
              {String(clock % 60).padStart(2, '0')}
            </span>

            <span className="text-slate-300">
              {t('game.questsDone', { done: doneCount, total: run.snapshot.quests.length })}
            </span>

            {/* Cố ý KHÔNG hiện điểm chiến lực trong trận — xem GAME_DOMAIN §1.6. */}

            {run.is_trial && <Badge tone="warning">🧪 {t('preview.banner')}</Badge>}
          </div>

          {/* TRÊN-PHẢI: hai đường RA khỏi lượt đang chơi, HAI NÚT RỜI NHAU.
              Chung một viên kính thì trông như một khối, mà hai việc này khác
              hẳn nhau: một cái chốt lượt đang dở rồi chơi lại từ đầu, một cái đi
              ra khỏi màn. Tách ra thì rê chuột vào cái nào cũng rõ ngay mình sắp
              bấm vào cái gì. */}
          <div className="pointer-events-auto absolute top-3 right-3 flex items-center gap-2">
            {/* Hỏi lại một câu trước khi chơi lại: nó chốt lượt đang dở, và đó
                là việc không lùi được. */}
            <button
              type="button"
              disabled={dangKhoiDongLai}
              onClick={() => {
                if (!window.confirm(t('game.restartConfirm'))) return;
                void khoiDongLai();
              }}
              className={`rounded-2xl px-3.5 py-2 text-sm text-slate-300 disabled:cursor-not-allowed disabled:opacity-50 ${HUD_GLASS} ${HUD_FADE} ${HUD_ITEM}`}
            >
              {dangKhoiDongLai ? t('common.loading') : t('game.restart')}
            </button>

            {/* Rời trận thì về đúng bản đồ world vừa đi ra, không phải về bản đồ
                thiên hà. Người chơi đang dở một world; ném họ lên tận màn chọn
                world là bắt đi lại hai bước để làm cái việc họ gần như chắc chắn
                muốn làm tiếp — chơi màn kế bên. */}
            <Link
              href={localizedPath(`/play/world/${run.world_id}`, locale)}
              className={`rounded-2xl px-3.5 py-2 text-sm text-slate-300 ${HUD_GLASS} ${HUD_FADE} ${HUD_ITEM}`}
            >
              {t('game.leave')}
            </Link>
          </div>
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

/**
 * MÀN KẾT THÚC (S6) — bảng nhỏ nổi lên ngay trong cảnh, không chuyển trang.
 *
 * ## Vì sao là bảng nổi chứ không phải một trang riêng
 *
 * Hết màn là một khoảnh khắc trong lúc chơi, không phải một chặng mới. Ném học
 * sinh sang một URL khác nghĩa là tải lại cả trang, mất cảnh, mất nhạc — rồi
 * bấm "chơi lại" để tải ngược về. Bảng này nổi trên chính cái cảnh vừa chơi,
 * và hai cái nút đưa đi đúng hai nơi người ta muốn tới.
 *
 * ## Chỉ CON SỐ, không đáp án
 *
 * Bảng này cố ý KHÔNG hiện đáp án đúng, cũng không hiện từng câu sai ở đâu.
 * Không phải để giấu — mà để **chơi lại còn có nghĩa**. Nói ra đáp án ngay sau
 * lượt đầu thì lượt thứ hai chỉ còn là gõ lại thứ vừa đọc được, và điểm của nó
 * không đo được gì nữa.
 *
 * Hệ quả: cả con số cũng phải đủ để biết mình đứng ở đâu mà không đủ để suy ra
 * bài — "3/4 nhiệm vụ, 50/50 điểm" nói được cả hai điều đó.
 *
 * ## Số đến sau, và có thể không đến
 *
 * Tiêu đề với hai cái nút vẽ NGAY. Bảng điểm là một cú gọi mạng, và nếu nó
 * hỏng thì học sinh vẫn phải ra khỏi màn được — một bảng kết thúc chỉ hiện ra
 * khi mạng còn sống là cách nhốt người ta lại trong một màn đã chơi xong.
 */
function StageOver({
  runId,
  worldId,
  status,
  shard,
  questTotal,
  theme,
}: {
  runId: string;
  worldId: string;
  status: string;
  shard: number;
  questTotal: number;
  /** BỘ ÁO của màn, đọc từ đề bài đã đóng băng. Xem `dialogue-theme.ts`. */
  theme: string | null | undefined;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const me = useCurrentUser();
  const won = status === 'won';

  const [result, setResult] = useState<RunResult | null>(null);

  useEffect(() => {
    // `catch` rỗng có chủ ý: xem ghi chú "Số đến sau" ở trên. Không có số thì
    // bảng vẫn là một bảng kết thúc dùng được.
    getResult(runId)
      .then(setResult)
      .catch(() => undefined);
  }, [runId]);

  // Dòng của CHÍNH người đang ngồi đây. Bảng kết quả trả về cả phòng; đối chiếu
  // theo `id` của người dùng chứ không lấy phần tử đầu — phòng nhiều người đến
  // ở Bước 7, và lúc đó "phần tử đầu" là một người khác.
  const mine = result?.players?.find((p) => p.user_id === me.id) ?? null;

  return (
    <section
      className="pointer-events-auto w-full max-w-md"
      /**
       * CÙNG BỘ ÁO với bảng hội thoại. Đây là tấm bảng cuối cùng học sinh nhìn
       * thấy của một lượt chơi; để nó mặc bộ mặc định trong khi cả màn đã đổi
       * theme là hụt đúng ở nhịp kết.
       *
       * Cùng bộ biến, cùng giá trị lùi, nên `classic` ra đúng tấm bảng cũ.
       */
      style={{
        ...themeVars(theme),
        padding: 'var(--q-frame-pad, 0px)',
        borderRadius: 'var(--q-frame-radius, 1rem)',
        background: 'var(--q-frame-bg, transparent)',
        boxShadow: 'var(--q-frame-shadow, 0 25px 50px -12px rgba(4,18,31,0.45))',
      }}
    >
      <div
        className="p-6 text-center backdrop-blur"
        style={{
          borderRadius: 'var(--q-inner-radius, 1rem)',
          background: 'var(--q-inner-bg, rgba(10,31,51,0.95))',
          boxShadow: 'inset 0 0 0 1px var(--q-inner-ring, rgba(27,68,99,1))',
        }}
      >
      <p className="text-4xl" aria-hidden>
        {won ? '🗺' : '💧'}
      </p>
      <h2
        className="mt-3 text-lg font-bold"
        style={{ color: 'var(--q-header-ink, #f1f5f9)' }}
      >
        {won ? t('game.victory') : t(`game.defeat.${status}`)}
      </h2>
      <p className="mt-2 text-sm" style={{ color: 'var(--q-muted, #94a3b8)' }}>
        {won ? t('game.shardEarned', { shard }) : t('game.keptPoints')}
      </p>

      {result && (
        <dl
          className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border p-4 text-left sm:grid-cols-3"
          // Khối số dùng lại màu của KHỐI ĐÁP ÁN: cùng một vai — một mảng chữ
          // đặt trên nền bảng — nên không cần một bộ biến thứ hai cho nó.
          style={{
            borderColor: 'var(--q-opt-ring, #123049)',
            background: 'var(--q-opt-bg, rgba(4,18,31,0.4))',
          }}
        >
          <Figure label={t('game.result.quests')} value={`${mine?.quests_completed ?? 0}/${questTotal}`} />
          <Figure
            label={t('game.result.score')}
            value={`${round(mine?.score ?? 0)}/${mine?.max_score ?? 0}`}
          />
          <Figure label={t('game.result.skillPts')} value={`+${mine?.skill_pts_earned ?? 0}`} />
          <Figure label={t('game.result.time')} value={clock(result.duration_seconds)} />
          <Figure
            label={t('game.result.shards')}
            value={`${result.my_shards_owned}/${result.world_shard_total}`}
          />
          <Figure label={t('game.result.worldSkillPts')} value={String(result.my_world_skill_pts)} />
        </dl>
      )}

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {/* Tải lại cả trang, không phải gọi `startRun` lần nữa.
            Một lượt mới cần một cảnh Phaser mới: nhân vật về chỗ xuất phát, ổ
            khoá đóng lại, đồng hồ đếm từ đầu. `PhaserCanvas` cố ý KHÔNG dựng
            lại cảnh khi dữ liệu đổi (nếu không thì mỗi lần nộp bài là nạp lại
            cả game), nên cách duy nhất trung thực để bắt đầu lại là dựng lại
            trang. Cùng URL, nên không mất gì ngoài vài trăm mili giây. */}
        <Button
          variant="primary"
          onClick={() => window.location.reload()}
          style={{
            background: 'var(--q-cta-bg, #0ea5e9)',
            color: 'var(--q-cta-ink, #04121f)',
            boxShadow: 'inset 0 0 0 2px var(--q-cta-ring, transparent)',
          }}
          className="hover:brightness-110"
        >
          {t('game.playAgain')}
        </Button>
        {/* Nút này vẫn luôn mang chữ "về world" — chỉ có đích là sai, nó
            trỏ về bản đồ thiên hà. Giờ nó đi đúng chỗ tên nó nói. */}
        <Link href={localizedPath(`/play/world/${worldId}`, locale)}>
          <Button variant="secondary">{t('game.backToWorld')}</Button>
        </Link>
      </div>
      </div>
    </section>
  );
}

/** Một con số của bảng kết quả: nhãn nhỏ ở trên, số to ở dưới. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px]" style={{ color: 'var(--q-muted, #64748b)', opacity: 0.85 }}>
        {label}
      </dt>
      <dd
        className="font-mono text-sm font-semibold"
        style={{ color: 'var(--q-opt-ink, #e2e8f0)' }}
      >
        {value}
      </dd>
    </div>
  );
}

/** `192` → `03:12`. `null` (chưa chốt xong) → `--:--`. */
function clock(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** `8` chứ không phải `8.0`; `7.5` vẫn là `7.5`. Điểm từng phần có số lẻ. */
function round(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
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
              : // Rê vào thì ĐỔI CẢ VIỀN LẪN NỀN, và NỞ RA một nhịp.
              //
              // Chỉ đổi màu chữ thì vô dụng: một biểu tượng emoji không nhận
              // màu `text-*`, nên rê vào sổ tay hay trợ giúp trông y như không
              // rê. Đổi viền thì có thấy, nhưng một nét 1px trên vòng tròn 36px
              // vẫn phải nhìn kỹ mới ra. Nở ra thì mắt bắt được ngay cả khi
              // đang nhìn chỗ khác — và đó đúng là tình huống: người chơi đang
              // nhìn cảnh, tay mới rê tới góc.
              'border-abyss-700 bg-abyss-950/80 text-slate-400 hover:scale-110 hover:border-lagoon-400 hover:bg-abyss-800 hover:text-slate-100'
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
    // GÓC DƯỚI-PHẢI. Bảng hội thoại rộng tối đa `3xl` và căn giữa, nên ở một
    // màn hình rộng nó không với tới góc này — cụm công cụ vẫn bấm được trong
    // lúc đang nói chuyện với người canh giữ.
    <div className={`absolute right-3 bottom-3 z-20 flex items-end gap-2 ${HUD_FADE}`}>
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

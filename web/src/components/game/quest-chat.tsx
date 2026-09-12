"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { DIALOGUE_BACKGROUND, type DialogueSaved } from "@/game/dialogue";
import { themeVars } from "@/game/dialogue-theme";
import { DIALOGUE_REST, type DialoguePose, type DialogueRole } from "@/game/character";

import type { DialogueActor } from "@/lib/play";
import type { ReactNode } from "react";

/** Một câu SẮP nói ra — chưa có số thứ tự, server sẽ đánh. */
export interface NewChatLine {
  role: "npc" | "player";
  kind: "intro" | "prompt" | "answer" | "verdict" | "outro";
  text: string;
  aside?: string | null;
  tone?: "praise" | "wrong" | null;
  question_id?: string | null;
  audio_url?: string | null;
}

/** Một câu ĐÃ ở trong đoạn chat, đúng hình dạng server trả về. */
export interface ChatLine extends NewChatLine {
  seq: number;
}

/**
 * BỐ CỤC của Messenger, CHẤT LIỆU của màn chơi.
 *
 * Cấu trúc lấy nguyên của Messenger — bong bóng trái/phải, dính thành cụm, mặt
 * tròn ở cuối cụm, danh sách neo đáy: người ta nhận ra một cuộc trò chuyện
 * trước khi đọc chữ đầu tiên.
 *
 * Nhưng nền thì KHÔNG lấy. Messenger là một tấm nền đục phủ kín màn hình; ở
 * đây phía sau là đáy biển thật, và dán một tấm xám đặc lên nó là che mất đúng
 * cảnh mà cả màn chơi dựng ra. Nên tấm bảng là KÍNH MỜ — cùng chất liệu với
 * khung trả lời của bản trước: `bg-abyss-950/55` + `backdrop-blur`.
 *
 * Bong bóng cũng trong mờ theo, không phải hai mảng màu đặc. Chữ vẫn phải đọc
 * được trên một nền động, nên độ đục đủ để chắn, không đủ để thành tường.
 */
/**
 * Màu chữ — viết dưới dạng BIẾN CSS có giá trị lùi.
 *
 * Giá trị lùi chính là màu đang chạy hôm nay, nên theme `classic` (không đặt
 * biến nào) không đổi một pixel. Theme khác đặt biến thì mọi chỗ đổi theo, kể cả
 * khối đáp án nằm ở `renderers.tsx` — nó ở trong tấm bảng nên thừa hưởng biến mà
 * không cần nhận thêm một prop nào.
 */
const MSG = {
  incomingInk: "var(--q-in-ink, #E8EEF5)",
  outgoingInk: "var(--q-out-ink, #FFFFFF)",
  muted: "var(--q-muted, rgba(226,232,240,0.65))",
  praise: "var(--q-praise, #6EE7B7)",
  wrong: "var(--q-wrong, #FDA4AF)",
} as const;

/** Lớp kính cho từng phần — một chỗ đổi, cả màn đổi theo. */
const GLASS = {
  panel: "bg-abyss-950/55 ring-1 ring-white/10 backdrop-blur-md",
  bar: "bg-abyss-950/35 backdrop-blur-sm",
  incoming: "bg-white/12 ring-1 ring-white/15 backdrop-blur-sm",
  outgoing: "bg-lagoon-500/80 ring-1 ring-white/25 backdrop-blur-sm",
} as const;

/**
 * MÀN HỘI THOẠI — một cuộc trò chuyện CUỘN ĐƯỢC, dựng theo Messenger.
 *
 * ## Vì sao không còn là sáu khối kéo thả
 *
 * Bản trước đặt câu hỏi, câu trả lời và lời phán vào ba ô CỐ ĐỊNH do giáo viên
 * căn, mỗi ô giữ đúng câu mới nhất. Hệ quả: câu trước biến mất. Học sinh làm
 * tới câu thứ tư, muốn xem lại mình đã trả lời gì ở câu hai, thì không có đường
 * nào — thứ duy nhất còn lại là trí nhớ.
 *
 * Một danh sách cuộn giải đúng chuyện đó, nhưng nó không kéo thả được: nó dài
 * ra theo số câu đã hỏi, nên không có "chỗ" để mà căn. Đổi lại, giáo viên vẫn
 * giữ hai thứ đáng giữ — ẢNH NỀN của tấm bảng, và ẢNH BONG BÓNG cho mỗi bên.
 *
 * ## Cuộn: bám đáy, nhưng không giật khỏi tay người đang đọc
 *
 * Tin mới thì trôi xuống đáy — trừ khi học sinh vừa cuộn lên xem lại. Kéo họ về
 * đáy giữa lúc đang đọc câu hai là lỗi kinh điển của mọi khung chat tự cuộn.
 */
export function QuestChat({
  layout,
  urls,
  npcName,
  npc,
  npcPose,
  playerName,
  player,
  playerPose,
  lines,
  typing,
  answer,
  header,
  canSpeak = false,
  onClose,
  onTypingChange,
  onPlayingChange,
  onAudioEnded,
  actions,
  silenceRef,
}: {
  layout: DialogueSaved;
  /** URL ảnh nền tra sẵn theo `media_id`: tấm bảng, và da bong bóng hai bên. */
  urls: Record<string, string>;
  npcName: string;
  npc: DialogueActor | null;
  npcPose: DialoguePose;
  playerName: string;
  player: DialogueActor | null;
  playerPose: DialoguePose;
  /** CẢ đoạn chat, cũ nhất trước. */
  lines: ChatLine[];
  /** Người canh giữ đang "gõ" — hiện bong bóng ba chấm ở cuối. */
  typing: boolean;
  /** Vùng trả lời. Đổi theo dạng câu hỏi; component này không cần biết dạng nào. */
  answer: ReactNode;
  /**
   * Mấy cái nút TRỢ GIÚP treo dưới một bong bóng — lời thoại, bản dịch.
   *
   * Nhận vào một HÀM chứ không phải một khối dựng sẵn: chỉ ĐÚNG bong bóng đang
   * hỏi mới có mấy nút ấy, mà ở đây không ai biết bong bóng nào đang hỏi. Chỗ
   * gọi thì biết, nên chỗ gọi trả lời.
   */
  actions?: (line: ChatLine) => ReactNode;
  /**
   * Ô để chỗ gọi CẦM lấy nút tắt tiếng của đoạn chat này.
   *
   * Ngược chiều với mọi prop khác — ở đây component con đưa một hàm RA ngoài
   * chứ không nhận dữ liệu vào. Cần thế vì mấy thẻ `<audio>` chỉ có ở trong
   * này (sổ tay `nodes`), mà người quyết định "im đi" lại là `QuestPanel`: học
   * sinh nộp bài giữa lúc người canh giữ còn đang đọc thì lượt đó coi như hết.
   */
  silenceRef?: { current: (() => void) | null };
  /** Cụm nhỏ trên thanh tiêu đề: bước mấy trên mấy. Nút đóng thì đây tự vẽ. */
  header: ReactNode;
  /**
   * Đã được phép cất tiếng chưa — tức khuôn mặt người canh giữ đã hiện ra.
   *
   * Ảnh nhân vật là một tấm PNG cả megabyte; tiếng thì phát ngay. Không đợi thì
   * giọng nói vang lên trước một khoảng trống rồi mặt mới hiện ra giữa câu —
   * người nói xuất hiện sau lời nói của chính họ.
   */
  canSpeak?: boolean;
  onClose: () => void;
  onTypingChange: (typing: boolean) => void;
  /** Có tiếng nào đang phát không — chỗ gọi dùng để chọn tư thế nhân vật. */
  onPlayingChange?: (playing: boolean) => void;
  /**
   * Một câu vừa đọc XONG — kèm số thứ tự của nó.
   *
   * KẾT THÚC chứ không phải "thôi phát": học sinh bấm tạm dừng, hay React dựng
   * lại thẻ audio, đều làm tiếng ngừng kêu mà câu thì chưa nói hết. Chỗ gọi
   * dùng tín hiệu này để biết khi nào được nói câu tiếp theo, nên phân biệt hai
   * việc đó là bắt buộc.
   */
  onAudioEnded?: (seq: number) => void;
}) {
  const t = useTranslations();
  const scroller = useRef<HTMLDivElement>(null);
  const damDay = useRef(true);

  /**
   * Sổ tay các thẻ `<audio>` trong đoạn chat, theo `seq`.
   *
   * Cần một sổ tay vì luật "MỘT tiếng tại một lúc" phải với tới được những thẻ
   * KHÁC: học sinh đang nghe câu 2 mà bấm nghe câu 1 thì câu 2 phải tắt. Không
   * có sổ thì mỗi thẻ chỉ biết về chính nó, và hai câu nói chồng lên nhau.
   *
   * `querySelectorAll` cũng ra được, nhưng sẽ quét trúng cả tiếng nhạc nền nếu
   * sau này nó là một thẻ `<audio>` — và tắt nhạc nền khi học sinh nghe đề bài
   * là một thứ không ai yêu cầu.
   */
  const nodes = useRef(new Map<number, HTMLAudioElement>());
  const daTuPhat = useRef<number | null>(null);

  /**
   * Tắt mọi thẻ KHÁC. Gọi khi một thẻ vừa bắt đầu phát.
   *
   * Tách khỏi `phat()` và KHÔNG đụng vào thẻ đang phát: gộp lại thì cú bấm Play
   * của người dùng sẽ chạy vào nhánh `currentTime = 0`, và mỗi lần tua tới rồi
   * bấm tiếp là bài đọc nhảy về đầu.
   */
  const tatCacKhac = useCallback((seq: number) => {
    for (const [key, other] of nodes.current) {
      if (key !== seq && !other.paused) {
        other.pause();
        other.currentTime = 0;
      }
    }
  }, []);

  /**
   * IM HẾT — không chừa thẻ nào.
   *
   * Chỉ `pause()`, không đưa `currentTime` về 0: câu vừa bị cắt ngang vẫn nằm
   * đó trong đoạn chat, và học sinh bấm lại là nghe tiếp từ đúng chỗ đang dở
   * chứ không phải nghe lại từ đầu.
   */
  const imHet = useCallback(() => {
    for (const node of nodes.current.values()) {
      if (!node.paused) node.pause();
    }
  }, []);

  useEffect(() => {
    if (!silenceRef) return;
    silenceRef.current = imHet;
    return () => {
      silenceRef.current = null;
    };
  }, [silenceRef, imHet]);

  /**
   * TỰ phát một thẻ từ đầu, và tắt mọi thẻ khác.
   *
   * Trình duyệt CÓ THỂ TỪ CHỐI: Chrome chặn tiếng tự phát khi trang chưa ghi
   * nhận một cú chạm nào. Nuốt lỗi rồi thôi thì lần đầu vào gặp người canh giữ
   * là im lặng — và vì đã đánh dấu "đã tự phát" nên không bao giờ thử lại.
   *
   * Nên khi bị từ chối thì HẸN LẠI: chạm tiếp theo vào trang, dù chạm vào đâu,
   * là phát. Một lần duy nhất, và gỡ ngay sau đó.
   */
  const phat = useCallback(
    (seq: number) => {
      const node = nodes.current.get(seq);
      if (!node) return;
      tatCacKhac(seq);
      node.currentTime = 0;
      void node.play().catch(() => {
        const lai = () => {
          window.removeEventListener("pointerdown", lai);
          window.removeEventListener("keydown", lai);
          void node.play().catch(() => undefined);
        };
        window.addEventListener("pointerdown", lai, { once: true });
        window.addEventListener("keydown", lai, { once: true });
      });
    },
    [tatCacKhac],
  );

  /**
   * TỰ PHÁT câu mới nhất, đúng MỘT lần.
   *
   * Theo `seq` chứ không theo nội dung: hai câu nghe liên tiếp đều không có chữ
   * nào, nên so nội dung thì câu thứ hai bị coi là đã phát rồi.
   *
   * CẢ HAI VAI, không riêng người canh giữ. Câu trả lời của học sinh cũng có
   * thể có bản thu — chính nhân vật em chọn đọc lên phương án em vừa bấm — và
   * một bong bóng có tiếng mà phải bấm mới nghe thì không còn là một cuộc trò
   * chuyện, nó là một danh sách tệp.
   */
  useEffect(() => {
    const last = lines[lines.length - 1];
    if (!canSpeak || !last?.audio_url) return;
    if (daTuPhat.current === last.seq) return;
    daTuPhat.current = last.seq;
    phat(last.seq);
  }, [lines, canSpeak, phat]);

  // Người dùng cuộn lên thì thôi bám đáy, cuộn về gần đáy thì bám lại.
  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    damDay.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  // `useLayoutEffect` chứ không `useEffect`: cuộn sau khi trình duyệt đã vẽ thì
  // mắt kịp thấy một khung ở sai chỗ rồi mới nhảy.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && damDay.current) el.scrollTop = el.scrollHeight;
  }, [lines.length, typing]);

  return (
    <section
      // Dấu để chỗ khác nhận ra "đang ở trong bảng nhiệm vụ" — phím Enter của
      // `QuestPanel` chỉ nhận khi tiêu điểm còn nằm trong đây.
      data-quest-panel=""
      className="pointer-events-auto relative flex h-full max-h-full w-full max-w-3xl flex-col"
      /**
       * KHUNG NGOÀI, và là chỗ duy nhất đặt biến của theme.
       *
       * Mọi mảnh bên trong — kể cả khối đáp án ở `renderers.tsx` — thừa hưởng
       * biến theo cây DOM, nên không mảnh nào phải nhận thêm prop và không mảnh
       * nào có thể quên dùng.
       *
       * Mỗi thuộc tính đều có giá trị LÙI bằng đúng giá trị `classic` đang chạy.
       * Bắt buộc phải có: `var(--x)` không có giá trị lùi mà biến chưa đặt thì
       * cả khai báo hỏng và thuộc tính rơi về giá trị KHỞI TẠO của CSS — tức là
       * trong suốt, chứ không phải về lớp Tailwind bên cạnh.
       */
      style={{
        ...themeVars(layout.theme),
        padding: "var(--q-frame-pad, 0px)",
        borderRadius: "var(--q-frame-radius, 1rem)",
        background: "var(--q-frame-bg, transparent)",
        boxShadow: "var(--q-frame-shadow, 0 25px 50px -12px rgba(4,18,31,0.45))",
      }}
      // Gõ trong bảng này thì cảnh Phaser phải ngừng nhận WASD, không thì gõ
      // chữ "a" là nhân vật chạy sang trái.
      onFocusCapture={() => onTypingChange(true)}
      onBlurCapture={() => onTypingChange(false)}
    >
      {/* LÒNG BẢNG. Tách khỏi khung ngoài để theme nào cần một dải viền dày
          (Atlantis: nẹp vàng 10px) thì chỉ việc đặt `--q-frame-pad`; theme
          `classic` để 0 và hai lớp trùng khít lên nhau như cũ. */}
      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden backdrop-blur-md"
        style={{
          borderRadius: "var(--q-inner-radius, 1rem)",
          background: "var(--q-inner-bg, rgba(4,18,31,0.55))",
          boxShadow: "inset 0 0 0 1px var(--q-inner-ring, rgba(255,255,255,0.10))",
        }}
      >
      {/* Ảnh nền TUỲ CHỌN của cả tấm bảng. Có thì cuộc trò chuyện diễn ra trong
          khung cảnh người dựng chọn; không thì nền Messenger trơn. */}
      {urls[DIALOGUE_BACKGROUND] && (
        <img
          src={urls[DIALOGUE_BACKGROUND]}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover opacity-45"
          draggable={false}
        />
      )}

      {/* ── THANH TIÊU ĐỀ ─────────────────────────────────────────────────
          Đúng nếp Messenger: mặt và tên người đang nói chuyện ở góc trái, các
          nút ở góc phải. Ở bản trước không có thanh này và tên người canh giữ
          không xuất hiện ở đâu cả. */}
      <header
        className="relative z-10 flex shrink-0 items-center gap-2.5 px-3 py-2 backdrop-blur-sm"
        style={{
          background: "var(--q-header-bg, rgba(4,18,31,0.35))",
          borderBottom: "1px solid var(--q-header-line, rgba(255,255,255,0.10))",
        }}
      >
        <Face actor={npc} role="npc" pose={npcPose} name={npcName} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: MSG.incomingInk }}>
          {npcName}
        </span>
        {header}
        <button
          type="button"
          onClick={onClose}
          aria-label={t("game.leave")}
          className="grid size-7 shrink-0 place-items-center rounded-full transition hover:bg-white/10"
          style={{ color: MSG.muted }}
        >
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {/* ── ĐOẠN CHAT ─────────────────────────────────────────────────── */}
      <div
        ref={scroller}
        onScroll={onScroll}
        className="relative z-10 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-3"
        // Vùng ĐỌC. `classic` để trong suốt cho thấy ảnh nền; Atlantis lát một
        // mảng xà cừ sáng viền vàng, và đó là lý do mọi màu chữ phải nằm trong
        // biến chứ không viết cứng ở đâu.
        style={{
          background: "var(--q-body-bg, transparent)",
          margin: "var(--q-body-margin, 0px)",
          borderRadius: "var(--q-body-radius, 0px)",
          border: "var(--q-body-border, 0px solid transparent)",
          boxShadow: "var(--q-body-shadow, none)",
        }}
      >
        {/* Đẩy cụm tin xuống đáy khi đoạn chat còn ngắn. Messenger neo ở đáy;
            neo ở đỉnh thì hai câu đầu lơ lửng giữa một khoảng trống to. */}
        <div className="mt-auto" />

        {lines.map((line, i) => (
          <Row
            key={line.seq}
            line={line}
            urls={urls}
            nodes={nodes.current}
            onPlay={() => tatCacKhac(line.seq)}
            onPlayingChange={onPlayingChange}
            onAudioEnded={onAudioEnded}
            extras={actions?.(line) ?? null}
            // Mặt chỉ hiện ở tin CUỐI của một cụm cùng người nói — đúng như
            // Messenger. Hiện ở mọi tin thì một dãy bốn câu của người canh giữ
            // thành bốn cái mặt xếp dọc, và mắt đọc chúng chứ không đọc chữ.
            face={
              line.role === "npc" && lines[i + 1]?.role !== "npc" ? (
                <Face actor={npc} role="npc" pose={npcPose} name={npcName} small />
              ) : line.role === "player" && lines[i + 1]?.role !== "player" ? (
                <Face actor={player} role="player" pose={playerPose} name={playerName} small />
              ) : null
            }
          />
        ))}

        {typing && <TypingRow face={<Face actor={npc} role="npc" pose={npcPose} name={npcName} small />} />}
      </div>

      {/* ── KHUNG TRẢ LỜI ──────────────────────────────────────────────────
          Neo ở đáy như ô soạn tin của Messenger. Cao tối đa 45% rồi tự cuộn:
          một câu trắc nghiệm sáu phương án dài hơn cả đoạn chat, và để nó đẩy
          đoạn chat ra khỏi màn hình là mất đúng thứ vừa dựng lên. */}
      <div
        className="relative z-10 max-h-[45%] shrink-0 overflow-y-auto px-3 py-2.5 backdrop-blur-sm"
        style={{
          background: "var(--q-bar-bg, rgba(4,18,31,0.35))",
          borderTop: "1px solid var(--q-bar-line, rgba(255,255,255,0.10))",
        }}
      >
        {answer}
      </div>
      </div>
    </section>
  );
}

/** Một dòng trong đoạn chat: mặt + bong bóng, căn trái hoặc căn phải. */
function Row({
  line,
  urls,
  face,
  nodes,
  onPlay,
  onPlayingChange,
  onAudioEnded,
  extras,
}: {
  line: ChatLine;
  urls: Record<string, string>;
  face: ReactNode;
  nodes: Map<number, HTMLAudioElement>;
  onPlay: () => void;
  onPlayingChange?: (playing: boolean) => void;
  onAudioEnded?: (seq: number) => void;
  /** Nút trợ giúp của riêng bong bóng này, xếp TRƯỚC cái loa. */
  extras?: ReactNode;
}) {
  const cuaMinh = line.role === "player";
  const da = urls[cuaMinh ? "playerBubble" : "npcBubble"];

  // MỘT kiểu bo góc cho mọi bong bóng: tròn đều bốn góc.
  //
  // Bản trước bo theo CỤM như Messenger — mép phía người nói thu lại ở những
  // tin giữa cụm — nên cùng một người canh giữ nói bốn câu liền là bốn hình
  // dạng khác nhau xếp dọc. Ở Messenger điều đó gom một chuỗi tin thành một
  // khối, nhưng ở đây mỗi bong bóng là một LƯỢT NÓI riêng, có tiếng riêng, có
  // dải nút riêng — gom lại thì không còn nhìn ra ranh giới giữa hai lượt.
  const radius = "1.15rem";

  const inkTone =
    line.tone === "praise" ? MSG.praise : line.tone === "wrong" ? MSG.wrong : null;

  // BONG BÓNG CHỈ ĐỰNG CHỮ.
  //
  // Cái loa và mấy nút trợ giúp trước đây nằm TRONG bong bóng, và ở đó chúng
  // lọt thỏm: một thanh điều khiển giữa một khối chữ thì mắt phải tìm, còn một
  // bong bóng chỉ có mỗi cái loa (câu nghe, không chữ) thì teo lại thành một
  // mẩu vuông không ra bong bóng cũng không ra cái nút.
  //
  // Tách ra thành một dải riêng treo ĐÈ LÊN mép dưới bên trái — đúng kiểu mấy
  // cái nút thả cảm xúc của Messenger. Dải ấy dính vào bong bóng bằng mắt, mà
  // không chiếm một dòng nào bên trong nó.
  const coChu = Boolean(line.text || line.aside);
  const daiNut =
    extras || line.audio_url ? (
      <span
        className={`relative z-10 -mt-2.5 flex items-center gap-1.5 ${
          cuaMinh ? "mr-2.5 flex-row-reverse" : "ml-2.5"
        }`}
      >
        {extras}
        {line.audio_url && (
          <TinyAudio
            src={line.audio_url}
            seq={line.seq}
            nodes={nodes}
            onPlay={onPlay}
            onPlayingChange={onPlayingChange}
            onAudioEnded={onAudioEnded}
          />
        )}
      </span>
    ) : null;

  return (
    <div className={`flex items-end gap-1.5 ${cuaMinh ? "flex-row-reverse" : ""}`}>
      {/* Chỗ của cái mặt luôn được giữ, kể cả khi không vẽ mặt: không giữ thì
          các tin giữa cụm thụt sang mép và cả cụm so le. */}
      <span className="size-10 shrink-0">{face}</span>

      {/* Một CỘT: bong bóng ở trên, dải nút cắn vào mép dưới của nó. Bề ngang
          tối đa chuyển lên cột, nếu không thì dải nút không bị chặn gì và một
          thanh thời gian mở ra có thể đẩy cả hàng rộng quá khổ. */}
      <div
        className={`flex max-w-[72%] min-w-0 flex-col ${
          cuaMinh ? "items-end" : "items-start"
        }`}
      >
        <div
            className={`max-w-full px-3 pt-2 ${
              // Có dải nút cắn vào mép dưới thì nới đáy ra, không thì nó đè lên
              // dòng chữ cuối.
              daiNut ? "pb-3.5" : "pb-2"
            } ${
              // CHƯA CÓ CHỮ vẫn là một bong bóng bình thường — câu nghe chưa mở
              // lời thoại thì bong bóng rỗng, nhưng nó vẫn phải là bong bóng.
              // Bỏ đi thì dải nút lơ lửng giữa nền, không dính vào ai; còn để
              // bong bóng tự co theo nội dung rỗng thì nó teo thành một mẩu
              // vuông bằng đúng phần đệm.
              coChu ? "" : "min-h-9 min-w-28"
            } ${da ? "" : "backdrop-blur-sm"}`}
            style={{
              borderRadius: radius,
              // Ảnh người dựng tải lên THẮNG theme: họ đã chọn cụ thể tấm ấy
              // cho bong bóng này, chồng thêm nền của theme lên trên là hai lớp
              // nền đè nhau — thứ không ai cố ý muốn.
              //
              // Ảnh kéo giãn cho vừa bong bóng chứ không lặp: đây là một cái
              // khung, không phải hoạ tiết.
              ...(da
                ? { backgroundImage: `url(${da})`, backgroundSize: "100% 100%" }
                : {
                    background: cuaMinh
                      ? "var(--q-out-bg, rgba(14,165,233,0.80))"
                      : "var(--q-in-bg, rgba(255,255,255,0.12))",
                    boxShadow: `inset 0 0 0 1px ${
                      cuaMinh
                        ? "var(--q-out-ring, rgba(255,255,255,0.25))"
                        : "var(--q-in-ring, rgba(255,255,255,0.15))"
                    }`,
                  }),
              color: cuaMinh ? MSG.outgoingInk : MSG.incomingInk,
            }}
          >
            {line.text && (
              <p
                className="text-[0.95rem] leading-snug whitespace-pre-wrap"
                // CHỈ đổi màu, không bôi đậm. Màu đã đủ nói "đúng" hay "sai";
                // thêm nét đậm là câu khen được hét to hơn mọi câu khác trong
                // cuộc trò chuyện, lặp lại ở từng câu hỏi.
                style={inkTone ? { color: inkTone } : undefined}
              >
                {line.text}
              </p>
            )}

            {line.aside && (
              <p
                className="mt-1 border-t pt-1 text-[0.8rem] leading-snug whitespace-pre-wrap"
                style={{
                  borderColor: "rgba(255,255,255,0.18)",
                  color: cuaMinh ? "rgba(255,255,255,0.82)" : MSG.muted,
                }}
              >
                {line.aside}
              </p>
            )}
          </div>

        {daiNut}
      </div>
    </div>
  );
}

/** Bong bóng ba chấm — người canh giữ đang nghĩ. */
function TypingRow({ face }: { face: ReactNode }) {
  return (
    <div className="flex items-end gap-1.5">
      <span className="size-10 shrink-0">{face}</span>
      <div
        className="flex gap-1 px-3.5 py-3 backdrop-blur-sm"
        style={{
          borderRadius: "var(--q-bubble-radius, 1.15rem)",
          background: "var(--q-in-bg, rgba(255,255,255,0.12))",
          boxShadow: "inset 0 0 0 1px var(--q-in-ring, rgba(255,255,255,0.15))",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-bounce rounded-full"
            style={{ background: MSG.muted, animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Cái MẶT tròn, cắt từ spritesheet của nhân vật.
 *
 * Messenger để một ảnh đại diện tròn nhỏ cạnh bong bóng, còn bản trước của màn
 * này dựng cả người đứng ở hai mép. Người đứng không hợp với một danh sách
 * cuộn: nó phải đứng yên trong khi chữ trôi qua, nên hoặc nó che mất chữ, hoặc
 * nó trôi theo và thành bảy bản sao của cùng một người.
 *
 * Cắt khung đầu tiên của tư thế và bo tròn — cùng một ảnh, dùng theo lối khác.
 */
export function Face({
  actor,
  role,
  pose,
  name,
  small = false,
  size,
  nen,
}: {
  actor: DialogueActor | null;
  role: DialogueRole;
  pose: DialoguePose;
  name: string;
  small?: boolean;
  /** Đường kính, pixel. Bỏ trống thì theo `small` — cỡ dùng trong đoạn chat. */
  size?: number;
  /**
   * MÀU NẰM DƯỚI ẢNH. Mặc định là một lớp đen mỏng: cạnh bong bóng thoại,
   * vòng tròn cần tự tách khỏi nền để người đọc thấy có một cái mặt ở đó.
   *
   * Nhưng ở tấm bảng nhiệm vụ ĐANG KHOÁ, vòng tròn nằm giữa một phần ba trống
   * cùng màu với hai phần ba bên phải, và ảnh nhân vật thì nền trong suốt —
   * lớp đen ấy biến thành một cái đĩa sẫm đóng dấu giữa tấm bảng. Ở đó truyền
   * vào đúng màu lòng bảng (`--q-inner-bg`) để vòng tròn tan vào nền.
   */
  nen?: string;
}) {
  const sprites = actor?.sprites ?? [];
  // TO HƠN bản trước (28px). Ở 28px cái mặt cắt từ spritesheet chỉ còn là một
  // chấm màu — không nhận ra ai đang nói, mà đó đúng là việc duy nhất của nó.
  const px = size ?? (small ? 40 : 44);

  /**
   * BỐN NẤC LÙI, dừng ở nấc đầu tiên có ảnh.
   *
   *   1. tư thế đang cần,
   *   2. tư thế NGHỈ của vai đó (`wait` / `listen`),
   *   3. ẢNH ĐẠI DIỆN của nhân vật (`characters.avatar_media_id`),
   *   4. bất kỳ dải nào nhân vật có — `idle`, `walk`, gì cũng được.
   *
   * Nấc 3 và 4 trước đây KHÔNG có, dù `character.ts` đã ghi chuỗi lùi này ra từ
   * đầu. Hậu quả: nhân vật học sinh chọn để chơi chỉ có `idle` và `walk` — hai
   * tư thế của cảnh chơi, không ai tải thêm tư thế hội thoại — nên cạnh mọi
   * bong bóng của em là một chữ cái xám, trong khi ảnh nhân vật vẫn nằm sẵn đó.
   */
  const sheet =
    sprites.find((sp) => sp.action_key === pose && sp.url) ??
    sprites.find((sp) => sp.action_key === DIALOGUE_REST[role] && sp.url) ??
    null;

  if (!sheet?.url && actor?.avatar_url) {
    return (
      <span
        aria-label={name}
        className="block shrink-0 rounded-full bg-cover bg-center"
        style={{
          width: px,
          height: px,
          backgroundColor: nen ?? "rgba(0,0,0,0.3)",
          backgroundImage: `url(${actor.avatar_url})`,
        }}
      />
    );
  }

  // Không có ảnh đại diện thì cắt đầu từ bất kỳ dải nào có — cùng phép cắt như
  // tư thế hội thoại, chỉ khác chỗ lấy khung.
  const dung = sheet ?? sprites.find((sp) => sp.url) ?? null;

  if (!dung?.url) {
    // Chưa gán nhân vật gì cả: chữ cái đầu của tên. Một ô trống thì cả cụm tin
    // lệch đi và không ai biết vì sao.
    return (
      <span
        className="grid place-items-center rounded-full text-[0.85rem] font-semibold"
        style={{ width: px, height: px, background: "rgba(255,255,255,0.12)", color: MSG.muted }}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  // Cắt KHUNG ĐẦU TIÊN của dải, phóng to vào phần đầu, rồi bo tròn.
  //
  // Không nén cả người vào một hình tròn: nhân vật đứng thì cao gấp đôi bề
  // ngang, nén lại là một cái mặt bẹp. Phóng `ZOOM` lần rồi kéo lên trên để
  // phần đầu rơi vào giữa vòng tròn — cùng cách mọi ảnh đại diện cắt từ ảnh
  // toàn thân đều làm.
  const w = dung.frame_width ?? 64;
  const h = dung.frame_height ?? 64;
  const n = Math.max(1, dung.frames ?? 1);
  const ZOOM = 2.1;

  const frameH = px * ZOOM;
  const frameW = frameH * (w / h);

  return (
    <span
      aria-label={name}
      className="block shrink-0 overflow-hidden rounded-full bg-no-repeat"
      style={{
        width: px,
        height: px,
        backgroundColor: nen ?? "rgba(0,0,0,0.3)",
        backgroundImage: `url(${dung.url})`,
        backgroundSize: `${frameW * n}px ${frameH}px`,
        // x: khung 0 căn giữa vòng tròn · y: kéo lên để lấy phần đầu.
        backgroundPosition: `${(px - frameW) / 2}px ${-frameH * 0.04}px`,
      }}
    />
  );
}


/**
 * TRÌNH PHÁT GỌN — chỉ một cái loa, rê chuột mới mở ra.
 *
 * Trình phát mặc định của trình duyệt cao 32px, rộng ít nhất 200px, và mang
 * theo cả nút tải xuống lẫn menu ba chấm. Đặt nó vào một bong bóng thoại thì nó
 * to hơn chính câu nói, và cuộc trò chuyện trông như một danh sách tệp đính kèm.
 *
 * Ở đây mặc định chỉ có cái loa cỡ 24px nép ở đáy bong bóng. Rê chuột — hoặc
 * trong lúc đang phát — mới trượt ra một thanh thời gian mỏng và con số giây.
 * Đang phát thì luôn mở: người nghe cần thấy nó còn bao lâu mà không phải giữ
 * chuột ở đó.
 *
 * Thẻ `<audio>` thật vẫn còn, chỉ là bị giấu: luật "một tiếng tại một lúc" và
 * việc tự phát đều làm việc trực tiếp với nó qua sổ tay `nodes`.
 */
function TinyAudio({
  src,
  seq,
  nodes,
  onPlay,
  onPlayingChange,
  onAudioEnded,
}: {
  src: string;
  seq: number;
  nodes: Map<number, HTMLAudioElement>;
  onPlay: () => void;
  onPlayingChange?: (playing: boolean) => void;
  onAudioEnded?: (seq: number) => void;
}) {
  const node = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [left, setLeft] = useState(0);
  /**
   * Con trỏ đang ở trên khối này.
   *
   * Bằng STATE chứ không bằng `group-hover` của CSS: lớp nhóm có tên
   * (`group/au`) chỉ tồn tại nếu Tailwind gom được nó lúc dựng, và nếu không
   * thì thanh thời gian im lặng không bao giờ mở ra — một cái hỏng không có dấu
   * hiệu nào ngoài việc rê chuột vào thấy không có gì xảy ra. Đã gặp thật.
   */
  const [hover, setHover] = useState(false);

  function toggle() {
    const el = node.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  }

  return (
    <span
      className="flex items-center gap-1.5"
      // Khối chữ ở trên có thể rất hẹp; đừng để cái loa kéo bong bóng rộng ra.
      style={{ maxWidth: "100%" }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      // Bàn phím cũng phải mở được: tab tới cái nút là thấy thanh thời gian.
      onFocusCapture={() => setHover(true)}
      onBlurCapture={() => setHover(false)}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={src}
        // CÙNG cỡ, CÙNG màu với mấy nút trợ giúp đứng cạnh. Tô màu nhấn riêng
        // cho cái loa là biến nó thành việc chính của bong bóng, mà việc chính
        // là đọc chữ — tiếng chỉ là thứ nghe thêm.
        //
        // Nền ĐẶC chứ không trong mờ: dải này nằm ĐÈ lên mép bong bóng, nên một
        // cái nút trong mờ sẽ lẫn nửa vào nền bong bóng, nửa vào đáy biển.
        className="grid size-5 shrink-0 place-items-center rounded-full bg-abyss-950/70 text-slate-300 ring-1 ring-white/15 transition hover:bg-abyss-800 hover:text-slate-100"
      >
        {/* VẼ chứ không gõ ký tự. `▶` và `❚❚` là ký tự Unicode có bản emoji, và
            Chrome dựng chúng thành emoji MÀU — cái nút hoá ra một ô vuông xanh
            giữa hai cái nút xám, dù lớp màu đặt thế nào cũng không đổi được.
            Đã gặp thật. */}
        <svg viewBox="0 0 24 24" className="size-3" aria-hidden fill="currentColor">
          {playing ? (
            <path d="M8 5h3v14H8zM13 5h3v14h-3z" />
          ) : (
            <path d="M8 5.5v13l11-6.5z" />
          )}
        </svg>
      </button>

      {/* Thanh thời gian: rộng 0 khi nghỉ, trượt ra khi rê chuột hoặc đang phát.
          Đổi `width` chứ không `display`: có `transition` thì nó trượt ra chứ
          không nhảy phịch. */}
      <span
        className={`flex items-center gap-1.5 overflow-hidden transition-[width,opacity] duration-200 ${
          playing || hover ? "w-24 opacity-100" : "w-0 opacity-0"
        }`}
      >
        <span className="h-[3px] flex-1 rounded-full bg-white/25">
          <span
            className="block h-full rounded-full bg-white/80"
            style={{ width: `${Math.round(pos * 100)}%` }}
          />
        </span>
        <span className="shrink-0 font-mono text-[9px] tabular-nums opacity-70">
          {mmss(left)}
        </span>
      </span>

      <audio
        ref={(el) => {
          node.current = el;
          if (el) nodes.set(seq, el);
          else nodes.delete(seq);
        }}
        src={src}
        preload="none"
        className="hidden"
        // Bấm PLAY trên bong bóng này thì mọi bong bóng khác im: một cuộc trò
        // chuyện có hai giọng cùng nói là không nghe ra được câu nào.
        onPlay={() => {
          onPlay();
          setPlaying(true);
          onPlayingChange?.(true);
        }}
        onPause={() => {
          setPlaying(false);
          onPlayingChange?.(false);
        }}
        onEnded={() => {
          setPlaying(false);
          setPos(0);
          onPlayingChange?.(false);
          onAudioEnded?.(seq);
        }}
        onTimeUpdate={(event) => {
          const el = event.currentTarget;
          const total = el.duration;
          // `duration` là `NaN` cho tới khi đọc xong metadata — chia cho nó thì
          // thanh chạy nhảy loạn ở giây đầu.
          if (!Number.isFinite(total) || total <= 0) return;
          setPos(el.currentTime / total);
          setLeft(Math.max(0, total - el.currentTime));
        }}
        onLoadedMetadata={(event) => {
          const total = event.currentTarget.duration;
          if (Number.isFinite(total)) setLeft(total);
        }}
      />
    </span>
  );
}

/** Giây thành `m:ss`. Chữ số đều bề ngang (`tabular-nums`) nên không nhảy. */
function mmss(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

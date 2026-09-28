"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { DIALOGUE_BACKGROUND, textPx, type DialogueSaved } from "@/game/dialogue";
import { themeVars } from "@/game/dialogue-theme";
import { usePortraitScreen } from "@/game/pointer";
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
  /**
   * Nguồn tiếng của từng bong bóng, theo `seq`. CHỈ là đường dẫn.
   *
   * Trước đây đây là sổ các thẻ `<audio>` — mỗi bong bóng một thẻ riêng. Đúng
   * trên máy tính, HỎNG trên iPhone: Safari đòi MỖI thẻ media phải được mở khoá
   * bằng một cú chạm của người dùng. Câu chào phát được vì nó đi ngay sau cú
   * chạm vào người canh giữ; câu hỏi đến sau bằng hẹn giờ, trên một thẻ vừa
   * mới sinh ra và chưa ai chạm vào — nên bị chặn, và học sinh phải chạm màn
   * hình mới nghe được.
   *
   * Giờ cả đoạn chat dùng ĐÚNG MỘT thẻ (`loa`), mở khoá một lần rồi đổi nguồn
   * cho từng câu. Một thẻ đã được chạm thì mọi lần phát sau đều qua.
   */
  const nguon = useRef(new Map<number, string>());
  const daTuPhat = useRef<number | null>(null);

  /** Thẻ `<audio>` DUY NHẤT của cả đoạn chat. */
  const loa = useRef<HTMLAudioElement>(null);
  /** Màn điện thoại dọc — thanh tiêu đề dùng mặt nhỏ hơn. */
  const doc = usePortraitScreen();
  /** Câu đang nằm trên loa. `null` = chưa nạp câu nào. */
  const [seqPhat, setSeqPhat] = useState<number | null>(null);
  const [dangChay, setDangChay] = useState(false);
  const [viTri, setViTri] = useState(0);
  const [conLai, setConLai] = useState(0);

  /**
   * MỞ KHOÁ thẻ loa bằng cú chạm đầu tiên vào bảng.
   *
   * Phát một đoạn im lặng cực ngắn rồi dừng ngay — người dùng không nghe thấy
   * gì, nhưng trình duyệt ghi nhận "thẻ này đã được người dùng cho phép", và
   * từ đó mọi lệnh phát của chương trình đều được chấp nhận.
   *
   * Chạy trong CHÍNH trình xử lý sự kiện chạm: Safari chỉ tính khi `play()`
   * được gọi đồng bộ bên trong cử chỉ, hẹn giờ một nhịp là mất hiệu lực.
   */
  const daMoKhoa = useRef(false);
  /**
   * Đếm số lần `phat()` được gọi. Mở khoá xong thì chỉ DỪNG loa nếu trong lúc
   * đó không ai xin phát thật — xem `moKhoa`.
   */
  const lanPhat = useRef(0);
  const moKhoa = useCallback(() => {
    const el = loa.current;
    if (!el || daMoKhoa.current) return;
    daMoKhoa.current = true;
    // ĐANG ĐỌC thì loa đã mở sẵn rồi — không đụng vào. Bản trước vẫn chạy
    // play→pause ở đây, và cú chạm đầu tiên vào màn hình cắt ngang câu hỏi
    // đang tự đọc.
    if (!el.paused) return;
    const truoc = lanPhat.current;
    const viTriCu = el.currentTime;
    if (!el.src) el.src = IM_LANG;
    // Câm trong lúc mở khoá: loa có thể đang nạp một câu thật đang tạm dừng,
    // và phát "thử" nó dù vài mili-giây cũng là một tiếng bật nghe thấy.
    el.muted = true;
    void el
      .play()
      .then(() => {
        el.muted = false;
        // Trong lúc chờ, có người xin phát thật (cú chạm này cũng là cú chạm
        // "hẹn lại" của `phat()`) — để yên cho nó đọc.
        if (lanPhat.current !== truoc) return;
        el.pause();
        el.currentTime = viTriCu;
      })
      .catch(() => {
        el.muted = false;
        // Trình duyệt vẫn từ chối. Không sao: `phat()` còn lớp hẹn-lại phía
        // dưới, và lần chạm sau sẽ thử mở khoá lại.
        daMoKhoa.current = false;
      });
  }, []);

  /**
   * Tắt mọi thẻ KHÁC. Gọi khi một thẻ vừa bắt đầu phát.
   *
   * Tách khỏi `phat()` và KHÔNG đụng vào thẻ đang phát: gộp lại thì cú bấm Play
   * của người dùng sẽ chạy vào nhánh `currentTime = 0`, và mỗi lần tua tới rồi
   * bấm tiếp là bài đọc nhảy về đầu.
   */
  //
  // MỘT thẻ thì luật "một tiếng tại một lúc" thành hiển nhiên: nạp câu mới là
  // câu cũ dừng. Không còn gì để đi tắt hộ ai.


  /**
   * IM HẾT — không chừa thẻ nào.
   *
   * Chỉ `pause()`, không đưa `currentTime` về 0: câu vừa bị cắt ngang vẫn nằm
   * đó trong đoạn chat, và học sinh bấm lại là nghe tiếp từ đúng chỗ đang dở
   * chứ không phải nghe lại từ đầu.
   */
  const imHet = useCallback(() => {
    const el = loa.current;
    if (el && !el.paused) el.pause();
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
  const phat = useCallback((seq: number) => {
    const el = loa.current;
    const src = nguon.current.get(seq);
    if (!el || !src) return;
    lanPhat.current += 1;
    el.muted = false;

    // Chỉ nạp lại khi ĐỔI câu: gán `src` bằng đúng giá trị đang có vẫn làm
    // trình duyệt tải lại và về giây 0, nên bấm tiếp một câu đang tạm dừng sẽ
    // nhảy về đầu thay vì nghe tiếp.
    if (!el.src.endsWith(src)) {
      el.src = src;
      el.currentTime = 0;
    }
    setSeqPhat(seq);

    void el.play().catch(() => {
      // Trình duyệt vẫn chặn (chưa có cú chạm nào). HẸN LẠI: chạm tiếp theo
      // vào trang, dù chạm vào đâu, là phát. Một lần duy nhất, gỡ ngay sau đó.
      const lai = () => {
        window.removeEventListener("pointerdown", lai);
        window.removeEventListener("keydown", lai);
        lanPhat.current += 1;
        el.muted = false;
        void el.play().catch(() => undefined);
      };
      window.addEventListener("pointerdown", lai, { once: true });
      window.addEventListener("keydown", lai, { once: true });
    });
  }, []);

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
      // MỞ KHOÁ thẻ loa ngay ở cú chạm ĐẦU TIÊN vào bảng — xem `moKhoa`. Đặt
      // ở khung ngoài cùng để chạm vào đâu cũng tính: bấm một phương án, kéo
      // thanh cuộn, chạm vào bong bóng. Sau đó mọi câu tự phát đều qua.
      onPointerDownCapture={moKhoa}
      className="q-board pointer-events-auto relative flex h-full max-h-full w-full max-w-3xl flex-col"
      // Tên theme lên DOM để `globals.css` chỉnh RIÊNG theme đó ở màn dọc
      // (viền vàng mỏng lại…) — biến theme đặt inline, nên chỉ một luật CSS
      // `!important` trong media query mới ghi đè được.
      data-q-theme={layout.theme ?? "classic"}
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
        // Cỡ chữ bong bóng + đáp án do người dựng đặt. Không đặt = không có
        // biến, và hai chỗ ấy rơi về cỡ mặc định của hướng.
        ...(textPx(layout) !== null && { "--q-text": `${textPx(layout)}px` }),
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
        // Màn DỌC: thanh tiêu đề thấp lại — mặt nhỏ hơn, đệm dọc mỏng hơn.
        // Mỗi pixel ở đây là một pixel lấy khỏi đoạn chat.
        className="relative z-10 flex shrink-0 items-center gap-2.5 px-3 py-2 backdrop-blur-sm [@media(orientation:portrait)_and_(pointer:coarse)]:gap-2 [@media(orientation:portrait)_and_(pointer:coarse)]:py-1"
        style={{
          background: "var(--q-header-bg, rgba(4,18,31,0.35))",
          borderBottom: "1px solid var(--q-header-line, rgba(255,255,255,0.10))",
        }}
      >
        <Face actor={npc} role="npc" pose={npcPose} name={npcName} size={doc ? 30 : undefined} />
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
            nguon={nguon.current}
            active={seqPhat === line.seq}
            playing={seqPhat === line.seq && dangChay}
            pos={seqPhat === line.seq ? viTri : 0}
            left={seqPhat === line.seq ? conLai : 0}
            onToggle={() => {
              moKhoa();
              const el = loa.current;
              if (seqPhat === line.seq && el && !el.paused) el.pause();
              else phat(line.seq);
            }}
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
        // MÀN DỌC: trần 46%, đệm dọc mỏng hơn. Từng lên 60% để bốn phương án
        // lọt hết không cuộn — nhưng khi ấy vùng hội thoại chỉ còn một khe,
        // mà đó là thứ đáng đọc. Phương án đã gọn lại (xem `renderers.tsx`);
        // câu nào dài quá thì khung này cuộn, nút Trả lời vẫn dính đáy.
        //
        // Bản trước hạ trần xuống 32% để chừa chỗ cho đoạn chat — và chính
        // nó buộc phải cuộn: bốn phương án cộng hàng nút không bao giờ lọt vào
        // một phần ba màn hẹp. Giờ phương án đã gọn lại (xem `renderers.tsx`),
        // nên nới trần ra là đủ chỗ cho cả bộ. Đoạn chat vẫn thấy câu hỏi: nó
        // tự cuộn về đáy, tức về đúng câu mới nhất.
        //
        // Hàng nút vẫn DÍNH ĐÁY (`sticky` ở `QuestPanel`): câu nào có sáu
        // phương án dài thì vẫn cuộn, và lúc đó nút Trả lời không bị đẩy đi.
        className="relative z-10 max-h-[45%] shrink-0 overflow-y-auto px-3 py-2.5 backdrop-blur-sm [@media(orientation:portrait)_and_(pointer:coarse)]:max-h-[46%] [@media(orientation:portrait)_and_(pointer:coarse)]:py-0"
        style={{
          background: "var(--q-bar-bg, rgba(4,18,31,0.35))",
          borderTop: "1px solid var(--q-bar-line, rgba(255,255,255,0.10))",
        }}
      >
        {answer}
      </div>
      </div>
      {/* THẺ LOA DUY NHẤT của cả đoạn chat — xem `nguon`.
          `preload="none"`: không tải gì cho tới khi thật sự phát. */}
      <audio
        ref={loa}
        preload="none"
        className="hidden"
        onPlay={() => {
          setDangChay(true);
          onPlayingChange?.(true);
        }}
        onPause={() => {
          setDangChay(false);
          onPlayingChange?.(false);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          const tong = Number.isFinite(el.duration) ? el.duration : 0;
          setViTri(tong > 0 ? el.currentTime / tong : 0);
          setConLai(Math.max(0, Math.ceil(tong - el.currentTime)));
        }}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          setConLai(Number.isFinite(el.duration) ? Math.ceil(el.duration) : 0);
          setViTri(0);
        }}
        onEnded={() => {
          setDangChay(false);
          setViTri(0);
          onPlayingChange?.(false);
          if (seqPhat !== null) onAudioEnded?.(seqPhat);
        }}
      />
    </section>
  );
}

/** Một dòng trong đoạn chat: mặt + bong bóng, căn trái hoặc căn phải. */
function Row({
  line,
  urls,
  face,
  nguon,
  active,
  playing,
  pos,
  left,
  onToggle,
  extras,
}: {
  line: ChatLine;
  urls: Record<string, string>;
  face: ReactNode;
  /** Sổ nguồn tiếng theo `seq` — bong bóng ghi đường dẫn của mình vào đây. */
  nguon: Map<number, string>;
  /** Câu này có đang nằm trên loa không. */
  active: boolean;
  playing: boolean;
  /** Tiến độ 0…1 và số giây còn lại — chỉ có nghĩa khi `active`. */
  pos: number;
  left: number;
  onToggle: () => void;
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
            nguon={nguon}
            playing={playing}
            pos={active ? pos : 0}
            left={active ? left : 0}
            onToggle={onToggle}
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
        // Màn DỌC: bong bóng rộng hơn — ở 72% của một tấm bảng 390px trừ mặt,
        // viền và đệm, mỗi dòng chỉ còn vài chữ và câu hỏi thành một cột dài.
        className={`flex max-w-[72%] min-w-0 flex-col [@media(orientation:portrait)_and_(pointer:coarse)]:max-w-[84%] ${
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
                // Cỡ chữ = `--q-text` (người dựng chỉnh), CÙNG biến với chữ
                // của các phương án. Mặc định 0,95rem ngang, 0,875rem dọc.
                className="text-[length:var(--q-text,0.95rem)] leading-snug whitespace-pre-wrap [@media(orientation:portrait)_and_(pointer:coarse)]:text-[length:var(--q-text,0.875rem)]"
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
/**
 * Một đoạn WAV IM LẶNG cực ngắn, chỉ để MỞ KHOÁ thẻ loa.
 *
 * 44 byte header + không có mẫu nào: trình duyệt phát xong trong chớp mắt,
 * người dùng không nghe thấy gì, nhưng thẻ đã được đánh dấu "người dùng cho
 * phép" và mọi lệnh phát sau đó đều qua.
 */
const IM_LANG =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

function TinyAudio({
  src,
  seq,
  nguon,
  playing,
  pos,
  left,
  onToggle,
}: {
  src: string;
  seq: number;
  nguon: Map<number, string>;
  playing: boolean;
  /** Tiến độ 0…1 và số giây còn lại của CHÍNH câu này. */
  pos: number;
  left: number;
  onToggle: () => void;
}) {
  /**
   * Thẻ `<audio>` ĐÃ ĐI KHỎI ĐÂY — cả đoạn chat dùng chung một cái.
   *
   * Mỗi bong bóng một thẻ riêng thì trên iPhone chỉ thẻ nào được chạm mới phát
   * được, và câu đến sau bằng hẹn giờ luôn im. Xem `nguon` / `loa` ở
   * `QuestChat`. Ở đây chỉ còn phần NHÌN: cái nút và thanh thời gian.
   */
  useEffect(() => {
    nguon.set(seq, src);
    return () => {
      nguon.delete(seq);
    };
  }, [nguon, seq, src]);

  /**
   * Con trỏ đang ở trên khối này.
   *
   * Bằng STATE chứ không bằng `group-hover` của CSS: lớp nhóm có tên
   * (`group/au`) chỉ tồn tại nếu Tailwind gom được nó lúc dựng, và nếu không
   * thì thanh thời gian im lặng không bao giờ mở ra — một cái hỏng không có
   * dấu hiệu nào ngoài việc rê chuột vào thấy không có gì xảy ra. Đã gặp thật.
   */
  const [hover, setHover] = useState(false);
  const mo = hover || playing;

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
        onClick={onToggle}
        aria-label={src}
        className="grid size-6 shrink-0 place-items-center rounded-full bg-black/25 text-[11px] transition hover:bg-black/40 [@media(pointer:coarse)]:size-8"
      >
        <span aria-hidden>{playing ? "⏸" : "🔊"}</span>
      </button>

      {/* Thanh thời gian chỉ mở khi RÊ TỚI hoặc ĐANG PHÁT — xem `mo`. Luôn
          hiện thì mỗi bong bóng có tiếng đều kéo theo một thanh xám, và đoạn
          chat trông như một danh sách tệp. */}
      <span
        className={`flex items-center gap-1.5 overflow-hidden transition-[width,opacity] ${
          mo ? "w-24 opacity-100" : "w-0 opacity-0"
        }`}
      >
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-black/25">
          <span
            className="block h-full rounded-full bg-current opacity-70"
            style={{ width: `${Math.round(pos * 100)}%` }}
          />
        </span>
        <span className="shrink-0 font-mono text-[9px] tabular-nums opacity-70">
          {mmss(left)}
        </span>
      </span>
    </span>
  );
}

/** Giây thành `m:ss`. Chữ số đều bề ngang (`tabular-nums`) nên không nhảy. */
function mmss(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

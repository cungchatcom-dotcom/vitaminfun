"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { QuestionRenderer } from "@/components/question/renderers";
import { Button } from "@/components/ui/button";
import {
  answerAudio,
  answerText,
  pickDistinct,
  promptOf,
  stripPrompt,
} from "@/game/npc-voice";
import { gapMs, holdMs, readDialogue, typingMs } from "@/game/dialogue";
import { themeVars } from "@/game/dialogue-theme";
import { ApiError } from "@/lib/api-error";
import { pickText } from "@/lib/i18n-text";
import { questLabel } from "@/lib/quest-label";

import { Face, QuestChat, type ChatLine, type NewChatLine } from "./quest-chat";
import { actorImageUrl } from "./quest-dialogue";

import type { QuestionResponse } from "@/components/question/types";
import type {
  DialogueActor,
  QuestProgress,
  SnapshotQuest,
  SnapshotQuestion,
} from "@/lib/play";
import { dialoguePoses } from "@/game/character";

/** Kết quả một lần nộp, đã kèm tiến độ từng câu vừa chấm. */
export interface SubmitResult {
  result: { quest_completed: boolean };
  questions: QuestProgress["questions"];
}

/**
 * TÁM KHOẢNH KHẮC người canh giữ lên tiếng.
 *
 * Bốn cái cuối trước đây IM LẶNG hoàn toàn — học sinh trả lời đúng thì câu hỏi
 * sau hiện ra không một lời nối, và làm xong cả nhiệm vụ thì chỉ có đúng một
 * câu "Hết rồi đấy" dùng chung cho cả đạt lẫn không đạt.
 *
 * Khoá ở đây là khoá trong `worlds.verdict_json`. Mỗi khoá lùi về một danh sách
 * câu mặc định trong `messages/` khi world chưa soạn bộ riêng.
 */
const FALLBACK = {
  greet: ["greet1", "greet2", "greet3"],
  praise: ["praise1", "praise2", "praise3", "praise4", "praise5"],
  wrong: ["wrong1", "wrong2", "wrong3", "wrong4"],
  moveOn: ["moveOn1", "moveOn2", "moveOn3"],
  next: ["next1", "next2", "next3"],
  passed: ["passed1", "passed2", "passed3"],
  failed: ["failed1", "failed2", "failed3"],
  revisit: ["revisit1", "revisit2", "revisit3"],
} as const;

export type VerdictGroup = keyof typeof FALLBACK;

/**
 * Trần chờ tiếng, mili-giây.
 *
 * Chờ tiếng nói xong là đúng, nhưng chờ MÃI thì không: trình duyệt có thể chặn
 * tự phát, tệp có thể hỏng, mạng có thể đứt giữa chừng. Quá ngần này thì đi
 * tiếp — một cuộc trò chuyện đứng im vĩnh viễn là hỏng nặng hơn hai câu chồng
 * lên nhau.
 */
const AUDIO_CAP_MS = 12_000;

/**
 * HỘI THOẠI VỚI NGƯỜI CANH GIỮ (S5).
 *
 * Mỗi nhiệm vụ là một cuộc nói chuyện, không phải một tờ bài tập. Người canh
 * giữ hỏi, học sinh trả lời, người canh giữ nói đúng hay sai rồi hỏi tiếp.
 *
 * Component này QUYẾT; `QuestDialogue` VẼ. Cùng ranh giới với `StagePlay` và
 * `PhaserCanvas`, và cùng lý do: đổi bố cục không phải đụng vào luật chơi.
 *
 * ## Luật một câu
 *
 * | | nhiệm vụ NPC | nhiệm vụ thường |
 * |---|---|---|
 * | sai bao nhiêu lần cũng được | ✓ | ✗ — `maxAttemptsPerQuestion`, mặc định 2 |
 * | hết lượt | không có "hết" | người canh giữ chuyển câu, câu đó 0 điểm |
 *
 * Nhiệm vụ NPC không giới hạn vì không qua nó thì cả màn đứng lại — server
 * cưỡng chế bằng `not is_gate`, ở đây chỉ đọc `attempts_left === null`.
 *
 * **Người canh giữ KHÔNG BAO GIỜ nói đáp án**, kể cả khi hết lượt. Ba bạn ngồi
 * cạnh có thể chưa làm tới câu đó, và một đáp án đọc được là một lần chơi lại
 * mất nghĩa.
 *
 * ## Vào lại giữa chừng
 *
 * Không có bảng nào lưu khung chat. Câu đang hỏi suy từ `progress`; nếu câu đó
 * đã thử mà chưa đúng thì dựng lại luôn bong bóng của học sinh (từ bản nháp) và
 * lời chê — chọn theo `hash(question_id, attempts_used)`, nên vào lại thấy đúng
 * câu người canh giữ đã nói, không phải một câu khác cùng nghĩa.
 */
export function QuestPanel({
  quest,
  progress,
  advisorLabel,
  advisorNpc,
  cluebook,
  advisorOutro,
  advisorOutroAudio,
  advisorOutroShowTranscript,
  dialogue,
  dialogueUrls,
  playerName,
  player,
  variantSeed,
  onLoadDialogue,
  onAppendDialogue,
  onSaveDraft,
  onSubmitQuest,
  onRetryQuest,
  onBuyHint,
  hintCost,
  energy,
  onClose,
  onTypingChange,
}: {
  quest: SnapshotQuest;
  progress: QuestProgress | undefined;
  advisorLabel: string;
  /**
   * NGƯỜI GÁC CỔNG — nhân vật của nhiệm vụ NPC, người phải qua trước.
   *
   * Khác `quest.npc`: cái đó là người canh giữ nhiệm vụ ĐANG bấm vào. Tấm khoá
   * nhắc tên người gác cổng, nên mặt hiện ra cũng phải là mặt người ấy — hiện
   * nhầm mặt là chỉ sai đường.
   */
  advisorNpc: DialogueActor | null;
  cluebook: string;
  advisorOutro: string;
  advisorOutroAudio: string | null;
  advisorOutroShowTranscript: boolean;
  /** Bố cục hội thoại, đã đóng băng trong đề bài. `{}` = dùng mặc định. */
  dialogue: unknown;
  /** URL ảnh nền từng khối, cũng đã đóng băng. */
  dialogueUrls: Record<string, string>;
  playerName: string;
  /** Nhân vật học sinh đã chọn, kèm mọi tư thế đã tải. `null` = chưa chọn. */
  player: DialogueActor | null;
  /**
   * Hạt giống ĐỔI THEO LƯỢT CHƠI và THEO NGƯỜI CHƠI — thường là `run.id:user.id`.
   *
   * Cố định suốt một lượt (vào lại giữa chừng vẫn nghe đúng câu đã nghe), nhưng
   * khác ở lượt sau và khác giữa hai người. Thiếu nó thì cả lớp chơi một nhiệm
   * vụ đều nghe y hệt một dãy câu, và chơi lại lần thứ năm vẫn dãy ấy.
   */
  variantSeed: string;
  /** Đọc cả đoạn chat đã lưu của nhiệm vụ này. */
  onLoadDialogue: () => Promise<ChatLine[]>;
  /** Ghi thêm mấy câu vừa nói, nhận về cả đoạn chat. */
  onAppendDialogue: (lines: NewChatLine[]) => Promise<ChatLine[]>;
  onSaveDraft: (
    questionId: string,
    response: Record<string, unknown> | null,
  ) => Promise<void>;
  /** Mua một gợi ý. Trả về chính đoạn chữ vừa mua. */
  onBuyHint: (questionId: string, kind: HintKind) => Promise<string>;
  /** Giá một lần xin giúp, tính bằng năng lượng. Đọc từ `balance_json` của world. */
  hintCost: number;
  /**
   * Năng lượng người chơi còn lại.
   *
   * Cần ở đây để KHOÁ nút trước khi bấm. Để họ bấm rồi mới báo "không đủ" là
   * bắt người đang bí phải thử mới biết — mà cái họ đang thử lại là thứ tốn
   * tiền.
   */
  energy: number;
  onSubmitQuest: () => Promise<SubmitResult>;
  /**
   * LÀM LẠI nhiệm vụ này từ đầu. Chỗ gọi lo việc gọi mạng và dựng lại bảng.
   *
   * Không trả về gì: làm lại xong thì chính cái bảng này bị gỡ đi và dựng mới,
   * nên ở đây không còn ai để mà đọc kết quả nữa.
   */
  onRetryQuest: () => Promise<void>;
  onClose: () => void;
  onTypingChange: (typing: boolean) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();

  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [typing, setTyping] = useState(false);
  /**
   * CẢ đoạn chat, cũ nhất trước — nguồn duy nhất của màn hình này.
   *
   * Trước đây là hai ô tạm (`playerLine`, `verdict`) mỗi ô giữ đúng câu mới
   * nhất rồi tự xoá sau vài giây. Giờ không câu nào bị xoá: cuộn lên là đọc lại
   * được cả cuộc trò chuyện, và đó là cả điểm của lần sửa này.
   */
  const [lines, setLines] = useState<ChatLine[]>([]);
  /** Giọng của câu phán MỚI NHẤT — chỉ để chọn tư thế nhân vật. */
  const [tone, setTone] = useState<"praise" | "wrong" | null>(null);

  /**
   * Đã chào xong chưa — CỔNG CHẶN đề bài đầu tiên.
   *
   * `daChao` là cái chốt riêng: `says()` chạy bất đồng bộ, và nếu chỉ nhìn
   * `greeted` thì hiệu ứng chạy lại trước khi câu chào kịp xong sẽ chào lần
   * thứ hai.
   */
  //: Đã nạp xong đoạn chat cũ chưa. Mọi câu nói đều chờ cờ này.
  const [loaded, setLoaded] = useState(false);
  const [greeted, setGreeted] = useState(false);
  const daChao = useRef(false);

  //: Người canh giữ đang giữa một lượt nói — xem `says()`.
  const [speaking, setSpeaking] = useState(false);

  //: Việc phải làm SAU KHI nghe HẾT câu vừa nói. `null` = không chờ ai.
  const choAudio = useRef<(() => void) | null>(null);

  /**
   * LỜI PHÁN: bộ câu của WORLD thắng bộ mặc định trong `messages/`.
   *
   * Bốc theo `hash(hạt giống)` ở cả hai đường, nên vào lại một lần thử cũ vẫn
   * nghe đúng câu đã nghe — đó là lý do `pickLine` tồn tại.
   *
   * Tiếng đi kèm tra theo CHÍNH đoạn chữ vừa bốc. Không có thì thôi: tiếng luôn
   * là tuỳ chọn, không bao giờ là điều kiện để cuộc trò chuyện đi tiếp.
   */
  /** Câu chê: RIÊNG của bài thắng, không có thì lấy bộ của world. */
  function wrongVerdict(
    q: SnapshotQuestion,
    attempt: number,
  ): { text: string; audio_url: string | null } {
    const own = (q.content as { wrong_answer_message?: string }).wrong_answer_message;
    if (own) return { text: own, audio_url: quest.verdict_audio?.[own] ?? null };
    // Cộng cả số lần thử: trả lời sai hai lần cùng một câu thì nghe hai câu chê
    // khác nhau, chứ không phải cùng một câu lặp lại ngay lập tức.
    return verdictOf("wrong", index * 3 + attempt);
  }

  function verdictOf(
    group: VerdictGroup,
    /**
     * Lần dùng thứ mấy của nhóm này TRONG nhiệm vụ.
     *
     * Thường là thứ tự câu hỏi. Nhờ nó mà mười biến thể dùng hết mười lần liên
     * tiếp mới quay lại câu đầu — xem `pickDistinct`.
     */
    ordinal: number,
  ): { text: string; audio_url: string | null } {
    const own = quest.verdict?.[group] ?? [];
    const text = own.length
      ? pickDistinct(own, `${variantSeed}:${quest.id}:${group}`, ordinal)
      : t(
          `game.npc.${pickDistinct(
            FALLBACK[group],
            `${variantSeed}:${quest.id}:${group}`,
            ordinal,
          )}`,
        );
    return { text, audio_url: quest.verdict_audio?.[text] ?? null };
  }
  const [finished, setFinished] = useState(false);
  const [dangLamLai, setDangLamLai] = useState(false);
  /**
   * Lần nộp vừa rồi HỎNG vì lý do gì.
   *
   * Trước đây lỗi ở đây bay thẳng ra ngoài thành một unhandled rejection: bong
   * bóng trả lời đã hiện, người canh giữ im bặt, nút Trả lời sáng lại, và không
   * có một dòng nào nói vì sao. Nhìn từ ghế người chơi thì đó là treo.
   */
  const [loiNop, setLoiNop] = useState<string | null>(null);
  /**
   * Mở lại một nhiệm vụ ĐÃ XONG TỪ TRƯỚC, chứ không phải vừa xong ngay bây giờ.
   *
   * Hai chuyện khác hẳn nhau dù màn hình gần giống: vừa xong thì còn phần
   * thưởng để nhận và lời chia tay để nghe; mở lại thì cả hai đã diễn ra rồi,
   * và diễn lại là phát phần thưởng lần thứ hai.
   */
  const [revisit, setRevisit] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, QuestionResponse | null>>(
    {},
  );

  // Nạp đoạn chat đã lưu NGAY khi mở bảng. Hỏng thì để trống rồi nói tiếp từ
  // đầu — mất lịch sử còn hơn không mở được bảng.
  useEffect(() => {
    let bo = false;
    onLoadDialogue().then(
      (rows) => {
        if (bo) return;
        // CHỈ nhận khi chưa có gì. Mạng chậm thì lịch sử về SAU câu đầu tiên
        // người canh giữ vừa nói, và ghi đè mù là xoá đúng câu ấy khỏi màn hình.
        setLines((truoc) => (truoc.length === 0 ? rows : truoc));
        setLoaded(true);
      },
      () => {
        // Hỏng thì vẫn mở cổng: mất lịch sử còn hơn một bảng câm.
        if (!bo) setLoaded(true);
      },
    );
    return () => {
      bo = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quest.id]);

  //: TRỢ GIÚP — ba cái nút dưới khung trả lời, và thứ chúng mở ra.
  //:
  //: Ở ĐÂY chứ không ở bong bóng: cả ba đều đổi trạng thái cuộc hội thoại (tư
  //: thế người canh giữ, chữ trong bong bóng, năng lượng còn lại), mà quyết
  //: định là việc của file này — `quest-dialogue.tsx` chỉ vẽ.
  //: Tấm ảnh người canh giữ lúc họ ĐANG NÓI — thứ phải hiện ra trước tiếng.
  const npcArt = actorImageUrl(quest.npc ?? null, "npc", "say");
  const [playing, setPlaying] = useState(false);

  /**
   * Gương của `lines` để đọc trong callback.
   *
   * `onAudioEnded` là một hàm sống lâu hơn một lượt vẽ; đọc thẳng `lines` trong
   * đó là đọc bản chụp của lượt vẽ đã đăng ký nó, tức bản CŨ.
   */
  const linesRef = useRef<ChatLine[]>([]);
  linesRef.current = lines;

  /**
   * Một câu vừa ĐỌC XONG — nếu đang chờ chính nó thì đi tiếp.
   *
   * Chỉ tin câu CUỐI của đoạn chat. Học sinh cuộn lên nghe lại một bong bóng cũ
   * thì tiếng ấy cũng kết thúc, mà chuyện đó không được đẩy cuộc trò chuyện đi.
   *
   * Bản trước chờ cờ `playing` chung, và cờ đó tắt ở MỌI lần tạm dừng — kể cả
   * lúc React dựng lại thẻ audio sau khi server trả về danh sách. Đo được: câu
   * chào lẽ ra chạy 7 giây thì câu hỏi đã chen vào sau 2,3 giây.
   */
  function onAudioEnded(seq: number) {
    const go = choAudio.current;
    if (!go) return;
    const cuoi = linesRef.current[linesRef.current.length - 1];
    if (!cuoi || cuoi.seq !== seq) return;
    choAudio.current = null;
    go();
  }
  //: Đoạn chữ ĐÃ MUA của câu đang hỏi. Thiếu khoá = chưa mua.
  const [bought, setBought] = useState<Partial<Record<HintKind, string>>>({});
  //: Cái nào đang mở. Mua rồi thì bật/tắt thoải mái, không mất thêm gì.
  const [shown, setShown] = useState<Partial<Record<HintKind, boolean>>>({});
  const [buying, setBuying] = useState<HintKind | null>(null);

  /** Bản nháp ĐÃ gửi lên, để không gửi lại y hệt. Không vẽ ra gì nên dùng ref. */
  const sent = useRef<Record<string, string>>({});
  /** Hẹn giờ đang treo — phải gỡ khi rời bảng, không thì `setState` vào hư không. */
  const timers = useRef<number[]>([]);

  const layout = readDialogue(dialogue);

  /**
   * NGHỈ bao lâu giữa hai lượt nói — người dựng đặt ở trình thiết kế hội thoại.
   *
   * Một con số, dùng cho CẢ HAI đường: câu không tiếng thì cộng vào sau quãng
   * đọc, câu có tiếng thì đếm từ lúc tiếng dứt. Trước đây đường có tiếng nghỉ
   * đúng 0 mili giây — nghe xong là câu sau rơi xuống ngay, hai lượt dính vào
   * nhau đúng chỗ đáng ra phải có một nhịp thở.
   */
  const nghi = gapMs(layout);
  const advisorLocked = progress?.locked ?? false;
  const isGate = quest.phase === "advisor";
  const question: SnapshotQuestion | undefined = quest.questions[index];
  const value = question ? (drafts[question.id] ?? null) : null;

  //: Tiếng người canh giữ ĐANG nói: đề bài, hoặc lời chia tay lúc xong nhiệm vụ.
  //:
  //: Mở LẠI một nhiệm vụ đã xong thì im lặng: lời chia tay đã nói rồi, và nói
  //: lại mỗi lần đi ngang qua thì nó thành một cái loa chứ không phải một câu
  //: chào. Chữ thì vẫn còn đó để đọc lại.
  const voiceUrl = finished
    ? revisit
      ? null
      : advisorOutroAudio
    : (question?.audio_url ?? null);
  const listening = Boolean(voiceUrl);
  //: Lời chia tay: chữ nằm sau nút, nhưng KHÔNG mất tiền. Nó không phải đề bài.
  const outro = finished && isGate ? advisorOutro : "";

  useEffect(() => {
    return () => {
      for (const id of timers.current) window.clearTimeout(id);
      timers.current = [];
    };
  }, []);

  /**
   * Vào bảng: nhảy tới câu đầu tiên CHƯA XONG VÀ CÒN LƯỢT, và dựng lại đúng
   * cuộc trò chuyện đang dở.
   *
   * "Còn lượt" là vế dễ quên: một câu đã hết lượt thì không phải chỗ để quay
   * lại — người canh giữ đã bỏ qua nó rồi.
   */
  useEffect(() => {
    const list = quest.questions;
    const next = list.findIndex((q) => open(progress, q.id));
    const at = next === -1 ? list.length : next;
    setIndex(at === list.length ? Math.max(0, list.length - 1) : at);
    setFinished(at === list.length);
    setRevisit(progress?.completed ?? false);

    const current = list[at];
    const seen = current
      ? progress?.questions.find((p) => p.question_id === current.id)
      : undefined;

    // Đã thử mà chưa đúng: lấy lại bản nháp để ô trả lời hiện đúng thứ họ đã
    // chọn.
    //
    // KHÔNG dựng lại bong bóng nào ở đây nữa. Trước đây phải dựng, vì không có
    // chỗ nào lưu những câu đã nói; giờ cả đoạn chat nằm ở server và vừa được
    // nạp ở trên — dựng thêm là nói lại một lần thứ hai những câu đã có sẵn
    // trong danh sách.
    if (current && seen && !seen.completed && seen.attempts_used > 0) {
      setDrafts((prev) => ({
        ...prev,
        [current.id]: (seen.draft ?? null) as QuestionResponse,
      }));
    }
    setTone(null);
  }, [quest.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Gửi bản nháp lên server, nếu nó thật sự đổi. */
  const flush = useCallback(
    async (questionId: string, next: QuestionResponse | null) => {
      // Nhiệm vụ đang khoá thì KHÔNG gửi gì: server trả `ADVISOR_LOCKED` và lời
      // từ chối ấy rơi ra thành unhandled rejection. Chặn ở đây, chỗ duy nhất
      // mọi đường gọi đi qua.
      if (advisorLocked) return;
      const json = JSON.stringify(next ?? null);
      if (sent.current[questionId] === json) return;
      sent.current[questionId] = json;
      await onSaveDraft(questionId, next as Record<string, unknown> | null);
    },
    [onSaveDraft, advisorLocked],
  );

  // Lưu thêm khi NGƯNG THAO TÁC một nhịp. Chuyển câu là mốc rõ ràng nhất nhưng
  // không đủ: một nhiệm vụ chỉ có MỘT câu thì không bao giờ có cú chuyển nào,
  // và cả mục đích của việc lưu nháp là chống tai nạn — mà tai nạn không đợi.
  useEffect(() => {
    if (!question) return;
    const timer = window.setTimeout(() => void flush(question.id, value), 800);
    return () => window.clearTimeout(timer);
  }, [question, value, flush]);

  // Sang câu khác là một câu hỏi khác: lời thoại đóng lại theo cờ của CÂU MỚI,
  // bản dịch quên đi (nó là bản dịch của câu cũ), và tiếng tự chạy.
  //
  // Bản dịch quên NHƯNG server vẫn nhớ đã bán: quay lại câu cũ thì bấm Dịch
  // một cái là hiện lại, không mất thêm năng lượng.
  useEffect(() => {
    setBought({});
    setShown({});
  }, [question?.id]);

  // Xong nhiệm vụ: gieo sẵn lời chia tay như một gợi ý ĐÃ MUA. Nhờ vậy cái nút
  // lời thoại dùng lại nguyên đường bật/tắt của câu hỏi, và không bao giờ gọi
  // server — nó không phải đề bài, không có gì để bán.
  useEffect(() => {
    if (!finished || !outro) return;
    setBought((before) => ({ ...before, transcript: outro }));
    // Mở LẠI thì luôn hiện: không còn cái nút nào để bật nó lên nữa, nên đóng
    // sẵn là một tấm bảng mở ra rồi im lặng.
    setShown((before) => ({
      ...before,
      transcript: revisit || advisorOutroShowTranscript,
    }));
  }, [finished, outro, revisit, advisorOutroShowTranscript]);

  /**
   * ĐỢI KHUÔN MẶT hiện ra rồi mới cho cất tiếng.
   *
   * Ảnh người canh giữ là một tấm PNG cả megabyte, tải mất một hai giây; tiếng
   * thì phát ngay. Không đợi thì giọng nói vang lên trước một khoảng trống, rồi
   * mặt mới hiện ra giữa câu — người nói xuất hiện sau lời nói của chính họ.
   *
   * Đợi ẢNH chứ không đợi một con số giây cố định: máy nhanh thì không phải chờ
   * vô cớ, máy chậm thì chờ đúng bằng thời gian nó cần.
   *
   * Việc PHÁT thì nằm ở `QuestChat`: trình phát duy nhất là cái nằm trong bong
   * bóng, và một thẻ `<audio>` thứ hai ở đây sẽ phát song song với nó.
   */
  const [canSpeak, setCanSpeak] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setCanSpeak(false);
    void whenLoaded(npcArt).then(() => {
      if (!cancelled) setCanSpeak(true);
    });
    return () => {
      cancelled = true;
    };
  }, [npcArt]);

  function later(ms: number, fn: () => void) {
    timers.current.push(window.setTimeout(fn, ms));
  }

  /**
   * LƯỚI AN TOÀN cho một lượt nói ĐANG CHỜ NGHE HẾT.
   *
   * Trình duyệt có thể chặn tự phát, tệp có thể hỏng, mạng có thể đứt giữa
   * chừng. Quá lâu thì đi tiếp — một cuộc trò chuyện đứng im vĩnh viễn là hỏng
   * nặng hơn hai câu chồng lên nhau.
   *
   * So `choAudio.current !== cua` trước khi bắn, và đây là phần QUAN TRỌNG.
   * Bản trước chỉ hỏi "có ai đang chờ không" rồi bắn — nên cái lưới của một
   * lượt ĐÃ XONG TỪ LÂU, khi tới hạn, lại cướp mất lượt đang chờ. Đo được thật:
   * câu chào nói xong lúc t=0, lưới của nó hẹn t=15.5s; tới t=8.9s học sinh nộp
   * bài, câu trả lời có tiếng dài 5.4s bắt đầu phát; t=15.5s lưới cũ bắn, người
   * canh giữ khen chen ngang giữa lúc em đang nói dở.
   */
  function luoiAnToan(cua: () => void, text: string) {
    later(holdMs(text, nghi) + AUDIO_CAP_MS, () => {
      if (choAudio.current !== cua) return;
      choAudio.current = null;
      cua();
    });
  }

  function close() {
    if (question) void flush(question.id, value);
    onClose();
  }

  /**
   * Người canh giữ NÓI một câu, TRỌN VẸN, rồi mới tới lượt thứ khác.
   *
   * Bốn nhịp, đúng thứ tự: gõ → hiện chữ → để người ta đọc → gỡ xuống. Chỉ khi
   * gỡ xuống xong mới gọi `after` — câu tiếp theo, câu hỏi tiếp theo, hay lời
   * chia tay.
   *
   * ## Vì sao phải nối tiếp
   *
   * Bản trước gọi `after` sau 700ms kể từ lúc chữ hiện ra, tức là trong khi câu
   * đang nói vẫn còn trên màn hình. Kết quả: lời chia tay của người canh giữ
   * hiện lên trong lúc lời khen của câu trước còn treo đó, rồi một hai giây sau
   * lời khen mới biến mất — hai bong bóng nói hai chuyện cùng lúc, và không cái
   * nào có vẻ là đang nói với ai.
   *
   * Một cuộc trò chuyện là những lượt NỐI TIẾP nhau. Hết cái này thì cái kia
   * mới hiện.
   *
   * Cái giá: giữa hai câu hỏi có một quãng nghỉ vài giây. Đó là quãng để đọc
   * lời khen, và nó đã được tính vào trần giờ của màn khi cân bằng.
   */
  /**
   * Người canh giữ NÓI một câu: hiện ba chấm, rồi tin nhắn rơi vào đoạn chat.
   *
   * Khác bản trước ở chỗ tin nhắn **Ở LẠI**. Trước đây mỗi câu phán treo vài
   * giây rồi tự xoá, vì chỉ có đúng một ô để treo nó. Giờ đoạn chat giữ hết, và
   * quãng chờ chỉ còn một việc: để người đọc kịp đọc trước khi câu sau hiện ra.
   */
  /**
   * QUÃNG NGHỈ giữa hai lượt — và BA CHẤM trong quãng ấy.
   *
   * Nghỉ một nhịp rồi mới tới lượt sau, nhưng nghỉ mà màn hình đứng im thì
   * trông như hỏng: học sinh vừa nghe xong một câu, không còn gì động đậy, và
   * chưa ai nói gì. Ba chấm lấp đúng khoảng ấy — nó nói "còn nữa, đợi tí".
   *
   * CHỈ khi thật sự còn lượt sau (`after`). Lời chê giữa chừng thì người nói
   * tiếp là HỌC SINH, không phải người canh giữ; hiện ba chấm ở đó là hứa một
   * câu không bao giờ tới.
   *
   * Tắt ba chấm TRƯỚC khi gọi `after`: nếu `after` mở một lượt nói mới thì
   * `says()` bật lại ngay trong cùng lượt vẽ, nên mắt không thấy nhịp nháy; còn
   * nếu không, ba chấm tắt đúng lúc phải tắt.
   */
  function ngung(after?: () => void) {
    if (after) setTyping(true);
    later(nghi, () => {
      setTyping(false);
      setSpeaking(false);
      after?.();
    });
  }

  function says(line: NewChatLine, after?: () => void) {
    // ĐANG TRONG MỘT LƯỢT NÓI.
    //
    // `typing` chỉ đúng ở nhịp ba chấm; sau khi bong bóng hiện ra thì nó tắt,
    // mà lượt nói CHƯA xong — còn quãng đọc, còn tiếng đang phát, còn câu hỏi
    // sau sắp tới. Trong quãng đó nút Trả lời vẫn bấm được, và bấm là nộp lại
    // một câu vừa trả lời đúng: một bong bóng trả lời thứ hai chen vào giữa lời
    // khen và câu hỏi tiếp theo.
    setSpeaking(true);
    setTyping(true);
    later(typingMs(line.text), () => {
      setTyping(false);
      setTone(line.tone ?? null);
      void push([line]);

      // CÓ TIẾNG thì chờ nghe hết mới sang bong bóng sau.
      //
      // Không chờ thì câu tiếp theo hiện ra đè lên tiếng đang nói, và hai câu
      // chồng nhau — đúng cái mà nhịp "hết cái này mới tới cái kia" dựng lên để
      // tránh. Quãng chờ theo độ dài chữ chỉ đúng khi KHÔNG có tiếng.
      if (line.audio_url) {
        // Tiếng dứt rồi vẫn NGHỈ một nhịp. Nghe xong mà câu sau rơi xuống ngay
        // thì hai lượt dính liền, không ai kịp ngẫm câu vừa nghe.
        const xong = () => ngung(after);
        choAudio.current = xong;
        luoiAnToan(xong, line.text);
        return;
      }

      // Không tiếng: quãng ĐỌC trước, rồi mới tới quãng nghỉ. Gộp hai cái làm
      // một thì ba chấm hiện ngay từ lúc chữ vừa rơi xuống — tức là giục người
      // ta trong chính lúc bảo họ đọc.
      later(holdMs(line.text, 0), () => ngung(after));
    });
  }

  /**
   * Ghi mấy câu vào đoạn chat: hiện NGAY ở máy, rồi mới gửi đi.
   *
   * Chờ mạng trả lời mới vẽ thì mỗi câu nói có một quãng lặng trước nó, và cuộc
   * trò chuyện nghe như đường truyền chứ không như một người đang nói. Gửi xong
   * thì thay bằng bản của server — server mới là nơi đánh số thứ tự.
   */
  /**
   * XẾP HÀNG các lượt ghi. Một lúc chỉ MỘT yêu cầu đang bay.
   *
   * Server tự đánh số thứ tự bằng `max(seq) + 1` dưới một ràng buộc duy nhất.
   * Hai yêu cầu chồng nhau thì cả hai đọc ra cùng một `max`, cùng xin một số,
   * và cái tới sau bị database từ chối — câu ấy không bao giờ được ghi.
   *
   * Ngay cả khi không đụng số, chồng nhau vẫn hỏng theo cách khác: mỗi lượt ghi
   * trả về CẢ đoạn chat, nên cái trả lời CHẬM hơn sẽ ghi đè danh sách bằng một
   * bản CŨ hơn — và câu vừa hiện ra biến mất khỏi màn hình dù server vẫn giữ
   * nó. Tải lại trang là thấy. Đúng triệu chứng "trả lời xong, người canh giữ
   * im bặt".
   *
   * Nối đuôi bằng một chuỗi promise là đủ: số lượt ghi của một cuộc trò chuyện
   * đếm bằng chục, không phải bằng nghìn.
   */
  const hangDoi = useRef<Promise<void>>(Promise.resolve());

  async function push(batch: NewChatLine[]) {
    if (batch.length === 0) return;
    setLines((before) => {
      const after = [...before];
      for (const line of batch) {
        // ĐỀ BÀI thì SỬA tại chỗ, không nối thêm — cùng luật với server. Nối
        // thêm rồi đợi server trả về bản gộp thì mắt kịp thấy một bong bóng
        // thứ hai loé lên rồi biến mất.
        const cu =
          line.kind === "prompt" && line.question_id
            ? after.findIndex(
                (l) => l.kind === "prompt" && l.question_id === line.question_id,
              )
            : -1;
        if (cu >= 0) after[cu] = { ...after[cu]!, ...line };
        else after.push({ ...line, seq: (after[after.length - 1]?.seq ?? -1) + 1 });
      }
      return after;
    });
    const minh = hangDoi.current.then(
      async () => {
        try {
          setLines(await onAppendDialogue(batch));
        } catch {
          // Ghi hỏng thì vẫn giữ bản ở máy: học sinh đang giữa cuộc trò chuyện,
          // và xoá câu vừa hiện ra vì một lỗi mạng là tệ hơn một đoạn chat
          // thiếu một dòng khi vào lại.
        }
      },
      () => undefined,
    );
    hangDoi.current = minh;
    await minh;
  }

  /**
   * Nhãn hiện khi rê chuột lên một nút gợi ý.
   *
   * Cái GIÁ nằm ngay trong nhãn, không nằm trong một hộp xác nhận. Người ta rê
   * chuột lên một cái nút lạ trước khi bấm nó — đó là lúc câu "tốn 2 năng
   * lượng" có ích, chứ không phải sau khi họ đã bấm.
   *
   * Mua rồi thì nhãn về lại tên thường: nói giá của một thứ đã trả tiền chỉ làm
   * người ta tưởng mình sắp mất thêm.
   */
  function hintLabel(kind: HintKind): string {
    const name = t(
      `game.assist.${kind === "translation" ? "translate" : "transcript"}`,
    );
    if (bought[kind] !== undefined || cost === 0) return name;
    if (energy < cost) return t("game.assist.poor", { cost });
    return t("game.assist.cost", { name: name.toLowerCase(), cost });
  }

  /**
   * Bấm một nút gợi ý.
   *
   * Mua rồi thì chỉ là BẬT/TẮT — không gọi server, không trừ gì. Chưa mua thì
   * trừ NGAY, không hỏi lại: cái giá đã nằm trong nhãn hiện lên khi rê chuột,
   * và một hộp xác nhận cho một hành động 2 năng lượng là bắt người đang bí
   * phải bấm hai lần cho một quyết định họ vừa đọc xong.
   *
   * Không cần bắt lỗi "không đủ năng lượng": nút đã bị khoá từ trước khi bấm.
   */
  async function useHint(kind: HintKind) {
    if (!question || buying) return;
    if (bought[kind] !== undefined) {
      setShown((before) => ({ ...before, [kind]: !before[kind] }));
      return;
    }
    setBuying(kind);
    try {
      const text = await onBuyHint(question.id, kind);
      setBought((before) => ({ ...before, [kind]: text }));
      setShown((before) => ({ ...before, [kind]: true }));
    } finally {
      setBuying(null);
    }
  }

  /**
   * ĐÃ QUA ẢI chưa — đọc từ server, vòng TỐT NHẤT.
   *
   * Khác hẳn `finished`, vốn chỉ nói "đã đi hết các câu". Một lượt trả lời sai
   * hết vẫn `finished`, và gọi đó là hoàn thành thì cái nhãn ấy không còn nghĩa
   * gì nữa.
   */
  const daQuaAi = progress?.completed ?? false;

  async function lamLai() {
    if (dangLamLai) return;
    setDangLamLai(true);
    try {
      // Tiếng đang phát thuộc về cuộc trò chuyện sắp bị xoá. Không tắt thì nó
      // đọc nốt trên nền một bảng đã dựng lại từ đầu.
      imHet.current?.();
      await onRetryQuest();
    } finally {
      setDangLamLai(false);
    }
  }

  /**
   * CỠ vòng tròn mặt người gác cổng — ĐO từ chính cái ô chứa nó.
   *
   * `Face` cắt phần đầu ra khỏi spritesheet bằng phép tính theo PIXEL, nên nó
   * cần một con số thật, không nhận được `100%`. Viết cứng một con số thì vòng
   * tròn chỉ vừa ở đúng một bề rộng màn hình: rộng hơn thì nó lọt thỏm giữa ô,
   * hẹp hơn thì nó tràn ra ngoài.
   *
   * Lấy cạnh NGẮN hơn: ô này cao bằng cột chữ bên phải, mà cột ấy dài ngắn tuỳ
   * lời nhắn — lấy bề rộng thì gặp một lời nhắn ngắn là vòng tròn trồi ra khỏi
   * ô.
   */
  const oAvatar = useRef<HTMLDivElement>(null);
  const [coAvatar, setCoAvatar] = useState(96);

  useEffect(() => {
    const el = oAvatar.current;
    if (!el) return;
    const doLai = () => {
      const r = el.getBoundingClientRect();
      setCoAvatar(Math.max(48, Math.round(Math.min(r.width, r.height))));
    };
    doLai();
    const theoDoi = new ResizeObserver(doLai);
    theoDoi.observe(el);
    return () => theoDoi.disconnect();
  }, [advisorLocked]);

  /**
   * KÉO TIÊU ĐIỂM VỀ TẤM BẢNG khi một nhiệm vụ đang khoá mở ra.
   *
   * Người chơi mở tấm bảng này bằng cách bấm vào vật thể TRÊN KHUNG HÌNH, nên
   * ngay sau cú bấm ấy tiêu điểm nằm ở thẻ `<canvas>` của Phaser — không phải
   * `body`, cũng không nằm trong `[data-quest-panel]`. Bộ bắt phím Enter ở cửa
   * sổ từ chối đúng trường hợp đó (và từ chối có lý: nếu không thì Enter ở bất
   * kỳ ô nhập nào ngoài bảng cũng nộp bài). Kết quả: Enter không đóng được tấm
   * bảng khoá, dù mã đóng đã nằm sẵn ở `nopBangEnter`.
   *
   * Đưa tiêu điểm vào nút Đóng là xong cả hai đường: Enter đi qua bộ bắt phím
   * được, mà kể cả không thì chính cái nút đang được chọn cũng tự nhận Enter.
   */
  const nutDong = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (advisorLocked) nutDong.current?.focus();
  }, [advisorLocked]);

  /** Tiếng của câu khoá — giấu đi, chỉ nút "Nghe lại" bên dưới chạm tới. */
  const oTiengKhoa = useRef<HTMLAudioElement>(null);

  /** Nút TẮT TIẾNG của đoạn chat, do chính `QuestChat` đưa ra. */
  const imHet = useRef<(() => void) | null>(null);

  /** Chấm câu đang nói, rồi đi tiếp hoặc nói lại. */
  async function answer() {
    if (pending || typing || speaking || !question) return;

    // NỘP LÀ CẮT LỜI.
    //
    // Đề bài được đẩy thẳng vào đoạn chat chứ không đi qua `says()`, nên trong
    // lúc tiếng đề bài còn đang đọc thì `speaking` vẫn tắt và nút Trả lời vẫn
    // bấm được — đúng như phải thế: nghe một hai câu đã biết đáp án thì không
    // có lý gì bắt ngồi nghe hết.
    //
    // Nhưng không tắt thì tiếng đề bài chạy tiếp, chồng lên lời khen sắp tới,
    // và hai giọng cùng nói. Nộp bài là tự mình khép lượt ấy lại.
    imHet.current?.();

    setPending(true);
    setLoiNop(null);
    try {
      await flush(question.id, value);

      /**
       * TIẾNG của chính câu trả lời, đọc bằng giọng nhân vật em đang chơi.
       *
       * Tra bằng `player.voice_id` chứ không chọn sẵn ở server: đề bài đóng
       * băng lúc bắt đầu lượt, còn nhân vật thì em đổi được giữa hai lượt — nên
       * server gửi xuống CẢ các giọng, ở đây mới biết em đang là ai.
       *
       * Không có bản thu thì `null`, và mọi thứ chạy y như cũ: tiếng cho phương
       * án luôn là TUỲ CHỌN.
       */
      const tiengTraLoi = answerAudio(
        question.type,
        value,
        player?.voice_id ? question.option_audio?.[player.voice_id] : null,
      );
      const chuTraLoi = answerText(question.type, question.content, value);

      await push([
        {
          role: "player",
          kind: "answer",
          text: chuTraLoi,
          question_id: question.id,
          audio_url: tiengTraLoi,
        },
      ]);

      // Hỏi SERVER câu vừa rồi đúng chưa, không tự đoán ở máy: đáp án chưa bao
      // giờ rời server, nên ở đây không có gì để mà đoán.
      const { questions, result } = await onSubmitQuest();
      const seen = questions.find((q) => q.question_id === question.id);
      const tried = seen?.attempts_used ?? 1;

      // Ô NHẬP TRẢ VỀ TRỐNG sau khi nộp.
      //
      // Câu vừa gõ đã nằm trong bong bóng của chính học sinh ngay phía trên —
      // giữ thêm một bản trong ô nhập là in cùng một câu hai lần. Và nếu sai
      // thì việc tiếp theo là gõ lại, mà gõ lại trên một ô còn nguyên chữ cũ
      // thì phải bôi đen xoá đi trước đã.
      //
      // CHỈ với câu gõ chữ. Câu chọn phương án thì cái tick chẳng vướng ai, mà
      // xoá đi là mất luôn dấu vết mình vừa chọn gì.
      //
      // Xoá SAU khi nộp, không phải trước: server chấm theo bản nháp đã lưu,
      // nên xoá sớm một nhịp là nộp một câu trả lời rỗng.
      if (question.type === "GAP_FILL" || question.type === "SHORT_ANSWER") {
        setDrafts((prev) => ({ ...prev, [question.id]: null }));
      }

      /** LỜI PHÁN — khen, bỏ qua, hay chê. */
      const phan = () => {
        if (seen?.completed) {
          says(
            {
              role: "npc",
              kind: "verdict",
              ...verdictOf("praise", index),
              tone: "praise",
              question_id: question.id,
            },
            () => advance(questions, result.quest_completed),
          );
          return;
        }

        // Hết lượt: chuyển câu, KHÔNG nói đáp án. `attempts_left === null` là
        // nhiệm vụ NPC — không có "hết lượt" ở đó.
        if (seen?.attempts_left === 0) {
          says(
            {
              role: "npc",
              kind: "verdict",
              ...verdictOf("moveOn", index),
              question_id: question.id,
            },
            () => advance(questions, result.quest_completed, false),
          );
          return;
        }

        says({
          role: "npc",
          kind: "verdict",
          ...wrongVerdict(question, tried),
          tone: "wrong",
          question_id: question.id,
        });
      };

      // CÂU TRẢ LỜI CÓ TIẾNG thì nghe hết đã, rồi người canh giữ mới phán.
      //
      // Cùng luật với lượt của người canh giữ, chỉ đổi vai: hai giọng cùng nói
      // một lúc thì không nghe ra câu nào. Không có tiếng thì phán ngay — đúng
      // như từ trước tới nay.
      //
      // `speaking` bật lên trong suốt quãng ấy: `pending` tắt ngay khi hàm này
      // trả về, mà lượt nói thì chưa xong, và nút Trả lời sáng lại giữa chừng là
      // nộp thêm một bong bóng chen vào giữa.
      if (tiengTraLoi) {
        setSpeaking(true);
        const xong = () => ngung(phan);
        choAudio.current = xong;
        luoiAnToan(xong, chuTraLoi);
        return;
      }

      phan();
    } catch (error) {
      // NÓI RA. Chấm bài là một lượt gọi mạng, và mạng thì hỏng — mất sóng một
      // nhịp, lượt chơi vừa hết giờ ở server. Im lặng ở đây là thứ người chơi
      // gọi là treo; một dòng chữ đỏ ít nhất nói rằng bấm lại là được.
      setLoiNop(error instanceof ApiError ? error.messageKey : "error.INTERNAL_ERROR");
      setSpeaking(false);
      setTyping(false);
    } finally {
      setPending(false);
    }
  }

  /**
   * ENTER khi TIÊU ĐIỂM ĐÃ RƠI MẤT.
   *
   * Phím Enter bắt ở cái `div` bọc dải đáp án, nên nó chỉ chạy khi tiêu điểm
   * còn nằm TRONG dải ấy. Mà mỗi lời phán là một lần vẽ lại: cái nút phương án
   * đang giữ tiêu điểm bị gỡ đi, trình duyệt trả tiêu điểm về `<body>`, và từ
   * đó phím Enter không còn đường nào tới chỗ nghe. Bấm mãi không một bong bóng
   * nào hiện ra — đúng cái mà người chơi gọi là TREO.
   *
   * Đã gặp thật: trả lời sai một câu, người canh giữ chê xong, bấm Enter để nộp
   * lại thì không có gì xảy ra, dù nút Trả lời vẫn sáng.
   *
   * Nghe ở CỬA SỔ, pha bắt, và nhận trong đúng ba trường hợp:
   *
   *   - không có gì giữ tiêu điểm (`<body>`), hay
   *   - tiêu điểm đang ở đâu đó TRONG bảng nhiệm vụ.
   *
   * Trừ ra: ô nhập chữ nhiều dòng (Enter ở đó là xuống dòng) và thanh tiêu đề
   * của bảng (Enter trên dấu ✕ phải là đóng bảng). Tiêu điểm ở ngoài bảng —
   * thanh điều hướng, một hộp thoại khác — thì Enter là việc của chỗ đó.
   *
   * Nới tới "trong bảng" vì nấc đầu chưa đủ: bấm cái loa của một bong bóng rồi
   * bấm Enter thì tiêu điểm đang nằm trên cái nút loa, không phải `<body>`, và
   * Enter lại rơi vào khoảng không. Đo được đúng như vậy trên máy thật.
   *
   * `preventDefault` nên Enter KHÔNG kích hoạt cái nút đang giữ tiêu điểm nữa:
   * trong bảng này, Enter luôn có nghĩa là NỘP.
   */
  const nopBangEnter = useRef<() => void>(() => {});
  nopBangEnter.current = () => {
    // NHIỆM VỤ ĐANG KHOÁ: tấm bảng chỉ có một việc, và Enter làm đúng việc ấy.
    // Không chặn ở đây thì nhánh dưới lặng lẽ bỏ qua vì không có gì để nộp —
    // tức là bấm Enter không có gì xảy ra, đúng cái người chơi gọi là hỏng.
    if (advisorLocked) {
      onClose();
      return;
    }
    // XONG NHIỆM VỤ thì Enter là NHẬN SỔ TAY / Đi tiếp — cùng cái nút đang sáng
    // ở góc phải. Bắt người ta gõ Enter suốt cả cuộc trò chuyện rồi tới câu cuối
    // lại phải với tay lấy chuột là bẻ gãy nhịp đúng ở chỗ dễ chịu nhất.
    //
    // Mở LẠI một nhiệm vụ đã xong thì KHÔNG có nút nào (dấu ✕ mới là đường ra),
    // nên Enter cũng không làm gì — đúng bằng thứ đang hiện trên màn hình.
    if (finished) {
      if (!revisit) close();
      return;
    }
    if (pending || typing || speaking || value == null) return;
    void answer();
  };

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Enter" || event.isComposing) return;
      if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;

      const dang = document.activeElement;
      const troi = !dang || dang === document.body || dang === document.documentElement;
      if (!troi) {
        if (dang instanceof HTMLTextAreaElement) return;
        if (dang.closest("[contenteditable='true']")) return;
        const bang = dang.closest("[data-quest-panel]");
        if (!bang) return;
        if (dang.closest("header")) return;
      }

      event.preventDefault();
      nopBangEnter.current();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  /** Sang câu chưa xong và còn lượt kế tiếp; không còn thì kết thúc hội thoại. */
  function advance(
    questions: QuestProgress["questions"],
    passed: boolean,
    /**
     * Có nói câu NỐI trước khi sang câu sau không.
     *
     * Vừa báo "bỏ qua, ta hỏi câu khác" rồi lại nói "câu tiếp nào" là hai câu
     * nói đúng một việc, dính liền nhau. Sau khi khen thì cần câu nối; sau khi
     * bỏ qua thì chính câu bỏ qua ĐÃ LÀ câu nối.
     */
    bridge = true,
  ) {
    const next = quest.questions.findIndex((q) => open({ questions }, q.id));
    // Không xoá gì cả: câu phán của câu trước Ở LẠI trong đoạn chat, đúng chỗ
    // nó đã được nói ra. Học sinh cuộn lên là đọc lại được.
    setTone(null);

    if (next === -1) {
      setFinished(true);
      // Người canh giữ CÓ lời chia tay thì đó đã là câu kết — nói thêm "hết rồi
      // đấy" nữa là hai bong bóng cùng nói một việc.
      if (!(isGate && advisorOutro)) {
        // ĐẠT hay KHÔNG ĐẠT là hai chuyện khác hẳn nhau, và trước đây dùng
        // chung đúng một câu. Học sinh làm xong mà chưa qua điểm sàn thì cần
        // nghe đúng điều đó, không phải một lời chúc mừng.
        says({
          role: "npc",
          kind: "outro",
          ...verdictOf(passed ? "passed" : "failed", index),
        });
      }
      return;
    }

    // VỪA BỎ QUA thì đi thẳng. Câu "ta hỏi câu khác" ĐÃ LÀ câu nối rồi; nói
    // thêm "câu tiếp nào" nữa là hai câu dính liền cùng báo một việc.
    //
    // Tham số `bridge` có từ đầu, kèm cả đoạn ghi chú giải thích vì sao — nhưng
    // thân hàm chưa bao giờ đọc tới nó. Chơi thử mới nghe ra: "Set it down. We
    // move on." rồi ngay sau là "Stay with me. Next.".
    if (!bridge) {
      setIndex(next);
      return;
    }

    // NỐI SANG CÂU SAU. Trước đây chỗ này im lặng: khen xong là đề bài mới hiện
    // ra, không một lời chuyển. Giữa hai người thì không ai nói chuyện kiểu đó.
    says({ role: "npc", kind: "verdict", ...verdictOf("next", index) }, () =>
      setIndex(next),
    );
  }

  // ---------------------------------------------------------------- vẽ ra

  // Chưa qua NPC. Bảng vẫn MỞ RA và nói vì sao, chứ không phải bấm vào thì
  // không có gì xảy ra — im lặng đọc ra là hỏng, không phải là luật chơi.
  if (advisorLocked) {
    /**
     * CÂU KHOÁ: của riêng nhiệm vụ này nếu người dựng đã soạn, không thì câu tự
     * sinh có nhắc tên người gác cửa.
     *
     * Câu tự sinh nói đúng việc cần nói, nhưng mười cánh cửa cùng đọc đúng một
     * dòng thì cánh thứ mười không còn là một nhân vật nói chuyện nữa.
     */
    const rieng = pickText(quest.locked_message_i18n ?? {}, locale);
    const loiKhoa = rieng || t("game.advisorLocked", { npc: advisorLabel });
    const tiengKhoa = rieng ? (quest.locked_audio?.[rieng] ?? null) : null;

    return (
      <section
        // Cùng dấu với bảng hội thoại: phím Enter bắt ở cửa sổ chỉ nhận khi tiêu
        // điểm còn nằm trong một tấm bảng của nhiệm vụ.
        data-quest-panel=""
        className="pointer-events-auto w-full max-w-lg"
        /**
         * MẶC ĐÚNG BỘ ÁO của màn. Trước đây tấm này dùng một bộ lớp riêng
         * (`bg-abyss-900/95`, viền `abyss-700`), nên đổi theme cho bảng hội
         * thoại xong mà đi ngang một nhiệm vụ đang khoá là rơi về giao diện cũ
         * — hai tấm bảng của cùng một màn, hai bộ mặt.
         *
         * Cùng bộ biến, cùng giá trị lùi, nên theme `classic` ra đúng tấm bảng
         * đang chạy hôm nay.
         */
        style={{
          ...themeVars(layout.theme),
          padding: "var(--q-frame-pad, 0px)",
          borderRadius: "var(--q-frame-radius, 1rem)",
          background: "var(--q-frame-bg, transparent)",
          boxShadow: "var(--q-frame-shadow, 0 25px 50px -12px rgba(4,18,31,0.45))",
        }}
      >
        <div
          className="flex overflow-hidden backdrop-blur-md"
          style={{
            borderRadius: "var(--q-inner-radius, 1rem)",
            background: "var(--q-inner-bg, rgba(10,31,51,0.95))",
            boxShadow: "inset 0 0 0 1px var(--q-inner-ring, rgba(27,68,99,1))",
          }}
        >
          {/* MỘT PHẦN BA bên trái: mặt người gác cổng, trong khung tròn. */}
          {/* KHÔNG đặt nền riêng: để nó TRONG SUỐT và ăn đúng nền của lòng
              bảng, y như hai phần ba bên phải. Bản trước lát nền vùng đọc
              (`--q-body-bg`) vào đây, nên với theme Atlantis thì nửa trái là xà
              cừ sáng còn nửa phải là xanh ngọc — một tấm bảng hai màu. Và ảnh
              nhân vật nền trong suốt thì giờ đứng thẳng trên màu của theme. */}
          <div
            ref={oAvatar}
            className="relative flex w-1/3 shrink-0 items-center justify-center overflow-hidden p-2"
          >
            {/* KHUNG TRÒN, dùng lại đúng `Face` của đoạn chat.
                Không tự dựng một cách cắt ảnh thứ hai: `Face` đã lo cả chuỗi
                lùi bốn nấc (tư thế đang cần → tư thế nghỉ → ảnh đại diện → chữ
                cái đầu tên) lẫn phép cắt phần ĐẦU ra khỏi spritesheet. Dán
                thẳng URL vào một thẻ `img` tròn thì với nhân vật chỉ có
                spritesheet, ta được cả một dải khung hình bị nén vào vòng
                tròn. */}
            <Face
              actor={advisorNpc}
              role="npc"
              pose="wait"
              name={advisorLabel}
              size={coAvatar}
              /* Vòng tròn ăn đúng màu lòng bảng, nên với ảnh nền trong suốt
                 nó biến mất hẳn vào nền — một phần ba bên trái và hai phần ba
                 bên phải cùng một màu, chỉ có người gác cửa nổi lên giữa. */
              nen="var(--q-inner-bg, rgba(10,31,51,0.95))"
            />
          </div>

          {/* HAI PHẦN BA bên phải: đúng chữ như cũ. */}
          <div className="flex w-2/3 flex-col justify-center gap-2 p-5">
            <h2 className="font-semibold" style={{ color: "var(--q-header-ink, #f1f5f9)" }}>
              {questLabel(quest, locale, t)}
            </h2>
            <p className="text-sm" style={{ color: "var(--q-muted, #94a3b8)" }}>
              {loiKhoa}
            </p>

            {/* Tiếng của câu khoá — nếu người dựng đã thu. Tự phát MỘT lần rồi
                nằm im. Không có thì chỉ có chữ: tiếng ở đây cũng là TUỲ CHỌN
                như mọi chỗ khác.

                THẺ `<audio>` GIẤU ĐI, không `controls`. Trình phát mặc định của
                trình duyệt cao 32px, rộng cả cột, và mang theo thanh thời gian,
                nút âm lượng, menu ba chấm — nó to hơn chính câu nói và biến một
                tấm bảng hai dòng chữ thành một cái máy nghe nhạc. Việc duy nhất
                người chơi cần ở đây là "cho nghe lại", và một cái nút nói đúng
                chừng ấy, đứng cạnh nút Đóng, làm xong việc ấy. */}
            {tiengKhoa && (
              <audio ref={oTiengKhoa} key={tiengKhoa} src={tiengKhoa} autoPlay className="hidden" />
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button ref={nutDong} variant="secondary" onClick={onClose}>
                {t("stage.viewer.close")}
              </Button>
              {tiengKhoa && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    const a = oTiengKhoa.current;
                    if (!a) return;
                    // Về đầu rồi phát: bấm lần thứ hai trong lúc còn đang đọc
                    // là "đọc lại từ đầu", không phải "không có gì xảy ra".
                    a.currentTime = 0;
                    void a.play().catch(() => {});
                  }}
                >
                  🔊 {t("game.npc.replay")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const npcName = questLabel(quest, locale, t);
  const total = quest.questions.length;
  const aside = shown.translation ? (bought.translation ?? null) : null;
  //: Chữ NẤP SAU NÚT: lời thoại của câu nghe, hoặc lời chia tay. Câu nào giáo
  //: viên đã bật `show_transcript` thì chữ đi thẳng trong đề bài — không có gì
  //: để mở, và cũng không có gì để bán.
  const gated = finished ? Boolean(outro) : Boolean(question?.has_transcript);
  const transcript = gated
    ? shown.transcript
      ? (bought.transcript ?? null)
      : null
    : promptOf(question?.content ?? {});
  /**
   * Giá một lần xin giúp Ở NHIỆM VỤ NÀY.
   *
   * Nhiệm vụ NPC là màn khởi động, và năng lượng chỉ được cấp SAU KHI qua nó —
   * nên ở đó học sinh luôn có 0. Tính tiền là khoá luôn cả hai cái nút đúng chỗ
   * người ta cần chúng nhất, mà lại không cho họ cách nào kiếm ra tiền để mở.
   * Nên ở nhiệm vụ NPC: miễn phí.
   */
  const cost = isGate ? 0 : hintCost;
  const canAfford = energy >= cost;

  /**
   * Câu người canh giữ SẮP nói — đề bài, hay lời kết.
   *
   * Với câu NGHE thì mở đầu KHÔNG CÓ chữ nào: in đề bài của một câu nghe ra sẵn
   * là biến bài nghe thành bài đọc. Chữ chỉ hiện khi học sinh tự mở lời thoại,
   * hoặc đã trả năng lượng để lấy bản dịch — hai lần đó đều là họ chủ động xin.
   *
   * MỘT câu hỏi chỉ có MỘT tin nhắn đề bài. Mở lời thoại hay mua bản dịch là
   * SỬA chính tin nhắn ấy, không phải nói thêm một câu nữa: server gộp theo
   * `(kind, question_id)` — xem `append_dialogue`.
   */
  const promptMsg: NewChatLine | null = finished
    ? advisorOutro && isGate
      ? { role: "npc", kind: "outro", text: advisorOutro, audio_url: advisorOutroAudio }
      : // Nhiệm vụ thường không có lời chia tay nào — sổ tay là của riêng người
        // canh giữ. Mở lại thì người canh giữ vẫn phải nói MỘT câu: một cuộc
        // trò chuyện im bặt khi mở ra là thứ trông như hỏng.
        revisit
        ? { role: "npc", kind: "outro", ...verdictOf("revisit", 0) }
        : null
    : !question
      ? null
      : {
          role: "npc",
          kind: "prompt",
          // Câu nghe chưa mở lời thoại thì rỗng — bong bóng chỉ có tệp tiếng.
          text: listening ? (transcript ?? "") : promptOf(question.content),
          // Bản dịch là CHÚ THÍCH cho câu vừa nói, nên nó nằm dưới cùng bong
          // bóng chứ không thành một bong bóng thứ hai — tách ra là dựng thêm
          // một người thứ ba trong cuộc trò chuyện.
          aside,
          question_id: question.id,
          audio_url: question.audio_url ?? null,
        };

  /**
   * Đẩy câu của người canh giữ vào đoạn chat.
   *
   * So theo NỘI DUNG chứ không chỉ theo "đã có chưa": đề bài của một câu nghe
   * đổi chữ giữa chừng (mở lời thoại, mua bản dịch), và lần đổi ấy phải đi
   * xuống server để vào lại vẫn thấy. Server gộp vào đúng tin nhắn cũ.
   */
  /**
   * CHÀO một câu khi mở nhiệm vụ, và NÓI XONG mới tới đề bài.
   *
   * Đi qua `says()` chứ không đẩy thẳng: `says()` lo cả nhịp gõ lẫn việc CHỜ
   * NGHE HẾT tiếng. Đẩy thẳng thì câu chào và đề bài rơi xuống cùng một lúc,
   * và tiếng tự phát nhắm vào tin CUỐI — tức nó đọc đề bài, còn câu chào nằm
   * đó câm lặng.
   *
   * Chỉ chào khi đoạn chat còn TRỐNG: vào lại một nhiệm vụ đang dở thì người
   * canh giữ chào lại từ đầu là quên mất mình đã nói chuyện với ai.
   */
  useEffect(() => {
    // Đổi nhiệm vụ thì cổng đóng lại, chờ chào xong lần nữa.
    setGreeted(false);
    setLoaded(false);
    daChao.current = false;
  }, [quest.id]);

  useEffect(() => {
    // ĐỢI LỊCH SỬ NẠP XONG.
    //
    // Lúc mới mở, `lines` còn rỗng vì bản ghi chưa về. Chào ngay ở đó thì vào
    // lại một nhiệm vụ đang dở là người canh giữ chào lần thứ hai — câu chào cũ
    // vẫn nằm trong đoạn chat, và câu mới rơi xuống dưới. Đã nhìn thấy thật:
    // hai câu chào y hệt nhau, kẹp lấy đề bài ở giữa.
    if (!loaded || greeted || daChao.current) return;

    // Không có gì để chào, hay đã nói chuyện rồi: mở cổng ngay.
    if (finished || lines.length > 0 || !verdictOf("greet", 0).text) {
      setGreeted(true);
      return;
    }

    daChao.current = true;
    says({ role: "npc", kind: "intro", ...verdictOf("greet", 0) }, () => setGreeted(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, quest.id, lines.length, finished, greeted]);

  useEffect(() => {
    // ĐỢI CHÀO XONG. Không đợi thì đề bài hiện ra đè lên câu chào, và câu chào
    // chưa kịp đọc hết đã có người nói chen vào.
    if (!greeted || !promptMsg) return;
    const daCo = lines.some(
      (l) =>
        l.kind === promptMsg.kind &&
        (l.question_id ?? null) === (promptMsg.question_id ?? null) &&
        l.text === promptMsg.text &&
        (l.aside ?? null) === (promptMsg.aside ?? null),
    );
    if (!daCo) void push([promptMsg]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greeted, promptMsg?.kind, promptMsg?.question_id, promptMsg?.text, promptMsg?.aside, lines]);

  /**
   * TƯ THẾ của hai bên, suy từ chính trạng thái hội thoại.
   *
   * Không có state riêng cho tư thế: một biến thứ hai nói cùng một chuyện thì
   * sớm muộn hai bên lệch nhau, và lúc đó nhân vật đứng cười trong khi người
   * canh giữ đang mắng.
   *
   * Phép suy nằm ở `dialoguePoses()` chứ không ở đây, vì khung xem trước của
   * giáo viên phải ra đúng cặp tư thế này — nếu không thì họ căn xong một cảnh
   * không có thật.
   */
  // Người canh giữ ở tư thế `say` đúng lúc CÓ TIẾNG ĐANG PHÁT — họ đang đọc câu
  // đó. Tiếng dừng thì họ về `wait`, vì lúc đó họ đang chờ thật.
  //
  // Bản trước lấy "câu này là câu nghe" làm điều kiện, nên miệng họ mấp máy
  // suốt cả lúc học sinh ngồi nghĩ.
  const pose = dialoguePoses({
    speaking: typing || playing,
    submitting: pending,
    verdict: tone,
    drafted: value != null,
  });

  /**
   * MẤY NÚT TRỢ GIÚP, treo dưới ĐÚNG bong bóng mà chúng mở ra.
   *
   * Trước đây chúng nằm ở góc trái thanh đáy, cách câu hỏi cả một khung trả
   * lời. Bấm vào thì chữ hiện ra ở tít trên kia, và không có gì nối hai chỗ ấy
   * với nhau ngoài việc thử một lần rồi nhớ.
   *
   * Treo dưới bong bóng thì cái nút ĐỨNG NGAY CẠNH thứ nó sẽ mở ra. Chỉ đúng
   * một bong bóng có chúng: đề bài đang hỏi, hay lời chia tay khi đã xong.
   */
  function troGiup(line: ChatLine) {
    const laDeBai = !finished && line.kind === "prompt" && line.question_id === question?.id;
    const laLoiKet = finished && line.kind === "outro";
    if (!laDeBai && !laLoiKet) return null;

    // Chỉ hiện khi THẬT SỰ có thứ đó: câu đọc không có gì để nghe lại, câu chưa
    // ai dịch thì không có gì để mở ra. Một cái nút bấm vào rồi báo "câu này
    // không có" là đã tiêu mất một nhịp chú ý của người đang bí.
    return (
      <>
      {gated && (
        <AssistButton
          label={hintLabel("transcript")}
          active={Boolean(shown.transcript)}
          disabled={bought.transcript === undefined && !canAfford}
          onClick={() => void useHint("transcript")}
        >
          <path
            d="M5 7h14M5 12h14M5 17h9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </AssistButton>
      )}
      {!finished && question?.has_translation && (
        <AssistButton
          label={hintLabel("translation")}
          active={Boolean(shown.translation)}
          disabled={bought.translation === undefined && !canAfford}
          onClick={() => void useHint("translation")}
        >
          <path
            d="M4 6h9M8.5 6v1.6c0 3.2-2 5.6-4.5 6.9M6 10.4c.9 2 2.6 3.4 4.8 4.1M12.4 20l3.4-8 3.4 8m-5.7-2.4h4.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </AssistButton>
      )}
      </>
    );
  }

  /**
   * ĐÃ RA ĐỀ chưa — tức có nên bày các phương án ra hay chưa.
   *
   * Chỉ chặn đúng MỘT chỗ: lúc mới vào, người canh giữ còn đang chào. Bày sẵn
   * bốn phương án dưới một câu chào là mời học sinh đọc đáp án trước khi biết
   * câu hỏi là gì, và mắt thì bị kéo xuống ngay giữa lúc người ta đang nói.
   *
   * Sau đó thì thôi, không chặn nữa. Giấu đi ở mỗi lời khen, mỗi câu nối, rồi
   * hiện lại — thử rồi, khối đáp án nhấp nháy suốt cuộc trò chuyện và cả tấm
   * bảng giật lên giật xuống theo.
   *
   * Dùng chính `greeted` chứ không thêm cờ mới: nó đã là cái cổng mà đề bài
   * phải đợi (xem effect đẩy `promptMsg`), nên hai bên không có đường nào lệch
   * nhau. Nhiệm vụ không có câu chào, hay vào lại một cuộc đang dở, thì cổng mở
   * ngay từ đầu.
   */
  const hienPhuongAn = greeted;

  return (
    <QuestChat
      layout={layout}
      urls={dialogueUrls}
      npcName={npcName}
      npc={quest.npc ?? null}
      npcPose={pose.npc}
      player={player}
      playerPose={pose.player}
      playerName={playerName}
      lines={lines}
      typing={typing}
      canSpeak={canSpeak}
      onPlayingChange={setPlaying}
      onAudioEnded={onAudioEnded}
      actions={troGiup}
      silenceRef={imHet}
      header={
        /* XONG chưa KHÁC với ĐẠT chưa.
           Bản trước hiện "Đã hoàn thành" cho mọi lượt đi hết các câu, kể cả khi
           không đủ điểm qua ải — tức là khen một việc chưa làm được, ngay cạnh
           cái nút mời đi tiếp.
           `progress.completed` là vòng TỐT NHẤT, nên đã qua một lần rồi thì
           chơi lại kém hơn vẫn giữ nguyên nhãn. */
        <span
          className={`rounded-full px-2.5 py-1 font-mono text-[11px] backdrop-blur-sm ${
            !finished
              ? "bg-abyss-950/45 text-slate-300"
              : daQuaAi
                ? "bg-lagoon-500/25 text-lagoon-200"
                : "bg-coral-500/20 text-coral-300"
          }`}
        >
          {finished
            ? daQuaAi
              ? t("game.questDone")
              : t("game.questNotDone")
            : `${index + 1}/${total}`}
        </span>
      }
      answer={
        // Mở LẠI một nhiệm vụ đã xong thì VẪN có khung trả lời — chỉ là trong
        // đó chẳng còn gì ngoài nút Làm lại.
        //
        // Bản trước trả `null` ở đây, với lý do "không còn việc gì cho học sinh
        // làm". Lý do ấy hết đúng từ lúc có nút Làm lại: ra ngoài rồi quay lại
        // một nhiệm vụ đã qua là đúng lúc người ta muốn chơi lại nhất, mà cả
        // dải dưới lại trống trơn.
        (
          // MỘT bố cục cho cả hai trạng thái — đang hỏi và đã xong. Hai nhánh
          // riêng thì hàng nút dưới cùng có hai bản, và chúng đã lệch nhau ngay
          // lần đầu: lúc xong nhiệm vụ, lời NPC rơi vào khung trả lời — tức khung
          // dành cho việc HỌC SINH làm.
          //
          // KHÔNG `h-full`, KHÔNG cuộn: khối này đi qua `FitScale`, nên nó cứ cao
          // đúng bằng nội dung thật rồi để bên ngoài thu lại cho vừa.
          //
          // Phím ENTER KHÔNG bắt ở đây nữa. Trình nghe cũ gắn trên chính cái
          // `div` này, nên nó chỉ chạy khi tiêu điểm còn nằm bên trong — mà tiêu
          // điểm rơi ra ngoài suốt. Giờ nó nằm ở cửa sổ; xem `nopBangEnter` phía
          // trên. Giữ cả hai thì một cú Enter chạy hai lần, nộp hai bong bóng.
          <div className="flex flex-col gap-3">
            {!finished && question && hienPhuongAn && (
              <div>
                <QuestionRenderer
                  type={question.type}
                  // Đề bài đã đóng băng mang cả cách ra đề. Nhưng ở ĐÂY chỉ truyền
                  // phần TƯƠNG TÁC: đoạn chữ và trình phát đã nằm trong bong bóng
                  // của người canh giữ, in lại lần nữa ở dải dưới là hai lớp chữ.
                  content={stripPrompt(question.content)}
                  value={value}
                  onChange={(next) =>
                    setDrafts((prev) => ({ ...prev, [question.id]: next }))
                  }
                  mode="exam"
                  answer={null}
                  disabled={pending || typing}
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              {loiNop ? (
                <span role="alert" className="flex-1 text-xs text-coral-400">
                  {t(loiNop)}
                </span>
              ) : (
                <span className="flex-1 text-xs text-slate-400">
                  {finished || !question
                    ? ""
                    : typing
                      ? t("game.npc.answering")
                      : triesHint(progress, question.id, t)}
                </span>
              )}

              {/* Cỡ THƯỜNG, không `sm`: cả khung này đã đi qua `FitScale` rồi, nên
                thu nhỏ sẵn ở đây là thu hai lần và cái nút thành một vệt chữ
                không ai nhắm trúng. */}
              {/* Mở LẠI một nhiệm vụ đã xong thì không còn nút nào: sổ tay nhận
                một lần, và "Đi tiếp" thì chẳng đi tới đâu — dấu ✕ ở góc mới là
                đường ra. Sổ tay CHỈ có ở nhiệm vụ người canh giữ; các nhiệm vụ
                khác xong là xong. */}
              {/* CHƠI LẠI — có ở CẢ HAI trạng thái, đạt hay chưa đạt.
                  Chưa đạt thì nó là đường gỡ; đạt rồi thì nó là đường làm cho
                  đẹp hơn, và đó mới là lúc người ta muốn chơi lại nhất. Nhật ký
                  vòng cũ được giữ và báo cáo đọc vòng tốt nhất, nên bấm vào
                  không mất gì. */}
              {finished && (
                <Button variant="secondary" loading={dangLamLai} onClick={lamLai}>
                  {t("game.playAgainQuest")}
                </Button>
              )}

              {finished ? (
                revisit ? null : (
                  <Button variant="primary" onClick={close} style={CTA} className={CTA_HOVER}>
                    {isGate && cluebook ? t("game.claim") : t("game.continue")}
                  </Button>
                )
              ) : (
                  <Button
                  variant="primary"
                  loading={pending}
                  disabled={typing || speaking || value == null}
                  onClick={answer}
                  style={CTA}
                  className={CTA_HOVER}
                >
                  {t("game.submit")}
                </Button>
              )}
            </div>
          </div>
        )
      }
      onClose={close}
      onTypingChange={onTypingChange}
    />
  );
}

/**
 * Đợi một tấm ảnh tải xong. Không có ảnh, hỏng, hay quá lâu thì thôi, đi tiếp.
 *
 * Trần thời gian là phần bắt buộc: một tấm ảnh 404 thì `onload` không bao giờ
 * nổ, và không có trần thì cả cuộc hội thoại ngồi im chờ một thứ sẽ không đến.
 * Ảnh đã nằm trong bộ nhớ đệm thì `onload` nổ gần như ngay, nên vào lại một
 * nhiệm vụ không phải chờ lần nữa.
 */
function whenLoaded(url: string | null, ms = 2500): Promise<void> {
  if (!url) return Promise.resolve();
  return new Promise((done) => {
    const img = new Image();
    const finish = () => done();
    img.onload = finish;
    img.onerror = finish;
    img.src = url;
    window.setTimeout(finish, ms);
  });
}

/**
 * NÚT CHỐT của bảng — Trả lời, Nhận sổ tay, Đi tiếp.
 *
 * Qua biến CSS, giá trị lùi là đúng nút `primary` đang chạy, nên theme
 * `classic` không đổi gì. `Button` nối `className` vào cuối nên lớp Tailwind
 * của nó vẫn thắng ở những thuộc tính ta không đặt ở đây.
 */
const CTA: React.CSSProperties = {
  // Giá trị lùi PHẢI khớp `variant="primary"`: nền `lagoon-500`, chữ
  // `abyss-950` — chữ SẪM, không phải trắng. Đặt nhầm màu chữ ở đây là đổi luôn
  // cái nút của theme `classic`, vì style nội tuyến thắng lớp Tailwind.
  background: "var(--q-cta-bg, #0ea5e9)",
  color: "var(--q-cta-ink, #04121f)",
  boxShadow: "inset 0 0 0 2px var(--q-cta-ring, transparent)",
};

/**
 * Nền nội tuyến thắng `hover:bg-lagoon-400` của nút, nên phản hồi khi rê chuột
 * phải dựng lại bằng một thuộc tính KHÁC. `brightness` không đụng tới `background`
 * nên nó chạy được với mọi theme, kể cả theme dùng chuyển sắc.
 */
const CTA_HOVER = "hover:brightness-110";

/** Hai loại gợi ý mua được. Cùng một giá — xem `balance.energyCost.hint`. */
export type HintKind = "transcript" | "translation";

/** Câu này còn đang mở không: chưa đúng VÀ còn lượt. */
function open(
  progress: { questions: QuestProgress["questions"] } | undefined,
  questionId: string,
): boolean {
  const seen = progress?.questions.find((q) => q.question_id === questionId);
  if (!seen) return true;
  if (seen.completed) return false;
  return seen.attempts_left === null || seen.attempts_left > 0;
}

/** Đoạn chữ của đề. Ô trống thì chính cái template là đề. */
/**
 * Một nút TRỢ GIÚP: tròn, nhỏ, chỉ có hình.
 *
 * Ba cái nút này đứng cạnh nút Trả lời nhưng KHÔNG cùng hạng với nó — chúng là
 * thứ giúp học sinh làm được việc chính, không phải việc chính. Nên chúng nhỏ
 * hơn, mờ hơn, và không có chữ: một hàng ba cái nút chữ bên cạnh một nút chữ
 * nữa thì không còn nút nào nổi lên là việc phải làm.
 *
 * `active` = thứ nó mở đang hiện, hoặc tiếng đang chạy. Sáng lên chứ không đổi
 * hình: đổi hình thì người ta phải học hai biểu tượng cho một cái nút.
 */
function AssistButton({
  label,
  active,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    // `group` + `peer` không dùng được: nhãn phải nổi LÊN TRÊN nút, mà nút nằm
    // trong một khung `overflow-hidden` đã thu tỉ lệ. Một thẻ bọc `relative` là
    // đủ, và nhãn thì `pointer-events-none` để nó không chắn chính cú bấm.
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
        // Cùng cỡ với cái loa đứng cạnh, và nền ĐẶC: dải nút này nằm đè lên mép
        // bong bóng, nên một cái nút trong mờ sẽ lẫn nửa vào nền bong bóng, nửa
        // vào đáy biển.
        className={`grid size-5 place-items-center rounded-full ring-1 ring-white/15 transition ${
          disabled
            ? // Mờ nhưng VẪN THẤY. Bản trước dùng `bg-white/5 text-slate-600` và
              // trên nền biển sáng thì cái nút biến mất hẳn — không thấy thì
              // không ai rê chuột vào để đọc xem vì sao nó không bấm được, tức là
              // mất luôn cả cái nhãn vừa dựng lên để giải thích.
              "cursor-not-allowed bg-abyss-950/70 text-slate-500"
            : active
              ? "bg-lagoon-500/70 text-white"
              : "bg-abyss-950/70 text-slate-300 hover:bg-abyss-800 hover:text-slate-100"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-3"
          aria-hidden
          fill="currentColor"
        >
          {children}
        </svg>
      </button>

      {/* Nhãn tự vẽ, không dùng `title` của trình duyệt: cái đó đợi gần một
          giây mới hiện, mang phông chữ của hệ điều hành, và ở một tấm bảng đã
          thu tỉ lệ thì nó hiện ra to gấp rưỡi mọi thứ quanh nó.

          Vẫn giữ nhãn khi nút bị KHOÁ — đó chính là lúc người ta cần đọc nó
          nhất, vì họ vừa thấy một cái nút bấm không được.

          Neo về mép TRÁI nút, không căn giữa: khung trả lời cắt mọi thứ tràn ra
          ngoài nó (`overflow-hidden` của `FitScale`), mà mấy cái nút này lại
          nằm sát mép trái — căn giữa thì nhãn thò ra ngoài và mất mấy chữ đầu.
          Đã gặp thật. */}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-20 mb-1.5 hidden rounded-lg bg-abyss-950/95 px-2 py-1 text-[11px] whitespace-nowrap text-slate-200 shadow-lg group-hover:block"
      >
        {label}
      </span>
    </span>
  );
}

/** "Còn 1 lượt thử". Nhiệm vụ NPC không đếm nên không nói gì. */
function triesHint(
  progress: QuestProgress | undefined,
  questionId: string,
  t: (key: string, values?: { count: number }) => string,
): string {
  const seen = progress?.questions.find((q) => q.question_id === questionId);
  // Cạn lượt thì cũng IM: "Còn 0 lượt thử" không nói thêm được gì, mà ngay lúc
  // ấy người canh giữ đang nói câu chuyển sang bài khác — hai giọng cùng báo
  // một việc, và cái ở dải dưới thì báo bằng một con số không.
  if (!seen || seen.attempts_left === null || seen.attempts_left === 0) return "";
  if (seen.completed) return "";
  return t("game.triesLeft", { count: seen.attempts_left });
}

/**
 * Bước cuối: lời chia tay của NPC và nút trao sổ tay.
 *
 * KHÔNG còn là một bảng riêng bật lên sau khi nộp — đây chỉ là hai tin nhắn
 * cuối của chính cuộc hội thoại, đặt trong dải trả lời vì đó là chỗ cái nút vẫn
 * luôn nằm.
 */

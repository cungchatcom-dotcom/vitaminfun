'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AudioPrompt } from '@/components/question/audio-prompt';
import { fitProseSize } from '@/components/question/fit-text';
import { QuestionRenderer } from '@/components/question/renderers';
import type { QuestionResponse } from '@/components/question/types';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { questLabel } from '@/lib/quest-label';
import type {
  QuestionProgress,
  QuestProgress,
  SnapshotQuest,
  SubmitQuestOut,
} from '@/lib/play';

/** Kết quả một lần nộp, kèm tình trạng TỪNG CÂU mà server vừa chấm xong. */
export type SubmitResult = { result: SubmitQuestOut; questions: QuestionProgress[] };

/**
 * Bảng làm nhiệm vụ — mở ra khi bấm vào một vật thể trong cảnh.
 *
 * **Làm cả nhiệm vụ rồi mới nộp một lượt.** Một nhiệm vụ là MỘT việc — nói
 * chuyện xong với thuyền trưởng, sửa xong cái cột buồm — nên người chơi phải
 * được xem hết, sửa lại, rồi mới chốt. Chấm ngay từng câu thì câu một đã khoá
 * lại trước khi họ kịp đọc câu bốn.
 *
 * **Chuyển câu là lưu.** Mỗi lần rời một câu, bài đang chọn được gửi lên server
 * làm bản nháp. Mất mạng, sập pin, đóng nhầm tab — vào lại là thấy nguyên. Giữ
 * ở máy thì đổi máy là mất, và cũng chẳng có gì bảo đảm nó còn đó.
 *
 * Đây cũng là chỗ luật "trong trận chỉ nói xong/chưa xong" (§1.6) thành giao
 * diện: sau khi nộp chỉ có hai trạng thái, **không** điểm, **không** đáp án,
 * **không** giải thích. Ba thứ đó ở màn xem lại sau khi hết màn.
 *
 * Frontend cũng KHÔNG có gì để tự chấm: đáp án chưa bao giờ rời server.
 *
 * ---
 *
 * **NHIỆM VỤ NPC đi theo luật khác**, và cố ý khác:
 *
 * Nó là một cuộc HỘI THOẠI, không phải một bài tập. Người ta không "nộp bài" một
 * cuộc trò chuyện — họ nói một câu, nghe đáp lại, rồi nói câu tiếp. Nên ở đây
 * không có nút Nộp bài: chỉ có **Tiếp**, bấm là chấm ngay câu đang nói. Sai thì
 * NPC nói lại (`wrong_answer_message`) và người chơi trả lời lại — không giới
 * hạn số lần, vì đây là cổng vào màn chứ không phải chỗ lấy điểm.
 */
export function QuestPanel({
  quest,
  progress,
  advisorLabel,
  cluebook,
  advisorOutro,
  advisorOutroAudio,
  advisorOutroShowTranscript,
  onSaveDraft,
  onSubmitQuest,
  onClose,
  onTypingChange,
}: {
  quest: SnapshotQuest;
  progress: QuestProgress | undefined;
  /** Tên nhiệm vụ NPC, để bảng khoá nói rõ phải đi gặp AI. */
  advisorLabel: string;
  /** Nội dung sổ tay của màn. Rỗng = màn này không có sổ tay để trao. */
  cluebook: string;
  /** Lời NPC nói lúc trao sổ tay — bước cuối của chuỗi hội thoại. */
  advisorOutro: string;
  /** URL đoạn ghi âm NPC nói lời chia tay. `null` = chỉ có chữ. */
  advisorOutroAudio: string | null;
  /** Đoạn chữ mở sẵn cạnh trình phát. Mặc định bật — xem GAME_DOMAIN §3d. */
  advisorOutroShowTranscript: boolean;
  onSaveDraft: (questionId: string, response: Record<string, unknown> | null) => Promise<void>;
  onSubmitQuest: () => Promise<SubmitResult>;
  onClose: () => void;
  onTypingChange: (typing: boolean) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();

  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<SubmitQuestOut | null>(null);

  /** Lời NPC nói khi người chơi trả lời sai. Chỉ dùng ở nhiệm vụ NPC. */
  const [wrongMessage, setWrongMessage] = useState<string | null>(null);

  /**
   * Bài đang làm của CẢ nhiệm vụ, tra theo `question_id`.
   *
   * Giữ cả cụm chứ không mỗi câu đang xem: người chơi phải nhảy qua nhảy lại
   * giữa các câu và thấy lại đúng thứ mình đã chọn, kể cả câu chưa nộp.
   */
  const [drafts, setDrafts] = useState<Record<string, QuestionResponse | null>>({});

  /**
   * Bản đã GỬI LÊN, dạng chuỗi JSON, để không gửi lại thứ server đã có.
   *
   * `useRef` chứ không `useState`: nó không vẽ ra gì cả, và đổi nó mà kéo theo
   * một lượt vẽ lại thì mỗi lần chuyển câu là một lượt vẽ thừa.
   */
  const sent = useRef<Record<string, string>>({});

  // Nạp bản nháp từ server MỘT LẦN cho mỗi nhiệm vụ, rồi để state cục bộ dẫn.
  //
  // Đồng bộ liên tục theo `progress` thì mỗi lần nạp lại lượt chơi (sau khi
  // nộp) sẽ giật bài người chơi đang gõ dở về bản trên server.
  useEffect(() => {
    const loaded: Record<string, QuestionResponse | null> = {};
    for (const q of progress?.questions ?? []) {
      if (q.draft != null) loaded[q.question_id] = q.draft as QuestionResponse;
    }
    setDrafts(loaded);
    sent.current = Object.fromEntries(
      Object.entries(loaded).map(([k, v]) => [k, JSON.stringify(v)]),
    );
  }, [quest.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tắt cờ "đang gõ" khi bảng BIẾN MẤT khỏi màn hình.
  //
  // `onBlurCapture` không chạy trong trường hợp này: gỡ một phần tử đang giữ
  // focus ra khỏi DOM KHÔNG sinh sự kiện `blur` — focus lặng lẽ rơi về `<body>`.
  // Nên chỉ cần bấm vào một đáp án (nó nhận focus) rồi đóng bảng là cờ kẹt ở
  // `true` vĩnh viễn, và `update()` của cảnh thoát ra ngay ở dòng đầu: chuột vẫn
  // đi được, còn W A D X thì chết hẳn cho tới khi tải lại trang.
  useEffect(() => () => onTypingChange(false), [onTypingChange]);

  const question = quest.questions[index];
  const questionProgress = progress?.questions.find((q) => q.question_id === question?.id);
  const done = questionProgress?.completed ?? false;
  const value = question ? (drafts[question.id] ?? null) : null;

  // Còn mấy lần nộp NHIỆM VỤ. Sau khi nộp thì lấy con số server vừa trả về;
  // trước đó suy từ câu còn nhiều lượt nhất — cùng một luật với `_attempts_left`
  // ở server, và server mới là bên quyết.
  const attemptsLeft =
    feedback?.attempts_left ??
    (progress?.questions ?? []).reduce<number | null>((best, q) => {
      if (q.completed) return best;
      if (q.attempts_left === null) return null;
      return best === null ? q.attempts_left : Math.max(best, q.attempts_left);
    }, 0);

  const questDone = progress?.completed ?? false;
  const locked = !questDone && attemptsLeft === 0;

  /**
   * Chưa qua NPC nên nhiệm vụ này còn khoá.
   *
   * Khác hẳn `locked` ở trên: cái đó là "hết lượt nộp", cái này là "chưa tới
   * lượt". Tên gần giống nhau nhưng hai chuyện, và chỉ cái này mới khiến server
   * từ chối cả việc lưu nháp.
   */
  const advisorLocked = progress?.locked ?? false;

  /** Nhiệm vụ NPC — hội thoại từng bước, không có nút Nộp bài. */
  const isGate = quest.phase === 'advisor';

  // Nhảy tới câu đầu tiên chưa xong, để không phải bấm qua các câu đã làm.
  useEffect(() => {
    const next = quest.questions.findIndex(
      (q) => !progress?.questions.find((p) => p.question_id === q.id)?.completed,
    );
    setIndex(next === -1 ? 0 : next);
  }, [quest.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Gửi bản nháp của một câu lên server, nếu nó thật sự đổi.
   *
   * So bằng chuỗi JSON chứ không so tham chiếu: `QuestionRenderer` dựng đối
   * tượng mới sau mỗi lần gõ, nên so tham chiếu thì lần nào cũng "đổi" và mỗi
   * cú chuyển câu bắn một request thừa.
   */
  const flush = useCallback(
    async (questionId: string, next: QuestionResponse | null) => {
      // Nhiệm vụ đang khoá thì KHÔNG gửi gì cả.
      //
      // Cái `return` sớm cho bảng "đang khoá" nằm mãi phía dưới, mà hook thì
      // React không cho bỏ qua — nên bảng khoá vẫn hẹn giờ lưu nháp như thường,
      // và 800ms sau nó gửi một bản nháp RỖNG cho nhiệm vụ mà server đã cấm
      // động vào. Server trả `ADVISOR_LOCKED`, đúng như nó phải làm, còn `void`
      // ở chỗ gọi để lời từ chối ấy rơi ra thành unhandled rejection: người chơi
      // chỉ bấm vào một vật đang khoá là Next hiện "1 Issue" đỏ ở góc màn hình.
      //
      // Chặn ở ĐÂY chứ không ở từng chỗ gọi: `goTo()` và `close()` cũng gọi
      // `flush()`, và chặn một chỗ thì không có đường nào lọt.
      //
      // Chặn chứ không nuốt lỗi: một request chắc chắn hỏng thì đừng gửi. Bọc
      // `try/catch` quanh nó thì im được cái badge nhưng giấu luôn những lần
      // lưu nháp hỏng thật — mà lưu nháp hỏng thật là mất bài người chơi.
      if (advisorLocked) return;

      const json = JSON.stringify(next ?? null);
      if (sent.current[questionId] === json) return;
      sent.current[questionId] = json;
      await onSaveDraft(questionId, next as Record<string, unknown> | null);
    },
    [onSaveDraft, advisorLocked],
  );

  // Lưu thêm khi NGƯNG THAO TÁC một nhịp, không chỉ lúc chuyển câu.
  //
  // Chuyển câu là mốc rõ ràng nhất, nhưng nó không đủ: một nhiệm vụ chỉ có MỘT
  // câu thì không bao giờ có cú chuyển nào, và người chơi chọn xong rồi ngồi
  // đọc lại đề mà mất mạng thì mất trắng. Cả mục đích của việc lưu nháp là
  // chống tai nạn, mà tai nạn không đợi người ta bấm sang câu khác.
  //
  // 800ms: đủ dài để một lượt gõ vào ô tự luận không bắn mỗi ký tự một request,
  // đủ ngắn để "vừa chọn xong thì mất điện" vẫn kịp.
  useEffect(() => {
    if (!question) return;
    const timer = setTimeout(() => void flush(question.id, value), 800);
    return () => clearTimeout(timer);
  }, [question, value, flush]);

  /** Rời câu đang xem: lưu trước, rồi mới đi. */
  function goTo(next: number) {
    if (question) void flush(question.id, value);
    setFeedback(null);
    setWrongMessage(null);
    setIndex(next);
  }

  function close() {
    if (question) void flush(question.id, value);
    onClose();
  }

  async function submit() {
    if (pending) return;
    setPending(true);
    try {
      // Lưu câu đang xem TRƯỚC khi nộp: người chơi chọn xong câu cuối rồi bấm
      // Nộp bài luôn, không chuyển sang câu nào nữa — không có cú chuyển câu
      // nào để mà lưu, và câu đó sẽ bị chấm là bỏ trống.
      if (question) await flush(question.id, value);
      setFeedback((await onSubmitQuest()).result);
    } finally {
      setPending(false);
    }
  }

  /**
   * Nhiệm vụ NPC: chấm ĐÚNG CÂU ĐANG NÓI rồi đi tiếp hoặc nói lại.
   *
   * Vẫn gọi chính đường nộp bài của server, không có đường tắt riêng nào: server
   * chỉ chấm những câu CÓ bản nháp, mà lúc này mới đúng một câu có — nên nộp cả
   * nhiệm vụ và chấm một câu là cùng một việc. Ít một đường đi thì ít một chỗ
   * cho hai luật chấm điểm lệch nhau.
   */
  async function nextStep() {
    if (pending || !question) return;
    setPending(true);
    try {
      await flush(question.id, value);
      const { questions } = await onSubmitQuest();

      // Hỏi SERVER câu vừa rồi đúng chưa, không tự đoán ở máy: đáp án chưa bao
      // giờ rời server, nên ở đây không có gì để mà đoán.
      if (!questions.find((q) => q.question_id === question.id)?.completed) {
        const content = question.content as { wrong_answer_message?: string };
        setWrongMessage(content.wrong_answer_message || t('game.wrongAnswer'));
        return;
      }

      setWrongMessage(null);
      const next = quest.questions.findIndex(
        (q, i) => i > index && !questions.find((p) => p.question_id === q.id)?.completed,
      );
      // Không còn câu nào chưa xong thì cứ đứng yên: `progress` vừa cập nhật sẽ
      // đưa bảng sang màn trao sổ tay ở lượt vẽ kế tiếp.
      if (next !== -1) setIndex(next);
    } finally {
      setPending(false);
    }
  }

  const label = questLabel(quest, locale, t);

  // Chưa qua NPC. Bảng vẫn MỞ RA và nói vì sao, chứ không phải bấm vào thì
  // không có gì xảy ra — im lặng đọc ra là hỏng, không phải là luật chơi.
  //
  // Đặt trước `if (!question)`: một nhiệm vụ đang khoá mà chưa lắp câu hỏi nào
  // vẫn phải giải thích được chính nó.
  if (progress?.locked) {
    return (
      <section className="pointer-events-auto w-full max-w-md rounded-2xl border border-abyss-700 bg-abyss-900/95 p-5 text-center shadow-2xl backdrop-blur">
        <p className="text-3xl" aria-hidden>
          🔒
        </p>
        <h2 className="mt-2 font-semibold text-slate-100">{label}</h2>
        <p className="mt-2 text-sm text-slate-400">
          {t('game.advisorLocked', { npc: advisorLabel })}
        </p>
        <Button variant="secondary" className="mt-4" onClick={onClose}>
          {t('stage.viewer.close')}
        </Button>
      </section>
    );
  }

  // Nói xong với NPC: bước cuối là NHẬN SỔ TAY.
  //
  // Bấm Claim chỉ đóng bảng — không gửi gì thêm. Câu cuối trả lời đúng là server
  // đã chốt nhiệm vụ và cấp năng lượng rồi; cái nút này là chỗ người chơi BIẾT
  // mình vừa được cho cái gì. Tự đóng bảng và lặng lẽ thả một biểu tượng mới vào
  // góc màn thì họ chẳng có lý do gì để đi bấm vào đó.
  if (isGate && questDone) {
    return (
      // TRẦN chiều cao cộng cuộn được, và nó KHÔNG thừa dù chữ đã tự co:
      // `fitProseSize()` là một phép xấp xỉ theo số ký tự, có SÀN, và người dựng
      // hoàn toàn có thể dán vào ba nghìn chữ. Thu nhỏ chữ là để đoạn văn bình
      // thường trông cân đối; cuộn là để đoạn văn bất thường không đẩy cái nút
      // "Nhận sổ tay" ra khỏi màn hình — mà đó là cái nút duy nhất đóng được
      // bảng này.
      <section className="pointer-events-auto max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-orichalcum-500/40 bg-abyss-900/95 p-6 text-center shadow-2xl backdrop-blur">
        <p className="text-4xl" aria-hidden>
          📖
        </p>

        {/* Lời NPC nói ĐỨNG TRƯỚC, và đứng ở chỗ dễ nhìn nhất.
            Đây là bước cuối của cuộc hội thoại — thuyền trưởng vẫn đang nói với
            người chơi. Thay nó bằng một câu thông báo của hệ thống là cắt ngang
            cảnh ngay ở nhịp cuối, chỉ để nói một điều nhạt hơn. */}
        {advisorOutro && (
          <div className="mt-4 text-left text-sm leading-relaxed text-slate-200">
            <span className="mb-1 block text-xs font-semibold text-lagoon-400">
              {advisorLabel}
            </span>
            {advisorOutroAudio ? (
              // Cùng component với câu hỏi nghe — tự phát, có nút thu gọn chữ.
              // Chỉ khác MẶC ĐỊNH: ở đây chữ mở sẵn, vì lời NPC không phải bài
              // tập nghe mà là một nhân vật đang nói (GAME_DOMAIN §3d).
              <AudioPrompt
                src={advisorOutroAudio}
                transcript={advisorOutro}
                defaultOpen={advisorOutroShowTranscript}
                toggleable
                autoPlay
              />
            ) : (
              // Không có tiếng thì chữ vẫn phải co theo độ dài — cùng một luật,
              // và một trong hai nhánh quên áp là lời NPC đổi cỡ tuỳ vào việc
              // người dựng có tải file lên hay không.
              <p style={{ fontSize: fitProseSize(advisorOutro) }}>{advisorOutro}</p>
            )}
          </div>
        )}

        {/* KHÔNG có dòng "bạn nhận được sổ tay". Chính lời NPC ở trên đã nói ra
            điều đó bằng giọng của nhân vật; lặp lại bằng giọng hệ thống chỉ là
            nói hai lần một chuyện, lần sau nhạt hơn lần trước.

            Màn không có sổ tay thì mới cần một dòng, vì lúc đó chẳng có gì khác
            báo rằng cuộc nói chuyện đã xong. */}
        {!cluebook && (
          <h2 className="mt-4 text-lg font-bold text-orichalcum-400">
            {t('game.missionComplete')}
          </h2>
        )}
        {cluebook && <p className="mt-4 text-sm text-slate-400">{t('game.claimBody')}</p>}
        <Button variant="primary" className="mt-5" onClick={close}>
          {cluebook ? t('game.claim') : t('game.continue')}
        </Button>
      </section>
    );
  }

  if (!question) return null;
  const total = quest.questions.length;

  return (
    <section
      // Cùng trần chiều cao với bảng trao sổ tay, và cùng lý do: một câu hỏi
      // nghe có transcript dài, cộng bốn phương án, cộng nút Nộp bài — không có
      // gì chặn thì cái nút trôi ra khỏi màn hình và học sinh không nộp được.
      className="pointer-events-auto max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-abyss-700 bg-abyss-900/95 p-5 shadow-2xl backdrop-blur"
      // Gõ trong bảng này thì cảnh Phaser phải ngừng nhận WASD, không thì gõ
      // chữ "a" là nhân vật chạy sang trái. Nhớ đọc kèm effect dọn dẹp ở trên:
      // `onBlurCapture` MỘT MÌNH là không đủ.
      onFocusCapture={() => onTypingChange(true)}
      onBlurCapture={() => onTypingChange(false)}
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-slate-100">{label}</h2>
          <Badge tone={quest.phase === 'advisor' ? 'info' : 'neutral'}>
            {t(`stage.phase.${quest.phase}`)}
          </Badge>
          {questDone && <Badge tone="success">{t('game.questDone')}</Badge>}
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={t('stage.viewer.close')}
          className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-abyss-800 hover:text-slate-100"
        >
          ✕
        </button>
      </header>

      {/* Điều hướng giữa các câu trong cùng nhiệm vụ.
          KHÔNG có ở nhiệm vụ NPC: hội thoại đi theo thứ tự, và một dãy nút cho
          phép nhảy sang câu 3 trước khi trả lời câu 1 là mời người chơi phá
          đúng cái mạch mà cả cảnh này dựng nên. */}
      {total > 1 && !isGate && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {quest.questions.map((q, i) => {
            const p = progress?.questions.find((x) => x.question_id === q.id);
            // Ba trạng thái: đang xem, đã chấm đúng, và ĐÃ CHỌN nhưng chưa nộp.
            // Cái thứ ba là thứ trả lời câu "mình còn sót câu nào chưa làm?" —
            // không có nó thì người chơi phải bấm qua từng câu để kiểm.
            const chosen = drafts[q.id] != null;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => goTo(i)}
                aria-current={i === index}
                className={`size-8 rounded-lg text-xs font-medium transition ${
                  i === index
                    ? 'bg-lagoon-500 text-abyss-950'
                    : p?.completed
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : chosen
                        ? 'bg-abyss-700 text-slate-200 ring-1 ring-lagoon-500/50'
                        : 'bg-abyss-800 text-slate-400 hover:bg-abyss-700'
                }`}
              >
                {p?.completed ? '✓' : i + 1}
              </button>
            );
          })}
          <span className="ml-2 text-xs text-slate-500">
            {t('game.questionOf', { current: index + 1, total })}
          </span>
        </div>
      )}

      <QuestionRenderer
        type={question.type}
        // CÁCH RA ĐỀ lấy từ ĐỀ BÀI ĐÃ ĐÓNG BĂNG, không hỏi lại server: giáo viên
        // đổi một câu từ đọc sang nghe giữa chừng thì lượt đang chơi vẫn là cái
        // đề nó bắt đầu — cùng luật với ảnh nền và vùng đi được.
        promptKind={question.prompt_kind}
        audioUrl={question.audio_url}
        showTranscript={question.show_transcript}
        content={question.content}
        value={value}
        onChange={(next) => setDrafts((prev) => ({ ...prev, [question.id]: next }))}
        // `exam` = chế độ làm bài thật: renderer KHÔNG nhận đáp án, và server
        // cũng không gửi xuống.
        mode="exam"
        answer={null}
        // Câu ĐÃ CHẤM ĐÚNG thì khoá lại — sửa nữa cũng không đổi được gì, vì
        // server bỏ qua câu đã đúng. Còn câu sai thì vẫn sửa được: đó chính là
        // điều "quay lại sửa đáp án" nói tới.
        disabled={done || locked || pending}
      />

      {/* NPC nói lại khi trả lời sai. Bảng KHÔNG đóng, đáp án vẫn sửa được —
          "sai thì nói lại cho đúng" là cách một cuộc hội thoại vận hành. */}
      {isGate && wrongMessage && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-coral-500/40 bg-coral-500/10 px-4 py-3 text-sm text-coral-500"
        >
          {wrongMessage}
        </p>
      )}

      {/* --------- Phản hồi: ĐÚNG HAI TRẠNG THÁI --------- */}
      {!isGate && feedback && (
        <div
          role="status"
          className={`mt-4 rounded-xl border px-4 py-3 text-center ${
            feedback.quest_completed
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
              : 'border-coral-500/40 bg-coral-500/10 text-coral-500'
          }`}
        >
          <p className="text-lg font-bold">
            {feedback.quest_completed
              ? `✓ ${t('game.missionComplete')}`
              : `✗ ${t('game.notComplete')}`}
          </p>
          {/* Không còn dòng "mất năng lượng": trả lời sai không tốn gì cả.
              Còn lại đúng thứ người chơi cần biết — còn mấy lượt thử. */}
          {!feedback.quest_completed && (
            <p className="mt-1 text-sm">
              {feedback.attempts_left === null
                ? t('game.unlimitedTries')
                : t('game.triesLeft', { count: feedback.attempts_left })}
            </p>
          )}
        </div>
      )}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-slate-500">
          {isGate
            ? t('game.stepOf', { current: index + 1, total })
            : attemptsLeft === null
              ? ''
              : questDone
                ? t('game.alreadyCorrect')
                : t('game.triesLeft', { count: attemptsLeft })}
        </span>

        {isGate ? (
          // MỘT nút duy nhất. Không "Nộp bài", không "Câu tiếp" đi riêng: bấm
          // Tiếp là vừa chấm câu đang nói vừa đi tiếp, đúng như khi nói chuyện
          // với người thật — nói xong một câu là tới lượt người kia đáp.
          <Button variant="primary" loading={pending} onClick={nextStep}>
            {t('game.next')}
          </Button>
        ) : (
        <div className="flex gap-2">
          {index < total - 1 && (
            <Button variant="secondary" onClick={() => goTo(index + 1)}>
              {t('game.nextQuestion')}
            </Button>
          )}
          {questDone || locked ? (
            <Button variant="secondary" onClick={close}>
              {t('game.continue')}
            </Button>
          ) : feedback ? (
            <Button variant="primary" loading={pending} onClick={() => setFeedback(null)}>
              {t('game.tryAgain')}
            </Button>
          ) : (
            <Button variant="primary" loading={pending} onClick={submit}>
              {t('game.submit')}
            </Button>
          )}
        </div>
        )}
      </footer>
    </section>
  );
}

"use client";

/**
 * Phần hiển thị câu hỏi cho NGƯỜI LÀM BÀI.
 *
 * Builder dùng lại đúng những component này ở chế độ `preview`, nên giáo viên
 * nhìn thấy chính xác thứ học sinh sẽ thấy. Có hai đường vẽ riêng cho cùng một
 * dạng bài là cách chắc chắn nhất để hai bên lệch nhau.
 *
 * ⚠️ Lúc LÀM BÀI, không component nào ở đây biết đáp án đúng — server không gửi
 * xuống. Đúng/sai đến từ `detail`, và đáp án đúng (`answer`) chỉ xuất hiện ở
 * chế độ `review`, sau khi đã nộp.
 */

import type {
  GapDropdownContent,
  McqContent,
  QuestionResponse,
  RendererProps,
} from "./types";
import { parseTemplate } from "./template";
import { AudioPrompt, resolvePrompt, type PromptKind } from "./audio-prompt";

// --------------------------------------------------------------------------
// Trắc nghiệm
// --------------------------------------------------------------------------

export function McqRenderer({
  content,
  value,
  onChange,
  multi,
  disabled,
  mode,
  answer,
}: RendererProps & { multi: boolean }) {
  const data = content as unknown as McqContent;
  const options = data.options ?? [];

  // Chỉ ở màn chữa bài mới biết đáp án đúng — lúc làm bài `answer` là null.
  const dangChuaBai = mode === "review" && Boolean(answer);
  const dapAnDung = new Set<string>(
    dangChuaBai
      ? multi
        ? ((answer as { correctOptionIds?: string[] }).correctOptionIds ?? [])
        : [(answer as { correctOptionId?: string }).correctOptionId].filter(
            (id): id is string => Boolean(id),
          )
      : [],
  );

  const selected: string[] = multi
    ? ((value as { selectedOptionIds?: string[] })?.selectedOptionIds ?? [])
    : [(value as { selectedOptionId?: string | null })?.selectedOptionId].filter(
        (id): id is string => Boolean(id),
      );

  function toggle(id: string) {
    if (disabled) return;
    if (!multi) {
      onChange({ selectedOptionId: id } as QuestionResponse);
      return;
    }
    const next = selected.includes(id)
      ? selected.filter((item) => item !== id)
      : [...selected, id];
    onChange({ selectedOptionIds: next } as QuestionResponse);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Có canh gác vì đề bài CÓ THỂ VẮNG: câu nghe giấu đoạn chữ sau nút
          Transcript, và `QuestionRenderer` gỡ `prompt` ra trước khi truyền
          xuống đây. Không canh thì còn lại một thẻ `<p>` rỗng chiếm chỗ ngay
          trên các phương án. */}
      {data.prompt && <p className="text-lg font-semibold">{data.prompt}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option, index) => {
          const isOn = selected.includes(option.id);
          const laDapAn = dapAnDung.has(option.id);
          // Ở màn chữa bài: xanh = đáp án đúng, đỏ = em chọn nhưng sai.
          const tone = !dangChuaBai
            ? null
            : laDapAn
              ? "var(--color-semantic-success)"
              : isOn
                ? "var(--color-semantic-danger)"
                : null;

          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(option.id)}
              className="card card--interactive flex items-center gap-3 p-4 text-start"
              // Viền dày đổi màu thay vì chỉ đổi nền: người mù màu vẫn phân biệt
              // được ô đã chọn.
              style={{
                borderWidth: 2,
                borderColor:
                  tone ??
                  (isOn ? "var(--color-brand-primary)" : "var(--color-surface-border)"),
                background: tone
                  ? `color-mix(in srgb, ${tone} 10%, var(--color-surface-card))`
                  : isOn
                    ? "color-mix(in srgb, var(--color-brand-primary) 10%, var(--color-surface-card))"
                    : "var(--color-surface-card)",
              }}
            >
              <span
                aria-hidden
                className="grid h-6 w-6 shrink-0 place-items-center text-xs font-bold"
                style={{
                  // Tròn = chọn một, vuông = chọn nhiều. Trẻ em nhận ra quy ước
                  // này từ bài thi giấy.
                  borderRadius: multi ? "var(--radius-sm)" : "var(--radius-pill)",
                  border: "2px solid var(--color-brand-primary)",
                  background: isOn ? "var(--color-brand-primary)" : "transparent",
                  color: "var(--color-brand-primary-fg)",
                }}
              >
                {isOn ? "✓" : String.fromCharCode(65 + index)}
              </span>
              <span>{option.text}</span>
              {dangChuaBai && laDapAn ? (
                <span
                  className="ms-auto text-xs font-bold"
                  style={{ color: "var(--color-semantic-success)" }}
                >
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Ô trống — điền chữ
// --------------------------------------------------------------------------

export function GapFillRenderer({ content, value, onChange, detail, disabled }: RendererProps) {
  const template = (content as { template?: string }).template ?? "";
  const gaps = ((value as { gaps?: Record<string, string | null> })?.gaps ?? {}) as Record<
    string,
    string | null
  >;

  function setGap(key: string, next: string) {
    onChange({ gaps: { ...gaps, [key]: next } } as QuestionResponse);
  }

  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-3 text-lg leading-loose">
      {parseTemplate(template).map((segment, index) =>
        segment.kind === "text" ? (
          <span key={index}>{segment.value}</span>
        ) : (
          <input
            key={index}
            type="text"
            className="field-input"
            disabled={disabled}
            value={gaps[segment.value] ?? ""}
            onChange={(event) => setGap(segment.value, event.target.value)}
            aria-label={`Ô trống ${segment.value}`}
            style={{
              width: "8rem",
              display: "inline-block",
              padding: "0.25rem 0.5rem",
              ...gapResultStyle(detail?.[segment.value]),
            }}
          />
        ),
      )}
    </p>
  );
}

// --------------------------------------------------------------------------
// Ô trống — chọn từ danh sách
// --------------------------------------------------------------------------

export function GapDropdownRenderer({
  content,
  value,
  onChange,
  detail,
  disabled,
}: RendererProps) {
  const data = content as unknown as GapDropdownContent;
  const gaps = ((value as { gaps?: Record<string, string | null> })?.gaps ?? {}) as Record<
    string,
    string | null
  >;

  function setGap(key: string, next: string) {
    onChange({ gaps: { ...gaps, [key]: next || null } } as QuestionResponse);
  }

  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-3 text-lg leading-loose">
      {parseTemplate(data.template ?? "").map((segment, index) => {
        if (segment.kind === "text") return <span key={index}>{segment.value}</span>;

        const options = data.gaps?.[segment.value]?.options ?? [];
        return (
          <select
            key={index}
            className="field-input"
            disabled={disabled}
            value={gaps[segment.value] ?? ""}
            onChange={(event) => setGap(segment.value, event.target.value)}
            aria-label={`Ô trống ${segment.value}`}
            style={{
              width: "auto",
              display: "inline-block",
              padding: "0.25rem 0.5rem",
              ...gapResultStyle(detail?.[segment.value]),
            }}
          >
            <option value="">—</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.text}
              </option>
            ))}
          </select>
        );
      })}
    </p>
  );
}

/** Viền xanh/đỏ sau khi server chấm. `undefined` = chưa chấm, giữ nguyên. */
function gapResultStyle(correct: boolean | undefined): React.CSSProperties {
  if (correct === undefined) return {};
  const tone = correct ? "var(--color-semantic-success)" : "var(--color-semantic-danger)";
  return {
    borderColor: tone,
    boxShadow: `0 0 0 3px color-mix(in srgb, ${tone} 22%, transparent)`,
  };
}

// --------------------------------------------------------------------------

/**
 * SHORT_ANSWER — học sinh GÕ câu trả lời.
 *
 * Một ô chữ, không có lựa chọn nào. Muốn dễ hơn thì xin gợi ý, và gợi ý thì tốn
 * năng lượng — xem `docs/GAME_DOMAIN.md`. Đó là cả điểm khác nhau giữa dạng này
 * và trắc nghiệm: ở đây học sinh phải tự nhớ ra chữ, không phải nhận ra chữ.
 */
export function ShortAnswerRenderer({
  content,
  value,
  onChange,
  detail,
  disabled,
  mode,
  answer,
}: RendererProps) {
  const { prompt, placeholder, maxWords } = content as {
    prompt?: string;
    placeholder?: string;
    maxWords?: number;
  };
  const text = (value as { text?: string })?.text ?? "";
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const accepted = (answer as { accepted?: string[] } | null)?.accepted ?? [];

  return (
    <div className="space-y-3">
      {prompt && <p className="text-lg leading-relaxed">{prompt}</p>}

      <input
        type="text"
        className="field-input w-full"
        disabled={disabled}
        value={text}
        placeholder={placeholder ?? ""}
        onChange={(event) => onChange({ text: event.target.value } as QuestionResponse)}
        aria-label={prompt || "Câu trả lời"}
        style={gapResultStyle(detail?.ok)}
      />

      {/* Đếm từ chỉ hiện khi người soạn ĐẶT giới hạn. Hiện một bộ đếm không có
          ngưỡng nào là bắt học sinh đoán xem bao nhiêu từ mới đủ. */}
      {maxWords ? (
        <p
          className="text-right text-xs"
          style={{ color: words > maxWords ? "var(--color-danger)" : "var(--color-text-muted)" }}
        >
          {words}/{maxWords}
        </p>
      ) : null}

      {/* Chữa bài: chỉ ra cách viết được chấp nhận. Học sinh gõ sai mà không
          biết đáng lẽ phải gõ gì thì không học được gì từ câu đó. */}
      {mode === "review" && accepted.length > 0 && (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          ✓ {accepted.join(" / ")}
        </p>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------

/**
 * Vẽ một câu hỏi — bất kể dạng nào, bất kể ra đề bằng chữ hay bằng tiếng.
 *
 * CÁCH RA ĐỀ xử lý ở ĐÂY, đúng một chỗ, chứ không nhét vào từng dạng bài. Năm
 * dạng bài × hai cách ra đề là mười nhánh phải nhớ; bọc một lớp ở ngoài thì
 * thêm một cách ra đề mới không đụng vào dạng nào cả.
 *
 * Phép biến đổi rất gọn: câu NGHE thì **gỡ `prompt` ra khỏi nội dung** truyền
 * xuống, rồi đưa nó cho `AudioPrompt` làm transcript. Nhờ vậy không renderer nào
 * biết audio là gì, và cũng không renderer nào tự vẽ đoạn chữ hai lần.
 *
 * Chỉ giấu ĐOẠN CHỮ CỦA ĐỀ — phương án, ô trống, ô nhập vẫn hiện nguyên. Giấu
 * cái ô phải điền thì câu hỏi thành không làm được, chứ không thành khó hơn.
 */
export function QuestionRenderer({
  type,
  promptKind,
  audioUrl,
  showTranscript,
  ...props
}: RendererProps & {
  type: string;
  /** `"audio"` = ra đề bằng tiếng. Vắng mặt = câu đọc, y như trước. */
  promptKind?: PromptKind | null;
  /** URL tệp nghe đã đóng băng trong đề bài. */
  audioUrl?: string | null;
  /** Đoạn chữ mở sẵn hay giấu sau nút. */
  showTranscript?: boolean | null;
}) {
  const prompt = resolvePrompt({ kind: promptKind, audioUrl, showTranscript });

  const inner = { ...props };
  let transcript: string | undefined;
  if (prompt.audio) {
    transcript = (props.content as { prompt?: string }).prompt;
    // Gỡ `prompt` khỏi nội dung truyền xuống: `AudioPrompt` là chỗ duy nhất vẽ
    // nó khi ra đề bằng tiếng. Để nguyên thì đoạn chữ hiện ở CẢ HAI chỗ, và cái
    // nút Transcript không giấu được gì.
    inner.content = { ...props.content, prompt: undefined };
  }

  const body = (() => {
    switch (type) {
      case "MCQ_SINGLE":
        return <McqRenderer {...inner} multi={false} />;
      case "MCQ_MULTI":
        return <McqRenderer {...inner} multi />;
      case "GAP_FILL":
        return <GapFillRenderer {...inner} />;
      case "GAP_DROPDOWN":
        return <GapDropdownRenderer {...inner} />;
      case "SHORT_ANSWER":
        return <ShortAnswerRenderer {...inner} />;
      default:
        return null;
    }
  })();

  if (!prompt.audio) return body;

  return (
    <div className="flex flex-col gap-4">
      <AudioPrompt
        src={prompt.audio}
        transcript={transcript}
        defaultOpen={prompt.transcriptOpen}
        toggleable={prompt.toggleable}
        // Tự phát CHỈ khi đang làm bài thật. Ở khung xem trước của giáo viên và
        // ở màn xem lại, tiếng tự nổ ra là thứ gây giật mình chứ không giúp gì:
        // họ đang đọc, không đang làm bài.
        autoPlay={props.mode === "exam"}
      />
      {body}
    </div>
  );
}

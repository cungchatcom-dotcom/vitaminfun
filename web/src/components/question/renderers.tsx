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
      <p className="text-lg font-semibold">{data.prompt}</p>

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

export function QuestionRenderer({
  type,
  ...props
}: RendererProps & { type: string }) {
  switch (type) {
    case "MCQ_SINGLE":
      return <McqRenderer {...props} multi={false} />;
    case "MCQ_MULTI":
      return <McqRenderer {...props} multi />;
    case "GAP_FILL":
      return <GapFillRenderer {...props} />;
    case "GAP_DROPDOWN":
      return <GapDropdownRenderer {...props} />;
    default:
      return null;
  }
}

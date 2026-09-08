"use client";

/**
 * Form soạn cho từng dạng câu hỏi.
 *
 * Nguyên tắc chung: builder chỉ sinh ra `content` và `answer` đúng hình dạng
 * hợp đồng dữ liệu. Nó KHÔNG tự quyết định thế nào là hợp lệ — server mới là
 * nơi chốt (`app/modules/questions/schemas.py`). Ở đây chỉ chặn những thao tác
 * làm hỏng dữ liệu ngay lúc gõ, ví dụ xoá phương án đang là đáp án đúng.
 */

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { gapKeys } from "./template";
import { TemplateEditor } from "./template-editor";
import {
  newOptionId,
  type BuilderProps,
  type GapDropdownAnswer,
  type GapDropdownContent,
  type GapFillAnswer,
  type GapFillContent,
  type McqContent,
  type McqMultiAnswer,
  type McqSingleAnswer,
  type Option,
} from "./types";

// ==========================================================================
// Trắc nghiệm
// ==========================================================================

export function McqBuilder({
  content,
  answer,
  onChange,
  multi,
}: BuilderProps & { multi: boolean }) {
  const t = useTranslations();
  const data = content as unknown as McqContent;
  const options = data.options ?? [];

  const correctIds: string[] = multi
    ? ((answer as unknown as McqMultiAnswer).correctOptionIds ?? [])
    : [(answer as unknown as McqSingleAnswer).correctOptionId].filter(Boolean);

  function emit(nextOptions: Option[], nextCorrect: string[], prompt = data.prompt) {
    onChange({
      content: { ...data, prompt, options: nextOptions },
      answer: multi
        ? { correctOptionIds: nextCorrect }
        : { correctOptionId: nextCorrect[0] ?? "" },
    });
  }

  function toggleCorrect(id: string) {
    if (!multi) {
      emit(options, [id]);
      return;
    }
    emit(
      options,
      correctIds.includes(id) ? correctIds.filter((x) => x !== id) : [...correctIds, id],
    );
  }

  function setText(id: string, text: string) {
    emit(
      options.map((o) => (o.id === id ? { ...o, text } : o)),
      correctIds,
    );
  }

  function addOption() {
    emit([...options, { id: newOptionId(), text: "" }], correctIds);
  }

  function removeOption(id: string) {
    // Bỏ luôn khỏi danh sách đáp án đúng. Không bỏ thì đáp án trỏ tới phương án
    // không còn tồn tại, và lỗi chỉ lộ ra lúc bấm Lưu.
    emit(
      options.filter((o) => o.id !== id),
      correctIds.filter((x) => x !== id),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <textarea
        className="field-input"
        rows={3}
        placeholder={t("question.builder.prompt")}
        aria-label={t("question.builder.prompt")}
        value={data.prompt ?? ""}
        onChange={(event) => emit(options, correctIds, event.target.value)}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option, index) => {
          const isCorrect = correctIds.includes(option.id);
          return (
            <div
              key={option.id}
              className="card flex items-center gap-2 p-3"
              style={{
                borderWidth: 2,
                borderColor: isCorrect
                  ? "var(--color-semantic-success)"
                  : "var(--color-surface-border)",
              }}
            >
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={isCorrect}
                title={t("question.builder.markCorrect")}
                onClick={() => toggleCorrect(option.id)}
                style={{
                  color: isCorrect
                    ? "var(--color-semantic-success)"
                    : "var(--color-text-muted)",
                }}
              >
                {isCorrect ? "✓" : "○"}
              </Button>

              <input
                className="field-input"
                placeholder={`${t("question.builder.option")} ${String.fromCharCode(65 + index)}`}
                aria-label={`${t("question.builder.option")} ${index + 1}`}
                value={option.text ?? ""}
                onChange={(event) => setText(option.id, event.target.value)}
              />

              <Button
                variant="ghost"
                size="sm"
                title={t("question.builder.removeOption")}
                onClick={() => removeOption(option.id)}
              >
                ✕
              </Button>
            </div>
          );
        })}
      </div>

      <div>
        <Button variant="secondary" size="sm" onClick={addOption}>
          {t("question.builder.addOption")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Thẻ nhập đáp án cho một ô trống.
 *
 * `thuTu` là vị trí đọc trong câu, KHÔNG phải mã nội bộ của ô. Mã nội bộ không
 * được đánh lại khi xoá ô (đánh lại là mọi đáp án đã nhập phải dịch theo, sót
 * một chỗ là gắn nhầm), nên nó có thể nhảy cóc — hiện ra cho giáo viên xem thì
 * chỉ gây rối.
 */
function GapCard({ thuTu, children }: { thuTu: number; children: React.ReactNode }) {
  const t = useTranslations();
  return (
    <div className="card p-4">
      <p className="mb-3 text-sm font-bold" style={{ color: "var(--color-brand-primary)" }}>
        {t("question.builder.blank")} {thuTu}
      </p>
      {children}
    </div>
  );
}

// ==========================================================================
// Ô trống — điền chữ
// ==========================================================================

export function GapFillBuilder({ content, answer, onChange }: BuilderProps) {
  const t = useTranslations();
  const data = content as unknown as GapFillContent;
  const ans = answer as unknown as GapFillAnswer;
  const template = data.template ?? "";
  const keys = gapKeys(template);

  function emit(nextTemplate: string, nextGaps: GapFillAnswer["gaps"]) {
    onChange({ content: { template: nextTemplate }, answer: { gaps: nextGaps } });
  }

  /**
   * Mỗi dòng là một cách viết được chấp nhận.
   *
   * ⚠️ TUYỆT ĐỐI KHÔNG `trim()` hay `filter(Boolean)` ở đây. Ô nhập này lấy giá
   * trị hiển thị từ chính mảng vừa ghi (`accepted.join("\n")`), nên mọi thứ bị
   * dọn ở đây sẽ biến mất ngay dưới ngón tay người đang gõ:
   *   • gõ dấu cách → `trim()` xoá luôn → không gõ được dấu cách
   *   • bấm Enter → dòng rỗng bị `filter` loại → không xuống dòng được
   *
   * Việc dọn dẹp thuộc về lúc LƯU, xem `sanitizeAnswer()`.
   */
  function setAccepted(key: string, raw: string) {
    emit(template, {
      ...ans.gaps,
      [key]: { ...ans.gaps?.[key], accepted: raw.split("\n") },
    });
  }

  function setTolerance(key: string, on: boolean) {
    const spec = ans.gaps?.[key] ?? { accepted: [] };
    emit(template, {
      ...ans.gaps,
      [key]: { ...spec, match: on ? { typoTolerance: 1 } : undefined },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <TemplateEditor
        template={template}
        onTemplateChange={(next) => emit(next, ans.gaps ?? {})}
        onInsertGap={(next, key) => emit(next, { ...ans.gaps, [key]: { accepted: [] } })}
      />

      {keys.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          {t("question.builder.noBlank")}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {keys.map((key, index) => {
            const spec = ans.gaps?.[key] ?? { accepted: [] };
            return (
              <GapCard key={key} thuTu={index + 1}>
                <label className="field-label" htmlFor={`gap-${key}`}>
                  {t("question.builder.acceptedAnswers")}
                </label>
                <textarea
                  id={`gap-${key}`}
                  className="field-input"
                  rows={3}
                  placeholder={t("question.builder.acceptedHint")}
                  value={(spec.accepted ?? []).join("\n")}
                  onChange={(event) => setAccepted(key, event.target.value)}
                />
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(spec.match?.typoTolerance)}
                    onChange={(event) => setTolerance(key, event.target.checked)}
                  />
                  {t("question.builder.typoTolerance")}
                </label>
              </GapCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// Ô trống — chọn từ danh sách
// ==========================================================================

export function GapDropdownBuilder({ content, answer, onChange }: BuilderProps) {
  const t = useTranslations();
  const data = content as unknown as GapDropdownContent;
  const ans = answer as unknown as GapDropdownAnswer;
  const template = data.template ?? "";
  const keys = gapKeys(template);

  function emit(
    nextTemplate: string,
    nextGaps: GapDropdownContent["gaps"],
    nextAnswer: GapDropdownAnswer["gaps"],
  ) {
    onChange({
      content: { template: nextTemplate, gaps: nextGaps },
      answer: { gaps: nextAnswer },
    });
  }

  function options(key: string): Option[] {
    return data.gaps?.[key]?.options ?? [];
  }

  /** Đáp án đúng của một ô là lựa chọn đầu tiên — vị trí 0 giữ vai trò đó. */
  function setCorrectText(key: string, text: string) {
    const current = options(key);
    const id = ans.gaps?.[key] ?? current[0]?.id ?? newOptionId();
    const rest = current.filter((o) => o.id !== id);
    emit(
      template,
      { ...data.gaps, [key]: { options: [{ id, text }, ...rest] } },
      { ...ans.gaps, [key]: id },
    );
  }

  function setWrongText(key: string, id: string, text: string) {
    emit(
      template,
      {
        ...data.gaps,
        [key]: { options: options(key).map((o) => (o.id === id ? { ...o, text } : o)) },
      },
      ans.gaps ?? {},
    );
  }

  function addWrong(key: string) {
    emit(
      template,
      { ...data.gaps, [key]: { options: [...options(key), { id: newOptionId(), text: "" }] } },
      ans.gaps ?? {},
    );
  }

  function removeWrong(key: string, id: string) {
    emit(
      template,
      { ...data.gaps, [key]: { options: options(key).filter((o) => o.id !== id) } },
      ans.gaps ?? {},
    );
  }

  /** Ô mới tạo sẵn một lựa chọn rỗng và coi nó là đáp án đúng. */
  function addGap(nextTemplate: string, key: string) {
    const id = newOptionId();
    emit(
      nextTemplate,
      { ...data.gaps, [key]: { options: [{ id, text: "" }] } },
      { ...ans.gaps, [key]: id },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <TemplateEditor
        template={template}
        onTemplateChange={(next) => emit(next, data.gaps ?? {}, ans.gaps ?? {})}
        onInsertGap={addGap}
      />

      {keys.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          {t("question.builder.noBlank")}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {keys.map((key, index) => {
            const correctId = ans.gaps?.[key];
            const all = options(key);
            const correct = all.find((o) => o.id === correctId);
            const wrong = all.filter((o) => o.id !== correctId);

            return (
              <GapCard key={key} thuTu={index + 1}>
                <label className="field-label">{t("question.builder.correctAnswer")}</label>
                <input
                  className="field-input"
                  style={{ borderColor: "var(--color-semantic-success)" }}
                  value={correct?.text ?? ""}
                  onChange={(event) => setCorrectText(key, event.target.value)}
                />

                <label className="field-label mt-3 block">
                  {t("question.builder.wrongAnswers")}
                </label>
                <div className="flex flex-col gap-2">
                  {wrong.map((option) => (
                    <div key={option.id} className="flex items-center gap-2">
                      <input
                        className="field-input"
                        value={option.text ?? ""}
                        onChange={(event) => setWrongText(key, option.id, event.target.value)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeWrong(key, option.id)}
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                  <div>
                    <Button variant="secondary" size="sm" onClick={() => addWrong(key)}>
                      {t("question.builder.addWrong")}
                    </Button>
                  </div>
                </div>
              </GapCard>
            );
          })}
        </div>
      )}

      <p className="text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
        {t("question.builder.shuffleNote")}
      </p>
    </div>
  );
}

// ==========================================================================

/**
 * Soạn câu GÕ ĐÁP ÁN.
 *
 * Hai ô: đề bài, và danh sách CÁCH VIẾT ĐƯỢC CHẤP NHẬN — mỗi dòng một cách.
 *
 * Danh sách chứ không phải một đáp án duy nhất, vì tiếng Anh có nhiều cách nói
 * đúng cùng một ý: "lower the sails", "lower sails", "lower the sails
 * immediately". Ép một cách viết duy nhất thì học sinh nói đúng vẫn bị chấm sai,
 * và đó là kiểu sai làm người ta mất lòng tin vào cả bài học.
 *
 * Hoa thường, dấu câu và khoảng trắng thừa thì server đã bỏ qua sẵn — người soạn
 * không phải liệt kê "Lower the sails!" và "lower the sails" thành hai dòng.
 */
export function ShortAnswerBuilder({ content, answer, onChange }: BuilderProps) {
  const t = useTranslations();
  const { prompt = "", placeholder = "", maxWords } = content as {
    prompt?: string;
    placeholder?: string;
    maxWords?: number;
  };
  const accepted = ((answer as { accepted?: string[] }).accepted ?? []) as string[];

  function set(nextContent: Record<string, unknown>, nextAnswer: Record<string, unknown>) {
    onChange({ content: { ...content, ...nextContent }, answer: { ...answer, ...nextAnswer } });
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="field-label">{t("question.builder.prompt")}</span>
        <textarea
          className="field-input min-h-20"
          value={prompt}
          onChange={(e) => set({ prompt: e.target.value }, {})}
        />
      </label>

      <label className="block">
        <span className="field-label">{t("question.builder.accepted")}</span>
        <textarea
          className="field-input min-h-28 font-mono text-sm"
          // Giữ nguyên CHUỖI người ta đang gõ, tách dòng khi lưu: ép về mảng sau
          // mỗi phím thì dòng trống vừa xuống bị nuốt và không gõ tiếp được.
          value={accepted.join("\n")}
          onChange={(e) =>
            set({}, { accepted: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })
          }
        />
        <span className="mt-1 block text-xs" style={{ color: "var(--color-text-muted)" }}>
          {t("question.builder.acceptedHint")}
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">{t("question.builder.placeholder")}</span>
          <input
            className="field-input"
            value={placeholder}
            onChange={(e) => set({ placeholder: e.target.value }, {})}
          />
        </label>
        <label className="block">
          <span className="field-label">{t("question.builder.maxWords")}</span>
          <input
            type="number"
            min={0}
            className="field-input"
            value={maxWords ?? ""}
            placeholder="—"
            onChange={(e) =>
              set({ maxWords: e.target.value ? Number(e.target.value) : undefined }, {})
            }
          />
        </label>
      </div>
    </div>
  );
}

// ==========================================================================

export function QuestionBuilder({ type, ...props }: BuilderProps & { type: string }) {
  switch (type) {
    case "MCQ_SINGLE":
      return <McqBuilder {...props} multi={false} />;
    case "MCQ_MULTI":
      return <McqBuilder {...props} multi />;
    case "GAP_FILL":
      return <GapFillBuilder {...props} />;
    case "GAP_DROPDOWN":
      return <GapDropdownBuilder {...props} />;
    case "SHORT_ANSWER":
      return <ShortAnswerBuilder {...props} />;
    default:
      return null;
  }
}

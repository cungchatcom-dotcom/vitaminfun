"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { ApiError } from "@/lib/api-error";
import {
  checkAnswer,
  createQuestion,
  deleteQuestion,
  getQuestion,
  updateQuestion,
  type CheckResult,
  type QuestionStatus,
  type QuestionType,
} from "@/lib/questions";
import { localizedPath } from "@/lib/routes";
import { useAsyncAction } from "@/lib/use-async-action";

import { PromptKindFields, type PromptKindValue } from "./prompt-kind-fields";
import { QuestionBuilder } from "./builders";
import { QUESTION_TYPE_META } from "./registry";
import { QuestionRenderer } from "./renderers";
import { sanitizeAnswer, sanitizeContent } from "./sanitize";
import type { QuestionResponse } from "./types";

/**
 * Trang soạn câu hỏi.
 *
 * Bố cục theo bản khảo sát: thanh trên là các thuộc tính (điểm, thời gian),
 * giữa là khung soạn, dưới là bản xem trước.
 *
 * ⭐ Bản xem trước dùng CHÍNH component hiển thị của học sinh, và nút "Thử chấm"
 * gọi API chấm thật. Giáo viên không phải tin lời hứa của giao diện — họ thấy
 * đúng điểm mà máy chủ sẽ cho.
 */
export function QuestionEditor({
  questionId,
  initialType,
}: {
  /** Có id = đang sửa; không có = đang tạo mới. */
  questionId?: string;
  initialType?: QuestionType;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [type, setType] = useState<QuestionType>(initialType ?? "MCQ_SINGLE");
  const [content, setContent] = useState<Record<string, unknown>>({});
  const [answer, setAnswer] = useState<Record<string, unknown>>({});
  const [points, setPoints] = useState(1);
  const [timeLimit, setTimeLimit] = useState<number | "">("");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("");
  const [explanation, setExplanation] = useState("");
  const [status, setStatus] = useState<QuestionStatus>("draft");
  /**
   * CÁCH RA ĐỀ — đọc hay nghe, tệp nghe, transcript mở sẵn.
   *
   * Gom vào MỘT state chứ không bốn: bốn giá trị này chỉ có nghĩa cùng nhau
   * (một câu `text` mà mang `audio_media_id` là một câu tự mâu thuẫn), và
   * `PromptKindFields` cũng nhận/trả trọn cụm.
   */
  const [prompt, setPrompt] = useState<PromptKindValue>({
    promptKind: "text",
    showTranscript: false,
    audioMediaId: null,
    audioUrl: null,
  });

  const [savedId, setSavedId] = useState<string | undefined>(questionId);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [errorParams, setErrorParams] = useState<Record<string, unknown>>({});
  const [savedAt, setSavedAt] = useState(0);
  const [loading, setLoading] = useState(Boolean(questionId));

  // Câu trả lời thử của giáo viên ở khung xem trước + kết quả server chấm.
  const [tryValue, setTryValue] = useState<QuestionResponse | null>(null);
  const [tryResult, setTryResult] = useState<CheckResult | null>(null);

  // --- Nạp câu hỏi khi sửa, hoặc dựng câu trống khi tạo mới ---
  useEffect(() => {
    if (!questionId) {
      const defaults = QUESTION_TYPE_META[initialType ?? "MCQ_SINGLE"].defaults();
      setContent(defaults.content);
      setAnswer(defaults.answer);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getQuestion(questionId);
        if (cancelled) return;
        setType(data.type);
        setContent(data.content);
        setAnswer(data.answer ?? {});
        setPoints(data.points);
        setTimeLimit(data.time_limit_seconds ?? "");
        setTopic(data.topic ?? "");
        setLevel(data.level ?? "");
        setExplanation(data.explanation ?? "");
        setStatus(data.status);
        setPrompt({
          promptKind: data.prompt_kind,
          showTranscript: data.show_transcript,
          audioMediaId: data.audio_media_id ?? null,
          audioUrl: data.audio_url ?? null,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [questionId, initialType]);

  /** Đổi dạng bài khi đang tạo mới → dựng lại câu trống của dạng đó. */
  function changeType(next: QuestionType) {
    setType(next);
    // Giữ nguyên nội dung khi chỉ chuyển giữa chọn-một và chọn-nhiều: hai dạng
    // này cùng cấu trúc đề bài, bắt nhập lại phương án là vô lý.
    const cungHoTrongNghiem =
      type.startsWith("MCQ") && next.startsWith("MCQ") && Object.keys(content).length > 0;
    if (cungHoTrongNghiem) {
      setAnswer(next === "MCQ_MULTI" ? { correctOptionIds: [] } : { correctOptionId: "" });
      return;
    }
    const defaults = QUESTION_TYPE_META[next].defaults();
    setContent(defaults.content);
    setAnswer(defaults.answer);
    setTryValue(null);
    setTryResult(null);
  }

  const save = useCallback(
    async (nextStatus: QuestionStatus) => {
      setErrorKey(null);
      // Dọn dẹp ở đúng một chỗ: ranh giới lưu. Dọn sớm hơn là xoá mất thứ người
      // dùng đang gõ dở (xem `sanitize.ts`).
      const payload = {
        type,
        points,
        time_limit_seconds: timeLimit === "" ? null : Number(timeLimit),
        content: sanitizeContent(type, content),
        answer: sanitizeAnswer(type, answer),
        explanation: explanation || null,
        topic: topic || null,
        level: level || null,
        status: nextStatus,
        prompt_kind: prompt.promptKind,
        show_transcript: prompt.showTranscript,
        // `null` ở đây nghĩa là XOÁ, không phải "không gửi" — server phân biệt
        // hai chuyện đó bằng `model_fields_set`. Nhờ vậy nút "Gỡ tệp nghe" thật
        // sự gỡ được, thay vì trả 200 rồi không đổi gì.
        audio_media_id: prompt.audioMediaId,
      };
      try {
        const saved = savedId
          ? await updateQuestion(savedId, payload)
          : await createQuestion(payload);
        setSavedId(saved.id);
        setStatus(saved.status);
        setSavedAt(Date.now());
        // Hiển thị đúng thứ vừa được lưu. Không đồng bộ lại thì ô nhập vẫn giữ
        // dòng trống và khoảng trắng thừa mà server đã bỏ — người dùng tưởng
        // chúng đã được lưu.
        setContent(saved.content);
        if (saved.answer) setAnswer(saved.answer);
        if (!savedId) {
          // Đổi URL sang bản ghi vừa tạo để bấm F5 không mất câu vừa soạn.
          router.replace(localizedPath(`/teacher/questions/${saved.id}`, locale));
        }
      } catch (error) {
        if (error instanceof ApiError) {
          setErrorKey(error.messageKey);
          setErrorParams(error.params);
        } else {
          setErrorKey("error.INTERNAL_ERROR");
        }
      }
    },
    [
      type,
      points,
      timeLimit,
      content,
      answer,
      explanation,
      topic,
      level,
      prompt,
      savedId,
      router,
      locale,
    ],
  );

  // Enter trong form không đi qua onClick của nút, nên phải có chốt riêng.
  const { run: saveDraft, pending: savingDraft } = useAsyncAction(() => save("draft"));
  const { run: publish, pending: publishing } = useAsyncAction(() => save("published"));

  async function tryGrade() {
    if (!savedId) return;
    setTryResult(await checkAnswer(savedId, tryValue as Record<string, unknown> | null));
  }

  if (loading) return <p className="p-8">{t("common.loading")}</p>;

  const meta = QUESTION_TYPE_META[type];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={savedId ? t("question.editor.editTitle") : t("question.editor.newTitle")}
        description={t(meta.descKey)}
        badge={
          <Badge tone={status === "published" ? "success" : "neutral"}>
            {t(status === "published" ? "status.published" : "status.draft")}
          </Badge>
        }
        actions={
          <>
            <LinkButton variant="ghost" href="/teacher/questions">
              {t("question.editor.back")}
            </LinkButton>
            <Button variant="secondary" loading={savingDraft} onClick={saveDraft}>
              {t("question.editor.draft")}
            </Button>
            <Button loading={publishing} onClick={publish}>
              {t("question.editor.publish")}
            </Button>
          </>
        }
      />

      {errorKey ? (
        <div
          className="mb-4 p-3 text-sm"
          role="alert"
          style={{
            borderRadius: "var(--radius-md)",
            background: "color-mix(in srgb, var(--color-semantic-danger) 12%, transparent)",
            color: "var(--color-semantic-danger)",
          }}
        >
          {t(errorKey, errorParams as Record<string, string | number>)}
        </div>
      ) : null}

      {savedAt > 0 && !errorKey ? (
        <div className="mb-4 text-sm" style={{ color: "var(--color-semantic-success)" }}>
          {t("question.editor.saved")}
        </div>
      ) : null}

      {/* --- Thuộc tính --- */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="field" style={{ width: "6rem" }}>
            <span className="field-label">{t("question.editor.points")}</span>
            <input
              className="field-input"
              type="number"
              min={1}
              max={100}
              value={points}
              onChange={(event) => setPoints(Number(event.target.value) || 1)}
            />
          </label>

          <label className="field" style={{ width: "9rem" }}>
            <span className="field-label">{t("question.editor.timeLimit")}</span>
            <input
              className="field-input"
              type="number"
              min={5}
              max={3600}
              placeholder="—"
              value={timeLimit}
              onChange={(event) =>
                setTimeLimit(event.target.value === "" ? "" : Number(event.target.value))
              }
            />
          </label>

          <label className="field" style={{ flex: 1, minWidth: "10rem" }}>
            <span className="field-label">{t("question.editor.topic")}</span>
            <input
              className="field-input"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            />
          </label>

          <label className="field" style={{ width: "8rem" }}>
            <span className="field-label">{t("question.editor.level")}</span>
            <input
              className="field-input"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
            />
          </label>
        </div>

        {/* Chọn một / chọn nhiều — công tắc, không phải hai dạng riêng trong menu */}
        {type.startsWith("MCQ") ? (
          <div className="mt-4 flex gap-2">
            {(["MCQ_SINGLE", "MCQ_MULTI"] as const).map((option) => (
              <Button
                key={option}
                size="sm"
                variant={type === option ? "primary" : "secondary"}
                onClick={() => changeType(option)}
              >
                {t(QUESTION_TYPE_META[option].labelKey)}
              </Button>
            ))}
          </div>
        ) : null}

        {/* CÁCH RA ĐỀ nằm cùng thẻ thuộc tính, dưới đường kẻ: nó là một thuộc
            tính của câu hỏi, không phải một phần của nội dung. Người soạn chọn
            "nghe" rồi mới gõ đề — mà đề chính là transcript. */}
        <div className="mt-4 border-t border-abyss-800 pt-4">
          <PromptKindFields value={prompt} onChange={setPrompt} />
        </div>
      </Card>

      {/* --- Khung soạn --- */}
      <Card className="mb-4">
        <QuestionBuilder
          type={type}
          content={content}
          answer={answer}
          onChange={(next) => {
            setContent(next.content);
            setAnswer(next.answer);
            // Nội dung đổi thì kết quả chấm cũ không còn đúng nữa.
            setTryResult(null);
          }}
        />

        {/* CÂU CHÊ RIÊNG của bài này.
            Nằm trong `content` chứ không phải một cột riêng: nó là một phần của
            đề bài, đóng băng cùng đề bài, và KHÔNG tiết lộ đáp án — nên gửi
            xuống máy học sinh được. Xem `import_world_01.py`.

            Để trống thì người canh giữ dùng bộ câu chê của WORLD. Đây là chỗ
            viết một câu chê CHỈ hợp với bài này, ví dụ nhắc đúng cái bẫy mà bài
            đang giăng ra. */}
        <label className="field mt-4">
          <span className="field-label">{t("question.editor.wrongMessage")}</span>
          <textarea
            className="field-input"
            rows={2}
            placeholder={t("question.editor.wrongMessageHint")}
            value={(content.wrong_answer_message as string) ?? ""}
            onChange={(event) =>
              setContent((before) => ({
                ...before,
                // Xoá trắng = GỠ hẳn khoá, không để lại chuỗi rỗng: một chuỗi
                // rỗng vẫn là "có câu riêng", và người canh giữ sẽ nói một câu
                // trống thay vì lùi về bộ của world.
                wrong_answer_message: event.target.value || undefined,
              }))
            }
          />
        </label>

        <label className="field mt-4">
          <span className="field-label">{t("question.editor.explanation")}</span>
          <textarea
            className="field-input"
            rows={2}
            placeholder={t("question.editor.explanationHint")}
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
          />
        </label>
      </Card>

      {/* --- Xem trước --- */}
      <Card>
        <SectionTitle>{t("question.editor.preview")}</SectionTitle>
        <p className="mb-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
          {t("question.editor.previewHint")}
        </p>

        <div
          className="p-4"
          style={{
            borderRadius: "var(--radius-md)",
            background: "var(--color-surface-muted)",
          }}
        >
          <QuestionRenderer
            type={type}
            // Xem trước bằng CHÍNH cách học sinh sẽ thấy, kể cả cái nút
            // Transcript: một khung xem trước bỏ qua cách ra đề thì giáo viên
            // căn xong một câu nghe mà chưa từng nhìn thấy nó ở dạng nghe.
            promptKind={prompt.promptKind}
            audioUrl={prompt.audioUrl}
            showTranscript={prompt.showTranscript}
            content={content}
            value={tryValue}
            onChange={(next) => {
              setTryValue(next);
              setTryResult(null);
            }}
            mode="preview"
            detail={tryResult?.detail?.gaps ?? null}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={!savedId} onClick={tryGrade}>
            {t("question.editor.tryIt")}
          </Button>
          {tryResult ? (
            <Badge tone={tryResult.is_correct ? "success" : "warning"}>
              {t("question.editor.result", {
                score: tryResult.score,
                max: tryResult.max_score,
              })}
            </Badge>
          ) : null}
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {savedId ? t("question.editor.tryItHint") : t("question.editor.saveFirst")}
          </span>
        </div>
      </Card>

      {savedId ? (
        <div className="mt-6 flex justify-end">
          <Button
            variant="danger"
            onClick={async () => {
              await deleteQuestion(savedId);
              router.push(localizedPath("/teacher/questions", locale));
            }}
          >
            {t("question.editor.delete")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

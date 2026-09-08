/**
 * Sổ đăng ký dạng câu hỏi phía giao diện.
 *
 * Thêm một dạng bài = thêm một mục ở đây + một nhánh trong `builders.tsx` và
 * `renderers.tsx` + schema và hàm chấm ở backend. Trang soạn và màn chọn loại
 * không phải sửa gì.
 */

import type { QuestionType } from "@/lib/questions";

import { gapKeys } from "./template";
import { newOptionId, type AnswerState, type QuestionResponse } from "./types";

export interface QuestionTypeMeta {
  type: QuestionType;
  labelKey: string;
  descKey: string;
  icon: string;
  defaults: () => { content: Record<string, unknown>; answer: Record<string, unknown> };
  /** Hiện ở màn chọn loại. Biến thể (chọn nhiều đáp án) bật từ trong trang soạn. */
  inPicker: boolean;
  /**
   * Câu này đã được trả lời tới đâu — dùng cho thanh tiến độ và hộp xác nhận
   * nộp bài.
   *
   * Đặt ở sổ đăng ký chứ không viết một hàm `switch` riêng ở màn làm bài: kiểu
   * `Record<QuestionType, …>` bắt buộc dạng mới phải khai báo, nên không thể có
   * dạng nào lọt lưới rồi lúc nào cũng bị đếm là "chưa làm".
   *
   * ⚠️ Đây KHÔNG phải chấm điểm — hàm này chỉ biết "có điền gì chưa", hoàn toàn
   * không biết đáp án đúng. Chấm điểm chỉ có một bản, viết bằng Python.
   */
  progress: (content: Record<string, unknown>, response: QuestionResponse) => AnswerState;
}

/**
 * Đếm ô trống đã điền — dùng chung cho `GAP_FILL` và `GAP_DROPDOWN`.
 *
 * Đếm theo ô trống có trong ĐỀ, không đếm theo khoá có trong câu trả lời: gõ
 * rồi xoá đi vẫn để lại khoá với chuỗi rỗng, đếm theo đó thì ô bỏ trống lại
 * được tính là đã làm.
 */
function tienDoOTrong(
  content: Record<string, unknown>,
  response: QuestionResponse,
): AnswerState {
  const keys = gapKeys((content as { template?: string }).template ?? "");
  const gaps = (response as { gaps?: Record<string, string | null> }).gaps ?? {};
  const daDien = keys.filter((key) => (gaps[key] ?? "").trim() !== "").length;
  if (daDien === 0) return "empty";
  return daDien === keys.length ? "full" : "partial";
}

export const QUESTION_TYPE_META: Record<QuestionType, QuestionTypeMeta> = {
  MCQ_SINGLE: {
    type: "MCQ_SINGLE",
    labelKey: "question.type.mcq",
    descKey: "question.type.mcqDesc",
    icon: "✅",
    inPicker: true,
    progress: (_content, response) =>
      (response as { selectedOptionId?: string | null }).selectedOptionId ? "full" : "empty",
    defaults: () => ({
      // Bốn phương án là mặc định của hầu hết đề thi tiếng Anh thiếu nhi —
      // giáo viên xoá bớt nhanh hơn là thêm vào.
      content: {
        prompt: "",
        options: Array.from({ length: 4 }, () => ({ id: newOptionId(), text: "" })),
      },
      answer: { correctOptionId: "" },
    }),
  },
  MCQ_MULTI: {
    type: "MCQ_MULTI",
    labelKey: "question.type.mcqMulti",
    descKey: "question.type.mcqDesc",
    icon: "☑️",
    inPicker: false,
    // Chọn được một phương án là coi như đã trả lời. Không ép phải chọn đủ số
    // đáp án đúng — số đó là bí mật của đề, màn làm bài không được biết.
    progress: (_content, response) =>
      ((response as { selectedOptionIds?: string[] }).selectedOptionIds ?? []).length
        ? "full"
        : "empty",
    defaults: () => ({
      content: {
        prompt: "",
        options: Array.from({ length: 4 }, () => ({ id: newOptionId(), text: "" })),
      },
      answer: { correctOptionIds: [] },
    }),
  },
  GAP_FILL: {
    type: "GAP_FILL",
    labelKey: "question.type.gapFill",
    descKey: "question.type.gapFillDesc",
    icon: "✏️",
    inPicker: true,
    progress: tienDoOTrong,
    defaults: () => ({ content: { template: "" }, answer: { gaps: {} } }),
  },
  GAP_DROPDOWN: {
    type: "GAP_DROPDOWN",
    labelKey: "question.type.dropdown",
    descKey: "question.type.dropdownDesc",
    icon: "🔽",
    inPicker: true,
    progress: tienDoOTrong,
    defaults: () => ({ content: { template: "", gaps: {} }, answer: { gaps: {} } }),
  },
  SHORT_ANSWER: {
    type: "SHORT_ANSWER",
    labelKey: "question.type.shortAnswer",
    descKey: "question.type.shortAnswerDesc",
    icon: "⌨️",
    inPicker: true,
    // Một ô chữ: hoặc có chữ hoặc không, không có nấc giữa.
    progress: (_content, response) =>
      ((response as { text?: string }).text ?? "").trim() ? "full" : "empty",
    defaults: () => ({ content: { prompt: "" }, answer: { accepted: [] } }),
  },
};

export const PICKER_TYPES = Object.values(QUESTION_TYPE_META).filter((meta) => meta.inPicker);

export function isQuestionType(value: string): value is QuestionType {
  return value in QUESTION_TYPE_META;
}

/**
 * Một câu trong bài làm đã được điền tới đâu.
 *
 * Nhận `type` là chuỗi thô vì đề đã được **chụp lại** vào bài làm: một bài nộp
 * năm ngoái có thể chứa dạng mà bản hiện tại không còn dựng nữa.
 */
export function answerState(
  type: string,
  content: Record<string, unknown>,
  response: QuestionResponse | null | undefined,
): AnswerState {
  if (!response) return "empty";
  // Dạng lạ thì coi như đã trả lời khi có dữ liệu: thà không cảnh báo còn hơn
  // báo "chưa làm" suốt buổi cho một câu học sinh đã làm xong.
  if (!isQuestionType(type)) return "full";
  return QUESTION_TYPE_META[type].progress(content, response);
}

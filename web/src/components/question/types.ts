/**
 * Kiểu dữ liệu của từng dạng câu hỏi phía giao diện.
 *
 * Bám sát `docs/question-schemas.md` — file đó là nguồn chân lý, đây chỉ là
 * bản khai báo kiểu để TypeScript bắt lỗi sớm. Backend vẫn kiểm lại toàn bộ.
 */

import type { QuestionStatus, QuestionType } from "@/lib/questions";

export interface Option {
  id: string;
  text?: string;
}

export interface McqContent {
  prompt: string;
  options: Option[];
  shuffleOptions?: boolean;
}

export interface McqSingleAnswer {
  correctOptionId: string;
}

export interface McqMultiAnswer {
  correctOptionIds: string[];
  allOrNothing?: boolean;
}

export interface GapFillContent {
  template: string;
}

export interface GapFillAnswer {
  gaps: Record<string, { accepted: string[]; match?: { typoTolerance?: number } }>;
}

export interface GapDropdownContent {
  template: string;
  gaps: Record<string, { options: Option[] }>;
  shuffleOptions?: boolean;
}

export interface GapDropdownAnswer {
  gaps: Record<string, string>;
}

/** Trạng thái đang soạn của một câu hỏi, trước khi gửi lên server. */
export interface QuestionDraft {
  type: QuestionType;
  points: number;
  timeLimitSeconds: number | null;
  content: Record<string, unknown>;
  answer: Record<string, unknown>;
  explanation: string;
  topic: string;
  level: string;
  status: QuestionStatus;
}

/** Câu trả lời của người làm bài — hình dạng khác nhau theo dạng câu hỏi. */
export type QuestionResponse =
  | { selectedOptionId: string | null }
  | { selectedOptionIds: string[] }
  | { gaps: Record<string, string | null> };

/**
 * Câu đã được trả lời tới đâu.
 *
 * `partial` chỉ xuất hiện ở dạng nhiều ô trống: điền 1 trong 3 ô mà báo "đã
 * làm" là nói dối, mà báo "chưa làm" cũng sai. Hộp xác nhận nộp bài cần phân
 * biệt được để cảnh báo đúng chỗ.
 */
export type AnswerState = "empty" | "partial" | "full";

export interface RendererProps {
  content: Record<string, unknown>;
  value: QuestionResponse | null;
  onChange: (value: QuestionResponse) => void;
  /** `preview` = giáo viên thử làm · `exam` = học sinh làm thật · `review` = xem lại */
  mode: "preview" | "exam" | "review";
  /** Đúng/sai từng mục con, chỉ có sau khi server chấm. */
  detail?: Record<string, boolean> | null;
  /**
   * Đáp án đúng — CHỈ có ở chế độ `review`, sau khi đã nộp bài.
   *
   * Màn chữa bài mà không chỉ ra đâu mới là đáp án đúng thì học sinh biết mình
   * sai nhưng không học được gì. Ở chế độ `exam` giá trị này luôn `null` vì
   * server không gửi xuống.
   */
  answer?: Record<string, unknown> | null;
  disabled?: boolean;
}

export interface BuilderProps {
  content: Record<string, unknown>;
  answer: Record<string, unknown>;
  onChange: (next: {
    content: Record<string, unknown>;
    answer: Record<string, unknown>;
  }) => void;
}

/** Sinh mã định danh cho lựa chọn mới.

 * Dùng mã ngẫu nhiên ngắn chứ không dùng "a, b, c" theo vị trí: xoá phương án
 * giữa chừng thì các mã sau bị dịch, mà đáp án đúng lại trỏ theo mã — kết quả
 * là đáp án nhảy sang phương án khác mà không ai thấy.
 */
export function newOptionId(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Dọn dẹp nội dung câu hỏi TRƯỚC KHI LƯU — và chỉ trước khi lưu.
 *
 * ⭐ Vì sao phải là một bước riêng, không dọn ngay lúc gõ:
 *
 * Các ô nhập trong builder đều là *controlled* — giá trị hiển thị lấy từ chính
 * dữ liệu vừa ghi. Nếu dọn ngay trong `onChange` thì mọi thứ bị dọn sẽ biến mất
 * dưới ngón tay người đang gõ. Đã xảy ra thật: ô "các cách viết được chấp nhận"
 * `trim()` mỗi lần gõ nên **không gõ nổi dấu cách**, và `filter(Boolean)` nuốt
 * dòng rỗng nên **không bấm Enter xuống dòng được**.
 *
 * Quy tắc rút ra: trong lúc soạn thì giữ nguyên từng ký tự người dùng gõ; dọn
 * một lần duy nhất ở ranh giới lưu.
 */

import type { QuestionType } from "@/lib/questions";

import type { GapDropdownContent, GapFillAnswer, McqContent, Option } from "./types";

export function sanitizeAnswer(
  type: QuestionType,
  answer: Record<string, unknown>,
): Record<string, unknown> {
  if (type !== "GAP_FILL") return answer;

  const gaps = (answer as unknown as GapFillAnswer).gaps ?? {};
  const cleaned: GapFillAnswer["gaps"] = {};

  for (const [key, spec] of Object.entries(gaps)) {
    cleaned[key] = {
      ...spec,
      // Bỏ dòng trống và khoảng trắng thừa hai đầu. Giữ nguyên khoảng trắng ở
      // GIỮA: "a red ball" là một đáp án hợp lệ và rất phổ biến.
      accepted: (spec.accepted ?? []).map((line) => line.trim()).filter(Boolean),
    };
  }
  return { gaps: cleaned };
}

export function sanitizeContent(
  type: QuestionType,
  content: Record<string, unknown>,
): Record<string, unknown> {
  if (type === "MCQ_SINGLE" || type === "MCQ_MULTI") {
    const data = content as unknown as McqContent;
    return {
      ...data,
      prompt: (data.prompt ?? "").trim(),
      options: (data.options ?? []).map(trimOption),
    };
  }

  if (type === "GAP_DROPDOWN") {
    const data = content as unknown as GapDropdownContent;
    const gaps: GapDropdownContent["gaps"] = {};
    for (const [key, spec] of Object.entries(data.gaps ?? {})) {
      gaps[key] = { options: (spec.options ?? []).map(trimOption) };
    }
    return { ...data, template: (data.template ?? "").trim(), gaps };
  }

  if (type === "GAP_FILL") {
    const data = content as { template?: string };
    return { ...data, template: (data.template ?? "").trim() };
  }

  return content;
}

function trimOption(option: Option): Option {
  return option.text === undefined ? option : { ...option, text: option.text.trim() };
}

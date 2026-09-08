'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { CompactAudio } from './compact-audio';
import { fitProseSize } from './fit-text';

/**
 * CÁCH RA ĐỀ — đề bài đến với người làm bài bằng cách nào.
 *
 * Vuông góc với dạng câu hỏi (`MCQ_SINGLE`, `SHORT_ANSWER`…), vốn nói người làm
 * bài TRẢ LỜI bằng cách nào. Xem `docs/GAME_DOMAIN.md` §3c.
 */
export type PromptKind = 'text' | 'audio';

/**
 * Đề bài hiện ra như thế nào, sau khi đã tính hết mọi trường hợp thiếu dữ liệu.
 *
 * MỘT hàm cho cả khung xem trước của giáo viên lẫn màn học sinh. Hai bản của
 * cùng một luật thì có ngày giáo viên xem trước thấy một đằng, học sinh thấy
 * một nẻo — và bản sai là bản giáo viên tin tưởng.
 */
export function resolvePrompt({
  kind,
  audioUrl,
  showTranscript,
}: {
  kind: PromptKind | null | undefined;
  audioUrl: string | null | undefined;
  showTranscript: boolean | null | undefined;
}): { audio: string | null; transcriptOpen: boolean; toggleable: boolean } {
  // Câu ĐỌC: không có gì để nghe, đoạn chữ hiện thẳng như xưa nay.
  if (kind !== 'audio') return { audio: null, transcriptOpen: true, toggleable: false };

  // Câu NGHE nhưng CHƯA CÓ FILE. Server không chặn trạng thái này — giáo viên
  // phải đặt được cách ra đề trước rồi mới tải file lên, chứ không thì không có
  // thứ tự thao tác nào hợp lệ. Nên chặn ở chỗ VẼ: không có tiếng thì đoạn chữ
  // hiện ra như một câu đọc bình thường.
  //
  // Không có dòng này thì học sinh nhìn vào một khoảng trống: không audio để
  // nghe, không chữ để đọc, và không có gì trên màn hình nói vì sao.
  if (!audioUrl) return { audio: null, transcriptOpen: true, toggleable: false };

  return { audio: audioUrl, transcriptOpen: Boolean(showTranscript), toggleable: true };
}

/**
 * Trình phát của một câu hỏi NGHE, kèm nút mở transcript.
 *
 * ## Tự phát, nhưng không bao giờ kẹt
 *
 * Đến câu nghe thì audio tự chạy — xem `CompactAudio`, chỗ giữ cả cú tự phát
 * lẫn cái nút cứu khi trình duyệt từ chối.
 *
 * ## Cỡ chữ CO THEO độ dài
 *
 * Đoạn chữ này do người dựng viết và dài ngắn tuỳ ý. Một cỡ cố định thì hoặc
 * quá bé cho một câu thoại ngắn, hoặc làm cái khung phình ra khỏi màn hình với
 * một đoạn dài — và cái nút ở cuối khung trôi đi mất. Xem `fitProseSize()`.
 *
 * ## Transcript chính là đề bài
 *
 * Không có trường thứ hai: `transcript` nhận thẳng `content.prompt`. Một bản
 * chép lời riêng là một bản sao có thể lệch với thứ đang phát, và không có gì
 * bắt hai bên khớp nhau.
 */
export function AudioPrompt({
  src,
  transcript,
  defaultOpen,
  toggleable,
  autoPlay = false,
}: {
  src: string;
  /** Đoạn chữ của đề — chính là `content.prompt`. */
  transcript?: string;
  /** Mở sẵn hay giấu sau nút. Do `questions.show_transcript` quyết định. */
  defaultOpen: boolean;
  /** Có nút mở/đóng hay không. Không có đề bài dạng chữ thì không có gì để mở. */
  toggleable: boolean;
  /** Tự chạy khi hiện ra. Tắt ở khung xem trước của giáo viên. */
  autoPlay?: boolean;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(defaultOpen);

  // Đổi câu là đổi trạng thái mở/đóng theo câu MỚI. Không có dòng này thì mở
  // transcript ở câu 1 rồi sang câu 2 vẫn thấy mở, dù câu 2 đặt là đóng.
  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen, src]);

  return (
    <div className="flex flex-col gap-2">
      {/* Cụm gọn, KHÔNG chiếm hết bề rộng: nó là một nút bấm, không phải một
          tấm bảng. `self-start` giữ nó nép về mép trái thay vì giãn ra theo
          khung — thẻ `<audio controls>` cũ giãn hết cỡ và trở thành thứ to nhất
          trên bảng, to hơn cả lời NPC. */}
      <CompactAudio src={src} autoPlay={autoPlay} className="self-start" />

      {toggleable && transcript && (
        <div>
          <button
            type="button"
            onClick={() => setOpen((before) => !before)}
            aria-expanded={open}
            className="rounded-lg px-2 py-1 text-xs font-medium text-lagoon-400 transition hover:bg-lagoon-500/10"
          >
            {open ? '▾' : '▸'} {t('question.transcript')}
          </button>
          {open && (
            <p
              className="mt-1 leading-relaxed font-semibold"
              style={{ fontSize: fitProseSize(transcript) }}
            >
              {transcript}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

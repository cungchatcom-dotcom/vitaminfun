'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import {
  PromptKindFields,
  type PromptKindValue,
} from '@/components/question/prompt-kind-fields';
import { QuestionRenderer } from '@/components/question/renderers';
import { QUESTION_TYPE_META } from '@/components/question/registry';
import { Badge } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { ApiError } from '@/lib/api-error';
import { getQuestion, updateQuestion, type QuestionSummary } from '@/lib/questions';

import { AnswerVoicePicker, QuestionAudioPanel, useAnswerVoices } from './audio-tools';
import { QuestionAudioList } from './question-audio-list';

/**
 * Popup xem một câu hỏi kèm đáp án.
 *
 * Dùng lại `QuestionRenderer` ở chế độ `review` — cùng component học sinh nhìn
 * thấy, chỉ khác là có tô đáp án đúng. Không vẽ lại một bản riêng: hai bản vẽ
 * cho cùng một dạng bài thì sẽ có ngày chúng hiện khác nhau, và bản sai là bản
 * giáo viên tin tưởng.
 *
 * Đáp án chỉ có ở đây vì đây là màn của GIÁO VIÊN. Học sinh không bao giờ gọi
 * `GET /questions/{id}`.
 *
 * ## Sửa được CÁCH RA ĐỀ ngay tại đây
 *
 * Ba ô — đọc/nghe, tệp nghe, transcript mở sẵn — sửa và lưu ngay trong popup.
 * Chúng là thứ người dựng chỉnh trong lúc ghép nhiệm vụ, và bắt mở trang soạn
 * ở tab khác cho một cú bấm checkbox là mất mạch: họ đang so hai mươi sáu câu
 * với nhau, không đang soạn một câu.
 *
 * Phần còn lại (đề bài, phương án, đáp án) vẫn chỉ ĐỌC. Sửa nội dung là việc
 * cần khung soạn đầy đủ kèm kiểm tra đáp án — nhét vào một popup đang mở đè lên
 * bản đồ màn chơi thì làm nửa vời cả hai việc.
 */
export function QuestionViewer({
  questionId,
  questId,
  worldId,
  onClose,
}: {
  questionId: string;
  /**
   * Nhiệm vụ mà câu này đang nằm trong — để biết NGƯỜI CANH GIỮ nào đọc đề bài.
   *
   * Không bắt buộc: popup mở ra từ nhiều nơi, và ở kho câu hỏi thì câu chưa
   * thuộc nhiệm vụ nào cả. Thiếu nó thì phần đề bài không sinh được, còn phần
   * đáp án vẫn sinh bình thường.
   */
  questId?: string;
  /** World đang dựng — dàn nhân vật đọc phương án lấy từ đây. */
  worldId?: string;
  onClose: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [question, setQuestion] = useState<QuestionSummary | null>(null);
  //: Lỗi NẠP — chặn cả popup, vì không có gì để hiện.
  const [errorKey, setErrorKey] = useState<string | null>(null);
  //: Lỗi LƯU — hiện tại chỗ, không được nuốt mất câu hỏi đang xem. Gộp hai loại
  //: vào một state thì một lần lưu hỏng sẽ xoá trắng popup, và người dùng mất
  //: luôn thứ họ đang đọc chỉ vì bấm nhầm một cái checkbox.
  const [saveErrorKey, setSaveErrorKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  //: Đổi mỗi lần sinh xong một mẻ, để danh sách bản thu nạp lại.
  const [audioKey, setAudioKey] = useState(0);

  //: Nghe phương án bằng giọng của ai. Một câu có thể đã thu bằng nhiều giọng,
  //: mà bốn cái loa cạnh bốn phương án chỉ phát được một giọng tại một lúc.
  const giong = useAnswerVoices(questionId, worldId, audioKey);

  /**
   * Lưu NGAY cách ra đề vừa đổi.
   *
   * Không có nút Lưu trong popup, cùng nếp với trình thiết kế màn chơi: mỗi ô ở
   * đây là một câu nói trọn vẹn ("câu này để nghe"), không phải một mẩu của một
   * biểu mẫu phải điền xong mới có nghĩa.
   */
  async function savePrompt(next: PromptKindValue) {
    // Vẽ ngay theo giá trị mới, không đợi mạng: bấm một checkbox mà phải chờ
    // server trả lời mới thấy nó tích là một cái checkbox có vẻ hỏng.
    setQuestion((before) =>
      before
        ? {
            ...before,
            prompt_kind: next.promptKind,
            show_transcript: next.showTranscript,
            audio_media_id: next.audioMediaId,
            audio_url: next.audioUrl,
          }
        : before,
    );
    setSaving(true);
    setSaveErrorKey(null);
    try {
      const saved = await updateQuestion(questionId, {
        prompt_kind: next.promptKind,
        show_transcript: next.showTranscript,
        // `null` = XOÁ tệp nghe. Server phân biệt "gửi null" với "không gửi".
        audio_media_id: next.audioMediaId,
      });
      setQuestion(saved);
    } catch (error) {
      setSaveErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
      // Nạp lại để màn hình thôi hiện một thứ server đã từ chối.
      void getQuestion(questionId).then(setQuestion).catch(() => undefined);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    getQuestion(questionId)
      .then((q) => {
        if (!cancelled) setQuestion(q);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [questionId]);

  return (
    // `Modal` lo cả việc vẽ ra `body`, bấm nền để đóng, và phím Escape.
    <Modal label={t('stage.viewer.title')} onClose={onClose}>
      {/* Tiêu đề ĐỨNG YÊN, thân cuộn — cùng nếp với popup sửa nhiệm vụ mà
          popup này mở ra từ đó. Cuộn cả cái thì nút đóng trôi mất. */}
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-abyss-700 bg-abyss-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-abyss-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-100">{t('stage.viewer.title')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('stage.viewer.close')}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-abyss-800 hover:text-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {errorKey ? (
            <p role="alert" className="text-sm text-coral-500">
              {t(errorKey)}
            </p>
          ) : !question ? (
            <p className="text-sm text-slate-400">{t('common.loading')}</p>
          ) : (
            /**
             * HAI CỘT: bên trái là CÂU HỎI, bên phải là những thứ LÀM VỚI nó.
             *
             * Xếp dọc một cột thì bản xem trước bị đẩy xuống dưới hai khối cấu
             * hình, và thứ người dựng mở popup ra để xem lại là thứ phải cuộn
             * mới thấy. `minmax(0,1fr)` chứ không phải `1fr`: `1fr` có sàn là
             * chiều rộng nội dung, nên một trình phát audio hay một từ dài là
             * cả popup mọc ra thanh cuộn NGANG.
             */
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="min-w-0 space-y-5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone="info">
                    {t(QUESTION_TYPE_META[question.type]?.labelKey ?? 'field.type')}
                  </Badge>
                  <Badge tone={question.status === 'published' ? 'success' : 'neutral'}>
                    {t(question.status === 'published' ? 'status.published' : 'status.draft')}
                  </Badge>
                  {question.level && <span className="text-slate-500">{question.level}</span>}
                  {question.topic && <span className="text-slate-500">{question.topic}</span>}
                </div>

                <QuestionRenderer
                  type={question.type}
                  promptKind={question.prompt_kind}
                  audioUrl={question.audio_url}
                  showTranscript={question.show_transcript}
                  content={question.content}
                  value={null}
                  onChange={() => {}}
                  // `review` = tô đáp án đúng. Chính component học sinh dùng.
                  mode="review"
                  answer={question.answer}
                  // Mỗi phương án có tiếng thì mọc một cái loa nhỏ để bấm nghe.
                  optionAudio={giong.optionAudio}
                  disabled
                />

                {/* NGHE BẰNG GIỌNG AI — ngay dưới các phương án, vì nó đổi thứ
                    mấy cái loa ở trên phát ra. Không có bản thu nào thì hàng
                    này không hiện. */}
                <AnswerVoicePicker
                  nhanVat={giong.nhanVat}
                  dangChon={giong.dangChon}
                  onPick={giong.setChon}
                  locale={locale}
                />

                {question.explanation && (
                  <div className="rounded-xl border border-abyss-800 bg-abyss-950/40 p-4">
                    <p className="mb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                      {t('question.editor.explanation')}
                    </p>
                    <p className="text-sm break-words whitespace-pre-wrap text-slate-300">
                      {question.explanation}
                    </p>
                  </div>
                )}

                {question.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {question.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-abyss-800 px-2 py-0.5 font-mono text-xs text-slate-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="min-w-0 space-y-4">
                {/* Sửa được ngay tại đây: đổi sang "nghe" thì bản xem trước bên
                    trái biến thành trình phát kèm nút Transcript. */}
                <div className="rounded-xl border border-abyss-800 bg-abyss-950/40 p-4">
                  <PromptKindFields
                    value={{
                      promptKind: question.prompt_kind,
                      showTranscript: question.show_transcript,
                      audioMediaId: question.audio_media_id ?? null,
                      audioUrl: question.audio_url ?? null,
                    }}
                    onChange={(next) => void savePrompt(next)}
                    disabled={saving}
                  />
                  {saveErrorKey && (
                    <p role="alert" className="mt-2 text-xs text-coral-500">
                      {t(saveErrorKey)}
                    </p>
                  )}
                </div>

                <QuestionAudioPanel
                  questionId={question.id}
                  questId={questId}
                  worldId={worldId}
                  locale={locale}
                  onError={setSaveErrorKey}
                  onGenerated={() => {
                    setAudioKey((n) => n + 1);
                    // Nạp lại CÂU HỎI, không chỉ danh sách bản thu: tiếng đề
                    // bài vừa sinh được gắn luôn vào `audio_media_id`, nên ô
                    // tải tệp nghe ngay trên phải thôi báo "chưa có tệp nghe".
                    void getQuestion(questionId).then(setQuestion, () => undefined);
                  }}
                />

                <QuestionAudioList
                  questionId={question.id}
                  currentMediaId={question.audio_media_id}
                  refreshKey={audioKey}
                  // Đổi giọng đang dùng: bản thu đã nằm sẵn trong kho nên đây
                  // chỉ là trỏ lại, không gọi nhà cung cấp, không tốn gì.
                  onPick={(mediaId) =>
                    void savePrompt({
                      promptKind: 'audio',
                      showTranscript: question.show_transcript,
                      audioMediaId: mediaId,
                      audioUrl: null,
                    })
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

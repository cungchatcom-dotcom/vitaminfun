'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { InlineName } from '@/components/ui/inline-name';
import { Modal } from '@/components/ui/modal';
import { ApiError } from '@/lib/api-error';
import { questLabel } from '@/lib/quest-label';
import type { QuestionSummary } from '@/lib/questions';
import {
  addQuestQuestions,
  removeQuestQuestion,
  updateQuest,
  updateQuestQuestion,
  updateStage,
  type Quest,
  type Stage,
} from '@/lib/worlds';

import { OutroVoiceButton, QuestAudioPanel } from './audio-tools';
import { CluebookPanel } from './cluebook-panel';
import { LockedMessageField } from './locked-message-field';
import { NpcField, useNpcs } from './npc-field';
import { QuestionPicker } from './question-picker';
import { QuestionViewer } from './question-viewer';

/** Điểm mặc định khi lắp một câu hỏi vào nhiệm vụ. Phải khớp backend. */
const DEFAULT_POINTS = 10;

/**
 * Popup sửa một nhiệm vụ — hai cột.
 *
 *   Trái  : tuỳ chỉnh KHÔNG nhìn thấy trên bản đồ (khoá vật thể, giai đoạn,
 *           điểm qua ải, năng lượng)
 *   Phải  : danh sách câu hỏi đang có + kho câu hỏi để lắp thêm
 *
 * Ảnh và bán kính CỐ Ý không ở đây — chúng nằm ở bảng bên phải màn thiết kế.
 * Nguyên tắc: thứ gì đổi HÌNH DÁNG trên bản đồ thì phải sửa ở chỗ nhìn thấy bản
 * đồ; sửa trong popup che mất cảnh là sửa mù. Cái tên thì không đổi hình dáng gì
 * cả, nên nó sửa được ngay ở tiêu đề — và phải sửa được, vì màn gán câu hỏi cũng
 * sửa đúng cái tên ấy.
 *
 * Mọi thay đổi lưu ngay, không có nút "Lưu": một nút Lưu là thêm một chỗ để
 * mất công.
 */
export function QuestEditorDialog({
  quest,
  stage,
  worldId,
  locale,
  stageCode,
  onChanged,
  onStagePatch,
  onReload,
  onClose,
}: {
  quest: Quest;
  /**
   * Màn chơi chứa nhiệm vụ này — CHỈ để soạn lời chia tay và sổ tay.
   *
   * Ba trường ấy thuộc về `stages`, nhưng khoảnh khắc chúng vang lên thuộc về
   * nhiệm vụ NPC, và giọng đọc lấy từ chính người canh giữ ở cột bên trái.
   */
  stage: Stage;
  /** World đang dựng — dàn nhân vật đọc phương án lấy từ đây. */
  worldId?: string;
  locale: string;
  /** Mã màn chơi đang mở — bộ chọn câu hỏi lọc sẵn theo nó. */
  stageCode?: string | null;
  onChanged: (quest: Quest) => void;
  onStagePatch: (payload: Parameters<typeof updateStage>[1]) => void;
  onReload: () => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations();

  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [picked, setPicked] = useState<Map<string, QuestionSummary>>(new Map());
  const [viewingId, setViewingId] = useState<string | null>(null);
  const npcs = useNpcs();

  /**
   * NGƯỜI CANH GIỮ CỦA CHÍNH NHIỆM VỤ NÀY đã có giọng chưa.
   *
   * Mọi thứ đọc thành tiếng của một nhiệm vụ — đề bài, phương án, lời khen chê,
   * lời chia tay, câu khoá — đều là giọng của người này. Một nhiệm vụ, một
   * người, một giọng; mặt hiện trên màn hình và tiếng vang lên phải là một.
   */
  const npcCoGiong = Boolean(
    npcs?.find((npc) => npc.id === quest.npc_character_id)?.voice_id,
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // Escape đóng popup — nhưng không khi đang mở popup xem câu hỏi chồng lên.
      if (event.key === 'Escape' && !viewingId) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, viewingId]);

  async function patch(payload: Parameters<typeof updateQuest>[1]) {
    setErrorKey(null);
    try {
      onChanged(await updateQuest(quest.id, payload));
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    }
  }

  async function addPicked() {
    if (picked.size === 0) return;
    setErrorKey(null);
    try {
      onChanged(
        await addQuestQuestions(quest.id, {
          question_ids: [...picked.keys()],
          points: DEFAULT_POINTS,
        }),
      );
      setPicked(new Map());
      // Điều kiện xuất bản đổi theo — nạp lại ở nền.
      void onReload();
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    }
  }

  const alreadyIn = new Set(quest.questions.map((q) => q.question_id));

  /**
   * NHIỆM VỤ NÀY, và MÀN NÀY, trước giờ lấy câu từ mã nào.
   *
   * Đọc từ chính những câu đã lắp — đó là bằng chứng thật, và nó có sẵn ngay cả
   * khi `stages.stage_code` còn trống, đúng tình trạng của gần hết nội dung
   * hiện tại. Suy từ `quests.quest_code` thì không được: cột kia là mã người
   * dựng ĐẶT cho nhiệm vụ, và thường vẫn trống.
   *
   * Nhiệm vụ trống thì lùi ra cả màn: mở một nhiệm vụ chưa có câu nào mà kho
   * hiện đúng bộ câu của màn đang dựng vẫn hơn là hiện cả nghìn câu.
   */
  const maNhiemVuDaDung = firstCode(quest.questions, 'quest_code');
  const maManDaDung =
    firstCode(quest.questions, 'stage_code') ??
    firstCode(stage.quests.flatMap((q) => q.questions), 'stage_code');

  return (
    <Modal label={t('designer.edit')} onClose={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-abyss-700 bg-abyss-900 shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-abyss-800 px-5 py-3">
          {/* Tiêu đề SỬA ĐƯỢC tại chỗ, ghi vào `name_i18n` — cùng cột mà màn
              gán câu hỏi sửa và cùng cột màn chơi của học sinh đọc. Hai màn
              quản trị là hai cách sửa CÙNG MỘT nhiệm vụ; để một bên đọc được
              mà không sửa được thì người dựng phải nhớ "đổi tên thì sang màn
              kia", và đó là thứ không ai nhớ. */}
          <h2 className="flex min-w-0 items-center gap-2 font-semibold text-slate-100">
            <InlineName
              value={questLabel(quest, locale, t)}
              title={t('stage.builder.renameQuest')}
              className="truncate font-semibold text-slate-100"
              onCommit={(next) =>
                void patch({ name_i18n: { ...quest.name_i18n, [locale]: next } })
              }
            />
            <span className="font-mono text-xs text-slate-500">#{quest.order_index}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('stage.viewer.close')}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-abyss-800 hover:text-slate-100"
          >
            ✕
          </button>
        </header>

        {errorKey && (
          <p role="alert" className="mx-5 mt-3 rounded-lg bg-coral-500/15 px-3 py-2 text-sm text-coral-500">
            {t(errorKey)}
          </p>
        )}

        {/* `minmax(0,1fr)` chứ KHÔNG phải `1fr`.

            `1fr` lấy chiều rộng NỘI DUNG làm sàn: cột phải không chịu hẹp hơn
            câu hỏi dài nhất trong danh sách, nên cả thân popup mọc ra thanh
            cuộn ngang — mà thân này là `overflow-y-auto`, và trình duyệt tự
            nâng `overflow-x` lên `auto` theo. `min-w-0` trên từng cột là vế còn
            lại của cùng một luật: con của grid/flex mặc định không co dưới
            `min-content`. */}
        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[22rem_minmax(0,1fr)]">
          {/* ============ CỘT TRÁI: tuỳ chỉnh nhiệm vụ ============ */}
          <div className="min-w-0 space-y-4">
            {/* MÃ NHIỆM VỤ trong file nội dung. Khác `quest_object_key`: cái
                kia là tên vật thể trong cảnh do giáo viên đặt, còn cái này là
                địa chỉ do bộ phận nội dung đặt trong bảng tính, và nó là thứ
                duy nhất nối một dòng Excel với nhiệm vụ này.

                Xoá trắng ô là gỡ mã — `null` gửi lên có nghĩa "bỏ đi", xem
                `_apply_optional()` bên router. */}
            <Field label={t('designer.questCode')} hint={t('designer.questCodeHint')}>
              <input
                className="field-input font-mono text-xs"
                defaultValue={quest.quest_code ?? ''}
                placeholder="W1-S1-Quest-01"
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next !== (quest.quest_code ?? '')) {
                    void patch({ quest_code: next || null });
                  }
                }}
              />
            </Field>

            <Field label={t('designer.objectKey')} hint={t('stage.builder.objectHint')}>
              <input
                className="field-input font-mono text-xs"
                defaultValue={quest.quest_object_key}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next && next !== quest.quest_object_key) {
                    void patch({ quest_object_key: next });
                  }
                }}
              />
            </Field>

            {/* NGƯỜI CANH GIỮ — thứ duy nhất đổi theo nhiệm vụ trong cuộc hội
                thoại. Bố cục các khối là của cả màn chơi (`stages.dialogue_json`),
                còn khuôn mặt thì mỗi nhiệm vụ một người. */}
            <NpcField
              quest={quest}
              npcs={npcs}
              locale={locale}
              onPick={(id) => void patch({ npc_character_id: id })}
            />

            {/* SINH TIẾNG ĐỌC. Ngay dưới ô chọn người canh giữ, vì giọng đọc đề
                bài chính là giọng của người vừa chọn ở trên — hai ô cách xa nhau
                thì không ai nối được hai việc đó lại. */}
            <QuestAudioPanel
              questId={quest.id}
              // Đổi người canh giữ ở ô ngay trên là đổi giọng đọc đề bài —
              // truyền xuống để bảng bên dưới hỏi lại server, thay vì đứng im
              // với câu trả lời của lúc chưa chọn ai.
              npcId={quest.npc_character_id}
              worldId={worldId}
              locale={locale}
              onError={setErrorKey}
            />

            {/* LỜI CHIA TAY & SỔ TAY — chỉ ở nhiệm vụ NPC, vì đó là nhiệm vụ
                duy nhất dẫn tới khoảnh khắc trao sổ tay.

                Ngay dưới bảng giọng đọc, vì nút sinh tiếng cho lời chia tay nằm
                ở đó: soạn xong câu chữ thì cuộn lên vài dòng là bấm đọc được.
                Trước đây hai thứ này ở hai màn khác nhau và không nhìn thấy
                nhau. */}
            {quest.phase === 'advisor' && (
              <CluebookPanel
                stage={stage}
                locale={locale}
                onPatch={onStagePatch}
                bare
                outroVoice={
                  <OutroVoiceButton
                    questId={quest.id}
                    // Người canh giữ đã có giọng chưa — tra từ danh sách NPC đã
                    // nạp sẵn cho ô chọn ở trên, không hỏi server thêm lần nữa.
                    hasVoice={Boolean(
                      npcs?.find((npc) => npc.id === quest.npc_character_id)?.voice_id,
                    )}
                    ready={Boolean(stage.advisor_outro_audio_media_id)}
                    onDone={() => void onReload()}
                    onError={setErrorKey}
                  />
                }
              />
            )}

            {/* CÂU KHOÁ — chỉ ở nhiệm vụ THƯỜNG.
                Nhiệm vụ NPC là cổng vào, nó không bao giờ khoá, nên một ô soạn
                câu khoá ở đó là một ô không bao giờ dùng tới. */}
            {quest.phase !== 'advisor' && (
              <LockedMessageField
                quest={quest}
                locale={locale}
                hasVoice={npcCoGiong}
                onPatch={(next) => patch({ locked_message_i18n: next })}
                onError={setErrorKey}
              />
            )}

            <Field label={t('designer.phase')}>
              {/* Nhiệm vụ NPC không đổi giai đoạn được — nó là cổng vào của màn.
                  Khoá ô chọn chứ không giấu đi: giáo viên vẫn cần đọc được nhiệm
                  vụ này đang ở giai đoạn nào. */}
              <select
                className="field-input disabled:opacity-60"
                value={quest.phase}
                disabled={quest.phase === 'advisor'}
                onChange={(e) => void patch({ phase: e.target.value as 'advisor' | 'main' })}
              >
                <option value="main">{t('stage.phase.main')}</option>
                <option value="advisor">{t('stage.phase.advisor')}</option>
              </select>
              {quest.phase === 'advisor' && (
                <p className="mt-1 text-xs text-slate-500">{t('stage.builder.npcGateNote')}</p>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('stage.builder.passScore')}>
                {/* Luôn hiện một con số, mặc định là điểm tối đa — giống hệt ô
                    bên trình soạn màn. Bên dưới vẫn là `pass_score = NULL` khi
                    con số bằng đúng tổng điểm, để thêm câu hỏi thì ngưỡng tự đi
                    theo. Xem `PassScoreInput` trong `stage-builder.tsx`. */}
                <input
                  key={quest.pass_score_effective}
                  type="number"
                  min={0}
                  className="field-input"
                  title={t('stage.builder.passScoreHint', { total: quest.total_points })}
                  defaultValue={quest.pass_score_effective}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    const typed = raw === '' ? null : Number(raw);
                    if (typed !== null && (!Number.isFinite(typed) || typed < 0)) return;
                    const next = typed === null || typed === quest.total_points ? null : typed;
                    if (next !== quest.pass_score) {
                      void patch({ pass_score: next, clear_pass_score: next === null });
                    }
                  }}
                />
              </Field>
              <Field label={t('designer.energyCost')}>
                <input
                  type="number"
                  min={0}
                  className="field-input"
                  defaultValue={quest.energy_cost}
                  onBlur={(e) => {
                    const next = Number(e.target.value);
                    if (next >= 0 && next !== quest.energy_cost) void patch({ energy_cost: next });
                  }}
                />
              </Field>
            </div>
          </div>

          {/* ============ CỘT PHẢI: câu hỏi ============ */}
          <div className="flex min-h-0 min-w-0 flex-col gap-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold tracking-wide text-slate-300 uppercase">
                {t('stage.builder.questionCount', { count: quest.questions.length })} ·{' '}
                {t('stage.builder.passOf', {
                  pass: quest.pass_score_effective,
                  total: quest.total_points,
                })}
              </h3>

              {quest.questions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-abyss-700 px-3 py-4 text-center text-sm text-slate-500">
                  {t('stage.builder.emptyQuest')}
                </p>
              ) : (
                <ol className="space-y-1.5">
                  {quest.questions.map((item) => {
                    const broken =
                      item.question_status !== 'published' || item.question_deleted;
                    return (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg bg-abyss-950/50 px-2.5 py-1.5"
                      >
                        <span className="font-mono text-xs text-slate-600">
                          {item.order_index}.
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-300">
                          {item.question_prompt ?? '—'}
                        </span>
                        {broken && (
                          <Badge tone="danger">
                            {t(
                              item.question_deleted
                                ? 'stage.builder.questionGone'
                                : 'status.draft',
                            )}
                          </Badge>
                        )}
                        <input
                          type="number"
                          min={0}
                          aria-label={t('stage.builder.points')}
                          className="field-input w-16 px-1.5 py-0.5 text-center text-xs"
                          defaultValue={item.points}
                          onBlur={(e) => {
                            const next = Number(e.target.value);
                            if (next >= 0 && next !== item.points) {
                              void updateQuestQuestion(item.id, { points: next }).then(onChanged);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setViewingId(item.question_id)}
                          className="text-xs text-lagoon-400 hover:underline"
                        >
                          {t('stage.builder.viewQuestion')}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void removeQuestQuestion(item.id).then((updated) => {
                              onChanged(updated);
                              void onReload();
                            })
                          }
                          aria-label={t('stage.builder.removeQuestion')}
                          className="px-1 text-slate-500 hover:text-coral-500"
                        >
                          ✕
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-abyss-800 p-3">
              <h3 className="mb-2 text-sm font-semibold tracking-wide text-slate-300 uppercase">
                {t('stage.builder.bank')}
              </h3>
              <div className="min-h-64 flex-1">
                <QuestionPicker
                  stageCode={stageCode}
                  // Nhớ bộ lọc theo TỪNG nhiệm vụ: mở lại đúng nhiệm vụ ấy thì
                  // kho mở sẵn đúng chỗ lần trước đã lấy câu.
                  memoryKey={quest.id}
                  suggestedQuestCode={maNhiemVuDaDung}
                  suggestedStageCode={maManDaDung}
                  selected={new Set(picked.keys())}
                  alreadyIn={alreadyIn}
                  onToggle={(question) =>
                    setPicked((before) => {
                      const after = new Map(before);
                      if (after.has(question.id)) after.delete(question.id);
                      else after.set(question.id, question);
                      return after;
                    })
                  }
                />
              </div>
              <div className="mt-3 border-t border-abyss-800 pt-3">
                <Button variant="primary" disabled={picked.size === 0} onClick={addPicked}>
                  {t('stage.builder.addSelected', { count: picked.size })}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {viewingId && (
        <QuestionViewer
          questionId={viewingId}
          questId={quest.id}
          worldId={worldId}
          onClose={() => setViewingId(null)}
        />
      )}
    </Modal>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}


/** Mã đầu tiên bắt gặp trong một danh sách câu hỏi, hoặc `null`. */
function firstCode(
  items: { stage_code?: string | null; quest_code?: string | null }[],
  field: 'stage_code' | 'quest_code',
): string | null {
  for (const item of items) {
    const code = item[field];
    if (code) return code;
  }
  return null;
}

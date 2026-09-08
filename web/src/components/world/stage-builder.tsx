'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';

import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { InlineName } from '@/components/ui/inline-name';
import { questLabel } from '@/lib/quest-label';
import { Badge, Card, PageHeader, SectionTitle } from '@/components/ui/primitives';
import { ApiError } from '@/lib/api-error';
import { ownText, pickText } from '@/lib/i18n-text';
import type { QuestionSummary } from '@/lib/questions';
import { localizedPath } from '@/lib/routes';
import { useAsyncAction } from '@/lib/use-async-action';
import {
  addQuestQuestions,
  createQuest,
  deleteQuest,
  deleteStage,
  getStage,
  publishStage,
  removeQuestQuestion,
  unpublishStage,
  updateQuest,
  updateQuestQuestion,
  updateStage,
  type Quest,
  type Stage,
} from '@/lib/worlds';

import { QuestionPicker } from './question-picker';
import { QuestionViewer } from './question-viewer';

/** Điểm mặc định khi lắp một câu hỏi vào nhiệm vụ. Phải khớp backend. */
const DEFAULT_POINTS = 10;

/**
 * Màn T3 — dựng các nhiệm vụ của một màn chơi.
 *
 * Bố cục hai cột: trái là sơ đồ màn (các vật thể nhiệm vụ, mỗi cái mang MỘT
 * DANH SÁCH câu hỏi), phải là kho câu hỏi.
 *
 * Luồng: chọn một nhiệm vụ bên trái → tích nhiều câu hỏi bên phải → bấm Thêm.
 *
 * Mảnh bản đồ KHÔNG gán ở đây: nó thuộc về màn, trao khi hoàn thành tất cả
 * nhiệm vụ. Xem docs/GAME_DOMAIN.md §1.5c.
 *
 * Điều kiện xuất bản do **server** quyết định (`publish_blockers`), giao diện
 * chỉ hiển thị lại. Hai bản kiểm thì sẽ có ngày chúng nói khác nhau.
 */
export function StageBuilder({ stageId, worldId }: { stageId: string; worldId: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [stage, setStage] = useState<Stage | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [editingInfo, setEditingInfo] = useState(false);

  const [activeQuestId, setActiveQuestId] = useState<string | null>(null);
  const [newObjectKey, setNewObjectKey] = useState('');
  // Giữ CẢ câu hỏi chứ không chỉ id: danh sách bên phải nạp lại mỗi lần đổi bộ
  // lọc, nên tra ngược từ id lúc bấm Thêm chỉ tìm được câu còn trong bộ lọc.
  const [picked, setPicked] = useState<Map<string, QuestionSummary>>(new Map());
  const [viewingQuestionId, setViewingQuestionId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await getStage(stageId);
      setStage(data);
      setErrorKey(null);
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    } finally {
      setLoading(false);
    }
  }, [stageId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Nạp lại CẢ màn. Chỉ dùng cho thao tác đổi cấu trúc: tạo/xoá nhiệm vụ, sửa màn. */
  async function withError(fn: () => Promise<unknown>) {
    setErrorKey(null);
    try {
      await fn();
      await reload();
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    }
  }

  /**
   * Thao tác trả về đúng một nhiệm vụ: thay MỖI nhiệm vụ đó trong state.
   *
   * Trước đây mọi thao tác đều gọi `reload()`, tức nạp lại cả màn và thay cả
   * object `stage`. Hậu quả: cả cột trái vẽ lại sau mỗi lần đổi điểm hay đổi
   * giai đoạn, và nếu đang bấm sang một nhiệm vụ khác thì DOM đổi ngay dưới con
   * trỏ — cú bấm bị nuốt, phải bấm mấy lần mới ăn.
   *
   * `publish_blockers` phụ thuộc vào toàn màn nên vẫn phải hỏi lại server, nhưng
   * hỏi ở nền và CHỈ thay đúng trường đó, không đụng vào mảng `quests`.
   */
  async function withQuest(fn: () => Promise<Quest>) {
    setErrorKey(null);
    try {
      const updated = await fn();
      setStage((prev) =>
        prev
          ? { ...prev, quests: prev.quests.map((q) => (q.id === updated.id ? updated : q)) }
          : prev,
      );
      void refreshBlockers();
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    }
  }

  async function refreshBlockers() {
    try {
      const fresh = await getStage(stageId);
      setStage((prev) => (prev ? { ...prev, publish_blockers: fresh.publish_blockers } : prev));
    } catch {
      // Danh sách điều kiện xuất bản lỡ cũ một nhịp thì không sao — bấm Xuất
      // bản vẫn được server kiểm lại. Không làm hỏng thao tác vừa thành công.
    }
  }

  const activeQuest = stage?.quests.find((q) => q.id === activeQuestId) ?? null;

  function togglePick(question: QuestionSummary) {
    setPicked((before) => {
      const after = new Map(before);
      if (after.has(question.id)) after.delete(question.id);
      else after.set(question.id, question);
      return after;
    });
  }

  /** Lắp các câu đang tích vào nhiệm vụ đang chọn, hoặc tạo nhiệm vụ mới. */
  async function assign() {
    if (!stage || picked.size === 0) return;
    const ids = [...picked.keys()];

    if (activeQuest) {
      await withQuest(() =>
        addQuestQuestions(activeQuest.id, { question_ids: ids, points: DEFAULT_POINTS }),
      );
    } else {
      const key = newObjectKey.trim();
      if (!key) return;
      const nextOrder = Math.max(0, ...stage.quests.map((q) => q.order_index)) + 1;
      await withError(() =>
        createQuest(stage.id, {
          order_index: nextOrder,
          quest_object_key: key,
          phase: 'main',
          energy_cost: 0,
          question_ids: ids,
        }),
      );
      setNewObjectKey('');
    }
    setPicked(new Map());
  }

  const { run: doAssign, pending: assigning } = useAsyncAction(assign);
  const { run: doPublish, pending: publishing } = useAsyncAction(() =>
    withError(() => publishStage(stageId)),
  );

  const crumbs = [
    { label: t('teacher.title'), href: localizedPath('/teacher', locale) },
    { label: t('world.list.title'), href: localizedPath('/teacher/worlds', locale) },
    {
      label: t('world.detail.backToWorld'),
      href: localizedPath(`/teacher/worlds/${worldId}`, locale),
    },
    { label: stage ? pickText(stage.name_i18n, locale) : '…' },
  ];

  if (loading) return <p className="p-8 text-slate-400">{t('common.loading')}</p>;
  if (!stage) {
    // Trang lỗi vẫn phải có lối ra — mở nhầm một id hỏng thì không bị kẹt lại.
    return (
      <div className="mx-auto max-w-3xl">
        <Breadcrumb items={crumbs} />
        <p role="alert" className="rounded-lg bg-coral-500/15 px-4 py-3 text-coral-500">
          {t(errorKey ?? 'error.NOT_FOUND')}
        </p>
      </div>
    );
  }

  const canPublish = stage.publish_blockers.length === 0;
  const alreadyIn = new Set(activeQuest?.questions.map((q) => q.question_id) ?? []);

  return (
    <div className="mx-auto max-w-7xl">
      <Breadcrumb items={crumbs} />
      <PageHeader
        title={
          <InlineName
            value={pickText(stage.name_i18n, locale)}
            title={t('stage.builder.renameStage')}
            className="text-xl font-semibold text-slate-100"
            onCommit={(next) =>
              // Giữ các ngôn ngữ khác, chỉ sửa ngôn ngữ đang xem — không thì
              // sửa bản tiếng Việt là xoá mất bản tiếng Anh.
              withError(async () => {
                await updateStage(stage.id, {
                  name_i18n: { ...stage.name_i18n, [locale]: next },
                });
                await reload();
              })
            }
          />
        }
        description={t('stage.builder.subtitle', { shard: stage.map_shard_index })}
        badge={
          <Badge tone={stage.status === 'published' ? 'success' : 'neutral'}>
            {t(stage.status === 'published' ? 'status.published' : 'status.draft')}
          </Badge>
        }
        actions={
          <>
            <Link href={localizedPath(`/teacher/worlds/${worldId}/stages/${stage.id}/design`, locale)}>
              <Button variant="secondary">🎨 {t('designer.open')}</Button>
            </Link>
            <Link
              href={localizedPath(`/play/stage/${stage.id}`, locale)}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-lg border border-orichalcum-500/40 bg-orichalcum-500/10 px-4 py-2 text-sm font-medium text-orichalcum-400 transition hover:bg-orichalcum-500/20"
            >
              🧪 {t('stage.builder.playTest')}
            </Link>
            {stage.status === 'published' ? (
              <Button variant="secondary" onClick={() => withError(() => unpublishStage(stageId))}>
                {t('stage.builder.unpublish')}
              </Button>
            ) : (
              <Button
                variant="primary"
                loading={publishing}
                disabled={!canPublish}
                onClick={doPublish}
              >
                {t('stage.builder.publish')}
              </Button>
            )}
          </>
        }
      />

      {errorKey && (
        <p role="alert" className="mb-4 rounded-lg bg-coral-500/15 px-4 py-2 text-sm text-coral-500">
          {t(errorKey)}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* ---------------- Cột trái: sơ đồ màn ---------------- */}
        <Card>
          <SectionTitle>{t('stage.builder.diagram')}</SectionTitle>

          <p className="mb-3 text-sm text-slate-400">
            🗺 {t('stage.builder.shardNote', { shard: stage.map_shard_index })}
          </p>

          <p className="mb-3 rounded-lg bg-abyss-950/50 px-3 py-2 text-xs text-slate-400">
            🔒 {t('stage.builder.npcGateNote')}
          </p>

          <ul className="space-y-2">
            {stage.quests.map((quest) => (
              <QuestRow
                key={quest.id}
                quest={quest}
                active={quest.id === activeQuestId}
                onSelect={() => {
                  setActiveQuestId(quest.id === activeQuestId ? null : quest.id);
                  setPicked(new Map());
                }}
                onTogglePhase={() =>
                  withQuest(() =>
                    updateQuest(quest.id, {
                      phase: quest.phase === 'advisor' ? 'main' : 'advisor',
                    }),
                  )
                }
                onSetPassScore={(value) =>
                  withQuest(() =>
                    updateQuest(quest.id, {
                      pass_score: value,
                      clear_pass_score: value === null,
                    }),
                  )
                }
                onSetPoints={(linkId, points) =>
                  withQuest(() => updateQuestQuestion(linkId, { points }))
                }
                onRemoveQuestion={(linkId) => withQuest(() => removeQuestQuestion(linkId))}
                onRemove={() => withError(() => deleteQuest(quest.id))}
                onView={setViewingQuestionId}
                // Nhiệm vụ NPC sửa TÊN HIỂN THỊ, nhiệm vụ thường sửa KHOÁ VẬT THỂ.
                //
                // Khoá vật thể của NPC cố định là `npc` và không đổi được (cảnh
                // và migration đều gọi đúng cái tên đó), nên ô sửa ở hàng đó
                // phải trỏ vào thứ duy nhất còn đổi được — và cũng là thứ học
                // sinh thật sự nhìn thấy.
                onRename={(next) =>
                  withQuest(() =>
                    quest.phase === 'advisor'
                      ? updateQuest(quest.id, {
                          name_i18n: { ...quest.name_i18n, [locale]: next },
                        })
                      : updateQuest(quest.id, { quest_object_key: next }),
                  )
                }
              />
            ))}
          </ul>

          <div className="mt-4 rounded-xl border border-dashed border-abyss-700 p-3">
            <label className="field-label" htmlFor="new-object">
              {t('stage.builder.newQuest')}
            </label>
            <input
              id="new-object"
              className="field-input"
              placeholder={t('stage.builder.objectPlaceholder')}
              value={newObjectKey}
              onChange={(e) => {
                setNewObjectKey(e.target.value);
                setActiveQuestId(null);
              }}
            />
            <p className="mt-1 text-xs text-slate-500">{t('stage.builder.objectHint')}</p>
          </div>

          <StageSettings
            stage={stage}
            onSave={(payload) => withError(() => updateStage(stage.id, payload))}
          />

          <div className="mt-4 border-t border-abyss-800 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditingInfo(!editingInfo)}>
                {t('stage.builder.edit')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  if (!window.confirm(t('stage.builder.confirmDeleteStage'))) return;
                  try {
                    await deleteStage(stage.id);
                    router.push(localizedPath(`/teacher/worlds/${worldId}`, locale));
                    router.refresh();
                  } catch (error) {
                    setErrorKey(
                      error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR',
                    );
                  }
                }}
              >
                {t('stage.builder.deleteStage')}
              </Button>
            </div>

            {editingInfo && (
              <StageInfoForm
                stage={stage}
                locale={locale}
                onSave={async (payload) => {
                  await withError(() => updateStage(stage.id, payload));
                  setEditingInfo(false);
                }}
              />
            )}
          </div>
        </Card>

        {/* ---------------- Cột phải: kho câu hỏi ---------------- */}
        <div className="flex flex-col gap-4">
          <Card className="flex h-[34rem] flex-col">
            <SectionTitle>{t('stage.builder.bank')}</SectionTitle>

            <p className="mb-2 text-sm text-slate-400">
              {activeQuest
                ? t('stage.builder.addingTo', { object: activeQuest.quest_object_key })
                : t('stage.builder.pickQuestFirst')}
            </p>

            <div className="min-h-0 flex-1">
              <QuestionPicker
                // Mã màn ĐANG MỞ, để bộ lọc chọn sẵn nó. Màn hình này trước đây
                // không truyền gì cả, nên nó là màn duy nhất mà "vào một màn thì
                // tự hiện câu hỏi của màn đó" không xảy ra — mà đây lại chính là
                // màn hình lắp câu hỏi vào nhiệm vụ.
                stageCode={stage.stage_code}
                selected={new Set(picked.keys())}
                alreadyIn={alreadyIn}
                onToggle={togglePick}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-abyss-800 pt-3">
              <Button
                variant="primary"
                loading={assigning}
                disabled={picked.size === 0 || (!activeQuest && !newObjectKey.trim())}
                onClick={doAssign}
              >
                {activeQuest
                  ? t('stage.builder.addSelected', { count: picked.size })
                  : t('stage.builder.createWithSelected', { count: picked.size })}
              </Button>
              <Link
                href={localizedPath('/teacher/questions/new', locale)}
                target="_blank"
                className="text-sm text-lagoon-400 underline-offset-2 hover:underline"
              >
                {t('stage.builder.newQuestion')}
              </Link>
            </div>
          </Card>

          {/* Vì sao chưa xuất bản được — do server trả về, không tự tính lại. */}
          <Card>
            <SectionTitle>{t('stage.builder.publishCheck')}</SectionTitle>
            {canPublish ? (
              <p className="text-sm text-emerald-400">✓ {t('stage.builder.ready')}</p>
            ) : (
              <ul className="space-y-1.5 text-sm text-orichalcum-400">
                {stage.publish_blockers.map((blocker, i) => (
                  <li key={i}>⚠ {t(`stageBlocker.${blocker.code}`, blocker.params as never)}</li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {viewingQuestionId && (
        <QuestionViewer
          questionId={viewingQuestionId}
          onClose={() => setViewingQuestionId(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function QuestRow({
  quest,
  active,
  onSelect,
  onTogglePhase,
  onSetPassScore,
  onSetPoints,
  onRemoveQuestion,
  onRemove,
  onView,
  onRename,
}: {
  quest: Quest;
  active: boolean;
  onSelect: () => void;
  onTogglePhase: () => void;
  onSetPassScore: (value: number | null) => void;
  onSetPoints: (linkId: string, points: number) => void;
  onRemoveQuestion: (linkId: string) => void;
  onRemove: () => void;
  onView: (questionId: string) => void;
  onRename: (next: string) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();

  // Nhiệm vụ NPC là bắt buộc: không gỡ, không hạ xuống nhiệm vụ thường. Server
  // cũng từ chối cả hai việc đó — ẩn nút ở đây chỉ để giáo viên khỏi bấm vào
  // một thứ rồi nhận lỗi. Chốt thật nằm ở server, không nằm ở cái nút này.
  const isAdvisor = quest.phase === 'advisor';

  return (
    // CẢ CÁI THẺ nhận cú bấm, không phải riêng hàng huy hiệu bên trong.
    //
    // Trước đây chỉ mỗi cái `<button>` quanh mấy huy hiệu là bấm được, nên bấm
    // vào phần nền của thẻ thì không có gì xảy ra — và vì `onSelect` là BẬT/TẮT,
    // bấm trúng rồi bấm trượt rồi lại bấm trúng thành ra chọn xong bỏ chọn.
    // Người dùng thấy "bấm mấy lần mới được", và họ đọc đúng: nó hỏng thật.
    //
    // Vùng nào bên trong có việc riêng thì tự chặn nổi bọt — xem `stopSelect`.
    <li
      onClick={onSelect}
      className={`cursor-pointer rounded-xl border p-3 transition ${
        active ? 'border-lagoon-500 bg-lagoon-500/10' : 'border-abyss-800 bg-abyss-900/40'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-slate-500">#{quest.order_index}</span>

        {/* Bấm vào TÊN là mở ô sửa, không phải chọn nhiệm vụ — nên chặn ở đây. */}
        <span onClick={stopSelect}>
          <InlineName
            value={isAdvisor ? questLabel(quest, locale, t) : quest.quest_object_key}
            title={t(isAdvisor ? 'stage.builder.renameNpc' : 'stage.builder.renameHint')}
            className="w-40 font-medium text-slate-100"
            onCommit={onRename}
            onStartEditing={() => {
              // Sửa tên thì cũng chọn luôn nhiệm vụ đó — bấm vào một dòng mà
              // cột bên phải vẫn trỏ dòng khác là dễ thêm nhầm câu hỏi.
              if (!active) onSelect();
            }}
          />
        </span>

        <span className="flex flex-1 flex-wrap items-center gap-2 text-left">
          <Badge tone={isAdvisor ? 'info' : 'neutral'}>{t(`stage.phase.${quest.phase}`)}</Badge>
          {isAdvisor && <Badge tone="warning">🔒 {t('stage.builder.questRequired')}</Badge>}
          <span className="text-xs text-slate-500">
            {t('stage.builder.questionCount', { count: quest.questions.length })} ·{' '}
            {t('stage.builder.passOf', {
              pass: quest.pass_score_effective,
              total: quest.total_points,
            })}
          </span>
          {quest.questions.length === 0 && (
            <Badge tone="danger">{t('stage.builder.emptyQuest')}</Badge>
          )}
        </span>
      </div>

      {/* Chặn ở THẺ BAO, không phải ở từng cái nút bên trong: thêm một nút mới
          vào đây sau này thì nó được chặn sẵn, không phải nhớ. */}
      {quest.questions.length > 0 && (
        <ol className="mt-2 space-y-1.5" onClick={stopSelect}>
          {quest.questions.map((item) => {
            // Xoá mềm cũng là hỏng: câu hỏi có thể vừa `published` vừa đã xoá.
            const broken = item.question_status !== 'published' || item.question_deleted;
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-abyss-950/40 px-2.5 py-1.5"
              >
                <span className="font-mono text-xs text-slate-600">{item.order_index}.</span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-300">
                  {item.question_prompt ?? '—'}
                </span>
                {broken && (
                  <Badge tone="danger">
                    {t(item.question_deleted ? 'stage.builder.questionGone' : 'status.draft')}
                  </Badge>
                )}
                <PointsInput
                  value={item.points}
                  onCommit={(points) => onSetPoints(item.id, points)}
                />
                <button
                  type="button"
                  onClick={() => onView(item.question_id)}
                  className="rounded px-1.5 text-xs text-lagoon-400 transition hover:underline"
                >
                  {t('stage.builder.viewQuestion')}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveQuestion(item.id)}
                  aria-label={t('stage.builder.removeQuestion')}
                  title={t('stage.builder.removeQuestion')}
                  className="rounded px-1.5 text-slate-500 transition hover:text-coral-500"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2" onClick={stopSelect}>
        {!isAdvisor && (
          <Button variant="secondary" size="sm" onClick={onTogglePhase}>
            {t('stage.phase.advisor')}
          </Button>
        )}

        <PassScoreInput quest={quest} onCommit={onSetPassScore} />

        {!isAdvisor && (
          <Button variant="danger" size="sm" onClick={onRemove}>
            {t('stage.builder.removeQuest')}
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * Chặn cú bấm khỏi trôi lên thẻ nhiệm vụ.
 *
 * Cả thẻ nhiệm vụ là một cái nút chọn; những vùng có việc riêng — sửa tên, sửa
 * điểm, xoá câu hỏi — không được vừa làm việc của mình vừa bật/tắt lựa chọn.
 */
function stopSelect(event: ReactMouseEvent) {
  event.stopPropagation();
}

/**
 * Điểm qua ải của một nhiệm vụ.
 *
 * **Luôn hiện một con số**, mặc định là ĐIỂM TỐI ĐA của nhiệm vụ. Trước đây ô
 * này để trống và tổng điểm chỉ nằm ở placeholder mờ — người dựng nhìn vào một
 * ô rỗng thì không biết luật đang là gì, và "trống nghĩa là phải đúng hết" là
 * thứ không ai đoán ra được.
 *
 * Bên dưới vẫn là `pass_score = NULL` khi con số bằng đúng tổng điểm: giữ NULL
 * thì thêm một câu hỏi vào nhiệm vụ là ngưỡng tự đi theo. Ghim cứng 30 rồi thêm
 * câu thứ tư thành 40 điểm là bỗng dưng qua ải dễ đi mà không ai đụng vào nó.
 */
function PassScoreInput({
  quest,
  onCommit,
}: {
  quest: Quest;
  onCommit: (value: number | null) => void;
}) {
  const t = useTranslations();
  const [draft, setDraft] = useState(String(quest.pass_score_effective));

  // Đổi từ nơi khác (thêm/bớt câu hỏi làm tổng điểm đổi) thì đồng bộ lại.
  useEffect(() => {
    setDraft(String(quest.pass_score_effective));
  }, [quest.pass_score_effective]);

  function commit() {
    const raw = draft.trim();
    // Xoá trắng = trả về mặc định, tức bám theo tổng điểm.
    const next = raw === '' ? null : Number(raw);
    if (next !== null && (!Number.isFinite(next) || next < 0)) {
      setDraft(String(quest.pass_score_effective));
      return;
    }
    // Gõ đúng bằng tổng điểm cũng là mặc định — lưu NULL để nó còn bám theo.
    const value = next === null || next === quest.total_points ? null : next;
    if (value !== quest.pass_score) onCommit(value);
    else setDraft(String(quest.pass_score_effective));
  }

  return (
    <label className="flex items-center gap-1 text-xs text-slate-500">
      {t('stage.builder.passScore')}
      <input
        type="number"
        min={0}
        className="field-input w-20 px-1.5 py-0.5 text-center text-xs"
        title={t('stage.builder.passScoreHint', { total: quest.total_points })}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

/**
 * Ô nhập điểm của một câu hỏi.
 *
 * Giữ giá trị đang gõ ở state cục bộ và chỉ gọi API khi **rời ô hoặc bấm
 * Enter, và giá trị thật sự đổi**. Gọi theo `onChange` thì gõ "15" bắn hai
 * request, và "1" kịp được lưu trước khi người dùng gõ xong.
 */
function PointsInput({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (points: number) => void;
}) {
  const t = useTranslations();
  const [draft, setDraft] = useState(String(value));

  // Điểm bị đổi từ nơi khác (server trả về) thì đồng bộ lại ô nhập.
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit() {
    const next = Number(draft);
    if (!Number.isFinite(next) || next < 0) {
      setDraft(String(value));
      return;
    }
    if (next !== value) onCommit(next);
  }

  return (
    <label className="flex items-center gap-1 text-xs text-slate-500">
      <input
        type="number"
        className="field-input w-16 px-1.5 py-0.5 text-center text-xs"
        value={draft}
        aria-label={t('stage.builder.points')}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      {t('stage.builder.pointsShort')}
    </label>
  );
}

/**
 * Sửa thông tin nhận dạng của màn: tên và số thứ tự.
 *
 * Không còn ô `scene_key` và `advisor_npc_key`. Cả hai là khoá KỸ THUẬT mà giờ
 * không chỗ nào đọc tới: cảnh Phaser dựng hoàn toàn từ dữ liệu, còn tên NPC mà
 * học sinh nhìn thấy là tên của chính NHIỆM VỤ NPC — sửa ngay ở sơ đồ màn bên
 * trên. Hai ô hỏi một thứ đã có chỗ khác trả lời thì chỉ tạo ra hai câu trả lời
 * lệch nhau.
 */
function StageInfoForm({
  stage,
  locale,
  onSave,
}: {
  stage: Stage;
  locale: string;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const t = useTranslations();
  const [name, setName] = useState(ownText(stage.name_i18n, locale));
  const [order, setOrder] = useState(stage.order_index);

  const { run: submit, pending } = useAsyncAction(async () => {
    if (!name.trim()) return;
    await onSave({
      // Giữ các ngôn ngữ khác, chỉ sửa ngôn ngữ đang xem — không thì sửa bản
      // tiếng Việt là xoá mất bản tiếng Anh.
      name_i18n: { ...stage.name_i18n, [locale]: name.trim() },
      order_index: order,
    });
  });

  return (
    <div className="mt-3 grid gap-3 rounded-xl border border-dashed border-abyss-700 p-3 sm:grid-cols-2">
      <label className="block">
        <span className="field-label">{t('stage.field.name')}</span>
        <input
          className="field-input"
          value={name}
          placeholder={pickText(stage.name_i18n, locale)}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="field-label">{t('stage.builder.order')}</span>
        <input
          type="number"
          className="field-input"
          value={order}
          onChange={(e) => setOrder(Number(e.target.value))}
        />
      </label>
      <div className="sm:col-span-2">
        <Button
          variant="primary"
          size="sm"
          loading={pending}
          disabled={!name.trim()}
          onClick={submit}
        >
          {t('common.action.save')}
        </Button>
      </div>
    </div>
  );
}

function StageSettings({
  stage,
  onSave,
}: {
  stage: Stage;
  onSave: (payload: Record<string, number | number[]>) => void;
}) {
  const t = useTranslations();
  const [time, setTime] = useState(stage.time_limit_seconds);
  const [energy, setEnergy] = useState(stage.energy_per_player);
  const [skillMax, setSkillMax] = useState(stage.skill_pts_max);
  const [shard, setShard] = useState(stage.map_shard_index);
  const [starMax, setStarMax] = useState(stage.star_max);
  // Giữ nguyên CHUỖI người ta đang gõ, không ép về mảng số sau mỗi phím: gõ
  // "40, 7" mà ép ngay thì dấu phẩy vừa gõ biến mất và không gõ tiếp được.
  const [stars, setStars] = useState((stage.star_score_pcts ?? []).join(', '));

  const starList = stars
    .split(',')
    .map((piece) => Number(piece.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);

  const dirty =
    time !== stage.time_limit_seconds ||
    energy !== stage.energy_per_player ||
    skillMax !== stage.skill_pts_max ||
    shard !== stage.map_shard_index ||
    starMax !== stage.star_max ||
    starList.join(',') !== (stage.star_score_pcts ?? []).join(',');

  return (
    <div className="mt-4 border-t border-abyss-800 pt-4">
      <SectionTitle>{t('stage.builder.settings')}</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label={t('stage.field.timeLimit')} value={time} onChange={setTime} />
        <Field label={t('stage.field.energy')} value={energy} onChange={setEnergy} />
        <p className="col-span-2 text-xs text-slate-500 sm:col-span-3">
          {t('stage.field.energyHint')}
        </p>
        <Field label={t('stage.field.skillPtsMax')} value={skillMax} onChange={setSkillMax} />
        <Field label={t('stage.field.shardIndex')} value={shard} onChange={setShard} />
        <Field label={t('stage.field.starMax')} value={starMax} onChange={setStarMax} />
        <label className="col-span-2 block sm:col-span-3">
          <span className="field-label">{t('stage.field.starScorePcts')}</span>
          <input
            className="field-input"
            value={stars}
            placeholder="40, 70, 90"
            onChange={(e) => setStars(e.target.value)}
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-slate-500">{t('stage.field.starScorePctsHint')}</p>
      <p className="mt-2 text-xs text-slate-500">
        {t('stage.field.requiredSkillPts')}:{' '}
        <span className="font-mono text-slate-300">{stage.required_skill_pts_effective}</span>{' '}
        {t('stage.field.requiredFromBalance')}
      </p>
      {dirty && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() =>
            onSave({
              time_limit_seconds: time,
              energy_per_player: energy,
              skill_pts_max: skillMax,
              map_shard_index: shard,
              star_max: starMax,
              // Server tự sắp xếp và bỏ trùng — xem `update_stage`.
              star_score_pcts: starList,
            })
          }
        >
          {t('common.action.save')}
        </Button>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input
        type="number"
        className="field-input"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

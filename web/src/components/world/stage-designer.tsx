'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';

import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Badge, Card, PageHeader, SectionTitle } from '@/components/ui/primitives';
import { DEFAULT_ICON_SIZE, WORLD, resolvePulse } from '@/game/world';
import { ApiError } from '@/lib/api-error';
import { ownText, pickText } from '@/lib/i18n-text';
import { IMAGE_ACCEPT, uploadMedia } from '@/lib/media';
import { localizedPath } from '@/lib/routes';
import {
  createQuest,
  deleteQuest,
  getStage,
  updateQuest,
  updateStage,
  type Quest,
  type Stage,
} from '@/lib/worlds';

import { PulseFields } from './pulse-fields';
import { QuestEditorDialog } from './quest-editor-dialog';
import { useDesignBoard } from './use-design-board';

/**
 * Giao diện thiết kế đồ hoạ màn chơi.
 *
 * Vẽ bằng DOM chứ KHÔNG dùng Phaser: đây là trình soạn, không phải trò chơi.
 * Kéo thả, ô nhập và vùng chọn bằng HTML thì đơn giản và tiếp cận được; dựng
 * lại chúng trong canvas là tự làm khó mình.
 *
 * Toạ độ lưu theo **hệ thế giới 3200×1800** của Phaser, không theo pixel màn
 * hình. Khung ở đây co giãn theo bề rộng cửa sổ, nên lưu pixel màn hình là mở
 * trên máy khác thì vật thể nằm chỗ khác.
 */
export function StageDesigner({ stageId, worldId }: { stageId: string; worldId: string }) {
  const t = useTranslations();
  const locale = useLocale();

  const [stage, setStage] = useState<Stage | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  //: 'saving' khi đang gửi, 'saved' vài giây sau khi xong.
  //: Không có nút Lưu là đúng, nhưng KHÔNG NÓI GÌ CẢ thì người dùng phải đoán —
  //: và họ sẽ đi tìm một nút không tồn tại.
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  //: Nhịp thở đang chỉnh, chỉ để vẽ. Cùng lý do với kích thước: kéo thanh
  //: trượt mà phải đợi server trả lời mới thấy hiệu ứng đổi thì không ai chỉnh
  //: được — thứ đang chỉnh là một cảm giác, không phải một con số.
  const [pulseDraft, setPulseDraft] = useState<{
    id: string;
    percent: number;
    periodMs: number;
  } | null>(null);

  const reload = useCallback(async () => {
    try {
      setStage(await getStage(stageId));
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

  async function withError(fn: () => Promise<unknown>) {
    setErrorKey(null);
    try {
      await tracked(fn);
      await reload();
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    }
  }

  /** Bọc mọi lệnh ghi để hiện trạng thái lưu. */
  async function tracked<T>(fn: () => Promise<T>): Promise<T> {
    setSaveState('saving');
    try {
      const result = await fn();
      setSaveState('saved');
      return result;
    } catch (error) {
      setSaveState('idle');
      throw error;
    }
  }

  // Dấu "đã lưu" tự mờ đi sau vài giây: để mãi thì nó thành một nhãn trang trí
  // và người dùng thôi nhìn nó.
  useEffect(() => {
    if (saveState !== 'saved') return;
    const timer = setTimeout(() => setSaveState('idle'), 2500);
    return () => clearTimeout(timer);
  }, [saveState]);

  /** Cập nhật một nhiệm vụ tại chỗ, không nạp lại cả màn. */
  function applyQuest(updated: Quest) {
    setStage((prev) =>
      prev ? { ...prev, quests: prev.quests.map((q) => (q.id === updated.id ? updated : q)) } : prev,
    );
  }

  // ---------------------------------------------------------------- kéo thả

  // Toàn bộ phép toán kéo/thả/đổi cỡ nằm ở `useDesignBoard()`, dùng chung với
  // trình thiết kế bản đồ thiên hà. Hai màn hình vẽ thứ khác nhau nhưng cách
  // cầm chuột giống hệt, và hai bản sao của cùng một phép quy đổi toạ độ sẽ
  // lệch nhau đúng vào lúc không ai kịp nhận ra.
  const board = useDesignBoard({
    canvas: WORLD,
    minSize: 16,
    maxSize: 2000,
    onMove: (id, x, y) => void patchQuest(id, { scene_x: x, scene_y: y }),
    // Ảnh vật thể giữ tỉ lệ gốc, nên chỉ bề rộng là thứ lưu được — chiều cao
    // suy ra từ ảnh. Vì vậy màn này chỉ có tay cầm ở GÓC, và chỉ đọc `w`.
    onResize: (id, size) => void patchQuest(id, { icon_size: size.w }),
  });

  /** Sửa một nhiệm vụ và vá kết quả vào chỗ, không nạp lại cả màn. */
  async function patchQuest(id: string, payload: Parameters<typeof updateQuest>[1]) {
    try {
      applyQuest(await tracked(() => updateQuest(id, payload)));
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    }
  }

  // ---------------------------------------------------------------- tải ảnh

  async function uploadBackground(file: File) {
    setUploading(true);
    try {
      const asset = await uploadMedia(file, 'stage-backgrounds');
      await withError(() => updateStage(stageId, { background_media_id: asset.id }));
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    } finally {
      setUploading(false);
    }
  }

  async function addQuest() {
    if (!stage) return;
    const nextOrder = Math.max(0, ...stage.quests.map((q) => q.order_index)) + 1;
    await withError(() =>
      createQuest(stageId, {
        order_index: nextOrder,
        quest_object_key: `object_${nextOrder}`,
        name_i18n: { [locale]: t('designer.newQuestName', { n: nextOrder }) },
        phase: 'main',
        // Đặt giữa màn: giáo viên kéo tới chỗ mình muốn ngay sau đó.
        scene_x: Math.round(WORLD.width / 2),
        scene_y: Math.round(WORLD.height / 2),
        energy_cost: 0,
      }),
    );
  }

  const crumbs = [
    { label: t('teacher.title'), href: localizedPath('/teacher', locale) },
    { label: t('world.list.title'), href: localizedPath('/teacher/worlds', locale) },
    {
      label: t('world.detail.backToWorld'),
      href: localizedPath(`/teacher/worlds/${worldId}`, locale),
    },
    {
      label: stage ? pickText(stage.name_i18n, locale) : '…',
      href: localizedPath(`/teacher/worlds/${worldId}/stages/${stageId}`, locale),
    },
    { label: t('designer.title') },
  ];

  if (loading) return <p className="p-8 text-slate-400">{t('common.loading')}</p>;
  if (!stage) {
    return (
      <div className="mx-auto max-w-3xl">
        <Breadcrumb items={crumbs} />
        <p role="alert" className="rounded-lg bg-coral-500/15 px-4 py-3 text-coral-500">
          {t(errorKey ?? 'error.NOT_FOUND')}
        </p>
      </div>
    );
  }

  const selected = stage.quests.find((q) => q.id === selectedId) ?? null;
  const editing = stage.quests.find((q) => q.id === editingId) ?? null;
  // URL do server dựng sẵn — giao diện không tự ghép đường dẫn kho media.
  const background = stage.background_url ?? null;

  return (
    <div className="mx-auto max-w-7xl">
      <Breadcrumb items={crumbs} />
      <PageHeader
        title={t('designer.title')}
        description={t('designer.subtitle', { name: pickText(stage.name_i18n, locale) })}
        badge={
          <Badge tone={stage.status === 'published' ? 'success' : 'neutral'}>
            {t(stage.status === 'published' ? 'status.published' : 'status.draft')}
          </Badge>
        }
        actions={
          <>
            <span
              role="status"
              aria-live="polite"
              className={`text-xs transition-opacity ${
                saveState === 'idle' ? 'opacity-0' : 'opacity-100'
              } ${saveState === 'saved' ? 'text-emerald-400' : 'text-slate-400'}`}
            >
              {saveState === 'saving' ? t('designer.saving') : `✓ ${t('designer.saved')}`}
            </span>
            <Link
              href={localizedPath(`/play/stage/${stageId}`, locale)}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-lg border border-orichalcum-500/40 bg-orichalcum-500/10 px-4 py-2 text-sm font-medium text-orichalcum-400 transition hover:bg-orichalcum-500/20"
            >
              🧪 {t('stage.builder.playTest')}
            </Link>
            <Link href={localizedPath(`/teacher/worlds/${worldId}/stages/${stageId}`, locale)}>
              <Button variant="secondary">{t('designer.backToList')}</Button>
            </Link>
          </>
        }
      />

      {errorKey && (
        <p role="alert" className="mb-4 rounded-lg bg-coral-500/15 px-4 py-2 text-sm text-coral-500">
          {t(errorKey)}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        {/* ---------------- Khung màn chơi ---------------- */}
        <div>
          <div
            ref={board.boardRef}
            className="relative w-full overflow-hidden rounded-2xl border border-abyss-700 bg-abyss-950 select-none"
            // Giữ đúng tỉ lệ thế giới, nếu không thì kéo thả lệch theo trục.
            style={{ aspectRatio: `${WORLD.width} / ${WORLD.height}` }}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) setSelectedId(null);
            }}
          >
            {background ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={background}
                alt=""
                className="pointer-events-none absolute inset-0 size-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-linear-to-b from-abyss-950 to-abyss-800 text-sm text-slate-500">
                {t('designer.noBackground')}
              </div>
            )}

            {stage.quests.map((quest) => {
              const live = board.ghost?.id === quest.id ? board.ghost : null;
              const x = live?.x ?? quest.scene_x ?? WORLD.width / 2;
              const y = live?.y ?? quest.scene_y ?? WORLD.height / 2;
              const iconSize =
                board.sizeDraft?.id === quest.id
                  ? board.sizeDraft.w
                  : (quest.icon_size ?? DEFAULT_ICON_SIZE);
              const active = quest.id === selectedId;

              const draft = pulseDraft?.id === quest.id ? pulseDraft : null;
              const pulse = resolvePulse(
                draft?.percent ?? quest.pulse_percent,
                draft?.periodMs ?? quest.pulse_period_ms,
              );

              return (
                <div
                  key={quest.id}
                  className="absolute"
                  style={{
                    left: `${(x / WORLD.width) * 100}%`,
                    top: `${(y / WORLD.height) * 100}%`,
                    // Chiều rộng đặt Ở ĐÂY, trên chính thẻ `absolute`, để phần
                    // trăm quy chiếu theo KHUNG SOẠN.
                    //
                    // Trước đây nó nằm ở thẻ con, mà thẻ bọc `absolute` không có
                    // chiều rộng nên trình duyệt lấy "chỗ trống còn lại từ mép
                    // trái tới mép phải khung". Hậu quả: kéo vật thể sang phải
                    // thì chỗ trống hẹp lại và ảnh tự co, sát mép phải thì kéo
                    // to cũng không được.
                    width: `${(iconSize / WORLD.width) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div className="relative w-full">
                    {/* Khung ảnh vừa là viền "đang chọn" vừa là VÙNG VA CHẠM mà
                        nhân vật phải bước vào — một hình vuông chỉ để trang trí
                        là thứ ai cũng thử kéo rồi thất vọng. */}
                    <div className="relative w-full">
                      <button
                        type="button"
                        onPointerDown={(event) => {
                          setSelectedId(quest.id);
                          board.startDrag(event, { id: quest.id, x, y, w: iconSize, h: iconSize });
                        }}
                        onDoubleClick={() => setEditingId(quest.id)}
                        title={t('designer.dragHint')}
                        className={`block w-full cursor-grab rounded-lg border-2 active:cursor-grabbing ${
                          active
                            ? 'border-lagoon-400 bg-lagoon-400/10'
                            : 'border-transparent hover:border-white/40'
                        }`}
                      >
                        {/* Nhịp thở nằm ở thẻ bọc BÊN TRONG nút, không phải
                            trên chính cái nút: nút mang viền "đang chọn" và
                            tay cầm đổi kích thước, mà một cái viền phập phồng
                            thì không còn chỉ đúng vào đâu nữa. */}
                        <span
                          className={pulse ? 'pulse-breathe block' : 'block'}
                          style={
                            pulse
                              ? ({
                                  animationDuration: `${pulse.halfCycleMs}ms`,
                                  '--pulse-max': pulse.maxScale,
                                } as CSSProperties)
                              : undefined
                          }
                        >
                          {quest.icon_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={quest.icon_url}
                              alt=""
                              className="block w-full object-contain drop-shadow-lg"
                              draggable={false}
                            />
                          ) : (
                            <span
                              aria-hidden
                              className="flex aspect-square w-full items-center justify-center rounded bg-orichalcum-500/80 text-lg"
                            >
                              {quest.phase === 'advisor' ? '⚓' : '📦'}
                            </span>
                          )}
                        </span>
                      </button>

                      {/* Tay cầm ở góc — chỉ hiện khi nhiệm vụ đang được chọn,
                          để bốn tay cầm của bốn nhiệm vụ không chen nhau. */}
                      {active && (
                        <button
                          type="button"
                          aria-label={t('designer.resizeHint')}
                          title={t('designer.resizeHint')}
                          onPointerDown={(event) =>
                            board.startResize(
                              event,
                              { id: quest.id, x, y, w: iconSize, h: iconSize },
                              'both',
                            )
                          }
                          className="absolute -right-1.5 -bottom-1.5 size-3.5 cursor-nwse-resize rounded-full border-2 border-abyss-950 bg-lagoon-400 shadow"
                        />
                      )}
                    </div>

                    {/* Nhãn đặt tuyệt đối TRÊN ĐẦU khung. Tuyệt đối chứ không
                        nằm trong luồng: chữ dài sẽ nong thẻ bọc rộng ra, và
                        khung ảnh — vốn đo theo thẻ bọc — to lên theo độ dài cái
                        tên. Vị trí này phải khớp với `rescaleLabels()` bên
                        StageScene, nếu không thì thiết kế một đằng chơi một nẻo. */}
                    {/* Chữ trắng viền đen, không khung nền — khớp với `LABEL`
                        bên StageScene. Bề dày viền là 1/5 cỡ chữ, đúng tỉ lệ
                        `STROKE / FONT` của cảnh chơi, nên hai bên nhìn giống
                        nhau.

                        `paintOrder: 'stroke fill'` là phần bắt buộc:
                        `-webkit-text-stroke` vẽ nét CHÍNH GIỮA đường viền
                        glyph, nên không có nó thì nửa trong của nét ăn vào
                        thân chữ và chữ 11px gầy đi thấy rõ. */}
                    <span
                      className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-[11px] font-bold whitespace-nowrap text-white"
                      style={
                        {
                          WebkitTextStrokeWidth: '2.2px',
                          WebkitTextStrokeColor: '#000',
                          paintOrder: 'stroke fill',
                        } as CSSProperties
                      }
                    >
                      {pickText(quest.name_i18n, locale) || quest.quest_object_key}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-2 text-xs text-slate-500">
            {t('designer.dragHint')} · {t('designer.autoSave')}
          </p>
        </div>

        {/* ---------------- Bảng điều khiển ---------------- */}
        <div className="space-y-4">
          <Card>
            <SectionTitle>{t('designer.background')}</SectionTitle>
            {background && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={background}
                alt=""
                // Giữ đúng tỉ lệ thế giới để ảnh xem trước nói đúng cái sẽ hiện
                // trong cảnh, không phải một ô vuông cắt cúp.
                style={{ aspectRatio: `${WORLD.width} / ${WORLD.height}` }}
                className="mb-2 w-full rounded-lg border border-abyss-700 object-cover"
              />
            )}
            <label className="block">
              <span className="sr-only">{t('designer.uploadBackground')}</span>
              <input
                type="file"
                accept={IMAGE_ACCEPT}
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadBackground(file);
                  e.target.value = '';
                }}
                className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-abyss-800 file:px-3 file:py-1.5 file:text-slate-200 hover:file:bg-abyss-700"
              />
            </label>
            {uploading && <p className="mt-2 text-xs text-slate-500">{t('common.loading')}</p>}
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle>{t('designer.quests', { count: stage.quests.length })}</SectionTitle>
              <Button variant="primary" size="sm" onClick={addQuest}>
                {t('designer.addQuest')}
              </Button>
            </div>

            <ul className="space-y-1.5">
              {stage.quests.map((quest) => (
                <li key={quest.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(quest.id)}
                    onDoubleClick={() => setEditingId(quest.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
                      quest.id === selectedId
                        ? 'bg-lagoon-500/15 text-slate-100'
                        : 'text-slate-300 hover:bg-abyss-800'
                    }`}
                  >
                    <span className="font-mono text-xs text-slate-600">#{quest.order_index}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {pickText(quest.name_i18n, locale) || quest.quest_object_key}
                    </span>
                    <span className="text-xs text-slate-500">{quest.questions.length}</span>
                    {quest.questions.length === 0 && <Badge tone="danger">!</Badge>}
                  </button>
                </li>
              ))}
            </ul>

            {stage.quests.length === 0 && (
              <p className="text-sm text-slate-500">{t('designer.noQuest')}</p>
            )}
          </Card>

          {selected && (
            <QuestInspector
              // `key` buộc React dựng lại ô nhập khi đổi nhiệm vụ. Không có nó
              // thì các ô dùng `defaultValue` giữ nguyên chữ của nhiệm vụ trước.
              key={selected.id}
              quest={selected}
              locale={locale}
              onPatch={async (payload) => {
                try {
                  applyQuest(await tracked(() => updateQuest(selected.id, payload)));
                } catch (error) {
                  setErrorKey(
                    error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR',
                  );
                }
              }}
              onPreviewPulse={(value) =>
                setPulseDraft(value && { id: selected.id, ...value })
              }
              onOpenQuestions={() => setEditingId(selected.id)}
              onDelete={() => {
                if (!window.confirm(t('designer.confirmDelete'))) return;
                setSelectedId(null);
                void withError(() => deleteQuest(selected.id));
              }}
              onError={setErrorKey}
            />
          )}

          {/* Điều kiện xuất bản do server trả về — không tính lại ở đây. */}
          <Card>
            <SectionTitle>{t('stage.builder.publishCheck')}</SectionTitle>
            {stage.publish_blockers.length === 0 ? (
              <p className="text-sm text-emerald-400">✓ {t('stage.builder.ready')}</p>
            ) : (
              <ul className="space-y-1 text-xs text-orichalcum-400">
                {stage.publish_blockers.map((b, i) => (
                  <li key={i}>⚠ {t(`stageBlocker.${b.code}`, b.params as never)}</li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {editing && (
        <QuestEditorDialog
          quest={editing}
          locale={locale}
          onChanged={applyQuest}
          onReload={reload}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

/**
 * Bảng sửa nhanh nhiệm vụ đang chọn.
 *
 * Tên, ảnh và phạm vi sửa NGAY Ở ĐÂY chứ không phải mở popup: ba thứ đó là thứ
 * người ta căn đi căn lại, và mỗi lần phải mở/đóng một hộp thoại để nhìn kết
 * quả trên bản đồ là một lần mất mạch.
 *
 * Popup vẫn còn, nhưng chỉ để làm việc với CÂU HỎI — việc không cần nhìn cảnh.
 */
function QuestInspector({
  quest,
  locale,
  onPatch,
  onPreviewPulse,
  onOpenQuestions,
  onDelete,
  onError,
}: {
  quest: Quest;
  locale: string;
  onPatch: (payload: Parameters<typeof updateQuest>[1]) => Promise<void>;
  onPreviewPulse: (value: { percent: number; periodMs: number } | null) => void;
  onOpenQuestions: () => void;
  onDelete: () => void;
  onError: (key: string) => void;
}) {
  const t = useTranslations();
  const [uploading, setUploading] = useState(false);
  //: 'saving' khi đang gửi, 'saved' vài giây sau khi xong.
  //: Không có nút Lưu là đúng, nhưng KHÔNG NÓI GÌ CẢ thì người dùng phải đoán —
  //: và họ sẽ đi tìm một nút không tồn tại.
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const display = pickText(quest.name_i18n, locale);
  const current = ownText(quest.name_i18n, locale);

  async function uploadIcon(file: File) {
    setUploading(true);
    try {
      const asset = await uploadMedia(file, 'quest-icons');
      await onPatch({ icon_media_id: asset.id });
    } catch (error) {
      onError(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <SectionTitle>{display || quest.quest_object_key}</SectionTitle>

      <div className="space-y-3">
        <label className="block">
          <span className="field-label">{t('designer.questName')}</span>
          <input
            className="field-input"
            defaultValue={current}
            placeholder={display}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next && next !== current) {
                void onPatch({ name_i18n: { ...quest.name_i18n, [locale]: next } });
              }
            }}
          />
        </label>

        <div>
          <span className="field-label">{t('designer.icon')}</span>
          {quest.icon_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={quest.icon_url}
              alt=""
              className="mb-2 size-16 rounded-lg border border-abyss-700 object-contain"
            />
          )}
          <input
            type="file"
            accept={IMAGE_ACCEPT}
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadIcon(file);
              e.target.value = '';
            }}
            className="block w-full text-xs text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-abyss-800 file:px-2.5 file:py-1 file:text-slate-200 hover:file:bg-abyss-700"
          />
          {uploading && <p className="mt-1 text-xs text-slate-500">{t('common.loading')}</p>}
          {quest.icon_media_id && !uploading && (
            <button
              type="button"
              onClick={() => void onPatch({ icon_media_id: null })}
              className="mt-1 text-xs text-slate-500 hover:text-coral-500"
            >
              {t('designer.removeIcon')}
            </button>
          )}
        </div>

        <label className="block">
          <span className="field-label">{t('designer.iconSize')}</span>
          <input
            type="number"
            min={16}
            max={2000}
            className="field-input"
            defaultValue={quest.icon_size ?? DEFAULT_ICON_SIZE}
            onBlur={(e) => {
              const next = Number(e.target.value);
              if (next >= 16 && next !== quest.icon_size) void onPatch({ icon_size: next });
            }}
          />
          <span className="mt-1 block text-xs text-slate-500">{t('designer.resizeHint')}</span>
        </label>

        {/* Hai thanh trượt nhịp thở dùng chung với trình thiết kế bản đồ
            thiên hà — xem `pulse-fields.tsx`. */}
        <PulseFields
          percent={quest.pulse_percent}
          periodMs={quest.pulse_period_ms}
          onPreview={onPreviewPulse}
          onCommit={(pulse_percent, pulse_period_ms) =>
            onPatch({ pulse_percent, pulse_period_ms })
          }
        />

        <div className="flex justify-between text-xs text-slate-400">
          <span>{t('designer.position')}</span>
          <span className="font-mono text-slate-300">
            {quest.scene_x ?? '—'}, {quest.scene_y ?? '—'}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-abyss-800 pt-3">
        <Button variant="primary" size="sm" onClick={onOpenQuestions}>
          {t('designer.editQuestions', { count: quest.questions.length })}
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete}>
          {t('stage.builder.removeQuest')}
        </Button>
      </div>
    </Card>
  );
}

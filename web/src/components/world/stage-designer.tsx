'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';

import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Badge, Card, PageHeader, SectionTitle } from '@/components/ui/primitives';
import type { AudioSlot, AudioTrack } from '@/game/audio';
import { HERO_FOOT_Y } from '@/game/character';
import { canWalkAt, readCollision, type CollisionMap } from '@/game/collision';
import { DEFAULT_ICON_SIZE, WORLD, resolvePulse, resolveSpawn } from '@/game/world';
import { ApiError } from '@/lib/api-error';
import { ownText, pickText } from '@/lib/i18n-text';
import { BACKGROUND_ACCEPT, IMAGE_ACCEPT, uploadMedia } from '@/lib/media';
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

import { AudioPanel } from './audio-panel';
import { CluebookPanel } from './cluebook-panel';
import { IntroVideoPanel } from './intro-video-panel';
import { BackgroundLayer } from '@/components/game/background-layer';
import { PulseFields } from './pulse-fields';
import { WalkareaOverlay, WalkareaPanel, useWalkarea } from './walkarea-editor';
import { QuestEditorDialog } from './quest-editor-dialog';
import { ResizeHandles } from './resize-handles';
import { useDesignBoard, type ResizeAxis } from './use-design-board';
import { listWorldCharacters, type CharacterAction } from '@/lib/characters';

import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * Mã của khung nhân vật trên bảng kéo thả.
 *
 * Không trùng được với `quest.id` (một UUID), nên `onResize` phân biệt hai loại
 * chỉ bằng một phép so sánh chuỗi.
 */
const CHARACTER_ID = 'character';


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
  /**
   * Nhân vật ĐẦU TIÊN của world, chỉ để ướm cỡ.
   *
   * Một cái là đủ: người dựng cần một hình người có tỉ lệ đúng đứng cạnh cái
   * cảnh, không cần đúng cái nhân vật học sinh sẽ chọn — mà cũng không đoán
   * trước được học sinh chọn ai. Cảnh chơi đặt cỡ mọi nhân vật theo CÙNG một
   * chiều cao, nên căn theo con nào cũng ra cùng một kết quả.
   *
   * `null` = world chưa gán nhân vật nào, hoặc nhân vật chưa có tấm nào tải
   * lên. Khi đó bảng không vẽ gì cả — im lặng, chứ không dựng một cái hộp rỗng
   * để người dựng ướm cỡ với một khoảng trống.
   */
  const [ghost, setGhost] = useState<CharacterAction | null>(null);
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

  /**
   * Bản vẽ vùng đi được, đã gạn sạch. `null` = chưa vẽ, cả bản đồ đi được.
   *
   * `useMemo` chứ không tính thẳng trong thân hàm: `useWalkarea()` so sánh
   * `value` theo tham chiếu để biết có nên đồng bộ lại từ server không, nên một
   * object mới ở mỗi lần vẽ lại sẽ ghi đè liên tục lên bản đang sửa.
   */
  const collision: CollisionMap | null = useMemo(
    () => readCollision(stage?.collision),
    [stage?.collision],
  );

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

  // Nhân vật nạp RIÊNG, và hỏng thì im lặng: nó là công cụ ướm cỡ, không phải
  // nội dung của màn chơi. Một world chưa gán nhân vật vẫn phải dựng màn được.
  useEffect(() => {
    let huy = false;
    void listWorldCharacters(worldId)
      .then((list) => {
        if (huy) return;
        // Đã sắp theo `position` từ server; lấy con đầu và tấm đầu của nó.
        const first = list.find((c) => (c.actions?.length ?? 0) > 0);
        setGhost(first?.actions?.[0] ?? null);
      })
      .catch(() => setGhost(null));
    return () => {
      huy = true;
    };
  }, [worldId]);

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
    onMove: (id, x, y) =>
      id === CHARACTER_ID
        ? void patchSpawn(x, y)
        : void patchQuest(id, { scene_x: x, scene_y: y }),
    // Ảnh vật thể giữ tỉ lệ gốc, nên chỉ bề rộng là thứ lưu được — chiều cao
    // suy ra từ ảnh. Vì vậy màn này chỉ có tay cầm ở GÓC, và chỉ đọc `w`.
    //
    // Nhân vật thì ngược lại: đọc `h`. Cảnh chơi đặt cỡ nhân vật theo CHIỀU CAO
    // (`HERO_HEIGHT`), nên đây phải đo đúng cái chiều đó — lưu bề rộng rồi quy
    // ra chiều cao là thêm một phép đổi để sai.
    onResize: (id, size) =>
      id === CHARACTER_ID
        ? void patchStageHeight(size.h)
        : void patchQuest(id, { icon_size: size.w }),
  });

  // ------------------------------------------------------------ vùng đi được

  /**
   * Bản vẽ vùng đi được, gửi lên NGUYÊN CỤC mỗi lần.
   *
   * Không vá từng hình: công cụ vẽ giữ cả danh sách trong bộ nhớ để hoàn tác,
   * nên nó luôn có bản đầy đủ trong tay — và một PATCH từng hình thì hai tab mở
   * cùng lúc sẽ trộn hai bản vẽ vào nhau thành một thứ không ai vẽ ra.
   */
  const walk = useWalkarea({
    value: collision,
    onSave: (map) =>
      void withError(() =>
        updateStage(stageId, map ? { collision: map } : { clear_collision: true }),
      ),
  });

  /**
   * Ghi MỘT khối tiếng. Server gộp theo khối, nên hai khối kia không bị đụng.
   *
   * Vá kết quả vào chỗ thay vì `reload()`: bảng nhạc có thanh trượt và một thẻ
   * `<audio>` đang phát thử: nạp lại cả màn là dựng lại cây component, và cái
   * thẻ đang phát bị gắn lại — tiếng đứt ngang đúng lúc người dựng đang nghe.
   */
  async function patchAudio(slot: AudioSlot, track: AudioTrack) {
    try {
      const fresh = await tracked(() => updateStage(stageId, { audio: { [slot]: track } }));
      setStage((prev) => (prev ? { ...prev, ...fresh } : prev));
      setErrorKey(null);
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    }
  }

  /**
   * Lưu chiều cao nhân vật CHO RIÊNG màn này.
   *
   * Ghi thẳng vào `stages.character_height`, kể cả khi màn đang kế thừa: kéo
   * xong là màn này có số của riêng nó, đúng như người dựng vừa nói bằng tay.
   * Muốn quay lại kế thừa thì có nút riêng, không phải đoán qua cú kéo.
   */
  async function patchStageHeight(height: number) {
    await withError(async () => {
      const fresh = await updateStage(stageId, { character_height: Math.round(height) });
      setStage((prev) => (prev ? { ...prev, ...fresh } : prev));
    });
  }

  /**
   * Lưu CHỖ XUẤT PHÁT của nhân vật cho màn này.
   *
   * Toạ độ nhận vào là ĐIỂM VA CHẠM — cùng thứ `canWalk()` xét và cùng thứ
   * database lưu — chứ không phải tâm tấm ảnh. Cú kéo cũng neo vào điểm đó
   * (xem `stand` của `CharacterGhost`), nên trên cả đường đi từ ngón tay xuống
   * cột `spawn_x` không có một phép quy đổi nào để lệch.
   */
  async function patchSpawn(x: number, y: number) {
    await withError(async () => {
      const fresh = await updateStage(stageId, { spawn_x: x, spawn_y: y });
      setStage((prev) => (prev ? { ...prev, ...fresh } : prev));
    });
  }

  /**
   * Bỏ chỗ xuất phát riêng, quay về chỗ mặc định của cảnh.
   *
   * Cùng lý do với `clearStageHeight()`: không có nút này thì cú kéo đầu tiên
   * là một cánh cửa một chiều, và người dựng lỡ tay thì không có đường về —
   * `DEFAULT_SPAWN` là một cặp số họ không nhìn thấy ở đâu để gõ lại.
   */
  async function clearSpawn() {
    await withError(async () => {
      const fresh = await updateStage(stageId, { clear_spawn: true });
      setStage((prev) => (prev ? { ...prev, ...fresh } : prev));
    });
  }

  /**
   * Bỏ số riêng của màn, quay về kế thừa từ màn đầu world.
   *
   * Phải có cờ riêng `clear_character_height`: trong PATCH thì `null` nghĩa là
   * "không gửi trường này", nên không có cách nào nói "xoá về mặc định" bằng
   * chính giá trị. Cùng nếp với `clear_pass_score`.
   *
   * Không có nó thì cú kéo đầu tiên là một cánh cửa một chiều: lỡ tay kéo ở màn
   * 7 là màn 7 vĩnh viễn không theo màn 1 nữa.
   */
  async function clearStageHeight() {
    await withError(async () => {
      const fresh = await updateStage(stageId, { clear_character_height: true });
      setStage((prev) => (prev ? { ...prev, ...fresh } : prev));
    });
  }

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
  // Ảnh hay video — quyết định cả cách vẽ khung xem trước lẫn việc bảng âm thanh
  // có hiện lựa chọn "dùng tiếng của video" hay không.
  const backgroundKind = stage.background_kind ?? null;

  const characterHeight = stage.character_height ?? stage.character_height_effective;

  // CHỖ XUẤT PHÁT đang vẽ. Trong lúc kéo thì đọc bóng chứ không đợi server —
  // một cú kéo mà hình chỉ nhảy tới nơi sau khi mạng trả lời thì không kéo được.
  const spawnLive = board.ghost?.id === CHARACTER_ID ? board.ghost : null;
  const spawnPoint = spawnLive ?? resolveSpawn(stage.spawn_x, stage.spawn_y);

  // Chỗ nhân vật ĐANG ĐỨNG trên bảng: đi thử thì do bàn phím lái, còn lại thì
  // đứng ở chỗ xuất phát. Trước đây không đi thử là nó đứng giữa bản đồ, một
  // chỗ chẳng có nghĩa gì — giờ nó đứng đúng chỗ học sinh sẽ rơi xuống.
  const stand = walk.test ?? spawnPoint;

  // Chỗ xuất phát rơi ra ngoài vùng đi được. Cảnh chơi vẫn cứu hộ về ô đi được
  // gần nhất nên không ai bị kẹt, nhưng người chơi sẽ xuất hiện ở một chỗ KHÁC
  // chỗ người dựng vừa đặt — và không có gì trên màn hình nói vì sao.
  const spawnStuck = !walk.test && !canWalkAt(collision, spawnPoint.x, spawnPoint.y);

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
              <BackgroundLayer
                url={background}
                kind={backgroundKind}
                className="pointer-events-none absolute inset-0 size-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-linear-to-b from-abyss-950 to-abyss-800 text-sm text-slate-500">
                {t('designer.noBackground')}
              </div>
            )}

            {/* Nhân vật ướm cỡ — vẽ TRƯỚC các vật thể nhiệm vụ để nó nằm
                dưới chúng: nó là cái thước, không phải nội dung của màn, nên
                không được che mất thứ người dựng đang thật sự sắp đặt. */}
            <CharacterGhost
              action={ghost}
              height={
                board.sizeDraft?.id === CHARACTER_ID
                  ? board.sizeDraft.h
                  : characterHeight
              }
              active={selectedId === CHARACTER_ID}
              label={t(ghost ? 'designer.characterHint' : 'designer.spawnHint')}
              stand={stand}
              onPointerDown={(event) => {
                setSelectedId(CHARACTER_ID);
                // Đang ĐI THỬ thì nhân vật do bàn phím lái, và kéo nó bằng
                // chuột giữa chừng là hai bàn tay giành nhau cùng một toạ độ.
                // Chỗ xuất phát vẫn nằm nguyên ở chỗ nó đang nằm.
                if (walk.test) return;
                board.startDrag(event, {
                  id: CHARACTER_ID,
                  // Kéo theo ĐIỂM VA CHẠM, không theo tâm tấm ảnh: đó là thứ
                  // database lưu, thứ `canWalk()` xét, và cũng là thứ khung
                  // kéo thả tự ép vào trong bản đồ. Neo vào tâm ảnh thì cú ép
                  // biên sẽ cho phép điểm va chạm tụt xuống dưới mép sàn.
                  ...spawnPoint,
                  w: characterHeight,
                  h: characterHeight,
                });
              }}
              onResize={
                // Không có tấm nhân vật nào thì không có gì để ướm cỡ, và một
                // tay cầm đổi cỡ trên một ô nét đứt chỉ đổi được chính cái ô
                // đó. Chỗ xuất phát thì vẫn kéo được — nó không cần một hình
                // người mới có nghĩa.
                ghost
                  ? (event, axis) =>
                      board.startResize(
                        event,
                        {
                          id: CHARACTER_ID,
                          // Neo vào TÂM ĐANG VẼ, không phải giữa bản đồ: ở chế
                          // độ đi thử nhân vật đứng chỗ khác, và tay cầm thì đo
                          // khoảng cách tới tâm.
                          ...ghostCenter(stand, characterHeight),
                          w: characterHeight,
                          h: characterHeight,
                          // Cùng khoảng server nhận (40..900). Kéo quá rồi ăn
                          // 422 là cú kéo mất trắng, mà người dựng thì không
                          // biết vì sao.
                          min: 40,
                          max: 900,
                        },
                        axis,
                      )
                  : null
              }
            />

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
                            /* CHƯA CÓ ẢNH — nét đứt, rỗng ruột.
                               Ô này chỉ tồn tại trên bàn của giáo viên: nó là
                               cái để cầm mà kéo và đổi cỡ. Học sinh sẽ KHÔNG
                               thấy gì ở đây ngoài cái tên.
                               Trước đây chỗ này là một khối vàng đặc, và nó nói
                               dối: người dựng thấy một vật thể to rõ, vào chơi
                               thì không có gì. Nét đứt là cách nói "đây là ranh
                               giới, không phải hình" mà không cần thêm chữ nào. */
                            <span
                              aria-hidden
                              /* Nét TRẮNG kèm viền ngoài ĐEN, đúng lối đã dùng
                                 cho nhãn nhiệm vụ và cho hình vùng đi được: nền
                                 là tranh vẽ tay, sáng tối tuỳ chỗ, nên một nét
                                 trắng mờ biến mất trên buồm còn một nét đen mờ
                                 biến mất dưới thân tàu. Hai lớp thì đọc được
                                 trên cả hai. `outline` chứ không phải viền thứ
                                 hai: nó nằm NGOÀI khung, không ăn vào kích
                                 thước ô — mà ô này chính là vùng va chạm. */
                              className="block aspect-square w-full rounded border-2 border-dashed border-white/85 bg-abyss-950/25 outline-2 outline-abyss-950/60"
                            />
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
                    {/* HAI lớp span, và không gộp được thành một: lớp ngoài giữ
                        chỗ đứng (`-translate-x-1/2`), lớp trong giữ nhịp thở.
                        Keyframe `pulse-breathe` đặt `transform: scale(...)`, mà
                        `transform` là MỘT thuộc tính — viết đè lên nhau thì cái
                        sau xoá cái trước, và nhãn văng sang phải nửa bề rộng
                        của chính nó ngay khi bắt đầu thở.

                        `origin-bottom` để chữ phình ra từ MÉP DƯỚI, khớp với
                        `setOrigin(0.5, 1)` của nhãn bên StageScene — cùng một
                        điểm neo thì hai bên nở ra cùng một kiểu. */}
                    <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2">
                      <span
                        className={`block text-[11px] font-bold whitespace-nowrap text-white ${
                          pulse ? 'pulse-breathe origin-bottom' : ''
                        }`}
                        style={
                          {
                            WebkitTextStrokeWidth: '2.2px',
                            WebkitTextStrokeColor: '#000',
                            paintOrder: 'stroke fill',
                            ...(pulse
                              ? {
                                  animationDuration: `${pulse.halfCycleMs}ms`,
                                  '--pulse-max': pulse.maxScale,
                                }
                              : {}),
                          } as CSSProperties
                        }
                      >
                        {pickText(quest.name_i18n, locale) || quest.quest_object_key}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
            {/* Lớp vẽ nằm CUỐI CÙNG, tức trên cùng. Đang vẽ thì nó ăn hết sự
                kiện chuột — cách rẻ nhất và chắc nhất để cú kéo vẽ hình không
                giành nhau với cú kéo dời nhiệm vụ. Không vẽ thì nó vẫn hiện
                đường bao, chỉ là không bắt chuột nữa. */}
            <WalkareaOverlay walk={walk} />
          </div>

          <p className="mt-2 text-xs text-slate-500">
            {walk.editing
              ? t('designer.walkarea.boardHint')
              : `${t('designer.dragHint')} · ${t('designer.autoSave')}`}
          </p>
        </div>

        {/* ---------------- Bảng điều khiển ----------------

            Cột này TỰ CUỘN, không cuộn cả trang — cùng cách với trình thiết kế
            thiên hà và phòng chờ world. Bảng bên này giờ đã dài hơn màn hình
            (ảnh nền, cỡ nhân vật, vùng đi được, âm thanh, danh sách nhiệm vụ,
            điều kiện xuất bản); cuộn cả trang thì khung màn chơi trôi lên mất,
            mà nhìn được thứ mình đang chỉnh chính là toàn bộ lý do có màn này.

            `sticky` + `overflow-y-auto` trên CÙNG một thẻ: nó ghim tại chỗ, và
            phần bên trong tự trượt. Chỉ bật từ `lg` trở lên — dưới ngưỡng đó
            hai cột xếp chồng thành một dòng dọc, và một ô cuộn lồng trong một
            trang cuộn là thứ trên điện thoại không ai điều khiển nổi. */}
        <div className="space-y-4 lg:sticky lg:top-3 lg:max-h-[calc(100vh-1.5rem)] lg:overflow-y-auto lg:pr-1">
          {/* MÃ MÀN CHƠI đứng đầu cột phải, trước cả ảnh nền: nó là thứ nối màn
              này với file nội dung, và điền nó vào là mọi câu hỏi đã nhập của
              màn tự hiện ra trong bộ chọn câu hỏi. Chôn nó xuống cuối là không
              ai tìm thấy. */}
          <Card>
            <SectionTitle>{t('designer.stageCode')}</SectionTitle>
            <input
              className="field-input mt-2 font-mono text-xs"
              defaultValue={stage.stage_code ?? ''}
              placeholder="W1-S1"
              onBlur={(event) => {
                const next = event.target.value.trim();
                if (next !== (stage.stage_code ?? '')) {
                  // `null` để XOÁ mã. Chuỗi rỗng thì bên server quy về `null`
                  // luôn — unique index có điều kiện không chịu được hai ô rỗng.
                  void withError(() => updateStage(stageId, { stage_code: next || null }));
                }
              }}
            />
            <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
              {t('designer.stageCodeHint')}
            </p>
          </Card>

          <Card>
            <SectionTitle>{t('designer.background')}</SectionTitle>
            {background && (
              <div
                // Giữ đúng tỉ lệ thế giới để khung xem trước nói đúng cái sẽ hiện
                // trong cảnh, không phải một ô vuông cắt cúp.
                style={{ aspectRatio: `${WORLD.width} / ${WORLD.height}` }}
                className="relative mb-2 w-full overflow-hidden rounded-lg border border-abyss-700"
              >
                {/* `still`: đây là ô xác nhận "đã tải đúng file chưa", không phải
                    chỗ xem phim. Cái đang chạy thật nằm ở khung lớn bên trái. */}
                <BackgroundLayer
                  url={background}
                  kind={backgroundKind}
                  still
                  className="absolute inset-0 size-full object-cover"
                />
              </div>
            )}
            <label className="block">
              <span className="sr-only">{t('designer.uploadBackground')}</span>
              <input
                type="file"
                accept={BACKGROUND_ACCEPT}
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

          {/* Video mở màn ngay dưới ảnh nền: hai thứ này là những gì học sinh
              nhìn thấy khi vừa tới, theo đúng thứ tự họ nhìn thấy. */}
          <IntroVideoPanel
            stage={stage}
            onPatch={(payload) =>
              void withError(async () => {
                const fresh = await updateStage(stageId, payload);
                setStage((prev) => (prev ? { ...prev, ...fresh } : prev));
              })
            }
          />

          <Card>
            <SectionTitle>{t('designer.characterSize')}</SectionTitle>
            {ghost ? (
              <>
                <p className="mt-2 flex items-baseline justify-between gap-2 text-sm text-slate-300">
                  <span>{t('designer.characterHeight')}</span>
                  <span className="font-mono text-lagoon-400">
                    {stage.character_height ?? stage.character_height_effective}
                  </span>
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {stage.character_height === null
                    ? t('designer.characterInherited')
                    : t('designer.characterOwn')}
                </p>
                {/* Nút này chỉ hiện khi màn ĐANG có số riêng — bấm nó lúc đang
                    kế thừa thì không có gì để bỏ, và một cái nút không làm gì
                    là một cái nút dạy người ta ngừng tin vào các nút. */}
                {stage.character_height !== null && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                    onClick={() => void clearStageHeight()}
                  >
                    {t('designer.characterReset')}
                  </Button>
                )}
              </>
            ) : (
              <p className="mt-2 text-xs text-slate-500">{t('designer.characterNone')}</p>
            )}
          </Card>

          {/* CHỖ XUẤT PHÁT — bảng riêng, không nhét chung với cỡ nhân vật: hai
              thứ này chỉnh bằng hai cú kéo khác nhau trên cùng một hình, và gộp
              vào một bảng thì cái nút gỡ ở dưới không nói rõ nó gỡ cái nào. */}
          <Card>
            <SectionTitle>{t('designer.spawn')}</SectionTitle>
            <p className="mt-2 flex items-baseline justify-between gap-2 text-sm text-slate-300">
              <span>{t('designer.position')}</span>
              <span className="font-mono text-lagoon-400">
                {Math.round(spawnPoint.x)}, {Math.round(spawnPoint.y)}
              </span>
            </p>
            <p className="mt-2 text-xs leading-snug text-slate-500">
              {stage.spawn_x === null && stage.spawn_y === null
                ? t('designer.spawnDefault')
                : t('designer.spawnOwn')}
            </p>
            {/* Cảnh chơi vẫn kéo người chơi về ô đi được gần nhất, nên đây
                không phải một lỗi chặn — nhưng người dựng đặt ở đây mà học sinh
                hiện ra ở chỗ khác thì họ cần biết trước, không phải phát hiện
                khi vào chơi. */}
            {spawnStuck && (
              <p className="mt-1.5 text-[11px] leading-snug text-coral-400">
                ⚠ {t('designer.spawnStuck')}
              </p>
            )}
            {/* Chỉ hiện khi màn ĐANG có chỗ riêng — cùng luật với nút gỡ cỡ
                nhân vật ngay trên. */}
            {(stage.spawn_x !== null || stage.spawn_y !== null) && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => void clearSpawn()}
              >
                {t('designer.spawnReset')}
              </Button>
            )}
          </Card>

          <WalkareaPanel walk={walk} />

          {/* Sổ tay và lời chia tay của NPC — cùng một khoảnh khắc trong trận,
              nên cùng một thẻ. Đặt TRƯỚC danh sách nhiệm vụ vì đó là thứ nhiệm
              vụ NPC dẫn tới, và người dựng soạn nó ngay sau khi soạn xong chuỗi
              hội thoại. */}
          <CluebookPanel
            stage={stage}
            locale={locale}
            onPatch={(payload) =>
              void withError(async () => {
                const fresh = await updateStage(stageId, payload);
                setStage((prev) => (prev ? { ...prev, ...fresh } : prev));
              })
            }
          />

          <AudioPanel
            backgroundKind={backgroundKind}
            surface="stage"
            audio={stage.audio ?? {}}
            audioUrls={stage.audio_urls ?? {}}
            audioNames={stage.audio_names ?? {}}
            onSave={patchAudio}
            onError={setErrorKey}
          />

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
          stageCode={stage.stage_code}
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
          {/* Nói rõ ĐIỀU GÌ XẢY RA khi để trống, thay vì để người dựng tự đoán
              từ một ô nét đứt. Vùng va chạm vẫn sống: vẫn kéo được, vẫn chặn
              bước chân, vẫn bấm được — chỉ là không có hình. */}
          {!quest.icon_media_id && !uploading && (
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              {t('designer.noIconHint')}
            </p>
          )}
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
        {/* Nhiệm vụ NPC không gỡ được — nó là cổng vào của màn. Đổi ảnh, đổi vị
            trí, đổi câu hỏi thì vẫn được, nên phần còn lại của bảng giữ nguyên. */}
        {quest.phase !== 'advisor' && (
          <Button variant="danger" size="sm" onClick={onDelete}>
            {t('stage.builder.removeQuest')}
          </Button>
        )}
      </div>

      {quest.phase === 'advisor' && (
        <p className="mt-2 text-xs text-slate-500">🔒 {t('stage.builder.npcGateNote')}</p>
      )}
    </Card>
  );
}

/**
 * Nhân vật trên bảng: vừa là THƯỚC ƯỚM CỠ vừa là CHỖ XUẤT PHÁT.
 *
 * Kéo nó là đặt chỗ học sinh sẽ rơi xuống khi vào màn (`stages.spawn_x/spawn_y`);
 * kéo tay cầm ở góc là đặt chiều cao nhân vật trong cảnh. Hai việc trên cùng
 * một hình, và đó là điều đúng: cả hai đều là câu hỏi "nhân vật đứng thế nào
 * trong cái cảnh này", và tách ra hai chỗ thì người dựng phải căn một thứ ở
 * chỗ này rồi nhìn kết quả ở chỗ kia.
 *
 * Ở chế độ ĐI THỬ vùng đi được thì bàn phím lái nó, và cú kéo bằng chuột bị
 * chặn — hai bàn tay giành nhau cùng một toạ độ thì không tay nào thắng.
 *
 * Vẽ ĐÚNG MỘT khung, không chạy hoạt hình: đây là thước đo, mà một cái thước
 * đang nhấp nháy thì khó ướm. Mẹo `background-size: (số khung × 100%)` cắt lấy
 * khung đầu và kéo nó vừa khít thẻ — cùng nguyên lý Phaser dùng, nhưng theo
 * PHẦN TRĂM nên nó co giãn theo khung soạn mà không cần đo pixel.
 */
/**
 * Tâm TẤM ẢNH nhân vật, từ điểm va chạm nó đang đứng.
 *
 * Mép DƯỚI tấm ảnh thấp hơn điểm va chạm đúng `HERO_FOOT_Y`, nên tâm nằm cao
 * hơn điểm va chạm một nửa chiều cao trừ đi ngần ấy — y hệt cảnh chơi đặt sprite
 * ở `y = +HERO_FOOT_Y` với gốc giữa-dưới.
 *
 * Hàm riêng vì có HAI chỗ cần nó: chỗ vẽ tấm ảnh, và tay cầm đổi cỡ — tay cầm
 * đo khoảng cách tới TÂM, nên neo nó vào giữa bản đồ trong lúc nhân vật đang
 * đứng chỗ khác thì cú kéo đầu tiên làm nhân vật nhảy cỡ.
 */
function ghostCenter(
  stand: { x: number; y: number } | null,
  height: number,
): { x: number; y: number } {
  if (!stand) return { x: WORLD.width / 2, y: WORLD.height / 2 };
  return { x: stand.x, y: stand.y + HERO_FOOT_Y - height / 2 };
}

function CharacterGhost({
  action,
  height,
  active,
  label,
  stand,
  onPointerDown,
  onResize,
}: {
  /**
   * Tấm spritesheet để vẽ. `null` = world chưa gán nhân vật nào, hoặc nhân vật
   * chưa có tấm nào tải lên — vẫn vẽ MỘT Ô NÉT ĐỨT, không bỏ trắng.
   *
   * Ô đó không phải để ướm cỡ (không có hình người thì chẳng ướm được gì) mà
   * để CẦM MÀ KÉO: chỗ xuất phát là một thuộc tính của màn chơi, và nó có
   * nghĩa dù world đã gán nhân vật hay chưa. Không vẽ gì cả thì màn chơi của
   * một world chưa có nhân vật vĩnh viễn không đặt được chỗ xuất phát, mà cũng
   * chẳng có gì trên màn hình nói vì sao.
   */
  action: CharacterAction | null;
  /** Chiều cao đang vẽ, hệ toạ độ thế giới. */
  height: number;
  active: boolean;
  label: string;
  /**
   * ĐIỂM VA CHẠM nhân vật đang đứng — đúng cái điểm `canWalk()` xét trong cảnh
   * chơi, tức cao hơn gót chân `HERO_FOOT_Y`. `null` = đứng giữa bản đồ.
   *
   * Nhận điểm va chạm chứ không nhận tâm tấm ảnh, và đó là điểm mấu chốt: hai
   * chỗ đó cách nhau gần nửa chiều cao nhân vật, nên quy đổi ở chỗ gọi là mở
   * đúng một chỗ để lệch.
   */
  stand: { x: number; y: number } | null;
  onPointerDown: (event: ReactPointerEvent) => void;
  /** `null` = không đổi cỡ được (chưa có tấm nhân vật nào để ướm). */
  onResize: ((event: ReactPointerEvent, axis: ResizeAxis) => void) | null;
}) {
  const frames = Math.max(1, action?.frames ?? 1);
  const fw = action?.frame_width ?? 64;
  const fh = action?.frame_height ?? 64;

  const { x: centerX, y: centerY } = ghostCenter(stand, height);

  return (
    <div
      className="absolute"
      style={{
        left: `${(centerX / WORLD.width) * 100}%`,
        top: `${(centerY / WORLD.height) * 100}%`,
        // Đặt theo CHIỀU CAO, bề rộng suy ra từ tỉ lệ khung — y hệt cảnh chơi.
        height: `${(height / WORLD.height) * 100}%`,
        aspectRatio: `${fw} / ${fh}`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="relative size-full">
        <button
          type="button"
          title={label}
          onPointerDown={onPointerDown}
          className={`block size-full cursor-grab rounded-lg border-2 active:cursor-grabbing ${
            action
              ? active
                ? 'border-lagoon-400 bg-lagoon-400/10'
                : 'border-transparent hover:border-white/40'
              : /* CHƯA CÓ TẤM NÀO — nét đứt, rỗng ruột, đúng lối đã dùng cho
                   nhiệm vụ chưa có ảnh: nó là một chỗ đứng, không phải một
                   hình. Nét trắng kèm viền ngoài đen để đọc được trên cả chỗ
                   sáng lẫn chỗ tối của tranh nền. */
                `border-dashed outline-2 outline-abyss-950/60 ${
                  active
                    ? 'border-lagoon-400 bg-lagoon-400/10'
                    : 'border-white/85 bg-abyss-950/25'
                }`
          }`}
          style={{
            backgroundImage: action?.media_url ? `url(${action.media_url})` : undefined,
            backgroundSize: `${frames * 100}% 100%`,
            backgroundPosition: '0 0',
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated',
          }}
        />
        {/* CHỈ tay cầm ở góc: chiều cao là thứ duy nhất lưu được, bề rộng suy ra
            từ tỉ lệ khung của tấm spritesheet. Cho thêm hai tay cầm cạnh là hứa
            một điều không giữ được. */}
        {active && onResize && (
          <ResizeHandles axes={['both']} label={label} onStart={onResize} />
        )}
      </div>
    </div>
  );
}

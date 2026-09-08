'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, PageHeader, SectionTitle, Skeleton } from '@/components/ui/primitives';
import {
  FRAME,
  FRAME_WIDTH,
  GALAXY,
  hasContentFrame,
  isLobbyAction,
  LOBBY_ELEMENTS,
  LOBBY_ELEMENT_KEYS,
  LOBBY_GROUPS,
  lobbyBox,
  lobbyGroupOf,
  lobbyContentBox,
  lobbyTextLines,
  type FrameKind,
  type LobbyContentSaved,
  type LobbyElementKey,
  type LobbySaved,
} from '@/game/world';
import { ApiError } from '@/lib/api-error';
import { listGalaxies, type Galaxy } from '@/lib/galaxies';
import { ownText, pickText } from '@/lib/i18n-text';
import { BACKGROUND_ACCEPT, IMAGE_ACCEPT, uploadMedia } from '@/lib/media';
import { localizedPath } from '@/lib/routes';
import {
  getWorld,
  listChapters,
  updateChapter,
  updateWorld,
  type Chapter,
  type World,
} from '@/lib/worlds';

import { AudioPanel } from './audio-panel';
import { BackgroundLayer } from '@/components/game/background-layer';
import { FrameTextFields, MediaPicker } from './designer-fields';
import { GalaxyFrame } from './galaxy-frame';
import { LobbyBlock } from './lobby-block';
import { ResizeHandles } from './resize-handles';
import { useDesignBoard } from './use-design-board';
import { WorldCharacters } from './world-characters';

// Khung và khối cùng đi qua MỘT bộ kéo thả, nên cần một "id" phân biệt được.
// Tiền tố nói rõ id thuộc loại nào; không cái nào đụng id world (UUID).
const FRAME_ID: Record<FrameKind, string> = { title: 'frame:title', desc: 'frame:desc' };
const BLOCK_PREFIX = 'block:';
const CONTENT_PREFIX = 'content:';

/**
 * Các mức phóng của khung xem trước.
 *
 * Khung vẽ vừa chiều cao cửa sổ, tức khoảng 670px cho một sân 3200×1800 — một
 * khối chỉ số rộng 400 đơn vị ra chưa tới 85px trên màn hình, mà kéo một cái ô
 * 85px vào đúng hoa văn của tấm ảnh nền là việc của người có tay rất vững.
 *
 * Danh sách rời rạc chứ không phải thanh trượt: người ta muốn "to lên một nấc",
 * không muốn ngồi rà tìm 137%. Có cả mức NHỎ HƠN 1 để xem lại toàn cảnh trên
 * màn hình thấp.
 */
const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3] as const;

/** Sàn của khung nội dung, phần trăm khối. Nhỏ hơn nữa thì không còn chỗ cho
    một chữ cái, mà tay cầm đổi cỡ thì lại biến mất dưới chính cái viền. */
const CONTENT_MIN_PERCENT = 5;

/**
 * Kẹp một con số phần trăm vào đúng khoảng server nhận, làm tròn tới 0,1%.
 *
 * 0,1% chứ không phải số nguyên: khung nội dung của một khối rộng 1600 đơn vị
 * thì 1% đã là 16 đơn vị, đủ để chữ lệch hẳn khỏi chỗ vừa thả tay.
 */
const roundPercent = (value: number, min: number) =>
  Math.min(100, Math.max(min, Math.round(value * 10) / 10));

function frameKindOf(id: string): FrameKind | null {
  if (id === FRAME_ID.title) return 'title';
  if (id === FRAME_ID.desc) return 'desc';
  return null;
}

function blockKeyOf(id: string): LobbyElementKey | null {
  if (!id.startsWith(BLOCK_PREFIX)) return null;
  const key = id.slice(BLOCK_PREFIX.length) as LobbyElementKey;
  return key in LOBBY_ELEMENTS ? key : null;
}

function contentKeyOf(id: string): LobbyElementKey | null {
  if (!id.startsWith(CONTENT_PREFIX)) return null;
  const key = id.slice(CONTENT_PREFIX.length) as LobbyElementKey;
  return key in LOBBY_ELEMENTS ? key : null;
}

/**
 * Trình thiết kế PHÒNG CHỜ của một world — màn hình học sinh thấy khi bấm vào
 * world đó trên bản đồ thiên hà.
 *
 * Song song với `GalaxyDesigner`, một bậc thấp hơn trong cây nội dung, và dùng
 * lại đúng bộ máy đó: `useDesignBoard()`, `GalaxyFrame`, `MediaPicker`,
 * `FrameTextFields`.
 *
 * **Chưa đặt gì thì THỪA của thiên hà.** Mọi cột đều `null` được, và `null`
 * nghĩa là "lấy của thiên hà" chứ không phải "để trống". Nhờ vậy một world vừa
 * tạo đã có sẵn giao diện đúng tông với cả bản đồ; giáo viên chỉ động vào những
 * chỗ họ thực sự muốn khác. Chép sẵn giá trị của thiên hà xuống lúc tạo thì đổi
 * nền thiên hà sau này không lan xuống được world nào nữa.
 */
export function LobbyDesigner({ worldId }: { worldId: string }) {
  const t = useTranslations();
  const locale = useLocale();

  const [world, setWorld] = useState<World | null>(null);
  const [galaxy, setGalaxy] = useState<Galaxy | null>(null);
  //: Chương của world, chỉ để vẽ hàng chương cho giống thật và để tải ảnh lên.
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /**
   * Màu chữ đang RÊ TỚI trong bảng chọn màu — chỉ để vẽ, chưa ghi xuống.
   *
   * Cùng vai với `ghost` và `sizeDraft` của bộ kéo thả: thứ đang thay đổi dưới
   * tay người dùng thì sống ở client, và chỉ đi xuống server một lần lúc chốt.
   * `id` nói màu này của khung nào, y hệt `ghost.id`.
   */
  const [tint, setTint] = useState<{ id: string; color: string } | null>(null);
  /** Mức phóng của khung xem trước. Chỉ số trong `ZOOMS`; 1 = vừa bề rộng cột. */
  const [zoomAt, setZoomAt] = useState(ZOOMS.indexOf(1));
  const zoom = ZOOMS[zoomAt] ?? 1;
  const [uploading, setUploading] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

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

  useEffect(() => {
    if (saveState !== 'saved') return;
    const timer = setTimeout(() => setSaveState('idle'), 2500);
    return () => clearTimeout(timer);
  }, [saveState]);

  const reload = useCallback(async () => {
    try {
      const [w, galaxies, chapterList] = await Promise.all([
        getWorld(worldId),
        listGalaxies(),
        listChapters(worldId),
      ]);
      setWorld(w);
      setChapters(chapterList);
      setGalaxy(galaxies.find((g) => g.id === w.galaxy_id) ?? galaxies[0] ?? null);
      setErrorKey(null);
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    } finally {
      setLoading(false);
    }
  }, [worldId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function patch(payload: Parameters<typeof updateWorld>[1]) {
    try {
      setWorld(await tracked(() => updateWorld(worldId, payload)));
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    }
  }

  const board = useDesignBoard({
    canvas: GALAXY,
    minSize: FRAME_WIDTH.min,
    maxSize: FRAME_WIDTH.max,
    onMove: (id, x, y) => {
      const kind = frameKindOf(id);
      if (kind) return void patch({ [`${kind}_x`]: x, [`${kind}_y`]: y });

      // Khung nội dung lưu theo PHẦN TRĂM CỦA KHỐI, mà bảng kéo thả thì làm
      // việc bằng hệ toạ độ thế giới — nên đổi hệ ngay ở đây, chỗ duy nhất
      // biết cả hai. Xem `LobbyContentSaved` về việc vì sao lưu phần trăm.
      const inner = contentKeyOf(id);
      if (inner) {
        const block = lobbyBox(inner, world?.lobby_json?.[inner] as LobbySaved | undefined);
        return void patchContent(inner, {
          x: roundPercent(((x - block.x) / block.width) * 100 + 50, 0),
          y: roundPercent(((y - block.y) / block.height) * 100 + 50, 0),
        });
      }

      const key = blockKeyOf(id);
      if (!key) return;

      // Kéo khối CHA thì các khối con đi theo đúng bấy nhiêu.
      //
      // Khối cha là tấm ảnh khung, khối con là những con số nằm đúng vào các ô
      // vẽ sẵn trên tấm ảnh đó. Dời khung mà bỏ con số lại là người dựng phải
      // căn lại năm cái một lần nữa — mà họ vừa căn xong.
      const members = LOBBY_GROUPS[key];
      if (members) {
        const before = lobbyBox(key, world?.lobby_json?.[key] as LobbySaved | undefined);
        return void moveGroup(members, x - before.x, y - before.y);
      }

      void patchBlock(key, { x, y });
    },
    // Chỉ ghi lại chiều THỰC SỰ được kéo. Kéo cạnh phải mà cũng ghi chiều cao
    // là ghi đè một con số người dùng không đụng tới.
    onResize: (id, size, axis) => {
      const change = axis === 'x' ? { w: size.w } : axis === 'y' ? { h: size.h } : size;
      const kind = frameKindOf(id);
      if (kind) {
        return void patch({
          ...(change.w !== undefined && { [`${kind}_width`]: change.w }),
          ...(change.h !== undefined && { [`${kind}_height`]: change.h }),
        });
      }

      const inner = contentKeyOf(id);
      if (inner) {
        const block = lobbyBox(inner, world?.lobby_json?.[inner] as LobbySaved | undefined);
        return void patchContent(inner, {
          ...(change.w !== undefined && {
            w: roundPercent((change.w / block.width) * 100, CONTENT_MIN_PERCENT),
          }),
          ...(change.h !== undefined && {
            h: roundPercent((change.h / block.height) * 100, CONTENT_MIN_PERCENT),
          }),
        });
      }

      const key = blockKeyOf(id);
      if (key) void patchBlock(key, change);
    },
  });

  /**
   * Dời cả một nhóm khối đi cùng một khoảng, trong MỘT lần gửi.
   *
   * Một lần gửi chứ không sáu: server gộp theo từng khối nên nhận được nhiều
   * khối một lúc, còn gửi sáu request nối nhau thì mỗi cái đọc `world` ở một
   * thời điểm khác nhau và cái sau ghi đè cái trước.
   *
   * Toạ độ kẹp lại trong khung 3200×1800 — đó là khoảng server nhận. Kéo khung
   * ra sát mép mà một con số văng ra ngoài thì cả lần lưu bị từ chối, và người
   * dựng thấy thao tác vừa rồi "không ăn" mà không hiểu vì sao.
   */
  async function moveGroup(
    members: readonly LobbyElementKey[],
    dx: number,
    dy: number,
    also?: { key: LobbyElementKey; change: Partial<LobbySaved> },
  ) {
    const next: Record<string, LobbySaved> = {};
    for (const member of members) {
      const current = (world?.lobby_json?.[member] ?? {}) as LobbySaved;
      const box = lobbyBox(member, current);
      next[member] = {
        ...current,
        x: Math.round(Math.min(GALAXY.width, Math.max(0, box.x + dx))),
        y: Math.round(Math.min(GALAXY.height, Math.max(0, box.y + dy))),
      };
    }
    if (also) next[also.key] = { ...next[also.key], ...also.change };
    await patch({ lobby_json: next });
  }

  /**
   * Sửa một khối từ BẢNG THUỘC TÍNH — gõ toạ độ bằng ô số.
   *
   * Đi qua cùng một cửa với cú kéo: gõ `x` cho khối cha thì các khối con cũng
   * dời theo. Không có chỗ này thì kéo chuột và gõ số cho ra hai kết quả khác
   * nhau, mà người dùng thì không có cách nào đoán được là hai.
   *
   * Đổi KÍCH THƯỚC (`w`, `h`) chỉ đổi của riêng khối cha: khung to ra thì các
   * con số bên trong vẫn ở đúng chỗ chúng được căn, đó là điều người dựng mong
   * đợi khi kéo một cái tay cầm ở góc.
   */
  async function changeBlock(key: LobbyElementKey, change: Partial<LobbySaved>) {
    const members = LOBBY_GROUPS[key];
    const moved = change.x !== undefined || change.y !== undefined;
    if (!members || !moved) return void patchBlock(key, change);

    const before = lobbyBox(key, world?.lobby_json?.[key] as LobbySaved | undefined);
    const { x, y, ...rest } = change;
    await moveGroup(
      members,
      (x ?? before.x) - before.x,
      (y ?? before.y) - before.y,
      Object.keys(rest).length ? { key, change: rest } : undefined,
    );
  }

  /**
   * Sửa MỘT khối của bố cục.
   *
   * Gửi trọn cả khối, không chỉ trường vừa đổi: server gộp ở mức khối, nên gửi
   * mỗi `{x, y}` sẽ làm mất `media_id` đang có. Gộp sâu hơn ở server thì lại
   * không ai đoán được `media_id: null` nghĩa là "gỡ ảnh" hay "không gửi".
   */
  async function patchBlock(key: LobbyElementKey, change: Partial<LobbySaved>) {
    const current = (world?.lobby_json?.[key] ?? {}) as LobbySaved;
    await patch({ lobby_json: { [key]: { ...current, ...change } } });
  }

  /**
   * Sửa KHUNG NỘI DUNG của một khối.
   *
   * Gộp lồng thêm một tầng so với `patchBlock`: khung nội dung là một object
   * con bên trong khối, mà server gộp ở mức KHỐI — gửi mỗi `{content: {x, y}}`
   * sẽ làm mất màu chữ và cỡ chữ đang có.
   */
  async function patchContent(key: LobbyElementKey, change: Partial<LobbyContentSaved>) {
    const current = (world?.lobby_json?.[key] ?? {}) as LobbySaved;
    await patchBlock(key, { content: { ...(current.content ?? {}), ...change } });
  }

  /**
   * Tải ảnh cho một CHƯƠNG — ô nhỏ trên hàng chương, hoặc ảnh nền của minimap.
   *
   * Hai ảnh, một hàm: khác nhau đúng một tên cột. Chương nào cũng có thể có ảnh
   * này mà không có ảnh kia.
   */
  async function uploadChapterImage(chapterId: string, kind: 'cover' | 'minimap', file: File) {
    setUploading(`${chapterId}:${kind}`);
    try {
      const asset = await uploadMedia(file, 'chapter-covers');
      const updated = await tracked(() =>
        updateChapter(chapterId, { [`${kind}_media_id`]: asset.id }),
      );
      setChapters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    } finally {
      setUploading(null);
    }
  }

  /** Tải ảnh nền cho một KHỐI. Ảnh của khung thì đi qua `uploadFor()`. */
  async function uploadBlock(key: LobbyElementKey, file: File) {
    setUploading(key);
    try {
      const asset = await uploadMedia(file, 'world-lobby');
      await patchBlock(key, { media_id: asset.id });
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    } finally {
      setUploading(null);
    }
  }

  async function uploadFor(kind: 'lobby' | 'title' | 'desc', file: File) {
    setUploading(kind);
    try {
      const asset = await uploadMedia(file, 'world-lobby');
      await patch({ [`${kind}_media_id`]: asset.id });
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    } finally {
      setUploading(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!world) {
    return (
      <p role="alert" className="mx-auto max-w-lg rounded-lg bg-coral-500/15 px-4 py-3 text-coral-500">
        {t(errorKey ?? 'error.NOT_FOUND')}
      </p>
    );
  }

  /** Giá trị đang có hiệu lực: của world nếu đã đặt, không thì của thiên hà. */
  function effective<K extends keyof World & keyof Galaxy>(key: K) {
    return world![key] ?? galaxy?.[key] ?? null;
  }

  const background = world.lobby_url ?? galaxy?.background_url ?? null;
  // Loại nền phải đi theo ĐÚNG cái nguồn vừa chọn ở trên. Tính riêng hai vế là
  // mở cửa cho việc phòng chờ thừa một video của thiên hà mà vẫn bị vẽ bằng
  // `<img>` — nền trắng, không lỗi nào, không ai hiểu vì sao.
  const backgroundKind = world.lobby_url ? world.lobby_kind : (galaxy?.background_kind ?? null);
  const selectedBlock = selectedId ? blockKeyOf(selectedId) : null;

  // Hàng chương trong khung xem trước vẽ bằng chương THẬT của world, không phải
  // năm ô bịa: giáo viên phải thấy đúng cái tên và cái ảnh học sinh sẽ thấy.
  const chapterCells = chapters.map((chapter) => ({
    id: chapter.id,
    name: pickText(chapter.name_i18n, locale),
    coverUrl: chapter.cover_url,
    // Chương chưa có màn nào phát hành thì học sinh thấy ổ khoá — cùng luật với
    // world trên bản đồ thiên hà.
    locked: chapter.stages.every((stage) => stage.status !== 'published'),
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb
        items={[
          { label: t('teacher.title'), href: localizedPath('/teacher', locale) },
          { label: t('world.list.title'), href: localizedPath('/teacher/worlds', locale) },
          {
            label: pickText(world.name_i18n, locale),
            href: localizedPath(`/teacher/worlds/${world.id}`, locale),
          },
          { label: t('lobby.designer.title') },
        ]}
      />

      <PageHeader
        title={t('lobby.designer.title')}
        description={t('lobby.designer.subtitle')}
        actions={
          saveState !== 'idle' && (
            <span className="text-xs text-slate-400">
              {saveState === 'saving' ? t('common.loading') : `✓ ${t('designer.saved')}`}
            </span>
          )
        }
      />

      {errorKey && (
        <p role="alert" className="mb-4 rounded-lg bg-coral-500/15 px-4 py-2 text-sm text-coral-500">
          {t(errorKey)}
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_20rem]">
        <div>
          {/* Phóng bằng cách đổi BỀ RỘNG THẬT của khung, không phải
              `transform: scale`. `useDesignBoard` đổi toạ độ chuột sang hệ
              thế giới bằng `getBoundingClientRect()`, nên khung to lên là
              phép đổi tự đúng theo — còn `scale` thì thêm một tầng biến đổi
              nữa mà mọi chỗ đo đạc đều phải nhớ trừ ra. Thẻ bọc cuộn ngang
              để phóng quá bề rộng cột thì cuộn, chứ không bóp khung lại. */}
          <div className="sticky top-3 z-10 overflow-auto">
            <div
              ref={board.boardRef}
              className="relative mx-auto overflow-hidden rounded-2xl border border-abyss-700 bg-abyss-950 select-none"
              style={{
                aspectRatio: `${GALAXY.width} / ${GALAXY.height}`,
                width: `calc(min(100%, 51vh * 16 / 9) * ${zoom})`,
              }}
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
                  {t('galaxy.designer.noBackground')}
                </div>
              )}

              {/* Sáu khối của phòng chờ. Duyệt qua SỔ ĐĂNG KÝ, không viết tay từng
                  cái: thêm một khối mới sau này chỉ là thêm một dòng trong
                  `LOBBY_ELEMENTS` cộng một khoá chữ. */}
              {LOBBY_ELEMENT_KEYS.map((key) => {
                const id = BLOCK_PREFIX + key;
                const saved = world.lobby_json?.[key] as LobbySaved | undefined;
                const base = lobbyBox(key, saved);
                const live = board.ghost?.id === id ? board.ghost : null;

                // Cha đang bị kéo thì con chạy theo NGAY, không đợi thả tay.
                // Đợi thả tay thì trong suốt lúc kéo, người dựng nhìn thấy một
                // tấm khung rỗng đi một đằng và năm con số đứng lại một nẻo —
                // tức là không nhìn thấy được thứ mình đang căn.
                const parentKey = lobbyGroupOf(key);
                const parentGhost =
                  parentKey === key ? null : board.ghost?.id === BLOCK_PREFIX + parentKey
                    ? board.ghost
                    : null;
                const parentBase = parentGhost
                  ? lobbyBox(parentKey, world.lobby_json?.[parentKey] as LobbySaved | undefined)
                  : null;

                const x = live?.x ?? base.x + (parentGhost && parentBase ? parentGhost.x - parentBase.x : 0);
                const y = live?.y ?? base.y + (parentGhost && parentBase ? parentGhost.y - parentBase.y : 0);
                const draft = board.sizeDraft?.id === id ? board.sizeDraft : null;
                const width = draft?.w ?? base.width;
                const height = draft?.h ?? base.height;
                const active = selectedId === id;
                const target = { id, x, y, w: width, h: height };

                // Khung nội dung, quy về PHẦN TRĂM đang vẽ: theo tay đang kéo nếu
                // có, không thì theo giá trị đã lưu. Nhờ vậy chữ bên trong đi
                // theo cái viền ngay trong lúc kéo, chứ không nhảy một phát lúc
                // thả tay — không nhìn thấy chữ đang đi đâu thì căn kiểu gì.
                const innerId = CONTENT_PREFIX + key;
                const innerSaved = lobbyContentBox(saved?.content);
                const innerGhost = board.ghost?.id === innerId ? board.ghost : null;
                const innerDraft = board.sizeDraft?.id === innerId ? board.sizeDraft : null;
                const inner = {
                  ...innerSaved,
                  // Màu đang rê trong bảng chọn thắng màu đã lưu — đó là cả mục
                  // đích của việc xem trước.
                  color: tint?.id === id ? tint.color : innerSaved.color,
                  x: innerGhost ? ((innerGhost.x - x) / width) * 100 + 50 : innerSaved.x,
                  y: innerGhost ? ((innerGhost.y - y) / height) * 100 + 50 : innerSaved.y,
                  w: innerDraft ? (innerDraft.w / width) * 100 : innerSaved.w,
                  h: innerDraft ? (innerDraft.h / height) * 100 : innerSaved.h,
                };
                const innerTarget = {
                  id: innerId,
                  x: x + ((inner.x - 50) / 100) * width,
                  y: y + ((inner.y - 50) / 100) * height,
                  w: (inner.w / 100) * width,
                  h: (inner.h / 100) * height,
                  // Giới hạn RIÊNG: khung nội dung nằm trong một khối, mà có khối
                  // chỉ cao 88 đơn vị — sàn chung của bảng (bề rộng nhỏ nhất của
                  // một khung chữ) sẽ không cho nó co lại quá nửa khối.
                  min: Math.min(width, height) * (CONTENT_MIN_PERCENT / 100),
                  max: Math.max(width, height),
                };

                return (
                  <div
                    key={key}
                    className="absolute"
                    style={{
                      left: `${(x / GALAXY.width) * 100}%`,
                      top: `${(y / GALAXY.height) * 100}%`,
                      width: `${(width / GALAXY.width) * 100}%`,
                      height: `${(height / GALAXY.height) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <div className="relative size-full">
                      <button
                        type="button"
                        title={t('galaxy.designer.dragHint')}
                        onPointerDown={(event) => {
                          setSelectedId(id);
                          board.startDrag(event, target);
                        }}
                        className={`block size-full cursor-grab rounded-xl ring-2 active:cursor-grabbing ${
                          active ? 'ring-lagoon-400' : 'ring-transparent hover:ring-white/40'
                        }`}
                      >
                        <LobbyBlock
                          elementKey={key}
                          imageUrl={world.lobby_urls?.[key]}
                          label={t(`lobby.element.${key}`)}
                          text={pickText(
                            ((world.lobby_json?.[key] ?? {}) as LobbySaved).text_i18n ?? undefined,
                            locale,
                          )}
                          lines={lobbyTextLines(key, saved)}
                          content={inner}
                          chapters={chapterCells}
                        />
                      </button>
                      {active && (
                        <ResizeHandles
                          label={t('galaxy.designer.resizeHint')}
                          onStart={(event, axis) => board.startResize(event, target, axis)}
                        />
                      )}

                      {/* Viền của khung nội dung — CHỈ hiện khi khối đang được
                          chọn, và chỉ với khối THỰC SỰ có khung nội dung. Hiện cả
                          bảy cái cùng lúc thì màn thiết kế thành một mớ khung đứt
                          nét chồng nhau, mà mỗi lúc người ta cũng chỉ căn đúng
                          một khối; còn vẽ nó lên một khối không có khung riêng
                          thì thành hai chỗ để kéo cho cùng một kết quả. */}
                      {active && hasContentFrame(key) && (
                        <div
                          className="absolute"
                          style={{
                            left: `${inner.x}%`,
                            top: `${inner.y}%`,
                            width: `${inner.w}%`,
                            height: `${inner.h}%`,
                            transform: 'translate(-50%, -50%)',
                          }}
                        >
                          <div className="relative size-full">
                            <button
                              type="button"
                              title={t('lobby.designer.contentDrag')}
                              onPointerDown={(event) => board.startDrag(event, innerTarget)}
                              className="block size-full cursor-grab rounded-md border-2 border-dashed border-orichalcum-400 bg-orichalcum-400/10 active:cursor-grabbing"
                            />
                            <ResizeHandles
                              tone="orichalcum"
                              label={t('galaxy.designer.resizeHint')}
                              onStart={(event, axis) => board.startResize(event, innerTarget, axis)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {(['title', 'desc'] as const).map((kind) => {
                const live = board.ghost?.id === FRAME_ID[kind] ? board.ghost : null;
                const x = live?.x ?? effective(`${kind}_x` as never) ?? FRAME[kind].x;
                const y = live?.y ?? effective(`${kind}_y` as never) ?? FRAME[kind].y;
                const fDraft = board.sizeDraft?.id === FRAME_ID[kind] ? board.sizeDraft : null;
                const width =
                  fDraft?.w ?? effective(`${kind}_width` as never) ?? FRAME[kind].width;
                const height = fDraft?.h ?? effective(`${kind}_height` as never) ?? null;
                const active = selectedId === FRAME_ID[kind];
                // Chưa kéo cạnh dưới bao giờ thì chưa có chiều cao lưu; lấy chiều
                // cao ĐANG VẼ làm điểm xuất phát, để cú kéo đầu tiên không nhảy.
                const target = { id: FRAME_ID[kind], x, y, w: width, h: height ?? width / 4 };

                return (
                  <GalaxyFrame
                    key={kind}
                    kind={kind}
                    imageUrl={effective(`${kind}_url` as never)}
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    color={
                      tint?.id === FRAME_ID[kind]
                        ? tint.color
                        : effective(`${kind}_color` as never)
                    }
                    fontScale={effective(`${kind}_font` as never)}
                    wrapper={(boxStyle, content) => (
                      <div className="absolute" {...boxStyle}>
                        <div className="relative w-full">
                          <button
                            type="button"
                            title={t('galaxy.designer.dragHint')}
                            onPointerDown={(event) => {
                              setSelectedId(FRAME_ID[kind]);
                              board.startDrag(event, target);
                            }}
                            className={`block w-full cursor-grab rounded-lg ring-2 active:cursor-grabbing ${
                              active ? 'ring-lagoon-400' : 'ring-transparent hover:ring-white/40'
                            }`}
                          >
                            {content}
                          </button>
                          {active && (
                            <ResizeHandles
                              label={t('galaxy.designer.resizeHint')}
                              onStart={(event, axis) => board.startResize(event, target, axis)}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  >
                    {kind === 'title'
                      ? pickText(world.name_i18n, locale)
                      : pickText(world.story_i18n, locale)}
                  </GalaxyFrame>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              {t('galaxy.designer.dragHint')} · {t('designer.autoSave')}
            </p>

            <div className="flex shrink-0 items-center gap-1">
              <ZoomButton
                label={t('lobby.designer.zoomOut')}
                sign="−"
                disabled={zoomAt === 0}
                onClick={() => setZoomAt((i) => Math.max(0, i - 1))}
              />
              {/* Bấm vào con số là về vừa khung — chỗ HIỆN mức phóng cũng là chỗ
                  người ta tìm tới khi muốn thoát khỏi mức phóng. */}
              <button
                type="button"
                title={t('lobby.designer.zoomReset')}
                onClick={() => setZoomAt(ZOOMS.indexOf(1))}
                className="w-12 rounded-lg py-1 text-center font-mono text-xs text-slate-400 transition hover:text-lagoon-400"
              >
                {Math.round(zoom * 100)}%
              </button>
              <ZoomButton
                label={t('lobby.designer.zoomIn')}
                sign="+"
                disabled={zoomAt === ZOOMS.length - 1}
                onClick={() => setZoomAt((i) => Math.min(ZOOMS.length - 1, i + 1))}
              />
            </div>
          </div>

          {/* Bảng cấu hình khối nằm NGAY DƯỚI khung xem trước và xếp NGANG —
              cùng lý do với bảng sửa world bên trình thiết kế thiên hà: xếp dọc
              ở cột phải thì nó dài quá màn hình, và lúc cuộn xuống tới ô đang
              sửa thì cái khối đang sửa đã trôi mất khỏi tầm nhìn. */}
          {selectedBlock && (
            <BlockInspector
              // Khoá mang theo GIÁ TRỊ, không chỉ tên khối. Mọi ô số ở đây dùng
              // `defaultValue` — React chỉ đọc nó lúc gắn — nên kéo khối trên
              // bảng xong thì bảng điều khiển vẫn hiện con số cũ, và ai gõ đè
              // lên đó là vô tình kéo cái khối về chỗ trước cú kéo. Đổi khoá
              // là gắn lại, và ô số đọc lại giá trị thật.
              key={`${selectedBlock}:${JSON.stringify(world.lobby_json?.[selectedBlock] ?? {})}`}
              elementKey={selectedBlock}
              saved={(world.lobby_json?.[selectedBlock] ?? {}) as LobbySaved}
              imageUrl={world.lobby_urls?.[selectedBlock]}
              busy={uploading === selectedBlock}
              onUpload={(file) => void uploadBlock(selectedBlock, file)}
              onClear={() => void patchBlock(selectedBlock, { media_id: null })}
              onChange={(change) => void changeBlock(selectedBlock, change)}
              onContentChange={(change) => void patchContent(selectedBlock, change)}
              onTextPreview={(color) => setTint(color ? { id: BLOCK_PREFIX + selectedBlock, color } : null)}
              onTextColor={(color) =>
                void patchContent(selectedBlock, { color }).then(() => setTint(null))
              }
            />
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-3 lg:max-h-[calc(100vh-1.5rem)] lg:overflow-y-auto lg:pr-1">
          <Card>
            <SectionTitle>{t('lobby.designer.scene')}</SectionTitle>
            <p className="mb-3 text-xs text-slate-500">{t('lobby.designer.inheritHint')}</p>

            <MediaPicker
              label={t('galaxy.designer.background')}
              accept={BACKGROUND_ACCEPT}
              busy={uploading === 'lobby'}
              hasValue={Boolean(world.lobby_media_id)}
              onPick={(file) => void uploadFor('lobby', file)}
              onClear={() => void patch({ clear_lobby: true })}
              clearLabel={t('lobby.designer.useGalaxy')}
              preview={
                background ? (
                  <BackgroundLayer
                    url={background}
                    kind={backgroundKind}
                    still
                    className="mb-2 h-20 w-full rounded-lg border border-abyss-700 object-cover"
                  />
                ) : null
              }
            />

            <label className="mt-3 block">
              <span className="field-label">{t('galaxy.designer.worldName')}</span>
              <input
                className="field-input"
                defaultValue={ownText(world.name_i18n, locale)}
                placeholder={pickText(world.name_i18n, locale)}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next && next !== ownText(world.name_i18n, locale)) {
                    void patch({ name_i18n: { ...world.name_i18n, [locale]: next } });
                  }
                }}
              />
            </label>

            <label className="mt-3 block">
              <span className="field-label">{t('lobby.designer.worldLevel')}</span>
              <input
                className="field-input"
                defaultValue={ownText(world.level_i18n, locale)}
                placeholder={t(`world.difficulty.${world.difficulty}`)}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next !== ownText(world!.level_i18n, locale)) {
                    void patch({ level_i18n: { ...world!.level_i18n, [locale]: next } });
                  }
                }}
              />
              <span className="mt-1 block text-xs text-slate-500">
                {t('lobby.designer.worldLevelHint')}
              </span>
            </label>

            <label className="mt-3 block">
              <span className="field-label">{t('galaxy.designer.worldStory')}</span>
              <textarea
                rows={3}
                className="field-input resize-y"
                defaultValue={ownText(world.story_i18n, locale)}
                placeholder={pickText(world.story_i18n, locale)}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next !== ownText(world.story_i18n, locale)) {
                    void patch({ story_i18n: { ...world.story_i18n, [locale]: next } });
                  }
                }}
              />
            </label>
          </Card>

          <AudioPanel
            backgroundKind={backgroundKind}
            surface="lobby"
            audio={world.audio ?? {}}
            audioUrls={world.audio_urls ?? {}}
            audioNames={world.audio_names ?? {}}
            onSave={(slot, track) => patch({ audio: { [slot]: track } })}
            onError={setErrorKey}
          />

          <Card>
            <SectionTitle>{t('galaxy.designer.frames')}</SectionTitle>
            <p className="mb-3 text-xs text-slate-500">{t('lobby.designer.inheritHint')}</p>

            {(['title', 'desc'] as const).map((kind) => (
              <div key={kind} className="mb-4 last:mb-0">
                <MediaPicker
                  label={t(
                    kind === 'title' ? 'galaxy.designer.titleFrame' : 'galaxy.designer.descFrame',
                  )}
                  accept={IMAGE_ACCEPT}
                  busy={uploading === kind}
                  hasValue={Boolean(world[`${kind}_media_id`])}
                  onPick={(file) => void uploadFor(kind, file)}
                  onClear={() =>
                    void patch(kind === 'title' ? { clear_title: true } : { clear_desc: true })
                  }
                  clearLabel={t('lobby.designer.useGalaxy')}
                  preview={
                    effective(`${kind}_url` as never) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={effective(`${kind}_url` as never)!}
                        alt=""
                        className="mb-2 max-h-16 w-full rounded-lg border border-abyss-700 object-contain"
                      />
                    ) : null
                  }
                />

                <FrameTextFields
                  color={effective(`${kind}_color` as never) ?? FRAME[kind].color}
                  fontScale={effective(`${kind}_font` as never) ?? 100}
                  onPreview={(color) => setTint(color ? { id: FRAME_ID[kind], color } : null)}
                  onColor={(value) =>
                    void patch({ [`${kind}_color`]: value }).then(() => setTint(null))
                  }
                  onFontScale={(value) => void patch({ [`${kind}_font`]: value })}
                />
              </div>
            ))}
          </Card>

          <WorldCharacters worldId={world.id} />

          <Card>
            <SectionTitle>{t('lobby.designer.chapterImages')}</SectionTitle>
            <p className="mb-3 text-xs text-slate-500">{t('lobby.designer.chapterImagesHint')}</p>
            {chapters.length === 0 ? (
              <p className="text-xs text-slate-500">{t('world.detail.noChapter')}</p>
            ) : (
              <ul className="space-y-4">
                {chapters.map((chapter) => (
                  <li key={chapter.id}>
                    <p className="mb-1.5 truncate text-xs font-semibold text-slate-300">
                      {chapter.order_index}. {pickText(chapter.name_i18n, locale)}
                    </p>
                    {/* Hai ảnh cạnh nhau, mỗi ảnh một nhãn: chúng đi tới hai chỗ
                        khác nhau trên màn học sinh, nên phải nhìn ra ngay cái nào
                        là cái nào. */}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <ChapterImageField
                        label={t('lobby.designer.chapterCover')}
                        url={chapter.cover_url}
                        busy={uploading === `${chapter.id}:cover`}
                        onPick={(file) => void uploadChapterImage(chapter.id, 'cover', file)}
                      />
                      <ChapterImageField
                        label={t('lobby.designer.chapterMinimap')}
                        url={chapter.minimap_url}
                        busy={uploading === `${chapter.id}:minimap`}
                        onPick={(file) => void uploadChapterImage(chapter.id, 'minimap', file)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <Link href={localizedPath(`/teacher/worlds/${world.id}`, locale)}>
              <Button variant="secondary" size="sm">
                {t('galaxy.designer.openWorld')}
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Một ô tải ảnh của chương: ảnh xem trước, tên, và ô chọn file. */
function ChapterImageField({
  label,
  url,
  busy,
  onPick,
}: {
  label: string;
  url: string | null | undefined;
  busy: boolean;
  onPick: (file: File) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="size-10 shrink-0 rounded-lg border border-abyss-700 object-cover"
        />
      ) : (
        <span className="size-10 shrink-0 rounded-lg border border-dashed border-abyss-700" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] leading-tight text-slate-500">{label}</p>
        <input
          type="file"
          accept={IMAGE_ACCEPT}
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPick(file);
            // Xoá giá trị để chọn LẠI đúng file vừa chọn vẫn kích hoạt onChange.
            e.target.value = '';
          }}
          className="mt-0.5 block w-full text-[11px] text-slate-400 file:mr-2 file:rounded file:border-0 file:bg-abyss-800 file:px-2 file:py-0.5 file:text-slate-200 hover:file:bg-abyss-700"
        />
      </div>
    </div>
  );
}

/**
 * Bảng cấu hình một khối, xếp NGANG.
 *
 * Cùng ba thứ cho mọi khối — ảnh nền, chỗ đứng, bề rộng — nên một component
 * duy nhất chạy cho cả sáu, và cho mọi khối thêm vào sau này.
 *
 * Ô toạ độ và bề rộng gõ tay được, không chỉ kéo. Kéo thả nhanh nhưng không
 * chính xác; căn ba cái nút thẳng hàng bằng cách kéo là việc không ai làm nổi.
 */
function ZoomButton({
  label,
  sign,
  disabled,
  onClick,
}: {
  label: string;
  sign: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="size-7 rounded-lg border border-abyss-700 text-sm text-slate-300 transition hover:border-lagoon-400 hover:text-lagoon-400 disabled:pointer-events-none disabled:opacity-30"
    >
      {sign}
    </button>
  );
}

function BlockInspector({
  elementKey,
  saved,
  imageUrl,
  busy,
  onUpload,
  onClear,
  onChange,
  onContentChange,
  onTextPreview,
  onTextColor,
}: {
  elementKey: LobbyElementKey;
  saved: LobbySaved;
  imageUrl: string | null | undefined;
  busy: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
  onChange: (change: Partial<LobbySaved>) => void;
  onContentChange: (change: Partial<LobbyContentSaved>) => void;
  /** Màu chữ đang rê tới: chỉ để vẽ, chưa ghi. `null` = thôi xem trước. */
  onTextPreview: (color: string | null) => void;
  /** Chốt màu chữ. Tách khỏi `onContentChange` vì nó còn phải dọn màu xem
      trước sau khi ghi xong. */
  onTextColor: (color: string) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const box = lobbyBox(elementKey, saved);
  const inner = lobbyContentBox(saved.content);
  const ownButtonText = ownText(saved.text_i18n ?? undefined, locale);

  const innerNumbers = [
    { field: 'x' as const, value: inner.x, min: 0 },
    { field: 'y' as const, value: inner.y, min: 0 },
    { field: 'w' as const, value: inner.w, min: CONTENT_MIN_PERCENT },
    { field: 'h' as const, value: inner.h, min: CONTENT_MIN_PERCENT },
  ];

  const numbers = [
    { field: 'x' as const, value: box.x, max: GALAXY.width },
    { field: 'y' as const, value: box.y, max: GALAXY.height },
    { field: 'w' as const, value: box.width, max: GALAXY.width },
    { field: 'h' as const, value: box.height, max: GALAXY.height },
  ];

  return (
    <Card className="mt-4" padded={false}>
      <div className="p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <SectionTitle>{t(`lobby.element.${elementKey}`)}</SectionTitle>
          <span className="font-mono text-xs text-slate-500">
            {box.x}, {box.y} · {box.width}×{box.height}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="sm:col-span-2">
            <MediaPicker
              label={t('lobby.designer.blockImage')}
              accept={IMAGE_ACCEPT}
              busy={busy}
              hasValue={Boolean(saved.media_id)}
              onPick={onUpload}
              onClear={onClear}
              preview={
                imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt=""
                    className="mb-2 max-h-20 w-full rounded-lg border border-abyss-700 object-contain"
                  />
                ) : null
              }
            />
          </div>

          {/* Chữ trên nút — CHỈ nút mới có. Khối khác đã có nội dung riêng (dãy
              chỉ số, bảng xếp hạng, hàng chương), một dòng chữ đè lên trên
              chúng không để làm gì. Bỏ trống = học sinh chỉ thấy tấm ảnh, và
              đó là mặc định: ảnh nút thường đã vẽ sẵn chữ trong tranh. */}
          {isLobbyAction(elementKey) && (
            <label className="block sm:col-span-2 xl:col-span-3">
              <span className="field-label">{t('lobby.designer.buttonText')}</span>
              <input
                className="field-input"
                defaultValue={ownButtonText}
                placeholder={t('lobby.designer.buttonTextEmpty')}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next !== ownButtonText) {
                    onChange({ text_i18n: { ...(saved.text_i18n ?? {}), [locale]: next } });
                  }
                }}
              />
            </label>
          )}

          {numbers.map((n) => (
            <label key={n.field} className="block">
              <span className="field-label">{t(`lobby.designer.field.${n.field}`)}</span>
              <input
                type="number"
                min={0}
                max={n.max}
                className="field-input"
                defaultValue={n.value}
                onBlur={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isFinite(next) && next !== n.value) onChange({ [n.field]: next });
                }}
              />
            </label>
          ))}
        </div>
      </div>

      {/* Khung NỘI DUNG: chỗ thật sự vẽ chữ, bên trong tấm ảnh nền. Tách hẳn
          thành một mục riêng vì bốn con số ở trên nói về KHỐI, còn bốn con số
          dưới đây nói về cái ô BÊN TRONG khối — và chúng khác cả đơn vị.

          Khối không có khung nội dung riêng thì chỉ còn màu chữ và cỡ chữ: bốn
          con số kia sẽ nói về một cái hộp trùng khít với chính cái khối, tức
          bốn ô nhập không đổi được gì. */}
      <div className="border-t border-abyss-800 p-4">
        {hasContentFrame(elementKey) ? (
          <>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <SectionTitle>{t('lobby.designer.contentBox')}</SectionTitle>
              <span className="font-mono text-xs text-slate-500">
                {inner.x}%, {inner.y}% · {inner.w}×{inner.h}%
              </span>
            </div>
            <p className="mb-3 text-xs text-slate-500">{t('lobby.designer.contentHint')}</p>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {innerNumbers.map((n) => (
                <label key={n.field} className="block">
                  <span className="field-label">{t(`lobby.designer.field.${n.field}`)} %</span>
                  <input
                    type="number"
                    min={n.min}
                    max={100}
                    step={0.5}
                    className="field-input"
                    defaultValue={n.value}
                    onBlur={(e) => {
                      const next = Number(e.target.value);
                      if (Number.isFinite(next) && next !== n.value) {
                        onContentChange({ [n.field]: Math.min(100, Math.max(n.min, next)) });
                      }
                    }}
                  />
                </label>
              ))}
            </div>
          </>
        ) : (
          <p className="mb-1 text-xs text-slate-500">{t('lobby.designer.contentPlainHint')}</p>
        )}

        <FrameTextFields
          color={inner.color}
          fontScale={inner.font}
          onPreview={onTextPreview}
          onColor={onTextColor}
          onFontScale={(value) => onContentChange({ font: value })}
        />
      </div>
    </Card>
  );
}

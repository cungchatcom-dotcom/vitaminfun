'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, PageHeader, SectionTitle, Skeleton } from '@/components/ui/primitives';
import {
  DEFAULT_WORLD_SIZE,
  FRAME_FONT,
  FRAME_WIDTH,
  GALAXY,
  WORLD_SIZE,
  defaultWorldSpot,
  frameSpec,
  frameWidthRange,
  galaxyCanvas,
  type FrameKind,
  type Orientation,
} from '@/game/world';
import { ApiError } from '@/lib/api-error';
import { ownText, pickText } from '@/lib/i18n-text';
import { listGalaxies, updateGalaxy, type Galaxy } from '@/lib/galaxies';
import { BACKGROUND_ACCEPT, IMAGE_ACCEPT, uploadMedia } from '@/lib/media';
import { localizedPath } from '@/lib/routes';
import { createWorld, listWorlds, updateWorld, type World } from '@/lib/worlds';

import { AudioPanel } from './audio-panel';
import { BackgroundLayer } from '@/components/game/background-layer';
import { FrameTextFields, MediaPicker } from './designer-fields';
import { GalaxyFrame } from './galaxy-frame';
import { PulseFields } from './pulse-fields';
import { useDesignBoard } from './use-design-board';
import { WorldOrb } from './world-orb';

/**
 * Trình thiết kế BẢN ĐỒ THIÊN HÀ — màn chọn world mà học sinh nhìn thấy.
 *
 * Song song với `StageDesigner`: cùng cách kéo thả, cùng khung tỉ lệ, cùng lối
 * lưu-khi-thả-tay, và dùng lại đúng những mảnh đó qua `useDesignBoard()`,
 * `PulseFields` và `WorldOrb`. Khác một điều: ở đây thứ được kéo là cả một
 * WORLD, không phải một vật thể trong màn — nên bảng bên phải sửa những thứ
 * thuộc về world (ảnh, khoá, lời giới thiệu), không phải câu hỏi.
 */
/**
 * Hai cái khung cũng kéo thả được như world, nên chúng cần một "id" để đi qua
 * `useDesignBoard()`. Id world là UUID nên hai chuỗi này không bao giờ đụng.
 */
const FRAME_ID: Record<FrameKind, string> = { title: 'frame:title', desc: 'frame:desc' };

/**
 * Những trường bố cục có mặt Ở CẢ HAI hướng.
 *
 * Giao của `Galaxy` và `GalaxyPortrait`. Nhờ nó mà `doc_G('title_x')` gõ sai
 * tên trường là hỏng lúc biên dịch, chứ không phải lúc giáo viên kéo cái khung
 * và không thấy gì xảy ra.
 */
type GalaxyPortraitFields = NonNullable<Galaxy['portrait']>;

function frameKindOf(id: string): FrameKind | null {
  if (id === FRAME_ID.title) return 'title';
  if (id === FRAME_ID.desc) return 'desc';
  return null;
}

export function GalaxyDesigner() {
  const t = useTranslations();
  const locale = useLocale();

  const [galaxy, setGalaxy] = useState<Galaxy | null>(null);
  const [worlds, setWorlds] = useState<World[]>([]);
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
  //: World đang bị rê chuột. Chỉ để XEM TRƯỚC chữ trong hai cái khung — bên
  //: học sinh rê chuột là chữ đổi, nên bên soạn cũng phải thấy đúng như vậy.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'background' | 'title' | 'desc' | null>(
    null,
  );
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [newName, setNewName] = useState('');

  //: Nhịp thở đang chỉnh, chỉ để vẽ. Ghi xuống server khi thả tay.
  const [pulseDraft, setPulseDraft] = useState<{
    id: string;
    percent: number;
    periodMs: number;
  } | null>(null);

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
      const [galaxies, list] = await Promise.all([listGalaxies(), listWorlds()]);
      setGalaxy(galaxies[0] ?? null);
      setWorlds(list);
      setErrorKey(null);
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Cập nhật một world tại chỗ, không nạp lại cả bản đồ. */
  function applyWorld(updated: World) {
    setWorlds((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
  }

  async function patchWorld(id: string, payload: Parameters<typeof updateWorld>[1]) {
    try {
      applyWorld(await tracked(() => updateWorld(id, payload)));
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    }
  }

  async function patchGalaxy(payload: Parameters<typeof updateGalaxy>[1]) {
    if (!galaxy) return;
    try {
      setGalaxy(await tracked(() => updateGalaxy(galaxy.id, payload)));
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    }
  }

  // ------------------------------------------------------- ngang hay dọc

  /**
   * Bố cục đang sửa. Đổi cái này là đổi CẢ khung vẽ, CẢ chỗ đọc, CẢ chỗ ghi —
   * ba thứ phải đi cùng nhau, nếu không thì kéo ở bản dọc mà ghi vào bản ngang.
   *
   * `landscape` là mặc định và là bản luôn có: mọi thiên hà đang chạy đều đã
   * được thiết kế ở đó.
   */
  const [huong, setHuong] = useState<Orientation>('landscape');
  const doc = huong === 'portrait';
  const canvas = galaxyCanvas(huong);
  // Bề rộng khung chữ không vượt quá bề rộng bản đồ CỦA HƯỚNG ĐANG SỬA — khớp
  // `Field(le=...)` bên Pydantic, nên cận ở đây và cận ở server nói cùng một
  // con số.
  const rongKhung = frameWidthRange(huong);

  /**
   * CỠ KHUNG XEM TRƯỚC, tính bằng phần trăm của cỡ nền (51vh chiều cao).
   *
   * Riêng cho từng hướng, không dùng chung một con số: bản ngang ở 51vh đã
   * chiếm quá nửa bề rộng cột, còn bản dọc ở đúng 51vh thì chỉ rộng chừng 29vh
   * — một dải hẹp mà kéo thả trong đó thì mỗi pixel trên màn là sáu đơn vị toạ
   * độ, tức là căn không nổi. Nên bản dọc mặc định GẤP ĐÔI.
   *
   * Nhớ theo hướng nên đổi qua đổi lại không mất chỗ vừa chỉnh.
   */
  const [zoom, setZoom] = useState<Record<Orientation, number>>({
    landscape: 100,
    portrait: 200,
  });
  const zoomHienTai = zoom[huong];
  const caoKhung = (51 * zoomHienTai) / 100;
  // KHÔNG ghim khung xem trước, ở mọi mức phóng — xem ghi chú dài trong
  // `LobbyDesigner`: `sticky` với bảng sửa world nằm ngay bên dưới là bảng sửa
  // trôi lên chui xuống dưới khung, bị che đúng lúc cuộn xuống để sửa.

  /**
   * ĐỌC một trường bố cục của thiên hà theo hướng đang sửa.
   *
   * Bản ngang nằm ở cột riêng (`galaxy.title_x`), bản dọc nằm trong một object
   * (`galaxy.portrait.title_x`) — xem docs/GAME_DOMAIN.md. Một hàm đọc chung
   * thì phần vẽ bên dưới không cần biết điều đó, và thêm hướng thứ ba sau này
   * chỉ phải sửa ở đây.
   */
  function doc_G<K extends keyof GalaxyPortraitFields>(key: K): Galaxy[K] {
    return (doc ? galaxy?.portrait?.[key] : galaxy?.[key]) as Galaxy[K];
  }

  /** GHI một bản vá bố cục vào đúng hướng đang sửa. */
  function ghiG(payload: Record<string, unknown>) {
    return patchGalaxy(doc ? { portrait: payload } : payload);
  }

  /** GHI chỗ đứng / cỡ của một world vào đúng hướng đang sửa. */
  function ghiW(id: string, payload: Record<string, unknown>) {
    return patchWorld(id, doc ? { portrait: payload } : payload);
  }

  // ---------------------------------------------------------------- kéo thả

  // Một bộ kéo thả cho CẢ world lẫn hai cái khung. Rẽ nhánh theo id ở đây chứ
  // không dựng hai bộ: hai bộ nghe chuột trên cùng một `window` thì cả hai cùng
  // phản ứng với một cú kéo.
  const board = useDesignBoard({
    canvas,
    minSize: Math.min(WORLD_SIZE.min, FRAME_WIDTH.min),
    // Bề rộng khung không vượt quá bề rộng bản đồ CỦA HƯỚNG ĐANG SỬA: ở bản
    // dọc bản đồ chỉ rộng 1800, và giữ trần 3200 là cho phép kéo một cái khung
    // rộng gấp đôi màn hình mà không có gì chặn lại.
    maxSize: Math.max(WORLD_SIZE.max, canvas.width),
    onMove: (id, x, y) => {
      const kind = frameKindOf(id);
      if (kind) void ghiG({ [`${kind}_x`]: x, [`${kind}_y`]: y });
      else void ghiW(id, { scene_x: x, scene_y: y });
    },
    // World là một bức tranh và khung cũng là một bức tranh: chiều cao suy ra
    // từ tỉ lệ gốc, nên chỉ bề rộng lưu được. Màn này giữ đúng một tay cầm góc.
    onResize: (id, size) => {
      const kind = frameKindOf(id);
      if (kind) void ghiG({ [`${kind}_width`]: size.w });
      else void ghiW(id, { icon_size: size.w });
    },
  });

  // ---------------------------------------------------------------- tải file

  async function uploadFor(kind: 'background' | 'title' | 'desc', file: File) {
    setUploading(kind);
    try {
      const asset = await uploadMedia(file, 'galaxy');
      // Tên cột đúng bằng `${kind}_media_id` cho cả bốn — không cần một cây
      // `if` bốn nhánh nói lại đúng cái mà cái tên đã nói.
      //
      // Ghi vào hướng ĐANG SỬA: ảnh của bản dọc và bản ngang là hai tấm khác
      // nhau, vì một tấm 16:9 kéo vào khung 9:16 là cắt mất hai phần ba.
      await ghiG({ [`${kind}_media_id`]: asset.id });
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    } finally {
      setUploading(null);
    }
  }

  async function addWorld() {
    const name = newName.trim();
    if (!name || !galaxy) return;
    try {
      // CHỈ cần cái tên. Mọi thứ khác — độ khó, số mảnh bản đồ, cân bằng —
      // server điền mặc định; giáo viên chỉnh sau nếu muốn. Bắt điền mười ô để
      // tạo một world rỗng là cách chắc chắn nhất để không ai tạo world nào.
      const created = await tracked(() =>
        createWorld({
          galaxy_id: galaxy.id,
          name_i18n: { [locale]: name },
          // Đặt giữa bản đồ, kéo tới chỗ mình muốn ngay sau đó.
          scene_x: Math.round(GALAXY.width / 2),
          scene_y: Math.round(GALAXY.height / 2),
          icon_size: DEFAULT_WORLD_SIZE,
        }),
      );
      setNewName('');
      await reload();
      // Chọn luôn world vừa tạo: việc kế tiếp CHẮC CHẮN là đặt ảnh và viết lời
      // giới thiệu cho nó. Bắt người ta bấm thêm một lần vào cái tên mình vừa
      // gõ là thêm một bước không mang thông tin gì.
      //
      // Đặt SAU `reload()`: đặt trước thì danh sách chưa có id đó, `selected`
      // ra `null`, và bảng sửa nhấp một cái rồi mới hiện.
      setSelectedId(created.id);
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
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

  if (!galaxy) {
    return (
      <p role="alert" className="mx-auto max-w-lg rounded-lg bg-coral-500/15 px-4 py-3 text-coral-500">
        {t('error.NOT_FOUND')}
      </p>
    );
  }

  const selected = worlds.find((w) => w.id === selectedId) ?? null;

  // Chữ trong hai cái khung: đang rê thì lấy world đó, không thì lấy world
  // đang chọn, không nữa thì về tên và mô tả THIÊN HÀ.
  //
  // Rê được ưu tiên hơn chọn vì rê là hành động nhất thời — buông chuột ra là
  // quay lại world đang sửa. `selectedId` có thể đang là id của chính cái
  // khung (`frame:title`), khi đó `find` trả `undefined` và rơi về thiên hà,
  // đúng như mong muốn.
  const shown = worlds.find((w) => w.id === (hoveredId ?? selectedId)) ?? null;

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb
        items={[
          { label: t('teacher.title'), href: localizedPath('/teacher', locale) },
          { label: t('world.list.title'), href: localizedPath('/teacher/worlds', locale) },
          { label: t('galaxy.designer.title') },
        ]}
      />

      <PageHeader
        title={t('galaxy.designer.title')}
        description={t('galaxy.designer.subtitle')}
        actions={
          <div className="flex items-center gap-3">
            {saveState !== 'idle' && (
              <span className="text-xs text-slate-400">
                {saveState === 'saving' ? t('common.loading') : `✓ ${t('designer.saved')}`}
              </span>
            )}

            {/* CÔNG TẮC NGANG / DỌC.
                Hai nút cạnh nhau chứ không phải một ô đánh dấu: đây không phải
                bật/tắt một tính năng mà là chọn đang đứng ở bản nào, và hai cái
                tên nằm cạnh nhau thì người dựng luôn thấy cả hai bản tồn tại —
                kể cả trước khi họ chạm vào bản dọc lần đầu.

                Chấm nhỏ trên nút "dọc" = bản dọc ĐÃ có ảnh nền, tức đã được
                thiết kế. Không có dấu ấy thì người dựng phải bấm sang mới biết
                bên đó rỗng hay không, mà đó lại đúng là câu hỏi họ hỏi mỗi lần
                mở màn này. */}
            <div className="flex overflow-hidden rounded-lg border border-abyss-700 text-xs">
              {(['landscape', 'portrait'] as const).map((huongNut) => (
                <button
                  key={huongNut}
                  type="button"
                  aria-pressed={huong === huongNut}
                  onClick={() => {
                    setHuong(huongNut);
                    // Bỏ chọn: một world đang chọn ở bản ngang thì tay cầm của
                    // nó vẫn hiện ở bản dọc, đúng chỗ khác hẳn — trông như một
                    // cái tay cầm mồ côi.
                    setSelectedId(null);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 transition ${
                    huong === huongNut
                      ? 'bg-lagoon-500/20 font-bold text-lagoon-400'
                      : 'text-slate-400 hover:bg-abyss-800 hover:text-slate-200'
                  }`}
                >
                  {t(`galaxy.designer.${huongNut}`)}
                  {huongNut === 'portrait' && galaxy.portrait?.background_url && (
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full bg-orichalcum-400"
                      title={t('galaxy.designer.portraitReady')}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* Bản dọc CHƯA có ảnh nền = chưa thiết kế, và học sinh cầm điện thoại
          dọc sẽ vẫn được mời xoay ngang máy. Nói thẳng ra ở đây, vì một khung
          soạn trống thì trông y hệt một khung soạn đã xong mà quên tải ảnh. */}
      {doc && !galaxy.portrait?.background_url && (
        <p className="mb-4 rounded-lg bg-orichalcum-500/10 px-4 py-2 text-sm text-orichalcum-400">
          {t('galaxy.designer.portraitEmpty')}
        </p>
      )}

      {errorKey && (
        <p role="alert" className="mb-4 rounded-lg bg-coral-500/15 px-4 py-2 text-sm text-coral-500">
          {t(errorKey)}
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_20rem]">
        {/* ---------------- Khung bản đồ + bảng sửa world ---------------- */}
        <div>
          {/* Chặn CHIỀU CAO khung xem trước, và chặn bằng `max-width` chứ
              không bằng `max-height`.

              `aspect-ratio` nhường chỗ cho `max-height`: đặt trần chiều cao thì
              khung giữ nguyên bề rộng và bị bẹt lại, tức giáo viên căn bố cục
              trên một tỉ lệ mà học sinh không bao giờ nhìn thấy. Chặn bề rộng
              thì chiều cao tự co theo và tỉ lệ của bố cục còn nguyên.

              Trần này tồn tại để khung xem trước VÀ bảng sửa cùng nằm trong một
              màn hình — cuộn xuống sửa mà không thấy thứ mình đang sửa thì việc
              sắp đặt bằng mắt mất hết ý nghĩa.

              KHÔNG `sticky`. Từng có, để khung ghim ở đỉnh khi bảng sửa phải
              cuộn — nhưng bảng sửa nằm BÊN DƯỚI khung, nên cuộn là nó chui
              xuống dưới khung đang ghim và bị che mất. Cuộn cả trang thì khung
              trôi lên, nhưng không có gì bị che.

              51vh là cỡ NỀN — 100% trên thanh thu phóng. Cao bằng quá nửa
              cửa sổ: đủ to để căn chỗ bằng mắt.

              Cỡ thật = 51vh × `zoom`, và người dựng tự vặn. Trước đây đây là
              một hằng số, đúng khi chỉ có bản ngang; bản dọc ở cùng 51vh thì
              chỉ rộng chừng 29vh, và kéo thả trong một dải hẹp như vậy thì mỗi
              pixel trên màn là sáu đơn vị toạ độ — căn không nổi. Thu phóng chỉ
              đổi khung NHÌN, không đổi dữ liệu: toạ độ vẫn lưu theo hệ thế
              giới, nên phóng to rồi thu lại thì không có gì xê dịch.

              `relative` là gốc toạ độ cho các world `absolute` bên trong. */}
          <div
            ref={board.boardRef}
            className="relative mx-auto w-full overflow-hidden rounded-2xl border border-abyss-700 bg-abyss-950 select-none"
            style={{
              // Giữ đúng tỉ lệ khung, nếu không thì kéo thả lệch theo trục.
              aspectRatio: `${canvas.width} / ${canvas.height}`,
              // Trần BỀ RỘNG suy từ trần chiều cao — xem ghi chú dài phía trên.
              // Ở bản dọc khung cao gấp ba lần bề ngang, nên cùng một trần chiều
              // cao cho ra một khung hẹp; đó đúng là thứ cần, vì màn hình học
              // sinh cũng hẹp như vậy.
              maxWidth: `calc(${caoKhung}vh * ${canvas.width} / ${canvas.height})`,
            }}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) setSelectedId(null);
            }}
          >
            {doc_G('background_url') ? (
              <BackgroundLayer
                url={doc_G('background_url')}
                kind={doc_G('background_kind')}
                className="pointer-events-none absolute inset-0 size-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-linear-to-b from-abyss-950 to-abyss-800 text-sm text-slate-500">
                {t('galaxy.designer.noBackground')}
              </div>
            )}

            {/* VÙNG AN TOÀN của bản dọc.
                Khung thiết kế là 9:16, còn điện thoại thật chạy từ 0.45 tới
                0.56 — nên tấm bản đồ được phóng cho PHỦ KÍN màn và mép thừa bị
                cắt (xem `GalaxyMap`). Đo thật trên sáu cỡ máy phổ biến: chỗ bị
                cắt nhiều nhất là khoảng 9% mỗi mép.

                Nên đường đứt này là lời hứa duy nhất giữ được: thứ gì nằm
                trong nó thì máy nào cũng thấy. Không vẽ ra thì người dựng căn
                một cái khung sát mép, thấy đẹp trên khung soạn, rồi mất một
                nửa chữ trên điện thoại của học sinh — mà mỗi đời máy mất một
                kiểu khác nhau. */}
            {doc && (
              <div
                className="pointer-events-none absolute inset-[9%] z-30 rounded border border-dashed border-orichalcum-400/45"
                aria-hidden
              >
                <span className="absolute -top-px left-1 -translate-y-full text-[10px] text-orichalcum-400/70">
                  {t('galaxy.designer.safeArea')}
                </span>
              </div>
            )}

            {worlds.map((world, index) => {
              const live = board.ghost?.id === world.id ? board.ghost : null;
              const spot = defaultWorldSpot(index, worlds.length, huong);
              // Chỗ đứng của hướng ĐANG SỬA. Bản dọc nằm trong `world.portrait`,
              // và chưa đặt thì rơi về chỗ rải đều của chính hướng đó — không
              // rơi về toạ độ bản ngang, vì 3000 theo trục x là ngoài mép một
              // bản đồ chỉ rộng 1800.
              const dat = doc ? world.portrait : world;
              const x = live?.x ?? dat?.scene_x ?? spot.x;
              const y = live?.y ?? dat?.scene_y ?? spot.y;
              const size =
                board.sizeDraft?.id === world.id
                  ? board.sizeDraft.w
                  : (dat?.icon_size ?? DEFAULT_WORLD_SIZE);
              const active = world.id === selectedId;
              const draft = pulseDraft?.id === world.id ? pulseDraft : null;

              return (
                <div
                  key={world.id}
                  className="absolute"
                  style={{
                    left: `${(x / canvas.width) * 100}%`,
                    top: `${(y / canvas.height) * 100}%`,
                    // Bề rộng đặt Ở ĐÂY, trên chính thẻ `absolute`, để phần trăm
                    // quy chiếu theo KHUNG SOẠN chứ không theo chỗ trống còn lại.
                    width: `${(size / canvas.width) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div className="relative w-full">
                    <button
                      type="button"
                      onPointerDown={(event) => {
                        setSelectedId(world.id);
                        board.startDrag(event, { id: world.id, x, y, w: size, h: size });
                      }}
                      onPointerEnter={() => setHoveredId(world.id)}
                      onPointerLeave={() => setHoveredId(null)}
                      title={t('galaxy.designer.dragHint')}
                      // Bo góc bám theo hình THẬT của world: huy hiệu tròn thì
                      // viền tròn, ảnh trần thì viền vuông bo nhẹ. Viền tròn
                      // quanh một ảnh chữ nhật là vẽ lại đúng cái đĩa vừa bỏ.
                      className={`block w-full cursor-grab ring-2 active:cursor-grabbing ${
                        world.show_ring ? 'rounded-full' : 'rounded-lg'
                      } ${active ? 'ring-lagoon-400' : 'ring-transparent hover:ring-white/40'}`}
                    >
                      <WorldOrb
                        coverUrl={world.cover_url}
                        // Vành trong trình thiết kế báo world ĐÃ DỰNG tới đâu —
                        // số màn đã xuất bản trên tổng số mảnh bản đồ. Học sinh
                        // thấy vành theo tiến độ của chính họ; giáo viên chưa
                        // chơi bao giờ nên vành của họ sẽ luôn rỗng, mà một vành
                        // luôn rỗng thì chẳng minh hoạ được gì.
                        progress={
                          world.shard_total > 0
                            ? world.stage_published_count / world.shard_total
                            : 0
                        }
                        showRing={world.show_ring}
                        locked={world.is_locked}
                        pulsePercent={draft ? draft.percent : world.pulse_percent}
                        pulsePeriodMs={draft ? draft.periodMs : world.pulse_period_ms}
                      />
                    </button>

                    {/* Tay cầm ở góc — chỉ hiện khi world đang được chọn, để
                        các tay cầm không chen nhau. */}
                    {active && (
                      <button
                        type="button"
                        aria-label={t('galaxy.designer.resizeHint')}
                        title={t('galaxy.designer.resizeHint')}
                        onPointerDown={(event) =>
                          board.startResize(event, { id: world.id, x, y, w: size, h: size }, 'both')
                        }
                        className="absolute -right-1 -bottom-1 size-3.5 cursor-nwse-resize rounded-full border-2 border-abyss-950 bg-lagoon-400 shadow"
                      />
                    )}

                    <span className="pointer-events-none absolute top-full left-1/2 mt-1 -translate-x-1/2 text-[11px] font-bold whitespace-nowrap text-white"
                      style={{
                        WebkitTextStrokeWidth: '2.2px',
                        WebkitTextStrokeColor: '#000',
                        paintOrder: 'stroke fill',
                      }}
                    >
                      {pickText(world.name_i18n, locale)}
                    </span>
                  </div>
                </div>
              );
            })}
            {(['title', 'desc'] as const).map((kind) => {
              const live = board.ghost?.id === FRAME_ID[kind] ? board.ghost : null;
              const spec = frameSpec(kind, huong);
              const x = live?.x ?? doc_G(`${kind}_x`) ?? spec.x;
              const y = live?.y ?? doc_G(`${kind}_y`) ?? spec.y;
              const width =
                board.sizeDraft?.id === FRAME_ID[kind]
                  ? board.sizeDraft.w
                  : (doc_G(`${kind}_width`) ?? spec.width);
              const active = selectedId === FRAME_ID[kind];
              // Cận trên/dưới RIÊNG cho khung chữ, không dùng cận chung của
              // bảng. Cận chung là hợp của world và khung (40…bề rộng bản đồ),
              // mà server chỉ nhận khung từ 80 trở lên — kéo xuống 60 là cú
              // kéo kết thúc bằng một lỗi 422 im lặng, và người dựng thấy nút
              // kéo cỡ "không ăn".
              const target = {
                id: FRAME_ID[kind],
                x,
                y,
                w: width,
                h: width,
                min: FRAME_WIDTH.min,
                max: rongKhung.max,
              };

              return (
                <GalaxyFrame
                  key={`${huong}:${kind}`}
                  kind={kind}
                  orientation={huong}
                  imageUrl={doc_G(`${kind}_url`)}
                  x={x}
                  y={y}
                  width={width}
                  color={tint?.id === FRAME_ID[kind] ? tint.color : doc_G(`${kind}_color`)}
                  fontScale={doc_G(`${kind}_font`)}
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
                          <button
                            type="button"
                            aria-label={t('galaxy.designer.resizeHint')}
                            title={t('galaxy.designer.resizeHint')}
                            onPointerDown={(event) => board.startResize(event, target, 'both')}
                            className="absolute -right-1 -bottom-1 size-3.5 cursor-nwse-resize rounded-full border-2 border-abyss-950 bg-lagoon-400 shadow"
                          />
                        )}
                      </div>
                    </div>
                  )}
                >
                  {/* Chữ THẬT, đúng thứ học sinh sẽ đọc: của world đang rê hoặc
                      đang chọn, không thì của thiên hà. */}
                  {kind === 'title'
                    ? pickText(shown ? shown.name_i18n : galaxy.name_i18n, locale)
                    : pickText(shown ? shown.story_i18n : galaxy.description_i18n, locale)}
                </GalaxyFrame>
              );
            })}
          </div>

          {/* THANH THU PHÓNG.
              Chỉ đổi cỡ KHUNG XEM TRƯỚC, không đụng gì tới dữ liệu — mọi toạ độ
              vẫn lưu theo hệ thế giới, nên phóng to để căn cho dễ rồi thu lại
              thì cái đã đặt không xê dịch một đơn vị nào.

              Nhớ theo từng hướng: bản dọc cần to hơn hẳn bản ngang, và bắt
              người dựng chỉnh lại mỗi lần bấm qua bấm lại là một thao tác thừa
              lặp cả buổi. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <span>{t('galaxy.designer.zoom')}</span>
              <input
                type="range"
                min={50}
                max={300}
                step={10}
                value={zoomHienTai}
                onChange={(e) =>
                  setZoom((prev) => ({ ...prev, [huong]: Number(e.currentTarget.value) }))
                }
                className="w-40 accent-lagoon-400"
              />
              <span className="w-10 tabular-nums">{zoomHienTai}%</span>
            </label>

            <p className="text-xs text-slate-500">
              {t('galaxy.designer.dragHint')} · {t('designer.autoSave')}
            </p>
          </div>

          {/* Bảng sửa world nằm NGAY DƯỚI khung xem trước, không ở cột phải.
              Xếp dọc bên phải thì nó dài quá màn hình, và lúc cuộn xuống tới ô
              đang sửa thì cái world đang sửa đã trôi mất khỏi tầm nhìn. */}
          {selected && (
            <WorldInspector
              // `key` buộc React dựng lại ô nhập khi đổi world. Không có nó thì
              // các ô dùng `defaultValue` giữ nguyên chữ của world trước.
              key={selected.id}
              world={selected}
              locale={locale}
              onPatch={(payload) => patchWorld(selected.id, payload)}
              onPreviewPulse={(value) => setPulseDraft(value && { id: selected.id, ...value })}
              onError={setErrorKey}
            />
          )}
        </div>

        {/* ---------------- Cột phải: khung thiên hà + danh sách ----------------

            Cột này TỰ CUỘN, không cuộn cả trang. Bảng cài đặt dài hơn màn hình
            là chuyện thường; cuộn cả trang thì khung xem trước trôi lên mất, mà
            nhìn được thứ mình đang chỉnh chính là toàn bộ lý do có màn này.

            `sticky` + `overflow-y-auto` trên CÙNG một thẻ: nó ghim tại chỗ, và
            phần bên trong tự trượt. Chỉ bật từ `lg` trở lên — dưới ngưỡng đó
            hai cột xếp chồng thành một dòng dọc, và một ô cuộn lồng trong một
            trang cuộn là thứ trên điện thoại không ai điều khiển nổi. */}
        <div className="space-y-4 lg:sticky lg:top-3 lg:max-h-[calc(100vh-1.5rem)] lg:overflow-y-auto lg:pr-1">
          <Card>
            <SectionTitle>{t('galaxy.designer.scene')}</SectionTitle>

            <MediaPicker
              label={t('galaxy.designer.background')}
              accept={BACKGROUND_ACCEPT}
              busy={uploading === 'background'}
              hasValue={Boolean(doc_G('background_media_id'))}
              onPick={(file) => void uploadFor('background', file)}
              onClear={() => void ghiG({ clear_background: true })}
              preview={
                doc_G('background_url') ? (
                  <BackgroundLayer
                    url={doc_G('background_url')}
                    kind={doc_G('background_kind')}
                    still
                    className="mb-2 h-20 w-full rounded-lg border border-abyss-700 object-cover"
                  />
                ) : null
              }
            />
          </Card>

          <AudioPanel
            backgroundKind={galaxy.background_kind}
            surface="galaxy"
            audio={galaxy.audio ?? {}}
            audioUrls={galaxy.audio_urls ?? {}}
            audioNames={galaxy.audio_names ?? {}}
            onSave={(slot, track) => patchGalaxy({ audio: { [slot]: track } })}
            onError={setErrorKey}
          />

          <Card>
            <SectionTitle>{t('galaxy.designer.frames')}</SectionTitle>
            <p className="mb-3 text-xs text-slate-500">{t('galaxy.designer.framesHint')}</p>

            {/* Tên và mô tả THIÊN HÀ sửa ngay tại đây: chúng là chữ mặc định
                nằm trong hai cái khung, nên chỗ chỉnh chúng phải ở cạnh chỗ
                chỉnh khung. */}
            <label className="mb-3 block">
              <span className="field-label">{t('galaxy.designer.galaxyName')}</span>
              <input
                className="field-input"
                defaultValue={ownText(galaxy.name_i18n, locale)}
                placeholder={pickText(galaxy.name_i18n, locale)}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next && next !== ownText(galaxy.name_i18n, locale)) {
                    void patchGalaxy({ name_i18n: { ...galaxy.name_i18n, [locale]: next } });
                  }
                }}
              />
            </label>

            <label className="mb-4 block">
              <span className="field-label">{t('galaxy.designer.galaxyStory')}</span>
              <textarea
                rows={2}
                className="field-input resize-y"
                defaultValue={ownText(galaxy.description_i18n, locale)}
                placeholder={pickText(galaxy.description_i18n, locale)}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next !== ownText(galaxy.description_i18n, locale)) {
                    void patchGalaxy({
                      description_i18n: { ...galaxy.description_i18n, [locale]: next },
                    });
                  }
                }}
              />
            </label>

            {/* Hai cái khung cấu hình y hệt nhau, nên một vòng lặp chứ không
                hai khối chép đôi. Tên cột đều là `${kind}_*`. */}
            {(['title', 'desc'] as const).map((kind) => (
              <div key={kind} className="mb-4 last:mb-0">
                <MediaPicker
                  label={t(
                    kind === 'title' ? 'galaxy.designer.titleFrame' : 'galaxy.designer.descFrame',
                  )}
                  accept={IMAGE_ACCEPT}
                  busy={uploading === kind}
                  hasValue={Boolean(doc_G(`${kind}_media_id`))}
                  onPick={(file) => void uploadFor(kind, file)}
                  onClear={() =>
                    void ghiG(kind === 'title' ? { clear_title: true } : { clear_desc: true })
                  }
                  preview={
                    doc_G(`${kind}_url`) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={doc_G(`${kind}_url`)!}
                        alt=""
                        className="mb-2 max-h-16 w-full rounded-lg border border-abyss-700 object-contain"
                      />
                    ) : null
                  }
                />

                <FrameTextFields
                  // `key` buộc dựng lại khi đổi hướng: ô màu và ô cỡ chữ dùng
                  // `defaultValue`, nên không có nó thì sang bản dọc vẫn thấy
                  // con số của bản ngang.
                  key={huong}
                  color={doc_G(`${kind}_color`) ?? frameSpec(kind, huong).color}
                  fontScale={doc_G(`${kind}_font`) ?? FRAME_FONT.base}
                  onPreview={(color) => setTint(color ? { id: FRAME_ID[kind], color } : null)}
                  onColor={(value) =>
                    void ghiG({ [`${kind}_color`]: value }).then(() => setTint(null))
                  }
                  onFontScale={(value) => void ghiG({ [`${kind}_font`]: value })}
                />
              </div>
            ))}
          </Card>

          <Card>
            <SectionTitle>{t('galaxy.designer.worlds', { count: worlds.length })}</SectionTitle>

            <div className="mb-3 flex gap-2">
              <input
                className="field-input"
                placeholder={t('galaxy.designer.newWorldName')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void addWorld();
                }}
              />
              <Button variant="primary" size="sm" disabled={!newName.trim()} onClick={() => void addWorld()}>
                {t('galaxy.designer.addWorld')}
              </Button>
            </div>

            <ul className="space-y-1">
              {worlds.map((world) => (
                <li key={world.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(world.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                      world.id === selectedId
                        ? 'bg-abyss-700 text-slate-100'
                        : 'text-slate-300 hover:bg-abyss-800'
                    }`}
                  >
                    <span aria-hidden="true">{world.is_locked ? '🔒' : '🔓'}</span>
                    <span className="flex-1 truncate">
                      {pickText(world.name_i18n, locale)}
                    </span>
                    <span className="font-mono text-xs text-slate-500">
                      {world.stage_published_count}/{world.stage_count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Một công tắc có nhãn và một dòng giải thích. Hai cái nằm cạnh nhau. */
function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-abyss-800 px-3 py-2">
      <span className="text-sm text-slate-300">
        {label}
        <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 shrink-0 accent-lagoon-400"
      />
    </label>
  );
}

/**
 * Bảng sửa nhanh world đang chọn.
 *
 * Cùng cách làm với `QuestInspector` bên trình thiết kế màn chơi: sửa NGAY Ở
 * ĐÂY chứ không mở hộp thoại, vì đây là những thứ người ta căn đi căn lại trong
 * lúc nhìn bản đồ.
 */
function WorldInspector({
  world,
  locale,
  onPatch,
  onPreviewPulse,
  onError,
}: {
  world: World;
  locale: string;
  onPatch: (payload: Parameters<typeof updateWorld>[1]) => Promise<void>;
  onPreviewPulse: (value: { percent: number; periodMs: number } | null) => void;
  onError: (key: string) => void;
}) {
  const t = useTranslations();
  const [uploading, setUploading] = useState(false);

  const display = pickText(world.name_i18n, locale);
  const currentName = ownText(world.name_i18n, locale);
  const currentStory = ownText(world.story_i18n, locale);
  const storyPlaceholder = pickText(world.story_i18n, locale);

  async function uploadCover(file: File) {
    setUploading(true);
    try {
      const asset = await uploadMedia(file, 'world-covers');
      await onPatch({ cover_media_id: asset.id });
    } catch (error) {
      onError(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="mt-4" padded={false}>
      <div className="p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <SectionTitle>{display}</SectionTitle>
        <span className="font-mono text-xs text-slate-500">
          {t('designer.position')} {world.scene_x ?? '—'}, {world.scene_y ?? '—'} · ⌀
          {world.icon_size ?? '—'}
        </span>
      </div>

      {/* NGANG, không phải một cột dọc. Bốn nhóm cạnh nhau vừa đúng bề rộng
          khung xem trước phía trên, nên cả hai cùng nằm trong một màn hình —
          mà nhìn được thứ mình đang sửa chính là toàn bộ lý do có màn này. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* --- cột 1: tên + khoá --- */}
        <div className="space-y-3">
          <label className="block">
            <span className="field-label">{t('galaxy.designer.worldName')}</span>
            <input
              className="field-input"
              defaultValue={currentName}
              placeholder={display}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next && next !== currentName) {
                  void onPatch({ name_i18n: { ...world.name_i18n, [locale]: next } });
                }
              }}
            />
          </label>

          <Toggle
            label={t('galaxy.designer.locked')}
            hint={t('galaxy.designer.lockedHint')}
            checked={world.is_locked}
            onChange={(is_locked) => void onPatch({ is_locked })}
          />

          <Toggle
            label={t('galaxy.designer.ring')}
            hint={t('galaxy.designer.ringHint')}
            checked={world.show_ring}
            onChange={(show_ring) => void onPatch({ show_ring })}
          />
        </div>

        {/* --- cột 2: lời giới thiệu --- */}
        <label className="block">
          <span className="field-label">{t('galaxy.designer.worldStory')}</span>
          <textarea
            rows={3}
            className="field-input resize-y"
            defaultValue={currentStory}
            placeholder={storyPlaceholder}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next !== currentStory) {
                void onPatch({ story_i18n: { ...world.story_i18n, [locale]: next } });
              }
            }}
          />
          <span className="mt-1 block text-xs text-slate-500">
            {t('galaxy.designer.worldStoryHint')}
          </span>
        </label>

        {/* --- cột 3: ảnh world --- */}
        <div>
          <span className="field-label">{t('galaxy.designer.worldCover')}</span>
          <div className="flex items-start gap-3">
            {world.cover_url && (
              // Xem trước theo ĐÚNG hình world sẽ mang trên bản đồ: bật vành
              // thì tròn và bị cắt (`object-cover`), tắt thì nguyên khung ảnh
              // (`object-contain`). Xem trước một đằng bản đồ một nẻo là bắt
              // giáo viên đối chiếu hai hình trong đầu.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={world.cover_url}
                alt=""
                className={`size-14 shrink-0 border border-abyss-700 ${
                  world.show_ring ? 'rounded-full object-cover' : 'rounded-lg object-contain'
                }`}
              />
            )}
            <div className="min-w-0 flex-1">
              <input
                type="file"
                accept={IMAGE_ACCEPT}
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadCover(file);
                  e.target.value = '';
                }}
                className="block w-full text-xs text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-abyss-800 file:px-2.5 file:py-1 file:text-slate-200 hover:file:bg-abyss-700"
              />
              {uploading && <p className="mt-1 text-xs text-slate-500">{t('common.loading')}</p>}
              {world.cover_media_id && !uploading && (
                <button
                  type="button"
                  onClick={() => void onPatch({ clear_cover: true })}
                  className="mt-1 text-xs text-slate-500 hover:text-coral-500"
                >
                  {t('galaxy.designer.removeMedia')}
                </button>
              )}
            </div>
          </div>

          <div className="mt-3">
            <Link href={localizedPath(`/teacher/worlds/${world.id}`, locale)}>
              <Button variant="secondary" size="sm">
                {t('galaxy.designer.openWorld')}
              </Button>
            </Link>
          </div>
        </div>

        {/* --- cột 4: nhịp thở --- */}
        <PulseFields
          percent={world.pulse_percent}
          periodMs={world.pulse_period_ms}
          onPreview={onPreviewPulse}
          onCommit={(percent, periodMs) =>
            onPatch({ pulse_percent: percent, pulse_period_ms: periodMs })
          }
        />
        </div>
      </div>
    </Card>
  );
}

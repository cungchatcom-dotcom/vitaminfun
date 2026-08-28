'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';

import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { GalaxyFrame } from '@/components/world/galaxy-frame';
import { WorldOrb } from '@/components/world/world-orb';
import { DEFAULT_WORLD_SIZE, GALAXY, defaultWorldSpot } from '@/game/world';
import { pickText } from '@/lib/i18n-text';
import { localizedPath } from '@/lib/routes';

import type { PlayGalaxy, PlayWorld } from '@/lib/types';

/**
 * Bản đồ thiên hà (S0) — màn chọn world.
 *
 * Các world nằm ở chỗ giáo viên đặt trong trình thiết kế, theo hệ toạ độ
 * 3200×1800; ở đây quy về phần trăm nên bản đồ co giãn theo cửa sổ mà bố cục
 * không đổi. World chưa đặt toạ độ thì rải đều thành hàng ngang — chưa thiết kế
 * vẫn phải chơi được.
 *
 * Client Component vì có rê chuột. Trước đây đây là Server Component và đúng
 * cho lúc đó: nó chỉ hiện một lưới thẻ. Hai cái khung đổi chữ theo con trỏ là
 * thứ đổi điều đó.
 */
export function GalaxyMap({ galaxy }: { galaxy: PlayGalaxy }) {
  const t = useTranslations('play');
  const locale = useLocale();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (galaxy.worlds.length === 0) {
    return <EmptyState label={t('noWorlds')} hint={t('noWorldsHint')} />;
  }

  const hovered = galaxy.worlds.find((w) => w.id === hoveredId) ?? null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-abyss-700 bg-abyss-950"
      style={{ aspectRatio: `${GALAXY.width} / ${GALAXY.height}` }}
      onPointerLeave={() => setHoveredId(null)}
    >
      {galaxy.background_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={galaxy.background_url}
          alt=""
          className="pointer-events-none absolute inset-0 size-full object-cover"
          draggable={false}
        />
      )}

      {galaxy.worlds.map((world, index) => (
        <WorldPin
          key={world.id}
          world={world}
          index={index}
          total={galaxy.worlds.length}
          locale={locale}
          onHover={setHoveredId}
        />
      ))}

      {/* Hai cái khung ĐỨNG YÊN, chỉ chữ trong đó đổi theo con trỏ.
          Bản trước là một popup trồi lên từ đáy; nó chạy đúng, nhưng chỗ đặt
          và dáng của nó thì lập trình viên quyết. Giờ giáo viên tự chọn ảnh,
          tự kéo chỗ, tự đặt cỡ — và cái bảng đó là một phần của bức tranh chứ
          không phải một hộp thoại đắp lên trên nó.

          Không có `hovered` thì mang tên và mô tả THIÊN HÀ. Đó là trạng thái
          nghỉ, không phải trạng thái rỗng: màn hình luôn nói cho người chơi
          biết họ đang ở đâu. */}
      <GalaxyFrame
        kind="title"
        imageUrl={galaxy.title_url}
        x={galaxy.title_x}
        y={galaxy.title_y}
        width={galaxy.title_width}
        color={galaxy.title_color}
        fontScale={galaxy.title_font}
      >
        {pickText(hovered ? hovered.name_i18n : galaxy.name_i18n, locale)}
      </GalaxyFrame>

      <GalaxyFrame
        kind="desc"
        imageUrl={galaxy.desc_url}
        x={galaxy.desc_x}
        y={galaxy.desc_y}
        width={galaxy.desc_width}
        color={galaxy.desc_color}
        fontScale={galaxy.desc_font}
      >
        {pickText(hovered ? hovered.story_i18n : galaxy.description_i18n, locale)}
      </GalaxyFrame>

      {/* Nhạc nền: KHÔNG tự phát. Trình duyệt chặn âm thanh tự chạy khi người
          dùng chưa chạm vào trang, nên `autoplay` chỉ đem lại một thẻ audio im
          lặng và một cảnh báo trong console. Để người chơi tự bấm. */}
      {galaxy.music_url && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio
          src={galaxy.music_url}
          controls
          loop
          className="absolute top-3 right-3 h-8 w-44 opacity-70 transition hover:opacity-100"
        />
      )}
    </div>
  );
}

function WorldPin({
  world,
  index,
  total,
  locale,
  onHover,
}: {
  world: PlayWorld;
  index: number;
  total: number;
  locale: string;
  onHover: (id: string | null) => void;
}) {
  const t = useTranslations('play');

  const spot = defaultWorldSpot(index, total);
  const x = world.scene_x ?? spot.x;
  const y = world.scene_y ?? spot.y;
  const size = world.icon_size ?? DEFAULT_WORLD_SIZE;

  const progress = world.shard_total > 0 ? world.my_shards / world.shard_total : 0;
  const percent = Math.round(progress * 100);

  const orb = (
    <WorldOrb
      coverUrl={world.cover_url}
      progress={progress}
      showRing={world.show_ring}
      locked={world.is_locked}
      pulsePercent={world.pulse_percent}
      pulsePeriodMs={world.pulse_period_ms}
    />
  );

  const label = (
    <>
      <span
        className="pointer-events-none absolute top-full left-1/2 mt-1 -translate-x-1/2 text-[11px] font-bold whitespace-nowrap text-white"
        style={{
          WebkitTextStrokeWidth: '2.2px',
          WebkitTextStrokeColor: '#000',
          paintOrder: 'stroke fill',
        }}
      >
        {pickText(world.name_i18n, locale)}
      </span>
      {percent > 0 && (
        <span
          className="pointer-events-none absolute top-0 -right-2 translate-x-full text-[11px] font-bold whitespace-nowrap text-white"
          style={{
            WebkitTextStrokeWidth: '2.2px',
            WebkitTextStrokeColor: '#000',
            paintOrder: 'stroke fill',
          }}
        >
          {percent}%
        </span>
      )}
    </>
  );

  const style = {
    left: `${(x / GALAXY.width) * 100}%`,
    top: `${(y / GALAXY.height) * 100}%`,
    width: `${(size / GALAXY.width) * 100}%`,
    transform: 'translate(-50%, -50%)',
  } as const;

  // Ổ khoá và "bấm được hay không" là HAI câu hỏi khác nhau.
  //
  // `is_locked` quyết định có vẽ ổ khoá — giáo viên bấm khoá, hoặc world chưa
  // có màn nào phát hành. `can_enter` quyết định có làm liên kết: giáo viên
  // đang chơi thử vẫn vào được một world khoá, học sinh thì không.
  //
  // World khoá KHÔNG phải là một liên kết bị làm mờ: một thẻ `<a>` mờ vẫn bấm
  // được bằng bàn phím, và bấm vào thì rơi vào một world trống. Không có `<a>`
  // thì không có gì để bấm. Chặn thật nằm ở server — xem `read_world()`.
  if (!world.can_enter) {
    return (
      <div
        className="absolute"
        style={style}
        onPointerEnter={() => onHover(world.id)}
        onFocus={() => onHover(world.id)}
      >
        <div className="relative w-full" title={t('locked')}>
          {orb}
          {label}
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute"
      style={style}
      onPointerEnter={() => onHover(world.id)}
      onFocus={() => onHover(world.id)}
    >
      <Link
        href={localizedPath(`/play/world/${world.id}`, locale)}
        className={`relative block w-full no-underline ring-lagoon-400 transition hover:ring-2 focus-visible:ring-2 ${
          world.show_ring ? 'rounded-full' : 'rounded-lg'
        }`}
      >
        {orb}
        {label}
      </Link>
    </div>
  );
}

/** Tiêu đề trang, tách ra để trang chính giữ được phần khung. */
export function GalaxyHeader({ name }: { name: string }) {
  const t = useTranslations('play');
  return <PageHeader title={t('title')} subtitle={t('welcome', { name })} />;
}

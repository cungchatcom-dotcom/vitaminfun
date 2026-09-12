'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';

import { AmbientPlayer, useAmbientVideoSound } from './ambient-player';
import { BackgroundLayer } from './background-layer';
import { MusicControls } from './music-controls';
import { EmptyState } from '@/components/ui/primitives';
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
  // Nhạc nền có thể đến TỪ CHÍNH TẤM NỀN, nếu nền là video và giáo viên bật cờ.
  // `null` = video câm và thẻ `<audio>` bên dưới lo phần nhạc như thường.
  const videoSound = useAmbientVideoSound(galaxy.audio, galaxy.background_kind, 'galaxy');

  if (galaxy.worlds.length === 0) {
    return <EmptyState label={t('noWorlds')} hint={t('noWorldsHint')} />;
  }

  const hovered = galaxy.worlds.find((w) => w.id === hoveredId) ?? null;

  /* Rời một world thì CHỈ world đó được xoá, không phải xoá sạch.
     Đi thẳng từ world này sang world kia, trình duyệt bắn `pointerleave` của
     cái cũ SAU `pointerenter` của cái mới. Xoá vô điều kiện là cái vừa trỏ tới
     bị chính cái vừa rời khỏi thổi bay, và hai khung chữ nháy về thiên hà rồi
     mới đổi — hoặc tệ hơn, nằm luôn ở thiên hà. */
  const leaveWorld = (id: string) => setHoveredId((cur) => (cur === id ? null : cur));

  return (
    <div
      /**
       * PHỦ HẾT CHỖ ĐƯỢC CHO, nhưng GIỮ NGUYÊN TỈ LỆ 3200×1800.
       *
       * Tỉ lệ không phải để cho đẹp: mọi khối trong bản đồ được đặt theo PHẦN
       * TRĂM của khung này, còn ảnh nền thì `object-cover`. Khung lệch tỉ lệ là
       * ảnh bị xén một dải, mà các khối thì không xén theo — người dựng căn một
       * cái cổng vào đúng giữa vòm đá, người chơi thấy nó nằm lệch trên bầu trời.
       *
       * Nên khung CAO bằng chỗ được cho (`h-full`) và bề RỘNG tự suy ra từ tỉ lệ
       * (`w-auto` + `aspect-ratio`). Trần chiều cao `calc(...)` lo nốt trường hợp
       * ngược lại — cửa sổ hẹp mà cao, như điện thoại dựng đứng: ở đó bề rộng
       * mới là thứ hết trước, nên phải hạ chiều cao xuống cho bề rộng vừa đủ
       * 100vw. Trừ `1.5rem` là phần đệm `p-3` hai bên của khung cha.
       */
      className="relative m-auto h-full w-auto max-w-full overflow-hidden rounded-2xl border border-abyss-700 bg-abyss-950"
      style={{
        aspectRatio: `${GALAXY.width} / ${GALAXY.height}`,
        maxHeight: `calc((100vw - 1.5rem) * ${GALAXY.height} / ${GALAXY.width})`,
      }}
      /* Lưới an toàn cho cả tấm bản đồ. Việc xoá chính là của từng world ở
         `WorldPin`; cái này bắt trường hợp con trỏ phóng ra khỏi bản đồ nhanh
         đến mức `pointerleave` của world không kịp bắn — chuột rời hẳn cửa sổ
         chẳng hạn. Không có nó thì hai khung chữ kẹt ở world cuối cùng. */
      onPointerLeave={() => setHoveredId(null)}
    >
      <BackgroundLayer
        url={galaxy.background_url}
        kind={galaxy.background_kind}
        sound={videoSound}
        className="pointer-events-none absolute inset-0 size-full object-cover"
      />

      {galaxy.worlds.map((world, index) => (
        <WorldPin
          key={world.id}
          world={world}
          index={index}
          total={galaxy.worlds.length}
          locale={locale}
          onHover={setHoveredId}
          onLeave={leaveWorld}
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

      {/* Nhạc nền. Vào nhạc sau cú chạm ĐẦU TIÊN của người chơi — xem
          `AmbientPlayer`. Trước đây chỗ này là một thẻ `<audio controls>` để
          người chơi tự bấm: thật thà với luật của trình duyệt, nhưng nghĩa là
          gần như không ai nghe thấy bản nhạc giáo viên đã mất công chọn. */}
      <AmbientPlayer
        surface="galaxy"
        audio={galaxy.audio}
        audioUrls={galaxy.audio_urls}
        backgroundKind={galaxy.background_kind}
      />
      <MusicControls className="absolute top-3 right-3 z-20" />
    </div>
  );
}

function WorldPin({
  world,
  index,
  total,
  locale,
  onHover,
  onLeave,
}: {
  world: PlayWorld;
  index: number;
  total: number;
  locale: string;
  onHover: (id: string | null) => void;
  onLeave: (id: string) => void;
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
        onPointerLeave={() => onLeave(world.id)}
        onFocus={() => onHover(world.id)}
        onBlur={() => onLeave(world.id)}
      >
        <div className="relative w-full" title={t('locked')}>
          {orb}
          {label}
        </div>
      </div>
    );
  }

  return (
    // `hover:z-10` để cái vừa phóng to nằm TRÊN hàng xóm. Các world đều là
    // `absolute` không đặt z-index nên chúng xếp lớp theo thứ tự trong DOM: thiếu
    // dòng này thì world vẽ sau sẽ cắt ngang mép world đang phóng to.
    <div
      className="absolute hover:z-10"
      style={style}
      onPointerEnter={() => onHover(world.id)}
      onPointerLeave={() => onLeave(world.id)}
      onFocus={() => onHover(world.id)}
      onBlur={() => onLeave(world.id)}
    >
      {/* Rê chuột vào thì world PHÓNG TO một chút, không vẽ khung.
          Cái khung cũ (`hover:ring-2`) là một hình chữ nhật/hình tròn của hệ
          thống úp lên tấm ảnh người dựng vẽ — nó nói "đây là một ô bấm được"
          bằng giọng của trình duyệt, giữa một bản đồ không có ô nào khác. Phóng
          to thì nói đúng điều đó bằng chính tấm ảnh: vật lại gần thì to lên.

          `focus-visible:ring-2` thì GIỮ. Người dùng bàn phím không có con trỏ để
          nhìn theo, và 5% to hơn là thứ khó thấy khi mắt đang ở chỗ khác — họ
          cần một đường viền rõ ràng chỉ ra "tiêu điểm đang ở đây". */}
      <Link
        href={localizedPath(`/play/world/${world.id}`, locale)}
        className={`relative block w-full no-underline ring-lagoon-400 transition duration-200 hover:scale-105 focus-visible:ring-2 ${
          world.show_ring ? 'rounded-full' : 'rounded-lg'
        }`}
      >
        {orb}
        {label}
      </Link>
    </div>
  );
}

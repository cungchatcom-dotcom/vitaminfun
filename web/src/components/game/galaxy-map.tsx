'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';

import { AmbientPlayer, useAmbientVideoSound } from './ambient-player';
import { BackgroundLayer } from './background-layer';
import { MusicControls } from './music-controls';
import { FullscreenButton } from './fullscreen-button';
import { PlayerMenu } from './player-menu';
import { EmptyState } from '@/components/ui/primitives';
import { GalaxyFrame } from '@/components/world/galaxy-frame';
import { WorldOrb } from '@/components/world/world-orb';
import { DEFAULT_WORLD_SIZE, defaultWorldSpot, galaxyCanvas, type Orientation } from '@/game/world';
import { usePortraitScreen } from '@/game/pointer';
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
  /**
   * World KHOÁ vừa được CHẠM, ở bản dọc.
   *
   * Điện thoại không có "rê": chạm là `pointerenter` rồi `pointerleave` ngay khi
   * nhấc tay, nên hai khung chữ loé tên world rồi quay về thiên hà trong chớp
   * mắt. World mở thì không sao — chạm là vào luôn. World khoá thì không vào
   * được, và cách duy nhất để biết nó là gì là đọc hai khung: nên chạm vào nó
   * là GHIM tên và mô tả lại, tới khi chạm world khác hoặc chạm ra chỗ trống.
   */
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  // Nhạc nền có thể đến TỪ CHÍNH TẤM NỀN, nếu nền là video và giáo viên bật cờ.
  // `null` = video câm và thẻ `<audio>` bên dưới lo phần nhạc như thường.
  /**
   * BỐ CỤC DỌC hay NGANG.
   *
   * Hai vế, và thiếu vế nào cũng hỏng: màn hình phải đang dọc, VÀ người dựng
   * phải đã thiết kế bản dọc. Thiếu vế sau thì học sinh nhận một bản đồ không
   * nền với các world rải bừa — tệ hơn hẳn lời mời xoay ngang máy, thứ vẫn hiện
   * ra đúng lúc đó (xem `RotateGate` ở trang `/play`).
   *
   * Ảnh nền là dấu hiệu "đã thiết kế", quyết ở server — xem `_galaxy_portrait`.
   */
  const manDoc = usePortraitScreen();
  const doc = manDoc && Boolean(galaxy.portrait?.background_url);
  const huong: Orientation = doc ? 'portrait' : 'landscape';
  const canvas = galaxyCanvas(huong);

  /**
   * Bố cục đang dùng, đã gộp thành MỘT hình dạng.
   *
   * Phần vẽ bên dưới không hỏi "đang dọc hay ngang" ở từng dòng — nó đọc `bc`.
   * Rải câu hỏi đó ra hai chục chỗ là hai chục cơ hội quên một chỗ, và chỗ quên
   * sẽ là một cái khung vẽ theo toạ độ của bố cục kia.
   */
  const bc = doc ? galaxy.portrait! : galaxy;

  const videoSound = useAmbientVideoSound(galaxy.audio, bc.background_kind, 'galaxy');

  if (galaxy.worlds.length === 0) {
    return <EmptyState label={t('noWorlds')} hint={t('noWorldsHint')} />;
  }

  const hovered =
    galaxy.worlds.find((w) => w.id === (hoveredId ?? (doc ? pinnedId : null))) ?? null;

  /* Rời một world thì CHỈ world đó được xoá, không phải xoá sạch.
     Đi thẳng từ world này sang world kia, trình duyệt bắn `pointerleave` của
     cái cũ SAU `pointerenter` của cái mới. Xoá vô điều kiện là cái vừa trỏ tới
     bị chính cái vừa rời khỏi thổi bay, và hai khung chữ nháy về thiên hà rồi
     mới đổi — hoặc tệ hơn, nằm luôn ở thiên hà. */
  const leaveWorld = (id: string) => setHoveredId((cur) => (cur === id ? null : cur));

  /** Ruột tấm bản đồ: nền, các world, hai cái khung, nhạc. */
  const ruot = (
    <>
      <BackgroundLayer
        url={bc.background_url}
        kind={bc.background_kind}
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
          onPin={doc ? setPinnedId : undefined}
          orientation={huong}
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
        orientation={huong}
        imageUrl={bc.title_url}
        x={bc.title_x}
        y={bc.title_y}
        width={bc.title_width}
        color={bc.title_color}
        fontScale={bc.title_font}
      >
        {pickText(hovered ? hovered.name_i18n : galaxy.name_i18n, locale)}
      </GalaxyFrame>

      <GalaxyFrame
        kind="desc"
        orientation={huong}
        imageUrl={bc.desc_url}
        x={bc.desc_x}
        y={bc.desc_y}
        width={bc.desc_width}
        color={bc.desc_color}
        fontScale={bc.desc_font}
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
    </>
  );

  /** Cụm điều khiển góc — neo theo MÀN HÌNH, không theo tấm bản đồ. */
  const cumGoc = (
    <>
      {/* Góc điều khiển của học sinh: loa và tài khoản.

          Đây là chỗ DUY NHẤT mang lối đăng xuất trong màn học sinh — thanh trên
          cùng đã bỏ, xem `PlayerMenu`. Xếp cùng một cụm neo về mép phải, nên
          thanh âm lượng trượt ra thì cả cụm dồn sang trái, không cái nào đè lên
          cái nào. */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        <FullscreenButton />
        <MusicControls />
        <PlayerMenu />
      </div>
    </>
  );

  /**
   * BẢN DỌC: ảnh nền PHỦ KÍN màn, ở mọi tỉ lệ điện thoại.
   *
   * Khung thiết kế là 9:16 (0.5625), nhưng điện thoại thật chạy từ khoảng 0.45
   * tới 0.56 — iPhone SE đúng 9:16, iPhone 14 và Pixel thì cao hơn hẳn. Giữ
   * nguyên tỉ lệ khung là chừa hai dải đen trên dưới, có máy tới một phần năm
   * chiều cao.
   *
   * Nên tấm bản đồ được phóng theo kiểu PHỦ: lớn lên tới khi che kín cả hai
   * chiều, phần thừa tràn ra ngoài và bị cắt.
   *
   * ## Vì sao phóng CẢ TẤM, không riêng ảnh nền
   *
   * Câu hỏi tự nhiên là "chỉ cần ảnh nền phủ kín là đủ chứ?". Không đủ, và cái
   * hỏng thì im lặng: các world và hai cái khung đặt theo PHẦN TRĂM của tấm bản
   * đồ. Cho riêng ảnh nền phóng ra mà giữ nguyên khung toạ độ thì ảnh bị xén
   * một dải còn các khối không xén theo — người dựng căn một cái cổng vào đúng
   * giữa vòm đá, học sinh thấy nó nằm lệch trên bầu trời. Mỗi đời máy lệch một
   * kiểu, nên không ai sửa nổi bằng cách kéo lại cho vừa.
   *
   * Phóng cả tấm thì ảnh và các khối chịu đúng MỘT phép biến đổi: bố cục người
   * dựng thấy là bố cục học sinh thấy. Thứ duy nhất mất đi là mép ảnh — thứ mà
   * người dựng nhìn thấy và chừa trước được.
   *
   * `cqw`/`cqh` chứ không `vw`/`vh`: khung cha có thể không phải cả màn hình
   * (giáo viên chơi thử còn một dải cảnh báo trên đầu), và đo theo màn hình
   * trong khi đang nằm trong một cái hộp thấp hơn là phóng quá tay đúng bằng
   * chiều cao dải ấy.
   */
  if (doc) {
    return (
      <div
        className="relative h-full w-full overflow-hidden bg-abyss-950"
        // `size` chứ không `inline-size`: `cqh` chỉ có nghĩa khi khung cha khai
        // cả chiều cao.
        style={{ containerType: 'size' }}
        onPointerLeave={() => setHoveredId(null)}
        // Chạm ra chỗ trống thì bỏ ghim — hai khung quay về tên thiên hà.
        // World khoá chặn cú chạm của nó lại (`stopPropagation`), nên chạm
        // vào nó không tới được đây.
        onClick={() => setPinnedId(null)}
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            // PHỦ: rộng bằng cái lớn hơn giữa "bề rộng khung cha" và "bề rộng
            // cần để che hết chiều cao khung cha".
            width: `max(100cqw, calc(100cqh * ${canvas.width} / ${canvas.height}))`,
            aspectRatio: `${canvas.width} / ${canvas.height}`,
          }}
        >
          {ruot}
        </div>

        {/* NGOÀI tấm bản đồ: tấm bản đồ tràn khỏi màn hình, nên một cái nút neo
            vào góc của nó sẽ nằm ngoài mép và bị cắt. */}
        {cumGoc}
      </div>
    );
  }


  return (
    <div
      /**
       * PHỦ HẾT CHỖ ĐƯỢC CHO, nhưng GIỮ NGUYÊN TỈ LỆ của bố cục đang dùng —
       * 3200×1800 ở bản ngang, 1800×3200 ở bản dọc.
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
        aspectRatio: `${canvas.width} / ${canvas.height}`,
        maxHeight: `calc((100vw - 1.5rem) * ${canvas.height} / ${canvas.width})`,
      }}
      /* Lưới an toàn cho cả tấm bản đồ. Việc xoá chính là của từng world ở
         `WorldPin`; cái này bắt trường hợp con trỏ phóng ra khỏi bản đồ nhanh
         đến mức `pointerleave` của world không kịp bắn — chuột rời hẳn cửa sổ
         chẳng hạn. Không có nó thì hai khung chữ kẹt ở world cuối cùng. */
      onPointerLeave={() => setHoveredId(null)}
    >
      {ruot}
      {cumGoc}
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
  onPin,
  orientation,
}: {
  world: PlayWorld;
  index: number;
  total: number;
  locale: string;
  onHover: (id: string | null) => void;
  onLeave: (id: string) => void;
  /** Bản dọc: chạm world KHOÁ thì ghim tên và mô tả của nó vào hai khung. */
  onPin?: (id: string) => void;
  orientation: Orientation;
}) {
  const t = useTranslations('play');

  const canvas = galaxyCanvas(orientation);
  const spot = defaultWorldSpot(index, total, orientation);
  // Chỗ đứng của hướng đang vẽ. Bản dọc chưa đặt thì rơi về chỗ rải đều CỦA
  // BẢN DỌC, không rơi về toạ độ bản ngang: 3000 theo trục x là ngoài mép một
  // bản đồ chỉ rộng 1800.
  const dat = orientation === 'portrait' ? world.portrait : world;
  const x = dat?.scene_x ?? spot.x;
  const y = dat?.scene_y ?? spot.y;
  const size = dat?.icon_size ?? DEFAULT_WORLD_SIZE;

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
    left: `${(x / canvas.width) * 100}%`,
    top: `${(y / canvas.height) * 100}%`,
    width: `${(size / canvas.width) * 100}%`,
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
        onClick={
          onPin
            ? (e) => {
                e.stopPropagation();
                onPin(world.id);
              }
            : undefined
        }
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

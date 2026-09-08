'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { GalaxyFrame } from '@/components/world/galaxy-frame';
import { LobbyContent } from '@/components/world/lobby-content';

import { AmbientPlayer, useAmbientVideoSound } from './ambient-player';
import { BackgroundLayer } from './background-layer';
import { MusicControls } from './music-controls';
import {
  GALAXY,
  isLobbyAction,
  isLobbyStat,
  LOBBY_ELEMENT_KEYS,
  LOBBY_RANK_ROWS,
  lobbyBox,
  lobbyGroupOf,
  lobbyTextLines,
  type LobbyElementKey,
  type LobbySaved,
} from '@/game/world';
import { pickText } from '@/lib/i18n-text';
import { localizedPath } from '@/lib/routes';

import { ChapterMinimap } from './chapter-minimap';
import { CharacterInfo, CharacterSlot } from './character-slot';

import type { PlayChapter, PlayWorldDetail } from '@/lib/types';

/** Số chương hiện cùng lúc trên hàng ngang. */
const PER_PAGE = 5;

/**
 * Nhịp của mọi hiệu ứng chuột trong phòng chờ. Vào chậm rãi, nhún xuống thì
 * nhanh gọn — cú bấm phải có cảm giác dứt khoát, còn cú rê thì không.
 */
const MOTION = 'transition-transform duration-150 ease-out motion-reduce:transition-none';

/**
 * Rê chuột vào thì PHÓNG NHẸ. Mục đích là NHÌN CHO RÕ, không phải báo "bấm được
 * đây" — nên khối nào cũng có, kể cả bảng chỉ số hay một chương đang khoá.
 *
 * Cú bấm mới là thứ nói "bấm được": `active:scale` chỉ gắn cho thứ THỰC SỰ làm
 * gì đó khi bấm. Cho một cái nút chết nhún xuống là nói dối người dùng bằng
 * hoạt hình — họ bấm, nó nhún, rồi không có gì xảy ra.
 *
 * Máy đặt GIẢM CHUYỂN ĐỘNG thì bỏ phần HOẠT HÌNH, không bỏ phản hồi: cỡ vẫn
 * đổi, chỉ là đổi ngay lập tức thay vì trượt trong 150ms. Bỏ luôn cả cú phóng
 * (`motion-reduce:hover:scale-100`) là xoá sạch tính năng — mà điều người ta
 * xin là bớt thứ nhúc nhích, không phải bớt thứ cho biết chuột đang ở đâu.
 */
/**
 * Tỉ lệ phóng khi rê chuột vào một khối. `1` = không phóng.
 *
 * Nút phóng đậm hơn khối: nó nhỏ hơn nhiều, cùng một tỉ lệ thì gần như không
 * thấy gì. Hàng chương trả về 1 — người chơi nhắm vào MỘT chương, mà phóng cả
 * hàng thì bốn chương kia cũng nhúc nhích theo dù không ai chạm tới. Việc phóng
 * nằm ở từng ô chương, xem `ChapterRow`.
 *
 * Trả về SỐ chứ không phải tên lớp CSS: Tailwind dò tên lớp trong mã nguồn, nên
 * một tên ghép chuỗi kiểu `scale-[${n}]` sẽ không bao giờ được sinh ra.
 */
function zoomOf(key: LobbyElementKey): number {
  if (key === 'chapters') return 1;
  return isLobbyAction(key) ? 1.06 : 1.03;
}

/**
 * Phòng chờ của world — màn hình học sinh thấy khi mở một world.
 *
 * Vẽ đúng cái bố cục giáo viên đã kéo trong trình thiết kế: cùng hệ toạ độ
 * 3200×1800, cùng `LOBBY_ELEMENTS`, cùng `GalaxyFrame`. Hai bên duyệt CHUNG
 * một sổ đăng ký, nên thêm một khối mới là hai bên cùng có.
 *
 * Khối nào cũng nằm đúng chỗ và đúng cỡ đã đặt; NỘI DUNG bên trong thì ở đây
 * là thật, còn bên trình thiết kế là mẫu.
 */
export function WorldLobby({ world }: { world: PlayWorldDetail }) {
  const t = useTranslations();
  const locale = useLocale();

  const lobby = world.lobby;
  const layout = (lobby.layout ?? {}) as Record<string, LobbySaved>;

  // Nút Chơi chỉ nhún khi nó thật sự dẫn đi đâu đó — cùng điều kiện mà
  // `ActionButton` dùng để quyết định vẽ liên kết hay vẽ một ô mờ.
  const canPlay = (world.chapters?.flatMap((c) => c.stages) ?? []).some((stage) => stage.unlocked);

  /**
   * NHÓM khối đang bị rê chuột — không phải khối nào.
   *
   * Giữ ở đây chứ không dùng `:hover` của CSS: `:hover` chỉ biết về phần tử
   * dưới con trỏ, mà cái phải phóng lên là cả nhóm. Không có tổ tiên chung nào
   * để treo `group-hover` vào — các khối là anh em ruột, mỗi cái đặt theo toạ
   * độ thế giới của riêng nó.
   */
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  // Xem `GalaxyMap` — cùng một luật, cùng một hook.
  const videoSound = useAmbientVideoSound(lobby.audio, lobby.background_kind, 'lobby');

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-abyss-700 bg-abyss-950"
      style={{ aspectRatio: `${GALAXY.width} / ${GALAXY.height}` }}
    >
      <BackgroundLayer
        url={lobby.background_url}
        kind={lobby.background_kind}
        sound={videoSound}
        className="pointer-events-none absolute inset-0 size-full object-cover"
      />

      {/* Nhạc riêng của phòng chờ. KHÔNG kế thừa nhạc thiên hà: hai màn này đi
          liền nhau, và một bản nhạc chạy tiếp qua ranh giới thì không nói được
          là mình đã sang chỗ khác. Muốn giống thì tải cùng một file lên cả hai. */}
      <AmbientPlayer
        surface="lobby"
        audio={lobby.audio}
        audioUrls={lobby.audio_urls}
        backgroundKind={lobby.background_kind}
      />
      <MusicControls className="absolute top-3 right-3 z-20" />

      {LOBBY_ELEMENT_KEYS.map((key) => {
        const box = lobbyBox(key, layout[key]);
        const group = lobbyGroupOf(key);
        const zoom = zoomOf(key);
        const on = hoveredGroup === group && zoom !== 1;
        const pressable = key === 'character' || (key === 'play' && canPlay);
        return (
          <div
            key={key}
            data-lobby-group={group}
            // Rê vào MỘT khối là cả nhóm phóng. Nghe ở từng khối chứ không bọc
            // cả nhóm vào một thẻ chung: thẻ chung phải to bằng hộp bao cả nhóm,
            // và cái khoảng trống giữa các khối con trong hộp đó sẽ nuốt mất cú
            // rê dành cho thứ nằm bên dưới.
            onPointerEnter={() => setHoveredGroup(group)}
            onPointerLeave={(e) => {
              // Đi từ khối này sang khối anh em thì KHÔNG tắt: `pointerleave`
              // của cái này chạy trước `pointerenter` của cái kia, nên tắt vô
              // điều kiện là cả nhóm co lại rồi phồng lên trong một khung hình.
              const to = e.relatedTarget as Element | null;
              if (to?.closest?.(`[data-lobby-group="${group}"]`)) return;
              setHoveredGroup((current) => (current === group ? null : current));
            }}
            // KHÔNG nâng `z-index` khi rê. Các khối phòng chờ CHỒNG LÊN NHAU
            // theo thiết kế — dòng mô tả nhân vật nằm ngay trên tấm thẻ nhân
            // vật — nên nâng khối đang rê lên trên là lấy ảnh thẻ đè mất dòng
            // chữ, tức rê chuột vào thì chữ biến mất. Thứ tự chồng ở đây do
            // người dựng sắp đặt qua chỗ đứng của từng khối; cú rê chuột không
            // có quyền sắp lại. Ô chương thì khác, xem `ChapterRow`.
            className={`absolute ${zoom === 1 ? '' : MOTION}`}
            style={{
              left: `${(box.x / GALAXY.width) * 100}%`,
              top: `${(box.y / GALAXY.height) * 100}%`,
              width: `${(box.width / GALAXY.width) * 100}%`,
              height: `${(box.height / GALAXY.height) * 100}%`,
              // Phép phóng nằm TRONG `transform`, và nằm SAU phép căn giữa.
              //
              // Không dùng thuộc tính `scale:` riêng của CSS. Thứ tự hợp thành
              // mà trình duyệt áp là `translate → rotate → scale → transform`,
              // tức cái `-50%` căn giữa ở đây bị NHÂN với tỉ lệ phóng: khối
              // phóng 1,03 thì tâm nó trôi lên trái đúng 1,5% kích thước của
              // chính nó. Trên tấm khung thành tích 193×279 là gần 3×4 điểm ảnh
              // — đủ để nhìn ra cái khối trượt sang trái thay vì nở ra tại chỗ.
              // Lỗi này có từ trước, hồi còn dùng lớp `hover:scale-*` của
              // Tailwind.
              //
              // Viết `translate(...) scale(...)` thì phép căn giữa chạy trước và
              // không bị nhân: khối nở ra ĐỀU quanh tâm của chính nó.
              transform: `translate(-50%, -50%)` + (on ? ` scale(${zoom})` : ''),
            }}
          >
            <div
              className={`relative size-full overflow-hidden rounded-xl ${
                pressable ? `${MOTION} active:scale-[0.96] active:duration-75` : ''
              }`}
            >
              {lobby.urls?.[key] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lobby.urls[key]}
                  alt=""
                  className="absolute inset-0 size-full"
                  draggable={false}
                />
              )}
              <LobbyContent elementKey={key} saved={layout[key]?.content}>
                <BlockBody elementKey={key} saved={layout[key]} world={world} locale={locale} />
              </LobbyContent>
            </div>
          </div>
        );
      })}

      <GalaxyFrame
        kind="title"
        imageUrl={lobby.title.url}
        x={lobby.title.x}
        y={lobby.title.y}
        width={lobby.title.width}
        height={lobby.title.height}
        color={lobby.title.color}
        fontScale={lobby.title.font}
      >
        {pickText(world.name_i18n, locale)}
      </GalaxyFrame>

      <GalaxyFrame
        kind="desc"
        imageUrl={lobby.desc.url}
        x={lobby.desc.x}
        y={lobby.desc.y}
        width={lobby.desc.width}
        height={lobby.desc.height}
        color={lobby.desc.color}
        fontScale={lobby.desc.font}
      >
        {pickText(world.story_i18n, locale)}
      </GalaxyFrame>

      {/* Lối về bản đồ thiên hà. Ở góc trên bên trái vì đó là chỗ mắt tìm nút
          "quay lại", và nó không đè lên khối nào ở bố cục mặc định. */}
      <Link
        href={localizedPath('/play', locale)}
        className="absolute top-3 left-3 rounded-lg border border-white/40 bg-abyss-950/70 px-3 py-1.5 text-xs font-bold text-white no-underline backdrop-blur transition hover:border-lagoon-400"
      >
        ← {t('play.title')}
      </Link>
    </div>
  );
}

function BlockBody({
  elementKey,
  saved,
  world,
  locale,
}: {
  elementKey: LobbyElementKey;
  saved: LobbySaved | undefined;
  world: PlayWorldDetail;
  locale: string;
}) {
  const t = useTranslations();

  // Khối `stats` giờ chỉ còn TẤM KHUNG. Năm con số bên trong nó là năm khối
  // riêng, kéo và chỉnh được một mình — xem `LOBBY_STAT_KEYS`.
  if (elementKey === 'stats') return null;

  if (isLobbyStat(elementKey)) {
    return <StatValue>{statText(elementKey, world, locale, t)}</StatValue>;
  }

  if (elementKey === 'ranking') {
    const rows = world.leaderboard ?? [];
    if (rows.length === 0) {
      return (
        <span className="flex size-full items-center justify-center text-center text-[1em] opacity-70">
          {t('lobby.stat.noRanking')}
        </span>
      );
    }
    return (
      <RankList>
        {rows.map((row, index) => (
          <RankRow
            key={row.user_id}
            rank={index + 1}
            name={row.display_name}
            points={String(row.skill_pts)}
            me={row.is_me}
          />
        ))}
      </RankList>
    );
  }

  if (elementKey === 'chapters') return <ChapterRow world={world} locale={locale} />;

  if (elementKey === 'character') {
    return (
      <CharacterSlot
        worldId={world.id}
        characters={world.characters ?? []}
        chosenId={world.my_character_id}
      />
    );
  }

  if (elementKey === 'characterInfo') {
    return (
      <CharacterInfo
        characters={world.characters ?? []}
        chosenId={world.my_character_id}
        lines={lobbyTextLines(elementKey, saved)}
      />
    );
  }

  return <ActionButton elementKey={elementKey} saved={saved} world={world} locale={locale} />;
}

/**
 * Khối xếp hạng: đúng `LOBBY_RANK_ROWS` hàng, chia đều chiều cao khối.
 *
 * Chiều cao hàng cố định theo SỐ Ô chứ không theo số người đang có: để hàng tự
 * giãn thì world mới có ba người sẽ hiện ba cái ảnh đại diện to bằng nắm tay,
 * rồi người thứ tư vào là cả bảng co lại — bố cục người dựng vừa căn xong tự
 * đổi sau lưng họ.
 */
function RankList({ children }: { children: ReactNode }) {
  return <ul className="flex size-full flex-col">{children}</ul>;
}

/**
 * Một hàng xếp hạng: ẢNH ĐẠI DIỆN + TÊN dồn trái, ĐIỂM dồn phải.
 *
 * Không có số thứ tự viết ra ngoài — thứ tự nằm TRONG cái vòng tròn, chỗ tấm
 * ảnh đại diện sẽ thay vào khi miền dữ liệu có ảnh cho người dùng. Vòng tròn
 * cao theo hàng (`h-[78%] aspect-square`) chứ không theo cỡ chữ: hàng là thứ có
 * chiều cao chắc chắn, còn cỡ chữ thì người dựng chỉnh được và một cái vòng bám
 * theo nó sẽ tràn ra khỏi hàng ngay khi ai đó kéo thanh cỡ chữ lên.
 */
function RankRow({
  rank,
  name,
  points,
  me = false,
}: {
  rank: number;
  name: string;
  points: string;
  me?: boolean;
}) {
  return (
    <li
      className="flex items-center gap-[4%]"
      style={{ height: `${100 / LOBBY_RANK_ROWS}%` }}
    >
      {/* Chỗ giữ chỗ cho ảnh đại diện. Viền chứ không phải nền đặc: nó nằm trên
          một tấm ảnh khung không đoán trước được sáng tối. */}
      <span className="flex aspect-square h-[78%] shrink-0 items-center justify-center rounded-full border-2 border-current text-[0.8em] font-bold opacity-90">
        {rank}
      </span>
      {/* Dòng của CHÍNH mình giữ màu vàng riêng, không theo màu người dựng đặt:
          nó đánh dấu "đây là bạn", mà một bảng xếp hạng không tìm ra mình ở đâu
          thì không dùng để làm gì. */}
      <span
        className={`min-w-0 flex-1 truncate text-left text-[1em] ${
          me ? 'font-bold text-orichalcum-400' : 'opacity-90'
        }`}
      >
        {name}
      </span>
      <span className={`shrink-0 font-mono text-[1em] ${me ? 'font-bold text-orichalcum-400' : ''}`}>
        {points}
      </span>
    </li>
  );
}

/**
 * Một con số của bảng thành tích, căn giữa khung của chính nó.
 *
 * Chỉ có CON SỐ, không có nhãn: tấm ảnh khung người dựng tải lên gần như bao
 * giờ cũng đã vẽ sẵn biểu tượng cho từng dòng, và in thêm chữ "Điểm chiến lực"
 * lên cạnh cái biểu tượng nói đúng điều đó là nói hai lần trong một cái ô vốn
 * chỉ vừa một dòng.
 */
function StatValue({ children }: { children: string }) {
  return (
    <span className="flex size-full items-center justify-center text-center">
      <span className="w-full truncate text-[1em] font-bold">{children}</span>
    </span>
  );
}

/**
 * Con số THẬT của từng chỉ số.
 *
 * Cái nào tính được thì tính ngay, cái nào chưa có luật thì hiện đúng con số
 * database đang giữ — hiện `0 / 90` là sự thật ("chưa ăn sao nào"), còn giấu cả
 * dòng đi thì người dựng không căn được bố cục cho thứ sắp có.
 */
function statText(
  key: LobbyElementKey,
  world: PlayWorldDetail,
  locale: string,
  t: ReturnType<typeof useTranslations>,
): string {
  if (key === 'statPower') return String(world.my_skill_pts);
  if (key === 'statShards') return `${world.my_shards}/${world.shard_total}`;
  if (key === 'statStars') return `${world.my_stars}/${world.star_total}`;
  if (key === 'statLevel') {
    // Chưa đặt nhãn riêng thì lấy nhãn của `difficulty` — world mới không phải
    // là một ô trống, và người dựng thấy ngay chỗ này dùng để làm gì.
    return pickText(world.level_i18n, locale) || t(`world.difficulty.${world.difficulty}`);
  }
  // Tiến độ = nhiệm vụ đã động tới / tổng nhiệm vụ. Chưa có nhiệm vụ nào thì 0%
  // chứ không phải 100%: một world rỗng chưa đi được đoạn nào cả.
  const done = world.quest_total ? (world.my_quests_played / world.quest_total) * 100 : 0;
  return `${Math.round(done)}%`;
}

/**
 * Hàng chương: năm cái một lúc, lật trang để xem tiếp.
 *
 * Cửa sổ mở đầu **đặt chương mở cuối cùng vào GIỮA** — đó là chỗ người chơi
 * đang đứng, và họ mở màn này ra để đi tiếp chứ không phải để ôn lại chương 1.
 * Trừ khi chương đó là số 1 hoặc 2: lúc ấy không có gì bên trái để đẩy, nên
 * cửa sổ nằm ở 1…5.
 *
 * Lật cả năm mỗi lần, không trượt từng cái: trượt một chương mỗi lần thì bấm
 * mười lần mới xem hết mười chương, mà mỗi lần cả hàng lại xê dịch.
 *
 * Bấm vào một chương đã mở thì hiện MINIMAP của chương đó — bảng các màn chơi
 * bên trong. Trước đây cú bấm nhảy thẳng vào màn mở đầu tiên, tức người chơi
 * không bao giờ chọn được màn: chương chỉ là một cái nút tắt tới đúng một chỗ.
 *
 * Mỗi ô CHỈ CÓ ẢNH, không có tên viết dưới. Ảnh chương là tranh người dựng vẽ
 * riêng cho chương đó và thường đã có chữ trong tranh; thêm một dòng tên bên
 * dưới vừa lặp lại vừa ăn mất chiều cao của chính tấm ảnh. Tên vẫn còn ở
 * `title` để rê chuột đọc được, và ở ngay đầu minimap khi bấm vào.
 *
 * Rê chuột thì CHỈ Ô ĐANG RÊ phóng lên, không phải cả hàng — người chơi nhắm
 * vào một chương, và bốn ô kia nhúc nhích theo là nhiễu.
 */
function ChapterRow({ world, locale }: { world: PlayWorldDetail; locale: string }) {
  const t = useTranslations();
  const chapters = world.chapters ?? [];

  const unlocked = chapters.map((chapter) => chapter.stages.some((stage) => stage.unlocked));
  const lastUnlocked = unlocked.lastIndexOf(true);

  const maxStart = Math.max(0, chapters.length - PER_PAGE);
  const centred = Math.max(0, Math.min(maxStart, (lastUnlocked < 0 ? 0 : lastUnlocked) - 2));
  const [start, setStart] = useState(centred);
  /** Chương đang mở minimap. `null` = chưa mở cái nào. */
  const [openChapter, setOpenChapter] = useState<PlayChapter | null>(null);

  const shown = chapters.slice(start, start + PER_PAGE);

  return (
    <div className="flex size-full items-stretch gap-[1.5%]">
      <PageArrow
        label={t('lobby.character.prev')}
        arrow="‹"
        disabled={start === 0}
        onClick={() => setStart((s) => Math.max(0, s - PER_PAGE))}
      />

      {shown.map((chapter, index) => {
        const globalIndex = start + index;
        const open = unlocked[globalIndex];
        const current = globalIndex === lastUnlocked;

        const title = `${chapter.order_index}. ${pickText(chapter.name_i18n, locale)}`;

        const cover = (
          <div
            className={`relative flex-1 overflow-hidden rounded-lg border ${
              current ? 'border-orichalcum-400 ring-2 ring-orichalcum-400/60' : 'border-white/40'
            } bg-abyss-950/40`}
          >
            {chapter.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={chapter.cover_url}
                alt=""
                className="absolute inset-0 size-full object-cover"
                draggable={false}
              />
            )}
            {!open && (
              <span className="absolute inset-0 flex items-center justify-center bg-abyss-950/50 text-[2em]">
                🔒
              </span>
            )}
          </div>
        );

        // Chương khoá KHÔNG bấm được — và không phải một cái nút bị làm mờ, mà
        // không có nút nào cả. Cùng luật với world khoá trên bản đồ thiên hà.
        //
        // `items-stretch` trên thẻ `button` KHÔNG thừa: trình duyệt tự đặt
        // `align-items: center` cho nút, nên ô ảnh — vốn chỉ chứa một tấm ảnh
        // xếp tuyệt đối, tức bề rộng nội dung bằng 0 — co lại còn đúng hai
        // đường viền. Ảnh vẫn tải về, vẫn nằm trong DOM, mà không ai thấy nó.
        return (
          // `relative` để `z-10` có tác dụng: ô đang phóng phải đè lên hai ô
          // bên cạnh, chứ không chui xuống dưới chúng.
          <div
            key={chapter.id}
            className={`relative flex min-w-0 flex-1 hover:z-10 ${MOTION} hover:scale-105 ${
              open ? 'active:scale-[0.98] active:duration-75' : ''
            }`}
          >
            {open ? (
              <button
                type="button"
                onClick={() => setOpenChapter(chapter)}
                title={title}
                aria-label={t('lobby.minimap.open')}
                className="flex min-w-0 flex-1 items-stretch"
              >
                {cover}
              </button>
            ) : (
              cover
            )}
          </div>
        );
      })}

      <PageArrow
        label={t('lobby.character.next')}
        arrow="›"
        disabled={start >= maxStart}
        onClick={() => setStart((s) => Math.min(maxStart, s + PER_PAGE))}
      />

      {openChapter && (
        <ChapterMinimap chapter={openChapter} onClose={() => setOpenChapter(null)} />
      )}
    </div>
  );
}

function PageArrow({
  label,
  arrow,
  disabled,
  onClick,
}: {
  label: string;
  arrow: string;
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
      className="shrink-0 self-center rounded-lg border border-white/40 bg-abyss-950/50 px-1 text-sm text-white transition hover:border-lagoon-400 disabled:pointer-events-none disabled:opacity-25"
    >
      {arrow}
    </button>
  );
}

/**
 * Ba cái nút: Chơi / Tạo phòng / Vào phòng.
 *
 * "Chơi" đi tới màn mở đầu tiên còn chơi được. Hai nút phòng chờ Bước 7 — vẽ
 * MỜ và không bấm được, kèm lời giải thích: giấu hẳn thì giáo viên căn bố cục
 * cho ba cái nút rồi học sinh chỉ thấy một.
 *
 * Chữ trên nút là của NGƯỜI DỰNG và mặc định RỖNG — rỗng thì chỉ còn tấm ảnh.
 * Ảnh nút họ tải lên hầu như bao giờ cũng đã vẽ sẵn chữ trong tranh, nên một
 * dòng chữ của hệ thống in đè lên chỉ tạo ra hai lớp chữ chồng nhau. Muốn có
 * chữ thì gõ vào ô chữ trong trình thiết kế. Tên khối vẫn còn ở `title` — rê
 * chuột là biết đây là nút gì, kể cả khi không có chữ nào hiện ra.
 */
function ActionButton({
  elementKey,
  saved,
  world,
  locale,
}: {
  elementKey: LobbyElementKey;
  saved: LobbySaved | undefined;
  world: PlayWorldDetail;
  locale: string;
}) {
  const t = useTranslations();

  const name = t(`lobby.element.${elementKey}`);
  const text = pickText(saved?.text_i18n ?? undefined, locale);
  const label = text ? <span className="text-[1.15em] font-bold">{text}</span> : null;

  if (elementKey !== 'play') {
    return (
      <span
        className="flex size-full items-center justify-center rounded-lg text-center opacity-50"
        title={`${name} — ${t('lobby.stat.laterStep')}`}
      >
        {label}
      </span>
    );
  }

  // Đích của nút Chơi ngay, theo thứ tự ưu tiên:
  //
  //   1. Màn đang chơi DỞ và còn giờ — `resume_stage_id`. Người chơi đóng nhầm
  //      tab giữa chừng rồi quay lại thì thứ họ muốn là cái đang làm dở, không
  //      phải một màn khác. Server quyết chuyện "còn giờ hay không", vì chỉ nó
  //      biết `started_at`.
  //   2. Màn mở CUỐI CÙNG. Nút này là "chơi tiếp", và chỗ người chơi đang đứng
  //      là mép tiến độ của họ. Ném họ về màn 1 mỗi lần bấm là bắt chơi lại thứ
  //      đã xong để tới được thứ chưa xong.
  const stages = world.chapters?.flatMap((c) => c.stages) ?? [];
  const resuming = world.resume_stage_id
    ? stages.find((stage) => stage.id === world.resume_stage_id)
    : undefined;
  const last = resuming ?? stages.filter((stage) => stage.unlocked).at(-1);
  if (!last) {
    return (
      <span
        className="flex size-full items-center justify-center rounded-lg text-center opacity-50"
        title={name}
      >
        {label}
      </span>
    );
  }

  return (
    <Link
      href={localizedPath(`/play/stage/${last.id}`, locale)}
      // Nói rõ nó dẫn đi đâu khi đang có màn dở: cùng một cái nút mà hôm nay
      // vào màn 7, mai vào màn 3, thì người chơi cần biết vì sao.
      title={
        resuming
          ? t('lobby.play.resume', { stage: pickText(resuming.name_i18n, locale) })
          : text || name
      }
      className="flex size-full items-center justify-center rounded-lg text-center no-underline transition hover:brightness-110"
    >
      {label}
    </Link>
  );
}

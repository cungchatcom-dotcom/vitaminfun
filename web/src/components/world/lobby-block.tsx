'use client';

import { useTranslations } from 'next-intl';

import { LobbyContent } from './lobby-content';

import { ScaleToHeight } from '@/components/game/scale-to-height';

import {
  isLobbyControl,
  isLobbyStat,
  LOBBY_PAGE_SIZE,
  CHAPTER_ARROW_CLASS,
  LOBBY_RANK_ROWS,
  type LobbyContentSaved,
  type LobbyElementKey,
} from '@/game/world';

/**
 * Một khối của phòng chờ: ảnh nền do giáo viên tải lên, và NỘI DUNG MẪU vẽ đè
 * lên trên.
 *
 * Nội dung mẫu không phải trang trí. Không có nó, giáo viên căn một khung
 * trống rồi tới lúc học sinh mở ra mới biết bảng xếp hạng tràn khỏi mép hay ba
 * cái nút chồng lên nhau. Số liệu là bịa — nhưng số DÒNG, cỡ chữ và cách xếp
 * thì đúng bằng thứ màn hình thật sẽ vẽ.
 *
 * Chưa có ảnh thì vẫn vẽ, trên một ô viền đứt: bố cục phải căn được trước khi
 * ai kịp vẽ ảnh, và viền đứt nói rõ đây là chỗ giữ chỗ chứ không phải một tấm
 * nền đã chọn.
 *
 * Thuần hiển thị. Trình thiết kế và màn học sinh cùng duyệt `LOBBY_ELEMENTS`
 * rồi vẽ component này cho từng khoá — thêm khối mới không phải sửa file này,
 * chỉ thêm một nhánh mẫu nếu muốn.
 */
export function LobbyBlock({
  elementKey,
  imageUrl,
  label,
  text,
  lines,
  content,
  chapters,
  count,
}: {
  elementKey: LobbyElementKey;
  imageUrl: string | null | undefined;
  label: string;
  /** Chữ người dựng đã đặt cho nút. Rỗng = học sinh chỉ thấy tấm ảnh. */
  text?: string;
  /** Số dòng chữ lọt vào khung — khối mô tả nhân vật cắt ở dòng cuối. */
  lines?: number;
  /** Khung nội dung đã đặt. Vẽ qua ĐÚNG component màn học sinh dùng. */
  content?: LobbyContentSaved | null;
  /** Hàng chương: tên + ảnh + đã khoá hay chưa. Khối khác bỏ qua. */
  chapters?: { id: string; name: string; coverUrl?: string | null; locked: boolean }[];
  /** Hàng chương: số ô mỗi trang người dựng đã chọn. */
  count?: number | null;
}) {
  return (
    <div
      className={`relative size-full overflow-hidden rounded-xl ${
        imageUrl ? '' : 'border border-dashed border-white/40 bg-abyss-950/30'
      }`}
    >
      {imageUrl && (
        // Ảnh CĂNG theo khung, không giữ tỉ lệ gốc: khối có chiều cao thật do
        // giáo viên kéo, nên ảnh phải vừa đúng cái khung đó.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="absolute inset-0 size-full" draggable={false} />
      )}
      {isLobbyControl(elementKey) ? (
        // Khối điều khiển tự vẽ lấy, không qua `LobbyContent` — cùng lý do với
        // bên màn học sinh (`WorldLobby`).
        <ControlSample elementKey={elementKey} />
      ) : (
        <LobbyContent elementKey={elementKey} saved={content}>
          <Sample
            elementKey={elementKey}
            label={label}
            text={text}
            lines={lines}
            chapters={chapters}
            count={count}
          />
        </LobbyContent>
      )}
    </div>
  );
}

/**
 * MẪU của hai khối điều khiển — trông y như thật, nhưng không bấm được.
 *
 * Dựng lại bằng tay chứ không nhúng component thật: `PlayerMenu` cần một người
 * đăng nhập để đọc tên, `MusicControls` ghi tuỳ chọn âm thanh của người đang
 * xem, và cả hai sẽ bắt mất cú bấm mà người dựng dành cho việc KÉO khối. Cỡ,
 * viền, khoảng cách thì chép đúng của thật — người dựng phải thấy đúng cái hàng
 * nút sẽ chiếm bao nhiêu chỗ.
 *
 * Luôn vẽ cả nút toàn màn hình, dù trên máy tính học sinh không thấy nó: căn
 * theo trường hợp DÀI NHẤT thì trên điện thoại cụm nút vẫn nằm gọn trong chỗ
 * đã chừa.
 */
function ControlSample({ elementKey }: { elementKey: LobbyElementKey }) {
  const t = useTranslations();
  const tron =
    'grid size-8 place-items-center rounded-full border border-white/25 bg-black/45 text-sm text-white/85';

  if (elementKey === 'back') {
    return (
      <ScaleToHeight>
        <span className="block rounded-lg border border-white/40 bg-abyss-950/70 px-3 py-1.5 text-xs font-bold whitespace-nowrap text-white">
          ← {t('play.title')}
        </span>
      </ScaleToHeight>
    );
  }

  return (
    <ScaleToHeight align="end">
      <span className="flex items-center gap-2">
        <span className={tron} aria-hidden>
          ⛶
        </span>
        <span className="flex items-center rounded-full border border-white/25 bg-black/45 px-1 py-1">
          <span className="px-2 py-0.5 text-sm text-white/85" aria-hidden>
            🔊
          </span>
        </span>
        <span className={`${tron} font-bold`} aria-hidden>
          A
        </span>
      </span>
    </ScaleToHeight>
  );
}

function Sample({
  elementKey,
  label,
  text,
  lines,
  chapters,
  count,
}: {
  elementKey: LobbyElementKey;
  label: string;
  text?: string;
  lines?: number;
  chapters?: { id: string; name: string; coverUrl?: string | null; locked: boolean }[];
  count?: number | null;
}) {
  const t = useTranslations('lobby.sample');

  // Khối `stats` chỉ còn tấm khung — năm con số là năm khối riêng bên dưới.
  if (elementKey === 'stats') return null;

  if (isLobbyStat(elementKey)) {
    // Số MẪU, đúng dạng thật sẽ hiện: người dựng phải thấy "23/30" dài cỡ nào
    // trước khi căn nó vào một cái ô.
    return (
      <span className="flex size-full items-center justify-center text-center">
        <span className="w-full truncate text-[1em] font-bold">{t(elementKey)}</span>
      </span>
    );
  }

  if (elementKey === 'ranking') {
    // Đúng mười hàng, đúng bằng số hàng màn hình thật vẽ — người dựng phải thấy
    // cái bảng đầy trước khi căn nó vào một tấm khung.
    return (
      <ul className="flex size-full flex-col">
        {Array.from({ length: LOBBY_RANK_ROWS }, (_, i) => i + 1).map((rank) => (
          <li
            key={rank}
            className="flex items-center gap-[4%]"
            style={{ height: `${100 / LOBBY_RANK_ROWS}%` }}
          >
            <span className="flex aspect-square h-[78%] shrink-0 items-center justify-center rounded-full border-2 border-current text-[0.8em] font-bold opacity-90">
              {rank}
            </span>
            <span className="min-w-0 flex-1 truncate text-left text-[1em] opacity-90">
              {t(`player${rank}`)}
            </span>
            <span className="shrink-0 font-mono text-[1em]">{t(`score${rank}`)}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (elementKey === 'chapters') {
    // ĐÚNG số ô người dựng đã chọn — đó là số chương màn hình thật hiển thị
    // một lúc. Ô CHỈ CÓ ẢNH, không có tên viết dưới: đúng bằng thứ màn hình thật
    // vẽ. Chưa có ảnh thì mới điền tên vào giữa, để còn phân biệt các ô trống.
    //
    // Luôn đủ `n` ô kể cả khi world có ít chương hơn: người dựng đang căn một
    // hàng sẽ còn dài ra theo thời gian, và căn trên hai ô thì tới lúc có năm
    // chương, ô nào cũng hẹp đi một nửa.
    const n = count ?? LOBBY_PAGE_SIZE.base;
    const cells = Array.from({ length: n }, (_, i) => chapters?.[i] ?? null);

    // Hai MŨI TÊN lật trang, y hệt bên màn học sinh (`PageArrow` trong
    // `WorldLobby`): cùng lớp, cùng khoảng cách. Chúng chiếm chỗ thật trên hàng,
    // nên thiếu chúng thì ô mẫu rộng hơn ô học sinh thấy — và người dựng căn cỡ
    // khối theo một con số sai. Chỉ là hình, không bấm được.
    const muiTen = (kyTu: string) => (
      <span aria-hidden className={CHAPTER_ARROW_CLASS}>
        {kyTu}
      </span>
    );

    return (
      <div className="flex size-full items-stretch gap-[1.5%]">
        {muiTen('‹')}
        {cells.map((chapter, index) => (
          <div
            key={chapter?.id ?? index}
            className="relative min-w-0 flex-1 overflow-hidden rounded-lg border border-white/40 bg-abyss-950/40"
          >
            {chapter?.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={chapter.coverUrl}
                alt=""
                className="absolute inset-0 size-full object-cover"
                draggable={false}
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center px-1 text-center text-[1em] font-bold opacity-70">
                {chapter?.name ?? t('chapterN', { n: index + 1 })}
              </span>
            )}
            {chapter?.locked && (
              <span className="absolute inset-0 flex items-center justify-center bg-abyss-950/50 text-[2em]">
                🔒
              </span>
            )}
          </div>
        ))}
        {muiTen('›')}
      </div>
    );
  }

  if (elementKey === 'character') {
    // Vòng tròn rỗng đúng cỡ cái mặt nhân vật sẽ chiếm. Không cần chữ: khối này
    // chỉ có một tấm ảnh, và cái cần căn là chỗ đứng với đường kính của nó.
    return (
      <span className="flex size-full items-center justify-center">
        <span className="block aspect-square w-[55cqw] rounded-full border-2 border-dashed border-white/50" />
      </span>
    );
  }

  if (elementKey === 'characterInfo') {
    return (
      <span className="flex size-full items-center justify-center text-center">
        <span
          className="w-full text-[1em] leading-snug font-bold"
          style={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: lines ?? 2,
            overflow: 'hidden',
          }}
        >
          {t('characterLine')}
        </span>
      </span>
    );
  }

  // Ba cái nút: chữ do người dựng đặt. Chưa đặt thì hiện TÊN KHỐI mờ đi — một
  // chỗ giữ chỗ để còn căn bố cục, và nói rõ nó là chỗ giữ chỗ: học sinh sẽ
  // không thấy dòng này, họ chỉ thấy tấm ảnh.
  return (
    <span className="flex size-full items-center justify-center text-center text-[1.15em] font-bold">
      {text ? text : <span className="italic opacity-45">{label}</span>}
    </span>
  );
}

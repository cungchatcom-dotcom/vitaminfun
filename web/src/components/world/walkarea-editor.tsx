'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Card, SectionTitle } from '@/components/ui/primitives';
import { HERO_SPEED } from '@/game/character';
import {
  EMPTY_COLLISION,
  SNAP_STEP,
  canWalkAt,
  moveShape,
  nearestWalkable,
  shapeBounds,
  snap,
  type CollisionMap,
  type CollisionShape,
  type ShapeMode,
} from '@/game/collision';
import { WORLD } from '@/game/world';

import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * Công cụ vẽ VÙNG ĐI ĐƯỢC cho trình thiết kế màn chơi.
 *
 * Vẽ bằng **SVG chồng lên bảng kéo thả**, không phải canvas. Trình thiết kế
 * đang là DOM và đó là một lợi thế phải giữ: mỗi đỉnh đa giác là một `<circle>`
 * thật — kéo được, bấm Tab tới được, trình đọc màn hình thấy được. Dựng lại tất
 * cả những thứ đó bên trong canvas là tự làm khó mình.
 *
 * Ba quyết định đáng ghi lại:
 *
 *   1. **Một bước hoàn tác = một CỬ CHỈ đã xong**, không phải một sự kiện
 *      `pointermove`. Chỉ chụp ảnh danh sách lúc thả tay.
 *
 *   2. **Chụp cả mảng, không ghi phép nghịch đảo.** Một màn có vài chục hình,
 *      mỗi hình mươi con số — năm mươi bước lịch sử tốn vài kilobyte, và không
 *      có phép nghịch đảo nào để mà viết sai.
 *
 *   3. **Backspace và Ctrl+Z không được lẫn nhau.** Đang chấm dở một đa giác,
 *      Backspace bỏ đỉnh vừa đặt — chuyện bên trong cử chỉ. Ctrl+Z lúc đó huỷ
 *      nguyên hình đang vẽ. Nhập nhèm chỗ này là người dựng mất niềm tin vào cả
 *      hai phím.
 */

/** Công cụ đang cầm. `pick` = chọn/dời/xoá, không vẽ hình mới. */
export type WalkTool = 'rect' | 'ellipse' | 'poly' | 'pick';

/** Trần lịch sử hoàn tác. Vài chục hình × 50 bước vẫn còn dưới một megabyte. */
const HISTORY_LIMIT = 50;

/** Cạnh nhỏ nhất của một hình mới. Nhỏ hơn nữa là cú bấm hụt, không phải hình. */
const MIN_SIZE = SNAP_STEP;

/** Bấm cách đỉnh đầu trong ngần này đơn vị thế giới thì KHÉP đa giác. */
const CLOSE_RADIUS = 60;

/**
 * Bề dày nét, tính bằng đơn vị THẾ GIỚI — không phải pixel màn hình.
 *
 * Khung soạn rộng chừng 870 pixel cho một thế giới 3200 đơn vị, tức tỉ lệ 0,27.
 * Một nét "6" nghe dày, nhưng ra màn hình chỉ còn 1,6 pixel — mảnh hơn cả đường
 * kẻ ô, và biến mất hẳn trên những chỗ sáng của tranh nền. Các con số ở đây đã
 * quy ngược từ bề dày MONG MUỐN trên màn hình (2,5–4 px) rồi nhân lên.
 */
const LINE = { edge: 9, edgeSelected: 14, draft: 11, rubber: 9, closing: 6, closingNear: 11 };

/**
 * Gộp nhịp trước khi ghi xuống server, tính bằng mili giây.
 *
 * Trình thiết kế không có nút Lưu — nó ghi khi thả tay. Vậy Ctrl+Z cũng phải
 * ghi. Không gộp nhịp thì giữ Ctrl+Z mười lần là mười yêu cầu PATCH nối đuôi
 * nhau, và cái tới sau cùng chưa chắc là cái mới nhất.
 */
const SAVE_DEBOUNCE_MS = 600;

let shapeSeq = 0;
function nextShapeId(): string {
  shapeSeq += 1;
  return `s${Date.now().toString(36)}${shapeSeq.toString(36)}`;
}

// ==========================================================================
// Trạng thái
// ==========================================================================

export interface Walkarea {
  editing: boolean;
  setEditing: (on: boolean) => void;
  map: CollisionMap;
  /** Có gì đã vẽ chưa. Danh sách rỗng = cả bản đồ đi được, bất kể `default`. */
  drawn: boolean;
  tool: WalkTool;
  setTool: (tool: WalkTool) => void;
  /**
   * Công tắc `Đi được` / `Cấm đi` đang chỉ vào cái gì, và giá trị của nó.
   *
   * MỘT công tắc cho hai việc, không phải hai:
   *
   *   - đang chọn một hình  → nó là chế độ CỦA HÌNH ĐÓ, bấm là hình đổi ngay;
   *   - không chọn gì       → nó là chế độ của hình SẮP VẼ.
   *
   * Trước đây đây là hai thứ tách rời — một ô "hình sắp vẽ" luôn hiện, và một
   * nút "Đảo lại" nấp trong bảng của hình đang chọn. Ai vừa vẽ xong một hình
   * cũng bấm vào cái đang hiện, thấy KHÔNG CÓ GÌ XẢY RA, và kết luận là công cụ
   * hỏng. Một công tắc thì không bao giờ bấm vào chỗ không có tác dụng.
   */
  mode: ShapeMode;
  setMode: (mode: ShapeMode) => void;
  /** Chế độ của hình SẮP VẼ. Lớp vẽ cần riêng nó để tô khung đang kéo. */
  nextMode: ShapeMode;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  deleteSelected: () => void;
  /** Đưa hình đang chọn lên trên / xuống dưới — thứ tự quyết định hình nào thắng. */
  raiseSelected: () => void;
  lowerSelected: () => void;
  toggleDefault: () => void;
  /** Đỉnh đang chấm dở. `null` = không vẽ đa giác nào. */
  draftPoly: [number, number][] | null;
  setDraftPoly: (points: [number, number][] | null) => void;
  /** Ghi một danh sách hình MỚI kèm một bước hoàn tác. */
  commit: (shapes: CollisionShape[]) => void;

  /**
   * ĐIỂM VA CHẠM của nhân vật đi thử — cùng điểm mà `canWalk()` xét trong cảnh
   * chơi, tức cao hơn gót chân `HERO_FOOT_Y`. `null` = không ở chế độ vẽ.
   */
  test: { x: number; y: number } | null;
  /** Nhân vật đi thử đang đứng trên chỗ đi được không. */
  testWalkable: boolean;
  /** Đưa nhân vật đi thử về chỗ đi được gần giữa bản đồ nhất. */
  resetTest: () => void;
}

/** Phím đi thử → hướng. Cả mũi tên lẫn WASD, vì không ai nhớ mình quen bộ nào. */
const WALK_KEYS: Record<string, [number, number]> = {
  arrowup: [0, -1],
  w: [0, -1],
  arrowdown: [0, 1],
  s: [0, 1],
  arrowleft: [-1, 0],
  a: [-1, 0],
  arrowright: [1, 0],
  d: [1, 0],
};

export function useWalkarea({
  value,
  onSave,
}: {
  /** Bản đồ từ server. `null` = chưa vẽ. */
  value: CollisionMap | null;
  /** Ghi xuống server. `null` = xoá hẳn, quay về "cả bản đồ đi được". */
  onSave: (map: CollisionMap | null) => void;
}): Walkarea {
  const [editing, setEditingState] = useState(false);
  const [map, setMap] = useState<CollisionMap>(value ?? EMPTY_COLLISION);
  const [past, setPast] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [tool, setToolState] = useState<WalkTool>('rect');
  const [nextMode, setNextMode] = useState<ShapeMode>('allow');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftPoly, setDraftPoly] = useState<[number, number][] | null>(null);

  // Bản đồ của server là nguồn sự thật khi CHƯA vào chế độ vẽ. Đang vẽ thì
  // không: một `reload()` do kéo một nhiệm vụ khác gây ra sẽ nuốt mất bản vẽ
  // đang dở trên tay người dựng.
  const editingRef = useRef(editing);
  editingRef.current = editing;
  useEffect(() => {
    if (!editingRef.current) setMap(value ?? EMPTY_COLLISION);
  }, [value]);

  // Hàm lưu đi qua ref: hàm gộp nhịp gắn một lần, gọi thẳng thì nó mãi gọi bản
  // `onSave` của lần dựng đầu tiên.
  const save = useRef(onSave);
  save.current = onSave;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Bản chưa kịp ghi. `null` = không còn gì nợ server. */
  const pending = useRef<CollisionMap | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    pending.current = null;
    if (!next) return;
    // Danh sách rỗng thì XOÁ HẲN cột, không lưu một bản đồ rỗng: hai thứ đó cho
    // ra cùng một kết quả trong lúc chơi, nhưng "chưa vẽ" là một trạng thái đọc
    // ra được, còn `{shapes: []}` thì trông như dữ liệu hỏng.
    save.current(next.shapes.length === 0 ? null : next);
  }, []);

  const scheduleSave = useCallback(
    (next: CollisionMap) => {
      pending.current = next;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  // GHI NỐT lúc rời trang, không phải huỷ hẹn. Chỉ dọn cái hẹn thì một cú vẽ
  // cách lúc bấm "về danh sách" chưa tới 600 ms là mất trắng — và mất im lặng,
  // vì màn hình đã hiện "Đã lưu" từ trước đó rồi.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  const push = useCallback(
    (next: CollisionMap) => {
      setPast((stack) => [...stack, JSON.stringify(map)].slice(-HISTORY_LIMIT));
      setFuture([]);
      setMap(next);
      scheduleSave(next);
    },
    [map, scheduleSave],
  );

  const commit = useCallback((shapes: CollisionShape[]) => push({ ...map, shapes }), [map, push]);

  const step = useCallback(
    (from: string[], setFrom: typeof setPast, setTo: typeof setFuture) => {
      if (from.length === 0) return;
      setFrom(from.slice(0, -1));
      setTo((stack) => [...stack, JSON.stringify(map)].slice(-HISTORY_LIMIT));
      const restored = JSON.parse(from[from.length - 1]!) as CollisionMap;
      setMap(restored);
      setSelectedId(null);
      setDraftPoly(null);
      scheduleSave(restored);
    },
    [map, scheduleSave],
  );

  const undo = useCallback(() => step(past, setPast, setFuture), [past, step]);
  const redo = useCallback(() => step(future, setFuture, setPast), [future, step]);

  // ---------------------------------------------------------------- đi thử

  const [testPos, setTestPos] = useState<{ x: number; y: number } | null>(null);

  // Vòng lặp đọc bản vẽ MỚI NHẤT qua ref: nó gắn một lần cho cả phiên vẽ, còn
  // `map` thì đổi sau mỗi hình. Đọc qua closure là đi thử trên bản vẽ của lúc
  // bật chế độ vẽ — tức là thử một thứ không còn tồn tại.
  const liveMap = useRef(map);
  liveMap.current = map;

  /** Chỗ đi được gần giữa bản đồ nhất. `null` = bản vẽ kín đặc, không có chỗ nào. */
  const startSpot = useCallback(
    () =>
      nearestWalkable(
        (x, y) => canWalkAt(liveMap.current, x, y),
        WORLD.width / 2,
        WORLD.height / 2,
        WORLD,
      ),
    [],
  );

  useEffect(() => {
    if (!editing) {
      setTestPos(null);
      return;
    }
    setTestPos(startSpot());

    const held = new Set<string>();
    let frame = 0;
    let last = performance.now();

    function step(now: number) {
      frame = requestAnimationFrame(step);
      const seconds = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (held.size === 0) return;

      let dx = 0;
      let dy = 0;
      for (const key of held) {
        const dir = WALK_KEYS[key];
        if (dir) {
          dx += dir[0];
          dy += dir[1];
        }
      }
      if (dx === 0 && dy === 0) return;
      // Chuẩn hoá: giữ hai phím một lúc mà không chia cho độ dài thì đi chéo
      // nhanh hơn đi thẳng 1,41 lần, và khe hẹp nào cũng lọt.
      const length = Math.hypot(dx, dy);
      const distance = HERO_SPEED * seconds;
      const stepX = (dx / length) * distance;
      const stepY = (dy / length) * distance;

      setTestPos((at) => {
        if (!at) return at;
        const walkable = (x: number, y: number) => canWalkAt(liveMap.current, x, y);

        // Đang đứng ngoài vùng đi được — thường là vừa vẽ một hình cấm đè lên
        // chỗ nó đứng. Kéo về chỗ gần nhất thay vì để nó kẹt cứng, y như cảnh
        // chơi làm khi người chơi vào màn ở một chỗ không còn hợp lệ.
        if (!walkable(at.x, at.y)) return startSpot() ?? at;

        const nx = at.x + stepX;
        const ny = at.y + stepY;
        // Thử cả hai trục, rồi từng trục một — ĐÚNG thứ tự của `StageScene`.
        // Đó là thứ cho phép trượt dọc tường thay vì dính chặt vào nó.
        if (walkable(nx, ny)) return { x: nx, y: ny };
        if (walkable(nx, at.y)) return { x: nx, y: at.y };
        if (walkable(at.x, ny)) return { x: at.x, y: ny };
        return at;
      });
    }

    function onDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const key = event.key.toLowerCase();
      if (!(key in WALK_KEYS)) return;
      // Mũi tên cuộn trang. Người dựng đang nhìn nhân vật lách qua một khe thì
      // cả khung soạn trôi khỏi màn hình là hỏng hẳn phép thử.
      event.preventDefault();
      held.add(key);
    }

    function onUp(event: KeyboardEvent) {
      held.delete(event.key.toLowerCase());
    }

    // Rời khỏi cửa sổ là NHẢ HẾT. Không có nó thì Alt+Tab lúc đang giữ phím sẽ
    // để nhân vật đi mãi một hướng, và không phím nào dừng được nó lại.
    const release = () => held.clear();

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', release);
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', release);
    };
  }, [editing, startSpot]);

  const selected = map.shapes.find((s) => s.id === selectedId) ?? null;

  /** Đưa hình đang chọn tới chỗ khác trong danh sách. Thứ tự = luật thắng thua. */
  function reorder(delta: number) {
    if (!selected) return;
    const from = map.shapes.indexOf(selected);
    const to = Math.max(0, Math.min(map.shapes.length - 1, from + delta));
    if (to === from) return;
    const shapes = [...map.shapes];
    shapes.splice(to, 0, ...shapes.splice(from, 1));
    commit(shapes);
  }

  return {
    editing,
    setEditing(on) {
      setEditingState(on);
      setSelectedId(null);
      setDraftPoly(null);
      // Lịch sử theo TỪNG PHIÊN vẽ. Giữ lại qua lần tắt/bật thì Ctrl+Z sẽ lùi
      // về một bản vẽ người dựng tưởng đã chốt xong từ nửa tiếng trước.
      if (!on) {
        setPast([]);
        setFuture([]);
      }
    },
    map,
    drawn: map.shapes.length > 0,
    tool,
    setTool(next) {
      setToolState(next);
      setDraftPoly(null);
      if (next !== 'pick') setSelectedId(null);
    },
    mode: selected ? selected.mode : nextMode,
    nextMode,
    setMode(next) {
      // Đang chọn một hình thì sửa CHÍNH NÓ, và KHÔNG đụng tới chế độ của hình
      // sắp vẽ. Cho nó dính theo nghe thì tiện, nhưng hậu quả là: vẽ xong hình
      // A, bấm "Cấm đi" cho A, rồi muốn hình B là "Đi được" — bấm vào là A bị
      // lật ngược trở lại. Muốn đổi chế độ cho hình sắp vẽ thì bấm Esc bỏ chọn
      // đã, và dòng nhãn trên công tắc luôn nói nó đang chỉ vào cái gì.
      if (selected) {
        commit(map.shapes.map((s) => (s.id === selected.id ? { ...s, mode: next } : s)));
        return;
      }
      setNextMode(next);
    },
    selectedId,
    setSelectedId,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
    clear() {
      if (map.shapes.length === 0) return;
      // "Xoá hết" CŨNG là một bước hoàn tác. Làm được vậy thì không cần hộp
      // thoại "anh chắc chưa" — Ctrl+Z chính là câu trả lời, và nó nhanh hơn
      // một cú bấm xác nhận.
      setSelectedId(null);
      setDraftPoly(null);
      push({ ...map, shapes: [] });
    },
    deleteSelected() {
      if (!selected) return;
      setSelectedId(null);
      commit(map.shapes.filter((s) => s.id !== selected.id));
    },
    raiseSelected: () => reorder(1),
    lowerSelected: () => reorder(-1),
    toggleDefault() {
      push({ ...map, default: map.default === 'walkable' ? 'blocked' : 'walkable' });
    },
    draftPoly,
    setDraftPoly,
    commit,
    test: testPos,
    testWalkable: testPos ? canWalkAt(map, testPos.x, testPos.y) : true,
    resetTest: () => setTestPos(startSpot()),
  };
}

// ==========================================================================
// Lớp vẽ
// ==========================================================================

/**
 * Màu vùng cấm và vùng cho đi — cùng bộ với chú giải ở bảng bên phải.
 *
 * Ruột tô bằng GẠCH CHÉO chứ không phải một lớp màu phẳng, và đây không phải
 * chuyện trang trí. Ảnh nền màn chơi là tranh vẽ tay, rực rỡ và kín chi tiết;
 * một lớp phủ phẳng đủ nhạt để còn nhìn thấy tranh thì cũng nhạt tới mức nhìn
 * không ra, còn đủ đậm để nhìn ra thì nuốt mất tranh. Gạch chéo thoát khỏi cái
 * bẫy đó: nó đọc rõ ở mọi nền vì mắt bắt được HOA VĂN chứ không phải sắc độ, mà
 * vẫn chừa tranh lộ ra giữa các nét.
 *
 * Hai vùng nghiêng NGƯỢC chiều nhau, nên phân biệt được cả khi in đen trắng
 * hoặc khi người dùng không phân biệt được đỏ với xanh.
 */
const PAINT = {
  block: { stroke: '#f4614c', fill: 'url(#wa-hatch-block)' },
  allow: { stroke: '#4ade80', fill: 'url(#wa-hatch-allow)' },
  /** Thứ CHƯA tồn tại: khung đang kéo, đa giác đang chấm. Màu riêng hẳn. */
  draft: { stroke: '#38bdf8', fill: 'rgba(56, 189, 248, 0.28)' },
} as const;

/** Bề rộng một ô hoa văn gạch chéo, đơn vị thế giới. */
const HATCH = 38;

function HatchDefs() {
  return (
    <defs>
      {(
        [
          ['wa-hatch-allow', '#4ade80', 45],
          ['wa-hatch-block', '#f4614c', -45],
        ] as const
      ).map(([id, color, angle]) => (
        <pattern
          key={id}
          id={id}
          width={HATCH}
          height={HATCH}
          patternUnits="userSpaceOnUse"
          patternTransform={`rotate(${angle})`}
        >
          <rect width={HATCH} height={HATCH} fill={color} fillOpacity={0.14} />
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={HATCH}
            stroke={color}
            strokeWidth={12}
            strokeOpacity={0.5}
          />
        </pattern>
      ))}
    </defs>
  );
}

/**
 * SVG phủ kín bảng thiết kế.
 *
 * Khi `editing`, nó nằm TRÊN các vật thể nhiệm vụ và ăn hết sự kiện chuột — đó
 * là cách rẻ nhất và chắc nhất để cú kéo vẽ hình không giành nhau với cú kéo
 * dời nhiệm vụ. Khi không vẽ thì `pointer-events: none`, nhưng **vẫn hiện
 * đường bao**: người dựng cần nhìn thấy nó trong lúc sắp đặt nhiệm vụ, để không
 * đặt một nhiệm vụ vào chỗ học sinh không bao giờ bước tới được.
 */
export function WalkareaOverlay({ walk }: { walk: Walkarea }) {
  const svgRef = useRef<SVGSVGElement>(null);

  // `walk` đi qua ref, và hai `useEffect` bên dưới chỉ phụ thuộc `editing`.
  // Không có nó thì cứ mỗi khung hình của một cú kéo là gỡ và gắn lại listener
  // trên `window` — sáu mươi lần một giây, cho một thứ không hề đổi.
  const live = useRef(walk);
  live.current = walk;

  /**
   * Cử chỉ đang dở. Ở ref chứ không state, vì hai lý do:
   *
   *   - kéo chuột bắn hàng chục sự kiện mỗi giây, đặt vào state là vẽ lại cả
   *     cây component từng lần;
   *   - và quan trọng hơn, **`walk.map` phải giữ nguyên trong suốt cú kéo**.
   *     Sửa nó tại chỗ thì lúc thả tay, ảnh chụp đẩy vào ngăn hoàn tác đã là
   *     bản ĐÃ DỜI — và Ctrl+Z không đưa hình về chỗ cũ được nữa.
   */
  const drag = useRef<
    | { kind: 'box'; from: [number, number]; to: [number, number] }
    | { kind: 'move'; origin: CollisionShape; from: [number, number]; to: [number, number] }
    | null
  >(null);
  /**
   * Chỗ con trỏ đang đứng, hệ toạ độ thế giới. `null` = chuột chưa vào khung.
   *
   * Chỉ dùng lúc chấm đa giác, và nó là thứ biến công cụ này từ "bấm mò" thành
   * "vẽ": không có đoạn nối từ đỉnh vừa đặt tới con trỏ thì người dựng phải bấm
   * xong mới biết cạnh đó chạy đi đâu, rồi Backspace, rồi bấm lại.
   */
  const cursor = useRef<[number, number] | null>(null);
  const [, forceDraw] = useState(0);

  /** Điểm chuột → toạ độ thế giới. Giữ Alt để rời lưới. */
  const toWorld = useCallback(
    (event: { clientX: number; clientY: number; altKey: boolean }): [number, number] => {
      const box = svgRef.current!.getBoundingClientRect();
      const x = ((event.clientX - box.left) / box.width) * WORLD.width;
      const y = ((event.clientY - box.top) / box.height) * WORLD.height;
      return [
        Math.max(0, Math.min(WORLD.width, snap(x, event.altKey))),
        Math.max(0, Math.min(WORLD.height, snap(y, event.altKey))),
      ];
    },
    [],
  );

  // Nghe trên `window`, không trên SVG: kéo nhanh là con trỏ ra ngoài khung
  // trước khi thả tay, và nghe trên khung thì cú kéo kẹt lại giữa đường mà
  // không có sự kiện nào báo là đã xong.
  useEffect(() => {
    if (!walk.editing) return;

    function onMove(event: PointerEvent) {
      if (!svgRef.current) return;
      if (drag.current) {
        drag.current.to = toWorld(event);
        forceDraw((n) => n + 1);
        return;
      }
      // Không kéo gì, nhưng đang chấm dở một đa giác: đoạn dây thun phải bám
      // con trỏ. Ngoài lúc đó thì bỏ qua hẳn — `pointermove` bắn hàng chục lần
      // mỗi giây, và vẽ lại cả cây component cho một thứ không ai nhìn là phí.
      if (!live.current.draftPoly) return;
      cursor.current = toWorld(event);
      forceDraw((n) => n + 1);
    }

    function onUp() {
      const current = drag.current;
      drag.current = null;
      if (!current) return;
      forceDraw((n) => n + 1);

      const now = live.current;
      const [x0, y0] = current.from;
      const [x1, y1] = current.to;

      if (current.kind === 'move') {
        if (x1 === x0 && y1 === y0) return;
        const moved = moveShape(current.origin, x1 - x0, y1 - y0);
        now.commit(now.map.shapes.map((s) => (s.id === moved.id ? moved : s)));
        return;
      }

      const w = Math.abs(x1 - x0);
      const h = Math.abs(y1 - y0);
      // Cú bấm hụt không được đẻ ra một hình bằng hạt bụi mà người dựng không
      // nhìn thấy, không bấm trúng, và không hiểu vì sao nhân vật kẹt ở đó.
      if (w < MIN_SIZE || h < MIN_SIZE) return;
      const id = nextShapeId();
      now.commit([
        ...now.map.shapes,
        {
          id,
          mode: now.nextMode,
          kind: now.tool === 'ellipse' ? 'ellipse' : 'rect',
          x: Math.min(x0, x1),
          y: Math.min(y0, y1),
          w,
          h,
        },
      ]);
      // CHỌN LUÔN hình vừa vẽ. Hai việc cùng lúc: viền trắng nói "cái này là
      // cái anh vừa tạo ra" — cần thiết khi hình mới nằm lọt trong một hình cũ
      // và nhìn thì y hệt — và công tắc Đi được/Cấm đi lập tức chỉ vào nó, nên
      // cú bấm tiếp theo có tác dụng thấy được.
      now.setSelectedId(id);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [walk.editing, toWorld]);

  // Phím tắt — chỉ khi đang vẽ, và không cướp phím của ô nhập nào đang gõ.
  useEffect(() => {
    if (!walk.editing) return;

    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const now = live.current;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) now.redo();
        // Đang chấm dở thì Ctrl+Z huỷ NGUYÊN hình đang vẽ, không nhằn từng đỉnh
        // — nhằn từng đỉnh là việc của Backspace.
        else if (now.draftPoly) now.setDraftPoly(null);
        else now.undo();
        return;
      }
      if (event.key === 'Escape') {
        if (now.draftPoly) now.setDraftPoly(null);
        else now.setSelectedId(null);
        return;
      }
      if (event.key === 'Backspace' && now.draftPoly) {
        event.preventDefault();
        const left = now.draftPoly.slice(0, -1);
        now.setDraftPoly(left.length ? left : null);
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && now.selectedId) {
        event.preventDefault();
        now.deleteSelected();
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [walk.editing]);

  function onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (!walk.editing) return;
    const point = toWorld(event);

    if (walk.tool === 'poly') {
      const points = walk.draftPoly;
      cursor.current = point;
      if (!points) {
        walk.setDraftPoly([point]);
        return;
      }
      // Về lại đỉnh đầu = khép hình. Ba đỉnh là tối thiểu — hai đỉnh chỉ là một
      // đoạn thẳng, và một đoạn thẳng không có "bên trong".
      const first = points[0]!;
      if (
        points.length >= 3 &&
        Math.hypot(point[0] - first[0], point[1] - first[1]) <= CLOSE_RADIUS
      ) {
        const id = nextShapeId();
        walk.setDraftPoly(null);
        walk.commit([...walk.map.shapes, { id, mode: walk.nextMode, kind: 'poly', points }]);
        walk.setSelectedId(id);
        return;
      }
      walk.setDraftPoly([...points, point]);
      return;
    }

    if (walk.tool === 'pick') {
      // Duyệt NGƯỢC: hình vẽ sau nằm trên, nên nó phải là hình bấm trúng.
      const hit = [...walk.map.shapes].reverse().find((s) => hitTest(s, point));
      walk.setSelectedId(hit?.id ?? null);
      if (hit) drag.current = { kind: 'move', origin: hit, from: point, to: point };
      return;
    }

    // Bỏ chọn NGAY khi bắt đầu vẽ hình mới. Không có nó thì trong lúc kéo, công
    // tắc Đi được/Cấm đi vẫn đang chỉ vào hình cũ — và cú bấm tiếp theo sửa
    // nhầm hình.
    walk.setSelectedId(null);
    drag.current = { kind: 'box', from: point, to: point };
  }

  const gesture = drag.current;
  const box = gesture?.kind === 'box' ? gesture : null;
  // Hình đang dời vẽ ở chỗ MỚI, còn `walk.map` thì chưa đổi — bản xem trước
  // sống đúng bằng cú kéo, và ngăn hoàn tác vẫn giữ chỗ cũ.
  const moving =
    gesture?.kind === 'move'
      ? moveShape(gesture.origin, gesture.to[0] - gesture.from[0], gesture.to[1] - gesture.from[1])
      : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WORLD.width} ${WORLD.height}`}
      className={`absolute inset-0 size-full ${
        walk.editing ? 'cursor-crosshair touch-none' : 'pointer-events-none'
      }`}
      onPointerDown={onPointerDown}
      aria-hidden={!walk.editing}
    >
      <HatchDefs />

      {/* Ngoài mọi hình là CẤM: tô cả bản đồ để người dựng nhìn ra ngay,
          thay vì phải suy từ một cái công tắc ở bảng bên. Chỉ tô khi đã vẽ ít
          nhất một hình — danh sách rỗng thì cả bản đồ đi được, bất kể công tắc. */}
      {walk.editing && walk.drawn && walk.map.default === 'blocked' && (
        <rect
          x={0}
          y={0}
          width={WORLD.width}
          height={WORLD.height}
          fill={PAINT.block.fill}
          pointerEvents="none"
        />
      )}

      {walk.map.shapes.map((shape) => (
        <ShapePath
          key={shape.id}
          shape={moving && moving.id === shape.id ? moving : shape}
          selected={shape.id === walk.selectedId}
          outlineOnly={!walk.editing}
        />
      ))}

      {box && (
        <rect
          x={Math.min(box.from[0], box.to[0])}
          y={Math.min(box.from[1], box.to[1])}
          width={Math.abs(box.to[0] - box.from[0])}
          height={Math.abs(box.to[1] - box.from[1])}
          fill={PAINT[walk.nextMode].fill}
          stroke={PAINT.draft.stroke}
          strokeWidth={LINE.draft}
          strokeDasharray="18 12"
          pointerEvents="none"
        />
      )}

      {walk.draftPoly && <DraftPolygon points={walk.draftPoly} cursor={cursor.current} />}

      {/* ĐIỂM VA CHẠM của nhân vật đi thử — không phải tâm tấm ảnh.
          Trong cảnh chơi, `canWalk()` xét đúng một điểm này, nằm cao hơn gót
          chân `HERO_FOOT_Y`. Không vẽ nó ra thì người dựng căn tường theo giữa
          người nhân vật và lệch đi gần nửa chiều cao của nó. */}
      {walk.test && (
        <g pointerEvents="none">
          <circle
            cx={walk.test.x}
            cy={walk.test.y}
            r={26}
            fill="none"
            stroke={walk.testWalkable ? PAINT.allow.stroke : PAINT.block.stroke}
            strokeWidth={LINE.rubber}
          />
          <circle
            cx={walk.test.x}
            cy={walk.test.y}
            r={8}
            fill={walk.testWalkable ? PAINT.allow.stroke : PAINT.block.stroke}
          />
        </g>
      )}
    </svg>
  );
}

/**
 * Đa giác ĐANG CHẤM: các đỉnh đã đặt, đoạn dây thun theo con trỏ, và đoạn khép.
 *
 * Ba nét, mỗi nét nói một chuyện khác nhau, nên chúng KHÔNG cùng một kiểu vẽ:
 *
 *   - các cạnh ĐÃ CHỐT — nét gạch dày, chắc chắn;
 *   - đoạn từ đỉnh cuối tới CON TRỎ — nét liền mảnh, thứ đang theo tay;
 *   - đoạn từ con trỏ về ĐỈNH ĐẦU — nét chấm mờ, cái hình SẼ ra nếu khép ngay
 *     bây giờ. Không có nó thì một đa giác 6 đỉnh chỉ hiện ra hình thù thật của
 *     nó sau khi đã khép, tức là sau khi đã muộn.
 */
function DraftPolygon({
  points,
  cursor,
}: {
  points: [number, number][];
  cursor: [number, number] | null;
}) {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  // Con trỏ đã vào tầm nam châm: đỉnh đầu phình ra, và đoạn khép hiện rõ hẳn.
  // Đây là lời mời bấm, và nó phải đọc được bằng đuôi mắt.
  const closing =
    cursor !== null &&
    points.length >= 3 &&
    Math.hypot(cursor[0] - first[0], cursor[1] - first[1]) <= CLOSE_RADIUS;

  return (
    <g pointerEvents="none">
      {points.length > 1 && (
        <polyline
          points={points.map((p) => p.join(',')).join(' ')}
          fill="none"
          stroke={PAINT.draft.stroke}
          strokeWidth={LINE.draft}
          strokeDasharray="18 12"
        />
      )}

      {cursor && (
        <>
          {/* Đoạn khép vẽ TRƯỚC đoạn dây thun, để chỗ hai nét gặp nhau thì nét
              đang theo tay nằm trên. */}
          {points.length >= 2 && (
            <line
              x1={cursor[0]}
              y1={cursor[1]}
              x2={first[0]}
              y2={first[1]}
              stroke={PAINT.draft.stroke}
              strokeWidth={closing ? LINE.closingNear : LINE.closing}
              strokeDasharray="6 14"
              strokeOpacity={closing ? 0.95 : 0.4}
            />
          )}
          <line
            x1={last[0]}
            y1={last[1]}
            x2={cursor[0]}
            y2={cursor[1]}
            stroke={PAINT.draft.stroke}
            strokeWidth={LINE.rubber}
          />
          <circle cx={cursor[0]} cy={cursor[1]} r={12} fill={PAINT.draft.stroke} />
        </>
      )}

      {points.map(([x, y], index) => (
        <circle
          key={index}
          cx={x}
          cy={y}
          // Đỉnh ĐẦU to hơn hẳn: nó là cái nam châm, và người dựng phải nhìn ra
          // chỗ cần quay về để khép hình mà không cần ai dặn.
          r={index === 0 ? (closing ? 34 : 26) : 14}
          fill={index === 0 ? PAINT.draft.stroke : '#0b1a24'}
          stroke={PAINT.draft.stroke}
          strokeWidth={LINE.rubber}
        />
      ))}
    </g>
  );
}

/** Bấm có trúng hình này không. Cùng luật với `shapeContains()`, chạy ở DOM. */
function hitTest(shape: CollisionShape, [x, y]: [number, number]): boolean {
  if (shape.kind === 'poly') {
    const points = shape.points ?? [];
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const xi = points[i]![0];
      const yi = points[i]![1];
      const xj = points[j]![0];
      const yj = points[j]![1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  const { x: left, y: top, w, h } = shapeBounds(shape);
  if (shape.kind === 'rect') return x >= left && x <= left + w && y >= top && y <= top + h;
  const dx = (x - (left + w / 2)) / (w / 2);
  const dy = (y - (top + h / 2)) / (h / 2);
  return dx * dx + dy * dy <= 1;
}

function ShapePath({
  shape,
  selected,
  outlineOnly,
}: {
  shape: CollisionShape;
  selected: boolean;
  /**
   * Ngoài chế độ vẽ thì chỉ còn ĐƯỜNG BAO, không tô ruột: ảnh nền mới là thứ
   * người dựng đang căn nhiệm vụ lên trên, và một lớp màu phủ kín nó thì vẽ
   * xong là không sắp đặt được gì nữa.
   */
  outlineOnly: boolean;
}) {
  const paint = PAINT[shape.mode];
  const common = {
    fill: paint.fill,
    stroke: selected ? '#ffffff' : paint.stroke,
    strokeWidth: selected ? LINE.edgeSelected : LINE.edge,
    strokeDasharray: selected ? '24 14' : undefined,
    fillOpacity: outlineOnly ? 0 : 1,
    strokeOpacity: outlineOnly ? 0.55 : 1,
    pointerEvents: 'none' as const,
  };

  if (shape.kind === 'poly') {
    return <polygon points={(shape.points ?? []).map((p) => p.join(',')).join(' ')} {...common} />;
  }
  const { x, y, w, h } = shapeBounds(shape);
  if (shape.kind === 'ellipse') {
    return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...common} />;
  }
  return <rect x={x} y={y} width={w} height={h} {...common} />;
}

// ==========================================================================
// Bảng điều khiển
// ==========================================================================

const TOOLS: { key: WalkTool; icon: string }[] = [
  { key: 'rect', icon: '▭' },
  { key: 'ellipse', icon: '◯' },
  { key: 'poly', icon: '⬠' },
  { key: 'pick', icon: '↖' },
];

export function WalkareaPanel({ walk }: { walk: Walkarea }) {
  const t = useTranslations('designer.walkarea');
  const selected = walk.map.shapes.find((s) => s.id === walk.selectedId) ?? null;

  // Có hình "cho đi" mà ngoài mọi hình VẪN đi được thì hình đó không làm gì cả.
  // Đây là cách hiểu sai phổ biến nhất của mô hình này, và nó im lặng: người
  // dựng vẽ xong, vào thử, thấy đi được khắp nơi, và không biết trách ai.
  const uselessAllow =
    walk.map.default === 'walkable' && walk.map.shapes.some((s) => s.mode === 'allow');

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <SectionTitle>{t('title')}</SectionTitle>
        <Button
          variant={walk.editing ? 'primary' : 'secondary'}
          size="sm"
          aria-pressed={walk.editing}
          onClick={() => walk.setEditing(!walk.editing)}
        >
          {walk.editing ? t('close') : t('open')}
        </Button>
      </div>

      {!walk.editing ? (
        <p className="text-xs text-slate-500">
          {walk.drawn ? t('summary', { count: walk.map.shapes.length }) : t('empty')}
        </p>
      ) : (
        <div className="space-y-3">
          {/* ---------------- công cụ ---------------- */}
          <div>
            <p className="mb-1.5 text-xs text-slate-500">{t('tool')}</p>
            <div className="grid grid-cols-4 gap-1">
              {TOOLS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={walk.tool === item.key}
                  onClick={() => walk.setTool(item.key)}
                  className={`rounded-lg border px-1 py-2 transition ${
                    walk.tool === item.key
                      ? 'border-lagoon-400 bg-lagoon-500/20 text-lagoon-300'
                      : 'border-abyss-700 text-slate-400 hover:border-abyss-600 hover:text-slate-200'
                  }`}
                >
                  <span aria-hidden className="block text-base leading-none">
                    {item.icon}
                  </span>
                  <span className="mt-1 block text-[10px] leading-tight">
                    {t(`tools.${item.key}`)}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
              {t(`hints.${walk.tool}`)}
            </p>
          </div>

          {/* ---------------- chế độ: MỘT công tắc ---------------- */}
          <div>
            <p className="mb-1.5 text-xs text-slate-500">
              {selected
                ? t('modeOfSelected', { kind: t(`kinds.${selected.kind}`) })
                : t('modeOfNext')}
            </p>
            <div className="grid grid-cols-2 gap-1">
              {(['allow', 'block'] as ShapeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={walk.mode === mode}
                  onClick={() => walk.setMode(mode)}
                  className={`rounded-lg border px-2 py-1.5 text-xs transition ${
                    walk.mode === mode
                      ? mode === 'allow'
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                        : 'border-coral-500 bg-coral-500/20 text-coral-400'
                      : 'border-abyss-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t(`mode.${mode}`)}
                </button>
              ))}
            </div>
            {selected && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Button variant="secondary" size="sm" onClick={walk.raiseSelected}>
                  ↑ {t('raise')}
                </Button>
                <Button variant="secondary" size="sm" onClick={walk.lowerSelected}>
                  ↓ {t('lower')}
                </Button>
                <Button variant="danger" size="sm" onClick={walk.deleteSelected}>
                  {t('remove')}
                </Button>
              </div>
            )}
          </div>

          {/* ---------------- danh sách hình ----------------

              Thứ tự là MỘT NỬA của mô hình này, mà trước đây nó không hiện ở
              đâu cả: người dựng vẽ hai hình chồng nhau rồi phải tự đoán cái nào
              đang nằm trên. Danh sách xếp TRÊN CÙNG TRƯỚC, đúng nếp mọi bảng
              lớp, nên "hình trên cùng thắng" đọc thẳng ra khỏi màn hình. */}
          {walk.drawn && (
            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <p className="text-xs text-slate-500">
                  {t('shapes', { count: walk.map.shapes.length })}
                </p>
                <p className="text-[11px] text-slate-600">{t('topWins')}</p>
              </div>
              <ul className="space-y-0.5">
                {[...walk.map.shapes].reverse().map((shape, index) => (
                  <li key={shape.id}>
                    <button
                      type="button"
                      // Bấm lại chính hàng đang chọn thì BỎ CHỌN — cách nhanh
                      // nhất để công tắc quay về chỉ vào hình sắp vẽ.
                      onClick={() =>
                        walk.setSelectedId(walk.selectedId === shape.id ? null : shape.id)
                      }
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs transition ${
                        walk.selectedId === shape.id
                          ? 'bg-lagoon-500/15 text-slate-100'
                          : 'text-slate-400 hover:bg-abyss-800'
                      }`}
                    >
                      <span className="font-mono text-[10px] text-slate-600">
                        {walk.map.shapes.length - index}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{t(`kinds.${shape.kind}`)}</span>
                      <span
                        className={
                          shape.mode === 'allow' ? 'text-emerald-400' : 'text-coral-400'
                        }
                      >
                        {t(`mode.${shape.mode}`)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="rounded-lg border border-abyss-700 bg-abyss-900/60 p-2.5 text-[11px] leading-snug text-slate-400">
            {t('recipe')}
          </p>

          {/* ---------------- đi thử ---------------- */}
          <div className="rounded-lg border border-lagoon-500/40 bg-lagoon-500/5 p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-xs text-slate-300">{t('test')}</p>
              <Button variant="secondary" size="sm" onClick={walk.resetTest}>
                {t('testReset')}
              </Button>
            </div>
            <p className="text-[11px] leading-snug text-slate-500">{t('testHint')}</p>
            {walk.test && !walk.testWalkable && (
              <p className="mt-1.5 text-[11px] leading-snug text-coral-400">⚠ {t('testStuck')}</p>
            )}
            {!walk.test && walk.drawn && (
              <p className="mt-1.5 text-[11px] leading-snug text-orichalcum-400">
                ⚠ {t('testNoRoom')}
              </p>
            )}
          </div>

          {/* ---------------- hoàn tác ---------------- */}
          <div className="flex flex-wrap gap-1.5">
            <Button variant="secondary" size="sm" disabled={!walk.canUndo} onClick={walk.undo}>
              ↶ {t('undo')}
            </Button>
            <Button variant="secondary" size="sm" disabled={!walk.canRedo} onClick={walk.redo}>
              ↷ {t('redo')}
            </Button>
            <Button variant="danger" size="sm" disabled={!walk.drawn} onClick={walk.clear}>
              {t('clear')}
            </Button>
          </div>

          {/* ---------------- ngoài mọi hình ---------------- */}
          <div className="rounded-lg border border-abyss-700 p-2.5">
            <p className="mb-1.5 text-xs text-slate-400">{t('outside')}</p>
            <button
              type="button"
              onClick={walk.toggleDefault}
              className={`w-full rounded-lg border px-2 py-1.5 text-xs transition ${
                walk.map.default === 'blocked'
                  ? 'border-coral-500 bg-coral-500/20 text-coral-400'
                  : 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {t(`mode.${walk.map.default === 'blocked' ? 'block' : 'allow'}`)}
            </button>
            {uselessAllow && (
              <p className="mt-2 text-[11px] leading-snug text-orichalcum-400">⚠ {t('warnAllow')}</p>
            )}
          </div>

          <p className="text-[11px] leading-snug text-slate-500">{t('keys')}</p>
        </div>
      )}
    </Card>
  );
}

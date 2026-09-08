/**
 * VÙNG ĐI ĐƯỢC — bản mô tả chính của bản đồ va chạm.
 *
 * File này KHÔNG import Phaser, cùng lý do với `world.ts`: trình thiết kế cần
 * đúng những phép kiểm này để vẽ đường bao và tô vùng cấm, nhưng nó là DOM chứ
 * không phải một cảnh game.
 *
 * Và quan trọng hơn: **giáo viên nhìn thấy đúng thứ học sinh sẽ đi lên.** Hai
 * bản sao của cùng một phép "điểm này có nằm trong hình không" sẽ lệch nhau
 * đúng vào lúc không ai kịp nhận ra, và triệu chứng là một bức tường vô hình
 * chỉ tồn tại trong lúc chơi.
 *
 * ## Luật
 *
 * Một bản đồ gồm `default` — ngoài MỌI hình thì đi được hay không — và một danh
 * sách hình, mỗi hình mang `mode`: `allow` (bên trong đi được) hoặc `block`
 * (bên trong cấm).
 *
 * **Hình khớp CUỐI CÙNG thắng.** `shapes[0]` nằm dưới cùng. Một câu, và nhờ nó
 * mà ghép được các vùng lồng nhau mà không cần phép toán tập hợp nào:
 *
 *     lối đi vòng quanh một cái hồ
 *       = một oval `allow` rộng          (cả khu vườn đi được)
 *       + một oval `block` nhỏ đè lên    (trừ cái hồ ở giữa)
 *
 * Thêm một tầng nữa — hòn đảo giữa hồ — chỉ là xếp thêm một hình `allow` lên
 * trên. Không có trần số tầng.
 */

/** Loại hình. `rect` và `ellipse` mô tả bằng KHUNG BAO, `poly` bằng danh sách đỉnh. */
export type ShapeKind = 'rect' | 'ellipse' | 'poly';

/** `allow` = bên trong hình đi được. `block` = bên trong hình cấm. */
export type ShapeMode = 'allow' | 'block';

export interface CollisionShape {
  id: string;
  mode: ShapeMode;
  kind: ShapeKind;
  /**
   * Khung bao của `rect` và `ellipse`. `x`/`y` là mép TRÊN-TRÁI, không phải tâm.
   *
   * Khác với nhiệm vụ (lưu tâm) là có chủ ý: một cú kéo chuột sinh ra hai góc,
   * và quy về tâm rồi lại quy ngược lại lúc vẽ là hai phép đổi để sai.
   */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  /** Đỉnh của `poly`, hệ toạ độ thế giới. Tối thiểu 3. */
  points?: [number, number][];
}

export interface CollisionMap {
  version: 1;
  /** Ngoài MỌI hình thì đi được hay không. */
  default: 'walkable' | 'blocked';
  shapes: CollisionShape[];
}

/**
 * Bản đồ của một màn VỪA BẮT ĐẦU vẽ.
 *
 * `blocked` chứ không phải `walkable`, và đó là mặc định đúng: người dựng bật
 * chế độ vẽ lên là để khoanh **chỗ đi được**, nên hình đầu tiên họ vẽ phải có
 * tác dụng ngay. Để `walkable` thì hình `allow` đầu tiên chẳng thay đổi gì cả
 * và công cụ trông như hỏng.
 *
 * Ai muốn ngược lại — cả bản đồ đi được, chỉ khoét vài vật cản — thì bật công
 * tắc "ngoài mọi hình" một lần. Một cú bấm, và nó nhìn thấy được.
 */
export const EMPTY_COLLISION: CollisionMap = { version: 1, default: 'blocked', shapes: [] };

/**
 * Lưới BẮT ĐIỂM khi vẽ, tính bằng đơn vị thế giới.
 *
 * Không bắt lưới thì hai hình cạnh nhau hở một khe 3 đơn vị, và nhân vật kẹt
 * vào cái khe đó — lỗi khó chịu nhất và khó tìm nhất của cả thể loại này. Giữ
 * Alt lúc vẽ để rời lưới khi thật sự cần đặt đúng một điểm lẻ.
 */
export const SNAP_STEP = 20;

/** Làm tròn về lưới. `free` = đang giữ Alt. */
export function snap(value: number, free = false): number {
  return free ? Math.round(value) : Math.round(value / SNAP_STEP) * SNAP_STEP;
}

/** Điểm `(x, y)` có nằm trong hình này không. */
export function shapeContains(shape: CollisionShape, x: number, y: number): boolean {
  if (shape.kind === 'poly') {
    const points = shape.points;
    if (!points || points.length < 3) return false;
    return pointInPolygon(points, x, y);
  }

  const { x: left = 0, y: top = 0, w = 0, h = 0 } = shape;
  if (w <= 0 || h <= 0) return false;

  if (shape.kind === 'rect') {
    return x >= left && x <= left + w && y >= top && y <= top + h;
  }

  // Ellipse: chuẩn hoá về đường tròn đơn vị rồi so bình phương bán kính. Không
  // khai căn — phép so sánh không cần tới nó, mà `Math.sqrt` thì chạy cho MỖI
  // hình ở MỖI bước chân.
  const rx = w / 2;
  const ry = h / 2;
  const dx = (x - (left + rx)) / rx;
  const dy = (y - (top + ry)) / ry;
  return dx * dx + dy * dy <= 1;
}

/**
 * Luật chẵn-lẻ (ray casting). Đa giác LÕM cũng đúng, và đó là điều kiện bắt
 * buộc — người dựng khoanh một hành lang hình chữ L là chuyện thường ngày.
 */
function pointInPolygon(points: [number, number][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    // Chỉ số thẳng, không rã mảng: `noUncheckedIndexedAccess` bắt mọi phép đọc
    // theo chỉ số là `| undefined`, mà vòng lặp này đã tự bảo đảm i và j nằm
    // trong mảng.
    const xi = points[i]![0];
    const yi = points[i]![1];
    const xj = points[j]![0];
    const yj = points[j]![1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Điểm `(x, y)` có đi được không.
 *
 * `null` hoặc **danh sách hình rỗng** = đi được khắp nơi. Cái vế thứ hai là một
 * cái chốt an toàn, không phải một trường hợp biên: bật chế độ vẽ, đổi công tắc
 * "ngoài mọi hình" sang `cấm`, rồi chưa kịp vẽ gì — không có luật này thì nhân
 * vật bị nhốt cứng tại chỗ, và người dựng không có cách nào đoán ra vì sao.
 */
export function canWalkAt(map: CollisionMap | null | undefined, x: number, y: number): boolean {
  if (!map || map.shapes.length === 0) return true;

  let walkable = map.default === 'walkable';
  // Duyệt XUÔI, ghi đè dần: hình khớp cuối cùng thắng. Duyệt ngược rồi thoát
  // sớm cũng ra cùng kết quả và nhanh hơn, nhưng đọc lên thì không còn thấy cái
  // luật một câu — mà cái luật đó là thứ phải giải thích được cho giáo viên.
  for (const shape of map.shapes) {
    if (shapeContains(shape, x, y)) walkable = shape.mode === 'allow';
  }
  return walkable;
}

/**
 * Khung bao của một hình. Dùng để vẽ tay cầm và để bấm trúng.
 *
 * Đa giác thì tính từ các đỉnh; hộp và oval thì đã là khung bao sẵn.
 */
export function shapeBounds(shape: CollisionShape): { x: number; y: number; w: number; h: number } {
  if (shape.kind === 'poly' && shape.points?.length) {
    const xs = shape.points.map((p) => p[0]);
    const ys = shape.points.map((p) => p[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  return { x: shape.x ?? 0, y: shape.y ?? 0, w: shape.w ?? 0, h: shape.h ?? 0 };
}

/** Dời một hình đi `(dx, dy)`. Trả về hình MỚI — không sửa tại chỗ. */
export function moveShape(shape: CollisionShape, dx: number, dy: number): CollisionShape {
  if (shape.kind === 'poly' && shape.points) {
    return { ...shape, points: shape.points.map(([x, y]) => [x + dx, y + dy] as [number, number]) };
  }
  return { ...shape, x: (shape.x ?? 0) + dx, y: (shape.y ?? 0) + dy };
}

/**
 * Chỗ đi được GẦN `(x, y)` nhất. Trả lại chính nó nếu đã đi được.
 *
 * Nhận một PHÉP THỬ chứ không nhận bản đồ: cảnh chơi còn cộng thêm cái lề quanh
 * mép khi chưa ai vẽ gì, còn trình thiết kế thì chỉ có bản vẽ. Hai chỗ gọi, một
 * cách quét — nếu mỗi bên tự quét thì "chỗ gần nhất" sẽ khác nhau, và người
 * dựng đặt nhân vật thử ở một chỗ rồi học sinh vào chơi thấy nó ở chỗ khác.
 *
 * Quét lưới thô rồi lấy điểm gần nhất, chứ không giải hình học: vùng đi được là
 * hợp/hiệu của bao nhiêu hình tuỳ ý, có thể lõm, có thể rời thành nhiều mảnh —
 * "điểm gần nhất trên biên" của một thứ như thế không có công thức. Lưới 64 đơn
 * vị trên khung 3200×1800 là 50×28 = 1400 phép thử, chạy đúng một lần ở đường
 * cứu hộ.
 *
 * `null` = không có lấy MỘT ô nào đi được. Chỗ gọi tự quyết định làm gì; trả về
 * một chỗ bịa thì tệ hơn, vì nó quăng người chơi sang một góc bản đồ mà không
 * ai hiểu vì sao.
 */
export function nearestWalkable(
  walkable: (x: number, y: number) => boolean,
  x: number,
  y: number,
  bounds: { width: number; height: number },
  step = 64,
): { x: number; y: number } | null {
  if (walkable(x, y)) return { x, y };

  let best: { x: number; y: number } | null = null;
  let bestDistance = Infinity;

  for (let py = step / 2; py < bounds.height; py += step) {
    for (let px = step / 2; px < bounds.width; px += step) {
      if (!walkable(px, py)) continue;
      const distance = (px - x) ** 2 + (py - y) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { x: px, y: py };
      }
    }
  }
  return best;
}

/**
 * Đọc bản đồ từ server, gạn bỏ thứ không hiểu được.
 *
 * Cột trong database là JSONB tự do và đề bài đóng băng thì lưu lại nguyên văn
 * cái đã lưu từ trước, nên một bản vẽ của phiên bản cũ vẫn có thể chui tới đây.
 * Gạn ở MỘT chỗ, ngay cửa vào, thay vì để mỗi phép vẽ tự kiểm `undefined`.
 */
export function readCollision(raw: unknown): CollisionMap | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Partial<CollisionMap>;
  if (!Array.isArray(source.shapes)) return null;

  const shapes = source.shapes.filter((shape): shape is CollisionShape => {
    if (!shape || typeof shape !== 'object') return false;
    if (shape.mode !== 'allow' && shape.mode !== 'block') return false;
    if (shape.kind === 'poly') return Array.isArray(shape.points) && shape.points.length >= 3;
    if (shape.kind === 'rect' || shape.kind === 'ellipse') {
      return typeof shape.w === 'number' && typeof shape.h === 'number' && shape.w > 0 && shape.h > 0;
    }
    return false;
  });

  return {
    version: 1,
    default: source.default === 'walkable' ? 'walkable' : 'blocked',
    shapes,
  };
}

// ==========================================================================
// Tìm đường
// ==========================================================================

/**
 * Cạnh một ô lưới tìm đường, đơn vị thế giới.
 *
 * 32 trên khung 3200×1800 là 100×56 = 5 600 ô — nướng một lần lúc vào màn, hết
 * chừng một mili giây. Thô hơn thì một lối đi hẹp có thể không có ô nào rơi vào
 * giữa nó, và con đường giáo viên vừa vẽ trở thành không tồn tại với thuật toán.
 */
export const PATH_CELL = 32;

export interface WalkGrid {
  cols: number;
  rows: number;
  cell: number;
  /** 1 = đi được. Chỉ số ô = `row * cols + col`. */
  open: Uint8Array;
}

/**
 * Rải vùng đi được lên một lưới ô vuông.
 *
 * Nhận một PHÉP THỬ chứ không nhận bản đồ, cùng lý do với `nearestWalkable()`:
 * cảnh chơi còn cộng cái lề quanh mép khi chưa ai vẽ gì.
 */
export function bakeGrid(
  walkable: (x: number, y: number) => boolean,
  bounds: { width: number; height: number },
  cell = PATH_CELL,
): WalkGrid {
  const cols = Math.max(1, Math.floor(bounds.width / cell));
  const rows = Math.max(1, Math.floor(bounds.height / cell));
  const open = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      open[r * cols + c] = walkable((c + 0.5) * cell, (r + 0.5) * cell) ? 1 : 0;
    }
  }
  return { cols, rows, cell, open };
}

/** Đoạn thẳng `a → b` có nằm trọn trong vùng đi được không. */
export function segmentClear(
  walkable: (x: number, y: number) => boolean,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  const distance = Math.hypot(bx - ax, by - ay);
  // Bước dò 8 đơn vị: đủ mịn để không nhảy qua một mũi tường hẹp.
  const steps = Math.max(2, Math.ceil(distance / 8));
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    if (!walkable(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}

/** Đống nhị phân tối thiểu, đủ cho A*. Kéo một thư viện về cho việc này là thừa. */
class MinHeap {
  private keys: number[] = [];
  private items: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(key: number, item: number): void {
    this.keys.push(key);
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent]! <= this.keys[i]!) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.items[0]!;
    const lastKey = this.keys.pop()!;
    const lastItem = this.items.pop()!;
    if (this.items.length > 0) {
      this.keys[0] = lastKey;
      this.items[0] = lastItem;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let small = i;
        if (left < this.items.length && this.keys[left]! < this.keys[small]!) small = left;
        if (right < this.items.length && this.keys[right]! < this.keys[small]!) small = right;
        if (small === i) break;
        this.swap(i, small);
        i = small;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    const key = this.keys[a]!;
    this.keys[a] = this.keys[b]!;
    this.keys[b] = key;
    const item = this.items[a]!;
    this.items[a] = this.items[b]!;
    this.items[b] = item;
  }
}

/** Ô đi được gần `(x, y)` nhất. `-1` = cả lưới không có ô nào đi được. */
function nearestOpenCell(grid: WalkGrid, x: number, y: number): number {
  const col = Math.min(grid.cols - 1, Math.max(0, Math.floor(x / grid.cell)));
  const row = Math.min(grid.rows - 1, Math.max(0, Math.floor(y / grid.cell)));
  if (grid.open[row * grid.cols + col]) return row * grid.cols + col;

  let best = -1;
  let bestDistance = Infinity;
  for (let r = 0; r < grid.rows; r += 1) {
    for (let c = 0; c < grid.cols; c += 1) {
      if (!grid.open[r * grid.cols + c]) continue;
      const distance = (c - col) ** 2 + (r - row) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = r * grid.cols + c;
      }
    }
  }
  return best;
}

/** Tám hướng đi, kèm giá: đi chéo tốn √2. */
const STEPS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * Đường đi từ `from` tới `to`, VÒNG QUA vật cản. `null` = không có đường nào.
 *
 * Vì sao phải có nó: bấm chuột trước đây tween một đường THẲNG tới đích, và
 * phép kiểm duy nhất là "đích có đi được không". Với một vùng đi lại LỒI — cái
 * hình chữ nhật ngày xưa — đoạn thẳng nối hai điểm bên trong thì cũng nằm
 * trong, nên phép kiểm đó đủ. Ngay khi giáo viên khoét một cái hồ ở giữa, nó
 * sai: hai bờ đều đi được, và nhân vật đi thẳng xuyên qua mặt hồ.
 *
 * Ba bước:
 *
 *   1. **Thử đường thẳng trước.** Phần lớn cú bấm không vướng gì, và một phép
 *      dò dọc đoạn thẳng thì rẻ hơn A* vài chục lần.
 *   2. **A* trên lưới đã nướng**, tám hướng, cấm cắt góc — không có luật cấm đó
 *      thì nhân vật lách chéo qua khe giữa hai góc tường chạm nhau.
 *   3. **Kéo dây**: bỏ mọi điểm giữa mà đoạn thẳng nối qua nó vẫn thông. Không
 *      có bước này thì đường đi là một cầu thang răng cưa bám theo mắt lưới, và
 *      nhân vật đi zíc zắc trên một mặt sàn trống trơn.
 */
export function findPath(
  grid: WalkGrid,
  walkable: (x: number, y: number) => boolean,
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number }[] | null {
  if (segmentClear(walkable, from.x, from.y, to.x, to.y)) return [to];

  const start = nearestOpenCell(grid, from.x, from.y);
  const goal = nearestOpenCell(grid, to.x, to.y);
  if (start < 0 || goal < 0) return null;

  const { cols, rows, cell, open } = grid;
  const total = cols * rows;
  const cameFrom = new Int32Array(total).fill(-1);
  const cost = new Float64Array(total).fill(Infinity);
  const done = new Uint8Array(total);
  const goalCol = goal % cols;
  const goalRow = (goal / cols) | 0;

  // Octile: giá thật của đường ngắn nhất trên lưới tám hướng khi không có vật
  // cản. Không bao giờ ước lượng quá tay, nên A* vẫn cho ra đường ngắn nhất.
  const heuristic = (index: number) => {
    const dx = Math.abs((index % cols) - goalCol);
    const dy = Math.abs(((index / cols) | 0) - goalRow);
    return Math.abs(dx - dy) + Math.SQRT2 * Math.min(dx, dy);
  };

  const queue = new MinHeap();
  cost[start] = 0;
  queue.push(heuristic(start), start);

  while (queue.size > 0) {
    const current = queue.pop();
    if (current === goal) break;
    if (done[current]) continue;
    done[current] = 1;

    const col = current % cols;
    const row = (current / cols) | 0;
    for (const [dc, dr, price] of STEPS) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const next = nr * cols + nc;
      if (!open[next]) continue;
      // Cấm CẮT GÓC: đi chéo chỉ được khi cả hai ô kề trực giao cũng thông.
      if (dc !== 0 && dr !== 0 && (!open[row * cols + nc] || !open[nr * cols + col])) continue;

      const candidate = cost[current]! + price;
      if (candidate >= cost[next]!) continue;
      cost[next] = candidate;
      cameFrom[next] = current;
      queue.push(candidate + heuristic(next), next);
    }
  }

  if (goal !== start && cameFrom[goal] === -1) return null;

  const cells: number[] = [];
  for (let at = goal; at !== -1; at = cameFrom[at]!) {
    cells.push(at);
    if (at === start) break;
  }
  cells.reverse();

  // Tâm ô, rồi thay hai đầu bằng chỗ đứng THẬT và đích THẬT: người chơi bấm vào
  // một điểm, không bấm vào một ô lưới.
  const points = cells.map((index) => ({
    x: ((index % cols) + 0.5) * cell,
    y: (((index / cols) | 0) + 0.5) * cell,
  }));
  points[0] = from;
  if (walkable(to.x, to.y)) points.push(to);

  // Kéo dây: từ mỗi điểm, nhảy tới điểm XA NHẤT còn nhìn thấy thẳng.
  const pulled: { x: number; y: number }[] = [];
  let i = 0;
  while (i < points.length - 1) {
    let far = i + 1;
    for (let j = points.length - 1; j > i; j -= 1) {
      const a = points[i]!;
      const b = points[j]!;
      if (segmentClear(walkable, a.x, a.y, b.x, b.y)) {
        far = j;
        break;
      }
    }
    pulled.push(points[far]!);
    i = far;
  }
  return pulled.length > 0 ? pulled : null;
}

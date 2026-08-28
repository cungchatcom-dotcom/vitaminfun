'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';

import type { ResizeAxis } from './use-design-board';

/**
 * Ba tay cầm đổi kích thước, đặt quanh một khối đang được chọn.
 *
 *   ▸ giữa cạnh PHẢI  — kéo ngang, chỉ đổi bề rộng
 *   ▾ giữa cạnh DƯỚI  — kéo dọc,  chỉ đổi chiều cao
 *   ◢ ở GÓC           — kéo chéo, đổi cả hai
 *
 * Ba cái chứ không một: một khung chữ nhật có hai chiều độc lập, và chỉ có tay
 * cầm góc thì muốn kéo dài đúng một chiều là phải kéo chéo rồi sửa lại chiều
 * kia — hai thao tác cho một ý định.
 *
 * Component thuần hiển thị: nó không biết mình đang bọc cái gì, nên mọi trình
 * thiết kế dùng chung được. Chỗ nào chỉ lưu bề rộng (ảnh giữ tỉ lệ gốc) thì
 * truyền `axes={['both']}` và bỏ qua `h`.
 */
export function ResizeHandles({
  onStart,
  axes = ['x', 'y', 'both'],
  label,
  tone = 'lagoon',
}: {
  onStart: (event: ReactPointerEvent, axis: ResizeAxis) => void;
  axes?: readonly ResizeAxis[];
  label: string;
  /**
   * Màu tay cầm. Cần hai màu vì có chỗ hai bộ tay cầm nằm LỒNG NHAU: khung nội
   * dung của một khối phòng chờ mặc định chiếm 92% khối, nên sáu cái chấm rơi
   * gần như chồng lên nhau và không ai đoán được cái nào kéo cái gì. Màu tay
   * cầm ăn theo màu viền của thứ nó đang bọc.
   */
  tone?: 'lagoon' | 'orichalcum';
}) {
  const spots: Record<ResizeAxis, string> = {
    x: 'top-1/2 -right-1 -translate-y-1/2 cursor-ew-resize',
    y: '-bottom-1 left-1/2 -translate-x-1/2 cursor-ns-resize',
    both: '-right-1 -bottom-1 cursor-nwse-resize',
  };

  return (
    <>
      {axes.map((axis) => (
        <button
          key={axis}
          type="button"
          aria-label={label}
          title={label}
          onPointerDown={(event) => onStart(event, axis)}
          className={`absolute size-3.5 rounded-full border-2 border-abyss-950 shadow ${
            tone === 'orichalcum' ? 'bg-orichalcum-400' : 'bg-lagoon-400'
          } ${spots[axis]}`}
        />
      ))}
    </>
  );
}

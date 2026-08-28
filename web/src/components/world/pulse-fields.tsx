'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import { DEFAULT_PULSE_PERCENT, DEFAULT_PULSE_PERIOD_MS, PULSE } from '@/game/world';

/**
 * Hai thanh trượt chỉnh nhịp thở, dùng chung cho vật thể nhiệm vụ và world.
 *
 * Thanh trượt chứ không phải ô số: thứ đang chỉnh là một CẢM GIÁC, và cách duy
 * nhất để biết 8% có phải 8% mình muốn là nhìn nó thở trong lúc kéo. Số hiện
 * ngay cạnh nhãn để vẫn chỉnh chính xác được bằng phím mũi tên.
 *
 * `onPreview` bắn liên tục trong lúc kéo để khung soạn vẽ theo ngay; `onCommit`
 * chỉ chạy khi THẢ TAY. Kéo một nhịp bắn ra hàng chục sự kiện, gửi từng cái là
 * hàng chục lượt PATCH cho một lần chỉnh.
 */
export function PulseFields({
  percent: savedPercent,
  periodMs: savedPeriodMs,
  onPreview,
  onCommit,
}: {
  /** Giá trị đang nằm ở server. `null` = chưa đặt, dùng mặc định của cảnh. */
  percent: number | null | undefined;
  periodMs: number | null | undefined;
  onPreview: (value: { percent: number; periodMs: number } | null) => void;
  onCommit: (percent: number, periodMs: number) => Promise<void> | void;
}) {
  const t = useTranslations();

  const [percent, setPercent] = useState(savedPercent ?? DEFAULT_PULSE_PERCENT);
  const [periodMs, setPeriodMs] = useState(savedPeriodMs ?? DEFAULT_PULSE_PERIOD_MS);

  // Cặp giá trị đang nằm ở server, ĐÃ quy về mặc định. So với nó chứ không so
  // với cột trong DB: cột `null` mà so thẳng thì bấm một cái vào thanh trượt
  // (không kéo) cũng thành "khác null" và ghi xuống đúng con số mặc định vừa
  // thay thế.
  const saved = useRef({
    percent: savedPercent ?? DEFAULT_PULSE_PERCENT,
    periodMs: savedPeriodMs ?? DEFAULT_PULSE_PERIOD_MS,
  });

  function preview(next: { percent?: number; periodMs?: number }) {
    const value = { percent: next.percent ?? percent, periodMs: next.periodMs ?? periodMs };
    setPercent(value.percent);
    setPeriodMs(value.periodMs);
    onPreview(value);
  }

  async function commit() {
    if (percent === saved.current.percent && periodMs === saved.current.periodMs) {
      onPreview(null);
      return;
    }
    saved.current = { percent, periodMs };
    await onCommit(percent, periodMs);
    // Bỏ bản nháp SAU khi lưu xong: bỏ trước thì khung soạn quay về giá trị cũ
    // trong đúng khoảnh khắc chờ server, và hiệu ứng giật một cái.
    onPreview(null);
  }

  return (
    <div className="rounded-lg border border-abyss-800 p-3">
      <label className="block">
        <span className="field-label flex items-baseline justify-between">
          {t('designer.pulsePercent')}
          <span className="font-mono text-xs text-slate-400">
            {percent === 0 ? t('designer.pulseOff') : `+${percent}%`}
          </span>
        </span>
        <input
          type="range"
          min={PULSE.percentMin}
          max={PULSE.percentMax}
          value={percent}
          onChange={(e) => preview({ percent: Number(e.target.value) })}
          onPointerUp={() => void commit()}
          onKeyUp={() => void commit()}
          className="w-full accent-lagoon-400"
        />
      </label>

      <label className="mt-2 block">
        <span className="field-label flex items-baseline justify-between">
          {t('designer.pulsePeriod')}
          <span className="font-mono text-xs text-slate-400">{(periodMs / 1000).toFixed(1)}s</span>
        </span>
        <input
          type="range"
          min={PULSE.periodMinMs}
          max={PULSE.periodMaxMs}
          step={100}
          // Kéo nhanh chậm khi cường độ bằng 0 là kéo một thứ không nhìn thấy.
          // Mờ đi để nói điều đó, thay vì để người dùng kéo và tự hỏi vì sao
          // chẳng có gì xảy ra.
          disabled={percent === 0}
          value={periodMs}
          onChange={(e) => preview({ periodMs: Number(e.target.value) })}
          onPointerUp={() => void commit()}
          onKeyUp={() => void commit()}
          className="w-full accent-lagoon-400 disabled:opacity-40"
        />
      </label>

      <span className="mt-1 block text-xs text-slate-500">{t('designer.pulseHint')}</span>
    </div>
  );
}

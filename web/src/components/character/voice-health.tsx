'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { voiceHealth, type VoiceHealth } from '@/lib/question-audio';

/**
 * DỊCH VỤ GIỌNG ĐỌC còn sống không — và còn bao nhiêu ký tự.
 *
 * ## Vì sao cần một chỗ bấm riêng
 *
 * Trước đây có ba thứ hỏng được, và cả ba hiện ra y hệt nhau: chưa đặt khoá API,
 * khoá sai, hay mạng không tới. Người dựng chỉ gặp chúng SAU KHI đã bấm sinh
 * giọng và đã ngồi chờ — rồi nhận đúng một dòng "sinh giọng thất bại", không
 * nói được phải đi sửa ở đâu.
 *
 * ## KHÔNG tốn một ký tự nào
 *
 * Chỉ hỏi thông tin tài khoản, không đọc chữ nào. Bấm kiểm tra mà mất tiền thì
 * người ta ngại bấm, và cái nút thành vô dụng đúng vào lúc cần nó nhất.
 *
 * Số ký tự CÒN LẠI là thứ đáng giá nhất ở đây: sinh tám mươi câu cho một giọng
 * là một khoản thật, và biết trước còn bao nhiêu thì hơn là phát hiện giữa mẻ.
 */
export function VoiceHealthPanel() {
  const t = useTranslations();
  const [data, setData] = useState<Record<string, VoiceHealth> | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    setBusy(true);
    try {
      setData(await voiceHealth());
    } catch {
      setData({ elevenlabs: { ok: false, reason: 'unreachable' } });
    } finally {
      setBusy(false);
    }
  }, []);

  // Hỏi NGAY khi mở màn: người dựng vào đây để gán giọng, và biết dịch vụ đang
  // hỏng trước khi chọn thì hơn là sau khi chọn xong.
  useEffect(() => {
    void check();
  }, [check]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-abyss-800 bg-abyss-950/40 px-3 py-2">
      <span className="text-xs text-slate-400">{t('voiceHealth.label')}</span>

      {Object.entries(data ?? {}).map(([key, info]) => (
        <span key={key} className="flex items-center gap-1.5 text-xs">
          <span
            aria-hidden
            className={`size-2 rounded-full ${info.ok ? 'bg-emerald-400' : 'bg-coral-500'}`}
          />
          <span className="font-mono text-slate-300">{key}</span>
          {info.ok ? (
            <span className="text-slate-500">
              {info.tier}
              {/* Số CÒN LẠI, không phải số đã dùng: người dựng sắp tiêu, nên
                  con số họ cần là con số còn trong ví. */}
              {info.characters_left != null &&
                ` · ${t('voiceHealth.left', { n: info.characters_left.toLocaleString() })}`}
            </span>
          ) : (
            <span className="text-coral-500">{t(`voiceHealth.reason.${info.reason ?? 'unknown'}`)}</span>
          )}
        </span>
      ))}

      <Button variant="ghost" size="sm" loading={busy} onClick={() => void check()}>
        {t('voiceHealth.check')}
      </Button>
    </div>
  );
}

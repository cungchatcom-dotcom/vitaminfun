'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, SectionTitle } from '@/components/ui/primitives';

/**
 * CÂN BẰNG của một world — phần luật chơi mà giáo viên chỉnh được.
 *
 * ## Đơn vị là LẦN SAI, không phải lần thử
 *
 * Trong `balance_json`, `maxAttemptsPerQuestion` đếm SỐ LƯỢT TRẢ LỜI, kể cả lần
 * đầu: `2` nghĩa là "sai một lần thì còn một lần nữa". Đó là con số đúng cho
 * đoạn mã đếm dòng trong `quest_answers`, nhưng nó không phải con số trong đầu
 * người dựng — họ nghĩ bằng "được sai mấy lần". Hai cách đếm lệch nhau đúng 1,
 * và một cái ô ghi "2" trong khi người đọc hiểu là "hai lần sai" thì mỗi câu
 * hỏi trong world sẽ có thêm một lượt mà không ai định cho.
 *
 * Nên màn này nói bằng LẦN SAI, và cộng 1 khi lưu. Quy đổi nằm ở đúng một chỗ —
 * hai hàm ngay dưới đây.
 *
 * ## Bảng điểm luôn dài đúng bằng số lượt
 *
 * `attemptPenalty` phải dài bằng số lượt: thừa một phần tử thì có một hệ số
 * không bao giờ tới lượt, thiếu thì có một lượt không có hệ số riêng. Ở đây số
 * hàng SINH RA từ số lượt, nên hai thứ không lệch nhau được — người dựng không
 * phải nhớ luật ấy, và cũng không phá được nó.
 *
 * ## Không mở cả `balance_json` thành một ô JSON
 *
 * Mười mấy khoá còn lại (điểm chiến lực mỗi màn, thưởng thời gian, giá gợi ý…)
 * vẫn chỉ sửa được qua API. Một ô JSON thì nhanh cho người viết màn này và đắt
 * cho mọi người khác: một dấu phẩy gõ nhầm là luật chơi của cả world hỏng, và
 * không có gì trên màn hình nói vì sao.
 */

/** `balance_json` -> số lần được SAI. `2` lượt = sai 1 lần. */
function soLanSai(maxAttempts: unknown): number {
  const n = Number(maxAttempts);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.max(0, Math.round(n) - 1);
}

/** Số lần được SAI -> `maxAttemptsPerQuestion`. */
function soLuot(lanSai: number): number {
  return Math.max(1, Math.round(lanSai) + 1);
}

export function BalancePanel({
  balance,
  onSave,
}: {
  /** `WorldOut.balance` — đã hợp nhất với mặc định ở server. */
  balance: Record<string, unknown>;
  onSave: (balanceJson: Record<string, unknown>) => Promise<void>;
}) {
  const t = useTranslations('world.balance');

  const [lanSai, setLanSai] = useState(() => soLanSai(balance.maxAttemptsPerQuestion));
  const [diem, setDiem] = useState<number[]>(() => {
    const raw = Array.isArray(balance.attemptPenalty) ? (balance.attemptPenalty as number[]) : [];
    const n = soLuot(soLanSai(balance.maxAttemptsPerQuestion));
    // Thiếu thì bù bằng phần tử cuối (hoặc 1.0) — cùng luật với
    // `attempt_multiplier` ở server: vượt bảng thì lấy giá trị cuối.
    return Array.from({ length: n }, (_, i) => Number(raw[i] ?? raw[raw.length - 1] ?? 1));
  });
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const luot = soLuot(lanSai);

  /** Đổi số lần sai thì bảng điểm dài/ngắn theo, giữ nguyên phần đã nhập. */
  function doiLanSai(next: number) {
    const n = Math.max(0, Math.min(5, Math.round(next)));
    setLanSai(n);
    setDiem((cu) =>
      Array.from({ length: soLuot(n) }, (_, i) => Number(cu[i] ?? cu[cu.length - 1] ?? 1)),
    );
    setNote(null);
  }

  return (
    <Card className="mb-6">
      <SectionTitle>{t('title')}</SectionTitle>
      <p className="mb-3 text-xs text-slate-500">{t('hint')}</p>

      <label className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-300">{t('wrongAllowed')}</span>
        <input
          type="number"
          min={0}
          max={5}
          className="field-input w-20"
          value={lanSai}
          onChange={(e) => doiLanSai(Number(e.target.value))}
        />
        <span className="text-xs text-slate-500">{t('wrongAllowedHint', { tries: luot })}</span>
      </label>

      <div className="mb-3">
        <p className="mb-1.5 text-sm text-slate-300">{t('scoreByTry')}</p>
        <p className="mb-2 text-xs text-slate-500">{t('scoreByTryHint')}</p>
        <div className="flex flex-wrap gap-3">
          {diem.map((v, i) => (
            <label key={i} className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">{t('try', { n: i + 1 })}</span>
              <input
                type="number"
                min={0}
                max={100}
                step={10}
                className="field-input w-20"
                value={Math.round(v * 100)}
                onChange={(e) => {
                  const pct = Math.max(0, Math.min(100, Number(e.target.value)));
                  setDiem((cu) => cu.map((x, j) => (j === i ? pct / 100 : x)));
                  setNote(null);
                }}
              />
              <span className="text-xs text-slate-500">%</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          loading={saving}
          onClick={async () => {
            setSaving(true);
            setNote(null);
            try {
              await onSave({ maxAttemptsPerQuestion: luot, attemptPenalty: diem });
              setNote(t('saved'));
            } finally {
              setSaving(false);
            }
          }}
        >
          {t('save')}
        </Button>
        {note && <span className="text-xs text-emerald-400">✓ {note}</span>}
        <span className="ml-auto text-[11px] text-slate-600">{t('gateNote')}</span>
      </div>
    </Card>
  );
}

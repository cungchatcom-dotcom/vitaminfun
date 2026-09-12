'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, SectionTitle } from '@/components/ui/primitives';
import type { updateWorld } from '@/lib/worlds';

/**
 * TÁM nhóm, xếp theo đúng thứ tự chúng xảy ra trong một lượt chơi.
 *
 * Thứ tự này là cả cách đọc màn hình: người dựng cuộn từ trên xuống là đi hết
 * một cuộc trò chuyện, từ lúc gặp tới lúc chia tay. Xếp theo bảng chữ cái hay
 * theo lúc nào code cần thì mất hẳn nghĩa đó.
 */
const GROUPS = [
  'greet',
  'praise',
  'wrong',
  'moveOn',
  'next',
  'passed',
  'failed',
  'revisit',
] as const;
type Group = (typeof GROUPS)[number];

/**
 * LỜI PHÁN của người canh giữ — bộ câu khen/chê dùng chung cả world.
 *
 * ## Vì sao ở WORLD, không ở từng câu hỏi
 *
 * Đây là GIỌNG ĐIỆU của cả thế giới ấy — một world nghiêm nghị nói "Chuẩn.",
 * một world vui vẻ nói "Tuyệt vời ông mặt trời!". Nó không phải phản hồi cho
 * một bài cụ thể; câu chê riêng cho một bài thì đã có ô riêng trong trình soạn
 * câu hỏi.
 *
 * Đặt ở từng câu hỏi thì một world trăm câu là trăm chỗ phải gõ cùng một giọng
 * điệu, và trăm bản thu cho mỗi giọng người canh giữ.
 *
 * ## Nhiều câu cho MỘT tình huống, không phải một
 *
 * Màn chơi bốc theo `hash(câu hỏi, lần thử)` — cùng một lần thử luôn cho cùng
 * một câu, nên vào lại vẫn nghe đúng thứ đã nghe. Nhưng hai câu hỏi khác nhau
 * thì gần như chắc chắn nghe hai câu khác nhau: một người canh giữ nói đúng một
 * câu "Chuẩn." suốt cả màn thì nghe như một cái máy.
 *
 * ## Để TRỐNG là hợp lệ
 *
 * Trống = dùng bộ mặc định trong `messages/`, tức 12 câu đang chạy hôm nay ở
 * mọi world. Người dựng không phải soạn gì để màn chơi hoạt động.
 */
export function VerdictPanel({
  value,
  onSave,
}: {
  value: Record<string, string[]>;
  /** Lưu cả bộ. Chỗ gọi lo việc gọi mạng và báo lỗi. */
  onSave: (next: Parameters<typeof updateWorld>[1]['verdict_json']) => Promise<void>;
}) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);

  /**
   * Soạn bằng MỘT Ô VĂN BẢN, mỗi dòng một câu.
   *
   * Không phải một danh sách có nút "+ Thêm câu" và nút xoá từng dòng: người
   * dựng ở đây đang viết lời thoại, và viết lời thoại là gõ liền mạch. Một biểu
   * mẫu bắt bấm "+" trước mỗi câu biến việc viết thành việc điền đơn.
   */
  async function save(group: Group, raw: string) {
    const lines = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.join('\n') === (value[group] ?? []).join('\n')) return;
    setBusy(true);
    try {
      await onSave({ [group]: lines });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle>{t('world.verdict.title')}</SectionTitle>
      <p className="mt-1 mb-4 text-xs leading-snug text-slate-500">
        {t('world.verdict.intro')}
      </p>

      <div className="space-y-4">
        {GROUPS.map((group) => (
          <label key={group} className="block">
            <span className="field-label">{t(`world.verdict.${group}`)}</span>
            <span className="mb-1 block text-[11px] leading-snug text-slate-500">
              {t(`world.verdict.${group}Hint`)}
            </span>
            <textarea
              className="field-input min-h-24 resize-y font-mono text-xs"
              rows={4}
              disabled={busy}
              // Không kiểm soát: gõ xong rời ô mới lưu. Ô kiểm soát thì mỗi ký
              // tự là một lần vẽ lại cả thẻ, và con trỏ nhảy về cuối khi sửa
              // giữa dòng.
              defaultValue={(value[group] ?? []).join('\n')}
              placeholder={t(`world.verdict.${group}Placeholder`)}
              onBlur={(event) => void save(group, event.target.value)}
            />
          </label>
        ))}
      </div>

      {/* Nói rõ khi đang TRỐNG. Một ô trống trông như "chưa ai đặt" thì đúng,
          nhưng người dựng cần biết điều đó KHÔNG phải là hỏng — màn chơi vẫn
          có lời phán, chỉ là bộ mặc định. */}
      {GROUPS.every((g) => (value[g] ?? []).length === 0) && (
        <p className="mt-3 text-[11px] leading-snug text-slate-500">
          {t('world.verdict.empty')}
        </p>
      )}

      <p className="mt-3 text-[11px] leading-snug text-orichalcum-400">
        {t('world.verdict.audioHint')}
      </p>
    </Card>
  );
}

/** Nút xoá cả bộ, quay về mặc định. Tách ra để chỗ gọi tự quyết có hiện hay không. */
export function VerdictReset({ onReset }: { onReset: () => void }) {
  const t = useTranslations();
  return (
    <Button variant="secondary" size="sm" onClick={onReset}>
      {t('world.verdict.reset')}
    </Button>
  );
}

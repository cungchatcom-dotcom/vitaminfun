'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { ApiError } from '@/lib/api-error';
import { generateVerdictAudio, verdictLines, type VerdictLine } from '@/lib/question-audio';

import { GeneratingOverlay, reportText } from './audio-tools';

/**
 * XEM · NGHE · THU LẠI từng câu phán.
 *
 * ## Vì sao là một popup riêng
 *
 * Bộ câu của một world có thể tới tám mươi câu. Cột trái của popup sửa nhiệm vụ
 * rộng 22rem và đã chứa sáu khối khác — nhét danh sách ấy vào đó thì người dựng
 * phải cuộn qua hàng trăm dòng mới tới ô "Điểm qua ải".
 *
 * Tách ra còn giải một việc nữa: nghe thử cần BỀ NGANG. Một câu dài trong cột
 * hẹp bị ngắt làm ba dòng, và tám mươi câu như thế thì không ai đọc lướt được.
 *
 * ## Thu lại TỪNG CÂU, không phải cả bộ
 *
 * Nghe thử rồi thấy ba câu đọc chưa ưng là chuyện thường. Không có chỗ này thì
 * lựa chọn duy nhất là sinh lại cả tám mươi — trả tiền cho bảy mươi bảy câu đã
 * đúng.
 */
export function VerdictLinesDialog({
  questId,
  onClose,
  onChanged,
}: {
  questId: string;
  onClose: () => void;
  /** Sinh xong thì bộ đếm ngoài kia phải đổi theo. */
  onChanged: () => void;
}) {
  const t = useTranslations();
  const [data, setData] = useState<VerdictLine[] | null>(null);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const thread = await verdictLines(questId);
      setData(thread.lines);
      setVoiceName(thread.voice_name ?? null);
    } catch {
      setData([]);
    }
  }, [questId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * MỘT tiếng tại một lúc.
   *
   * Bấm nhanh năm cái loa liền nhau thì năm câu nói chồng lên nhau và không
   * nghe ra câu nào — mà đây đúng là màn người ta bấm nhanh nhiều cái loa.
   */
  const dangPhat = useRef<HTMLAudioElement | null>(null);

  function phat(url: string) {
    dangPhat.current?.pause();
    const node = new Audio(url);
    dangPhat.current = node;
    void node.play().catch(() => undefined);
  }

  // Đóng popup giữa lúc đang phát thì tiếng phải tắt theo.
  useEffect(() => () => dangPhat.current?.pause(), []);

  const lines = data ?? [];
  const thieu = lines.filter((line) => !line.url);

  function toggle(text: string) {
    setPicked((before) => {
      const next = new Set(before);
      if (next.has(text)) next.delete(text);
      else next.add(text);
      return next;
    });
  }

  async function run(texts: string[], overwrite: boolean) {
    if (texts.length === 0) return;
    // Chỉ hỏi khi THU LẠI. Thu những câu còn thiếu thì không ghi đè gì cả, và
    // một hộp xác nhận ở đó chỉ là một cú bấm thừa.
    if (overwrite && !window.confirm(t('audio.confirmRedo', { count: texts.length }))) return;

    setBusy(true);
    setNote(null);
    try {
      const report = await generateVerdictAudio(questId, { overwrite, lines: texts });
      setNote(reportText(report, t as never));
      setPicked(new Set());
      await load();
      onChanged();
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal label={t('audio.linesTitle')} onClose={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-abyss-700 bg-abyss-900 shadow-2xl">
        {busy && <GeneratingOverlay count={picked.size || thieu.length} />}

        <header className="flex items-start justify-between gap-4 border-b border-abyss-800 px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-100">{t('audio.linesTitle')}</h2>
            {/* Tên GIỌNG ngay dưới tiêu đề: cùng bộ chữ ấy đọc bằng giọng khác
                là một bộ bản thu khác, và người dựng phải biết mình đang nghe ai. */}
            <p className="truncate text-xs text-slate-500">
              {voiceName ?? t('audio.npcNoVoice')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('stage.viewer.close')}
            className="shrink-0 rounded-lg px-2 py-1 text-slate-400 transition hover:bg-abyss-800 hover:text-slate-100"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {data == null ? (
            <p className="text-sm text-slate-400">{t('common.loading')}</p>
          ) : lines.length === 0 ? (
            <p className="text-sm text-slate-400">{t('audio.noLines')}</p>
          ) : (
            byGroup(lines).map(([name, rows]) => (
              <section key={name} className="mb-4">
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                  {t(`world.verdict.${name}`)}
                </p>
                <ul className="space-y-1">
                  {rows.map((line) => (
                    <li
                      key={line.text}
                      className="flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-abyss-800/50"
                    >
                      <input
                        type="checkbox"
                        className="size-3.5 shrink-0 accent-lagoon-500"
                        checked={picked.has(line.text)}
                        onChange={() => toggle(line.text)}
                        aria-label={line.text}
                      />
                      <span className="min-w-0 flex-1 text-sm text-slate-200">{line.text}</span>

                      {line.url ? (
                        <button
                          type="button"
                          aria-label={line.text}
                          onClick={() => phat(line.url as string)}
                          className="grid size-7 shrink-0 place-items-center rounded-full bg-abyss-800 text-sm transition hover:bg-lagoon-500/30"
                        >
                          🔊
                        </button>
                      ) : (
                        // Chưa có tiếng thì NÓI RA, đừng để một ô trống: người
                        // dựng cần nhìn lướt là thấy còn thiếu chỗ nào.
                        <span className="shrink-0 text-[11px] text-orichalcum-400">
                          {t('audio.noSound')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-abyss-800 px-5 py-3">
          {/* Hai nút, hai việc khác hẳn nhau về TIỀN: một cái lấp chỗ trống
              (không ghi đè gì), một cái thu lại thứ đã có (trả tiền lần nữa). */}
          <Button
            variant="secondary"
            size="sm"
            disabled={thieu.length === 0}
            onClick={() => void run(thieu.map((line) => line.text), false)}
          >
            {t('audio.makeMissing', { count: thieu.length })}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={picked.size === 0}
            onClick={() => void run([...picked], true)}
          >
            {t('audio.redoPicked', { count: picked.size })}
          </Button>

          <span className="ml-auto font-mono text-[11px] text-slate-500">
            {lines.length - thieu.length}/{lines.length}
          </span>

          {note && <p className="basis-full text-xs text-lagoon-400">{note}</p>}
          {errorKey && (
            <p role="alert" className="basis-full text-xs text-coral-500">
              {t(errorKey)}
            </p>
          )}
        </footer>
      </div>
    </Modal>
  );
}

/** Gom theo nhóm, GIỮ NGUYÊN thứ tự server trả về — đó là thứ tự kịch bản. */
function byGroup(lines: VerdictLine[]): [string, VerdictLine[]][] {
  const out = new Map<string, VerdictLine[]>();
  for (const line of lines) {
    const bucket = out.get(line.group) ?? [];
    bucket.push(line);
    out.set(line.group, bucket);
  }
  return [...out.entries()];
}

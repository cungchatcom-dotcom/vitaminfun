'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

import { VerdictLinesDialog } from './verdict-lines-dialog';
import { ApiError } from '@/lib/api-error';
import { listCharacters, listWorldCharacters, type Character } from '@/lib/characters';
import { pickText } from '@/lib/i18n-text';
import {
  listQuestionAudio,
  type QuestionAudio,
  generateQuestAudio,
  generateQuestOutroAudio,
  generateVerdictAudio,
  generateQuestionAudio,
  generateStageAudio,
  questAudioStatus,
  stageAudioStatus,
  type AudioReport,
  type QuestAudioStatus,
} from '@/lib/question-audio';

/**
 * Nhân vật ĐỌC PHƯƠNG ÁN — chọn nhiều, vì mỗi nhân vật một giọng.
 *
 * Phương án trả lời là thứ HỌC SINH nói ra, mà học sinh nào cũng vào màn bằng
 * nhân vật của mình. Sinh cho một giọng rồi thì em chọn nhân vật khác sẽ gặp một
 * khoảng im — nên phải phủ hết những nhân vật học sinh CHỌN ĐƯỢC.
 *
 * ## Lấy dàn nhân vật của WORLD, và tick sẵn tất cả
 *
 * World đã có một danh sách nhân vật được chọn ở màn thiết kế world, và đó
 * chính là những nhân vật học sinh vào world này có thể chọn. Không có lý do gì
 * bắt người dựng tick lại từng người: mặc định là **hết**, ai không cần thì bấm
 * bỏ ra.
 *
 * Bắt tick tay còn có một cách hỏng lặng lẽ: quên tick một người thì em nào
 * chọn nhân vật ấy sẽ gặp một khoảng im, mà không có gì trên màn hình báo.
 *
 * Không có `worldId` thì lùi về cả kho nhân vật người chơi — chỗ gọi nào chưa
 * biết mình đang ở world nào vẫn phải dùng được.
 */
export function useVoiceCast(worldId?: string) {
  const [cast, setCast] = useState<Character[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    let bo = false;
    const nap = worldId ? listWorldCharacters(worldId) : listCharacters('player');
    nap.then(
      (list) => {
        if (bo) return;
        setCast(list);
        // Tick sẵn những ai ĐỌC ĐƯỢC. Người chưa gán giọng vẫn hiện trong hàng
        // nhưng không tick được — thấy họ ở đó rồi mới hiểu vì sao giọng của họ
        // không được sinh; giấu đi thì không ai hiểu gì cả.
        setPicked(new Set(list.filter((c) => c.voice_id).map((c) => c.id)));
      },
      () => {
        if (!bo) setCast([]);
      },
    );
    return () => {
      bo = true;
    };
  }, [worldId]);

  const toggle = useCallback((id: string) => {
    setPicked((before) => {
      const next = new Set(before);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return { cast, picked, toggle, ids: [...picked] };
}

/** Hàng ô tick chọn nhân vật đọc phương án. */
export function VoiceCastPicker({
  cast,
  picked,
  onToggle,
  locale,
}: {
  cast: Character[];
  picked: Set<string>;
  onToggle: (id: string) => void;
  locale: string;
}) {
  const t = useTranslations();

  if (cast.length === 0) {
    return <p className="text-xs text-slate-500">{t('audio.noCast')}</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {cast.map((character) => {
        const on = picked.has(character.id);
        const doc = Boolean(character.voice_id);
        return (
          <button
            key={character.id}
            type="button"
            disabled={!doc}
            // Chưa gán giọng thì nói VÌ SAO không tick được, ngay trên con trỏ.
            title={doc ? undefined : t('audio.castNoVoice')}
            onClick={() => onToggle(character.id)}
            className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
              !doc
                ? 'cursor-not-allowed border-abyss-800 text-slate-600 line-through'
                : on
                  ? 'border-lagoon-400 bg-lagoon-500/15 text-lagoon-300'
                  : 'border-abyss-700 text-slate-400 hover:border-lagoon-500/60'
            }`}
          >
            {doc && on ? '✓ ' : ''}
            {pickText(character.name_i18n, locale)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Báo lại một mẻ vừa sinh, bằng lời người đọc được.
 *
 * Ba con số trần trụi (`generated`, `skipped`, `missing_voice`) thì đúng nhưng
 * không nói được điều người dựng muốn biết: *đã xong chưa, và còn thiếu gì*.
 */
export function reportText(report: AudioReport, t: (k: string, v?: never) => string): string {
  const parts: string[] = [];
  if (report.generated) parts.push(`${report.generated} ${t('audio.generated')}`);
  if (report.skipped) parts.push(`${report.skipped} ${t('audio.skipped')}`);
  // HỎNG đứng riêng, và đứng SAU cùng: phần làm được đã lưu rồi, nên câu đầu
  // tiên người dựng đọc phải là "đã xong bao nhiêu", không phải một lời báo lỗi.
  if (report.failed) parts.push(`${report.failed} ${t('audio.failed')}`);
  if (report.missing_voice.length) {
    parts.push(`${t('audio.missingVoice')}: ${report.missing_voice.join(', ')}`);
  }
  return parts.join(' · ') || t('audio.nothing');
}

/** Còn câu hỏng thì nói rõ: bấm lại CHỈ chạy phần hỏng, không tính tiền lần nữa. */
export function retryHint(report: AudioReport | null): boolean {
  return Boolean(report?.failed);
}

/**
 * SINH TIẾNG ĐỌC cho ĐÚNG MỘT CÂU — dùng trong popup xem câu hỏi.
 *
 * Cùng hai nút và cùng luật với `QuestAudioPanel`, chỉ hẹp lại còn một câu:
 * người dựng đang mở một câu ra xem, thấy nó chưa có tiếng, và không có lý gì
 * bắt họ đóng popup lại rồi đi tìm nút ở chỗ khác để sinh cho cả nhiệm vụ.
 *
 * Giọng đọc ĐỀ BÀI vẫn lấy từ người canh giữ của nhiệm vụ, không cho chọn lại —
 * cùng câu hỏi ấy nằm trong nhiệm vụ nào thì người của nhiệm vụ ấy đọc. Nên
 * panel này cần biết `questId`; thiếu nó thì chỉ còn sinh được phần đáp án.
 */
export function QuestionAudioPanel({
  questionId,
  questId,
  worldId,
  locale,
  onError,
  onGenerated,
}: {
  questionId: string;
  questId?: string;
  /** World đang dựng — dàn nhân vật đọc phương án lấy từ đây. */
  worldId?: string;
  locale: string;
  onError: (key: string) => void;
  onGenerated?: () => void;
}) {
  const t = useTranslations();
  const { cast, picked, toggle, ids } = useVoiceCast(worldId);

  const [quest, setQuest] = useState<QuestAudioStatus | null>(null);
  const [busy, setBusy] = useState<'prompt' | 'option' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  //: Mẻ vừa rồi có câu hỏng — phần làm được đã lưu, bấm lại chỉ chạy phần còn thiếu.
  const [failedNote, setFailedNote] = useState(false);

  const reload = useCallback(async () => {
    if (!questId) return setQuest(null);
    try {
      setQuest(await questAudioStatus(questId, ids));
    } catch {
      setQuest(null);
    }
  }, [questId, ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void reload();
  }, [reload]);

  // Tình trạng của ĐÚNG câu đang mở, gạn ra từ tình trạng cả nhiệm vụ. Gọi một
  // lượt cho cả nhiệm vụ chứ không thêm một endpoint riêng cho một câu: cùng
  // một phép đếm, mà hai đường tính thì sẽ có ngày chúng đếm khác nhau.
  const row = quest?.questions.find((q) => q.question_id === questionId) ?? null;

  async function run(target: 'prompt' | 'option', done: number) {
    let overwrite = false;
    if (done > 0) {
      if (!window.confirm(t('audio.confirmRedo', { count: done }))) return;
      overwrite = true;
    }
    setBusy(target);
    setNote(null);
    try {
      const report = await generateQuestionAudio(questionId, {
        target,
        // Đề bài: giọng của người canh giữ, gửi xuống dưới dạng nhân vật của
        // họ — server tự tra ra giọng, cùng một đường với mức nhiệm vụ.
        character_ids: target === 'prompt' ? [quest?.npc_character_id ?? ''] : ids,
        overwrite,
      });
      setNote(reportText(report, t as never));
      setFailedNote(retryHint(report));
      await reload();
      onGenerated?.();
    } catch (error) {
      onError(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-abyss-800 bg-abyss-950/40 p-4">
      {busy && <GeneratingOverlay />}
      <span className="field-label">{t('audio.title')}</span>

      <div className="mb-3">
        <p className="mb-1.5 text-xs text-slate-400">
          {quest?.voice_name
            ? t('audio.promptVoice', { voice: quest.voice_name })
            : quest?.npc_character_id
              ? t('audio.npcNoVoice')
              : t('audio.noNpc')}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={busy === 'prompt'}
            disabled={!quest?.voice_id}
            onClick={() => void run('prompt', row?.prompt_ready ? 1 : 0)}
          >
            {t('audio.makePrompt')}
          </Button>
          {row?.prompt_ready && <span className="text-xs text-emerald-400">✓</span>}
        </div>
      </div>

      <div className="border-t border-abyss-800 pt-3">
        {/* Câu gõ chữ thì nói thẳng là không có gì để đọc, thay vì hiện một cái
            nút bấm vào không xảy ra chuyện gì. */}
        {row && row.option_count === 0 ? (
          <p className="text-xs text-slate-500">{t('audio.noOptions')}</p>
        ) : (
          <>
            <p className="mb-1.5 text-xs text-slate-400">{t('audio.optionCast')}</p>
            <VoiceCastPicker cast={cast} picked={picked} onToggle={toggle} locale={locale} />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={busy === 'option'}
                disabled={ids.length === 0}
                onClick={() => void run('option', row?.options_ready ?? 0)}
              >
                {t('audio.makeOptions')}
              </Button>
              {row && (
                <span className="font-mono text-[11px] text-slate-500">
                  {row.options_ready}/{row.options_wanted}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {note && <p className="mt-2 text-xs text-lagoon-400">{note}</p>}
      {failedNote && <p className="mt-1 text-xs text-orichalcum-400">{t('audio.retryHint')}</p>}
    </div>
  );
}

/**
 * SINH TIẾNG ĐỌC cho một nhiệm vụ — hai nút, hai việc khác nhau.
 *
 *   - Đề bài  → giọng của NGƯỜI CANH GIỮ. Không ai chọn ở đây: nó đã được chọn
 *     lúc gán NPC vào nhiệm vụ, và bắt chọn lại là mời người ta chọn lệch đi.
 *   - Phương án → giọng của những NHÂN VẬT HỌC SINH được tick bên dưới.
 *
 * Đã có tiếng rồi thì HỎI trước khi sinh lại: mỗi lần sinh là một lần trả tiền
 * cho nhà cung cấp, và không có gì trên màn hình nói cho người dựng biết điều đó
 * ngoài câu hỏi này.
 */
export function QuestAudioPanel({
  questId,
  worldId,
  locale,
  onError,
}: {
  questId: string;
  /** World đang dựng — dàn nhân vật đọc phương án lấy từ đây. */
  worldId?: string;
  locale: string;
  onError: (key: string) => void;
}) {
  const t = useTranslations();
  const { cast, picked, toggle, ids } = useVoiceCast(worldId);

  const [status, setStatus] = useState<QuestAudioStatus | null>(null);
  const [busy, setBusy] = useState<'prompt' | 'option' | 'verdict' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  //: Mẻ vừa rồi có câu hỏng — phần làm được đã lưu, bấm lại chỉ chạy phần còn thiếu.
  const [failedNote, setFailedNote] = useState(false);
  //: Đang mở popup xem & nghe từng câu phán.
  const [browsing, setBrowsing] = useState(false);

  const reload = useCallback(async () => {
    try {
      setStatus(await questAudioStatus(questId, ids));
    } catch {
      setStatus(null);
    }
  }, [questId, ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void reload();
  }, [reload]);

  const promptDone = (status?.questions ?? []).filter((q) => q.prompt_ready).length;
  const total = status?.questions.length ?? 0;
  const optionsWanted = (status?.questions ?? []).reduce((n, q) => n + q.options_wanted, 0);
  const optionsDone = (status?.questions ?? []).reduce((n, q) => n + q.options_ready, 0);

  async function run(target: 'prompt' | 'option', done: number) {
    // Hỏi TRƯỚC khi tiêu, và chỉ hỏi khi thật sự đã có gì đó để ghi đè.
    let overwrite = false;
    if (done > 0) {
      if (!window.confirm(t('audio.confirmRedo', { count: done }))) return;
      overwrite = true;
    }
    setBusy(target);
    setNote(null);
    try {
      const report = await generateQuestAudio(questId, {
        target,
        character_ids: target === 'option' ? ids : [],
        overwrite,
      });
      setNote(reportText(report, t as never));
      setFailedNote(retryHint(report));
      await reload();
    } catch (error) {
      onError(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    } finally {
      setBusy(null);
    }
  }

  /**
   * LỜI PHÁN — bộ câu khen/chê của world, đọc bằng giọng người canh giữ này.
   *
   * Đếm theo GIỌNG: hai nhiệm vụ chọn cùng một giọng thì cái thứ hai mở ra đã
   * thấy đủ, bấm vào báo "đã có sẵn" hết và không tốn thêm gì.
   */
  async function runVerdict() {
    const done = status?.verdict_ready ?? 0;
    let overwrite = false;
    if (done > 0) {
      if (!window.confirm(t('audio.confirmRedo', { count: done }))) return;
      overwrite = true;
    }
    setBusy('verdict');
    setNote(null);
    try {
      const rep = await generateVerdictAudio(questId, { overwrite });
      setNote(reportText(rep, t as never));
      setFailedNote(retryHint(rep));
      await reload();
    } catch (error) {
      onError(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-abyss-800 p-3">
      {busy && (
        <GeneratingOverlay
          count={
            busy === 'prompt'
              ? total - promptDone
              : busy === 'verdict'
                ? (status?.verdict_total ?? 0) - (status?.verdict_ready ?? 0)
                : optionsWanted - optionsDone
          }
        />
      )}
      <span className="field-label">{t('audio.title')}</span>

      {/* ĐỀ BÀI. Không có giọng thì nói rõ thiếu ở đâu — "chưa gán người canh
          giữ" và "người canh giữ chưa có giọng" là hai việc phải sửa ở hai chỗ
          khác nhau. */}
      <div className="mb-3">
        <p className="mb-1.5 text-xs text-slate-400">
          {status?.voice_name
            ? t('audio.promptVoice', { voice: status.voice_name })
            : status?.npc_character_id
              ? t('audio.npcNoVoice')
              : t('audio.noNpc')}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={busy === 'prompt'}
            disabled={!status?.voice_id || total === 0}
            onClick={() => void run('prompt', promptDone)}
          >
            {t('audio.makePrompt')}
          </Button>
          <span className="font-mono text-[11px] text-slate-500">
            {promptDone}/{total}
          </span>
        </div>
      </div>

      {/* PHƯƠNG ÁN. Chỉ câu có đáp án để chọn mới sinh — câu gõ chữ thì thứ học
          sinh nói ra là thứ họ tự nghĩ, không đọc sẵn được. */}
      <div className="border-t border-abyss-800 pt-3">
        <p className="mb-1.5 text-xs text-slate-400">{t('audio.optionCast')}</p>
        <VoiceCastPicker cast={cast} picked={picked} onToggle={toggle} locale={locale} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={busy === 'option'}
            disabled={ids.length === 0 || optionsWanted === 0}
            onClick={() => void run('option', optionsDone)}
          >
            {t('audio.makeOptions')}
          </Button>
          <span className="font-mono text-[11px] text-slate-500">
            {optionsDone}/{optionsWanted}
          </span>
        </div>
      </div>

      {/* LỜI PHÁN — "Chuẩn.", "Chưa đúng. Nghĩ lại xem."…
          Chữ soạn ở màn thiết kế WORLD và dùng chung cả world; tiếng thì của
          người canh giữ NHIỆM VỤ này, nên cái nút nằm ở đây. */}
      {(status?.verdict_total ?? 0) > 0 && (
        <div className="border-t border-abyss-800 pt-3">
          <p className="mb-2 text-xs text-slate-400">{t('audio.verdictHint')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={busy === 'verdict'}
              disabled={!status?.voice_id}
              onClick={() => void runVerdict()}
            >
              {t('audio.makeVerdict')}
            </Button>
            {/* XEM & NGHE mở ra một popup riêng, không nở thêm cột này.
                Tám mươi câu trong một cột 22rem thì người dựng cuộn qua hàng
                trăm dòng mới tới ô "Điểm qua ải" ở dưới. */}
            <Button variant="ghost" size="sm" onClick={() => setBrowsing(true)}>
              {t('audio.browse')}
            </Button>
            <span className="font-mono text-[11px] text-slate-500">
              {status?.verdict_ready}/{status?.verdict_total}
            </span>
          </div>
        </div>
      )}

      {browsing && (
        <VerdictLinesDialog
          questId={questId}
          onClose={() => setBrowsing(false)}
          onChanged={() => void reload()}
        />
      )}

      {note && <p className="mt-2 text-xs text-lagoon-400">{note}</p>}
      {failedNote && <p className="mt-1 text-xs text-orichalcum-400">{t('audio.retryHint')}</p>}
    </div>
  );
}

/**
 * SINH TIẾNG cho CẢ MÀN.
 *
 * Nhiệm vụ nào chưa có giọng thì bỏ qua và kể tên ra — không dừng cả mẻ vì một
 * nhiệm vụ thiếu. Người dựng muốn sinh hết những gì sinh được, rồi mới đi vá.
 */
export function StageAudioPanel({
  stageId,
  worldId,
  locale,
  onError,
}: {
  stageId: string;
  /** World đang dựng — dàn nhân vật đọc phương án lấy từ đây. */
  worldId?: string;
  locale: string;
  onError: (key: string) => void;
}) {
  const t = useTranslations();
  const { cast, picked, toggle, ids } = useVoiceCast(worldId);

  const [status, setStatus] = useState<Awaited<ReturnType<typeof stageAudioStatus>> | null>(null);
  const [busy, setBusy] = useState<'prompt' | 'option' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  //: Mẻ vừa rồi có câu hỏng — phần làm được đã lưu, bấm lại chỉ chạy phần còn thiếu.
  const [failedNote, setFailedNote] = useState(false);

  const reload = useCallback(async () => {
    try {
      setStatus(await stageAudioStatus(stageId, ids));
    } catch {
      setStatus(null);
    }
  }, [stageId, ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void reload();
  }, [reload]);

  const rows = status?.quests ?? [];
  const questions = rows.flatMap((q) => q.questions);
  const promptDone = questions.filter((q) => q.prompt_ready).length;
  const optionsWanted = questions.reduce((n, q) => n + q.options_wanted, 0);
  const optionsDone = questions.reduce((n, q) => n + q.options_ready, 0);
  const withoutVoice = rows.filter((q) => !q.voice_id);

  async function run(target: 'prompt' | 'option', done: number) {
    let overwrite = false;
    if (done > 0) {
      if (!window.confirm(t('audio.confirmRedo', { count: done }))) return;
      overwrite = true;
    }
    setBusy(target);
    setNote(null);
    try {
      const report = await generateStageAudio(stageId, {
        target,
        character_ids: target === 'option' ? ids : [],
        overwrite,
      });
      setNote(reportText(report, t as never));
      setFailedNote(retryHint(report));
      await reload();
    } catch (error) {
      onError(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {busy && (
        <GeneratingOverlay
          count={
            busy === 'prompt'
              ? questions.length - promptDone
              : optionsWanted - optionsDone
          }
        />
      )}
      <p className="mb-2 text-xs text-slate-500">{t('audio.stageHint')}</p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          loading={busy === 'prompt'}
          disabled={questions.length === 0}
          onClick={() => void run('prompt', promptDone)}
        >
          {t('audio.makePrompt')}
        </Button>
        <span className="font-mono text-[11px] text-slate-500">
          {promptDone}/{questions.length}
        </span>
      </div>

      {/* Nhiệm vụ chưa có giọng, kể tên ra TRƯỚC khi bấm. Bấm rồi mới biết là
          đã chờ xong một mẻ để nhận một danh sách. */}
      {withoutVoice.length > 0 && (
        <p className="mb-3 text-xs text-amber-400">
          {t('audio.missingVoice')}:{' '}
          {withoutVoice.map((q) => pickText(q.name_i18n, locale) || '—').join(', ')}
        </p>
      )}

      <div className="border-t border-abyss-800 pt-3">
        <p className="mb-1.5 text-xs text-slate-400">{t('audio.optionCast')}</p>
        <VoiceCastPicker cast={cast} picked={picked} onToggle={toggle} locale={locale} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={busy === 'option'}
            disabled={ids.length === 0 || optionsWanted === 0}
            onClick={() => void run('option', optionsDone)}
          >
            {t('audio.makeOptions')}
          </Button>
          <span className="font-mono text-[11px] text-slate-500">
            {optionsDone}/{optionsWanted}
          </span>
        </div>
      </div>

      {note && <p className="mt-2 text-xs text-lagoon-400">{note}</p>}
      {failedNote && <p className="mt-1 text-xs text-orichalcum-400">{t('audio.retryHint')}</p>}
    </>
  );
}


/**
 * Nút SINH TIẾNG cho lời chia tay — sống trong khối tệp nghe của lời chia tay.
 *
 * Đứng cạnh chính cái tệp nó tạo ra, không đứng ở bảng giọng đọc cách đó mấy
 * dòng: sinh giọng và tải file lên là hai cách làm ra CÙNG MỘT thứ, nên chúng
 * phải ở cùng một chỗ. Xem `MediaField.actions`.
 *
 * Không tự hỏi server tình trạng: mọi thứ nó cần đều đã có ở chỗ gọi — màn chơi
 * biết đã có tệp chưa, popup biết người canh giữ đã có giọng chưa. Thêm một
 * lượt hỏi nữa chỉ để biết lại hai điều đó là thừa.
 */
export function OutroVoiceButton({
  questId,
  hasVoice,
  ready,
  onDone,
  onError,
}: {
  questId: string;
  /** Người canh giữ của nhiệm vụ này đã được gán giọng chưa. */
  hasVoice: boolean;
  /** Đã có tệp rồi — bấm là hỏi ghi đè. */
  ready: boolean;
  onDone: () => void;
  onError: (key: string) => void;
}) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (ready && !window.confirm(t('audio.confirmRedo', { count: 1 }))) return;
    setBusy(true);
    try {
      await generateQuestOutroAudio(questId, { overwrite: ready });
      onDone();
    } catch (error) {
      onError(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {busy && <GeneratingOverlay count={1} />}
    <Button
      variant="secondary"
      size="sm"
      loading={busy}
      disabled={!hasVoice}
      // Chưa gán giọng thì nói VÌ SAO nút mờ, ngay trên con trỏ. Một cái nút
      // mờ không lời giải thích là một cái nút hỏng, dưới mắt người dùng.
      title={hasVoice ? undefined : t('audio.npcNoVoice')}
      onClick={() => void run()}
    >
      {t('audio.makeOutro')}
    </Button>
    </>
  );
}


/**
 * Hộp báo ĐANG TẠO GIỌNG, phủ kín và không đóng được.
 *
 * Không đóng được là chủ ý: mỗi lần sinh là một lần trả tiền cho nhà cung cấp,
 * và một cái bảng chờ bấm ra ngoài được là một cái bảng người ta bấm ra ngoài
 * rồi bấm Tạo lần nữa. Nó tự tắt khi xong.
 *
 * Một mẻ cả màn mất hàng chục giây. Không có gì che thì màn hình đứng im, và
 * người dựng chỉ có hai cách hiểu: hoặc hỏng, hoặc mình chưa bấm.
 */
export function GeneratingOverlay({ count }: { count?: number }) {
  const t = useTranslations();
  return (
    <Modal label={t('audio.working')} onClose={() => undefined}>
      <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl border border-abyss-700 bg-abyss-900 px-6 py-7 text-center shadow-2xl">
        <span
          aria-hidden
          className="size-8 animate-spin rounded-full border-2 border-abyss-700 border-t-lagoon-400"
        />
        <p className="text-sm font-medium text-slate-100">{t('audio.working')}</p>
        <p className="text-xs text-slate-500">
          {count ? t('audio.workingCount', { count }) : t('audio.workingHint')}
        </p>
      </div>
    </Modal>
  );
}

/**
 * Chọn NGHE giọng của nhân vật nào, cho phần phương án của một câu hỏi.
 *
 * Một câu có thể đã thu bằng nhiều giọng — mỗi nhân vật học sinh một bản. Bốn
 * cái loa cạnh bốn phương án chỉ phát được MỘT giọng tại một lúc, nên phải nói
 * rõ đang nghe giọng ai, và đổi được.
 *
 * Chỉ liệt kê nhân vật THẬT SỰ có bản thu cho câu này. Hiện cả dàn rồi bấm vào
 * ai cũng im là tệ hơn không hiện gì.
 */
export function useAnswerVoices(questionId: string, worldId?: string, refreshKey = 0) {
  const { cast } = useVoiceCast(worldId);
  const [rows, setRows] = useState<QuestionAudio[]>([]);
  const [chon, setChon] = useState<string | null>(null);

  useEffect(() => {
    listQuestionAudio(questionId).then(setRows, () => setRows([]));
  }, [questionId, refreshKey]);

  // Giọng nào có bản thu phương án → nhân vật nào nghe được.
  const theoGiong = new Map<string, Record<string, string>>();
  for (const row of rows) {
    if (row.target !== 'option' || !row.option_key || !row.url) continue;
    const bucket = theoGiong.get(row.voice_id) ?? {};
    bucket[row.option_key] = row.url;
    theoGiong.set(row.voice_id, bucket);
  }

  const nhanVat = cast.filter((c) => c.voice_id && theoGiong.has(c.voice_id));

  // Mặc định NGƯỜI ĐẦU TIÊN có tiếng. Giữ lựa chọn cũ nếu vẫn còn hợp lệ —
  // sinh thêm một giọng nữa mà ô chọn tự nhảy về đầu danh sách là mất chỗ.
  const hopLe = chon && nhanVat.some((c) => c.id === chon) ? chon : (nhanVat[0]?.id ?? null);
  const voiceId = nhanVat.find((c) => c.id === hopLe)?.voice_id;

  return {
    nhanVat,
    dangChon: hopLe,
    setChon,
    optionAudio: voiceId ? (theoGiong.get(voiceId) ?? null) : null,
  };
}

/** Hàng chọn nhân vật để nghe thử phương án. */
export function AnswerVoicePicker({
  nhanVat,
  dangChon,
  onPick,
  locale,
}: {
  nhanVat: Character[];
  dangChon: string | null;
  onPick: (id: string) => void;
  locale: string;
}) {
  const t = useTranslations();
  if (nhanVat.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-abyss-800 bg-abyss-950/40 px-3 py-2">
      <span className="text-xs text-slate-400">{t('audio.hearAs')}</span>
      {nhanVat.map((character) => {
        const on = character.id === dangChon;
        return (
          <button
            key={character.id}
            type="button"
            onClick={() => onPick(character.id)}
            className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
              on
                ? 'border-lagoon-400 bg-lagoon-500/15 text-lagoon-300'
                : 'border-abyss-700 text-slate-400 hover:border-lagoon-500/60'
            }`}
          >
            {pickText(character.name_i18n, locale)}
          </button>
        );
      })}
    </div>
  );
}

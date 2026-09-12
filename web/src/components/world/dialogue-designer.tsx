'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { BackgroundLayer } from '@/components/game/background-layer';
import { QuestChat } from '@/components/game/quest-chat';
import { QuestionRenderer } from '@/components/question/renderers';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, PageHeader, SectionTitle, Skeleton } from '@/components/ui/primitives';
import { dialoguePoses } from '@/game/character';
import {
  DIALOGUE,
  DIALOGUE_BACKGROUND,
  DIALOGUE_BLOCK_KEYS,
  DIALOGUE_GAP,
  DIALOGUE_MOMENTS,
  DIALOGUE_MOMENT_KEYS,
  gapMs,
  dialogueBox,
  dialogueContent,
  hasDialogueContent,
  readDialogue,
  type DialogueBlockKey,
  type DialogueMoment,
  type DialogueSaved,
} from '@/game/dialogue';
import { DIALOGUE_THEME_KEYS } from '@/game/dialogue-theme';
import { promptOf, stripPrompt } from '@/game/npc-voice';
import { ApiError } from '@/lib/api-error';
import { dialogueActor, listWorldCharacters } from '@/lib/characters';
import { pickText } from '@/lib/i18n-text';
import { IMAGE_ACCEPT, uploadMedia } from '@/lib/media';
import { getQuestion, type QuestionSummary } from '@/lib/questions';
import { localizedPath } from '@/lib/routes';
import { getStage, updateQuest, updateStage, type Quest, type Stage } from '@/lib/worlds';

import { FrameTextFields, MediaPicker } from './designer-fields';
import { NpcField, useNpcs } from './npc-field';
import { ResizeHandles } from './resize-handles';
import { useDesignBoard, type ResizeAxis } from './use-design-board';

import type { LobbyContentSaved, LobbySaved } from '@/game/world';
import type { DialogueActor } from '@/lib/play';

// Khối và khung nội dung cùng đi qua MỘT bộ kéo thả, nên cần một "id" phân biệt
// được. Cùng nếp tiền tố với trình thiết kế phòng chờ.
const BLOCK_PREFIX = 'block:';
const CONTENT_PREFIX = 'content:';

/** Sàn và trần cỡ khối, theo hệ 1000×700. Đủ nhỏ để nhét, đủ to để phủ cả bảng. */
const BLOCK_SIZE = { min: 40, max: DIALOGUE.width } as const;

/** Sàn của khung nội dung, phần trăm khối — cùng con số với phòng chờ. */
const CONTENT_MIN_PERCENT = 5;

function blockKeyOf(id: string): DialogueBlockKey | null {
  if (!id.startsWith(BLOCK_PREFIX)) return null;
  const key = id.slice(BLOCK_PREFIX.length) as DialogueBlockKey;
  return DIALOGUE_BLOCK_KEYS.includes(key) ? key : null;
}

function contentKeyOf(id: string): DialogueBlockKey | null {
  if (!id.startsWith(CONTENT_PREFIX)) return null;
  const key = id.slice(CONTENT_PREFIX.length) as DialogueBlockKey;
  return DIALOGUE_BLOCK_KEYS.includes(key) ? key : null;
}

/** Kẹp một con số phần trăm vào khoảng dùng được, làm tròn tới 0,1%. */
const roundPercent = (value: number, min: number) =>
  Math.min(100, Math.max(min, Math.round(value * 10) / 10));

/**
 * TRÌNH THIẾT KẾ MÀN HỘI THOẠI — sáu khối của cuộc trò chuyện với người canh giữ.
 *
 * Song song với trình thiết kế phòng chờ, và dùng lại đúng bộ máy đó:
 * `useDesignBoard()`, `ResizeHandles`, `MediaPicker`, `FrameTextFields`. Khối
 * hội thoại và khối phòng chờ là **cùng một hình dạng dữ liệu** (`LobbySaved`),
 * nên cũng là cùng những thao tác.
 *
 * ## Khung xem trước là CHÍNH `QuestDialogue`
 *
 * Không vẽ lại một bản riêng cho màn thiết kế. Người dựng căn cái gì thì học
 * sinh thấy đúng cái đó — kể cả cách chữ co lại khi câu dài, kể cả nấc lùi về
 * ảnh đại diện khi thiếu spritesheet. Một bản vẽ thứ hai sẽ đúng vào hôm nay và
 * sai vào lần sửa sau.
 *
 * Lớp thao tác nằm ĐÈ LÊN khung xem trước, và nuốt hết mọi cú bấm: bên dưới là
 * một câu hỏi tương tác thật, mà người dựng đang căn bố cục chứ không đang làm
 * bài.
 *
 * ## Bố cục là của MÀN CHƠI, không phải của nhiệm vụ
 *
 * `stages.dialogue_json`. Mọi nhiệm vụ trong màn dùng chung một bố cục; thứ đổi
 * theo nhiệm vụ chỉ là KHUÔN MẶT người canh giữ. Ô chọn nhiệm vụ ở đây vì thế
 * chỉ đổi **dữ liệu mẫu** đang xem, không đổi thứ được lưu.
 *
 * `dialogue_json = NULL` nghĩa là **thừa của màn đầu world**, không phải "để
 * trống" — xem `effective_dialogue()`. Nên cú sửa đầu tiên ở một màn đang thừa
 * kế sẽ đúc bố cục thừa kế đó thành của riêng màn này, và không có gì nhảy chỗ.
 */
export function DialogueDesigner({ stageId, worldId }: { stageId: string; worldId: string }) {
  const t = useTranslations();
  const locale = useLocale();

  const [stage, setStage] = useState<Stage | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving'>('idle');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [moment, setMoment] = useState<DialogueMoment>('ask');
  //: Nhiệm vụ đang lấy làm mẫu. `null` = chưa chọn / màn chưa có nhiệm vụ nào.
  const [sampleQuestId, setSampleQuestId] = useState<string | null>(null);
  const [question, setQuestion] = useState<QuestionSummary | null>(null);
  const [player, setPlayer] = useState<DialogueActor | null>(null);
  //: Kho người canh giữ. MỘT danh sách cho cả ô chọn lẫn khung xem trước — tải
  //: hai lần là hai bản có thể lệch nhau đúng một nhịp, và nhịp đó là lúc người
  //: dựng vừa chọn xong và đang nhìn vào khuôn mặt để xem có đúng không.
  const npcs = useNpcs();
  //: Màu chữ đang rê trong bảng chọn — chỉ để vẽ, chưa ghi.

  const reload = useCallback(async () => {
    try {
      const next = await getStage(stageId);
      setStage(next);
      setErrorKey(null);
      return next;
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
      return null;
    } finally {
      setLoading(false);
    }
  }, [stageId]);

  useEffect(() => {
    void reload().then((next) => {
      // Nhiệm vụ ĐẦU TIÊN làm mẫu, không phải một cái rỗng: người dựng mở màn
      // này ra là muốn thấy ngay một cuộc trò chuyện, không muốn chọn một ô.
      const first = next?.quests[0];
      if (first) setSampleQuestId(first.id);
    });
  }, [reload]);

  // Nhân vật học sinh — lấy con ĐẦU TIÊN của world, chỉ để ướm. Cùng lý do với
  // hình bóng nhân vật ở trình thiết kế màn chơi: không đoán trước được học
  // sinh chọn ai, mà khung mặt thì cỡ nào cũng như nhau.
  useEffect(() => {
    listWorldCharacters(worldId).then(
      (list) => setPlayer(list[0] ? dialogueActor(list[0]) : null),
      () => setPlayer(null),
    );
  }, [worldId]);

  const sampleQuest = stage?.quests.find((q) => q.id === sampleQuestId) ?? null;
  const npcId = sampleQuest?.npc_character_id ?? null;
  const firstQuestionId = sampleQuest?.questions[0]?.question_id ?? null;

  // Người canh giữ của nhiệm vụ đang xem, dựng từ chính danh sách của ô chọn.
  const chosenNpc = npcs?.find((c) => c.id === npcId) ?? null;
  const npc = chosenNpc ? dialogueActor(chosenNpc) : null;

  useEffect(() => {
    if (!firstQuestionId) return setQuestion(null);
    // Hỏng thì coi như chưa có câu mẫu: bố cục vẫn căn được bằng câu mặc định,
    // và một màn thiết kế trắng xoá vì một câu hỏi bị xoá là quá đắt.
    getQuestion(firstQuestionId).then(setQuestion, () => setQuestion(null));
  }, [firstQuestionId]);

  // Bố cục ĐANG DÙNG — đã giải xong kế thừa. Mọi phép sửa xuất phát từ đây, nên
  // cú sửa đầu tiên ở một màn đang thừa kế không làm gì nhảy chỗ.
  const effective = useMemo(() => readDialogue(stage?.dialogue_effective), [stage]);
  const urls = stage?.dialogue_urls ?? {};
  const inherited = stage != null && stage.dialogue_json == null;

  async function save(next: DialogueSaved) {
    setSaveState('saving');
    try {
      setStage(await updateStage(stageId, { dialogue_json: next }));
      setErrorKey(null);
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    } finally {
      setSaveState('idle');
    }
  }

  const patchBlock = (key: DialogueBlockKey, change: Partial<LobbySaved>) =>
    save({ ...effective, [key]: { ...effective[key], ...change } });

  /**
   * Đặt hay gỡ MỘT tấm ảnh — nền tấm bảng, hay da bong bóng một bên.
   *
   * Gỡ thì XOÁ HẲN khoá đi chứ không để lại `{ media_id: null }`: một khoá rỗng
   * nằm đó trông như "đã đặt rồi nhưng đang trống", mà thứ ta muốn nói là "chưa
   * ai đặt gì".
   */
  function patchImage(key: string, mediaId: string | null) {
    const next: Record<string, unknown> = { ...effective };
    if (mediaId) next[key] = { media_id: mediaId };
    else delete next[key];
    return save(next as typeof effective);
  }

  const patchContent = (key: DialogueBlockKey, change: Partial<LobbyContentSaved>) =>
    save({
      ...effective,
      [key]: {
        ...effective[key],
        content: { ...effective[key]?.content, ...change },
      },
    });

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!stage) {
    return (
      <p
        role="alert"
        className="mx-auto max-w-lg rounded-lg bg-coral-500/15 px-4 py-3 text-coral-500"
      >
        {t(errorKey ?? 'error.NOT_FOUND')}
      </p>
    );
  }

  const stageName = pickText(stage.name_i18n, locale);
  const state = DIALOGUE_MOMENTS[moment];
  const pose = dialoguePoses(state);
  const prompt = question ? promptOf(question.content) : '';

  return (
    <div className="mx-auto max-w-7xl">
      <Breadcrumb
        items={[
          { label: t('teacher.title'), href: localizedPath('/teacher', locale) },
          { label: t('world.list.title'), href: localizedPath('/teacher/worlds', locale) },
          {
            label: t('world.detail.backToWorld'),
            href: localizedPath(`/teacher/worlds/${worldId}`, locale),
          },
          {
            label: stageName,
            href: localizedPath(`/teacher/worlds/${worldId}/stages/${stageId}`, locale),
          },
          { label: t('dialogue.designer.title') },
        ]}
      />
      <PageHeader
        title={t('dialogue.designer.title')}
        description={t('dialogue.designer.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              {saveState === 'saving' ? t('common.loading') : `✓ ${t('designer.saved')}`}
            </span>
            <Link
              href={localizedPath(`/teacher/worlds/${worldId}/stages/${stageId}/design`, locale)}
            >
              <Button variant="secondary" size="sm">
                {t('dialogue.designer.toScene')}
              </Button>
            </Link>
          </div>
        }
      />

      {errorKey && (
        <p role="alert" className="mb-4 rounded-lg bg-coral-500/15 px-4 py-2 text-sm text-coral-500">
          {t(errorKey)}
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_22rem]">
        <div>
          <div
            className="relative mx-auto overflow-hidden rounded-2xl select-none"
            style={{
              aspectRatio: `${DIALOGUE.width} / ${DIALOGUE.height}`,
              width: `min(100%, 60vh * ${DIALOGUE.width} / ${DIALOGUE.height})`,
            }}
          >
            {/* Ảnh nền của MÀN, vẽ DƯỚI tấm bảng.
                Trong lúc chơi thật thì chỗ này là cảnh Phaser đang chạy, và tấm
                bảng trong suốt phủ lên trên nó. Ở đây không có cảnh Phaser nào,
                nên trình thiết kế tự dựng lại cái phông ấy — không có nó thì
                giáo viên căn bong bóng trên một khoảng đen và không biết chữ
                của mình sẽ nằm đè lên cái gì.

                `still` — ghim khung hình đầu: một tấm nền động sau lưng dòng
                chữ đang phải căn chỉ làm khó việc căn. */}
            <BackgroundLayer
              url={stage.background_url}
              kind={stage.background_kind}
              still
              className="absolute inset-0 size-full object-cover"
            />
            {!stage.background_url && (
              <div className="absolute inset-0 bg-linear-to-b from-abyss-900 to-abyss-950" />
            )}

            <QuestChat
              layout={effective}
              urls={urls}
              npcName={
                sampleQuest ? pickText(sampleQuest.npc_name_i18n ?? {}, locale) : t('designer.npc')
              }
              npc={npc}
              npcPose={pose.npc}
              playerName={t('dialogue.sample.player')}
              player={player}
              playerPose={pose.player}
              /* Ba tin nhắn mẫu — đủ để thấy CẢ HAI kiểu bong bóng và cách
                 chúng dính thành cụm. Ít hơn thì không so được hai bên; nhiều
                 hơn thì khung xem trước thành một đoạn văn, mà thứ người dựng
                 đang chỉnh chỉ là màu và ảnh. */
              lines={[
                { seq: 0, role: 'npc', kind: 'prompt', text: prompt || t('dialogue.sample.question') },
                { seq: 1, role: 'player', kind: 'answer', text: t('dialogue.sample.answer') },
                {
                  seq: 2,
                  role: 'npc',
                  kind: 'verdict',
                  text: t(`dialogue.sample.verdict.${moment}`),
                  tone: state.verdict ?? null,
                },
              ]}
              /* Lúc người canh giữ ĐANG ĐỌC thì cuối đoạn hiện ba chấm chứ
                 không hiện chữ — đúng như màn chơi. */
              typing={state.speaking}
              answer={
                question ? (
                  <QuestionRenderer
                    type={question.type}
                    /* KHÔNG truyền `promptKind`/`audioUrl`: đề bài — chữ lẫn
                       tiếng — đã nằm trong bong bóng của người canh giữ. Truyền
                       xuống đây nữa là khung mẫu mọc thêm một trình phát thứ
                       hai mà màn chơi thật không có, tức khung xem trước nói
                       dối đúng chỗ nó sinh ra để nói thật. */
                    content={stripPrompt(question.content)}
                    value={null}
                    onChange={() => {}}
                    mode="exam"
                    answer={null}
                    disabled
                  />
                ) : (
                  <p className="p-2 text-center text-sm text-slate-400">
                    {t('dialogue.designer.noSample')}
                  </p>
                )
              }
              header={null}
              onClose={() => {}}
              onTypingChange={() => {}}
            />
          </div>

          <p className="mt-2 text-xs text-slate-500">{t('designer.autoSave')}</p>
        </div>

        {/* ============ CỘT PHẢI: chọn cảnh xem trước, rồi sửa khối ============

            CUỘN RIÊNG. Cột này dài hơn màn hình — bốn thẻ cấu hình cộng bảng
            chỉnh khối — nên nếu để cả trang cuộn thì kéo xuống ô cuối cùng là
            khung xem trước đã trôi khỏi tầm mắt, mà cái ô đang chỉnh lại nói về
            chính cái khung ấy.

            `60vh` là CÙNG con số giới hạn chiều cao khung xem trước bên trái
            (xem `width: min(100%, 60vh …)` ở trên). Nhờ vậy hai cột cao bằng
            nhau, cả trang vừa một màn hình, và bánh xe chuột lăn trên cột này
            thì chỉ cột này chạy. Một `max-h` tính theo `100vh` thì SAI: cột bắt
            đầu ở lưng chừng trang, nên đáy nó vẫn thò xuống dưới mép màn hình —
            đã đo và thấy thò 150px.

            Chỉ từ `lg` trở lên: dưới mức đó bố cục xếp một cột, và bắt một cột
            đơn cuộn trong lòng trang là hai thanh cuộn lồng nhau.

            `pr-1` để thanh cuộn không đè lên viền các thẻ. */}
        <div className="space-y-4 lg:max-h-[60vh] lg:overflow-y-auto lg:pr-1">
          <Card>
            <SectionTitle>{t('dialogue.designer.sample')}</SectionTitle>
            <p className="mb-3 text-xs text-slate-500">{t('dialogue.designer.sampleHint')}</p>

            <label className="mb-3 block">
              <span className="field-label">{t('designer.quests', { count: stage.quests.length })}</span>
              <select
                className="field-input"
                value={sampleQuestId ?? ''}
                onChange={(e) => setSampleQuestId(e.target.value || null)}
              >
                {stage.quests.length === 0 && <option value="">{t('designer.noQuest')}</option>}
                {stage.quests.map((quest: Quest) => (
                  <option key={quest.id} value={quest.id}>
                    {pickText(quest.name_i18n, locale) || quest.quest_object_key}
                  </option>
                ))}
              </select>
            </label>

            <span className="field-label">{t('dialogue.designer.moment')}</span>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-abyss-950/60 p-1">
              {DIALOGUE_MOMENT_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMoment(key)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                    key === moment
                      ? 'bg-abyss-700 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t(`dialogue.moment.${key}`)}
                </button>
              ))}
            </div>
            <p className="mt-2 font-mono text-[11px] text-slate-500">
              npc: {pose.npc} · player: {pose.player}
            </p>
          </Card>

          {/* NGƯỜI CANH GIỮ của nhiệm vụ đang xem.
              Ở ĐÂY chứ không chỉ ở popup sửa nhiệm vụ: đây là màn hình duy nhất
              khuôn mặt đó hiện ra to bằng thật, nên đây là chỗ người ta nhận ra
              mình gán nhầm người — bắt họ đóng màn này, mở lại trình thiết kế
              cảnh, tìm đúng vật thể rồi bấm đúp là bốn bước cho một ô chọn.

              Đây là thứ DUY NHẤT trên màn này ghi vào NHIỆM VỤ chứ không vào
              màn chơi; bố cục thì vẫn dùng chung cho cả màn. */}
          {sampleQuest && (
            <Card>
              <SectionTitle>{t('dialogue.designer.npcFor')}</SectionTitle>
              <p className="mb-3 text-xs text-slate-500">
                {pickText(sampleQuest.name_i18n, locale) || sampleQuest.quest_object_key}
              </p>
              <NpcField
                quest={sampleQuest}
                npcs={npcs}
                locale={locale}
                onPick={async (id) => {
                  setSaveState('saving');
                  try {
                    await updateQuest(sampleQuest.id, { npc_character_id: id });
                    // Nạp lại cả màn: `npc_name_i18n` và `npc_avatar_url` nằm
                    // trong nhiệm vụ, và khung xem trước đọc chúng.
                    await reload();
                  } catch (error) {
                    setErrorKey(
                      error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR',
                    );
                  } finally {
                    setSaveState('idle');
                  }
                }}
              />
            </Card>
          )}

          {/* ẢNH NỀN CẢ BẢNG — tuỳ chọn, và mặc định là KHÔNG có.
              Không có thì tấm bảng trong suốt và cảnh chơi thật hiện xuyên qua;
              đó vẫn là cách dùng thường ngày. Có thì dành cho lúc người dựng
              muốn cuộc trò chuyện diễn ra trong một khung cảnh riêng. */}
          <Card>
            <SectionTitle>{t('dialogue.designer.panelImage')}</SectionTitle>
            <p className="mb-3 text-xs text-slate-500">
              {t('dialogue.designer.panelImageHint')}
            </p>
            <MediaPicker
              label={t('dialogue.designer.blockImage')}
              accept={IMAGE_ACCEPT}
              busy={busyKey === DIALOGUE_BACKGROUND}
              hasValue={Boolean(effective[DIALOGUE_BACKGROUND]?.media_id)}
              onPick={async (file) => {
                setBusyKey(DIALOGUE_BACKGROUND);
                try {
                  const asset = await uploadMedia(file, 'dialogue');
                  await patchImage(DIALOGUE_BACKGROUND, asset.id);
                } catch (error) {
                  setErrorKey(
                    error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR',
                  );
                } finally {
                  setBusyKey(null);
                }
              }}
              onClear={() => void patchImage(DIALOGUE_BACKGROUND, null)}
              preview={
                urls[DIALOGUE_BACKGROUND] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urls[DIALOGUE_BACKGROUND]}
                    alt=""
                    className="mb-2 max-h-24 w-full rounded-lg border border-abyss-700 object-contain"
                  />
                ) : null
              }
            />
          </Card>

          {/* DA BONG BÓNG — hai ảnh, một cho mỗi bên.

              Không có thì bong bóng dùng lớp kính mặc định của màn chat. Có thì
              ảnh kéo giãn cho vừa bong bóng, và bong bóng vẫn dài ra theo chữ —
              nên ảnh nên là một khung trơn, đừng vẽ hoạ tiết ở giữa. */}
          <Card>
            <SectionTitle>{t('dialogue.designer.bubbleImages')}</SectionTitle>
            <p className="mb-3 text-xs text-slate-500">
              {t('dialogue.designer.bubbleImagesHint')}
            </p>

            <div className="space-y-4">
              {(['npcBubble', 'playerBubble'] as const).map((key) => (
                <div key={key}>
                  <span className="field-label">{t(`dialogue.block.${key}`)}</span>
                  <MediaPicker
                    label={t('dialogue.designer.blockImage')}
                    accept={IMAGE_ACCEPT}
                    busy={busyKey === key}
                    hasValue={Boolean(effective[key]?.media_id)}
                    onPick={async (file) => {
                      setBusyKey(key);
                      try {
                        const asset = await uploadMedia(file, 'dialogue');
                        await patchImage(key, asset.id);
                      } catch (error) {
                        setErrorKey(
                          error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR',
                        );
                      } finally {
                        setBusyKey(null);
                      }
                    }}
                    onClear={() => void patchImage(key, null)}
                    preview={
                      urls[key] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={urls[key]}
                          alt=""
                          className="mb-2 max-h-20 w-full rounded-lg border border-abyss-700 object-contain"
                        />
                      ) : null
                    }
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* NHỊP. Không phải một khối kéo thả, nhưng cùng thuộc về cuộc trò
              chuyện và cùng thừa kế theo màn đầu world, nên nó sống chung
              `dialogue_json` với bố cục — xem `DIALOGUE_GAP_KEY`. */}
          {/* BỘ ÁO. Cùng chỗ lưu với bố cục và nhịp nghỉ, nên nó cũng thừa kế
              theo màn đầu world và cũng đóng băng vào đề bài. */}
          <Card>
            <SectionTitle>{t('dialogue.designer.theme')}</SectionTitle>
            <p className="mb-3 text-xs leading-snug text-slate-500">
              {t('dialogue.designer.themeHint')}
            </p>
            <div className="flex flex-wrap gap-2">
              {DIALOGUE_THEME_KEYS.map((key) => {
                const dangChon = (effective.theme ?? 'classic') === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (dangChon) return;
                      void save({ ...effective, theme: key });
                    }}
                    className={`rounded-xl border px-3 py-2 text-xs transition ${
                      dangChon
                        ? 'border-lagoon-500 bg-lagoon-500/15 text-lagoon-300'
                        : 'border-abyss-700 text-slate-300 hover:border-lagoon-500/70'
                    }`}
                  >
                    {t(`dialogue.theme.${key}`)}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <SectionTitle>{t('dialogue.designer.pace')}</SectionTitle>
            <label className="block">
              <span className="field-label">{t('dialogue.designer.gap')}</span>
              <span className="mb-1 block text-[11px] leading-snug text-slate-500">
                {t('dialogue.designer.gapHint')}
              </span>
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  className="field-input w-28 font-mono text-xs"
                  min={DIALOGUE_GAP.min / 1000}
                  max={DIALOGUE_GAP.max / 1000}
                  step={0.1}
                  // Nhập bằng GIÂY, lưu bằng mili giây: người dựng nghĩ "một
                  // giây rưỡi", không nghĩ "1500".
                  //
                  // Không kiểm soát: gõ xong rời ô mới lưu. Ô kiểm soát thì mỗi
                  // ký tự là một lần gọi mạng, và gõ "1.5" đi qua "1." — một
                  // giá trị không phải số.
                  defaultValue={(gapMs(effective) / 1000).toFixed(1)}
                  onBlur={(event) => {
                    const giay = Number(event.target.value);
                    if (!Number.isFinite(giay)) {
                      event.target.value = (gapMs(effective) / 1000).toFixed(1);
                      return;
                    }
                    const ms = Math.min(
                      DIALOGUE_GAP.max,
                      Math.max(DIALOGUE_GAP.min, Math.round(giay * 1000)),
                    );
                    event.target.value = (ms / 1000).toFixed(1);
                    if (ms === gapMs(effective)) return;
                    void save({ ...effective, gapMs: ms });
                  }}
                />
                <span className="text-xs text-slate-500">{t('dialogue.designer.gapUnit')}</span>
              </span>
            </label>
          </Card>

          {/* KẾ THỪA. Hiện cả khi đang thừa kế lẫn khi đã tách riêng: người dựng
              phải biết mình đang sửa bố cục của cả world hay của riêng màn này
              TRƯỚC khi kéo, chứ không phải sau. */}
          <Card>
            <SectionTitle>{t('dialogue.designer.scope')}</SectionTitle>
            <p className="mb-3 text-xs text-slate-500">
              {t(inherited ? 'dialogue.designer.inheriting' : 'dialogue.designer.ownLayout')}
            </p>
            {!inherited && (
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  if (!window.confirm(t('dialogue.designer.confirmClear'))) return;
                  setSaveState('saving');
                  try {
                    setStage(await updateStage(stageId, { clear_dialogue: true }));
                  } catch (error) {
                    setErrorKey(
                      error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR',
                    );
                  } finally {
                    setSaveState('idle');
                  }
                }}
              >
                {t('dialogue.designer.clear')}
              </Button>
            )}
          </Card>

        </div>
      </div>
    </div>
  );
}

